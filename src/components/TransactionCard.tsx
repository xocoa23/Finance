import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING, Transaction, Category } from '../types';
import { formatShortDate } from '../utils/formatters';
import { CategoryDot } from './CategoryDot';
import { MoneyText } from './MoneyText';

interface TransactionCardProps {
  transaction: Transaction;
  category?: Category;
}

export function TransactionCard({ transaction, category }: TransactionCardProps) {
  const isReceita = transaction.tipo === 'receita';
  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <CategoryDot color={category?.cor ?? COLORS.textMuted} size={10} />
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
        style={[styles.valor, { color: isReceita ? COLORS.primary : COLORS.danger }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
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
  descricao: { color: COLORS.text, fontSize: 15, fontWeight: '500' },
  meta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  valor: { fontSize: 15, fontWeight: '600', marginLeft: SPACING.sm },
});
