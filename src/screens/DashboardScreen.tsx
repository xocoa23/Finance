import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTransactions, useCategories, useFixedExpenses, useGoals, useExpectedExpenses, useInstallments } from '../hooks/useStorage';
import { useHideValues } from '../hooks/useHideValues';
import { useMonthlyIncome } from '../hooks/useMonthlyIncome';
import { TransactionCard } from '../components/TransactionCard';
import { Icon } from '../components/Icon';
import { CategoryDot } from '../components/CategoryDot';
import { MoneyText } from '../components/MoneyText';
import { QuickUploadModal } from '../components/QuickUploadModal';
import { HistoricoModal } from './HistoricoModal';
import { RADIUS, SPACING } from '../types';
import { useTheme } from '../hooks/useTheme';
import { getCurrentMonthKey, getGreeting } from '../utils/formatters';

function formatPeriod(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const s = format(d, "MMMM 'de' yyyy", { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function DashboardScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const { items: transactions } = useTransactions();
  const { items: categories } = useCategories();
  const { items: fixed } = useFixedExpenses();
  const { items: goals } = useGoals();
  const { items: esperados } = useExpectedExpenses();
  const { items: installments } = useInstallments();
  const [hidden, toggleHidden] = useHideValues();
  const { rendaLiquida: rendaMensal } = useMonthlyIncome();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [periodKey, setPeriodKey] = useState(getCurrentMonthKey());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quickUploadUri, setQuickUploadUri] = useState('');
  const [quickUploadOpen, setQuickUploadOpen] = useState(false);

  const handleToggleEye = () => {
    Haptics.selectionAsync().catch(() => {});
    toggleHidden();
  };

  const handleQuickUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setQuickUploadUri(result.assets[0].uri);
      setQuickUploadOpen(true);
    }
  };

  const isCurrent = periodKey === getCurrentMonthKey();

  const summary = useMemo(() => {
    const monthTx = transactions.filter((t) => t.data.startsWith(periodKey));
    const receitas = monthTx.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
    // despesas = realidade: tudo que foi efetivamente gasto este mês (inclui fixos/esperados/metas pagos)
    const despesas = monthTx.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);

    // ── Gastos fixos ──────────────────────────────────────────────
    const fixosList = [...fixed]
      .map((f) => ({ id: f.id, descricao: f.descricao, valor: f.valor, pago: !!f.pagoNoMes?.[periodKey] }))
      .sort((a, b) => Number(a.pago) - Number(b.pago));
    const fixosPendentesTotal = fixosList.filter((f) => !f.pago).reduce((s, f) => s + f.valor, 0);
    const fixosPagosTotal = fixosList.filter((f) => f.pago).reduce((s, f) => s + f.valor, 0);

    // ── Gastos esperados (mês atual apenas) ───────────────────────
    const esperadosList = isCurrent
      ? [...esperados]
          .map((e) => ({ id: e.id, descricao: e.descricao, valor: e.valor, pago: !!e.pagoNoMes?.[periodKey] }))
          .sort((a, b) => Number(a.pago) - Number(b.pago))
      : [];
    const esperadosPendentesTotal = esperadosList.filter((e) => !e.pago).reduce((s, e) => s + e.valor, 0);
    const esperadosPagosTotal = esperadosList.filter((e) => e.pago).reduce((s, e) => s + e.valor, 0);

    // ── Aportes mensais em metas (mês atual apenas) ───────────────
    const goalsList = isCurrent
      ? goals
          .filter((g) => (g.valorMensalFixo ?? 0) > 0)
          .map((g) => ({
            id: g.id,
            nome: g.nome,
            valor: g.valorMensalFixo!,
            pago: (g.aportes ?? []).some((a) => a.data.startsWith(periodKey) && a.tipo !== 'rendimento'),
          }))
          .sort((a, b) => Number(a.pago) - Number(b.pago))
      : [];
    const aportesPendentesTotal = goalsList.filter((g) => !g.pago).reduce((s, g) => s + g.valor, 0);
    const aportesPagosTotal = goalsList.filter((g) => g.pago).reduce((s, g) => s + g.valor, 0);

    // ── Parcelas avulsas (sem vínculo com gasto fixo) ─────────────
    const parcelaAtivas = installments.filter(
      (i) => i.parcelasPagas < i.numeroParcelas && !i.linkedFixedExpenseId,
    );
    const parcelasPagasItems = parcelaAtivas.filter(
      (i) => (i.pagamentos ?? []).some((p) => p.paidAt.startsWith(periodKey)),
    );
    const parcelasPendentesItems = parcelaAtivas.filter(
      (i) => !(i.pagamentos ?? []).some((p) => p.paidAt.startsWith(periodKey)),
    );
    const parcelasPagasTotal = parcelasPagasItems.reduce((s, i) => s + i.valorParcela, 0);
    const parcelasPendentesTotal = parcelasPendentesItems.reduce((s, i) => s + i.valorParcela, 0);

    // ── Outros gastos livres (despesas sem categoria rastreada) ───
    // = despesas reais - tudo que é rastreado (fixos/esperados/aportes/parcelas pagos)
    const despesasVariaveis = Math.max(
      0,
      despesas - fixosPagosTotal - esperadosPagosTotal - aportesPagosTotal - parcelasPagasTotal,
    );

    // ── Fórmula correta: renda - real - pendente ──────────────────
    // "real" (despesas) já inclui tudo pago via transação — sem dupla contagem
    // "pendente" são obrigações ainda não quitadas que reduzirão o saldo futuro
    const saldoProjetado = isCurrent
      ? rendaMensal - despesas - fixosPendentesTotal - esperadosPendentesTotal - aportesPendentesTotal - parcelasPendentesTotal
      : receitas - despesas;

    const aPagar = isCurrent
      ? fixosPendentesTotal + esperadosPendentesTotal + aportesPendentesTotal + parcelasPendentesTotal
      : 0;

    return {
      receitas,
      despesas,
      saldo: receitas - despesas,
      fixosList,
      fixosPendentesTotal,
      fixosPagosTotal,
      esperadosList,
      esperadosPendentesTotal,
      esperadosPagosTotal,
      goalsList,
      aportesPendentesTotal,
      aportesPagosTotal,
      parcelasPagasItems,
      parcelasPendentesItems,
      parcelasPagasTotal,
      parcelasPendentesTotal,
      despesasVariaveis,
      aPagar,
      saldoProjetado,
    };
  }, [transactions, fixed, goals, esperados, installments, periodKey, isCurrent, rendaMensal]);

  const lastFive = useMemo(() => {
    return transactions.filter((t) => t.data.startsWith(periodKey)).slice(0, 5);
  }, [transactions, periodKey]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    transactions
      .filter((t) => t.tipo === 'despesa' && t.data.startsWith(periodKey))
      .forEach((t) => {
        map.set(t.categoriaId, (map.get(t.categoriaId) ?? 0) + t.valor);
      });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    if (total === 0) return [];
    return Array.from(map.entries())
      .map(([catId, valor]) => {
        const cat = categories.find((c) => c.id === catId);
        return {
          id: catId,
          nome: cat?.nome ?? 'Outros',
          cor: cat?.cor ?? colors.textMuted,
          valor,
          pct: valor / total,
        };
      })
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);
  }, [transactions, categories, periodKey]);

  const findCategory = (id: string) => categories.find((c) => c.id === id);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <TouchableOpacity
              style={styles.periodPill}
              onPress={() => setPickerOpen(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.periodText}>{formatPeriod(periodKey)}</Text>
              <Icon name="chevron-down" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleQuickUpload}
            activeOpacity={0.7}
          >
            <Icon name="attach-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { marginLeft: SPACING.sm }]}
            onPress={handleToggleEye}
            activeOpacity={0.7}
          >
            <Icon
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={hidden ? colors.warning : colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { marginLeft: SPACING.sm }]}
            onPress={() => setHistoryOpen(true)}
            activeOpacity={0.7}
          >
            <Icon name="bar-chart-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo</Text>
          <MoneyText
            value={summary.saldo}
            style={[
              styles.balanceValue,
              { color: summary.saldo >= 0 ? colors.primary : colors.danger },
            ]}
          />
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <View style={[styles.miniDot, { backgroundColor: colors.primary }]} />
              <View>
                <Text style={styles.balanceItemLabel}>Receitas</Text>
                <MoneyText value={summary.receitas} style={styles.balanceItemValue} />
              </View>
            </View>
            <View style={styles.balanceItem}>
              <View style={[styles.miniDot, { backgroundColor: colors.danger }]} />
              <View>
                <Text style={styles.balanceItemLabel}>Despesas</Text>
                <MoneyText value={summary.despesas} style={styles.balanceItemValue} />
              </View>
            </View>
          </View>
        </View>

        {isCurrent && rendaMensal > 0 && (
          <View style={styles.projectionCard}>
            <View style={styles.projectionHeader}>
              <Icon name="trending-up-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.projectionLabel}>Projeção do mês</Text>
            </View>

            {/* Renda mensal */}
            <View style={styles.projectionRow}>
              <Text style={styles.projectionItemLabel}>Renda mensal</Text>
              <MoneyText value={rendaMensal} style={styles.projectionItemValue} />
            </View>

            {/* ── Despesas do mês (destaque) ─────────────────────── */}
            <View style={[styles.projectionRow, styles.projectionHighlightRow]}>
              <Text style={styles.projectionHighlightLabel}>Despesas do mês</Text>
              <MoneyText
                value={summary.despesas}
                prefix={summary.despesas > 0 ? '− ' : ''}
                style={[styles.projectionHighlightValue, { color: summary.despesas > 0 ? colors.danger : colors.textMuted }]}
              />
            </View>

            {/* Sub-linhas: itens rastreados já pagos */}
            {summary.fixosList.filter((f) => f.pago).map((f) => (
              <View key={f.id} style={styles.projectionSubItem}>
                <View style={styles.projectionSubItemLeft}>
                  <View style={styles.pagoBadge}><Text style={styles.pagoBadgeText}>PAGO</Text></View>
                  <Text style={[styles.projectionSubLabel, styles.projectionSubLabelPago]}>{f.descricao}</Text>
                </View>
                <MoneyText value={f.valor} style={[styles.projectionSubValor, styles.projectionSubLabelPago]} />
              </View>
            ))}
            {summary.esperadosList.filter((e) => e.pago).map((e) => (
              <View key={e.id} style={styles.projectionSubItem}>
                <View style={styles.projectionSubItemLeft}>
                  <View style={styles.pagoBadge}><Text style={styles.pagoBadgeText}>PAGO</Text></View>
                  <Text style={[styles.projectionSubLabel, styles.projectionSubLabelPago]}>{e.descricao}</Text>
                </View>
                <MoneyText value={e.valor} style={[styles.projectionSubValor, styles.projectionSubLabelPago]} />
              </View>
            ))}
            {summary.goalsList.filter((g) => g.pago).map((g) => (
              <View key={g.id} style={styles.projectionSubItem}>
                <View style={styles.projectionSubItemLeft}>
                  <View style={styles.pagoBadge}><Text style={styles.pagoBadgeText}>PAGO</Text></View>
                  <Text style={[styles.projectionSubLabel, styles.projectionSubLabelPago]}>Meta: {g.nome}</Text>
                </View>
                <MoneyText value={g.valor} style={[styles.projectionSubValor, styles.projectionSubLabelPago]} />
              </View>
            ))}
            {summary.parcelasPagasItems.map((i) => (
              <View key={i.id} style={styles.projectionSubItem}>
                <View style={styles.projectionSubItemLeft}>
                  <View style={styles.pagoBadge}><Text style={styles.pagoBadgeText}>PAGO</Text></View>
                  <Text style={[styles.projectionSubLabel, styles.projectionSubLabelPago]}>{i.descricao}</Text>
                </View>
                <MoneyText value={i.valorParcela} style={[styles.projectionSubValor, styles.projectionSubLabelPago]} />
              </View>
            ))}
            {summary.despesasVariaveis > 0 && (
              <View style={styles.projectionSubItem}>
                <View style={styles.projectionSubItemLeft}>
                  <View style={styles.pendenteBadge}><Text style={styles.pendenteBadgeText}>·</Text></View>
                  <Text style={styles.projectionSubLabel}>Outros gastos</Text>
                </View>
                <MoneyText value={summary.despesasVariaveis} style={styles.projectionSubValor} />
              </View>
            )}

            {/* ── Seção "A pagar" ────────────────────────────────── */}
            {(summary.fixosPendentesTotal > 0 || summary.esperadosPendentesTotal > 0 ||
              summary.aportesPendentesTotal > 0 || summary.parcelasPendentesTotal > 0) && (
              <>
                <View style={styles.projectionSectionDivider}>
                  <Text style={styles.projectionSectionLabel}>A pagar</Text>
                </View>
                {summary.fixosList.filter((f) => !f.pago).map((f) => (
                  <View key={f.id} style={styles.projectionSubItem}>
                    <View style={styles.projectionSubItemLeft}>
                      <View style={styles.pendenteBadge}><Text style={styles.pendenteBadgeText}>·</Text></View>
                      <Text style={styles.projectionSubLabel}>{f.descricao}</Text>
                    </View>
                    <MoneyText value={f.valor} prefix="− " style={[styles.projectionSubValor, { color: colors.danger }]} />
                  </View>
                ))}
                {summary.esperadosList.filter((e) => !e.pago).map((e) => (
                  <View key={e.id} style={styles.projectionSubItem}>
                    <View style={styles.projectionSubItemLeft}>
                      <View style={styles.pendenteBadge}><Text style={styles.pendenteBadgeText}>·</Text></View>
                      <Text style={styles.projectionSubLabel}>{e.descricao}</Text>
                    </View>
                    <MoneyText value={e.valor} prefix="− " style={[styles.projectionSubValor, { color: colors.danger }]} />
                  </View>
                ))}
                {summary.goalsList.filter((g) => !g.pago).map((g) => (
                  <View key={g.id} style={styles.projectionSubItem}>
                    <View style={styles.projectionSubItemLeft}>
                      <View style={styles.pendenteBadge}><Text style={styles.pendenteBadgeText}>·</Text></View>
                      <Text style={styles.projectionSubLabel}>Meta: {g.nome}</Text>
                    </View>
                    <MoneyText value={g.valor} prefix="− " style={[styles.projectionSubValor, { color: colors.warning }]} />
                  </View>
                ))}
                {summary.parcelasPendentesItems.map((i) => (
                  <View key={i.id} style={styles.projectionSubItem}>
                    <View style={styles.projectionSubItemLeft}>
                      <View style={styles.pendenteBadge}><Text style={styles.pendenteBadgeText}>·</Text></View>
                      <Text style={styles.projectionSubLabel}>{i.descricao}</Text>
                    </View>
                    <MoneyText value={i.valorParcela} prefix="− " style={[styles.projectionSubValor, { color: colors.danger }]} />
                  </View>
                ))}
              </>
            )}

            {/* ── Sobra prevista (destaque) ──────────────────────── */}
            <View style={[styles.projectionRow, styles.projectionTotal, styles.projectionHighlightRow]}>
              <Text style={styles.projectionHighlightLabel}>Sobra prevista</Text>
              <MoneyText
                value={summary.saldoProjetado}
                style={[
                  styles.projectionHighlightValue,
                  { color: summary.saldoProjetado >= 0 ? colors.primary : colors.danger },
                ]}
              />
            </View>
          </View>
        )}

        {isCurrent && summary.aPagar > 0 && (
          <View style={styles.alertCard}>
            <View style={styles.alertIcon}>
              <Icon name="alert-circle" size={20} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>Contas a pagar</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MoneyText value={summary.aPagar} style={styles.alertText} />
                <Text style={styles.alertText}> pendentes este mês</Text>
              </View>
            </View>
          </View>
        )}

        {categoryBreakdown.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Por categoria</Text>
            <View style={styles.catCard}>
              {categoryBreakdown.map((c, i) => (
                <View key={c.id} style={[styles.catRow, i > 0 && styles.catRowBorder]}>
                  <CategoryDot color={c.cor} size={10} />
                  <Text style={styles.catName}>{c.nome}</Text>
                  <View style={styles.catBarTrack}>
                    <View
                      style={[styles.catBarFill, { width: `${c.pct * 100}%`, backgroundColor: c.cor }]}
                    />
                  </View>
                  <MoneyText value={c.valor} style={styles.catValue} />
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Últimos lançamentos</Text>
          {lastFive.length === 0 ? (
            <View style={styles.emptyCard}>
              <Icon name="document-text-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>Nenhum lançamento neste mês</Text>
            </View>
          ) : (
            lastFive.map((t) => (
              <TransactionCard key={t.id} transaction={t} category={findCategory(t.categoriaId)} />
            ))
          )}
        </View>
      </ScrollView>

      <HistoricoModal visible={historyOpen} onClose={() => setHistoryOpen(false)} />
      <QuickUploadModal
        visible={quickUploadOpen}
        comprovanteUri={quickUploadUri}
        onClose={() => setQuickUploadOpen(false)}
      />
      <PeriodPickerModal
        visible={pickerOpen}
        currentKey={periodKey}
        onClose={() => setPickerOpen(false)}
        onSelect={(k) => {
          setPeriodKey(k);
          setPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

interface PickerProps {
  visible: boolean;
  currentKey: string;
  onClose: () => void;
  onSelect: (k: string) => void;
}

function PeriodPickerModal({ visible, currentKey, onClose, onSelect }: PickerProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const currentYearNum = parseInt(currentKey.split('-')[0], 10) || new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYearNum);

  React.useEffect(() => {
    if (visible) {
      setSelectedYear(parseInt(currentKey.split('-')[0], 10) || new Date().getFullYear());
    }
  }, [visible, currentKey]);

  const handleYearChange = (delta: number) => {
    const next = selectedYear + delta;
    if (next >= 2016 && next <= 2036) {
      setSelectedYear(next);
    }
  };

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity onPress={() => handleYearChange(-1)}>
              <Icon name="chevron-back" size={22} color={selectedYear > 2016 ? colors.text : colors.textMuted} />
            </TouchableOpacity>
            <Text style={styles.pickerTitle}>{selectedYear}</Text>
            <TouchableOpacity onPress={() => handleYearChange(1)}>
              <Icon name="chevron-forward" size={22} color={selectedYear < 2036 ? colors.text : colors.textMuted} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.pickerGrid}>
            {monthNames.map((m, idx) => {
              const monthStr = String(idx + 1).padStart(2, '0');
              const key = `${selectedYear}-${monthStr}`;
              const isActive = key === currentKey;
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.pickerCell, isActive && styles.pickerCellActive]}
                  onPress={() => onSelect(key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerCellText, isActive && styles.pickerCellTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.pickerToday}
            onPress={() => onSelect(getCurrentMonthKey())}
            activeOpacity={0.7}
          >
            <Text style={styles.pickerTodayText}>Voltar para o Mês Atual</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: SPACING.lg, paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  greeting: { color: colors.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  periodText: { color: colors.textSecondary, fontSize: 14 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  balanceCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  balanceLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  balanceValue: { fontSize: 36, fontWeight: '800', marginTop: 4, letterSpacing: -1 },
  balanceRow: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: SPACING.lg,
  },
  balanceItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  balanceItemLabel: { color: colors.textMuted, fontSize: 11, marginBottom: 2 },
  balanceItemValue: { color: colors.text, fontSize: 14, fontWeight: '600' },

  projectionCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  projectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  projectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  projectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  projectionItemLabel: { color: colors.textSecondary, fontSize: 13 },
  projectionItemValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  projectionSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    paddingLeft: SPACING.md,
  },
  projectionSubItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingLeft: SPACING.sm,
  },
  projectionSubItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  projectionSubLabel: { color: colors.textSecondary, fontSize: 12 },
  projectionSubLabelPago: { color: colors.textMuted },
  projectionSubValor: { color: colors.textSecondary, fontSize: 12, fontWeight: '500' },
  projectionSubNote: { color: colors.textMuted, fontSize: 11, fontStyle: 'italic' },
  pagoBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pagoBadgeText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pendenteBadge: {
    width: 16,
    alignItems: 'center',
  },
  pendenteBadgeText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 16,
  },
  projectionHighlightRow: {
    marginTop: 2,
  },
  projectionHighlightLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  projectionHighlightValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  projectionSectionDivider: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  projectionSectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  projectionTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
  },
  projectionTotalLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  projectionTotalValue: { fontSize: 18, fontWeight: '800' },

  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  alertText: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },

  section: { marginTop: SPACING.lg },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  catCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  catRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  catName: { color: colors.text, fontSize: 13, fontWeight: '500', minWidth: 80 },
  catBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.borderSoft,
    borderRadius: 3,
    marginHorizontal: SPACING.sm,
    overflow: 'hidden',
  },
  catBarFill: { height: 6, borderRadius: 3 },
  catValue: { color: colors.text, fontSize: 13, fontWeight: '600', minWidth: 80, textAlign: 'right' },

  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyText: { color: colors.textMuted, fontSize: 13 },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  pickerCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    width: '100%',
    maxWidth: 360,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  pickerTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    justifyContent: 'space-between',
    marginVertical: SPACING.md,
  },
  pickerCell: {
    width: '31%',
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: colors.cardElevated,
  },
  pickerCellActive: {
    backgroundColor: colors.primary,
  },
  pickerCellText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  pickerCellTextActive: {
    color: '#0a0a0b',
    fontWeight: '700',
  },
  pickerToday: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    backgroundColor: colors.cardElevated,
    borderRadius: RADIUS.md,
  },
  pickerTodayText: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
