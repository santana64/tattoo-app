import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { Colors, Radius, Shadow } from '@/constants/theme';

interface TCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  elevated?: boolean;
  noPadding?: boolean;
}

export function TCard({ children, style, onPress, elevated = false, noPadding = false }: TCardProps) {
  const cardStyle = [
    styles.card,
    elevated && styles.elevated,
    noPadding && styles.noPadding,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  elevated: {
    ...Shadow.md,
    borderWidth: 0,
  },
  noPadding: {
    padding: 0,
  },
});
