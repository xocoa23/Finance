import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

export type IconName = keyof typeof Ionicons.glyphMap;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 22, color }: IconProps) {
  const { colors } = useTheme();

  return <Ionicons name={name} size={size} color={color ?? colors.text} />;
}
