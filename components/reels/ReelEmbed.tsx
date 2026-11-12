import React, { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { REEL_PROVIDER_LABEL, reelEmbedUrl, type ReelProvider } from '@/lib/reels';

interface ReelEmbedProps {
  provider: ReelProvider;
  /** Canonical page of the video on the provider's site (posts.media_url). */
  pageUrl: string;
  /** The reel currently on screen. Leaving it unloads the player, which stops playback. */
  active: boolean;
}

const PROVIDER_ICON: Record<ReelProvider, keyof typeof Ionicons.glyphMap> = {
  tiktok: 'logo-tiktok',
  instagram: 'logo-instagram',
};

/**
 * A reel hosted by TikTok or Instagram.
 *
 * Nothing is requested from the provider until the visitor asks to play the
 * video: their player sets cookies, so loading it is the visitor's choice
 * (two-click embed). On native there is no in-app web view: the video opens
 * in the provider's app or the browser.
 */
export function ReelEmbed({ provider, pageUrl, active }: ReelEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const name = REEL_PROVIDER_LABEL[provider];
  const embedUrl = reelEmbedUrl(provider, pageUrl);

  useEffect(() => {
    if (!active) setLoaded(false);
  }, [active]);

  const openOutside = () => {
    // Only a genuine provider address is ever opened.
    if (embedUrl) void Linking.openURL(pageUrl);
  };

  if (Platform.OS === 'web' && loaded && embedUrl) {
    return (
      <View style={styles.frame}>
        {React.createElement('iframe', {
          src: embedUrl,
          title: `Vidéo ${name}`,
          allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
          allowFullScreen: true,
          sandbox: 'allow-scripts allow-same-origin allow-popups allow-presentation',
          referrerPolicy: 'strict-origin-when-cross-origin',
          style: { border: 0, width: '100%', height: '100%', backgroundColor: Colors.inkPanel },
        })}
      </View>
    );
  }

  const canPlayHere = Platform.OS === 'web' && !!embedUrl;
  return (
    <View style={styles.notice}>
      <View style={styles.ring}>
        <Ionicons name={PROVIDER_ICON[provider]} size={26} color={Colors.flameOnInk} />
      </View>
      <TText variant="displayS" color="onInk" style={styles.title}>Vidéo publiée sur {name}</TText>
      <TText variant="bodySmall" color="onInkMuted" style={styles.text}>
        {canPlayHere
          ? `La lecture charge le lecteur de ${name}, qui peut déposer des cookies sur votre appareil.`
          : `Cette vidéo s’ouvre dans ${name}.`}
      </TText>
      <View style={styles.actions}>
        {canPlayHere && (
          <TButton title="Lire la vidéo" variant="glass" size="md" fullWidth={false} onPress={() => setLoaded(true)} />
        )}
        {!!embedUrl && (
          <TButton
            title={`Ouvrir sur ${name}`}
            variant={canPlayHere ? 'inverse' : 'glass'}
            size="md"
            fullWidth={false}
            onPress={openOutside}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  notice: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, backgroundColor: Colors.inkPanel },
  ring: {
    width: 64, height: 64, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.onInkLine,
  },
  title: { marginTop: Spacing.md, textAlign: 'center' },
  text: { marginTop: Spacing['2xs'], textAlign: 'center', maxWidth: 320 },
  actions: { marginTop: Spacing.lg, gap: 10, alignItems: 'center' },
});
