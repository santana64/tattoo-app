import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ImageContentFit } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { RevealImage } from '@/components/motion';

type PlateTone = 'clay' | 'bone' | 'slate';
const PLATES = { clay: Gradients.plateClay, bone: Gradients.plateBone, slate: Gradients.plateSlate } as const;

interface WorkPlateProps {
  uri?: string | null;
  /** Cartel mark in the top-left corner: "N° 03", "Flash". */
  mark?: string;
  /** Skin-tone plate shown behind missing or loading artwork. */
  tone?: PlateTone;
  contentFit?: ImageContentFit;
  accessibilityLabel?: string;
  /** Size it from outside: `flex`, explicit height, or `absoluteFill`. */
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * `ArtCanvas` without an imposed aspect ratio, for grids whose cells are sized
 * by the layout (tall first image, stacked pairs, picture films). Square
 * corners, no overlay on the photograph, a skin-tone plate when there is no
 * image — never a stock picture.
 */
export function WorkPlate({ uri, mark, tone = 'clay', contentFit = 'cover', accessibilityLabel, style, children }: WorkPlateProps) {
  return (
    <View style={[styles.frame, style]}>
      <RevealImage
        uri={uri}
        contentFit={contentFit}
        style={StyleSheet.absoluteFill}
        accessibilityLabel={accessibilityLabel}
        fallback={<PlateFill tone={tone} />}
      />
      {mark ? <PlateMark label={mark} /> : null}
      {children}
    </View>
  );
}

/** The skin-tone gradient alone, for placeholders. */
export function PlateFill({ tone = 'clay' }: { tone?: PlateTone }) {
  return <LinearGradient colors={PLATES[tone]} start={{ x: 0.3, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />;
}

/** Paper cartel mark pinned to the top-left corner of a work. */
export function PlateMark({ label, tone = 'paper', style }: { label: string; tone?: 'paper' | 'ink'; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.mark, tone === 'ink' && styles.markInk, style]} pointerEvents="none">
      <TText
        variant="micro"
        weight="bold"
        uppercase
        numberOfLines={1}
        style={[styles.markText, { color: tone === 'ink' ? Colors.onInk : Colors.ink }]}
      >
        {label}
      </TText>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: Colors.clay, overflow: 'hidden' },
  mark: {
    position: 'absolute', top: 10, left: 10, maxWidth: '80%',
    paddingHorizontal: 7, paddingVertical: 4, backgroundColor: Colors.paper,
  },
  markInk: { backgroundColor: Colors.inkPanel },
  markText: { letterSpacing: 1.3, fontSize: 9 },
});
