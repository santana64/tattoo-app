import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TButton } from '@/components/ui/TButton';
import { Toast } from '@/components/ui/TToast';
import { BottomSheet } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import { deleteStory, recordStoryView, storyAge, type StoryGroup } from '@/lib/care';
import { markStorySeen } from './story-seen';

const STORY_MS = 5000;
const STAGE_RATIO = 9 / 16;
/** Taps on the left 30 % go back, anywhere else goes forward. */
const BACK_ZONE_WIDTH = '30%';
const NEXT_ZONE_WIDTH = '70%';

/** Mount with a new `key` for each opening: the viewer starts from its props. */
interface StoryViewerProps {
  groups: StoryGroup[];
  /** Index in `groups` of the artist to open first. */
  startIndex: number;
  visible: boolean;
  onClose(): void;
  /** Called after the owner deleted one of their stories. */
  onChanged?(): void;
}

/** One story picture: the work shown whole over a blurred, darkened copy of itself. */
export function StoryMedia({ uri, label, onLoad, onError }: {
  uri: string; label: string; onLoad?: () => void; onError?: () => void;
}) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} cachePolicy="memory-disk" accessible={false} />
      <View style={[StyleSheet.absoluteFill, styles.dim]} />
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        cachePolicy="memory-disk"
        accessibilityLabel={label}
        onLoad={onLoad}
        onError={onError}
      />
    </View>
  );
}

function Segment({ state, progress, reduced }: {
  state: 'done' | 'current' | 'upcoming'; progress: SharedValue<number>; reduced: boolean;
}) {
  const fill = useAnimatedStyle(() => {
    const ratio = state === 'done' || (state === 'current' && reduced) ? 1 : state === 'current' ? progress.get() : 0;
    return { width: `${ratio * 100}%` as `${number}%` };
  });
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, fill]} />
    </View>
  );
}

const viewsLabel = (n: number) => `${n.toLocaleString('fr-FR')} vue${n > 1 ? 's' : ''}`;

/**
 * Full-screen story viewer. Each story stays 5 s (paused while a finger rests
 * on it); tapping right moves on, tapping left goes back; the next artist
 * follows the last story, and the viewer closes after the last artist.
 */
export function StoryViewer({ groups, startIndex, visible, onClose, onChanged }: StoryViewerProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const user = useAuthStore((s) => s.user);

  // A local copy: deleting a story must not wait for the rail to refetch.
  const [items, setItems] = useState<StoryGroup[]>(groups);
  const [pos, setPos] = useState(() => ({ g: Math.min(Math.max(startIndex, 0), Math.max(groups.length - 1, 0)), s: 0 }));
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [pressing, setPressing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restart, setRestart] = useState(0);

  const progress = useSharedValue(0);
  const elapsed = useRef(0);
  const viewed = useRef(new Set<string>());

  const group = items[pos.g];
  const story = group?.stories[pos.s];
  const isOwner = !!user?.artistId && group?.artistId === user.artistId;
  const ready = !!story && (loadedId === story.id || failedId === story.id);
  const paused = pressing || confirmDelete || deleting;

  const advance = useCallback(() => {
    const current = items[pos.g];
    if (current && pos.s < current.stories.length - 1) setPos({ g: pos.g, s: pos.s + 1 });
    else if (pos.g < items.length - 1) setPos({ g: pos.g + 1, s: 0 });
    else onClose();
  }, [items, pos, onClose]);

  const back = useCallback(() => {
    if (pos.s > 0) setPos({ g: pos.g, s: pos.s - 1 });
    else if (pos.g > 0) setPos({ g: pos.g - 1, s: Math.max((items[pos.g - 1]?.stories.length ?? 1) - 1, 0) });
    else setRestart((n) => n + 1);
  }, [items, pos]);

  // The timer reads the latest navigation without restarting on every render.
  const advanceRef = useRef(advance);
  useEffect(() => { advanceRef.current = advance; }, [advance]);

  // A new story (or a restart) starts from zero. Runs after the timer cleanup below.
  useEffect(() => {
    elapsed.current = 0;
    cancelAnimation(progress);
    progress.set(0);
  }, [story?.id, restart, progress]);

  // Seen and counted once it is on screen.
  useEffect(() => {
    if (!visible || !story) return;
    markStorySeen(story.id);
    if (user && !isOwner && !viewed.current.has(story.id)) {
      viewed.current.add(story.id);
      recordStoryView(story.id);
    }
  }, [visible, story, user, isOwner]);

  // Prefetch the next picture so the move is instant.
  useEffect(() => {
    if (!visible || !group) return;
    const next = group.stories[pos.s + 1] ?? items[pos.g + 1]?.stories[0];
    if (next) void Image.prefetch(next.media_url).catch(() => {});
  }, [visible, group, items, pos]);

  // The clock: runs while the picture is shown and nothing holds it.
  useEffect(() => {
    if (!visible || !ready || paused || !story) return;
    const startedAt = Date.now();
    const remaining = Math.max(STORY_MS - elapsed.current, 0);
    const timer = setTimeout(() => advanceRef.current(), remaining);
    if (!reduced) progress.set(withTiming(1, { duration: remaining, easing: Easing.linear }));
    return () => {
      clearTimeout(timer);
      cancelAnimation(progress);
      elapsed.current += Date.now() - startedAt;
    };
  }, [visible, ready, paused, story, reduced, progress, restart]);

  const close = useCallback(() => {
    if (confirmDelete) { setConfirmDelete(false); return; }
    onClose();
  }, [confirmDelete, onClose]);

  // Keyboard on the web: arrows move, Escape closes.
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); if (!confirmDelete) advance(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (!confirmDelete) back(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, advance, back, close, confirmDelete]);

  const openArtist = useCallback(() => {
    if (!group) return;
    onClose();
    router.push(`/artist/${group.artistId}`);
  }, [group, onClose, router]);

  const handleDelete = useCallback(async () => {
    if (!story || deleting) return;
    setDeleting(true);
    const ok = await deleteStory(story.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (!ok) { Toast.error('Suppression impossible. Réessayez.'); return; }
    Toast.success('Story supprimée');
    onChanged?.();
    const remaining = items
      .map((g, i) => (i === pos.g ? { ...g, stories: g.stories.filter((s) => s.id !== story.id) } : g))
      .filter((g) => g.stories.length > 0);
    if (remaining.length === 0) { onClose(); return; }
    const stillHere = remaining.findIndex((g) => g.artistId === group?.artistId);
    setItems(remaining);
    if (stillHere >= 0) {
      setPos({ g: stillHere, s: Math.min(pos.s, remaining[stillHere].stories.length - 1) });
    } else {
      setPos({ g: Math.min(pos.g, remaining.length - 1), s: 0 });
    }
  }, [deleting, group?.artistId, items, onChanged, onClose, pos, story]);

  const stageWidth = Math.min(width, Math.round(height * STAGE_RATIO));
  const segments = useMemo(() => group?.stories ?? [], [group]);

  return (
    <Modal
      visible={visible}
      animationType={reduced ? 'none' : 'fade'}
      onRequestClose={close}
      statusBarTranslucent
      supportedOrientations={['portrait']}
    >
      <GestureHandlerRootView style={styles.root}>
        {group && story ? (
          <View style={[styles.stage, { width: stageWidth }]}>
            <StoryMedia
              key={story.id}
              uri={story.media_url}
              label={story.caption ? `Story de ${group.blaze} : ${story.caption}` : `Story de ${group.blaze}`}
              onLoad={() => setLoadedId(story.id)}
              onError={() => setFailedId(story.id)}
            />
            {failedId === story.id && (
              <View style={[StyleSheet.absoluteFill, styles.failed]} pointerEvents="none">
                <Ionicons name="image-outline" size={26} color={Colors.textTertiary} />
                <TText variant="caption" color="tertiary">Image indisponible</TText>
              </View>
            )}

            {/* Tap zones: hold to pause, tap to move. */}
            <View style={StyleSheet.absoluteFill}>
              <Pressable
                style={[styles.zone, { left: 0, width: BACK_ZONE_WIDTH }]}
                onPress={back}
                onLongPress={() => {}}
                delayLongPress={220}
                onPressIn={() => setPressing(true)}
                onPressOut={() => setPressing(false)}
                accessibilityRole="button"
                accessibilityLabel="Story précédente"
              />
              <Pressable
                style={[styles.zone, { right: 0, width: NEXT_ZONE_WIDTH }]}
                onPress={advance}
                onLongPress={() => {}}
                delayLongPress={220}
                onPressIn={() => setPressing(true)}
                onPressOut={() => setPressing(false)}
                accessibilityRole="button"
                accessibilityLabel="Story suivante"
                accessibilityHint="Maintenez pour mettre en pause."
              />
            </View>

            {/* Top: progress and header */}
            <LinearGradient
              colors={['rgba(7,6,5,0.6)', 'rgba(7,6,5,0)']}
              style={[styles.topShade, { height: insets.top + 110 }]}
              pointerEvents="none"
            />
            <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
              <View
                style={styles.segments}
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={`Story ${pos.s + 1} sur ${segments.length}`}
              >
                {segments.map((s, i) => (
                  <Segment
                    key={s.id}
                    state={i < pos.s ? 'done' : i === pos.s ? 'current' : 'upcoming'}
                    progress={progress}
                    reduced={reduced}
                  />
                ))}
              </View>
              <View style={styles.header}>
                <Pressable
                  onPress={openArtist}
                  accessibilityRole="link"
                  accessibilityLabel={`Voir le profil de ${group.blaze}`}
                  hitSlop={6}
                  style={({ pressed }) => [styles.identity, pressed && { opacity: 0.7 }]}
                >
                  <TAvatar uri={group.avatarUrl} name={group.blaze} size="sm" />
                  <TText variant="bodySmall" weight="semibold" numberOfLines={1} style={styles.blaze}>{group.blaze}</TText>
                  <TText variant="caption" color="secondary" numberOfLines={1}>{storyAge(story.created_at)}</TText>
                </Pressable>
                <View style={styles.headerActions}>
                  {isOwner && (
                    <>
                      <View style={styles.views} accessible accessibilityLabel={viewsLabel(story.view_count)}>
                        <Ionicons name="eye-outline" size={15} color={Colors.textPrimary} />
                        <TText variant="caption" weight="medium" tabular>{viewsLabel(story.view_count)}</TText>
                      </View>
                      <Pressable
                        onPress={() => setConfirmDelete(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Supprimer cette story"
                        hitSlop={6}
                        style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
                      >
                        <Ionicons name="trash-outline" size={18} color={Colors.textPrimary} />
                      </Pressable>
                    </>
                  )}
                  <Pressable
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Fermer les stories"
                    hitSlop={6}
                    style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
                  >
                    <Ionicons name="close" size={22} color={Colors.textPrimary} />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Bottom: caption */}
            {!!story.caption && (
              <>
                <LinearGradient
                  colors={['rgba(7,6,5,0)', 'rgba(7,6,5,0.85)']}
                  style={styles.bottomShade}
                  pointerEvents="none"
                />
                <View style={[styles.caption, { paddingBottom: insets.bottom + Spacing.lg }]} pointerEvents="none">
                  <TText variant="body" style={styles.captionText}>{story.caption}</TText>
                </View>
              </>
            )}

            <BottomSheet
              visible={confirmDelete}
              onClose={() => setConfirmDelete(false)}
              accessibilityLabel="Supprimer la story"
            >
              <TText variant="displayS">Supprimer cette story ?</TText>
              <TText variant="bodySmall" color="secondary" style={styles.sheetText}>
                Elle disparaîtra tout de suite pour tout le monde.
              </TText>
              <View style={styles.sheetActions}>
                <TButton
                  title="Supprimer"
                  variant="destructive"
                  loading={deleting}
                  disabled={deleting}
                  onPress={() => { void handleDelete(); }}
                />
                <TButton title="Annuler" variant="ghost" size="md" onPress={() => setConfirmDelete(false)} />
              </View>
            </BottomSheet>
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgInk, alignItems: 'center' },
  stage: { flex: 1, overflow: 'hidden', backgroundColor: Colors.bgInk },
  dim: { backgroundColor: 'rgba(7,6,5,0.55)' },
  failed: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  zone: { position: 'absolute', top: 0, bottom: 0 },

  topShade: { position: 'absolute', top: 0, left: 0, right: 0 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.xs },
  segments: { flexDirection: 'row', gap: 4 },
  segment: {
    flex: 1, height: 2.5, borderRadius: 2, overflow: 'hidden',
    backgroundColor: 'rgba(244,239,230,0.28)',
  },
  segmentFill: { height: '100%', backgroundColor: Colors.textPrimary },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2xs'], marginTop: 10 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, minHeight: 40 },
  blaze: { flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  views: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 30, paddingHorizontal: 10, marginRight: 2,
    borderRadius: Radius.full, backgroundColor: 'rgba(7,6,5,0.5)',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  bottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 200 },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.md },
  captionText: { textAlign: 'center' },

  sheetText: { marginTop: 4 },
  sheetActions: { marginTop: Spacing.md, gap: Spacing['2xs'] },
});
