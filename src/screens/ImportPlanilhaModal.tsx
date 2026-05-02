import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { storage } from '../services/storage';
import { useCategories } from '../hooks/useStorage';
import { Icon } from '../components/Icon';
import { RADIUS, SPACING, Transaction, TransactionType } from '../types';
import { useTheme } from '../hooks/useTheme';
import { generateId } from '../utils/formatters';

// ── CSV parsing ──────────────────────────────────────────────────────────────

function detectDelimiter(header: string): string {
  const sc = (header.match(/;/g) ?? []).length;
  const co = (header.match(/,/g) ?? []).length;
  return sc >= co ? ';' : ',';
}

function parseCSVLine(line: string, delim: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === delim && !inQ) {
      result.push(cur.trim().replace(/^"|"$/g, ''));
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim().replace(/^"|"$/g, ''));
  return result;
}

function parseCSVContent(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const delim = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delim);
  const rows = lines.slice(1).map((l) => parseCSVLine(l, delim));
  return { headers, rows };
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return s.slice(0, 10);
  }
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    const d = new Date(+yyyy, +mm - 1, +dd);
    if (!isNaN(d.getTime())) return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const br2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (br2) {
    const [, dd, mm, yy] = br2;
    const yyyy = 2000 + +yy;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // Excel serial
  const serial = parseFloat(s);
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    const d = new Date(Date.UTC(1900, 0, serial - 1));
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function parseValue(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().replace(/R\$\s*/gi, '').replace(/\s/g, '');
  const isNeg = s.startsWith('(') || s.startsWith('-');
  s = s.replace(/[()]/g, '').replace(/^-/, '');
  // BR: 1.234,56 or 234,56
  if (/\d+\.\d{3},\d{1,2}/.test(s) || /^\d+,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const v = parseFloat(s);
  if (isNaN(v)) return null;
  return isNeg ? -v : v;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ── Column auto-detection ─────────────────────────────────────────────────────

const COL_HINTS: Record<keyof ColumnMapping, string[]> = {
  data: ['data', 'date', 'dia', 'vencimento', 'competencia'],
  valor: ['valor', 'value', 'montante', 'amount', 'preco', 'preco'],
  descricao: ['descricao', 'description', 'titulo', 'historico', 'lancamento', 'estabelecimento', 'nome'],
  tipo: ['tipo', 'type', 'natureza', 'operacao'],
  categoria: ['categoria', 'category', 'grupo', 'tag'],
};

function autoDetect(headers: string[]): ColumnMapping {
  const find = (keys: string[]) => {
    const i = headers.findIndex((h) => keys.some((k) => normalize(h).includes(k)));
    return i >= 0 ? String(i) : '';
  };
  return {
    data: find(COL_HINTS.data),
    valor: find(COL_HINTS.valor),
    descricao: find(COL_HINTS.descricao),
    tipo: find(COL_HINTS.tipo),
    categoria: find(COL_HINTS.categoria),
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ColumnMapping {
  data: string;
  valor: string;
  descricao: string;
  tipo: string;
  categoria: string;
}

interface ParsedFile {
  headers: string[];
  rows: string[][];
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ImportPlanilhaModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { items: categories } = useCategories();

  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({ data: '', valor: '', descricao: '', tipo: '', categoria: '' });
  const [result, setResult] = useState<{ ok: number; skip: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setParsed(null);
    setMapping({ data: '', valor: '', descricao: '', tipo: '', categoria: '' });
    setResult(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const pickFile = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) return;
      const content = await FileSystem.readAsStringAsync(r.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const { headers, rows } = parseCSVContent(content);
      if (headers.length === 0) {
        Alert.alert('Arquivo inválido', 'O arquivo não tem cabeçalho ou está vazio. Certifique-se de que é um CSV com a primeira linha sendo os nomes das colunas.');
        return;
      }
      const m = autoDetect(headers);
      setParsed({ headers, rows });
      setMapping(m);
    } catch (e: any) {
      Alert.alert('Erro ao ler arquivo', e.message);
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    if (!mapping.data || !mapping.valor) {
      Alert.alert('Mapeamento incompleto', 'Mapeie pelo menos as colunas Data e Valor.');
      return;
    }
    setLoading(true);
    try {
      const existing = await storage.getTransactions();
      const newTx: Transaction[] = [];
      let skipped = 0;

      for (const row of parsed.rows) {
        if (row.every((c) => !c)) continue;

        const rawDate = row[+mapping.data] ?? '';
        const rawValor = row[+mapping.valor] ?? '';
        const parsedDate = parseDate(rawDate);
        const parsedValor = parseValue(rawValor);

        if (!parsedDate || parsedValor === null) { skipped++; continue; }

        const absValor = Math.abs(parsedValor);
        if (absValor === 0) { skipped++; continue; }

        let tipo: TransactionType;
        if (mapping.tipo) {
          const tipoRaw = normalize(row[+mapping.tipo] ?? '');
          if (tipoRaw.includes('receita') || tipoRaw.includes('entrada') || tipoRaw.includes('cred') || tipoRaw === 'c') {
            tipo = 'receita';
          } else if (tipoRaw.includes('despesa') || tipoRaw.includes('saida') || tipoRaw.includes('debit') || tipoRaw === 'd') {
            tipo = 'despesa';
          } else {
            tipo = parsedValor >= 0 ? 'receita' : 'despesa';
          }
        } else {
          tipo = parsedValor >= 0 ? 'receita' : 'despesa';
        }

        const descricao = mapping.descricao ? (row[+mapping.descricao]?.trim() || 'Importado') : 'Importado';

        let categoriaId = tipo === 'receita' ? 'cat-salario' : 'cat-outros';
        if (mapping.categoria) {
          const catRaw = normalize(row[+mapping.categoria] ?? '');
          const match = categories.find((c) => normalize(c.nome).includes(catRaw) || catRaw.includes(normalize(c.nome)));
          if (match) categoriaId = match.id;
        }

        newTx.push({
          id: generateId(),
          descricao,
          tipo,
          valor: absValor,
          data: parsedDate,
          categoriaId,
          criadoEm: new Date().toISOString(),
        });
      }

      await storage.setTransactions([...existing, ...newTx]);
      setResult({ ok: newTx.length, skip: skipped });
    } catch (e: any) {
      Alert.alert('Erro na importação', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Preview ────────────────────────────────────────────────────────────────

  const previewRows = parsed?.rows.slice(0, 3) ?? [];
  const validCount = parsed
    ? parsed.rows.filter((row) => {
        if (!mapping.data || !mapping.valor) return false;
        const d = parseDate(row[+mapping.data] ?? '');
        const v = parseValue(row[+mapping.valor] ?? '');
        return d !== null && v !== null && Math.abs(v) > 0;
      }).length
    : 0;

  // ── Column picker row ──────────────────────────────────────────────────────

  const ColumnPicker = ({ label, field, required }: { label: string; field: keyof ColumnMapping; required?: boolean }) => (
    <View style={styles.mapRow}>
      <Text style={styles.mapLabel}>{label}{required ? ' *' : ''}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mapScroll}>
        {!required && (
          <TouchableOpacity
            style={[styles.colChip, mapping[field] === '' && styles.colChipActive]}
            onPress={() => setMapping((m) => ({ ...m, [field]: '' }))}
          >
            <Text style={[styles.colChipText, mapping[field] === '' && styles.colChipTextActive]}>—</Text>
          </TouchableOpacity>
        )}
        {(parsed?.headers ?? []).map((h, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.colChip, mapping[field] === String(i) && styles.colChipActive]}
            onPress={() => setMapping((m) => ({ ...m, [field]: String(i) }))}
          >
            <Text style={[styles.colChipText, mapping[field] === String(i) && styles.colChipTextActive]}>
              {h || `Col ${i + 1}`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancel}>{result ? 'Fechar' : 'Cancelar'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Importar Planilha</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>

          {/* ── Resultado ── */}
          {result && (
            <View style={styles.resultCard}>
              <Icon name={result.ok > 0 ? 'checkmark-circle' : 'warning'} size={40}
                color={result.ok > 0 ? colors.primary : colors.warning} />
              <Text style={styles.resultTitle}>
                {result.ok > 0 ? `${result.ok} lançamento${result.ok !== 1 ? 's' : ''} importado${result.ok !== 1 ? 's' : ''}!` : 'Nenhum lançamento importado'}
              </Text>
              {result.skip > 0 && (
                <Text style={styles.resultSub}>
                  {result.skip} linha{result.skip !== 1 ? 's' : ''} ignorada{result.skip !== 1 ? 's' : ''} (data ou valor inválido)
                </Text>
              )}
            </View>
          )}

          {/* ── Idle: nenhum arquivo selecionado ── */}
          {!parsed && !result && (
            <>
              <View style={styles.infoCard}>
                <Icon name="document-text-outline" size={18} color={colors.primary} />
                <Text style={styles.infoText}>
                  Importe lançamentos de qualquer planilha exportada como <Text style={{ fontWeight: '700' }}>CSV</Text>.
                  {'\n'}Excel, Google Planilhas e Numbers exportam CSV pelo menu Arquivo → Baixar/Exportar.
                </Text>
              </View>
              <View style={styles.infoCard}>
                <Icon name="information-circle-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.infoText}>
                  A primeira linha deve conter os <Text style={{ fontWeight: '700' }}>nomes das colunas</Text>.
                  {'\n'}Colunas detectadas automaticamente. Você poderá revisar antes de importar.
                </Text>
              </View>
              <TouchableOpacity style={styles.pickBtn} onPress={pickFile}>
                <Icon name="folder-open-outline" size={18} color="#0a0a0b" />
                <Text style={styles.pickBtnText}>Escolher arquivo CSV</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Mapeamento ── */}
          {parsed && !result && (
            <>
              <View style={styles.sectionHeader}>
                <Icon name="git-branch-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.sectionTitle}>
                  {parsed.rows.length} linha{parsed.rows.length !== 1 ? 's' : ''} detectada{parsed.rows.length !== 1 ? 's' : ''} · {parsed.headers.length} coluna{parsed.headers.length !== 1 ? 's' : ''}
                </Text>
              </View>

              <Text style={styles.sectionLabel}>Mapeamento de colunas</Text>
              <View style={styles.mapCard}>
                <ColumnPicker label="Data" field="data" required />
                <ColumnPicker label="Valor" field="valor" required />
                <ColumnPicker label="Descrição" field="descricao" />
                <ColumnPicker label="Tipo (Receita/Despesa)" field="tipo" />
                <ColumnPicker label="Categoria" field="categoria" />
              </View>

              {/* Prévia */}
              {previewRows.length > 0 && mapping.data && mapping.valor && (
                <>
                  <Text style={styles.sectionLabel}>Prévia (primeiras linhas)</Text>
                  <View style={styles.previewCard}>
                    <View style={styles.previewHeader}>
                      <Text style={[styles.previewCell, { flex: 1 }]}>Data</Text>
                      <Text style={[styles.previewCell, { width: 90 }]}>Valor</Text>
                      <Text style={[styles.previewCell, { flex: 1 }]}>Tipo</Text>
                      {mapping.descricao ? <Text style={[styles.previewCell, { flex: 2 }]}>Desc.</Text> : null}
                    </View>
                    {previewRows.map((row, ri) => {
                      const d = parseDate(row[+mapping.data] ?? '');
                      const v = parseValue(row[+mapping.valor] ?? '');
                      const isValid = d !== null && v !== null && Math.abs(v) > 0;
                      const tipoR: TransactionType = mapping.tipo
                        ? (normalize(row[+mapping.tipo] ?? '').includes('receita') || normalize(row[+mapping.tipo] ?? '').includes('entrada') ? 'receita' : 'despesa')
                        : (v ?? 0) >= 0 ? 'receita' : 'despesa';
                      return (
                        <View key={ri} style={[styles.previewRow, !isValid && styles.previewRowInvalid]}>
                          <Text style={[styles.previewCell, { flex: 1 }, !isValid && styles.previewCellInvalid]}>
                            {d ?? row[+mapping.data] ?? '—'}
                          </Text>
                          <Text style={[styles.previewCell, { width: 90, color: isValid ? (tipoR === 'receita' ? colors.primary : colors.danger) : colors.textMuted }]}>
                            {v !== null ? `${tipoR === 'despesa' ? '−' : '+'} R$ ${Math.abs(v).toFixed(2).replace('.', ',')}` : (row[+mapping.valor] ?? '—')}
                          </Text>
                          <Text style={[styles.previewCell, { flex: 1 }, !isValid && styles.previewCellInvalid]}>
                            {isValid ? (tipoR === 'receita' ? 'Receita' : 'Despesa') : 'Inválido'}
                          </Text>
                          {mapping.descricao ? (
                            <Text style={[styles.previewCell, { flex: 2 }]} numberOfLines={1}>
                              {row[+mapping.descricao] ?? '—'}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[styles.pickBtn, (!mapping.data || !mapping.valor || loading) && styles.pickBtnDisabled]}
                onPress={handleImport}
                disabled={!mapping.data || !mapping.valor || loading}
              >
                <Icon name="cloud-upload-outline" size={18} color="#0a0a0b" />
                <Text style={styles.pickBtnText}>
                  {loading ? 'Importando...' : `Importar ${validCount} lançamento${validCount !== 1 ? 's' : ''}`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={reset}>
                <Text style={styles.secondaryBtnText}>Escolher outro arquivo</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  cancel: { color: colors.primary, fontSize: 15 },
  title: { color: colors.text, fontSize: 17, fontWeight: '600' },
  body: { padding: SPACING.lg, paddingBottom: 60, gap: SPACING.md },

  infoCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'flex-start',
  },
  infoText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, flex: 1 },

  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  pickBtnDisabled: { opacity: 0.4 },
  pickBtnText: { color: '#0a0a0b', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    alignItems: 'center',
    padding: SPACING.sm,
  },
  secondaryBtnText: { color: colors.textSecondary, fontSize: 14 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
  },
  sectionTitle: { color: colors.textSecondary, fontSize: 13 },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: SPACING.md,
    marginBottom: 4,
  },

  mapCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  mapRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  mapLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 6 },
  mapScroll: { flexGrow: 0 },

  colChip: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.cardElevated,
    marginRight: 6,
  },
  colChipActive: { backgroundColor: colors.primary },
  colChipText: { color: colors.textSecondary, fontSize: 12 },
  colChipTextActive: { color: '#0a0a0b', fontWeight: '700' },

  previewCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    backgroundColor: colors.cardElevated,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  previewRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  previewRowInvalid: { backgroundColor: colors.dangerSoft },
  previewCell: { color: colors.text, fontSize: 12, paddingRight: 4 },
  previewCellInvalid: { color: colors.textMuted },

  resultCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  resultTitle: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  resultSub: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
});
