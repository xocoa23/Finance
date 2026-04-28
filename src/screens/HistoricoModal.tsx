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
import { LineChart } from 'react-native-chart-kit';
import { useTransactions, useCategories } from '../hooks/useStorage';
import { MoneyText } from '../components/MoneyText';
import { COLORS, Transaction } from '../types';
import {
  formatPercentDelta,
  formatPeriodLabel,
  getPeriodKey,
  PeriodGranularity,
} from '../utils/formatters';

const screenWidth = Dimensions.get('window').width;

interface HistoricoModalProps {
  visible: boolean;
  onClose: () => void;
}

const GRANULARITIES: Array<{ key: PeriodGranularity; label: string; window: number }> = [
  { key: 'week', label: 'Semanas', window: 8 },
  { key: 'month', label: 'Meses', window: 12 },
  { key: 'quarter', label: 'Trimestres', window: 6 },
  { key: 'year', label: 'Anos', window: 5 },
];

interface PeriodAgg {
  key: string;
  receitas: number;
  despesas: number;
  saldo: number;
  byCategoria: Map<string, number>;
}

function aggregate(transactions: Transaction[], gran: PeriodGranularity): PeriodAgg[] {
  const map = new Map<string, PeriodAgg>();
  for (const t of transactions) {
    const k = getPeriodKey(t.data, gran);
    if (!map.has(k)) {
      map.set(k, { key: k, receitas: 0, despesas: 0, saldo: 0, byCategoria: new Map() });
    }
    const agg = map.get(k)!;
    if (t.tipo === 'receita') agg.receitas += t.valor;
    else agg.despesas += t.valor;
    agg.saldo = agg.receitas - agg.despesas;
    if (t.tipo === 'despesa') {
      agg.byCategoria.set(t.categoriaId, (agg.byCategoria.get(t.categoriaId) ?? 0) + t.valor);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export function HistoricoModal({ visible, onClose }: HistoricoModalProps) {
  const { items: transactions } = useTransactions();
  const { items: categories } = useCategories();
  const [gran, setGran] = useState<PeriodGranularity>('month');

  const config = GRANULARITIES.find((g) => g.key === gran)!;

  const periods = useMemo(() => {
    const all = aggregate(transactions, gran);
    return all.slice(-config.window);
  }, [transactions, gran, config.window]);

  const current = periods[periods.length - 1];
  const previous = periods[periods.length - 2];

  const chartData = {
    labels: periods.map((p) => formatPeriodLabel(p.key, gran).slice(0, 6)),
    datasets: [
      {
        data: periods.length > 0 ? periods.map((p) => p.receitas) : [0],
        color: () => COLORS.primary,
        strokeWidth: 2,
      },
      {
        data: periods.length > 0 ? periods.map((p) => p.despesas) : [0],
        color: () => COLORS.danger,
        strokeWidth: 2,
      },
    ],
    legend: ['Receitas', 'Despesas'],
  };

  const topCategoriasAtual = useMemo(() => {
    if (!current) return [];
    return Array.from(current.byCategoria.entries())
      .map(([catId, total]) => {
        const cat = categories.find((c) => c.id === catId);
        const totalAnterior = previous?.byCategoria.get(catId) ?? 0;
        return {
          id: catId,
          nome: cat?.nome ?? 'Outros',
          cor: cat?.cor ?? COLORS.textMuted,
          total,
          delta: formatPercentDelta(total, totalAnterior),
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [current, previous, categories]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Fechar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Histórico & Comparativos</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.tabs}>
          {GRANULARITIES.map((g) => (
            <TouchableOpacity
              key={g.key}
              style={[styles.tab, gran === g.key && styles.tabActive]}
              onPress={() => setGran(g.key)}
            >
              <Text style={[styles.tabText, gran === g.key && styles.tabTextActive]}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {periods.length === 0 ? (
            <Text style={styles.empty}>Sem dados suficientes para esse período.</Text>
          ) : (
            <>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>
                  Período atual · {current ? formatPeriodLabel(current.key, gran) : '—'}
                </Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCol}>
                    <Text style={styles.metricLabel}>Receitas</Text>
                    <MoneyText
                      value={current?.receitas ?? 0}
                      style={[styles.metricValue, { color: COLORS.primary }]}
                    />
                    {previous && (
                      <Text style={styles.delta}>
                        {formatPercentDelta(current?.receitas ?? 0, previous.receitas)} vs anterior
                      </Text>
                    )}
                  </View>
                  <View style={styles.summaryCol}>
                    <Text style={styles.metricLabel}>Despesas</Text>
                    <MoneyText
                      value={current?.despesas ?? 0}
                      style={[styles.metricValue, { color: COLORS.danger }]}
                    />
                    {previous && (
                      <Text style={styles.delta}>
                        {formatPercentDelta(current?.despesas ?? 0, previous.despesas)} vs anterior
                      </Text>
                    )}
                  </View>
                </View>
                <View style={[styles.summaryCol, { marginTop: 12 }]}>
                  <Text style={styles.metricLabel}>Saldo</Text>
                  <MoneyText
                    value={current?.saldo ?? 0}
                    style={[
                      styles.saldoValue,
                      { color: (current?.saldo ?? 0) >= 0 ? COLORS.primary : COLORS.danger },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.chartCard}>
                <Text style={styles.sectionTitle}>Evolução</Text>
                <LineChart
                  data={chartData}
                  width={screenWidth - 32}
                  height={220}
                  yAxisLabel="R$"
                  chartConfig={{
                    backgroundColor: COLORS.card,
                    backgroundGradientFrom: COLORS.card,
                    backgroundGradientTo: COLORS.card,
                    decimalPlaces: 0,
                    color: (op = 1) => `rgba(0, 212, 170, ${op})`,
                    labelColor: () => COLORS.textSecondary,
                    propsForBackgroundLines: { stroke: COLORS.border },
                    propsForDots: { r: '4' },
                  }}
                  bezier
                  style={{ borderRadius: 12, marginTop: 8 }}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top categorias (atual)</Text>
                {topCategoriasAtual.length === 0 ? (
                  <Text style={styles.empty}>Sem despesas no período.</Text>
                ) : (
                  topCategoriasAtual.map((c) => (
                    <View key={c.id} style={styles.catRow}>
                      <View style={[styles.catDot, { backgroundColor: c.cor }]} />
                      <Text style={styles.catName}>{c.nome}</Text>
                      <View style={{ flex: 1 }} />
                      <MoneyText value={c.total} style={styles.catValor} />
                      <Text style={styles.catDelta}>{c.delta}</Text>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Histórico completo</Text>
                {[...periods].reverse().map((p) => (
                  <View key={p.key} style={styles.histRow}>
                    <Text style={styles.histLabel}>{formatPeriodLabel(p.key, gran)}</Text>
                    <View style={styles.histVals}>
                      <MoneyText
                        value={p.receitas}
                        prefix="+"
                        style={[styles.histValor, { color: COLORS.primary }]}
                      />
                      <MoneyText
                        value={p.despesas}
                        prefix="−"
                        style={[styles.histValor, { color: COLORS.danger }]}
                      />
                      <MoneyText
                        value={p.saldo}
                        style={[
                          styles.histSaldo,
                          { color: p.saldo >= 0 ? COLORS.primary : COLORS.danger },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  cancel: { color: COLORS.primary, fontSize: 15, fontWeight: '600', minWidth: 60 },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#0f0f0f' },
  body: { padding: 16, paddingBottom: 60 },
  summaryCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  summaryLabel: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', gap: 16 },
  summaryCol: { flex: 1 },
  metricLabel: { color: COLORS.textSecondary, fontSize: 12 },
  metricValue: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  saldoValue: { fontSize: 26, fontWeight: '800', marginTop: 2 },
  delta: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
  chartCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  section: { marginTop: 8, marginBottom: 16 },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  empty: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    marginBottom: 6,
    gap: 10,
  },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { color: COLORS.text, fontSize: 14 },
  catValor: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  catDelta: {
    color: COLORS.textMuted,
    fontSize: 11,
    minWidth: 50,
    textAlign: 'right',
  },
  histRow: {
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  histLabel: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  histVals: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  histValor: { fontSize: 13 },
  histSaldo: { fontSize: 14, fontWeight: '700' },
});
