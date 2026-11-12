// INKR v5 kit — "The Human Canvas".
// Editorial building blocks shared by every screen. They carry the direction
// (mastheads, cartels, ink panels, square controls) so screens compose instead
// of restyling locally. See DESIGN.md.
import React from 'react';
import {
  Platform, Pressable, StyleProp, StyleSheet, TextStyle, View, ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, Gradients, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { RevealImage } from '@/components/motion/RevealImage';
import { useContentDimensions } from '@/hooks/useContentDimensions';

type Hover = { pressed: boolean; hovered?: boolean; focused?: boolean };
const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color, opacity', transitionDuration: '180ms' } as object)
  : null;

// ─── Kicker ───────────────────────────────────────────────────────────────────
type KickerTone = 'ink' | 'flame' | 'muted' | 'onInk' | 'onInkMuted' | 'flameOnInk';
const KICKER: Record<KickerTone, string> = {
  ink: Colors.ink,
  flame: Colors.flameText,
  muted: Colors.textTertiary,
  onInk: Colors.onInk,
  onInkMuted: Colors.onInkMuted,
  flameOnInk: Colors.flameOnInk,
};

/** Tracked-capitals line above a title or a section: "02 / Découvrir". */
export function Kicker({ children, tone = 'ink', style, numberOfLines }: {
  children: React.ReactNode; tone?: KickerTone; style?: StyleProp<TextStyle>; numberOfLines?: number;
}) {
  return (
    <TText variant="label" weight="bold" uppercase numberOfLines={numberOfLines} style={[{ color: KICKER[tone] }, style]}>
      {children}
    </TText>
  );
}

// ─── Rule ─────────────────────────────────────────────────────────────────────
/** Horizontal rule. `ink` closes a masthead or opens a list; `line` separates rows. */
export function Rule({ tone = 'line', style }: { tone?: 'ink' | 'line' | 'onInk'; style?: StyleProp<ViewStyle> }) {
  const color = tone === 'ink' ? Colors.ink : tone === 'onInk' ? Colors.onInkLine : Colors.line;
  return <View accessible={false} importantForAccessibility="no" style={[{ height: 1, alignSelf: 'stretch', backgroundColor: color }, style]} />;
}

// ─── PageWrap ─────────────────────────────────────────────────────────────────
/** Centres a page in `Layout.maxContent` with the gutter of the current width. */
export function PageWrap({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { gutter } = useContentDimensions();
  return (
    <View style={[{ width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center', paddingHorizontal: gutter }, style]}>
      {children}
    </View>
  );
}

// ─── EditorialTitle ───────────────────────────────────────────────────────────
interface EditorialTitleProps {
  /** Upright part of the title. */
  children: string;
  /** Italic vermilion part, set after the upright part. */
  emphasis?: string;
  /** Put the emphasis on its own line. */
  breakEmphasis?: boolean;
  size?: 'page' | 'section' | 'hero';
  onInk?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/** The serif statement of a screen: "La bonne *rencontre.*" */
export function EditorialTitle({
  children, emphasis, breakEmphasis = false, size = 'page', onInk = false, style, numberOfLines,
}: EditorialTitleProps) {
  const { width, isWide } = useContentDimensions();
  const fontSize = size === 'hero'
    ? (isWide ? Math.min(132, Math.max(84, width * 0.085)) : Math.min(84, Math.max(58, width * 0.19)))
    : size === 'page'
      ? (isWide ? Math.min(88, Math.max(60, width * 0.058)) : 50)
      : (isWide ? Math.min(60, Math.max(42, width * 0.04)) : 36);
  const type: TextStyle = {
    fontSize,
    lineHeight: Math.round(fontSize * (size === 'hero' ? 0.88 : 0.96)),
    letterSpacing: -fontSize * (size === 'hero' ? 0.055 : 0.04),
  };
  return (
    <TText
      variant="displayL"
      accessibilityRole="header"
      numberOfLines={numberOfLines}
      style={[type, { color: onInk ? Colors.onInk : Colors.ink }, style]}
    >
      {children}
      {emphasis ? (
        <TText variant="displayL" italic style={[type, { color: onInk ? Colors.flameOnInk : Colors.accentGlow }]}>
          {breakEmphasis ? '\n' : ' '}{emphasis}
        </TText>
      ) : null}
    </TText>
  );
}

// ─── Masthead ─────────────────────────────────────────────────────────────────
interface MastheadProps {
  kicker?: string;
  title: string;
  emphasis?: string;
  breakEmphasis?: boolean;
  description?: string;
  /** Rendered at the right on wide screens, under the description on phones. */
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Page header: kicker, serif title, a short description at the right, closed by an ink rule. */
export function Masthead({ kicker, title, emphasis, breakEmphasis, description, action, style }: MastheadProps) {
  const { isWide } = useContentDimensions();
  return (
    <View style={[styles.masthead, isWide ? styles.mastheadWide : styles.mastheadNarrow, style]}>
      <View style={styles.mastheadMain}>
        {kicker ? <Kicker style={{ marginBottom: isWide ? 16 : 12 }}>{kicker}</Kicker> : null}
        <EditorialTitle emphasis={emphasis} breakEmphasis={breakEmphasis}>{title}</EditorialTitle>
      </View>
      {(description || action) ? (
        <View style={isWide ? styles.mastheadAside : styles.mastheadBelow}>
          {description ? (
            <TText variant="bodySmall" color="secondary" style={styles.mastheadCopy}>{description}</TText>
          ) : null}
          {action ? <View style={{ marginTop: description ? 16 : 0, alignSelf: 'flex-start' }}>{action}</View> : null}
        </View>
      ) : null}
    </View>
  );
}

// ─── SectionHead ──────────────────────────────────────────────────────────────
interface SectionHeadProps {
  kicker?: string;
  title?: string;
  emphasis?: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  onInk?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Section opener: kicker and/or serif title at the left, one text action at the right. */
export function SectionHead({ kicker, title, emphasis, description, action, onInk = false, style }: SectionHeadProps) {
  return (
    <View style={[styles.sectionHead, style]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {kicker ? <Kicker tone={onInk ? 'onInkMuted' : 'ink'} style={title ? { marginBottom: 10 } : undefined}>{kicker}</Kicker> : null}
        {title ? <EditorialTitle size="section" emphasis={emphasis} onInk={onInk}>{title}</EditorialTitle> : null}
        {description ? (
          <TText variant="bodySmall" style={{ marginTop: 10, maxWidth: 420, color: onInk ? Colors.onInkMuted : Colors.textSecondary }}>
            {description}
          </TText>
        ) : null}
      </View>
      {action ? <TextLink label={action.label} onPress={action.onPress} onInk={onInk} /> : null}
    </View>
  );
}

// ─── TextLink ─────────────────────────────────────────────────────────────────
/** Tertiary action: tracked capitals with an arrow. Use instead of a third button. */
export function TextLink({ label, onPress, onInk = false, icon = 'arrow-forward', style, accessibilityLabel }: {
  label: string; onPress: () => void; onInk?: boolean; icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={10}
      style={[styles.textLink, webPointer, style]}
    >
      {(state) => {
        const { hovered, pressed } = state as Hover;
        const color = hovered || pressed
          ? (onInk ? Colors.flameOnInk : Colors.flameText)
          : (onInk ? Colors.onInk : Colors.ink);
        return (
          <>
            <TText variant="label" weight="bold" uppercase style={{ color, letterSpacing: 1 }}>{label}</TText>
            <Ionicons name={icon} size={13} color={color} />
          </>
        );
      }}
    </Pressable>
  );
}

// ─── InkPanel ─────────────────────────────────────────────────────────────────
/**
 * Ink ground. Everything inside must use the `onInk*` colours
 * (`<TText color="onInk">`, `TButton variant="glass" | "inverse"`).
 */
export function InkPanel({ children, style, padded = true }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean;
}) {
  const { isWide } = useContentDimensions();
  return (
    <View style={[{ backgroundColor: Colors.inkPanel }, padded && { padding: isWide ? 40 : 24 }, style]}>
      {children}
    </View>
  );
}

// ─── StatusDot ────────────────────────────────────────────────────────────────
export type StatusTone = 'open' | 'wait' | 'closed' | 'alert';
const STATUS: Record<StatusTone, string> = {
  open: Colors.moss,
  wait: '#C08A49',
  closed: '#A29B90',
  alert: Colors.flame,
};

/** 6px dot + label in small capitals. The only way a status is shown. */
export function StatusDot({ tone, label, onInk = false, style }: {
  tone: StatusTone; label: string; onInk?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.status, style]}>
      <View style={[styles.statusDot, { backgroundColor: tone === 'open' && onInk ? '#9DB596' : STATUS[tone] }]} />
      <TText variant="micro" weight="bold" uppercase style={{ color: onInk ? Colors.onInk : Colors.ink, letterSpacing: 0.6 }}>
        {label}
      </TText>
    </View>
  );
}

// ─── MetricGrid ───────────────────────────────────────────────────────────────
export interface Metric {
  label: string;
  /** Already formatted. Pass "—" when there is no data: never a made-up number. */
  value: string;
  hint?: string;
  onPress?: () => void;
}

/** Studio figures: white cells divided by hairlines, serif numerals. */
export function MetricGrid({ items, style }: { items: Metric[]; style?: StyleProp<ViewStyle> }) {
  const { isWide } = useContentDimensions();
  const columns = isWide ? Math.min(items.length, 4) : Math.min(items.length, 2);
  return (
    <View style={[styles.metrics, style]}>
      {items.map((m, i) => {
        const cell = (
          <>
            <TText variant="micro" uppercase style={styles.metricLabel} numberOfLines={2}>{m.label}</TText>
            <TText variant="displayM" tabular style={styles.metricValue} numberOfLines={1}>{m.value}</TText>
            {m.hint ? <TText variant="micro" color="tertiary" style={{ letterSpacing: 0, marginTop: 4 }}>{m.hint}</TText> : null}
          </>
        );
        const cellStyle = [styles.metric, { width: `${100 / columns}%` as const }, isWide && styles.metricWide];
        return m.onPress ? (
          <Pressable
            key={`${m.label}-${i}`}
            onPress={m.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${m.label} : ${m.value}`}
            style={(state) => [cellStyle, webPointer, (state as Hover).hovered && { backgroundColor: Colors.bgSurface }]}
          >
            {cell}
          </Pressable>
        ) : (
          <View key={`${m.label}-${i}`} style={cellStyle} accessible accessibilityLabel={`${m.label} : ${m.value}`}>
            {cell}
          </View>
        );
      })}
    </View>
  );
}

// ─── StepProgress ─────────────────────────────────────────────────────────────
/** Segmented progress for briefs and onboarding: one bar per step, done = vermilion. */
export function StepProgress({ current, total, label, onInk = false, style }: {
  /** 1-based index of the current step. */
  current: number; total: number; label?: string; onInk?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={style}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? `Étape ${current} sur ${total}`}
      accessibilityValue={{ min: 0, max: total, now: current }}
    >
      <View style={styles.stepRow}>
        <Kicker tone={onInk ? 'flameOnInk' : 'flame'}>{`Étape ${String(current).padStart(2, '0')} / ${String(total).padStart(2, '0')}`}</Kicker>
        {label ? <Kicker tone={onInk ? 'onInkMuted' : 'muted'} numberOfLines={1}>{label}</Kicker> : null}
      </View>
      <View style={styles.steps}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[styles.step, { backgroundColor: i < current ? Colors.flame : onInk ? Colors.onInkLine : '#BCB3A6' }]}
          />
        ))}
      </View>
    </View>
  );
}

// ─── DetailRow ────────────────────────────────────────────────────────────────
/** Label / value line of a cartel: "Budget — dès 300 €". */
export function DetailRow({ label, value, onInk = false, last = false, children }: {
  label: string; value?: string; onInk?: boolean; last?: boolean; children?: React.ReactNode;
}) {
  const line = onInk ? Colors.onInkLine : Colors.line;
  return (
    <View style={[styles.detailRow, { borderTopColor: line }, last && { borderBottomWidth: 1, borderBottomColor: line }]}>
      <TText variant="caption" style={{ color: onInk ? Colors.onInkMuted : Colors.textSecondary }}>{label}</TText>
      {children ?? (
        <TText variant="caption" weight="semibold" tabular style={[styles.detailValue, { color: onInk ? Colors.onInk : Colors.ink }]}>
          {value}
        </TText>
      )}
    </View>
  );
}

// ─── SettingRow ───────────────────────────────────────────────────────────────
/** Row of a settings or studio list: serif title, one line of help, a control or an arrow. */
export function SettingRow({ title, description, right, onPress, destructive = false, accessibilityLabel }: {
  title: string; description?: string; right?: React.ReactNode; onPress?: () => void;
  destructive?: boolean; accessibilityLabel?: string;
}) {
  const body = (hovered?: boolean) => (
    <>
      <View style={{ flex: 1, minWidth: 0 }}>
        <TText
          variant="displayS"
          style={{ fontSize: 24, lineHeight: 28, letterSpacing: -0.4, color: destructive ? Colors.error : hovered ? Colors.flameText : Colors.ink }}
        >
          {title}
        </TText>
        {description ? <TText variant="caption" color="secondary" style={{ marginTop: 2 }}>{description}</TText> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="arrow-forward" size={16} color={hovered ? Colors.flameText : Colors.ink} /> : null)}
    </>
  );
  if (!onPress) return <View style={styles.settingRow}>{body()}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={[styles.settingRow, webPointer]}
    >
      {(state) => body((state as Hover).hovered || (state as Hover).pressed)}
    </Pressable>
  );
}

// ─── IconButton ───────────────────────────────────────────────────────────────
/** Square 44px icon control with a hairline. `plate` gives it a paper fill for use over photography. */
export function IconButton({ icon, label, onPress, active = false, onInk = false, plate = false, size = 44, style }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void; active?: boolean;
  onInk?: boolean; plate?: boolean; size?: number; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={size < 44 ? (44 - size) / 2 : 0}
      style={(state) => {
        const { hovered, pressed } = state as Hover;
        return [
          styles.iconButton,
          webPointer,
          { width: size, height: size, borderColor: onInk ? Colors.onInkLine : Colors.line },
          plate && { backgroundColor: Colors.paper, borderColor: Colors.paper },
          (hovered || pressed || active) && { backgroundColor: Colors.flame, borderColor: Colors.flame },
          style,
        ];
      }}
    >
      {(state) => {
        const { hovered, pressed } = state as Hover;
        const lit = hovered || pressed || active;
        return <Ionicons name={icon} size={Math.round(size * 0.42)} color={lit ? '#FFFFFF' : onInk && !plate ? Colors.onInk : Colors.ink} />;
      }}
    </Pressable>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
/** Switch: wash track off, ink track with a vermilion knob on. */
export function Toggle({ value, onChange, label, disabled = false }: {
  value: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={8}
      style={[styles.toggle, webPointer, value && styles.toggleOn, disabled && { opacity: 0.45 }]}
    >
      <View style={[styles.knob, value && styles.knobOn]} />
    </Pressable>
  );
}

// ─── Choice ───────────────────────────────────────────────────────────────────
/** Large selectable cell for briefs and onboarding (role, body zone, size…). */
export function Choice({ title, hint, selected, onPress, style }: {
  title: string; hint?: string; selected: boolean; onPress: () => void; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={hint ? `${title}, ${hint}` : title}
      style={(state) => [
        styles.choice,
        webPointer,
        ((state as Hover).hovered || selected) && styles.choiceActive,
        style,
      ]}
    >
      <TText variant="bodySmall" weight="semibold">{title}</TText>
      {hint ? <TText variant="caption" color="secondary" style={{ marginTop: 6 }}>{hint}</TText> : null}
      {selected ? <View style={styles.choiceMark} /> : null}
    </Pressable>
  );
}

// ─── ArtCanvas ────────────────────────────────────────────────────────────────
interface ArtCanvasProps {
  uri?: string | null;
  /** Width / height. Defaults to the 4:5 portrait of the gallery. */
  aspectRatio?: number;
  /** Cartel mark in the top-left corner: "N° 03", "Flash", "Série". */
  mark?: string;
  /** Plate tone used behind missing or loading artwork. */
  tone?: 'clay' | 'bone' | 'slate';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const PLATES = { clay: Gradients.plateClay, bone: Gradients.plateBone, slate: Gradients.plateSlate } as const;

/**
 * Frame for a piece of work: square corners, no overlay on the photograph, an
 * optional cartel mark. Without an image it shows a skin-tone plate — never a
 * stock picture or an invented artwork.
 */
export function ArtCanvas({ uri, aspectRatio = 4 / 5, mark, tone = 'clay', accessibilityLabel, style, children }: ArtCanvasProps) {
  const plate = (
    <LinearGradient colors={PLATES[tone]} start={{ x: 0.3, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
  );
  return (
    <View style={[{ aspectRatio, backgroundColor: Colors.clay, overflow: 'hidden' }, style]}>
      <RevealImage uri={uri} style={StyleSheet.absoluteFill} accessibilityLabel={accessibilityLabel} fallback={plate} />
      {mark ? (
        <View style={styles.mark} pointerEvents="none">
          <TText variant="micro" weight="bold" uppercase style={styles.markText} numberOfLines={1}>{mark}</TText>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  masthead: { borderBottomWidth: 1, borderBottomColor: Colors.ink },
  mastheadWide: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 32, paddingTop: 48, paddingBottom: 34, marginBottom: 34 },
  mastheadNarrow: { paddingTop: 22, paddingBottom: 26, marginBottom: 26 },
  mastheadMain: { flexShrink: 1, minWidth: 0 },
  mastheadAside: { maxWidth: 400, flexShrink: 1, paddingBottom: 6 },
  mastheadBelow: { marginTop: 18 },
  mastheadCopy: { lineHeight: 23 },

  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 22 },
  textLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },

  status: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },

  metrics: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderTopWidth: 1, borderLeftWidth: 1, borderColor: Colors.line,
  },
  metric: {
    backgroundColor: Colors.white,
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: Colors.line,
    padding: 18,
  },
  metricWide: { paddingVertical: 25, paddingHorizontal: 22 },
  metricLabel: { color: Colors.textSecondary, letterSpacing: 1.2, marginBottom: 10 },
  metricValue: { fontFamily: Fonts.serif, fontSize: 44, lineHeight: 46, letterSpacing: -1 },

  stepRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  steps: { flexDirection: 'row', gap: 7 },
  step: { flex: 1, height: 3 },

  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 16,
    paddingVertical: 13, borderTopWidth: 1,
  },
  detailValue: { flexShrink: 1, textAlign: 'right' },

  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20,
    paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },

  iconButton: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  toggle: {
    width: 58, height: 30, borderRadius: 15, padding: 5,
    borderWidth: 1, borderColor: Colors.ink, backgroundColor: Colors.wash,
    flexDirection: 'row', alignItems: 'center',
  },
  toggleOn: { backgroundColor: Colors.ink, justifyContent: 'flex-end' },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF' },
  knobOn: { backgroundColor: Colors.flame },

  choice: {
    minHeight: 86, padding: 17, justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.line, backgroundColor: 'transparent',
  },
  choiceActive: { borderColor: Colors.flame, backgroundColor: Colors.flameSoft },
  choiceMark: { position: 'absolute', top: 0, right: 0, width: 10, height: 10, backgroundColor: Colors.flame },

  mark: { position: 'absolute', top: 12, left: 12, backgroundColor: Colors.paper, paddingHorizontal: 7, paddingVertical: 4, maxWidth: '80%' },
  markText: { color: Colors.ink, letterSpacing: 1.3, fontSize: 9 },
});
