import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface ProgressBarProps {
  progress: number;
  height?: number;
  color?: string;
}

export function ProgressBar({ progress, height = 8, color }: ProgressBarProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.track, { height }]}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color ?? colors.primary, height }]} />
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 4,
  },
});
