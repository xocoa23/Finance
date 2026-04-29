import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, Transaction, Category } from '../types';
import { useTheme } from '../hooks/useTheme';
import { formatShortDate } from '../utils/formatters';
import { CategoryDot } from './CategoryDot';
import { MoneyText } from './MoneyText';

interface TransactionCardProps {
  transaction: Transaction;
  category?: Category;
}

export function TransactionCard({ transaction, category }: TransactionCardProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const isReceita = transaction.tipo === 'receita';
  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <CategoryDot color={category?.cor ?? colors.textMuted} size={10} />
        <View style={styles.textBlock}>
          <Text style={styles.descricao} numberOfLines={1}>
            {transaction.descricao}
          </Text>
          <Text style={styles.meta}>
            {category?.nome ?? 'Sem categoria'} · {formatShortDate(transaction.data)}
          </Text>
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
  meta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  valor: { fontSize: 15, fontWeight: '600', marginLeft: SPACING.sm },
});
