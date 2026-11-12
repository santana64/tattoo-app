import React from 'react';
import { View, StyleSheet, Pressable, Platform, type ViewStyle, type StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { durationLabel } from '@/lib/care';

interface DurationSwitchProps {
  durations: number[];
  value: number;
  onChange: (min: number) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Distinct, valid session lengths in the order the artist gave them. */
export function cleanDurations(durations: readonly number[] | null | undefined): number[] {
  const out: number[] = [];
  for (const d of durations ?? []) {
    if (Number.isInteger(d) && d > 0 && !out.includes(d)) out.push(d);
  }
  return out;
}

/** Compact single choice between the session lengths an artist offers. */
export function DurationSwitch({ durations, value, onChange, disabled, style }: DurationSwitchProps) {
  return (
    <View style={[styles.row, style]} accessibilityRole="radiogroup" accessibilityLabel="Durée de la séance">
      {durations.map((min) => {
        const selected = min === value;
        const label = durationLabel(min);
        return (
          <Pressable
            key={min}
            onPress={() => {
              if (selected || disabled) return;
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              onChange(min);
            }}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={`Séance de ${label}`}
            accessibilityState={{ selected, checked: selected, disabled }}
            style={(state) => {
              const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
              return [styles.chip, (pressed || hovered) && !selected && styles.chipHover, selected && styles.chipSelected, disabled && !selected && { opacity: 0.5 }];
            }}
          >
            <TText variant="caption" weight="medium" tabular style={{ color: selected ? Colors.textInverse : Colors.textSecondary }}>
              {label}
            </TText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    height: 32, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.full, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  chipHover: { backgroundColor: Colors.glassBgMid },
  chipSelected: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },
});
