import React from 'react';
import { Pressable, StyleSheet, ViewStyle, Platform } from 'react-native';
import { Colors, Radius } from '@/constants/theme';
import { TText } from './TText';

interface TChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function TChip({ label, selected = false, onPress, style }: TChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={(state) => {
        const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
        return [
          styles.chip,
          (hovered || pressed) && !selected && styles.active,
          selected && styles.selected,
          style,
        ];
      }}
    >
      <TText
        variant="caption"
        weight="medium"
        style={{ color: selected ? Colors.textInverse : Colors.textSecondary, fontSize: 13 }}
      >
        {label}
      </TText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    marginRight: 8,
    marginBottom: 8,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  active: {
    backgroundColor: Colors.glassBgMid,
    borderColor: Colors.borderGlass,
  },
  selected: {
    backgroundColor: Colors.accentAction,
    borderColor: Colors.accentAction,
  },
});
