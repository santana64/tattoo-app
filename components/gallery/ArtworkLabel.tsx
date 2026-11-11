import React from 'react';
import { View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { PressableScale } from '@/components/motion';
import { styleName } from '@/components/ArtistCard';
import { artworkLabel } from '@/lib/studio';

export type ArtworkLabelPost = Parameters<typeof artworkLabel>[0];

interface ArtworkLabelProps {
  post: ArtworkLabelPost;
  artistName: string;
  onPressArtist?: () => void;
}

/**
 * The museum wall label ("cartel") of a piece: artist in gold small caps,
 * the title in serif italic, then medium / placement / session / year.
 * Read by assistive technologies as a single summary.
 */
export function ArtworkLabel({ post, artistName, onPressArtist }: ArtworkLabelProps) {
  const { title, lines } = artworkLabel(post, styleName);
  const summary = [artistName, title, ...lines].join(', ');

  const content = (
    <>
      <View style={styles.artistRow}>
        <TText variant="label" color="accentWarm" uppercase numberOfLines={1} style={styles.artist}>
          {artistName}
        </TText>
        {onPressArtist && <Ionicons name="arrow-forward" size={11} color={Colors.accentWarm} />}
      </View>
      <TText variant="title1" serif italic style={styles.title}>{title}</TText>
      {lines.length > 0 && (
        <TText variant="caption" color="secondary" style={styles.lines}>
          {lines.map((line, i) => (
            <React.Fragment key={`${i}-${line}`}>
              {i > 0 && <TText variant="caption" color="tertiary">{'  ·  '}</TText>}
              {line}
            </React.Fragment>
          ))}
        </TText>
      )}
    </>
  );

  if (onPressArtist) {
    return (
      <PressableScale
        onPress={onPressArtist}
        pressedScale={0.99}
        accessibilityRole="link"
        accessibilityLabel={summary}
        accessibilityHint={`Ouvre le profil de ${artistName}`}
        style={styles.label}
      >
        {content}
      </PressableScale>
    );
  }

  return (
    <View style={styles.label} accessible accessibilityRole="text" accessibilityLabel={summary}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  // A thin gold rule on the left edge, like the brass strip of a wall label.
  label: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.accentWarm,
    paddingLeft: Spacing.sm,
    paddingVertical: 2,
    alignSelf: 'stretch',
  },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  artist: { flexShrink: 1 },
  title: { fontSize: 24, lineHeight: 29, letterSpacing: -0.2, marginTop: 6 },
  lines: { marginTop: 6, lineHeight: 19 },
});
