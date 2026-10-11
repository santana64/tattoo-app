import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from './TText';
import { TButton } from './TButton';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
  style?: ViewStyle;
}

export function EmptyState({ icon, title, description, ctaLabel, onCta, style }: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      {icon && (
        <View style={styles.iconFrame}>
          <Ionicons name={icon} size={22} color={Colors.accentWarm} />
        </View>
      )}
      <TText variant="displayS" style={styles.title}>
        {title}
      </TText>
      {description && (
        <TText variant="bodySmall" color="secondary" style={styles.description}>
          {description}
        </TText>
      )}
      {ctaLabel && onCta && (
        <TButton
          title={ctaLabel}
          onPress={onCta}
          variant="secondary"
          size="md"
          fullWidth={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing['3xl'],
  },
  iconFrame: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderGlow,
    backgroundColor: Colors.glassAmber,
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing['2xs'],
    maxWidth: Layout.maxReading,
  },
  description: {
    textAlign: 'center',
    marginBottom: Spacing.lg,
    maxWidth: 360,
  },
});
