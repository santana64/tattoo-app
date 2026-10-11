import React, { useEffect, useState } from 'react';
import {
  View, StyleSheet, Pressable, ScrollView,
  Share, ActionSheetIOS, Platform, Alert, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withSpring, FadeIn, FadeInDown, Easing, useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Layout, SpringConfig } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TButton } from '@/components/ui/TButton';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { BOOKING_STATUS, styleName } from '@/components/ArtistCard';
import { VideoPlaceholder, isVideoMedia } from '@/components/PostCard';
import { useFeedStore } from '@/store/feed-store';
import { useAuthStore } from '@/store/auth-store';
import { supabase, type Tables } from '@/lib/supabase';
import { fetchArtist, isUuid } from '@/lib/catalog';
import type { Artist } from '@/constants/mock-data';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const WIDE = 900;
const SIDE_W = 400;

/** Shared layout maths: the work gets the room, the label sits beside it on wide screens. */
function useArtworkFrame() {
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE;
  const frameW = Math.min(width, Layout.maxContent);
  const artW = wide ? frameW - Layout.gutter * 2 - SIDE_W - Spacing['2xl'] : width;
  const artH = wide
    ? Math.round(Math.min(height - 160, artW * 1.25, 860))
    : Math.round(Math.min(width * 1.25, height * 0.72));
  return { wide, artH };
}

function DetailSkeleton() {
  const { wide, artH } = useArtworkFrame();
  return (
    <View style={styles.container} accessibilityLabel="Chargement de la publication">
      <THeader showBack />
      <View style={[styles.frame, wide && styles.frameWide]}>
        <View style={wide ? styles.artColWide : undefined}>
          <TSkeleton height={artH} radius={wide ? Radius.xl : 0} />
        </View>
        <View style={[styles.side, wide && styles.sideWide]}>
          <TSkeleton width={120} height={11} />
          <TSkeleton width="75%" height={32} style={{ marginTop: 12 }} />
          <TSkeleton height={44} radius={Radius.sm} style={{ marginTop: Spacing.lg }} />
          <TSkeleton width="90%" height={14} style={{ marginTop: Spacing.lg }} />
          <TSkeleton width="60%" height={14} style={{ marginTop: 8 }} />
        </View>
      </View>
    </View>
  );
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [resource, setResource] = useState<{ post: Tables<'posts'>; artist: Artist | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();
  useEffect(() => {
    let active = true;
    setResource(null); setLoading(true); setError(false);
    async function load() {
      try {
        if (!isUuid(id)) return;
        const { data, error: failure } = await supabase.from('posts').select('*').eq('id', id).eq('is_published', true).maybeSingle();
        if (failure) throw failure;
        if (!data) return;
        const artist = await fetchArtist(data.artist_id);
        if (active) setResource({ post: data, artist });
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [id, attempt]);

  if (loading) return <DetailSkeleton />;
  if (!resource) {
    return (
      <View style={styles.container}>
        <THeader showBack />
        <EmptyState
          icon={error ? 'cloud-offline-outline' : 'image-outline'}
          title={error ? 'Publication inaccessible' : 'Publication introuvable'}
          description={error
            ? 'Le chargement a échoué. Vérifiez votre connexion puis réessayez.'
            : 'Cette publication a été retirée ou ce lien n’est plus valide.'}
          ctaLabel={error ? 'Réessayer' : 'Explorer les artistes'}
          onCta={() => error ? setAttempt((n) => n + 1) : router.replace('/(tabs)/explore')}
        />
      </View>
    );
  }
  return <PostContent key={id} row={resource.post} artist={resource.artist} />;
}

function ActionButton({ icon, label, onPress, active, count, disabled, children }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void;
  active?: boolean; count?: number; disabled?: boolean; children?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      hitSlop={4}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
    >
      {children ?? <Ionicons name={icon} size={21} color={active ? Colors.accentGlow : Colors.textSecondary} />}
      {count !== undefined && (
        <TText variant="bodySmall" weight="medium" color="secondary" tabular>{count.toLocaleString('fr-FR')}</TText>
      )}
    </Pressable>
  );
}

function PostContent({ row, artist }: { row: Tables<'posts'>; artist: Artist | null }) {
  const id = row.id;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { wide, artH } = useArtworkFrame();
  const { user } = useAuthStore();
  const [isLiked, setLiked] = useState(false);
  const [isSaved, setSaved] = useState(false);
  const [likes, setLikes] = useState(row.likes_count ?? 0);
  const [busy, setBusy] = useState(false);
  const [membershipReady, setMembershipReady] = useState(false);
  const post = { id, mediaUrl: row.media_url, caption: row.caption, styles: row.styles ?? [], likes };
  const status = artist ? BOOKING_STATUS[artist.bookingStatus] : null;
  useEffect(() => {
    let active = true;
    setMembershipReady(false); setLiked(false); setSaved(false);
    if (!user?.id) return;
    Promise.all([
      supabase.from('post_likes').select('post_id').eq('post_id', id).eq('user_id', user.id).maybeSingle(),
      supabase.from('saved_posts').select('post_id').eq('post_id', id).eq('user_id', user.id).maybeSingle(),
    ]).then(([like, save]) => {
      if (!active) return;
      if (like.error || save.error) { Toast.error('Impossible de charger vos favoris.'); return; }
      setLiked(!!like.data); setSaved(!!save.data); setMembershipReady(true);
    }).catch(() => { if (active) Toast.error('Impossible de charger vos favoris.'); });
    return () => { active = false; };
  }, [id, user?.id]);

  const heartScale = useSharedValue(1);
  const saveScale = useSharedValue(1);

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));
  const saveStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveScale.value }] }));

  const mutate = async (kind: 'like' | 'save') => {
    if (!user?.id) { router.push('/(auth)/sign-in'); return; }
    if (busy || !membershipReady) return;
    setBusy(true);
    const current = kind === 'like' ? isLiked : isSaved;
    const table = kind === 'like' ? 'post_likes' : 'saved_posts';
    try {
      const { error } = current
        ? await supabase.from(table).delete().eq('post_id', id).eq('user_id', user.id)
        : await supabase.from(table).insert({ post_id: id, user_id: user.id });
      if (error) throw error;
      if (kind === 'like') { setLiked(!current); setLikes((n) => Math.max(0, n + (current ? -1 : 1))); }
      else setSaved(!current);
      useFeedStore.setState((state) => {
        const membership = new Set(kind === 'like' ? state.likedPostIds : state.savedPostIds);
        if (current) membership.delete(id); else membership.add(id);
        return {
          ...(kind === 'like' ? { likedPostIds: membership } : { savedPostIds: membership }),
          posts: state.posts.map((p) => p.id !== id ? p : kind === 'like'
            ? { ...p, isLiked: !current, likesCount: Math.max(0, likes + (current ? -1 : 1)) }
            : { ...p, isSaved: !current }),
        };
      });
    } catch { Toast.error('Modification non enregistrée. Réessayez.'); }
    finally { setBusy(false); }
  };
  const pop = (value: typeof heartScale) => {
    if (!reduced) value.value = withSequence(withSpring(1.15, SpringConfig.snappy), withSpring(1, SpringConfig.gentle));
  };
  const handleLike = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pop(heartScale);
    void mutate('like');
  };

  const handleSave = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pop(saveScale);
    void mutate('save');
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Découvrez ce tatouage sur INKR : ${post.caption ?? ''}${Platform.OS === 'web' ? ` ${window.location.origin}/post/${id}` : ''}`,
      });
    } catch {}
  };

  const handleReport = () => {
    if (!user?.id) { router.push('/(auth)/sign-in'); return; }
    Alert.alert(
      'Signaler ce contenu',
      'Pourquoi signalez-vous cette publication ?',
      [
        { text: 'Spam', onPress: () => submitReport('spam') },
        { text: 'Contenu inapproprié', onPress: () => submitReport('inappropriate') },
        { text: 'Faux contenu', onPress: () => submitReport('fake') },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const submitReport = async (reason: 'spam' | 'inappropriate' | 'fake') => {
    if (!user?.id) return;
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        target_type: 'post',
        target_id: id,
        reason,
      });
      if (error) throw error;
      Toast.success('Signalement envoyé. Merci.');
    } catch {
      Toast.error('Le signalement n’a pas été envoyé. Réessayez.');
    }
  };

  const handleOptions = () => {
    const options = ['Partager', 'Signaler', 'Annuler'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2, destructiveButtonIndex: 1 },
        (idx) => {
          if (idx === 0) handleShare();
          if (idx === 1) handleReport();
        }
      );
    } else {
      Alert.alert('Options', '', [
        { text: 'Partager', onPress: handleShare },
        { text: 'Signaler', onPress: handleReport, style: 'destructive' },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  };

  const enter = (delay: number) => (reduced ? undefined : FadeInDown.delay(delay).duration(600).easing(EASE));
  const isVideo = isVideoMedia(row.media_url, row.media_type);
  const stylesLabel = post.styles.slice(0, 3).map(styleName).join(' · ');
  const firstName = artist?.blaze.split(' ')[0] ?? '';
  const canRequest = artist?.bookingStatus === 'open';
  const openRequest = () => artist && router.push({ pathname: '/request/new', params: { artistId: artist.id } });
  const openArtist = () => artist && router.push(`/artist/${artist.id}`);

  const cta = artist ? (
    canRequest ? (
      <TButton title={`Demander un projet à ${firstName}`} variant="primary" onPress={openRequest} />
    ) : (
      <TButton title={`Voir le profil de ${firstName}`} variant="secondary" onPress={openArtist} />
    )
  ) : null;

  return (
    <View style={styles.container}>
      <THeader
        showBack
        rightElement={
          <Pressable
            onPress={handleOptions}
            accessibilityRole="button"
            accessibilityLabel="Plus d’options"
            hitSlop={8}
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textPrimary} />
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: wide ? Spacing['3xl'] : insets.bottom + (artist ? 110 : 40) }}
      >
        <View style={[styles.frame, wide && styles.frameWide]}>
          {/* ── The work, matted like a print ── */}
          <Animated.View
            entering={reduced ? undefined : FadeIn.duration(500)}
            style={[styles.art, { height: artH }, wide && styles.artColWide, wide && styles.artWide]}
          >
            {isVideo ? (
              <VideoPlaceholder note="La lecture n’est pas encore disponible sur cette page." />
            ) : (
              <Image
                source={{ uri: post.mediaUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                transition={reduced ? 0 : 300}
                accessibilityLabel={post.caption ?? (artist ? `Réalisation de ${artist.blaze}` : 'Réalisation')}
              />
            )}
          </Animated.View>

          {/* ── Wall label ── */}
          <View style={[styles.side, wide && styles.sideWide]}>
            <Animated.View entering={enter(80)}>
              {!!stylesLabel && (
                <TText variant="label" color="accentWarm" uppercase numberOfLines={1}>{stylesLabel}</TText>
              )}
              <TText variant="displayM" accessibilityRole="header" style={styles.title}>
                {artist ? (
                  <>Pièce signée <TText variant="displayM" italic color="accentGlow">{artist.blaze}</TText></>
                ) : 'Réalisation'}
              </TText>
            </Animated.View>

            {/* Actions */}
            <Animated.View entering={enter(140)} style={styles.actions}>
              <ActionButton
                icon="heart-outline"
                label={isLiked ? 'Retirer le j’aime' : 'Aimer cette réalisation'}
                onPress={handleLike}
                active={isLiked}
                count={post.likes}
              >
                <Animated.View style={heartStyle}>
                  <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={21} color={isLiked ? Colors.accentGlow : Colors.textSecondary} />
                </Animated.View>
              </ActionButton>
              <ActionButton
                icon="bookmark-outline"
                label={isSaved ? 'Retirer des enregistrements' : 'Enregistrer cette réalisation'}
                onPress={handleSave}
                active={isSaved}
              >
                <Animated.View style={saveStyle}>
                  <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={isSaved ? Colors.accentGlow : Colors.textSecondary} />
                </Animated.View>
              </ActionButton>
              <ActionButton icon="arrow-redo-outline" label="Partager" onPress={handleShare} />
              <View style={{ flex: 1 }} />
              <ActionButton icon="flag-outline" label="Signaler cette publication" onPress={handleReport}>
                <Ionicons name="flag-outline" size={18} color={Colors.textTertiary} />
              </ActionButton>
            </Animated.View>

            {/* Caption */}
            {!!post.caption && (
              <Animated.View entering={enter(200)}>
                <TText variant="body" color="secondary" style={styles.caption}>{post.caption}</TText>
              </Animated.View>
            )}

            {/* Artist */}
            {artist && status && (
              <Animated.View entering={enter(260)} style={styles.artistSection}>
                <TText variant="label" color="tertiary" uppercase style={{ marginBottom: Spacing.sm }}>L’artiste</TText>
                <Pressable
                  onPress={openArtist}
                  accessibilityRole="link"
                  accessibilityLabel={`Voir le profil de ${artist.blaze}, ${artist.city}, ${status.label}`}
                  style={({ pressed }) => [styles.artistRow, pressed && { opacity: 0.7 }]}
                >
                  <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="lg" />
                  <View style={styles.artistInfo}>
                    <View style={styles.nameRow}>
                      <TText variant="title1" serif numberOfLines={1} style={styles.artistName}>{artist.blaze}</TText>
                      {artist.isVerified && (
                        <Ionicons name="checkmark-circle" size={15} color={Colors.accentWarm} accessibilityLabel="Profil vérifié" />
                      )}
                    </View>
                    <TText variant="caption" color="secondary" numberOfLines={1}>
                      {artist.city}{artist.styles.length ? ` · ${artist.styles.slice(0, 2).map(styleName).join(' · ')}` : ''}
                    </TText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                </Pressable>
                <View style={styles.statusRow}>
                  <View style={[styles.dot, { backgroundColor: status.color }]} />
                  <TText variant="caption" color="secondary">{status.label}</TText>
                  {artist.minBudget > 0 && (
                    <TText variant="caption" tabular style={styles.budget}>
                      dès {artist.minBudget.toLocaleString('fr-FR')} €
                    </TText>
                  )}
                </View>
              </Animated.View>
            )}

            {wide && cta && <View style={{ marginTop: Spacing.lg }}>{cta}</View>}
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA on phones and tablets */}
      {!wide && cta && (
        <Animated.View
          entering={reduced ? undefined : FadeInDown.delay(300).duration(500).easing(EASE)}
          style={[styles.stickyBar, { paddingBottom: insets.bottom + 12 }]}
        >
          <View style={styles.stickyInner}>{cta}</View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },

  frame: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },
  frameWide: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing['2xl'],
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.lg,
  },

  art: { width: '100%', overflow: 'hidden', backgroundColor: Colors.bgInk },
  artColWide: { flex: 1, width: undefined },
  artWide: { borderRadius: Radius.xl, backgroundColor: Colors.bgElevated },

  side: { paddingHorizontal: Layout.gutter, paddingTop: Spacing.lg },
  sideWide: { width: SIDE_W, paddingHorizontal: 0, paddingTop: Spacing.xs },

  title: { marginTop: 8 },

  actions: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing['2xs'],
    marginTop: Spacing.lg, paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 44, height: 44, paddingHorizontal: 6 },

  caption: { marginTop: Spacing.lg, maxWidth: Layout.maxReading },

  artistSection: {
    marginTop: Spacing.xl, paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  artistInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  artistName: { fontSize: 24, lineHeight: 28, flexShrink: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: Spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
  budget: { marginLeft: 'auto', color: Colors.accentGlow },

  stickyBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: Layout.gutter, paddingTop: 12,
    backgroundColor: 'rgba(11,10,9,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  stickyInner: { width: '100%', maxWidth: Layout.maxReading, alignSelf: 'center' },
});
