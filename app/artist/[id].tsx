import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  StyleSheet, View, Pressable, useWindowDimensions, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn, Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, useReducedMotion,
} from 'react-native-reanimated';
import { GlassSurface, PressableScale, RevealImage, enterUp } from '@/components/motion';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TButton } from '@/components/ui/TButton';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArtPlaceholder, BOOKING_STATUS, styleName } from '@/components/ArtistCard';
import { useSavedArtistsStore } from '@/store/saved-artists-store';
import { Toast } from '@/components/ui/TToast';
import { useAuthStore } from '@/store/auth-store';
import { fetchArtistPortfolio } from '@/lib/catalog';
import { useArtist } from '@/hooks/use-artist';
import type { Tables } from '@/lib/supabase';

const GAP = 3;

// ─── Pieces ───────────────────────────────────────────────────────────────────
function RoundButton({ icon, label, onPress, disabled, active }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={19} color={active ? Colors.accentGlow : Colors.textPrimary} />
    </Pressable>
  );
}

function Fact({ label, value, accent, dot }: { label: string; value: string; accent?: boolean; dot?: string }) {
  return (
    <View style={styles.fact}>
      <TText variant="label" color="tertiary" uppercase>{label}</TText>
      <View style={styles.factValue}>
        {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
        <TText variant="bodySmall" weight="medium" tabular numberOfLines={1} style={accent ? { color: Colors.accentGlow } : undefined}>
          {value}
        </TText>
      </View>
    </View>
  );
}

function Section({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <TText variant="label" color="accentWarm" uppercase style={{ marginBottom: 6 }}>{kicker}</TText>
      <TText variant="displayS" style={{ marginBottom: Spacing.sm }}>{title}</TText>
      {children}
    </View>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={styles.faqItem}
    >
      <View style={styles.faqRow}>
        <TText variant="body" weight="medium" style={{ flex: 1 }}>{question}</TText>
        <Ionicons name={open ? 'remove' : 'add'} size={18} color={Colors.textSecondary} />
      </View>
      {open && (
        <Animated.View entering={FadeIn.duration(200)}>
          <TText variant="bodySmall" color="secondary" style={styles.faqAnswer}>{answer}</TText>
        </Animated.View>
      )}
    </Pressable>
  );
}

function ProfileSkeleton({ top }: { top: number }) {
  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <TSkeleton height={380} radius={0} />
      <View style={{ padding: Layout.gutter, gap: 12 }}>
        <TSkeleton width="60%" height={34} />
        <TSkeleton width="40%" height={14} />
        <TSkeleton height={64} radius={Radius.lg} style={{ marginTop: 12 }} />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ArtistProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { savedArtistIds, pendingIds, fetchSaved, toggle } = useSavedArtistsStore();
  const { isAuthenticated, user } = useAuthStore();
  useEffect(() => { void fetchSaved(user?.id); }, [user?.id, fetchSaved]);

  const { artist: loadedArtist, loading, error, retry } = useArtist(id);
  const [artistPosts, setArtistPosts] = useState<Tables<'posts'>[]>([]);
  const [faq, setFaq] = useState<{ question: string; answer: string }[]>([]);
  const [portfolioState, setPortfolioState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    setArtistPosts([]); setFaq([]); setPortfolioState('loading');
    if (loadedArtist) fetchArtistPortfolio(loadedArtist.id).then((data) => {
      if (active) { setArtistPosts(data.posts); setFaq(data.faq); setPortfolioState('ready'); }
    }).catch(() => { if (active) setPortfolioState('error'); });
    return () => { active = false; };
  }, [loadedArtist]);

  const artist = useMemo(() => (loadedArtist ? { ...loadedArtist, faq } : null), [loadedArtist, faq]);
  const isSaved = artist ? savedArtistIds.has(artist.id) : false;
  const photos = useMemo(() => artistPosts.filter((p) => p.media_type === 'photo'), [artistPosts]);

  // Layout
  const contentW = Math.min(width, Layout.maxContent);
  const wide = width >= 900;
  const coverH = Math.round(Math.min(Math.max(height * 0.58, 360), 560));
  const cols = contentW >= 1000 ? 4 : contentW >= 640 ? 3 : 2;
  const cell = (contentW - Layout.gutter * 2 - GAP * (cols - 1)) / cols;

  // Scroll-linked header
  // Scroll-driven cover & header, entirely on the UI thread.
  const reduced = useReducedMotion();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.set(e.contentOffset.y); });
  const coverStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    if (reduced) return { transform: [] };
    return {
      transform: [
        // Pull down: the print stretches from its top edge. Scroll up: slower parallax.
        { translateY: y < 0 ? y / 2 : y * 0.35 },
        { scale: y < 0 ? 1 + -y / coverH : 1 },
      ],
    };
  });
  const coverCopyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, coverH * 0.45], [1, 0], Extrapolation.CLAMP),
  }));
  const headerGlassStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [coverH * 0.55, coverH * 0.85], [0, 1], Extrapolation.CLAMP),
  }));
  const headerTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [coverH * 0.7, coverH * 0.95], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.get(), [coverH * 0.7, coverH * 0.95], [6, 0], Extrapolation.CLAMP) }],
  }));

  const handleSave = useCallback(async () => {
    if (!artist) return;
    if (!user) { router.push({ pathname: '/(auth)/sign-in', params: { next: `/artist/${artist.id}` } }); return; }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!await toggle(user.id, artist.id)) Toast.error('Impossible d’enregistrer cet artiste. Réessayez.');
  }, [artist, toggle, user, router]);

  const handleRequest = () => {
    if (!artist) return;
    if (!isAuthenticated) { router.push({ pathname: '/(auth)/sign-in', params: { next: `/request/new?artistId=${artist.id}` } }); return; }
    router.push({ pathname: '/request/new', params: { artistId: artist.id } });
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/explore'));

  if (!artist && loading) return <ProfileSkeleton top={0} />;
  if (!artist) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={{ paddingHorizontal: Spacing.sm, paddingTop: 6 }}>
          <RoundButton icon="chevron-back" label="Retour" onPress={goBack} />
        </View>
        <EmptyState
          icon="person-outline"
          title={error ? 'Profil indisponible' : 'Artiste introuvable'}
          description={error ? 'Le chargement a échoué. Vérifiez votre connexion puis réessayez.' : 'Ce profil n’existe pas ou n’est plus public.'}
          ctaLabel={error ? 'Réessayer' : 'Explorer les artistes'}
          onCta={error ? retry : () => router.replace('/(tabs)/explore')}
        />
      </View>
    );
  }

  const status = BOOKING_STATUS[artist.bookingStatus];
  const canRequest = artist.bookingStatus === 'open';
  const stylesLabel = artist.styles.map(styleName);
  const coverUri = artist.coverUrl || photos[0]?.media_url;

  return (
    <View style={styles.container}>
      {/* ─── Floating header ─── */}
      <View style={[styles.floatingHeader, { paddingTop: insets.top + 6 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, headerGlassStyle]} pointerEvents="none">
          <GlassSurface style={StyleSheet.absoluteFill} />
          <View style={styles.headerHairline} />
        </Animated.View>
        <View style={styles.floatingHeaderInner}>
          <RoundButton icon="chevron-back" label="Retour" onPress={goBack} />
          <Animated.View style={[{ flex: 1, alignItems: 'center' }, headerTitleStyle]}>
            <TText variant="bodySmall" weight="semibold" numberOfLines={1}>{artist.blaze}</TText>
          </Animated.View>
          <RoundButton
            icon={isSaved ? 'bookmark' : 'bookmark-outline'}
            label={isSaved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            onPress={handleSave}
            disabled={pendingIds.has(artist.id)}
            active={isSaved}
          />
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* ─── Cover ─── */}
        <View style={[styles.cover, { height: coverH }]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.coverOrigin, coverStyle]}>
            {coverUri ? (
              <RevealImage
                uri={coverUri}
                style={StyleSheet.absoluteFill}
                accessibilityLabel={`Travail de ${artist.blaze}`}
                fallback={<ArtPlaceholder name={artist.blaze} size={Math.min(width * 0.45, 220)} />}
              />
            ) : (
              <ArtPlaceholder name={artist.blaze} size={Math.min(width * 0.45, 220)} />
            )}
          </Animated.View>
          <LinearGradient
            colors={['rgba(11,10,9,0.45)', 'rgba(11,10,9,0)', 'rgba(11,10,9,0.55)', Colors.bgPrimary]}
            locations={[0, 0.25, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View style={[styles.coverCopy, { maxWidth: Layout.maxContent }, coverCopyStyle]}>
            <Animated.View entering={enterUp(0, 80)}>
              <View style={styles.kickerRow}>
                <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="sm" />
                <TText variant="label" color="accentWarm" uppercase numberOfLines={1} style={{ flexShrink: 1 }}>
                  {artist.city}{stylesLabel.length ? ` · ${stylesLabel.slice(0, 2).join(' · ')}` : ''}
                </TText>
              </View>
              <View style={styles.nameRow}>
                <TText variant="displayXL" numberOfLines={2} style={[styles.name, !wide && { fontSize: 48, lineHeight: 50 }]} accessibilityRole="header">
                  {artist.blaze}
                </TText>
                {artist.isVerified && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.accentWarm} style={{ marginLeft: 8, marginBottom: 8 }} accessibilityLabel="Profil vérifié" />
                )}
              </View>
            </Animated.View>
          </Animated.View>
        </View>

        <View style={styles.body}>
          {/* ─── Facts ─── */}
          <View style={styles.facts}>
            <Fact label="Statut" value={status.short} dot={status.color} />
            <View style={styles.factDivider} />
            <Fact label="Budget" value={artist.minBudget > 0 ? `dès ${artist.minBudget.toLocaleString('fr-FR')} €` : 'Sur devis'} accent={artist.minBudget > 0} />
            <View style={styles.factDivider} />
            <Fact label="Œuvres" value={portfolioState === 'ready' ? String(photos.length) : '—'} />
          </View>

          {/* ─── Styles ─── */}
          {(stylesLabel.length > 0 || artist.specialties.length > 0) && (
            <View style={styles.tags}>
              {[...stylesLabel, ...artist.specialties].map((s) => (
                <View key={s} style={styles.tag}><TText variant="caption" color="secondary">{s}</TText></View>
              ))}
            </View>
          )}

          {/* ─── Bio ─── */}
          {!!artist.bio && (
            <TText variant="body" color="secondary" style={styles.bio}>{artist.bio}</TText>
          )}
        </View>

        {/* ─── Portfolio ─── */}
        <View style={[styles.body, styles.portfolio]}>
          <View style={styles.portfolioHead}>
            <TText variant="displayS">Portfolio</TText>
            {portfolioState === 'ready' && photos.length > 0 && (
              <TText variant="caption" color="tertiary" tabular>{photos.length} œuvre{photos.length > 1 ? 's' : ''}</TText>
            )}
          </View>

          {portfolioState === 'loading' && (
            <View style={styles.grid}>
              {Array.from({ length: cols * 2 }).map((_, i) => (
                <TSkeleton key={i} width={cell} height={cell * 1.25} radius={Radius.sm} />
              ))}
            </View>
          )}
          {portfolioState === 'error' && (
            <EmptyState icon="images-outline" title="Portfolio indisponible" description="Le chargement a échoué." ctaLabel="Réessayer" onCta={retry} style={styles.inlineEmpty} />
          )}
          {portfolioState === 'ready' && photos.length === 0 && (
            <EmptyState icon="images-outline" title="Pas encore de réalisations" description="Cet artiste n’a rien publié pour le moment." style={styles.inlineEmpty} />
          )}
          {portfolioState === 'ready' && photos.length > 0 && (
            <View style={styles.grid}>
              {photos.map((post, i) => {
                // Every 5th piece spans two columns, like a featured print on the wall.
                const feature = cols > 1 && i % 5 === 0 && i + 1 < photos.length;
                const w = feature ? cell * 2 + GAP : cell;
                return (
                  <Animated.View key={post.id} entering={i < 8 ? enterUp(i, 100) : undefined}>
                    <PressableScale
                      onPress={() => router.push(`/post/${post.id}`)}
                      accessibilityRole="link"
                      accessibilityLabel={post.caption ?? `Réalisation ${i + 1}`}
                      style={[styles.cell, { width: w, height: cell * 1.25 }]}
                    >
                      <RevealImage uri={post.media_url} style={StyleSheet.absoluteFill} />
                    </PressableScale>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.body}>
          {!!artist.process && (
            <Section kicker="Méthode" title="Comment je travaille">
              <TText variant="body" color="secondary" style={styles.prose}>{artist.process}</TText>
            </Section>
          )}
          {!!artist.rules && (
            <Section kicker="Avant de demander" title="Conditions">
              <TText variant="body" color="secondary" style={styles.prose}>{artist.rules}</TText>
            </Section>
          )}
          {artist.exclusions.length > 0 && (
            <Section kicker="Limites" title="Je ne réalise pas">
              {artist.exclusions.map((e) => (
                <View key={e} style={styles.listRow}>
                  <View style={styles.listDash} />
                  <TText variant="body" color="secondary">{e}</TText>
                </View>
              ))}
            </Section>
          )}
          {artist.faq.length > 0 && (
            <Section kicker="Questions" title="Questions fréquentes">
              {artist.faq.map((item) => <FaqItem key={item.question} question={item.question} answer={item.answer} />)}
            </Section>
          )}
        </View>
      </Animated.ScrollView>

      {/* ─── Sticky action bar ─── */}
      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.stickyInner}>
          <View style={{ flex: 1 }}>
            <View style={styles.factValue}>
              <View style={[styles.dot, { backgroundColor: status.color }]} />
              <TText variant="bodySmall" weight="medium">{status.label}</TText>
            </View>
            <TText variant="caption" color="tertiary" numberOfLines={1}>
              {canRequest
                ? 'Devis établi par l’artiste'
                : artist.bookingStatus === 'paused' ? 'Enregistrez le profil pour y revenir' : 'Ne prend pas de nouveaux projets'}
            </TText>
          </View>
          {canRequest ? (
            <TButton title="Demander un projet" onPress={handleRequest} fullWidth={false} />
          ) : (
            <TButton
              title={isSaved ? 'Enregistré' : 'Enregistrer'}
              variant="secondary"
              onPress={handleSave}
              fullWidth={false}
              icon={<Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={16} color={isSaved ? Colors.accentGlow : Colors.textPrimary} />}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingBottom: 8 },
  headerHairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderDefault },
  coverOrigin: { transformOrigin: 'top' },
  floatingHeaderInner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.sm, width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center',
  },
  roundBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(11,10,9,0.55)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderBright,
  },

  cover: { overflow: 'hidden', justifyContent: 'flex-end' },
  coverCopy: { width: '100%', alignSelf: 'center', paddingHorizontal: Layout.gutter, paddingBottom: Spacing.lg },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'flex-end' },
  name: { flexShrink: 1 },

  body: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center', paddingHorizontal: Layout.gutter },

  facts: {
    flexDirection: 'row', alignItems: 'stretch',
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  fact: { flex: 1, gap: 6 },
  factDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.borderDefault, marginHorizontal: Spacing.sm },
  factValue: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.md },
  tag: {
    paddingHorizontal: 12, height: 30, justifyContent: 'center',
    borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },

  bio: { marginTop: Spacing.md, maxWidth: Layout.maxReading },

  portfolio: { marginTop: Spacing['2xl'] },
  portfolioHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: { overflow: 'hidden', borderRadius: Radius.sm, backgroundColor: Colors.bgSurface },
  inlineEmpty: { flex: 0, paddingVertical: Spacing.xl },

  section: {
    marginTop: Spacing['2xl'], paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  prose: { maxWidth: Layout.maxReading },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  listDash: { width: 12, height: 1, backgroundColor: Colors.accentWarm },

  faqItem: { paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderDefault },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  faqAnswer: { marginTop: Spacing['2xs'], maxWidth: Layout.maxReading },

  stickyBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingTop: 12, paddingHorizontal: Layout.gutter,
    backgroundColor: 'rgba(11,10,9,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  stickyInner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center',
  },
});
