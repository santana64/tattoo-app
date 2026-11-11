import React, { useEffect, useState } from 'react';
import {
  View, StyleSheet, Share, Platform, useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, useReducedMotion,
} from 'react-native-reanimated';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TButton } from '@/components/ui/TButton';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { ArtPlaceholder, BOOKING_STATUS, styleName } from '@/components/ArtistCard';
import { VideoPlaceholder, isVideoMedia, popScale } from '@/components/PostCard';
import { BottomSheet, GlassSurface, PressableScale, RevealImage, enterUp, fadeIn } from '@/components/motion';
import { useFeedStore } from '@/store/feed-store';
import { useAuthStore } from '@/store/auth-store';
import { supabase, type Tables } from '@/lib/supabase';
import { fetchArtist, isUuid } from '@/lib/catalog';
import type { Artist } from '@/constants/tattoo';
import { Seo } from '@/components/Seo';
import { toDescription } from '@/lib/site';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { ArtworkLabel } from '@/components/gallery/ArtworkLabel';

const WIDE = 900;
const SIDE_W = 400;

type ReportReason = 'spam' | 'inappropriate' | 'fake';
const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Contenu inapproprié' },
  { value: 'fake', label: 'Faux contenu' },
];

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

function ActionButton({ label, onPress, active, count, haptic, children }: {
  label: string; onPress: () => void; active?: boolean; count?: number; haptic?: boolean; children: React.ReactNode;
}) {
  return (
    <PressableScale
      onPress={onPress}
      haptic={haptic}
      pressedScale={0.92}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      hitSlop={4}
      style={styles.action}
    >
      {children}
      {count !== undefined && (
        <TText variant="bodySmall" weight="medium" color="secondary" tabular>{count.toLocaleString('fr-FR')}</TText>
      )}
    </PressableScale>
  );
}

function SheetRow({ icon, label, onPress, destructive }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; destructive?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} pressedScale={0.98} accessibilityRole="button" accessibilityLabel={label} style={styles.sheetRow}>
      <Ionicons name={icon} size={19} color={destructive ? Colors.errorLight : Colors.textSecondary} />
      <TText variant="body" weight="medium" style={destructive ? { color: Colors.errorLight } : undefined}>{label}</TText>
    </PressableScale>
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
  const [sheet, setSheet] = useState<'options' | 'report' | null>(null);
  const [series, setSeries] = useState<{ id: string; title: string } | null>(null);
  const post = { id, mediaUrl: row.media_url, caption: row.caption, styles: row.styles ?? [], likes };

  // The series is a secondary link: a failed lookup simply hides it.
  useEffect(() => {
    let active = true;
    setSeries(null);
    if (!row.series_id) return;
    supabase.from('artist_series').select('id,title').eq('id', row.series_id).maybeSingle()
      .then(({ data }) => { if (active && data) setSeries(data); }, () => {});
    return () => { active = false; };
  }, [row.series_id]);
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

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.get() }] }));
  const saveStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveScale.get() }] }));

  // ── Scroll-driven artwork: gentle parallax, stretches on pull-down (phones only).
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.set(e.contentOffset.y); });
  const parallax = !wide && !reduced;
  const artMotion = useAnimatedStyle(() => {
    if (!parallax) return { transform: [{ translateY: 0 }, { scale: 1 }] };
    const y = scrollY.get();
    return y < 0
      ? { transform: [{ translateY: y / 2 }, { scale: 1 + -y / artH }] }
      : { transform: [{ translateY: y * 0.3 }, { scale: 1 }] };
  });

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

  // Haptics come from PressableScale (native only); the pop accompanies the commit.
  const handleLike = () => {
    if (!isLiked) popScale(heartScale, reduced);
    void mutate('like');
  };

  const handleSave = () => {
    if (!isSaved) popScale(saveScale, reduced);
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
    if (!user?.id) { setSheet(null); router.push('/(auth)/sign-in'); return; }
    setSheet('report');
  };

  const submitReport = async (reason: ReportReason) => {
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

  const handleOptions = () => setSheet('options');

  const isVideo = isVideoMedia(row.media_url, row.media_type);
  const stylesLabel = post.styles.slice(0, 3).map(styleName).join(' · ');
  const firstName = artist?.blaze.split(' ')[0] ?? '';
  const canRequest = artist?.bookingStatus === 'open';
  const openRequest = () => artist && router.push({ pathname: '/request/new', params: { artistId: artist.id } });
  const openArtist = () => artist && router.push(`/artist/${artist.id}`);
  const openSeries = () => series && router.push({ pathname: '/artist/[id]', params: { id: row.artist_id, series: series.id } });
  const pieceTitle = row.title?.trim() || null;

  const cta = artist ? (
    canRequest ? (
      <TButton title={`Demander un projet à ${firstName}`} variant="primary" onPress={openRequest} />
    ) : (
      <TButton title={`Voir le profil de ${firstName}`} variant="secondary" onPress={openArtist} />
    )
  ) : null;
  const seoArtist = artist ? `${artist.blaze}${artist.city ? `, ${artist.city}` : ''}` : 'un artiste Inkr';

  return (
    <View style={styles.container}>
      <Seo
        title={`${pieceTitle ? `${pieceTitle} — ` : ''}Tatouage ${stylesLabel || 'réalisé'} par ${artist?.blaze ?? 'un artiste'} | Inkr`}
        description={toDescription(`${post.caption ? `${post.caption} — ` : ''}Réalisation de ${seoArtist}. Découvrez son portfolio sur Inkr.`)}
        image={post.mediaUrl}
        type="article"
      />
      <THeader
        showBack
        rightElement={
          <PressableScale
            onPress={handleOptions}
            pressedScale={0.92}
            accessibilityRole="button"
            accessibilityLabel="Plus d’options"
            hitSlop={8}
            style={styles.headerBtn}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textPrimary} />
          </PressableScale>
        }
      />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: wide ? Spacing['3xl'] : insets.bottom + (artist ? 110 : 40) }}
      >
        <View style={[styles.frame, wide && styles.frameWide]}>
          {/* ── The work, matted like a print ── */}
          <Animated.View
            style={[styles.art, { height: artH }, wide ? [styles.artColWide, styles.artWide] : null, artMotion]}
          >
            {isVideo ? (
              <PressableScale
                onPress={() => router.push(`/reels/${id}`)}
                accessibilityRole="button"
                accessibilityLabel="Lire la vidéo"
                style={StyleSheet.absoluteFill}
              >
                <VideoPlaceholder note="Appuyez pour lire la vidéo." />
              </PressableScale>
            ) : (
              <RevealImage
                uri={post.mediaUrl}
                contentFit="contain"
                style={[StyleSheet.absoluteFill, styles.mat]}
                accessibilityLabel={pieceTitle ?? post.caption ?? (artist ? `Réalisation de ${artist.blaze}` : 'Réalisation')}
                fallback={<ArtPlaceholder name={artist?.blaze ?? 'Inkr'} size={96} />}
              />
            )}
          </Animated.View>

          {/* ── Wall label ── */}
          <View style={[styles.side, wide && styles.sideWide]}>
            <Animated.View entering={enterUp(0, 120)}>
              <ArtworkLabel
                post={row}
                artistName={artist?.blaze ?? 'Artiste Inkr'}
                onPressArtist={artist ? openArtist : undefined}
              />
              {series && (
                <PressableScale
                  onPress={openSeries}
                  accessibilityRole="link"
                  accessibilityLabel={`Voir la série ${series.title}`}
                  hitSlop={6}
                  style={styles.seriesLink}
                >
                  <Ionicons name="albums-outline" size={14} color={Colors.accentGlow} />
                  <TText variant="caption" weight="medium" color="accentGlow" numberOfLines={1} style={styles.seriesText}>
                    Série · {series.title}
                  </TText>
                  <Ionicons name="arrow-forward" size={13} color={Colors.accentGlow} />
                </PressableScale>
              )}
            </Animated.View>

            {/* Actions */}
            <Animated.View entering={enterUp(1, 120)} style={styles.actions}>
              <ActionButton
                label={isLiked ? 'Retirer le j’aime' : 'Aimer cette réalisation'}
                onPress={handleLike}
                active={isLiked}
                count={post.likes}
                haptic
              >
                <Animated.View style={heartStyle}>
                  <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={21} color={isLiked ? Colors.accentGlow : Colors.textSecondary} />
                </Animated.View>
              </ActionButton>
              <ActionButton
                label={isSaved ? 'Retirer des enregistrements' : 'Enregistrer cette réalisation'}
                onPress={handleSave}
                active={isSaved}
                haptic
              >
                <Animated.View style={saveStyle}>
                  <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={isSaved ? Colors.accentGlow : Colors.textSecondary} />
                </Animated.View>
              </ActionButton>
              <ActionButton label="Partager" onPress={handleShare}>
                <Ionicons name="arrow-redo-outline" size={21} color={Colors.textSecondary} />
              </ActionButton>
              <View style={{ flex: 1 }} />
              <ActionButton label="Signaler cette publication" onPress={handleReport}>
                <Ionicons name="flag-outline" size={18} color={Colors.textTertiary} />
              </ActionButton>
            </Animated.View>

            {/* The artist's note */}
            {!!post.caption && (
              <Animated.View entering={enterUp(2, 120)} style={styles.note}>
                <TText variant="label" color="tertiary" uppercase>Note de l’artiste</TText>
                <TText variant="body" color="secondary" style={styles.caption}>{post.caption}</TText>
              </Animated.View>
            )}

            {/* Artist */}
            {artist && status && (
              <Animated.View entering={enterUp(3, 120)} style={styles.artistSection}>
                <TText variant="label" color="tertiary" uppercase style={{ marginBottom: Spacing.sm }}>L’artiste</TText>
                <PressableScale
                  onPress={openArtist}
                  accessibilityRole="link"
                  accessibilityLabel={`Voir le profil de ${artist.blaze}, ${artist.city}, ${status.label}`}
                  style={styles.artistRow}
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
                </PressableScale>
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

            {wide && cta && <Animated.View entering={enterUp(4, 120)} style={{ marginTop: Spacing.lg }}>{cta}</Animated.View>}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Sticky CTA on phones and tablets, frosted over the work */}
      {!wide && cta && (
        <Animated.View entering={fadeIn(250)} style={styles.stickyBar}>
          <GlassSurface style={[styles.stickyGlass, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.stickyInner}>{cta}</View>
          </GlassSurface>
        </Animated.View>
      )}

      {/* Options & report */}
      <BottomSheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        accessibilityLabel={sheet === 'report' ? 'Signaler ce contenu' : 'Options'}
      >
        {sheet === 'report' ? (
          <View>
            <TText variant="displayS">Signaler ce contenu</TText>
            <TText variant="bodySmall" color="secondary" style={styles.sheetLead}>
              Pourquoi signalez-vous cette publication ?
            </TText>
            {REPORT_REASONS.map((r) => (
              <SheetRow
                key={r.value}
                icon="flag-outline"
                label={r.label}
                onPress={() => { setSheet(null); void submitReport(r.value); }}
              />
            ))}
          </View>
        ) : (
          <View>
            <TText variant="displayS" style={styles.sheetTitle}>Options</TText>
            <SheetRow icon="arrow-redo-outline" label="Partager" onPress={() => { setSheet(null); void handleShare(); }} />
            <SheetRow icon="flag-outline" label="Signaler" destructive onPress={handleReport} />
          </View>
        )}
        <TButton title="Annuler" variant="ghost" size="md" onPress={() => setSheet(null)} style={{ marginTop: Spacing.xs }} />
      </BottomSheet>
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

  // Phones: no clipping, so the stretch can grow above the fold; the label below is opaque.
  art: { width: '100%', backgroundColor: Colors.bgInk },
  artColWide: { flex: 1, width: undefined },
  artWide: { borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: Colors.bgElevated },
  mat: { backgroundColor: 'transparent' },

  side: { paddingHorizontal: Layout.gutter, paddingTop: Spacing.lg, backgroundColor: Colors.bgPrimary },
  sideWide: { width: SIDE_W, paddingHorizontal: 0, paddingTop: Spacing.xs },

  seriesLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36, marginTop: Spacing.xs },
  seriesText: { flexShrink: 1 },

  actions: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing['2xs'],
    marginTop: Spacing.lg, paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 44, height: 44, paddingHorizontal: 6 },

  note: { marginTop: Spacing.lg },
  caption: { marginTop: Spacing['2xs'], maxWidth: Layout.maxReading },

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

  stickyBar: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  stickyGlass: {
    paddingHorizontal: Layout.gutter, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  stickyInner: { width: '100%', maxWidth: Layout.maxReading, alignSelf: 'center' },

  sheetTitle: { marginBottom: Spacing.xs },
  sheetLead: { marginTop: 4, marginBottom: Spacing.xs },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderDefault,
  },
});
