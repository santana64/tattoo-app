import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Toast } from '@/components/ui/TToast';
import { useAuthStore } from '@/store/auth-store';
import { isOnWaitlist, setWaitlist } from '@/lib/studio';

interface WaitlistButtonProps {
  artistId: string;
  /** On an ink panel: paper fill to join, hairline once joined. */
  onInk?: boolean;
  style?: StyleProp<ViewStyle>;
}

type Interaction = { pressed: boolean; hovered?: boolean };

const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '200ms' } as object)
  : null;

/** For a closed book: ask to be told, once, when the artist takes projects again. */
export function WaitlistButton({ artistId, onInk = false, style }: WaitlistButtonProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  // null while the current answer is unknown (signed-in users only).
  const [joined, setJoined] = useState<boolean | null>(user ? null : false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!user?.id) { setJoined(false); return; }
    let active = true;
    setJoined(null);
    isOnWaitlist(user.id, artistId)
      .then((value) => { if (active) setJoined(value); })
      .catch(() => { if (active) setJoined(false); });
    return () => { active = false; };
  }, [artistId, user?.id]);

  const handlePress = useCallback(async () => {
    if (!user) {
      router.push({ pathname: '/(auth)/sign-in', params: { next: `/artist/${artistId}` } });
      return;
    }
    if (joined === null || pending) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const join = !joined;
    setPending(true);
    setJoined(join);
    const saved = await setWaitlist(artistId, join).catch(() => false);
    setPending(false);
    if (!saved) {
      setJoined(!join);
      Toast.error('Votre demande n’a pas été enregistrée. Réessayez.');
      return;
    }
    if (join) Toast.success('Nous vous préviendrons dès que l’artiste reprend des projets.');
    else Toast.info('Vous ne serez plus prévenu de la réouverture.');
  }, [artistId, joined, pending, router, user]);

  // An artist does not wait for their own book.
  if (user?.artistId && user.artistId === artistId) return null;

  const checking = joined === null;
  const on = joined === true;
  const inactive = checking || pending;
  // Joining is the main action of a closed profile: filled. Joined: a quiet hairline.
  const box = onInk
    ? (on ? { backgroundColor: 'transparent', borderColor: Colors.onInkLine } : { backgroundColor: Colors.paper, borderColor: Colors.paper })
    : (on ? { backgroundColor: 'transparent', borderColor: Colors.line } : { backgroundColor: Colors.ink, borderColor: Colors.ink });
  const label = onInk ? (on ? Colors.onInk : Colors.ink) : (on ? Colors.ink : Colors.paper);
  const mark = on ? (onInk ? Colors.flameOnInk : Colors.flameText) : label;

  return (
    <Pressable
      onPress={() => { void handlePress(); }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={on ? 'Vous serez prévenu à la réouverture' : 'Me prévenir à la réouverture'}
      accessibilityHint={on ? 'Appuyez pour ne plus être prévenu.' : 'Vous recevrez une notification quand l’artiste reprendra des projets.'}
      accessibilityState={{ selected: on, busy: inactive, disabled: checking }}
      style={(state) => {
        const { hovered, pressed } = state as Interaction;
        return [styles.base, box, webPointer, (hovered || pressed) && !inactive && styles.lit, style];
      }}
    >
      {(state) => {
        const { hovered, pressed } = state as Interaction;
        const lit = (hovered || pressed) && !inactive;
        const color = lit ? '#FFFFFF' : label;
        return (
          <View style={styles.inner}>
            {checking ? (
              <ActivityIndicator size="small" color={onInk ? Colors.onInkMuted : Colors.textTertiary} />
            ) : (
              <Ionicons name={on ? 'checkmark' : 'notifications-outline'} size={16} color={lit ? color : mark} />
            )}
            <TText
              variant="label"
              weight="bold"
              uppercase
              numberOfLines={1}
              style={[styles.label, { color }, checking && styles.labelMuted]}
            >
              {on ? 'Vous serez prévenu' : 'Me prévenir à la réouverture'}
            </TText>
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  lit: { backgroundColor: Colors.flame, borderColor: Colors.flame },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '100%' },
  label: { fontSize: 11, letterSpacing: 0.8, lineHeight: 16, flexShrink: 1 },
  labelMuted: { opacity: 0.6 },
});
