import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Colors, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { PressableScale } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import { ContactArtistSheet } from './ContactArtistSheet';

interface ContactArtistButtonProps {
  artistId: string;
  artistName: string;
  /** "icon": a round 42 px button; "button": an outlined "Écrire" button (default). */
  variant?: 'icon' | 'button';
}

/** "Écrire" to an artist without a project. Hidden on the artist's own page. */
export function ContactArtistButton({ artistId, artistName, variant = 'button' }: ContactArtistButtonProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);

  const handlePress = useCallback(() => {
    if (!user) {
      router.push({ pathname: '/(auth)/sign-in', params: { next: `/artist/${artistId}` } });
      return;
    }
    setOpen(true);
  }, [artistId, router, user]);

  const close = useCallback(() => setOpen(false), []);

  if (user?.artistId && user.artistId === artistId) return null;

  return (
    <>
      <PressableScale
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Écrire à ${artistName}`}
        accessibilityHint="Posez une question sans envoyer de projet."
        hitSlop={variant === 'icon' ? 4 : 2}
        pressedScale={variant === 'icon' ? 0.92 : 0.97}
        style={variant === 'icon' ? styles.icon : styles.button}
      >
        {variant === 'icon' ? (
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.textPrimary} />
        ) : (
          <View style={styles.inner}>
            <Ionicons name="chatbubble-ellipses-outline" size={15} color={Colors.textPrimary} />
            <TText variant="bodySmall" weight="semibold" numberOfLines={1} style={styles.label}>Écrire</TText>
          </View>
        )}
      </PressableScale>
      {!!user && (
        <ContactArtistSheet visible={open} onClose={close} artistId={artistId} artistName={artistName} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  button: {
    height: 42, minWidth: 104, paddingHorizontal: 16,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderDefault,
    alignItems: 'center', justifyContent: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 14, letterSpacing: -0.1 },
});
