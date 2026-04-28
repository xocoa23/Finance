import React from 'react';
import { View } from 'react-native';

interface CategoryDotProps {
  color: string;
  size?: number;
}

export function CategoryDot({ color, size = 12 }: CategoryDotProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}
    />
  );
}
