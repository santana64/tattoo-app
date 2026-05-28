import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { TText } from './TText';

interface TChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function TChip({ label, selected = false, onPress, style }: TChipProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected, style]}
    >
      <TText
        variant="caption"
        weight="medium"
        style={{ color: selected ? Colors.textInverse : Colors.textSecondary }}
      >
        {label}
      </TText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginRight: 8,
    marginBottom: 8,
  },
  selected: {
    backgroundColor: Colors.accentAction,
    borderColor: Colors.accentAction,
  },
});
