import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Colors, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Toast } from '@/components/ui/TToast';
import { PressableScale } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import { useFollowStore } from '@/store/follow-store';

interface FollowButtonProps {
  artistId: string;
  artistName: string;
  size?: 'sm' | 'md';
  onChange?(following: boolean): void;
}

const HEIGHT = { sm: 34, md: 42 } as const;
const MIN_WIDTH = { sm: 84, md: 104 } as const;
const PAD_X = { sm: 12, md: 16 } as const;

export function FollowButton({ artistId, artistName, size = 'md', onChange }: FollowButtonProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const fetchFollowed = useFollowStore((s) => s.fetchFollowed);
  const toggle = useFollowStore((s) => s.toggle);
  const following = useFollowStore((s) => s.followedIds.has(artistId));
  const pending = useFollowStore((s) => s.pendingIds.has(artistId));

  useEffect(() => { void fetchFollowed(user?.id); }, [fetchFollowed, user?.id]);

  const handlePress = useCallback(async () => {
    if (!user) {
      router.push({ pathname: '/(auth)/sign-in', params: { next: `/artist/${artistId}` } });
      return;
    }
    const next = !following;
    if (await toggle(user.id, artistId)) onChange?.(next);
    else Toast.error(next ? `Impossible de suivre ${artistName}. Réessayez.` : 'Désabonnement impossible. Réessayez.');
  }, [artistId, artistName, following, onChange, router, toggle, user]);

  // An artist does not follow their own page.
  if (user?.artistId && user.artistId === artistId) return null;

  const iconSize = size === 'sm' ? 13 : 15;
  return (
    <PressableScale
      onPress={handlePress}
      haptic
      disabled={pending}
      accessibilityRole="button"
      accessibilityLabel={following ? `Vous suivez ${artistName}` : `Suivre ${artistName}`}
      accessibilityHint={following ? 'Appuyez pour ne plus suivre cet artiste.' : undefined}
      accessibilityState={{ selected: following, busy: pending }}
      hitSlop={size === 'sm' ? 6 : 2}
      style={[
        styles.base,
        { height: HEIGHT[size], minWidth: MIN_WIDTH[size], paddingHorizontal: PAD_X[size] },
        following ? styles.following : styles.idle,
      ]}
    >
      <View style={styles.inner}>
        {following && <Ionicons name="checkmark" size={iconSize} color={Colors.accentGlow} />}
        <TText
          variant={size === 'sm' ? 'caption' : 'bodySmall'}
          weight="semibold"
          numberOfLines={1}
          style={[styles.label, { fontSize: size === 'sm' ? 13 : 14, color: following ? Colors.textPrimary : Colors.textInverse }]}
        >
          {following ? 'Suivi' : 'Suivre'}
        </TText>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  idle: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },
  following: { backgroundColor: 'transparent', borderColor: Colors.borderDefault },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { letterSpacing: -0.1 },
});
