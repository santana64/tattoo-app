import React, { useCallback, useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { Toast } from '@/components/ui/TToast';
import { useAuthStore } from '@/store/auth-store';
import { useFollowStore } from '@/store/follow-store';

interface FollowButtonProps {
  artistId: string;
  artistName: string;
  size?: 'sm' | 'md';
  /** On an ink panel: paper outline instead of an ink fill. */
  onInk?: boolean;
  style?: StyleProp<ViewStyle>;
  onChange?(following: boolean): void;
}

type Interaction = { pressed: boolean; hovered?: boolean };

const HEIGHT = { sm: 36, md: 46 } as const;
const MIN_WIDTH = { sm: 88, md: 112 } as const;
const PAD_X = { sm: 12, md: 18 } as const;
const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '200ms' } as object)
  : null;

/**
 * Square, tracked-capitals follow control. On paper: ink fill to follow, hairline
 * once followed. On ink: paper outline to follow, quiet hairline once followed.
 */
export function FollowButton({ artistId, artistName, size = 'md', onInk = false, style, onChange }: FollowButtonProps) {
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
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !following;
    if (await toggle(user.id, artistId)) onChange?.(next);
    else Toast.error(next ? `Impossible de suivre ${artistName}. Réessayez.` : 'Désabonnement impossible. Réessayez.');
  }, [artistId, artistName, following, onChange, router, toggle, user]);

  // An artist does not follow their own page.
  if (user?.artistId && user.artistId === artistId) return null;

  const tone = onInk ? (following ? ink.following : ink.idle) : (following ? paper.following : paper.idle);
  return (
    <Pressable
      onPress={() => { void handlePress(); }}
      disabled={pending}
      accessibilityRole="button"
      accessibilityLabel={following ? `Vous suivez ${artistName}` : `Suivre ${artistName}`}
      accessibilityHint={following ? 'Appuyez pour ne plus suivre cet artiste.' : undefined}
      accessibilityState={{ selected: following, busy: pending }}
      hitSlop={size === 'sm' ? 4 : 0}
      style={(state) => {
        const { hovered, pressed } = state as Interaction;
        return [
          styles.base,
          { minHeight: HEIGHT[size], minWidth: MIN_WIDTH[size], paddingHorizontal: PAD_X[size] },
          tone.box,
          webPointer,
          (hovered || pressed) && !pending && styles.lit,
          style,
        ];
      }}
    >
      {(state) => {
        const { hovered, pressed } = state as Interaction;
        const lit = (hovered || pressed) && !pending;
        const color = lit ? '#FFFFFF' : tone.label;
        return (
          <View style={styles.inner}>
            {following && <Ionicons name="checkmark" size={size === 'sm' ? 13 : 15} color={lit ? color : tone.mark} />}
            <TText
              variant="label"
              weight="bold"
              uppercase
              numberOfLines={1}
              style={{ color, fontSize: size === 'sm' ? 10 : 11, letterSpacing: 0.8, lineHeight: 16 }}
            >
              {following ? 'Suivi' : 'Suivre'}
            </TText>
          </View>
        );
      }}
    </Pressable>
  );
}

const paper = {
  idle: { box: { backgroundColor: Colors.ink, borderColor: Colors.ink }, label: Colors.paper, mark: Colors.paper },
  following: { box: { backgroundColor: 'transparent', borderColor: Colors.line }, label: Colors.ink, mark: Colors.flameText },
};
const ink = {
  idle: { box: { backgroundColor: 'transparent', borderColor: Colors.onInk }, label: Colors.onInk, mark: Colors.onInk },
  following: { box: { backgroundColor: 'transparent', borderColor: Colors.onInkLine }, label: Colors.onInk, mark: Colors.flameOnInk },
};

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  lit: { backgroundColor: Colors.flame, borderColor: Colors.flame },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
