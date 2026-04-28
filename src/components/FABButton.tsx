import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon, IconName } from './Icon';
import { COLORS } from '../types';

interface FABButtonProps {
  onPress: () => void;
  icon?: IconName;
}

export function FABButton({ onPress, icon = 'add' }: FABButtonProps) {
  const handle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  };

  return (
    <TouchableOpacity style={styles.fab} onPress={handle} activeOpacity={0.85}>
      <Icon name={icon} size={26} color="#0a0a0b" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
