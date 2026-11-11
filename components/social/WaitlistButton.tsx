import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Colors, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Toast } from '@/components/ui/TToast';
import { PressableScale } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import { isOnWaitlist, setWaitlist } from '@/lib/studio';

interface WaitlistButtonProps {
  artistId: string;
}

/** For a closed book: ask to be told, once, when the artist takes projects again. */
export function WaitlistButton({ artistId }: WaitlistButtonProps) {
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
  return (
    <PressableScale
      onPress={handlePress}
      haptic
      disabled={checking || pending}
      accessibilityRole="button"
      accessibilityLabel={on ? 'Vous serez prévenu à la réouverture' : 'Me prévenir à la réouverture'}
      accessibilityHint={on ? 'Appuyez pour ne plus être prévenu.' : 'Vous recevrez une notification quand l’artiste reprendra des projets.'}
      accessibilityState={{ selected: on, busy: checking || pending, disabled: checking }}
      style={[styles.base, on ? styles.on : styles.off]}
    >
      <View style={styles.inner}>
        {checking ? (
          <ActivityIndicator size="small" color={Colors.textTertiary} />
        ) : (
          <Ionicons
            name={on ? 'checkmark' : 'notifications-outline'}
            size={16}
            color={on ? Colors.accentGlow : Colors.textPrimary}
          />
        )}
        <TText variant="bodySmall" weight="semibold" numberOfLines={1} style={[styles.label, checking && styles.labelMuted]}>
          {on ? 'Vous serez prévenu' : 'Me prévenir à la réouverture'}
        </TText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 46, paddingHorizontal: 18, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  off: { backgroundColor: Colors.glassBgMid, borderColor: Colors.borderDefault },
  on: { backgroundColor: 'transparent', borderColor: Colors.borderGlow },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 14, letterSpacing: -0.1, flexShrink: 1 },
  labelMuted: { color: Colors.textSecondary },
});
