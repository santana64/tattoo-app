import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '@/constants/theme';
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
        <Ionicons name={icon} size={48} color={Colors.textTertiary} style={styles.icon} />
      )}
      <TText variant="title2" style={styles.title}>
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
          style={styles.cta}
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
    padding: Spacing['2xl'],
  },
  icon: {
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing['2xs'],
  },
  description: {
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  cta: {},
});
