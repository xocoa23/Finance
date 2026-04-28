import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { useHideValues } from '../hooks/useHideValues';
import { formatCurrency } from '../utils/formatters';

interface MoneyTextProps {
  value: number;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  suffix?: string;
  numberOfLines?: number;
}

export function MoneyText({ value, style, prefix = '', suffix = '', numberOfLines }: MoneyTextProps) {
  const [hidden] = useHideValues();
  const display = hidden ? 'R$ ••••' : formatCurrency(value);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {prefix}
      {display}
      {suffix}
    </Text>
  );
}
