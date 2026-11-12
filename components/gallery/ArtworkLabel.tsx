import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { styleName } from '@/components/ArtistCard';
import { artworkLabel } from '@/lib/studio';

export type ArtworkLabelPost = Parameters<typeof artworkLabel>[0];

interface ArtworkLabelProps {
  post: ArtworkLabelPost;
  artistName: string;
  onPressArtist?: () => void;
}

type Interaction = { pressed: boolean; hovered?: boolean };

/**
 * The museum wall label ("cartel") of a piece: artist in vermilion small caps,
 * the title in serif italic, then medium / placement / session / year.
 * Read by assistive technologies as a single summary.
 */
export function ArtworkLabel({ post, artistName, onPressArtist }: ArtworkLabelProps) {
  const { title, lines } = artworkLabel(post, styleName);
  const summary = [artistName, title, ...lines].join(', ');

  const content = (lit: boolean) => (
    <>
      <View style={styles.artistRow}>
        <TText variant="label" weight="bold" uppercase numberOfLines={1} style={[styles.artist, lit && styles.artistLit]}>
          {artistName}
        </TText>
        {onPressArtist && <Ionicons name="arrow-forward" size={11} color={lit ? Colors.ink : Colors.flameText} />}
      </View>
      <TText variant="displayS" italic style={styles.title}>{title}</TText>
      {lines.length > 0 && (
        <TText variant="caption" color="secondary" style={styles.lines}>
          {lines.map((line, i) => (
            <React.Fragment key={`${i}-${line}`}>
              {i > 0 && <TText variant="caption" color="tertiary">{'  /  '}</TText>}
              {line}
            </React.Fragment>
          ))}
        </TText>
      )}
    </>
  );

  if (onPressArtist) {
    return (
      <Pressable
        onPress={onPressArtist}
        accessibilityRole="link"
        accessibilityLabel={summary}
        accessibilityHint={`Ouvre le profil de ${artistName}`}
        style={[styles.label, Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null]}
      >
        {(state) => {
          const { hovered, pressed } = state as Interaction;
          return content(!!(hovered || pressed));
        }}
      </Pressable>
    );
  }

  return (
    <View style={styles.label} accessible accessibilityRole="text" accessibilityLabel={summary}>
      {content(false)}
    </View>
  );
}

const styles = StyleSheet.create({
  // A vermilion rule on the left edge, like the strip of a wall label.
  label: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.flame,
    paddingLeft: Spacing.sm,
    paddingVertical: 2,
    alignSelf: 'stretch',
  },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 18 },
  artist: { flexShrink: 1, color: Colors.flameText },
  artistLit: { color: Colors.ink },
  title: { fontSize: 28, lineHeight: 30, letterSpacing: -0.6, marginTop: 8, color: Colors.ink },
  lines: { marginTop: 8, lineHeight: 19 },
});
