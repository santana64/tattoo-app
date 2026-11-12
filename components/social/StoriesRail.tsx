import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { PressableScale } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import { fetchActiveStories, type StoryGroup } from '@/lib/care';
import { useSeenStories } from './story-seen';
import { StoryViewer } from './StoryViewer';

interface StoriesRailProps {
  /** Only these artists' stories (e.g. the followed ones). Omitted: every active story. */
  artistIds?: string[];
  /** Lets an artist start a new story from the first tile. */
  showAdd?: boolean;
}

const RING = 72;
const TILE_W = 78;

function StoryRing({ uri, name, seen, empty }: { uri: string | null; name: string; seen: boolean; empty?: boolean }) {
  return (
    <View style={[styles.ring, empty ? styles.ringEmpty : seen ? styles.ringSeen : styles.ringFresh]}>
      <TAvatar uri={uri} name={name} size="xl" />
    </View>
  );
}

/**
 * A row of square portrait plates, one per artist with a live story. Vermilion
 * frame: not seen yet; hairline frame: seen on this device. Designed to sit inside a column
 * padded by the layout gutter (it bleeds to the screen edges).
 */
export function StoriesRail({ artistIds, showAdd = false }: StoriesRailProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const seen = useSeenStories();
  const [groups, setGroups] = useState<StoryGroup[] | null>(null);
  const [viewer, setViewer] = useState<{ key: number; start: number; open: boolean } | null>(null);

  const idsKey = artistIds ? [...artistIds].sort().join(',') : null;
  const myArtistId = user?.role === 'artist' ? user.artistId ?? null : null;
  const canAdd = showAdd && !!myArtistId;

  const load = useCallback(async () => {
    try {
      const next = await fetchActiveStories(idsKey === null ? undefined : idsKey ? idsKey.split(',') : []);
      setGroups(next);
    } catch {
      // Stories decorate the feed: on failure keep whatever is shown.
    }
  }, [idsKey]);

  // Stories expire within the day: refresh each time the screen comes back.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const isSeen = useCallback((g: StoryGroup) => g.stories.every((s) => seen.has(s.id)), [seen]);

  // The viewer's own stories lead; then unseen artists, then the ones already watched.
  const { own, others } = useMemo(() => {
    const list = groups ?? [];
    const mine = myArtistId ? list.find((g) => g.artistId === myArtistId) ?? null : null;
    const rest = list.filter((g) => g !== mine);
    return { own: mine, others: [...rest.filter((g) => !isSeen(g)), ...rest.filter(isSeen)] };
  }, [groups, myArtistId, isSeen]);

  const ordered = useMemo(() => (own ? [own, ...others] : others), [own, others]);

  const openAt = useCallback((index: number) => {
    setViewer((v) => ({ key: (v?.key ?? 0) + 1, start: index, open: true }));
  }, []);

  const closeViewer = useCallback(() => {
    setViewer((v) => (v ? { ...v, open: false } : v));
    void load();
  }, [load]);

  const newStory = useCallback(() => router.push('/story/new'), [router]);

  if (others.length === 0 && !canAdd && !own) return null;

  return (
    <View style={styles.section}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
        contentContainerStyle={styles.rail}
        accessibilityLabel="Stories"
      >
        {(canAdd || own) && (
          <View style={styles.tile}>
            <PressableScale
              onPress={own ? () => openAt(0) : newStory}
              accessibilityRole="button"
              accessibilityLabel={own ? 'Voir votre story' : 'Publier une story'}
              style={styles.tileInner}
            >
              <StoryRing
                uri={own?.avatarUrl ?? user?.avatarUrl ?? null}
                name={user?.artistBlaze ?? user?.displayName ?? 'Vous'}
                seen={own ? isSeen(own) : false}
                empty={!own}
              />
              <TText variant="caption" weight="medium" numberOfLines={1} style={styles.name}>Votre story</TText>
            </PressableScale>
            {canAdd && (
              <Pressable
                onPress={newStory}
                accessibilityRole="button"
                accessibilityLabel="Nouvelle story"
                hitSlop={10}
                style={({ pressed }) => [styles.add, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        )}

        {others.map((g) => {
          const watched = isSeen(g);
          const index = ordered.indexOf(g);
          return (
            <View key={g.artistId} style={styles.tile}>
              <PressableScale
                onPress={() => openAt(index)}
                accessibilityRole="button"
                accessibilityLabel={`Story de ${g.blaze}${watched ? ', déjà vue' : ', nouvelle'}`}
                style={styles.tileInner}
              >
                <StoryRing uri={g.avatarUrl} name={g.blaze} seen={watched} />
                <TText
                  variant="caption"
                  weight={watched ? 'regular' : 'medium'}
                  color={watched ? 'tertiary' : 'primary'}
                  numberOfLines={1}
                  style={styles.name}
                >
                  {g.blaze}
                </TText>
              </PressableScale>
            </View>
          );
        })}
      </ScrollView>

      {viewer && ordered.length > 0 && (
        <StoryViewer
          key={viewer.key}
          groups={ordered}
          startIndex={viewer.start}
          visible={viewer.open}
          onClose={closeViewer}
          onChanged={() => { void load(); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing.md },
  scroller: { marginHorizontal: -Layout.gutter, flexGrow: 0 },
  rail: { gap: Spacing['2xs'], paddingHorizontal: Layout.gutter, paddingVertical: Spacing['2xs'] },
  tile: { width: TILE_W, alignItems: 'center' },
  tileInner: { alignItems: 'center', width: TILE_W },
  ring: {
    width: RING, height: RING,
    alignItems: 'center', justifyContent: 'center',
  },
  ringFresh: { borderWidth: 2, borderColor: Colors.flame },
  ringSeen: { borderWidth: 1, borderColor: Colors.line },
  ringEmpty: { borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.ink },
  name: { marginTop: 6, maxWidth: TILE_W - 2, textAlign: 'center' },
  add: {
    position: 'absolute', top: RING - 22, right: (TILE_W - RING) / 2 - 2,
    width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.flame,
    borderWidth: 2, borderColor: Colors.paper,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
});
