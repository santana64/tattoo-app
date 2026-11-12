import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { useAuthStore } from '@/store/auth-store';
import { ContactArtistSheet } from './ContactArtistSheet';

interface ContactArtistButtonProps {
  artistId: string;
  artistName: string;
  /** "icon": a square 44 px control; "button": an outlined "Écrire" button (default). */
  variant?: 'icon' | 'button';
  /** On an ink panel: paper hairline and label. */
  onInk?: boolean;
  style?: StyleProp<ViewStyle>;
}

type Interaction = { pressed: boolean; hovered?: boolean };

const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '200ms' } as object)
  : null;

/** "Écrire" to an artist without a project. Hidden on the artist's own page. */
export function ContactArtistButton({ artistId, artistName, variant = 'button', onInk = false, style }: ContactArtistButtonProps) {
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

  const icon = variant === 'icon';
  const rest = onInk ? Colors.onInk : Colors.ink;
  const border = icon
    ? (onInk ? Colors.onInkLine : Colors.line)
    : (onInk ? Colors.onInk : Colors.ink);

  return (
    <>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Écrire à ${artistName}`}
        accessibilityHint="Posez une question sans envoyer de projet."
        style={(state) => {
          const { hovered, pressed } = state as Interaction;
          return [
            icon ? styles.icon : styles.button,
            { borderColor: border },
            webPointer,
            (hovered || pressed) && styles.lit,
            style,
          ];
        }}
      >
        {(state) => {
          const { hovered, pressed } = state as Interaction;
          const color = hovered || pressed ? '#FFFFFF' : rest;
          return icon ? (
            <Ionicons name="chatbubble-outline" size={18} color={color} />
          ) : (
            <View style={styles.inner}>
              <Ionicons name="chatbubble-outline" size={15} color={color} />
              <TText variant="label" weight="bold" uppercase numberOfLines={1} style={[styles.label, { color }]}>
                Écrire
              </TText>
            </View>
          );
        }}
      </Pressable>
      {!!user && (
        <ContactArtistSheet visible={open} onClose={close} artistId={artistId} artistName={artistName} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  button: {
    minHeight: 46, minWidth: 112, paddingHorizontal: 18,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  lit: { backgroundColor: Colors.flame, borderColor: Colors.flame },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 11, letterSpacing: 0.8, lineHeight: 16 },
});
