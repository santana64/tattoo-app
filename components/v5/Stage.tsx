// INKR v5 — stage for the full-window flows (sign-in, onboarding).
// Wide screens: an ink column at the left (statement) beside a paper column
// (the form). Phones: a short ink band, then the paper form. These flows have
// no navigation rail, so the window width is the page width.
import React from 'react';
import { StyleProp, TextStyle, View, ViewStyle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Logo } from '@/components/ui/Logo';
import { Kicker } from '@/components/v5';

const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));

/** Breakpoint and geometry of the stage, from the window (no rail in these flows). */
export function useStage() {
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  return {
    wide,
    width,
    height,
    gutter: wide ? Layout.gutterWide : Layout.gutter,
    /** Width of the ink column on wide screens. */
    asideWidth: Math.round(clamp(380, width * 0.4, 600)),
  };
}

/** Serif statement at an explicit size, closed by one italic vermilion phrase. */
export function StageTitle({
  children, emphasis, size, onInk = false, breakEmphasis = false, style,
}: {
  children: string; emphasis?: string; size: number; onInk?: boolean; breakEmphasis?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const type: TextStyle = {
    fontSize: size,
    lineHeight: Math.round(size * 0.96),
    letterSpacing: -size * 0.035,
  };
  return (
    <TText variant="displayL" accessibilityRole="header" style={[type, { color: onInk ? Colors.onInk : Colors.ink }, style]}>
      {children}
      {emphasis ? (
        <TText variant="displayL" italic style={[type, { color: onInk ? Colors.flameOnInk : Colors.accentGlow }]}>
          {breakEmphasis ? '\n' : ' '}{emphasis}
        </TText>
      ) : null}
    </TText>
  );
}

interface StageAsideProps {
  kicker: string;
  title: string;
  emphasis: string;
  copy?: string;
  /** Rendered before the wordmark (a back control). */
  leading?: React.ReactNode;
  /** Bottom of the column (a cartel, a step counter). */
  footer?: React.ReactNode;
  width: number;
  style?: StyleProp<ViewStyle>;
}

/** Wide screens: the ink column at the left of the stage. Everything in it uses the `onInk*` colours. */
export function StageAside({ kicker, title, emphasis, copy, leading, footer, width, style }: StageAsideProps) {
  const insets = useSafeAreaInsets();
  const titleSize = Math.round(clamp(56, width * 0.15, 92));
  return (
    <View
      style={[
        {
          width,
          backgroundColor: Colors.inkPanel,
          paddingHorizontal: 48,
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 40,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 44 }}>
        {leading}
        <Logo size="sm" variant="wordmark" color={Colors.onInk} />
      </View>
      <View style={{ flex: 1, minHeight: 48 }} />
      <Kicker tone="flameOnInk" style={{ marginBottom: 22 }}>{kicker}</Kicker>
      <StageTitle size={titleSize} emphasis={emphasis} onInk breakEmphasis>{title}</StageTitle>
      {copy ? (
        <TText variant="bodySmall" color="onInkMuted" style={{ marginTop: 26, maxWidth: 340, lineHeight: 22 }}>
          {copy}
        </TText>
      ) : null}
      <View style={{ flex: 1, minHeight: 48 }} />
      {footer}
    </View>
  );
}

/** Phones and narrow windows: a short ink band at the top of the stage. */
export function StageBand({ leading, meta, children, style }: {
  /** Rendered before the wordmark (a back control). */
  leading?: React.ReactNode;
  /** Small kicker at the right of the wordmark. */
  meta?: string;
  /** Statement under the wordmark row; omit for a compact band. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          backgroundColor: Colors.inkPanel,
          paddingTop: insets.top + 10,
          paddingHorizontal: Layout.gutter,
          paddingBottom: children ? 28 : 12,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {leading}
          <Logo size="sm" variant="wordmark" color={Colors.onInk} />
        </View>
        {meta ? <Kicker tone="onInkMuted" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>{meta}</Kicker> : null}
      </View>
      {children}
    </View>
  );
}
