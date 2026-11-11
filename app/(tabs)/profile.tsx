import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, Pressable, Linking, Platform, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TBadge } from '@/components/ui/TBadge';
import { TButton } from '@/components/ui/TButton';
import { TDivider } from '@/components/ui/TDivider';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { GlassSurface, PressableScale, RevealImage, enterUp } from '@/components/motion';
import { ArtPlaceholder, BOOKING_STATUS, styleName } from '@/components/ArtistCard';
import { useAuthStore } from '@/store/auth-store';
import { useArtist } from '@/hooks/use-artist';
import { fetchArtistPortfolio, isUuid } from '@/lib/catalog';
import type { Tables } from '@/lib/supabase';

const GAP = 3;
const ICON_COL = 34;
const SIDE_W = 340;
const BAR_H = 52;

// ─── Building blocks ──────────────────────────────────────────────────────────
function RoundButton({ icon, label, onPress, onImage }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; onImage?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.92}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={[styles.roundBtn, onImage && styles.roundBtnOnImage]}
    >
      <Ionicons name={icon} size={19} color={Colors.textPrimary} />
    </PressableScale>
  );
}

function ListRow({ icon, label, subtitle, detail, accent, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; subtitle?: string; detail?: string;
  accent?: boolean; onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.985}
      accessibilityRole="button"
      accessibilityLabel={[label, subtitle, detail].filter(Boolean).join(', ')}
      style={styles.row}
    >
      <Ionicons name={icon} size={19} color={accent ? Colors.accentWarm : Colors.textSecondary} style={styles.rowIcon} />
      <View style={styles.rowText}>
        <TText variant="body" weight="medium" numberOfLines={1}>{label}</TText>
        {!!subtitle && <TText variant="caption" color="tertiary" numberOfLines={1}>{subtitle}</TText>}
      </View>
      {!!detail && (
        <TText variant="bodySmall" color={accent ? 'accentWarm' : 'tertiary'} numberOfLines={1}>{detail}</TText>
      )}
      <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
    </PressableScale>
  );
}

function ListGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  return (
    <View style={styles.group}>
      <TText variant="label" color="tertiary" uppercase style={styles.groupTitle}>{title}</TText>
      <View style={styles.groupBody}>
        {items.map((child, i) => (
          <React.Fragment key={i}>
            {i > 0 && <TDivider inset={ICON_COL} />}
            {child}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

function Fact({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={loading ? `${label}, chargement` : `${label} : ${value}`}>
      <TText variant="label" color="tertiary" uppercase numberOfLines={1}>{label}</TText>
      {loading ? (
        <TSkeleton width={48} height={22} />
      ) : (
        <TText variant="title2" serif tabular numberOfLines={1} style={styles.factNumber}>{value}</TText>
      )}
    </View>
  );
}

function SignOutButton({ onSignOut }: { onSignOut: () => void }) {
  return (
    <View style={styles.signOut}>
      <TButton
        title="Se déconnecter"
        variant="destructive"
        size="md"
        onPress={onSignOut}
        icon={<Ionicons name="log-out-outline" size={17} color={Colors.errorLight} />}
      />
    </View>
  );
}

function ProfileSkeleton({ top }: { top: number }) {
  return (
    <View style={[styles.container, { paddingTop: top + Spacing.md }]}>
      <View style={[styles.frame, { gap: 14 }]}>
        <TSkeleton width={96} height={96} radius={48} />
        <TSkeleton width="55%" height={40} />
        <TSkeleton width="35%" height={14} />
        <TSkeleton height={72} radius={Radius.md} style={{ marginTop: Spacing.md }} />
        <TSkeleton height={160} radius={Radius.md} />
      </View>
    </View>
  );
}

/** Sticky glass bar that fades in once the identity block has scrolled away. */
function CompactBar({ top, title, threshold, scrollY, children }: {
  top: number; title: string; threshold: number;
  scrollY: { get: () => number }; children: React.ReactNode;
}) {
  const glassStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [threshold - 60, threshold], [0, 1], Extrapolation.CLAMP),
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [threshold - 20, threshold + 20], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <View style={[styles.bar, { paddingTop: top }]} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, glassStyle]} pointerEvents="none">
        <GlassSurface style={StyleSheet.absoluteFill} />
        <View style={styles.barHairline} />
      </Animated.View>
      <View style={styles.barInner} pointerEvents="box-none">
        <Animated.View style={[styles.barTitle, titleStyle]} pointerEvents="none">
          <TText variant="title2" serif numberOfLines={1} style={{ fontSize: 20 }}>{title}</TText>
        </Animated.View>
        <View style={styles.barActions}>{children}</View>
      </View>
    </View>
  );
}

const formatCount = (n: number) => n.toLocaleString('fr-FR');

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const { user, signOut } = useAuthStore();
  const isArtist = user?.role === 'artist';
  const artistId = isArtist ? user?.artistId ?? '' : '';
  const isPremium = user?.artistTier === 'premium';

  const { artist, loading: artistLoading } = useArtist(artistId);

  // Published work, refreshed each time the tab regains focus (e.g. after publishing).
  const [posts, setPosts] = useState<Tables<'posts'>[]>([]);
  const [portfolioState, setPortfolioState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const loadPortfolio = useCallback(() => {
    if (!isUuid(artistId)) { setPortfolioState('idle'); return undefined; }
    let active = true;
    setPortfolioState((s) => (s === 'ready' ? s : 'loading'));
    fetchArtistPortfolio(artistId)
      .then((data) => { if (active) { setPosts(data.posts); setPortfolioState('ready'); } })
      .catch(() => { if (active) setPortfolioState('error'); });
    return () => { active = false; };
  }, [artistId]);
  useFocusEffect(loadPortfolio);
  const photos = useMemo(() => posts.filter((p) => p.media_type === 'photo'), [posts]);

  // Layout
  const frameW = Math.min(width, Layout.maxContent);
  const wide = width >= 960;
  const mainW = wide ? frameW - Layout.gutter * 2 - SIDE_W - Spacing['2xl'] : frameW - Layout.gutter * 2;
  const cols = mainW >= 640 ? 4 : 3;
  const cell = Math.floor((mainW - GAP * (cols - 1)) / cols);
  const shown = photos.slice(0, cols * 3);
  const coverH = (wide ? 300 : 220) + insets.top;

  // Scroll-driven header: UI-thread only, no React state in onScroll.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.set(e.contentOffset.y); });
  const coverStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    if (reduced) return { opacity: interpolate(y, [0, coverH], [1, 0.4], Extrapolation.CLAMP) };
    return {
      opacity: interpolate(y, [0, coverH], [1, 0.35], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(y, [-200, 0, coverH], [-100, 0, coverH * 0.4], Extrapolation.CLAMP) },
        { scale: interpolate(y, [-200, 0], [1.25, 1], Extrapolation.CLAMP) },
      ],
    };
  });
  const identityStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    const fade = interpolate(y, [0, 160], [1, 0.2], Extrapolation.CLAMP);
    if (reduced) return { opacity: fade };
    return { opacity: fade, transform: [{ scale: interpolate(y, [0, 160], [1, 0.94], Extrapolation.CLAMP) }] };
  });

  const handleSignOut = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    signOut().catch(() => Toast.error('Déconnexion impossible. Réessayez.'));
  };

  if (!user) return <ProfileSkeleton top={insets.top} />;

  // ── Client ──────────────────────────────────────────────────────────────────
  if (!isArtist) {
    const lists = (
      <View>
        <ListGroup title="Vos projets">
          <ListRow icon="document-text-outline" label="Mes demandes" subtitle="Suivi et messages avec les artistes" onPress={() => router.push('/(tabs)/inbox')} />
          <ListRow icon="bookmark-outline" label="Artistes enregistrés" onPress={() => router.push('/saved')} />
          <ListRow icon="heart-outline" label="Réalisations aimées" onPress={() => router.push('/saved?tab=liked')} />
        </ListGroup>
        <ListGroup title="Compte">
          <ListRow icon="person-outline" label="Informations personnelles" subtitle="Nom, ville" onPress={() => router.push('/settings/account')} />
          <ListRow icon="notifications-outline" label="Notifications" onPress={() => router.push('/settings/notifications')} />
          <ListRow icon="shield-outline" label="Confidentialité" onPress={() => router.push('/settings/privacy')} />
        </ListGroup>
        <ListGroup title="Assistance">
          <ListRow icon="help-circle-outline" label="Aide et support" onPress={() => router.push('/settings/support')} />
          <ListRow
            icon="star-outline"
            label="Noter l’application"
            onPress={() => { Linking.openURL('https://apps.apple.com/app/inkr/id000000000').catch(() => {}); }}
          />
        </ListGroup>
      </View>
    );
    const name = user.displayName || 'Votre profil';

    return (
      <View style={styles.container}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: insets.top + BAR_H, paddingBottom: insets.bottom + 110 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.frame}>
            <View style={[styles.columns, wide && styles.columnsWide]}>
              <View style={styles.main}>
                <Animated.View entering={enterUp(0)}>
                  <Animated.View style={[styles.identity, identityStyle]}>
                    <TText variant="label" color="accentWarm" uppercase>Mon compte</TText>
                    <TAvatar uri={user.avatarUrl} name={user.displayName} size="2xl" style={{ marginTop: Spacing.md }} />
                    <TText variant="displayL" numberOfLines={2} style={styles.identityName} accessibilityRole="header">
                      {name}
                    </TText>
                    <TText variant="bodySmall" color="secondary" numberOfLines={1}>
                      {[user.city, user.email].filter(Boolean).join(' · ')}
                    </TText>
                  </Animated.View>
                </Animated.View>

                {/* Artist acquisition: one quiet block, no invented social proof */}
                <Animated.View entering={enterUp(1)} style={styles.artistCta}>
                  <TText variant="label" color="accentWarm" uppercase style={{ marginBottom: 6 }}>Espace artiste</TText>
                  <TText variant="displayS">
                    Vous êtes <TText variant="displayS" italic color="accentGlow">tatoueur</TText> ?
                  </TText>
                  <TText variant="bodySmall" color="secondary" style={styles.artistCtaBody}>
                    Présentez votre portfolio, recevez des demandes détaillées et suivez vos rendez-vous au même endroit.
                  </TText>
                  <TButton
                    title="Créer un espace artiste"
                    variant="secondary"
                    size="md"
                    fullWidth={false}
                    onPress={() => router.push('/(auth)/role-select')}
                  />
                </Animated.View>

                {!wide && <Animated.View entering={enterUp(2)}>{lists}</Animated.View>}
              </View>

              {wide && <View style={styles.side}>{lists}</View>}
            </View>

            <SignOutButton onSignOut={handleSignOut} />
          </View>
        </Animated.ScrollView>

        <CompactBar top={insets.top} title={name} threshold={200} scrollY={scrollY}>
          <RoundButton icon="settings-outline" label="Paramètres" onPress={() => router.push('/settings')} />
        </CompactBar>
      </View>
    );
  }

  // ── Artist ──────────────────────────────────────────────────────────────────
  const blaze = artist?.blaze ?? user.artistBlaze ?? user.displayName;
  const city = artist?.city ?? user.city ?? '';
  const stylesLabel = (artist?.styles ?? []).slice(0, 3).map(styleName);
  const bookingKey = artist?.bookingStatus ?? user.artistBookingStatus;
  const status = bookingKey ? BOOKING_STATUS[bookingKey] : null;
  const coverUri = artist?.coverUrl || photos[0]?.media_url;
  const hasPublicProfile = isUuid(artistId);

  const artistLists = (
    <View>
      <ListGroup title="Gérer">
        <ListRow icon="mail-outline" label="Demandes" subtitle="Nouvelles demandes et échanges" onPress={() => router.push('/(tabs)/inbox')} />
        <ListRow icon="calendar-outline" label="Agenda" subtitle="Rendez-vous à venir" onPress={() => router.push('/(tabs)/agenda')} />
        <ListRow icon="time-outline" label="Horaires et disponibilités" subtitle="Créneaux visibles par vos clients" onPress={() => router.push('/availability')} />
        <ListRow icon="flash-outline" label="Publier un flash" subtitle="Un dessin prêt à réserver" onPress={() => router.push('/flash/new')} />
        <ListRow icon="airplane-outline" label="Annoncer un guest" subtitle="Vos dates dans un autre studio" onPress={() => router.push('/guest/new')} />
        <ListRow icon="analytics-outline" label="Statistiques" subtitle="Vues, demandes, acceptation" onPress={() => router.push('/analytics')} />
        {isPremium && (
          <ListRow icon="color-palette-outline" label="Personnalisation" subtitle="Sections et informations du profil" onPress={() => router.push('/customization')} />
        )}
        {isPremium && (
          <ListRow icon="book-outline" label="Guide Premium" subtitle="Conseils pour votre profil" onPress={() => router.push('/premium-guide')} accent />
        )}
      </ListGroup>
      <ListGroup title="Compte">
        <ListRow
          icon="card-outline"
          label="Abonnement"
          detail={isPremium ? 'Premium' : 'Gratuit'}
          accent={!isPremium}
          onPress={() => router.push('/settings/subscription')}
        />
        <ListRow icon="settings-outline" label="Paramètres" onPress={() => router.push('/settings')} />
        <ListRow icon="help-circle-outline" label="Aide et support" onPress={() => router.push('/settings/support')} />
      </ListGroup>
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Cover: parallax under the identity, dims as it leaves ─── */}
        <View style={[styles.cover, { height: coverH }]}>
          <Animated.View style={[StyleSheet.absoluteFill, coverStyle]}>
            <RevealImage
              uri={coverUri}
              style={StyleSheet.absoluteFill}
              accessibilityLabel={`Travail de ${blaze}`}
              fallback={<ArtPlaceholder name={blaze} size={96} />}
            />
          </Animated.View>
          <LinearGradient
            colors={['rgba(11,10,9,0.55)', 'rgba(11,10,9,0)', 'rgba(11,10,9,0.6)', Colors.bgPrimary]}
            locations={[0, 0.3, 0.75, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>

        <View style={styles.frame}>
          <View style={[styles.columns, wide && styles.columnsWide]}>
            <View style={styles.main}>
              {/* ─── Identity ─── */}
              <Animated.View entering={enterUp(0)} style={styles.artistIdentityWrap}>
                <Animated.View style={[styles.artistIdentity, identityStyle]}>
                  <View style={styles.avatarRing}>
                    <TAvatar uri={artist?.avatarUrl || user.avatarUrl} name={blaze} size="2xl" isPremium={isPremium} showBadge />
                  </View>
                  <View style={styles.kickerRow}>
                    <TText variant="label" color="accentWarm" uppercase>Espace artiste</TText>
                    {isPremium && <TBadge label="Premium" variant="premium" />}
                    {artist?.isVerified && (
                      <View style={styles.verified}>
                        <Ionicons name="checkmark-circle" size={14} color={Colors.accentWarm} />
                        <TText variant="caption" color="secondary">Profil vérifié</TText>
                      </View>
                    )}
                  </View>
                  <TText variant={wide ? 'displayXL' : 'displayL'} numberOfLines={2} style={styles.identityName} accessibilityRole="header">
                    {blaze}
                  </TText>
                  <TText variant="bodySmall" color="secondary" numberOfLines={1}>
                    {[city, ...stylesLabel].filter(Boolean).join(' · ') || 'Complétez votre profil pour être trouvé'}
                  </TText>
                </Animated.View>
              </Animated.View>

              {/* ─── Facts: real counters from the artist record ─── */}
              <Animated.View entering={enterUp(1)} style={styles.facts}>
                <Fact label="Publications" value={artist ? formatCount(artist.stats.posts) : '—'} loading={artistLoading} />
                <TDivider vertical tone="default" style={styles.factDivider} />
                <Fact label="Vues du profil" value={artist ? formatCount(artist.stats.profileViews) : '—'} loading={artistLoading} />
                <TDivider vertical tone="default" style={styles.factDivider} />
                <Fact label="Demandes du mois" value={artist ? formatCount(artist.stats.requestsThisMonth) : '—'} loading={artistLoading} />
              </Animated.View>

              {/* ─── Availability ─── */}
              <Animated.View entering={enterUp(2)} style={styles.statusRow}>
                <View style={{ flex: 1 }}>
                  <TText variant="label" color="tertiary" uppercase>Disponibilité</TText>
                  <View style={styles.statusValue}>
                    {status && <View style={[styles.dot, { backgroundColor: status.color }]} />}
                    <TText variant="body" weight="medium">{status?.label ?? 'Non renseignée'}</TText>
                  </View>
                </View>
                <TButton
                  title="Modifier"
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  accessibilityLabel="Modifier la disponibilité"
                  onPress={() => router.push('/(onboarding)/artist/step4')}
                />
              </Animated.View>

              {/* ─── Primary actions ─── */}
              <Animated.View entering={enterUp(3)} style={styles.actions}>
                <TButton
                  title="Publier"
                  size="md"
                  style={{ flex: 1 }}
                  fullWidth={false}
                  icon={<Ionicons name="add" size={18} color={Colors.textInverse} />}
                  onPress={() => router.push('/create')}
                  accessibilityLabel="Publier une réalisation"
                />
                <TButton
                  title="Voir mon profil"
                  variant="secondary"
                  size="md"
                  style={{ flex: 1 }}
                  fullWidth={false}
                  disabled={!hasPublicProfile}
                  onPress={() => router.push(`/artist/${artistId}`)}
                  accessibilityLabel="Voir mon profil public"
                />
              </Animated.View>

              {/* ─── Portfolio ─── */}
              <View style={styles.portfolio}>
                <View style={styles.portfolioHead}>
                  <TText variant="displayS">Portfolio</TText>
                  {portfolioState === 'ready' && photos.length > shown.length && hasPublicProfile && (
                    <Pressable onPress={() => router.push(`/artist/${artistId}`)} accessibilityRole="link" hitSlop={8}>
                      <TText variant="bodySmall" color="secondary" tabular style={styles.link}>
                        Tout voir ({photos.length})
                      </TText>
                    </Pressable>
                  )}
                </View>

                {portfolioState === 'loading' && (
                  <View style={styles.grid}>
                    {Array.from({ length: cols * 2 }).map((_, i) => (
                      <TSkeleton key={i} width={cell} height={Math.round(cell * 1.25)} radius={Radius.sm} />
                    ))}
                  </View>
                )}
                {portfolioState === 'error' && (
                  <EmptyState
                    icon="cloud-offline-outline"
                    title="Portfolio indisponible"
                    description="Le chargement a échoué. Vérifiez votre connexion."
                    ctaLabel="Réessayer"
                    onCta={() => { setPortfolioState('loading'); loadPortfolio(); }}
                    style={styles.inlineEmpty}
                  />
                )}
                {(portfolioState === 'idle' || (portfolioState === 'ready' && photos.length === 0)) && (
                  <EmptyState
                    icon="images-outline"
                    title="Votre mur est vide"
                    description="Publiez une première réalisation : c’est ce que les clients regardent avant de vous écrire."
                    ctaLabel="Publier une réalisation"
                    onCta={() => router.push('/create')}
                    style={styles.inlineEmpty}
                  />
                )}
                {portfolioState === 'ready' && shown.length > 0 && (
                  <View style={styles.grid}>
                    {shown.map((post, i) => (
                      <PressableScale
                        key={post.id}
                        onPress={() => router.push(`/post/${post.id}`)}
                        accessibilityRole="link"
                        accessibilityLabel={post.caption ?? `Réalisation ${i + 1}`}
                        style={[styles.cell, { width: cell, height: Math.round(cell * 1.25) }]}
                      >
                        <RevealImage uri={post.media_url} style={StyleSheet.absoluteFill} />
                      </PressableScale>
                    ))}
                  </View>
                )}
              </View>

              {!wide && artistLists}
            </View>

            {wide && <View style={styles.side}>{artistLists}</View>}
          </View>

          <SignOutButton onSignOut={handleSignOut} />
        </View>
      </Animated.ScrollView>

      <CompactBar top={insets.top} title={blaze} threshold={coverH - insets.top - BAR_H + 40} scrollY={scrollY}>
        <RoundButton icon="bar-chart-outline" label="Statistiques" onPress={() => router.push('/analytics')} onImage />
        <RoundButton icon="settings-outline" label="Paramètres" onPress={() => router.push('/settings')} onImage />
      </CompactBar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  frame: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center', paddingHorizontal: Layout.gutter },

  columns: {},
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing['2xl'] },
  main: { flex: 1, minWidth: 0 },
  side: { width: SIDE_W, paddingTop: Spacing.lg },

  // Sticky bar
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  barHairline: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderDefault,
  },
  barInner: {
    height: BAR_H, flexDirection: 'row', alignItems: 'center', gap: 12,
    width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center', paddingHorizontal: Layout.gutter,
  },
  barTitle: { flex: 1, minWidth: 0 },
  barActions: { flexDirection: 'row', gap: 8 },
  roundBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  roundBtnOnImage: { backgroundColor: 'rgba(11,10,9,0.55)', borderColor: Colors.glassBorderBright },

  identity: { paddingTop: Spacing.xs, paddingBottom: Spacing.xl, gap: 6, transformOrigin: 'left top' },
  identityName: { marginTop: Spacing.sm },

  // Artist cover
  cover: { overflow: 'hidden', backgroundColor: Colors.bgSurface },

  artistIdentityWrap: { marginTop: -56 },
  artistIdentity: { gap: 6, transformOrigin: 'left top' },
  avatarRing: { alignSelf: 'flex-start', borderRadius: 52, padding: 4, backgroundColor: Colors.bgPrimary },
  kickerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: Spacing.xs },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 5 },

  facts: {
    flexDirection: 'row', alignItems: 'stretch',
    marginTop: Spacing.lg, paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  fact: { flex: 1, gap: 6, minWidth: 0 },
  factDivider: { marginHorizontal: Spacing.sm },
  factNumber: { fontSize: 24, lineHeight: 28 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderDefault,
  },
  statusValue: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: Spacing.lg },

  portfolio: { marginTop: Spacing['2xl'] },
  portfolioHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: Spacing.sm },
  link: { textDecorationLine: 'underline' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: { overflow: 'hidden', borderRadius: Radius.sm, backgroundColor: Colors.bgSurface },
  inlineEmpty: { flex: 0, paddingVertical: Spacing.xl, paddingHorizontal: 0 },

  artistCta: {
    paddingTop: Spacing.lg, paddingBottom: Spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  artistCtaBody: { marginTop: Spacing['2xs'], marginBottom: Spacing.md, maxWidth: Layout.maxReading },

  // Grouped lists
  group: { marginTop: Spacing.xl },
  groupTitle: { marginBottom: Spacing['2xs'] },
  groupBody: {
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10 },
  rowIcon: { width: ICON_COL - 12 },
  rowText: { flex: 1, minWidth: 0, gap: 1 },

  signOut: { marginTop: Spacing['2xl'], maxWidth: 360, width: '100%', alignSelf: 'center' },
});
