import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from './ui/TText';

interface OnboardingProgressProps {
  total: number;
  current: number;
}

export function OnboardingProgress({ total, current }: OnboardingProgressProps) {
  return (
    <View style={styles.container}>
      <View style={styles.bars}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              i < current ? styles.barFilled : styles.barEmpty,
              i === 0 && styles.barFirst,
            ]}
          />
        ))}
      </View>
      <TText variant="caption" color="tertiary">
        {current}/{total}
      </TText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2xs'],
    marginBottom: Spacing.md,
  },
  bars: {
    flexDirection: 'row',
    flex: 1,
    gap: 4,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: Radius.full,
  },
  barFirst: {},
  barFilled: {
    backgroundColor: Colors.accent,
  },
  barEmpty: {
    backgroundColor: Colors.bgSubtle,
  },
});
