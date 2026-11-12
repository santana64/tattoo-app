import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { Colors, Radius } from '@/constants/theme';

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
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={(state) => {
          const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
          return [cardStyle, (pressed || hovered) && styles.active];
        }}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  elevated: {
    borderColor: Colors.ink,
  },
  active: {
    backgroundColor: Colors.bgSurface,
    borderColor: Colors.ink,
  },
  noPadding: {
    padding: 0,
  },
});
