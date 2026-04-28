import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../types';

interface ProgressBarProps {
  progress: number;
  height?: number;
  color?: string;
}

export function ProgressBar({ progress, height = 8, color = COLORS.primary }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.track, { height }]}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color, height }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 4,
  },
});
