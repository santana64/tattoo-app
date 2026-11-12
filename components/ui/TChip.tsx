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

/** Filter pill — the only rounded control in v5. Selected = ink fill. */
export function TChip({ label, selected = false, onPress, style }: TChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={(state) => {
        const { pressed, hovered, focused } = state as { pressed: boolean; hovered?: boolean; focused?: boolean };
        return [
          styles.chip,
          (hovered || pressed) && !selected && styles.active,
          selected && styles.selected,
          focused && styles.focused,
          style,
        ];
      }}
    >
      <TText
        variant="caption"
        weight="semibold"
        style={{ color: selected ? Colors.paper : Colors.textPrimary, fontSize: 12.5, lineHeight: 16 }}
      >
        {label}
      </TText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.line,
    marginRight: 8,
    marginBottom: 8,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '180ms' } as object)
      : null),
  },
  active: { backgroundColor: Colors.wash, borderColor: Colors.ink },
  selected: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  focused: { borderColor: Colors.flame },
});
