import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, StyleSheet, View, useWindowDimensions, type ViewToken,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Colors, Gradients, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { PressableScale } from '@/components/motion';
import { IconButton } from '@/components/v5';
import { Seo } from '@/components/Seo';
import { ReelPlayer } from '@/components/reels/ReelPlayer';
import { ReelEmbed } from '@/components/reels/ReelEmbed';
import { ReactionBar } from '@/components/social/ReactionBar';
import { useReactionStore } from '@/components/social/reaction-store';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';
import type { ReelProvider } from '@/lib/reels';

interface Reel {
  id: string;
  mediaUrl: string;
  embedProvider: ReelProvider | null;
  thumbnailUrl: string | null;
  caption: string | null;
  likes: number;
  artistId: string;
  artistName: string;
  artistCity: string;
  artistAvatarUrl: string | null;
}

const REEL_SELECT = '*, artists!posts_artist_id_fkey!inner(id, blaze, city, avatar_url)';
const MORE_REELS = 30;
// Uploaded videos are mounted for the reel on screen and its neighbours only.
const PLAYER_WINDOW = 1;
// Vertical video column on wide screens.
const STAGE_RATIO = 9 / 16;
const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

function mapReel(raw: any): Reel {
  return {
    id: raw.id,
    mediaUrl: raw.media_url,
    embedProvider: raw.embed_provider === 'tiktok' || raw.embed_provider === 'instagram' ? raw.embed_provider : null,
    thumbnailUrl: raw.thumbnail_url ?? null,
    caption: raw.caption ?? null,
    likes: raw.likes_count ?? 0,
    artistId: raw.artist_id,
    artistName: raw.artists?.blaze ?? 'Artiste',
    artistCity: raw.artists?.city ?? '',
    artistAvatarUrl: raw.artists?.avatar_url ?? null,
  };
}

export default function ReelsScreen() {
  const { id, artist } = useLocalSearchParams<{ id: string; artist?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const userId = useAuthStore((s) => s.user?.id);

  const [reels, setReels] = useState<Reel[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [pendingLike, setPendingLike] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reactionCounts = useReactionStore((s) => s.counts);
  const myReactions = useReactionStore((s) => s.mine);
  const reactionsOwner = useReactionStore((s) => s.mineOwner);
  const loadReactions = useReactionStore((s) => s.load);
  const mineLoaded = !!userId && reactionsOwner === userId;

  // ── Load the opened reel first, then more from the same artist (or everyone).
  useEffect(() => {
    let active = true;
    setState('loading');
    (async () => {
      const first = await supabase.from('posts').select(REEL_SELECT).eq('id', id).eq('is_published', true).maybeSingle();
      if (!active) return;
      if (first.error) { setState('error'); return; }
      if (!first.data) { setState('missing'); return; }
      if (first.data.media_type !== 'video') {
        // Photos have their own page.
        router.replace(`/post/${id}`);
        return;
      }

      let more = supabase
        .from('posts')
        .select(REEL_SELECT)
        .eq('is_published', true)
        .eq('media_type', 'video')
        .neq('id', id)
        .order('published_at', { ascending: false })
        .limit(MORE_REELS);
      if (artist) more = more.eq('artist_id', artist);
      const rest = await more;
      if (!active) return;

      const list = [first.data, ...(rest.data ?? [])].map(mapReel);
      setReels(list);
      setActiveIndex(0);
      setState('ready');
      // Reactions of the whole list in one request.
      void loadReactions(list.map((r) => r.id), userId);

      if (userId) {
        const likes = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', userId)
          .in('post_id', list.map((r) => r.id));
        if (active && !likes.error) setLiked(new Set((likes.data ?? []).map((l) => l.post_id)));
      }
    })().catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [id, artist, userId, router, reloadKey, loadReactions]);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const toggleLike = useCallback(async (reel: Reel) => {
    if (!userId) {
      router.push({ pathname: '/(auth)/sign-in', params: { next: `/reels/${reel.id}` } });
      return;
    }
    if (pendingLike) return;
    const wasLiked = liked.has(reel.id);
    setPendingLike(reel.id);
    let confirmed = false;
    if (wasLiked) {
      const { data, error } = await supabase.from('post_likes').delete()
        .eq('post_id', reel.id).eq('user_id', userId).select('post_id');
      confirmed = !error && data?.length === 1;
    } else {
      const { error } = await supabase.from('post_likes').insert({ post_id: reel.id, user_id: userId });
      confirmed = !error;
    }
    setPendingLike(null);
    if (!confirmed) {
      Toast.error('Le j’aime n’a pas été enregistré. Réessayez.');
      return;
    }
    setLiked((current) => {
      const next = new Set(current);
      if (wasLiked) next.delete(reel.id); else next.add(reel.id);
      return next;
    });
    setReels((current) => current.map((r) => (
      r.id === reel.id ? { ...r, likes: Math.max(0, r.likes + (wasLiked ? -1 : 1)) } : r
    )));
  }, [liked, pendingLike, router, userId]);

  // FlatList requires a stable callback for viewability.
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const index = viewableItems[0]?.index;
    if (typeof index === 'number') setActiveIndex(index);
  }).current;

  const stageWidth = Math.min(width, Math.round(height * STAGE_RATIO));
  const getItemLayout = useCallback(
    (_: ArrayLike<Reel> | null | undefined, index: number) => ({ length: height, offset: height * index, index }),
    [height],
  );

  const renderReel = useCallback(({ item, index }: { item: Reel; index: number }) => {
    const isActive = index === activeIndex;
    const nearScreen = Math.abs(index - activeIndex) <= PLAYER_WINDOW;
    const isLiked = liked.has(item.id);
    return (
      <View style={[styles.page, { height }]}>
        <View style={[styles.stage, { width: stageWidth }]}>
          {item.embedProvider ? (
            <ReelEmbed provider={item.embedProvider} pageUrl={item.mediaUrl} active={isActive} />
          ) : nearScreen ? (
            <ReelPlayer
              uri={item.mediaUrl}
              active={isActive}
              muted={muted}
              accessibilityLabel={item.caption ?? `Vidéo de ${item.artistName}`}
            />
          ) : item.thumbnailUrl ? (
            <Image source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="contain" />
          ) : null}

          <LinearGradient
            colors={Gradients.heroOverlay}
            style={styles.shade}
            pointerEvents="none"
          />

          <View style={[styles.caption, { paddingBottom: insets.bottom + Spacing.md }]} pointerEvents="box-none">
            <PressableScale
              onPress={() => router.push(`/artist/${item.artistId}`)}
              accessibilityRole="link"
              accessibilityLabel={`Voir le profil de ${item.artistName}`}
              style={styles.artist}
            >
              <TAvatar uri={item.artistAvatarUrl} name={item.artistName} size="sm" />
              <View style={{ flexShrink: 1 }}>
                <TText variant="title2" serif color="onInk" numberOfLines={1} style={styles.artistName}>{item.artistName}</TText>
                {!!item.artistCity && <TText variant="caption" color="onInkMuted" numberOfLines={1}>{item.artistCity}</TText>}
              </View>
            </PressableScale>
            {!!item.caption && (
              <TText variant="bodySmall" color="onInk" numberOfLines={3} style={styles.captionText}>{item.caption}</TText>
            )}
          </View>

          <View style={[styles.rail, { bottom: insets.bottom + Spacing.md }]} pointerEvents="box-none">
            {/* Chips grow leftwards from the column, above the caption. */}
            <View style={[styles.reactions, { maxWidth: stageWidth - Spacing.sm * 2 }]}>
              <ReactionBar
                postId={item.id}
                compact
                initialCounts={reactionCounts[item.id]}
                initialMine={mineLoaded ? myReactions[item.id] : undefined}
                onInk
              />
            </View>
            <IconButton
              icon={isLiked ? 'heart' : 'heart-outline'}
              label={isLiked ? 'Retirer le j’aime' : 'Aimer cette vidéo'}
              active={isLiked}
              plate
              onPress={() => { void toggleLike(item); }}
            />
            {item.likes > 0 && (
              <TText variant="caption" weight="semibold" tabular color="onInk" style={styles.count}>{item.likes.toLocaleString('fr-FR')}</TText>
            )}
            {!item.embedProvider && (
              <IconButton
                icon={muted ? 'volume-mute' : 'volume-high'}
                label={muted ? 'Activer le son' : 'Couper le son'}
                plate
                onPress={() => setMuted((m) => !m)}
              />
            )}
          </View>
        </View>
      </View>
    );
  }, [activeIndex, height, insets.bottom, liked, muted, router, stageWidth, toggleLike, reactionCounts, myReactions, mineLoaded]);

  const current = reels[activeIndex];
  const seoTitle = useMemo(
    () => (current ? `Vidéo de ${current.artistName} | Inkr` : 'Vidéos — Inkr'),
    [current],
  );

  return (
    <View style={[styles.container, (state === 'error' || state === 'missing') && styles.containerPaper]}>
      <Seo
        title={seoTitle}
        description={current?.caption || 'Vidéos de tatoueurs sur Inkr.'}
        indexable={false}
        image={current?.thumbnailUrl}
      />

      {state === 'loading' && (
        <ActivityIndicator color={Colors.onInkMuted} style={styles.center} accessibilityLabel="Chargement de la vidéo" />
      )}
      {state === 'error' && (
        <EmptyState
          icon="cloud-offline-outline"
          title="Vidéo indisponible"
          description="Le chargement a échoué. Vérifiez votre connexion puis réessayez."
          ctaLabel="Réessayer"
          onCta={() => setReloadKey((k) => k + 1)}
        />
      )}
      {state === 'missing' && (
        <EmptyState
          icon="videocam-off-outline"
          title="Cette vidéo n’existe plus"
          description="Elle a peut-être été retirée par l’artiste."
          ctaLabel="Retour à l’accueil"
          onCta={() => router.replace('/')}
        />
      )}
      {state === 'ready' && (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          renderItem={renderReel}
          extraData={activeIndex}
          pagingEnabled
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          // The page itself must not scroll under the pager on the web.
          style={Platform.OS === 'web' ? styles.webPager : undefined}
        />
      )}

      <View style={[styles.topBar, { top: insets.top + Spacing.xs }]} pointerEvents="box-none">
        <IconButton icon="chevron-back" label="Fermer les vidéos" plate onPress={close} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.inkPanel },
  // Error and missing states are paper notices (EmptyState is set in ink).
  containerPaper: { backgroundColor: Colors.paper },
  center: { flex: 1 },
  webPager: { flex: 1 },
  page: { width: '100%', alignItems: 'center', backgroundColor: Colors.inkPanel },
  stage: { flex: 1, overflow: 'hidden', backgroundColor: Colors.inkPanel },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 260 },
  caption: { position: 'absolute', left: 0, right: 72, bottom: 0, paddingHorizontal: Spacing.sm },
  artist: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', maxWidth: '100%', minHeight: 44 },
  artistName: { fontSize: 22, lineHeight: 24 },
  captionText: { marginTop: Spacing['2xs'] },
  rail: { position: 'absolute', right: Spacing.sm, alignItems: 'flex-end', gap: 8 },
  reactions: {
    flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4,
    paddingVertical: 4, paddingLeft: 6, paddingRight: 4,
    backgroundColor: Colors.scrim,
  },
  count: { marginTop: -4, marginBottom: 4, width: 44, textAlign: 'center' },
  topBar: { position: 'absolute', left: Spacing.sm },
});
