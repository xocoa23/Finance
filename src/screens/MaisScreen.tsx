import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../hooks/useAuth';
import { useCategories } from '../hooks/useStorage';
import { useMonthlyIncome, calcRendaLiquida } from '../hooks/useMonthlyIncome';
import { CategoryDot } from '../components/CategoryDot';
import { PinPad } from '../components/PinPad';
import { Icon, IconName } from '../components/Icon';
import { MoneyText } from '../components/MoneyText';
import { HistoricoModal } from './HistoricoModal';
import { ImportPlanilhaModal } from './ImportPlanilhaModal';
import { storage } from '../services/storage';
import { notifications } from '../services/notifications';
import { Category, RADIUS, SPACING, STORAGE_KEYS, AppTheme, AppIcon, SalarioAjuste } from '../types';
import { useTheme } from '../hooks/useTheme';
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyInput,
  generateId,
} from '../utils/formatters';

const PALETTE = [
  '#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf',
  '#ff8b94', '#c7ceea', '#3ddc97', '#ffc070',
  '#9b59b6', '#3498db', '#e74c3c', '#1abc9c',
];

type ModalType =
  | null
  | 'calc' | 'categorias' | 'seguranca' | 'backup' | 'sobre' | 'historico' | 'changePin' | 'renda' | 'aparencia' | 'perfil';

interface MenuItem {
  id: ModalType;
  icon: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
}

export function MaisScreen() {
  const { colors, theme } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const auth = useAuth();
  const [modal, setModal] = useState<ModalType>(null);
  const { rendaLiquida: rendaMensal } = useMonthlyIncome();

  const getThemeText = () => {
    switch (theme) {
      case 'dark': return 'Escuro';
      case 'light': return 'Claro';
      default: return 'Automático do Sistema';
    }
  };

  const sections: Array<{ title: string; items: MenuItem[] }> = [
    {
      title: 'Análise',
      items: [
        { id: 'historico', icon: 'stats-chart-outline', title: 'Histórico & comparativos', subtitle: 'Mês × mês, ano × ano' },
        { id: 'calc', icon: 'calculator-outline', title: 'Calculadora financeira', subtitle: 'Juros simples e compostos' },
      ],
    },
    {
      title: 'Configurações',
      items: [
        {
          id: 'renda',
          icon: 'wallet-outline',
          title: 'Renda mensal',
          subtitle: rendaMensal > 0 ? formatCurrency(rendaMensal) : 'Ainda não definida',
        },
        { id: 'perfil', icon: 'person-outline', title: 'Perfil', subtitle: 'Nome e CPF para comprovantes' },
        { id: 'aparencia', icon: 'color-palette-outline', title: 'Aparência', subtitle: getThemeText() },
        { id: 'categorias', icon: 'pricetag-outline', title: 'Categorias', subtitle: 'Personalize cores e nomes' },
        { id: 'seguranca', icon: 'shield-checkmark-outline', title: 'Segurança', subtitle: 'PIN, biometria, dados' },
        { id: 'backup', icon: 'cloud-download-outline', title: 'Backup', subtitle: 'Exportar e importar dados' },
      ],
    },
    {
      title: 'Sobre',
      items: [
        { id: 'sobre', icon: 'information-circle-outline', title: 'Sobre o app' },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Mais</Text>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.row, idx > 0 && styles.rowBorder]}
                  onPress={() => setModal(item.id)}
                  activeOpacity={0.6}
                >
                  <View style={styles.rowIconWrap}>
                    <Icon name={item.icon} size={20} color={item.iconColor ?? colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    {item.subtitle ? <Text style={styles.rowSubtitle}>{item.subtitle}</Text> : null}
                  </View>
                  <Icon name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.lockBtn} onPress={() => auth.lock()} activeOpacity={0.7}>
          <Icon name="lock-closed" size={16} color={colors.warning} />
          <Text style={styles.lockBtnText}>Bloquear agora</Text>
        </TouchableOpacity>
      </ScrollView>

      <HistoricoModal visible={modal === 'historico'} onClose={() => setModal(null)} />
      <PerfilModal visible={modal === 'perfil'} onClose={() => setModal(null)} />
      <RendaModal visible={modal === 'renda'} onClose={() => setModal(null)} />
      <AparenciaModal visible={modal === 'aparencia'} onClose={() => setModal(null)} />
      <CalculatorModal visible={modal === 'calc'} onClose={() => setModal(null)} />
      <CategoriasModal visible={modal === 'categorias'} onClose={() => setModal(null)} />
      <SegurancaModal
        visible={modal === 'seguranca'}
        onClose={() => setModal(null)}
        onChangePin={() => setModal('changePin')}
      />
      <ChangePinModal visible={modal === 'changePin'} onClose={() => setModal('seguranca')} />
      <BackupModal visible={modal === 'backup'} onClose={() => setModal(null)} />
      <SobreModal visible={modal === 'sobre'} onClose={() => setModal(null)} />
    </SafeAreaView>
  );
}

function PerfilModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');

  React.useEffect(() => {
    if (visible) {
      storage.getSettings().then((s) => {
        setNome(s.nomeCompleto ?? '');
        setCpf(s.cpf ?? '');
      });
    }
  }, [visible]);

  const formatCpf = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleCpfChange = (text: string) => setCpf(formatCpf(text));

  const handleSave = async () => {
    const s = await storage.getSettings();
    await storage.setSettings({ ...s, nomeCompleto: nome.trim(), cpf: cpf.trim() });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Cancelar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Perfil</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.cancel, { fontWeight: '700' }]}>Salvar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <View style={styles.infoCard}>
            <Icon name="document-text-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Para que serve?</Text>
              <Text style={styles.infoText}>
                Seu nome e CPF são usados para identificar se um comprovante PIX é uma receita ou despesa — comparando com pagador/recebedor do documento.
              </Text>
            </View>
          </View>

          <Text style={styles.label}>Nome completo</Text>
          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Ex: João da Silva"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="words"
            autoCorrect={false}
          />

          <Text style={styles.label}>CPF</Text>
          <TextInput
            value={cpf}
            onChangeText={handleCpfChange}
            placeholder="000.000.000-00"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            keyboardType="numeric"
          />

          <Text style={styles.help}>
            Esses dados ficam apenas no seu dispositivo e nunca são enviados a nenhum servidor.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function AparenciaModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, theme, icon, setTheme, setIcon, iconSupported } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Fechar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Aparência</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <Text style={styles.label}>Tema do Aplicativo</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.row} onPress={() => setTheme('auto')} activeOpacity={0.7}>
              <View style={styles.rowIconWrap}><Icon name="color-wand-outline" size={20} color={colors.primary} /></View>
              <Text style={styles.rowTitle}>Automático do Sistema</Text>
              {theme === 'auto' && <Icon name="checkmark" size={20} color={colors.primary} />}
            </TouchableOpacity>
            <View style={styles.rowBorder} />
            <TouchableOpacity style={styles.row} onPress={() => setTheme('dark')} activeOpacity={0.7}>
              <View style={styles.rowIconWrap}><Icon name="moon-outline" size={20} color={colors.primary} /></View>
              <Text style={styles.rowTitle}>Sempre Escuro</Text>
              {theme === 'dark' && <Icon name="checkmark" size={20} color={colors.primary} />}
            </TouchableOpacity>
            <View style={styles.rowBorder} />
            <TouchableOpacity style={styles.row} onPress={() => setTheme('light')} activeOpacity={0.7}>
              <View style={styles.rowIconWrap}><Icon name="sunny-outline" size={20} color={colors.primary} /></View>
              <Text style={styles.rowTitle}>Sempre Claro</Text>
              {theme === 'light' && <Icon name="checkmark" size={20} color={colors.primary} />}
            </TouchableOpacity>
          </View>

          {iconSupported && (
            <>
              <Text style={[styles.label, { marginTop: SPACING.xl }]}>Ícone do Aplicativo</Text>
              <View style={styles.sectionCard}>
                <TouchableOpacity style={styles.row} onPress={() => setIcon('auto')} activeOpacity={0.7}>
                  <View style={styles.rowIconWrap}><Icon name="color-wand-outline" size={20} color={colors.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>Automático</Text>
                    <Text style={styles.rowSubtitle}>Segue o tema do app</Text>
                  </View>
                  {icon === 'auto' && <Icon name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
                <View style={styles.rowBorder} />
                <TouchableOpacity style={styles.row} onPress={() => setIcon('default')} activeOpacity={0.7}>
                  <Image
                    source={require('../../assets/icon.png')}
                    style={{ width: 36, height: 36, borderRadius: 8 }}
                  />
                  <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                    <Text style={styles.rowTitle}>Escuro</Text>
                  </View>
                  {icon === 'default' && <Icon name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
                <View style={styles.rowBorder} />
                <TouchableOpacity style={styles.row} onPress={() => setIcon('light')} activeOpacity={0.7}>
                  <Image
                    source={require('../../assets/icons/icon-light.png')}
                    style={{ width: 36, height: 36, borderRadius: 8 }}
                  />
                  <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                    <Text style={styles.rowTitle}>Claro</Text>
                  </View>
                  {icon === 'light' && <Icon name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              </View>
            </>
          )}

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function RendaModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const { base, ajustes, setBase, setAjustes } = useMonthlyIncome();
  const [valorRaw, setValorRaw] = useState('');
  const [localAjustes, setLocalAjustes] = useState<SalarioAjuste[]>([]);
  const [addingTipo, setAddingTipo] = useState<'soma' | 'subtracao' | null>(null);
  const [newDesc, setNewDesc] = useState('');
  const [newValorRaw, setNewValorRaw] = useState('');
  const [newEhPct, setNewEhPct] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setValorRaw(base > 0 ? String(Math.round(base * 100)) : '');
      setLocalAjustes(ajustes);
      setAddingTipo(null);
      setNewDesc('');
      setNewValorRaw('');
      setNewEhPct(false);
    }
  }, [visible, base, ajustes]);

  const handle = async () => {
    const valor = parseCurrencyInput(valorRaw);
    await setBase(valor);
    await setAjustes(localAjustes);
    onClose();
  };

  const commitAdd = () => {
    if (!addingTipo) return;
    const valor = newEhPct
      ? (Number(newValorRaw.replace(',', '.')) || 0)
      : parseCurrencyInput(newValorRaw);
    if (valor <= 0) return;
    const nova: SalarioAjuste = {
      id: `ajuste-${Date.now()}`,
      descricao: newDesc.trim() || (addingTipo === 'soma' ? 'Bônus' : 'Desconto'),
      valor,
      tipo: addingTipo,
      ehPorcentagem: newEhPct,
    };
    setLocalAjustes((prev) => [...prev, nova]);
    setAddingTipo(null);
    setNewDesc('');
    setNewValorRaw('');
    setNewEhPct(false);
  };

  const removeAjuste = (id: string) => setLocalAjustes((prev) => prev.filter((a) => a.id !== id));

  const previewBase = parseCurrencyInput(valorRaw);
  const previewLiquida = calcRendaLiquida(previewBase, localAjustes);

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Cancelar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Renda mensal</Text>
          <TouchableOpacity onPress={handle}>
            <Text style={[styles.cancel, { fontWeight: '700' }]}>Salvar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Salário base</Text>
          <TextInput
            value={formatCurrencyInput(valorRaw)}
            onChangeText={setValorRaw}
            keyboardType="numeric"
            style={[styles.input, styles.inputBig]}
            autoFocus
          />

          <Text style={[styles.label, { marginTop: SPACING.xl }]}>Descontos e Bônus</Text>

          {localAjustes.map((a) => {
            const sign = a.tipo === 'soma' ? '+' : '−';
            const signColor = a.tipo === 'soma' ? colors.primary : colors.danger;
            const valDisplay = a.ehPorcentagem
              ? `${a.valor}%${previewBase > 0 ? ` (${fmtBRL((previewBase * a.valor) / 100)})` : ''}`
              : fmtBRL(a.valor);
            return (
              <View key={a.id} style={styles.ajusteRow}>
                <View style={[styles.ajusteSign, { backgroundColor: a.tipo === 'soma' ? colors.primarySoft : colors.dangerSoft }]}>
                  <Text style={[styles.ajusteSignText, { color: signColor }]}>{sign}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ajusteDesc}>{a.descricao}</Text>
                  <Text style={[styles.ajusteValor, { color: signColor }]}>{sign} {valDisplay}</Text>
                </View>
                <TouchableOpacity onPress={() => removeAjuste(a.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="trash-outline" size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
            );
          })}

          {addingTipo ? (
            <View style={styles.addForm}>
              <TextInput
                value={newDesc}
                onChangeText={setNewDesc}
                placeholder={addingTipo === 'soma' ? 'Ex: Bônus de vendas' : 'Ex: INSS'}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoFocus
              />
              <View style={[styles.segRow, { marginTop: SPACING.md }]}>
                <TouchableOpacity
                  style={[styles.segBtn, !newEhPct && styles.segBtnActive]}
                  onPress={() => setNewEhPct(false)} activeOpacity={0.7}
                >
                  <Text style={[styles.segText, !newEhPct && { color: colors.text }]}>R$ valor</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segBtn, newEhPct && styles.segBtnActive]}
                  onPress={() => setNewEhPct(true)} activeOpacity={0.7}
                >
                  <Text style={[styles.segText, newEhPct && { color: colors.text }]}>% porcentagem</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={newEhPct ? newValorRaw : formatCurrencyInput(newValorRaw)}
                onChangeText={setNewValorRaw}
                keyboardType="numeric"
                placeholder={newEhPct ? 'Ex: 7.5' : 'R$ 0,00'}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { marginTop: SPACING.md }]}
              />
              <View style={[styles.segRow, { marginTop: SPACING.md }]}>
                <TouchableOpacity
                  style={styles.segBtn}
                  onPress={() => setAddingTipo(null)} activeOpacity={0.7}
                >
                  <Text style={styles.segText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segBtn, styles.segBtnActive]}
                  onPress={commitAdd} activeOpacity={0.7}
                >
                  <Text style={[styles.segText, { color: colors.text }]}>Adicionar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.addAjusteBtns}>
              <TouchableOpacity
                style={[styles.addAjusteBtn, { borderColor: colors.danger }]}
                onPress={() => setAddingTipo('subtracao')} activeOpacity={0.7}
              >
                <Icon name="remove-circle-outline" size={15} color={colors.danger} />
                <Text style={[styles.addAjusteBtnText, { color: colors.danger }]}>Desconto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addAjusteBtn, { borderColor: colors.primary }]}
                onPress={() => setAddingTipo('soma')} activeOpacity={0.7}
              >
                <Icon name="add-circle-outline" size={15} color={colors.primary} />
                <Text style={[styles.addAjusteBtnText, { color: colors.primary }]}>Bônus</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>Renda líquida (entra na projeção)</Text>
            <Text style={styles.previewValue}>{fmtBRL(previewLiquida)}</Text>
            {localAjustes.length > 0 && (
              <Text style={styles.previewBreakdown}>
                Salário {fmtBRL(previewBase)} com {localAjustes.length} ajuste{localAjustes.length > 1 ? 's' : ''}
              </Text>
            )}
          </View>

          <Text style={styles.help}>
            Deixe o salário zerado se preferir registrar tudo apenas como lançamentos reais.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

type CalcMode = 'financeiro' | 'normal';

function CalculatorModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const calcStyles = React.useMemo(() => getCalcStyles(colors), [colors]);

  const [mode, setMode] = useState<CalcMode>('financeiro');
  const [history, setHistory] = useState<any[]>([]);

  React.useEffect(() => {
    if (!visible) return;
    storage.getRaw('calc_mode').then((v) => { if (v === 'financeiro' || v === 'normal') setMode(v); });
    storage.getRaw('calc_history').then((v) => { if (v) { try { setHistory(JSON.parse(v)); } catch {} } });
  }, [visible]);

  const switchMode = async (m: CalcMode) => {
    setMode(m);
    await storage.setRaw('calc_mode', m);
  };

  const addHistory = async (entry: any) => {
    const next = [entry, ...history].slice(0, 30);
    setHistory(next);
    await storage.setRaw('calc_history', JSON.stringify(next));
  };

  const clearHistory = async () => {
    setHistory([]);
    await storage.setRaw('calc_history', '[]');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Fechar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Calculadora</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={calcStyles.modeTabs}>
          <TouchableOpacity
            style={[calcStyles.modeTab, mode === 'financeiro' && calcStyles.modeTabActive]}
            onPress={() => switchMode('financeiro')} activeOpacity={0.7}
          >
            <Text style={[calcStyles.modeTabText, mode === 'financeiro' && calcStyles.modeTabTextActive]}>
              Financeira
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[calcStyles.modeTab, mode === 'normal' && calcStyles.modeTabActive]}
            onPress={() => switchMode('normal')} activeOpacity={0.7}
          >
            <Text style={[calcStyles.modeTabText, mode === 'normal' && calcStyles.modeTabTextActive]}>
              Normal
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'financeiro'
          ? <FinancialCalc colors={colors} styles={styles} calcStyles={calcStyles} history={history} addHistory={addHistory} clearHistory={clearHistory} />
          : <NormalCalc colors={colors} calcStyles={calcStyles} history={history} addHistory={addHistory} clearHistory={clearHistory} />
        }
      </SafeAreaView>
    </Modal>
  );
}

function FinancialCalc({ colors, styles, calcStyles, history, addHistory, clearHistory }: any) {
  const [valorRaw, setValorRaw] = useState('');
  const [taxa, setTaxa] = useState('1');
  const [meses, setMeses] = useState('12');
  const [showHistory, setShowHistory] = useState(false);

  React.useEffect(() => {
    storage.getRaw('calc_fin_session').then((v) => {
      if (v) {
        try {
          const s = JSON.parse(v);
          setValorRaw(s.valorRaw || '');
          setTaxa(s.taxa || '1');
          setMeses(s.meses || '12');
        } catch {}
      }
    });
  }, []);

  React.useEffect(() => {
    storage.setRaw('calc_fin_session', JSON.stringify({ valorRaw, taxa, meses }));
  }, [valorRaw, taxa, meses]);

  const principal = parseCurrencyInput(valorRaw);
  const i = parseFloat(taxa.replace(',', '.')) / 100 || 0;
  const n = parseInt(meses, 10) || 0;
  const simples = principal * (1 + i * n);
  const composto = principal * Math.pow(1 + i, n);

  const handleCalc = () => {
    if (principal <= 0 || n <= 0) return;
    const text = `${formatCurrency(principal)} · ${taxa}%/mês · ${n}m → Composto: ${formatCurrency(composto)} / Simples: ${formatCurrency(simples)}`;
    addHistory({ text, value: composto });
  };

  if (showHistory) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md }}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => setShowHistory(false)}>
            <Icon name="chevron-back" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Voltar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearHistory} style={{ paddingVertical: 4 }}>
            <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>Limpar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl }}>
          {history.length === 0
            ? <Text style={styles.help}>Nenhum cálculo no histórico.</Text>
            : history.map((h: any, i: number) => {
                const entryText = typeof h === 'string' ? h : h.text;
                const entryValue = typeof h === 'string' ? null : h.value;
                return (
                  <TouchableOpacity key={i} style={calcStyles.historyItem} onPress={() => {
                    if (entryValue !== null) {
                      setValorRaw(String(Math.round(entryValue * 100)));
                      setShowHistory(false);
                    }
                  }} activeOpacity={entryValue !== null ? 0.6 : 1}>
                    <Text style={calcStyles.historyText}>{entryText}</Text>
                  </TouchableOpacity>
                );
              })
          }
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.modalBody}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: SPACING.sm }}>
        <TouchableOpacity onPress={() => setShowHistory(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Histórico</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Valor inicial</Text>
      <TextInput
        value={formatCurrencyInput(valorRaw)} onChangeText={setValorRaw}
        keyboardType="numeric" style={[styles.input, styles.inputBig]}
      />
      <Text style={styles.label}>Taxa de juros (% ao mês)</Text>
      <TextInput value={taxa} onChangeText={setTaxa} keyboardType="numeric" style={styles.input} />
      <Text style={styles.label}>Tempo (meses)</Text>
      <TextInput value={meses} onChangeText={setMeses} keyboardType="numeric" style={styles.input} />

      <TouchableOpacity style={calcStyles.calcBtn} onPress={handleCalc} activeOpacity={0.8}>
        <Text style={calcStyles.calcBtnText}>Calcular e salvar no histórico</Text>
      </TouchableOpacity>

      <View style={styles.resultBlock}>
        <View style={styles.resultHeader}>
          <Icon name="trending-up-outline" size={18} color={colors.primary} />
          <Text style={styles.resultLabel}>Juros compostos</Text>
        </View>
        <Text style={[styles.resultValue, { color: colors.primary }]}>{formatCurrency(composto)}</Text>
        <Text style={styles.resultMeta}>+ {formatCurrency(composto - principal)} em juros</Text>
      </View>

      <View style={styles.resultBlock}>
        <View style={styles.resultHeader}>
          <Icon name="trending-up-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.resultLabel}>Juros simples</Text>
        </View>
        <Text style={styles.resultValue}>{formatCurrency(simples)}</Text>
        <Text style={styles.resultMeta}>+ {formatCurrency(simples - principal)} em juros</Text>
      </View>

      <Text style={styles.help}>Composto cresce sobre o saldo acumulado · simples cresce só sobre o valor inicial.</Text>
    </ScrollView>
  );
}

function NormalCalc({ colors, calcStyles, history, addHistory, clearHistory }: any) {
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [expression, setExpression] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  React.useEffect(() => {
    storage.getRaw('calc_normal_session').then((v) => {
      if (v) {
        try {
          const s = JSON.parse(v);
          setDisplay(s.display || '0');
          setPrevValue(s.prevValue !== undefined ? s.prevValue : null);
          setOperator(s.operator || null);
          setWaitingForOperand(!!s.waitingForOperand);
          setExpression(s.expression || '');
        } catch {}
      }
    });
  }, []);

  React.useEffect(() => {
    storage.setRaw('calc_normal_session', JSON.stringify({
      display, prevValue, operator, waitingForOperand, expression
    }));
  }, [display, prevValue, operator, waitingForOperand, expression]);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit === '.' ? '0.' : digit);
      setWaitingForOperand(false);
    } else {
      if (digit === '.' && display.includes('.')) return;
      setDisplay(display === '0' && digit !== '.' ? digit : display + digit);
    }
  };

  const inputOperator = (op: string) => {
    const current = parseFloat(display);
    if (prevValue !== null && !waitingForOperand) {
      const result = calculate(prevValue, current, operator!);
      setDisplay(String(parseFloat(result.toFixed(10))));
      setPrevValue(result);
      setExpression(`${parseFloat(result.toFixed(10))} ${op}`);
    } else {
      setPrevValue(current);
      setExpression(`${current} ${op}`);
    }
    setOperator(op);
    setWaitingForOperand(true);
  };

  const calculate = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+': return a + b;
      case '−': return a - b;
      case '×': return a * b;
      case '÷': return b !== 0 ? a / b : 0;
      default: return b;
    }
  };

  const handleEquals = () => {
    if (prevValue === null || operator === null) return;
    const current = parseFloat(display);
    const result = calculate(prevValue, current, operator);
    const rounded = parseFloat(result.toFixed(10));
    const text = `${expression} ${current} = ${rounded}`;
    addHistory({ text, value: rounded });
    setDisplay(String(rounded));
    setPrevValue(null);
    setOperator(null);
    setExpression('');
    setWaitingForOperand(true);
  };

  const handleClear = () => {
    setDisplay('0');
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(false);
    setExpression('');
  };

  const handleBackspace = () => {
    if (waitingForOperand) return;
    const next = display.length > 1 ? display.slice(0, -1) : '0';
    setDisplay(next);
  };

  const handleToggleSign = () => {
    setDisplay(String(parseFloat(display) * -1));
  };

  const handlePercent = () => {
    setDisplay(String(parseFloat(display) / 100));
  };

  const btnColor = (type: 'op' | 'eq' | 'fn' | 'num') => {
    switch (type) {
      case 'op': return colors.cardElevated;
      case 'eq': return colors.primary;
      case 'fn': return colors.cardElevated;
      default: return colors.card;
    }
  };

  const btnTextColor = (type: 'op' | 'eq' | 'fn' | 'num') => {
    if (type === 'eq') return '#0a0a0b';
    if (type === 'op') return colors.primary;
    return colors.text;
  };

  const Btn = ({ label, type, onPress, wide }: { label: string; type: 'op' | 'eq' | 'fn' | 'num'; onPress: () => void; wide?: boolean }) => (
    <TouchableOpacity
      style={[calcStyles.btn, { backgroundColor: btnColor(type) }, wide && calcStyles.btnWide]}
      onPress={onPress} activeOpacity={0.7}
    >
      <Text style={[calcStyles.btnText, { color: btnTextColor(type) }]}>{label}</Text>
    </TouchableOpacity>
  );

  if (showHistory) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md }}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => setShowHistory(false)}>
            <Icon name="chevron-back" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Voltar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearHistory} style={{ paddingVertical: 4 }}>
            <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>Limpar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl }}>
          {history.length === 0
            ? <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }}>Nenhum cálculo no histórico.</Text>
            : history.map((h: any, i: number) => {
                const entryText = typeof h === 'string' ? h : h.text;
                const entryValue = typeof h === 'string' ? null : h.value;
                return (
                  <TouchableOpacity key={i} style={calcStyles.historyItem} onPress={() => {
                    if (entryValue !== null) {
                      setDisplay(String(entryValue));
                      setWaitingForOperand(false);
                      setShowHistory(false);
                    }
                  }} activeOpacity={entryValue !== null ? 0.6 : 1}>
                    <Text style={calcStyles.historyText}>{entryText}</Text>
                  </TouchableOpacity>
                );
              })
          }
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={calcStyles.displayArea}>
        <TouchableOpacity onPress={() => setShowHistory(true)} style={calcStyles.historyBtn}>
          <Icon name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Histórico</Text>
        </TouchableOpacity>
        {expression ? <Text style={calcStyles.expression}>{expression}</Text> : null}
        <Text style={calcStyles.displayText} numberOfLines={1} adjustsFontSizeToFit>
          {display}
        </Text>
      </View>
      <View style={calcStyles.pad}>
        <View style={calcStyles.row}>
          <Btn label="C" type="fn" onPress={handleClear} />
          <Btn label="+/−" type="fn" onPress={handleToggleSign} />
          <Btn label="%" type="fn" onPress={handlePercent} />
          <Btn label="÷" type="op" onPress={() => inputOperator('÷')} />
        </View>
        <View style={calcStyles.row}>
          <Btn label="7" type="num" onPress={() => inputDigit('7')} />
          <Btn label="8" type="num" onPress={() => inputDigit('8')} />
          <Btn label="9" type="num" onPress={() => inputDigit('9')} />
          <Btn label="×" type="op" onPress={() => inputOperator('×')} />
        </View>
        <View style={calcStyles.row}>
          <Btn label="4" type="num" onPress={() => inputDigit('4')} />
          <Btn label="5" type="num" onPress={() => inputDigit('5')} />
          <Btn label="6" type="num" onPress={() => inputDigit('6')} />
          <Btn label="−" type="op" onPress={() => inputOperator('−')} />
        </View>
        <View style={calcStyles.row}>
          <Btn label="1" type="num" onPress={() => inputDigit('1')} />
          <Btn label="2" type="num" onPress={() => inputDigit('2')} />
          <Btn label="3" type="num" onPress={() => inputDigit('3')} />
          <Btn label="+" type="op" onPress={() => inputOperator('+')} />
        </View>
        <View style={calcStyles.row}>
          <Btn label="0" type="num" onPress={() => inputDigit('0')} wide />
          <Btn label="." type="num" onPress={() => inputDigit('.')} />
          <Btn label="⌫" type="fn" onPress={handleBackspace} />
          <Btn label="=" type="eq" onPress={handleEquals} />
        </View>
      </View>
    </View>
  );
}

function CategoriasModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const { items, save } = useCategories();
  const [edit, setEdit] = useState<Category | null>(null);
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(PALETTE[0]);

  const startNew = () => {
    setEdit({ id: generateId(), nome: '', cor: PALETTE[0] });
    setNome('');
    setCor(PALETTE[0]);
  };

  const startEdit = (c: Category) => {
    setEdit(c);
    setNome(c.nome);
    setCor(c.cor);
  };

  const handleSave = async () => {
    if (!edit || !nome.trim()) return;
    const exists = items.some((c) => c.id === edit.id);
    const updated: Category = { ...edit, nome: nome.trim(), cor };
    const next = exists ? items.map((c) => (c.id === edit.id ? updated : c)) : [...items, updated];
    await save(next);
    setEdit(null);
  };

  const handleDelete = async (c: Category) => {
    Alert.alert('Excluir categoria', `Remover "${c.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: async () => { await save(items.filter((x) => x.id !== c.id)); },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Fechar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Categorias</Text>
          <TouchableOpacity onPress={startNew}>
            <Icon name="add" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          {edit ? (
            <View style={styles.editBlock}>
              <Text style={styles.label}>Nome</Text>
              <TextInput value={nome} onChangeText={setNome} style={styles.input} autoFocus />
              <Text style={styles.label}>Cor</Text>
              <View style={styles.palette}>
                {PALETTE.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.swatch, { backgroundColor: p }, cor === p && styles.swatchActive]}
                    onPress={() => setCor(p)}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
                <TouchableOpacity style={[styles.actionBtn, styles.actionMuted]} onPress={() => setEdit(null)}>
                  <Text style={styles.actionText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={handleSave}>
                  <Text style={[styles.actionText, { color: '#0a0a0b' }]}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            items.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.catRow}
                onPress={() => startEdit(c)}
                onLongPress={() => handleDelete(c)}
                activeOpacity={0.6}
              >
                <CategoryDot color={c.cor} size={14} />
                <Text style={styles.catRowText}>{c.nome}</Text>
                <Icon name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
          {!edit && (
            <Text style={styles.help}>Toque para editar · pressione e segure para excluir.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SegurancaModal({
  visible, onClose, onChangePin,
}: { visible: boolean; onClose: () => void; onChangePin: () => void }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const auth = useAuth();
  const [bio, setBio] = useState(auth.biometricEnabled);

  React.useEffect(() => { setBio(auth.biometricEnabled); }, [auth.biometricEnabled, visible]);

  const toggleBio = async (val: boolean) => {
    if (val && !auth.biometricAvailable) {
      Alert.alert('Biometria indisponível', 'Cadastre uma biometria nas configurações do sistema.');
      return;
    }
    setBio(val);
    await auth.setBiometricEnabled(val);
  };

  const wipeAll = () => {
    Alert.alert(
      'Apagar todos os dados',
      'Remove transações, gastos fixos, parcelas, metas, categorias e PIN. Não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar', style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Tem certeza?',
              'Tudo será perdido permanentemente.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Apagar tudo', style: 'destructive',
                  onPress: async () => {
                    await Promise.all(
                      Object.values(STORAGE_KEYS).map((k) => storage.deleteRaw(k)),
                    );
                    await notifications.cancelAll();
                    Alert.alert('Pronto', 'Dados apagados. Reinicie o app.');
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Fechar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Segurança</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <View style={styles.infoCard}>
            <Icon name="shield-checkmark" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Como protegemos seus dados</Text>
              <Text style={styles.infoText}>
                PIN: hash SHA-256 + salt no Keychain do iOS · Auto-bloqueio em 5 min · Comprovantes em
                sandbox privado · 100% offline.
              </Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.row} onPress={onChangePin} activeOpacity={0.6}>
              <View style={styles.rowIconWrap}>
                <Icon name="keypad-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.rowTitle}>Alterar PIN</Text>
              <Icon name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowIconWrap}>
                <Icon name="finger-print-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{auth.biometricLabel}</Text>
                <Text style={styles.rowSubtitle}>
                  {auth.biometricAvailable ? 'Disponível' : 'Não cadastrada no dispositivo'}
                </Text>
              </View>
              <Switch
                value={bio} onValueChange={toggleBio} disabled={!auth.biometricAvailable}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.dangerBtn} onPress={wipeAll} activeOpacity={0.7}>
            <Icon name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.dangerBtnText}>Apagar todos os dados</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ChangePinModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const auth = useAuth();
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('current');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [reset, setReset] = useState(0);

  React.useEffect(() => {
    if (visible) {
      setStep('current');
      setNewPin('');
      setError('');
    }
  }, [visible]);

  const handle = async (pin: string) => {
    setError('');
    if (step === 'current') {
      const ok = await auth.unlockWithPin(pin);
      if (ok) { setStep('new'); setReset((r) => r + 1); }
      else { setError('PIN atual incorreto'); setReset((r) => r + 1); }
    } else if (step === 'new') {
      setNewPin(pin); setStep('confirm'); setReset((r) => r + 1);
    } else {
      if (pin !== newPin) {
        setError('PINs não coincidem'); setStep('new'); setNewPin(''); setReset((r) => r + 1);
      } else {
        await auth.changePin(pin, pin);
        Alert.alert('Sucesso', 'PIN alterado.');
        onClose();
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Cancelar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Alterar PIN</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={[styles.modalBody, { alignItems: 'center', justifyContent: 'center', flex: 1 }]}>
          <PinPad
            title={step === 'current' ? 'PIN atual' : step === 'new' ? 'Novo PIN' : 'Confirme o novo PIN'}
            errorMessage={error} resetSignal={reset} onComplete={handle}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function BackupModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const [status, setStatus] = useState<string>('');
  const [planilhaOpen, setPlanilhaOpen] = useState(false);

  const exportar = async () => {
    try {
      setStatus('Gerando backup...');
      const payload = await storage.exportAll();
      const json = JSON.stringify(payload, null, 2);
      const filename = `financas-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const path = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });

      const Sharing = await import('expo-sharing').catch(() => null);
      if (Sharing && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Salvar backup' });
        setStatus(`Backup salvo: ${filename}`);
      } else {
        setStatus(`Backup salvo localmente em ${path}`);
      }
    } catch (e: any) {
      setStatus(`Erro: ${e.message}`);
    }
  };

  const importar = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: 'application/json', copyToCacheDirectory: true,
      });
      if (r.canceled || !r.assets?.[0]) return;
      const content = await FileSystem.readAsStringAsync(r.assets[0].uri);
      const payload = JSON.parse(content);

      Alert.alert('Confirmar importação', 'Isso substituirá seus dados atuais. Continuar?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar', style: 'destructive',
          onPress: async () => {
            await storage.importAll(payload);
            Alert.alert('Pronto', 'Dados importados.');
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert('Erro', `Não foi possível importar: ${e.message}`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Fechar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Backup</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <View style={styles.infoCard}>
            <Icon name="cloud-download-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>O que é o backup?</Text>
              <Text style={styles.infoText}>
                Arquivo JSON com seus lançamentos, gastos fixos, parcelas, metas e categorias. Útil
                pra trocar de aparelho ou se reinstalar o app.
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Icon name="warning-outline" size={20} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Cuidados</Text>
              <Text style={styles.infoText}>
                O JSON contém todos seus dados em texto. Salve em local seguro (iCloud / Drive).
                Não envie por canais públicos.
              </Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary, { marginTop: SPACING.sm }]} onPress={exportar}>
            <Icon name="arrow-up-circle-outline" size={18} color="#0a0a0b" />
            <Text style={[styles.actionText, { color: '#0a0a0b', marginLeft: 6 }]}>Exportar backup</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.actionMuted, { marginTop: SPACING.sm }]} onPress={importar}>
            <Icon name="arrow-down-circle-outline" size={18} color={colors.text} />
            <Text style={[styles.actionText, { marginLeft: 6 }]}>Importar backup</Text>
          </TouchableOpacity>

          <View style={{ height: 1, backgroundColor: colors.borderSoft, marginVertical: SPACING.md }} />

          <TouchableOpacity style={[styles.actionBtn, styles.actionMuted]} onPress={() => setPlanilhaOpen(true)}>
            <Icon name="document-text-outline" size={18} color={colors.text} />
            <Text style={[styles.actionText, { marginLeft: 6 }]}>Importar planilha CSV</Text>
          </TouchableOpacity>

          {status ? <Text style={[styles.help, { marginTop: SPACING.lg }]}>{status}</Text> : null}
        </ScrollView>
      </SafeAreaView>

      <ImportPlanilhaModal visible={planilhaOpen} onClose={() => setPlanilhaOpen(false)} />
    </Modal>
  );
}

function SobreModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Fechar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Sobre</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <View style={styles.aboutLogo}>
            <Icon name="wallet" size={40} color={colors.primary} />
          </View>
          <Text style={styles.aboutName}>Flow Finance</Text>
          <Text style={styles.aboutVersion}>Versão 1.1.0</Text>
          <Text style={styles.aboutText}>
            App offline para controle financeiro pessoal. Seus dados nunca saem do dispositivo.
          </Text>
          <Text style={styles.aboutText}>
            React Native + Expo · PIN com SHA-256 + salt · Keychain/Keystore.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: SPACING.lg, paddingBottom: 80 },
  header: { marginBottom: SPACING.lg },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },

  section: { marginBottom: SPACING.lg },
  sectionTitle: {
    color: colors.textSecondary, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: SPACING.sm, marginLeft: SPACING.xs,
  },
  sectionCard: { backgroundColor: colors.card, borderRadius: RADIUS.md, overflow: 'hidden' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.md,
    gap: SPACING.md,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  rowIconWrap: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    backgroundColor: colors.cardElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '500', flex: 1 },
  rowSubtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },

  lockBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.warningSoft,
    paddingVertical: SPACING.md, borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  lockBtnText: { color: colors.warning, fontSize: 14, fontWeight: '600' },

  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  cancel: { color: colors.primary, fontSize: 15, fontWeight: '600', minWidth: 60 },
  modalBody: { padding: SPACING.lg, paddingBottom: 60 },
  label: {
    color: colors.textSecondary, fontSize: 12,
    marginTop: SPACING.lg, marginBottom: SPACING.sm,
    textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600',
  },
  input: {
    backgroundColor: colors.card, color: colors.text,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderRadius: RADIUS.md, fontSize: 15,
  },
  inputBig: { fontSize: 24, fontWeight: '700', paddingVertical: SPACING.lg },
  
  infoCard: {
    flexDirection: 'row', backgroundColor: colors.card,
    padding: SPACING.md, borderRadius: RADIUS.md,
    marginBottom: SPACING.md, gap: SPACING.md,
  },
  infoTitle: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  infoText: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },

  previewCard: {
    backgroundColor: colors.primarySoft, padding: SPACING.md,
    borderRadius: RADIUS.md, marginTop: SPACING.lg,
  },
  previewLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  previewValue: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },
  previewBreakdown: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },

  segRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  segBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.card, paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: 'transparent',
  },
  segBtnActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  segBtnActiveSum: { backgroundColor: colors.primary },
  segBtnActiveSub: { backgroundColor: colors.warning },
  segText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },

  resultBlock: {
    backgroundColor: colors.card, padding: SPACING.md, borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  resultLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  resultValue: { color: colors.text, fontSize: 24, fontWeight: '700' },
  resultMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },

  editBlock: { backgroundColor: colors.card, padding: SPACING.md, borderRadius: RADIUS.lg },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: SPACING.sm },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.text },
  catRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.sm, gap: SPACING.md,
  },
  catRowText: { color: colors.text, fontSize: 15, fontWeight: '500', flex: 1 },

  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.md, borderRadius: RADIUS.md,
  },
  actionPrimary: { backgroundColor: colors.primary },
  actionMuted: { backgroundColor: colors.cardElevated },
  actionText: { color: colors.text, fontSize: 15, fontWeight: '600' },

  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: SPACING.xl, paddingVertical: SPACING.md,
  },
  dangerBtnText: { color: colors.danger, fontSize: 14, fontWeight: '600' },

  help: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: SPACING.xl },

  ajusteRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: colors.card, padding: SPACING.md,
    borderRadius: RADIUS.md, marginBottom: SPACING.sm,
  },
  ajusteSign: {
    width: 32, height: 32, borderRadius: RADIUS.full,
    alignItems: 'center', justifyContent: 'center',
  },
  ajusteSignText: { fontSize: 18, fontWeight: '700' },
  ajusteDesc: { color: colors.text, fontSize: 14, fontWeight: '500' },
  ajusteValor: { fontSize: 12, marginTop: 2 },

  addAjusteBtns: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  addAjusteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
    borderWidth: 1, backgroundColor: 'transparent',
  },
  addAjusteBtnText: { fontSize: 14, fontWeight: '600' },
  addForm: {
    backgroundColor: colors.card, padding: SPACING.md,
    borderRadius: RADIUS.md, marginTop: SPACING.sm,
  },

  aboutLogo: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginTop: SPACING.xl, marginBottom: SPACING.md,
  },
  aboutName: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  aboutVersion: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: SPACING.xl },
  aboutText: { color: colors.text, fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
});

const getCalcStyles = (colors: any) => StyleSheet.create({
  modeTabs: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    padding: 3,
  },
  modeTab: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: RADIUS.sm,
  },
  modeTabActive: { backgroundColor: colors.cardElevated },
  modeTabText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  modeTabTextActive: { color: colors.text },

  calcBtn: {
    backgroundColor: colors.primary, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, alignItems: 'center', marginTop: SPACING.lg,
  },
  calcBtnText: { color: '#0a0a0b', fontSize: 14, fontWeight: '700' },

  historyBack: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    padding: SPACING.lg, paddingBottom: SPACING.sm,
  },
  historyItem: {
    backgroundColor: colors.card, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  historyText: { color: colors.text, fontSize: 13, lineHeight: 18 },

  displayArea: {
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
    alignItems: 'flex-end',
  },
  historyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.sm,
  },
  expression: {
    color: colors.textSecondary, fontSize: 16, marginBottom: 4,
  },
  displayText: {
    color: colors.text, fontSize: 52, fontWeight: '200', letterSpacing: -1,
  },

  pad: { flex: 1, padding: SPACING.sm },
  row: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  btn: {
    flex: 1, aspectRatio: 1, borderRadius: RADIUS.full,
    alignItems: 'center', justifyContent: 'center',
  },
  btnWide: { flex: 2, aspectRatio: undefined, paddingVertical: SPACING.md },
  btnText: { fontSize: 22, fontWeight: '400' },
});
