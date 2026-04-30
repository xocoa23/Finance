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
import { useTransactions, useCategories, useFixedExpenses, useGoals } from '../hooks/useStorage';
import { useHideValues } from '../hooks/useHideValues';
import { useMonthlyIncome } from '../hooks/useMonthlyIncome';
import { TransactionCard } from '../components/TransactionCard';
import { Icon } from '../components/Icon';
import { CategoryDot } from '../components/CategoryDot';
import { MoneyText } from '../components/MoneyText';
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
  const [hidden, toggleHidden] = useHideValues();
  const { rendaLiquida: rendaMensal } = useMonthlyIncome();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [periodKey, setPeriodKey] = useState(getCurrentMonthKey());
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleToggleEye = () => {
    Haptics.selectionAsync().catch(() => {});
    toggleHidden();
  };

  const isCurrent = periodKey === getCurrentMonthKey();

  const summary = useMemo(() => {
    const monthTx = transactions.filter((t) => t.data.startsWith(periodKey));
    const receitas = monthTx
      .filter((t) => t.tipo === 'receita')
      .reduce((s, t) => s + t.valor, 0);
    const despesas = monthTx
      .filter((t) => t.tipo === 'despesa')
      .reduce((s, t) => s + t.valor, 0);
    const fixosTotal = fixed.reduce((s, f) => s + f.valor, 0);
    const fixosPendentes = fixed
      .filter((f) => !f.pagoNoMes?.[periodKey])
      .reduce((s, f) => s + f.valor, 0);
    const aPagar = isCurrent ? fixosPendentes : 0;
    const aportesMensais = goals.reduce(
      (s, g) => s + (g.valorMensalFixo ?? 0),
      0,
    );
    const saldoProjetado = rendaMensal - fixosTotal - despesas - aportesMensais;
    return {
      receitas,
      despesas,
      saldo: receitas - despesas,
      aPagar,
      fixosTotal,
      aportesMensais,
      saldoProjetado,
    };
  }, [transactions, fixed, goals, periodKey, isCurrent, rendaMensal]);

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
            <View style={styles.projectionRow}>
              <Text style={styles.projectionItemLabel}>Renda mensal</Text>
              <MoneyText value={rendaMensal} style={styles.projectionItemValue} />
            </View>
            <View style={styles.projectionRow}>
              <Text style={styles.projectionItemLabel}>Gastos fixos</Text>
              <MoneyText
                value={summary.fixosTotal}
                prefix="− "
                style={[styles.projectionItemValue, { color: colors.danger }]}
              />
            </View>
            {summary.aportesMensais > 0 && (
              <View style={styles.projectionRow}>
                <Text style={styles.projectionItemLabel}>Aportes em metas</Text>
                <MoneyText
                  value={summary.aportesMensais}
                  prefix="− "
                  style={[styles.projectionItemValue, { color: colors.warning }]}
                />
              </View>
            )}
            <View style={styles.projectionRow}>
              <Text style={styles.projectionItemLabel}>Despesas do mês</Text>
              <MoneyText
                value={summary.despesas}
                prefix="− "
                style={[styles.projectionItemValue, { color: colors.danger }]}
              />
            </View>
            <View style={[styles.projectionRow, styles.projectionTotal]}>
              <Text style={styles.projectionTotalLabel}>Sobra prevista</Text>
              <MoneyText
                value={summary.saldoProjetado}
                style={[
                  styles.projectionTotalValue,
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

  const [anchor, setAnchor] = useState(currentKey);

  React.useEffect(() => {
    if (visible) setAnchor(currentKey);
  }, [visible, currentKey]);

  const months = useMemo(() => {
    const list: string[] = [];
    let k = anchor;
    for (let i = -6; i <= 6; i++) {
      list.push(shiftMonth(anchor, i));
    }
    return list;
  }, [anchor]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <TouchableOpacity onPress={() => setAnchor(shiftMonth(anchor, -12))}>
              <Icon name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.pickerTitle}>Selecione o período</Text>
            <TouchableOpacity onPress={() => setAnchor(shiftMonth(anchor, 12))}>
              <Icon name="chevron-forward" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 360 }}>
            {months.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.pickerRow, currentKey === m && styles.pickerRowActive]}
                onPress={() => onSelect(m)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerText, currentKey === m && { color: colors.primary }]}>
                  {formatPeriod(m)}
                </Text>
                {currentKey === m && <Icon name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.pickerToday}
            onPress={() => onSelect(getCurrentMonthKey())}
            activeOpacity={0.7}
          >
            <Text style={styles.pickerTodayText}>Hoje</Text>
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
    marginBottom: SPACING.sm,
  },
  pickerTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
  },
  pickerRowActive: { backgroundColor: colors.primarySoft },
  pickerText: { color: colors.text, fontSize: 15 },
  pickerToday: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    backgroundColor: colors.cardElevated,
    borderRadius: RADIUS.md,
  },
  pickerTodayText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
