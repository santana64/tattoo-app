import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, useReducedMotion,
} from 'react-native-reanimated';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TButton } from '@/components/ui/TButton';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { BOOKING_STATUS, styleName } from '@/components/ArtistCard';
import { VideoPlaceholder, isVideoMedia, popScale } from '@/components/PostCard';
import { BottomSheet, PressableScale, RevealImage, enterUp, fadeIn } from '@/components/motion';
import { DetailRow, IconButton, Kicker, Rule, StatusDot, TextLink, type StatusTone } from '@/components/v5';
import { PlateFill } from '@/components/gallery/WorkPlate';
import { useFeedStore } from '@/store/feed-store';
import { useAuthStore } from '@/store/auth-store';
import { supabase, type Tables } from '@/lib/supabase';
import { fetchArtist, isUuid } from '@/lib/catalog';
import type { Artist } from '@/constants/tattoo';
import { Seo } from '@/components/Seo';
import { toDescription } from '@/lib/site';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { Lightbox, type LightboxItem } from '@/components/gallery/Lightbox';
import { ShareButton, sharePage } from '@/components/ui/ShareButton';
import { ReactionBar } from '@/components/social/ReactionBar';
import { artworkLabel } from '@/lib/studio';

const SIDE_W = 420;
const STATUS_TONE: Record<keyof typeof BOOKING_STATUS, StatusTone> = { open: 'open', paused: 'wait', closed: 'closed' };
/** Enough siblings to browse a whole portfolio in the viewer. */
const SIBLINGS_MAX = 120;

/** A published photo as a work on the viewer's wall: its label title and first line. */
function toLightboxItem(post: Tables<'posts'>): LightboxItem {
  const label = artworkLabel(post, styleName);
  return { id: post.id, uri: post.media_url, title: label.title, subtitle: label.lines[0] ?? null };
}

type ReportReason = 'spam' | 'inappropriate' | 'fake';
const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Contenu inapproprié' },
  { value: 'fake', label: 'Faux contenu' },
];

/** Shared layout maths: the work gets the room, the cartel sits beside it on wide screens. */
function useArtworkFrame() {
  const { width, height, isWide, gutter } = useContentDimensions();
  const frameW = Math.min(width, Layout.maxContent);
  const artW = isWide ? frameW - gutter * 2 - SIDE_W - Spacing['2xl'] : width;
  const artH = isWide
    ? Math.round(Math.min(height - 140, artW * 1.25, 900))
    : Math.round(Math.min(width * 1.25, height * 0.68));
  return { wide: isWide, artH, gutter };
}

function DetailSkeleton() {
  const { wide, artH, gutter } = useArtworkFrame();
  return (
    <View style={styles.container} accessibilityLabel="Chargement de la publication">
      <THeader showBack />
      <View style={[styles.frame, wide && [styles.frameWide, { paddingHorizontal: gutter }]]}>
        <View style={wide ? styles.artColWide : undefined}>
          <TSkeleton height={artH} radius={0} />
        </View>
        <View style={[styles.side, { paddingHorizontal: gutter }, wide && styles.sideWide]}>
          <TSkeleton width={140} height={10} radius={0} />
          <TSkeleton width="80%" height={44} radius={0} style={{ marginTop: 14 }} />
          <TSkeleton height={1} radius={0} style={{ marginTop: Spacing.lg }} />
          {[0, 1, 2].map((i) => (
            <TSkeleton key={i} height={14} radius={0} style={{ marginTop: Spacing.sm }} />
          ))}
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
        <TText variant="caption" weight="semibold" tabular>{count.toLocaleString('fr-FR')}</TText>
      )}
    </PressableScale>
  );
}

function SheetRow({ icon, label, onPress, destructive }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; destructive?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} pressedScale={0.98} accessibilityRole="button" accessibilityLabel={label} style={styles.sheetRow}>
      <Ionicons name={icon} size={18} color={destructive ? Colors.error : Colors.ink} />
      <TText variant="body" weight="medium" style={destructive ? { color: Colors.error } : undefined}>{label}</TText>
    </PressableScale>
  );
}

function PostContent({ row, artist }: { row: Tables<'posts'>; artist: Artist | null }) {
  const id = row.id;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { wide, artH, gutter } = useArtworkFrame();
  const { user } = useAuthStore();
  const [isLiked, setLiked] = useState(false);
  const [isSaved, setSaved] = useState(false);
  const [likes, setLikes] = useState(row.likes_count ?? 0);
  const [busy, setBusy] = useState(false);
  const [membershipReady, setMembershipReady] = useState(false);
  const [sheet, setSheet] = useState<'options' | 'report' | null>(null);
  const [series, setSeries] = useState<{ id: string; title: string } | null>(null);
  const [siblings, setSiblings] = useState<Tables<'posts'>[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
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

  // The artist's other published photos, newest first, to browse in the viewer.
  // Loaded once; without them the viewer simply shows this work alone.
  useEffect(() => {
    let active = true;
    setSiblings(null);
    supabase.from('posts').select('*')
      .eq('artist_id', row.artist_id).eq('is_published', true).eq('media_type', 'photo')
      .order('published_at', { ascending: false }).limit(SIBLINGS_MAX)
      .then(({ data }) => {
        if (active && data) setSiblings(data.filter((p) => !isVideoMedia(p.media_url, p.media_type)));
      }, () => {});
    return () => { active = false; };
  }, [row.artist_id]);

  const viewerItems = useMemo<LightboxItem[]>(() => {
    const list = siblings?.some((p) => p.id === row.id) ? siblings : [row];
    return list.map(toLightboxItem);
  }, [siblings, row]);
  const openViewer = () => setViewerIndex(Math.max(0, viewerItems.findIndex((item) => item.id === row.id)));
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
  const openSeries = () => series && router.push({ pathname: '/series/[id]', params: { id: series.id } });
  const pieceTitle = row.title?.trim() || null;
  const label = artworkLabel(row, styleName);
  const shareTitle = `${pieceTitle ?? 'Tatouage'} par ${artist?.blaze ?? 'un artiste Inkr'}`;
  const shareText = post.caption?.trim() || 'Découvrez cette réalisation sur Inkr.';
  const handleShare = () => { void sharePage({ title: shareTitle, text: shareText, path: `/post/${id}` }); };
  const seoLead = post.caption?.trim() || label.lines.join(', ');

  const cta = artist ? (
    canRequest ? (
      <TButton title={`Demander un projet à ${firstName}`} variant="primary" onPress={openRequest} />
    ) : (
      <TButton title={`Voir le profil de ${firstName}`} variant="secondary" onPress={openArtist} />
    )
  ) : null;
  const seoArtist = artist ? `${artist.blaze}${artist.city ? `, ${artist.city}` : ''}` : 'un artiste Inkr';

  // ── Cartel: only the facts the post really carries ──
  const technique = post.styles.slice(0, 2).map(styleName).join(', ');
  const zone = row.body_zone?.trim() || null;
  const session = row.session_hours ? `${String(Number(row.session_hours)).replace('.', ',')} h` : null;
  const publishedYear = row.published_at ? new Date(row.published_at).getFullYear() : NaN;
  const facts: { label: string; value: string }[] = [];
  if (technique) facts.push({ label: 'Technique', value: technique });
  if (zone) facts.push({ label: 'Emplacement', value: zone });
  if (session) facts.push({ label: 'Séance', value: session });
  if (row.is_healed) facts.push({ label: 'État', value: 'Photographié cicatrisé' });
  if (!Number.isNaN(publishedYear)) facts.push({ label: 'Année', value: String(publishedYear) });
  const titleSize = wide ? 56 : 42;

  return (
    <View style={styles.container}>
      <Seo
        title={`${pieceTitle ? `${pieceTitle} — ` : ''}Tatouage ${stylesLabel || 'réalisé'} par ${artist?.blaze ?? 'un artiste'} | Inkr`}
        description={toDescription(`${seoLead ? `${seoLead} — ` : ''}Réalisation de ${seoArtist}. Découvrez son portfolio sur Inkr.`)}
        image={post.mediaUrl}
        type="article"
      />
      <THeader
        showBack
        title="Œuvre"
        rightElement={<IconButton icon="ellipsis-horizontal" label="Plus d’options" onPress={handleOptions} />}
      />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: wide ? Spacing['4xl'] : insets.bottom + (artist ? 110 : 40) }}
      >
        <View style={[styles.frame, wide && [styles.frameWide, { paddingHorizontal: gutter }]]}>
          {/* ── The work, on the ink wall ── */}
          <Animated.View
            style={[styles.art, { height: artH }, wide ? styles.artColWide : null, artMotion]}
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
              <Pressable
                onPress={openViewer}
                accessibilityRole="button"
                accessibilityLabel={`Agrandir ${pieceTitle ? `« ${pieceTitle} »` : artist ? `la réalisation de ${artist.blaze}` : 'la réalisation'}`}
                accessibilityHint="Ouvre la visionneuse plein écran"
                style={[StyleSheet.absoluteFill, styles.zoomable]}
              >
                <RevealImage
                  uri={post.mediaUrl}
                  contentFit="contain"
                  style={[StyleSheet.absoluteFill, styles.mat]}
                  accessibilityLabel={pieceTitle ?? post.caption ?? (artist ? `Réalisation de ${artist.blaze}` : 'Réalisation')}
                  fallback={<PlateFill />}
                />
              </Pressable>
            )}
          </Animated.View>

          {/* ── Museum cartel ── */}
          <View style={[styles.side, { paddingHorizontal: gutter }, wide && styles.sideWide]}>
            <Animated.View entering={enterUp(0, 120)}>
              {artist ? (
                <TextLink
                  label={`${artist.blaze}${artist.city ? ` · ${artist.city}` : ''}`}
                  onPress={openArtist}
                  accessibilityLabel={`Voir le profil de ${artist.blaze}`}
                  style={styles.artistLink}
                />
              ) : (
                <Kicker tone="flame">Artiste Inkr</Kicker>
              )}
              <TText
                variant="displayL"
                italic={!pieceTitle}
                accessibilityRole="header"
                style={[
                  styles.title,
                  { fontSize: titleSize, lineHeight: Math.round(titleSize * 0.98), letterSpacing: -titleSize * 0.035 },
                  !pieceTitle && { color: Colors.textSecondary },
                ]}
              >
                {label.title}
              </TText>
              <Rule tone="ink" style={styles.titleRule} />
              <DetailRow label="Artiste" value={artist?.blaze ?? 'Artiste Inkr'} />
              {facts.map((f) => <DetailRow key={f.label} label={f.label} value={f.value} />)}
              {series && (
                <DetailRow label="Série">
                  <TextLink
                    label={series.title}
                    onPress={openSeries}
                    accessibilityLabel={`Voir la série ${series.title}`}
                    style={styles.seriesLink}
                  />
                </DetailRow>
              )}
              <Rule />
            </Animated.View>

            {/* Actions */}
            <Animated.View entering={enterUp(1, 120)}>
              <View style={styles.actions}>
                <ActionButton
                  label={isLiked ? 'Retirer le j’aime' : 'Aimer cette réalisation'}
                  onPress={handleLike}
                  active={isLiked}
                  count={post.likes}
                  haptic
                >
                  <Animated.View style={heartStyle}>
                    <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={20} color={isLiked ? Colors.flame : Colors.ink} />
                  </Animated.View>
                </ActionButton>
                <ActionButton
                  label={isSaved ? 'Retirer des enregistrements' : 'Enregistrer cette réalisation'}
                  onPress={handleSave}
                  active={isSaved}
                  haptic
                >
                  <Animated.View style={saveStyle}>
                    <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={19} color={isSaved ? Colors.flame : Colors.ink} />
                  </Animated.View>
                </ActionButton>
                <ShareButton title={shareTitle} text={shareText} path={`/post/${id}`} framed={false} />
                <View style={{ flex: 1 }} />
                <ActionButton label="Signaler cette publication" onPress={handleReport}>
                  <Ionicons name="flag-outline" size={17} color={Colors.textTertiary} />
                </ActionButton>
              </View>
              <View style={styles.reactions}>
                <ReactionBar postId={post.id} />
              </View>
            </Animated.View>

            {/* The artist's note */}
            {!!post.caption && (
              <Animated.View entering={enterUp(2, 120)} style={styles.note}>
                <Kicker tone="muted">Note de l’artiste</Kicker>
                <TText variant="title2" serif style={styles.caption}>{post.caption}</TText>
              </Animated.View>
            )}

            {/* Artist */}
            {artist && status && (
              <Animated.View entering={enterUp(3, 120)} style={styles.artistSection}>
                <Kicker style={{ marginBottom: Spacing.sm }}>L’artiste</Kicker>
                <PressableScale
                  onPress={openArtist}
                  pressedScale={0.99}
                  accessibilityRole="link"
                  accessibilityLabel={`Voir le profil de ${artist.blaze}, ${artist.city}, ${status.label}`}
                  style={styles.artistRow}
                >
                  <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="lg" />
                  <View style={styles.artistInfo}>
                    <View style={styles.nameRow}>
                      <TText variant="displayS" numberOfLines={1} style={styles.artistName}>{artist.blaze}</TText>
                      {artist.isVerified && (
                        <Ionicons name="checkmark-circle" size={15} color={Colors.flameText} accessibilityLabel="Profil vérifié" />
                      )}
                    </View>
                    <TText variant="caption" color="secondary" numberOfLines={1}>
                      {artist.city}{artist.styles.length ? ` · ${artist.styles.slice(0, 2).map(styleName).join(' · ')}` : ''}
                    </TText>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={Colors.ink} />
                </PressableScale>
                <View style={styles.statusRow}>
                  <StatusDot tone={STATUS_TONE[artist.bookingStatus]} label={status.label} />
                  {artist.minBudget > 0 && (
                    <TText variant="caption" weight="semibold" tabular style={styles.budget}>
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

      {/* Sticky CTA on phones and tablets */}
      {!wide && cta && (
        <Animated.View entering={fadeIn(250)} style={[styles.stickyBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.stickyInner}>{cta}</View>
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
            <Kicker tone="flame">Modération</Kicker>
            <TText variant="displayS" style={styles.sheetTitle}>Signaler ce contenu</TText>
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
            <SheetRow icon="arrow-redo-outline" label="Partager" onPress={() => { setSheet(null); handleShare(); }} />
            <SheetRow icon="flag-outline" label="Signaler" destructive onPress={handleReport} />
          </View>
        )}
        <TButton title="Annuler" variant="ghost" size="md" onPress={() => setSheet(null)} style={{ marginTop: Spacing.xs }} />
      </BottomSheet>

      <Lightbox
        visible={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
        items={viewerItems}
        index={viewerIndex ?? 0}
        onIndexChange={setViewerIndex}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  frame: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },
  frameWide: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing['2xl'], paddingTop: Spacing.xl },

  // Phones: no clipping, so the stretch can grow above the fold; the cartel below is opaque.
  art: { width: '100%', backgroundColor: Colors.inkPanel },
  artColWide: { flex: 1, width: undefined, overflow: 'hidden' },
  mat: { backgroundColor: 'transparent' },
  zoomable: Platform.OS === 'web' ? ({ cursor: 'zoom-in' } as object) : {},

  side: { paddingTop: Spacing.lg, backgroundColor: Colors.bgPrimary },
  sideWide: { width: SIDE_W, paddingHorizontal: 0, paddingTop: 0 },

  artistLink: { alignSelf: 'flex-start' },
  title: { marginTop: Spacing.sm, color: Colors.ink },
  titleRule: { marginTop: Spacing.lg },
  seriesLink: { flexShrink: 1, minHeight: 20 },

  actions: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing['3xs'],
    marginTop: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 44, height: 48, paddingHorizontal: 8 },
  reactions: { marginTop: Spacing.sm },

  note: { marginTop: Spacing.xl },
  caption: { marginTop: Spacing.xs, maxWidth: Layout.maxReading, fontSize: 21, lineHeight: 28 },

  artistSection: {
    marginTop: Spacing.xl, paddingTop: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Colors.ink,
  },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48 },
  artistInfo: { flex: 1, gap: 4, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  artistName: { fontSize: 26, lineHeight: 28, flexShrink: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: Spacing.sm },
  budget: { marginLeft: 'auto', color: Colors.flameText },

  stickyBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: Layout.gutter, paddingTop: 12,
    backgroundColor: Colors.paper, borderTopWidth: 1, borderTopColor: Colors.ink,
  },
  stickyInner: { width: '100%', maxWidth: Layout.maxReading, alignSelf: 'center' },

  sheetTitle: { marginTop: 6, marginBottom: Spacing.xs },
  sheetLead: { marginTop: 4, marginBottom: Spacing.xs },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    minHeight: 52,
    borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
});
