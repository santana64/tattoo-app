import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
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

/**
 * Empty, error and offline states: a quiet editorial notice — square mark,
 * serif statement, one outlined action. Nothing decorative, nothing invented.
 */
export function EmptyState({ icon, title, description, ctaLabel, onCta, style }: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.block}>
        {icon && (
          <View style={styles.iconFrame}>
            <Ionicons name={icon} size={20} color={Colors.ink} />
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
            style={styles.cta}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing['3xl'],
  },
  block: {
    width: '100%',
    maxWidth: 420,
    borderTopWidth: 1,
    borderTopColor: Colors.ink,
    paddingTop: Spacing.md,
  },
  iconFrame: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.line,
    marginBottom: Spacing.md,
  },
  title: {
    marginBottom: Spacing['2xs'],
  },
  description: {
    lineHeight: 23,
  },
  cta: {
    marginTop: Spacing.lg,
    alignSelf: 'flex-start',
  },
});
