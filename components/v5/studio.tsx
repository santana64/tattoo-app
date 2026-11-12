// INKR v5 — studio pieces. The artist's working screens (studio, agenda,
// availability, publishing tools, premium) share these on top of the kit in
// `components/v5/index.tsx`: white panels, ruled action rows on ink, square
// steppers and segmented controls, a cartel preview. Calm by design: no motion.
import React from 'react';
import {
  Platform, Pressable, StyleProp, StyleSheet, View, ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { DetailRow, Kicker } from '@/components/v5';

type Hover = { pressed: boolean; hovered?: boolean; focused?: boolean };
const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color, color', transitionDuration: '180ms' } as object)
  : null;

/** Two-digit cartel number: 1 → "01". */
export const cartelNumber = (n: number) => String(n).padStart(2, '0');

// ─── Panel ────────────────────────────────────────────────────────────────────
/** White sheet with a hairline border: the working surface of a studio screen. */
export function Panel({ children, style, padded = true }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean;
}) {
  const { isWide } = useContentDimensions();
  return (
    <View style={[styles.panel, padded && { padding: isWide ? 26 : 19 }, style]}>
      {children}
    </View>
  );
}

// ─── InkActionRow ─────────────────────────────────────────────────────────────
/** Ruled shortcut on an ink panel: optional cartel number, label, one line of help, arrow. */
export function InkActionRow({ index, label, hint, onPress, accessibilityLabel, last = false }: {
  index?: number; label: string; hint?: string; onPress: () => void; accessibilityLabel?: string; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (hint ? `${label}, ${hint}` : label)}
      style={(state) => [
        styles.inkRow,
        last && styles.inkRowLast,
        webPointer,
        ((state as Hover).hovered || (state as Hover).pressed) && { backgroundColor: Colors.inkRaised },
      ]}
    >
      {(state) => {
        const lit = (state as Hover).hovered || (state as Hover).pressed;
        return (
          <>
            {index !== undefined ? (
              <TText variant="micro" tabular style={[styles.inkIndex, { color: lit ? Colors.flameOnInk : Colors.onInkFaint }]}>
                {cartelNumber(index)}
              </TText>
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <TText variant="bodySmall" weight="semibold" numberOfLines={1} style={{ color: lit ? Colors.flameOnInk : Colors.onInk }}>
                {label}
              </TText>
              {hint ? (
                <TText variant="caption" numberOfLines={1} style={{ color: Colors.onInkMuted, marginTop: 1 }}>{hint}</TText>
              ) : null}
            </View>
            <Ionicons name="arrow-forward" size={15} color={lit ? Colors.flameOnInk : Colors.onInk} />
          </>
        );
      }}
    </Pressable>
  );
}

// ─── NumberedRow ──────────────────────────────────────────────────────────────
/** Ruled, numbered line: "01  Mes demandes  →". Pressable when `onPress` is given. */
export function NumberedRow({ index, title, description, onPress, accessibilityLabel }: {
  index: number; title: string; description?: string; onPress?: () => void; accessibilityLabel?: string;
}) {
  const body = (lit?: boolean) => (
    <>
      <TText variant="label" tabular style={styles.numberedIndex}>
        {cartelNumber(index)}
      </TText>
      <View style={{ flex: 1, minWidth: 0 }}>
        <TText variant="displayS" style={[styles.numberedTitle, { color: lit ? Colors.flameText : Colors.ink }]}>{title}</TText>
        {description ? <TText variant="bodySmall" color="secondary" style={{ marginTop: 4 }}>{description}</TText> : null}
      </View>
      {onPress ? <Ionicons name="arrow-forward" size={16} color={lit ? Colors.flameText : Colors.ink} style={{ marginTop: 6 }} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.numberedRow}>{body()}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={[styles.numberedRow, webPointer]}
    >
      {(state) => body((state as Hover).hovered || (state as Hover).pressed)}
    </Pressable>
  );
}

// ─── StepControl ──────────────────────────────────────────────────────────────
/** Square 44px − / + control for steppers. */
export function StepControl({ icon, label, onPress, disabled = false, haptic = true }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean; haptic?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        if (haptic && Platform.OS !== 'web') Haptics.selectionAsync();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={(state) => {
        const lit = ((state as Hover).hovered || (state as Hover).pressed) && !disabled;
        return [styles.step, webPointer, lit && styles.stepLit, disabled && styles.stepDisabled];
      }}
    >
      {(state) => {
        const lit = ((state as Hover).hovered || (state as Hover).pressed) && !disabled;
        return <Ionicons name={icon} size={17} color={lit ? '#FFFFFF' : Colors.ink} />;
      }}
    </Pressable>
  );
}

// ─── Segmented ────────────────────────────────────────────────────────────────
export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Small trailing note, e.g. a discount. */
  note?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

/** Square segmented control: ink outline, the selected cell filled with ink. */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel, role = 'radio', disabled = false, style }: {
  options: SegmentOption<T>[]; value: T; onChange: (next: T) => void; accessibilityLabel?: string;
  role?: 'radio' | 'tab'; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[styles.segmented, style]}
      accessibilityRole={role === 'tab' ? 'tablist' : 'radiogroup'}
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => { if (!disabled) onChange(option.value); }}
            disabled={disabled}
            accessibilityRole={role}
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={option.note ? `${option.label}, ${option.note}` : option.label}
            style={(state) => [
              styles.segment,
              i > 0 && styles.segmentDivider,
              webPointer,
              !selected && (state as Hover).hovered && { backgroundColor: Colors.wash },
              selected && styles.segmentSelected,
            ]}
          >
            {option.icon ? <Ionicons name={option.icon} size={15} color={selected ? Colors.paper : Colors.ink} /> : null}
            <TText variant="label" weight="bold" uppercase numberOfLines={1} style={{ color: selected ? Colors.paper : Colors.ink, letterSpacing: 0.9 }}>
              {option.label}
            </TText>
            {option.note ? (
              <TText variant="micro" tabular style={{ color: selected ? Colors.flameOnInk : Colors.flameText, letterSpacing: 0 }}>
                {option.note}
              </TText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── OptionChip ───────────────────────────────────────────────────────────────
/** Pill option inside a form (radio or checkbox): hairline, ink when selected. */
export function OptionChip({ label, selected, onPress, role, disabled = false }: {
  label: string; selected: boolean; onPress: () => void; role: 'radio' | 'checkbox'; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        if (Platform.OS !== 'web') Haptics.selectionAsync();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'checkbox' ? { checked: selected, disabled } : { selected, checked: selected, disabled }}
      hitSlop={4}
      style={(state) => [
        styles.chip,
        webPointer,
        !selected && ((state as Hover).hovered || (state as Hover).pressed) && styles.chipHover,
        selected && styles.chipSelected,
        disabled && styles.chipDisabled,
      ]}
    >
      <TText variant="caption" weight="semibold" style={{ fontSize: 12.5, lineHeight: 16, color: selected ? Colors.paper : Colors.ink }}>
        {label}
      </TText>
    </Pressable>
  );
}

// ─── CartelPreview ────────────────────────────────────────────────────────────
/** What a publication will carry, read back as a wall label before sending. */
export function CartelPreview({ kicker = 'Aperçu / Cartel', title, emptyTitle = 'Sans titre', rows, note, onInk = false, style }: {
  kicker?: string; title?: string; emptyTitle?: string;
  rows: { label: string; value?: string | null }[];
  note?: string; onInk?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const filled = rows.filter((r): r is { label: string; value: string } => !!r.value && r.value.trim().length > 0);
  const hasTitle = !!title?.trim();
  return (
    <View style={style} accessibilityLabel={`Aperçu : ${hasTitle ? title : emptyTitle}`}>
      <Kicker tone={onInk ? 'flameOnInk' : 'flame'}>{kicker}</Kicker>
      <TText
        variant="displayS"
        italic={!hasTitle}
        style={[styles.cartelTitle, { color: onInk ? (hasTitle ? Colors.onInk : Colors.onInkMuted) : (hasTitle ? Colors.ink : Colors.textTertiary) }]}
        numberOfLines={3}
      >
        {hasTitle ? title!.trim() : emptyTitle}
      </TText>
      {filled.map((r, i) => (
        <DetailRow key={r.label} label={r.label} value={r.value} onInk={onInk} last={i === filled.length - 1} />
      ))}
      {note ? (
        <TText variant="caption" style={{ marginTop: 12, color: onInk ? Colors.onInkMuted : Colors.textTertiary }}>{note}</TText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line },

  inkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    minHeight: 54, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.onInkLine,
  },
  inkRowLast: { borderBottomWidth: 1, borderBottomColor: Colors.onInkLine },
  inkIndex: { width: 20, letterSpacing: 0.4 },

  numberedRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 18,
    paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  numberedIndex: { width: 26, marginTop: 9, color: Colors.flameText },
  numberedTitle: { fontSize: 28, lineHeight: 31, letterSpacing: -0.6 },

  step: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.white,
  },
  stepLit: { backgroundColor: Colors.flame, borderColor: Colors.flame },
  stepDisabled: { opacity: 0.35 },

  segmented: { flexDirection: 'row', borderWidth: 1, borderColor: Colors.ink, alignSelf: 'flex-start' },
  segment: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 44, paddingHorizontal: 16,
  },
  segmentDivider: { borderLeftWidth: 1, borderLeftColor: Colors.ink },
  segmentSelected: { backgroundColor: Colors.ink },

  chip: {
    minHeight: 36, justifyContent: 'center', paddingHorizontal: 14,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.line, backgroundColor: 'transparent',
  },
  chipHover: { backgroundColor: Colors.wash, borderColor: Colors.ink },
  chipSelected: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  chipDisabled: { opacity: 0.38 },

  cartelTitle: { fontSize: 30, lineHeight: 32, letterSpacing: -0.6, marginTop: 12, marginBottom: 16 },
});
