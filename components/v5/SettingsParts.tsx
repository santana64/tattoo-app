// INKR v5 — pieces shared by the calm account screens (settings, support, deletion).
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Kicker, Rule, StatusDot, type StatusTone } from '@/components/v5';

/** Forms and lists of the account screens stay in a 720px pane. */
export const SETTINGS_PANE = 720;

/** Ruled list: "01 / Titre" kicker, an ink rule, then the rows (SettingRow draws its own hairline). */
export function SettingsSection({ number, title, children, style }: {
  number: string; title: string; children: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      <Kicker style={styles.kicker}>{`${number} / ${title}`}</Kicker>
      <Rule tone="ink" />
      {children}
    </View>
  );
}

/** Factual notice: a status dot with its label, one line of explanation, between hairlines. */
export function SettingsNotice({ tone = 'wait', label, children, style }: {
  tone?: StatusTone; label: string; children: string; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.notice, style]} accessibilityRole="text">
      <StatusDot tone={tone} label={label} />
      <TText variant="caption" color="secondary" style={styles.noticeText}>{children}</TText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: Spacing.xl },
  kicker: { marginBottom: Spacing.xs },
  notice: {
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  noticeText: { marginTop: 8, lineHeight: 18 },
});
