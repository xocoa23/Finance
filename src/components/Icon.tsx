import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../types';

export type IconName = keyof typeof Ionicons.glyphMap;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 22, color = COLORS.text }: IconProps) {
  return <Ionicons name={name} size={size} color={color} />;
}
