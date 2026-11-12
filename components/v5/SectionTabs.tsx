// INKR v5 — section tabs: tracked-capitals words on an ink rule, the active one
// underlined in vermilion. For peers switched often ("Pour vous" / "Abonnements",
// "Enregistrées" / "Aimées"): no motion, no haptic.
import React from 'react';
import { Platform, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';
import { TText } from '@/components/ui/TText';

export interface SectionTab<T extends string> {
  value: T;
  label: string;
  /** Real count shown after the label (tabular). Omitted: no number. */
  count?: number;
}

type Hover = { pressed: boolean; hovered?: boolean };

export function SectionTabs<T extends string>({ tabs, value, onChange, style }: {
  tabs: SectionTab<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.row, style]} accessibilityRole="tablist">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <Pressable
            key={t.value}
            onPress={() => onChange(t.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.count === undefined ? t.label : `${t.label}, ${t.count}`}
            hitSlop={{ top: 4, bottom: 4, left: 6, right: 6 }}
            style={styles.tab}
          >
            {(state) => {
              const { hovered, pressed } = state as Hover;
              const color = active ? Colors.ink : hovered || pressed ? Colors.flameText : Colors.textSecondary;
              return (
                <>
                  <View style={styles.labelRow}>
                    <TText variant="label" weight="bold" uppercase style={{ color, letterSpacing: 1.2 }}>
                      {t.label}
                    </TText>
                    {t.count !== undefined && (
                      <TText variant="label" tabular style={{ color: active ? Colors.flameText : Colors.textTertiary, letterSpacing: 0.4 }}>
                        {String(t.count).padStart(2, '0')}
                      </TText>
                    )}
                  </View>
                  <View style={[styles.marker, active && styles.markerActive]} />
                </>
              );
            }}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', flexWrap: 'wrap', columnGap: 28,
    borderBottomWidth: 1, borderBottomColor: Colors.ink,
  },
  tab: {
    minHeight: 44, justifyContent: 'flex-end',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
  },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  // Sits on the ink rule, so the active word reads as underlined in vermilion.
  marker: { height: 3, marginTop: 11, marginBottom: -1, backgroundColor: 'transparent' },
  markerActive: { backgroundColor: Colors.flame },
});
