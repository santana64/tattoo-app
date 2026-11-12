// INKR v5 — premium pieces: the ink hero that opens subscription, guide and
// customisation screens, and the ruled numbered list of benefits.
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { EditorialTitle, InkPanel, Kicker } from '@/components/v5';
import { cartelNumber } from '@/components/v5/studio';

/** Ink hero with a giant serif title. Children sit under the copy (actions, status). */
export function PremiumHero({ kicker, title, emphasis, body, size = 'hero', children, style }: {
  kicker: string; title: string; emphasis?: string; body?: string;
  size?: 'hero' | 'page'; children?: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const { isWide } = useContentDimensions();
  return (
    <InkPanel style={[{ padding: isWide ? 60 : 27 }, style]}>
      <Kicker tone="flameOnInk">{kicker}</Kicker>
      <EditorialTitle size={size} onInk emphasis={emphasis} breakEmphasis style={{ marginTop: isWide ? 32 : 24 }}>
        {title}
      </EditorialTitle>
      {body ? (
        <TText variant="body" color="onInkMuted" style={[styles.body, { marginTop: isWide ? 36 : 24 }]}>{body}</TText>
      ) : null}
      {children ? <View style={{ marginTop: isWide ? 32 : 24 }}>{children}</View> : null}
    </InkPanel>
  );
}

/**
 * One benefit of a plan: cartel number, label, and whether it is included.
 * Ruled like the rest of the studio lists.
 */
export function BenefitRow({ index, label, included = true, onInk = false }: {
  index: number; label: string; included?: boolean; onInk?: boolean;
}) {
  const line = onInk ? Colors.onInkLine : Colors.line;
  const text = included ? (onInk ? Colors.onInk : Colors.ink) : (onInk ? Colors.onInkFaint : Colors.textTertiary);
  return (
    <View
      style={[styles.benefit, { borderTopColor: line }]}
      accessible
      accessibilityLabel={`${label}${included ? ', inclus' : ', non inclus'}`}
    >
      <TText variant="micro" tabular style={[styles.benefitIndex, { color: onInk ? Colors.flameOnInk : Colors.flameText }]}>
        {cartelNumber(index)}
      </TText>
      <TText
        variant="bodySmall"
        style={[{ flex: 1, color: text }, !included && styles.excluded]}
      >
        {label}
      </TText>
      <Ionicons
        name={included ? 'checkmark' : 'remove'}
        size={15}
        color={included ? (onInk ? Colors.flameOnInk : Colors.flameText) : (onInk ? Colors.onInkFaint : Colors.textTertiary)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { maxWidth: 480, lineHeight: 25 },
  benefit: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    minHeight: 44, paddingVertical: 10, borderTopWidth: 1,
  },
  benefitIndex: { width: 20, letterSpacing: 0.4 },
  excluded: { textDecorationLine: 'line-through' },
});
