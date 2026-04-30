import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, Transaction, Category, TransactionOriginType } from '../types';
import { useTheme } from '../hooks/useTheme';
import { formatShortDate } from '../utils/formatters';
import { CategoryDot } from './CategoryDot';
import { MoneyText } from './MoneyText';

interface TransactionCardProps {
  transaction: Transaction;
  category?: Category;
}

const ORIGIN_LABELS: Record<TransactionOriginType, string> = {
  fixo: 'Fixo',
  parcela: 'Parcela',
  meta: 'Meta',
  meta_fixo: 'Meta',
  esperado: 'Esperado',
};

export function TransactionCard({ transaction, category }: TransactionCardProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const isReceita = transaction.tipo === 'receita';
  const originLabel = transaction.origin ? ORIGIN_LABELS[transaction.origin.type] : null;

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <CategoryDot color={category?.cor ?? colors.textMuted} size={10} />
        <View style={styles.textBlock}>
          <Text style={styles.descricao} numberOfLines={1}>
            {transaction.descricao}
          </Text>
          <View style={styles.metaRow}>
            {originLabel && (
              <View style={styles.originBadge}>
                <Text style={styles.originText}>{originLabel}</Text>
              </View>
            )}
            <Text style={styles.meta}>
              {category?.nome ?? 'Sem categoria'} · {formatShortDate(transaction.data)}
            </Text>
          </View>
        </View>
      </View>
      <MoneyText
        value={transaction.valor}
        prefix={isReceita ? '+ ' : '− '}
        style={[styles.valor, { color: isReceita ? colors.primary : colors.danger }]}
      />
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  textBlock: { flex: 1 },
  descricao: { color: colors.text, fontSize: 15, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: 2, flexWrap: 'wrap' },
  meta: { color: colors.textSecondary, fontSize: 12 },
  originBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  originText: { color: colors.primary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  valor: { fontSize: 15, fontWeight: '600', marginLeft: SPACING.sm },
});
