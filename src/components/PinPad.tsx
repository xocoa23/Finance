import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';

interface PinPadProps {
  title: string;
  subtitle?: string;
  onComplete: (pin: string) => void;
  errorMessage?: string;
  resetSignal?: number;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export function PinPad({ title, subtitle, onComplete, errorMessage, resetSignal }: PinPadProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const [pin, setPin] = useState('');

  useEffect(() => {
    setPin('');
  }, [resetSignal]);

  useEffect(() => {
    if (pin.length === 4) {
      const value = pin;
      onComplete(value);
    }
  }, [pin, onComplete]);

  const handleKey = (key: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (key === 'del') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    setPin((p) => (p.length < 4 ? p + key : p));
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View style={styles.dotsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length && styles.dotFilled,
              !!errorMessage && styles.dotError,
            ]}
          />
        ))}
      </View>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : <View style={styles.errorPlaceholder} />}

      <View style={styles.grid}>
        {KEYS.map((key, idx) => {
          if (key === '') {
            return <View key={idx} style={styles.key} />;
          }
          return (
            <TouchableOpacity
              key={idx}
              style={styles.key}
              onPress={() => handleKey(key)}
              activeOpacity={0.6}
            >
              <Text style={styles.keyText}>{key === 'del' ? '⌫' : key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 18,
    marginVertical: 20,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    height: 18,
    marginBottom: 12,
  },
  errorPlaceholder: {
    height: 18,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    justifyContent: 'space-between',
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.card,
    margin: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '500',
  },
});
