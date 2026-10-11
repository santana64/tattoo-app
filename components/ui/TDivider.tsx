import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';

interface TDividerProps {
  style?: ViewStyle;
  /** Left inset, e.g. to align with the text of an icon row. */
  inset?: number;
  /** `subtle` (default) between rows, `default` between sections. */
  tone?: 'subtle' | 'default';
  /** Vertical hairline instead of horizontal. */
  vertical?: boolean;
}

/** Hairline separator. Decorative: hidden from assistive technologies. */
export function TDivider({ style, inset = 0, tone = 'subtle', vertical = false }: TDividerProps) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        vertical ? styles.vertical : styles.horizontal,
        { backgroundColor: tone === 'default' ? Colors.borderDefault : Colors.borderSubtle },
        inset ? { marginLeft: inset } : undefined,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  horizontal: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  vertical: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
});
