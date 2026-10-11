import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView, StyleSheet, View, Pressable, Linking, Platform, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';
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
import { ArtPlaceholder, BOOKING_STATUS, styleName } from '@/components/ArtistCard';
import { useAuthStore } from '@/store/auth-store';
import { useArtist } from '@/hooks/use-artist';
import { fetchArtistPortfolio, isUuid } from '@/lib/catalog';
import type { Tables } from '@/lib/supabase';

const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const GAP = 3;
const ICON_COL = 34;
const SIDE_W = 340;

function enter(i: number, reduced: boolean) {
  return reduced ? undefined : FadeInDown.delay(i * 60).duration(600).easing(EASE);
}

const haptic = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

// ─── Building blocks ──────────────────────────────────────────────────────────
type InteractionState = { pressed: boolean; hovered?: boolean };

function RoundButton({ icon, label, onPress, onImage }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; onImage?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.roundBtn, onImage && styles.roundBtnOnImage, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={19} color={Colors.textPrimary} />
    </Pressable>
  );
}

function ListRow({ icon, label, subtitle, detail, accent, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; subtitle?: string; detail?: string;
  accent?: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => { haptic(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={[label, subtitle, detail].filter(Boolean).join(', ')}
      style={(state) => {
        const { pressed, hovered } = state as InteractionState;
        return [styles.row, (pressed || hovered) && styles.rowActive];
      }}
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
    </Pressable>
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

function Fact({ label, value, loading, dot }: { label: string; value: string; loading?: boolean; dot?: string }) {
  return (
    <View style={styles.fact} accessible accessibilityLabel={loading ? `${label}, chargement` : `${label} : ${value}`}>
      <TText variant="label" color="tertiary" uppercase numberOfLines={1}>{label}</TText>
      {loading ? (
        <TSkeleton width={48} height={22} />
      ) : (
        <View style={styles.factValue}>
          {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
          <TText variant="title2" serif tabular numberOfLines={1} style={styles.factNumber}>{value}</TText>
        </View>
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
  const [portfolioAttempt, setPortfolioAttempt] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!isUuid(artistId)) { setPortfolioState('idle'); return undefined; }
      let active = true;
      setPortfolioState((s) => (s === 'ready' ? s : 'loading'));
      fetchArtistPortfolio(artistId)
        .then((data) => { if (active) { setPosts(data.posts); setPortfolioState('ready'); } })
        .catch(() => { if (active) setPortfolioState('error'); });
      return () => { active = false; };
    }, [artistId, portfolioAttempt]),
  );
  const photos = useMemo(() => posts.filter((p) => p.media_type === 'photo'), [posts]);

  // Layout
  const frameW = Math.min(width, Layout.maxContent);
  const wide = width >= 960;
  const mainW = wide ? frameW - Layout.gutter * 2 - SIDE_W - Spacing['2xl'] : frameW - Layout.gutter * 2;
  const cols = mainW >= 640 ? 4 : 3;
  const cell = Math.floor((mainW - GAP * (cols - 1)) / cols);
  const shown = photos.slice(0, cols * 3);

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

    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 110 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.frame}>
            <View style={styles.topBar}>
              <TText variant="label" color="accentWarm" uppercase>Mon compte</TText>
              <RoundButton icon="settings-outline" label="Paramètres" onPress={() => router.push('/settings')} />
            </View>

            <View style={[styles.columns, wide && styles.columnsWide]}>
              <View style={styles.main}>
                <Animated.View entering={enter(0, reduced)} style={styles.identity}>
                  <TAvatar uri={user.avatarUrl} name={user.displayName} size="2xl" />
                  <TText variant="displayL" numberOfLines={2} style={styles.identityName} accessibilityRole="header">
                    {user.displayName || 'Votre profil'}
                  </TText>
                  <TText variant="bodySmall" color="secondary" numberOfLines={1}>
                    {[user.city, user.email].filter(Boolean).join(' · ')}
                  </TText>
                </Animated.View>

                {/* Artist acquisition: one quiet block, no invented social proof */}
                <Animated.View entering={enter(2, reduced)} style={styles.artistCta}>
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

                {!wide && <Animated.View entering={enter(3, reduced)}>{lists}</Animated.View>}
              </View>

              {wide && <View style={styles.side}>{lists}</View>}
            </View>

            <SignOutButton onSignOut={handleSignOut} />
          </View>
        </ScrollView>
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
  const coverH = wide ? 300 : 220;
  const hasPublicProfile = isUuid(artistId);

  const artistLists = (
    <View>
      <ListGroup title="Gérer">
        <ListRow icon="mail-outline" label="Demandes" subtitle="Nouvelles demandes et échanges" onPress={() => router.push('/(tabs)/inbox')} />
        <ListRow icon="calendar-outline" label="Agenda" subtitle="Rendez-vous à venir" onPress={() => router.push('/(tabs)/agenda')} />
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
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        {/* ─── Cover: the latest work, lit like an exhibit ─── */}
        <View style={[styles.cover, { height: coverH + insets.top }]}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} accessibilityLabel={`Travail de ${blaze}`} />
          ) : (
            <ArtPlaceholder name={blaze} size={96} />
          )}
          <LinearGradient
            colors={['rgba(11,10,9,0.55)', 'rgba(11,10,9,0)', 'rgba(11,10,9,0.6)', Colors.bgPrimary]}
            locations={[0, 0.3, 0.75, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.coverBar, { paddingTop: insets.top + 6 }]}>
            <TText variant="label" uppercase style={{ color: Colors.textPrimary }}>Espace artiste</TText>
            <View style={styles.coverActions}>
              <RoundButton icon="bar-chart-outline" label="Statistiques" onPress={() => router.push('/analytics')} onImage />
              <RoundButton icon="settings-outline" label="Paramètres" onPress={() => router.push('/settings')} onImage />
            </View>
          </View>
        </View>

        <View style={styles.frame}>
          <View style={[styles.columns, wide && styles.columnsWide]}>
            <View style={styles.main}>
              {/* ─── Identity ─── */}
              <Animated.View entering={enter(0, reduced)} style={styles.artistIdentity}>
                <View style={styles.avatarRing}>
                  <TAvatar uri={artist?.avatarUrl || user.avatarUrl} name={blaze} size="2xl" isPremium={isPremium} showBadge />
                </View>
                <View style={styles.kickerRow}>
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

              {/* ─── Facts: real counters from the artist record ─── */}
              <Animated.View entering={enter(1, reduced)} style={styles.facts}>
                <Fact label="Publications" value={artist ? formatCount(artist.stats.posts) : '—'} loading={artistLoading} />
                <TDivider vertical tone="default" style={styles.factDivider} />
                <Fact label="Vues du profil" value={artist ? formatCount(artist.stats.profileViews) : '—'} loading={artistLoading} />
                <TDivider vertical tone="default" style={styles.factDivider} />
                <Fact label="Demandes du mois" value={artist ? formatCount(artist.stats.requestsThisMonth) : '—'} loading={artistLoading} />
              </Animated.View>

              {/* ─── Availability ─── */}
              <Animated.View entering={enter(2, reduced)} style={styles.statusRow}>
                <View style={{ flex: 1 }}>
                  <TText variant="label" color="tertiary" uppercase>Disponibilité</TText>
                  <View style={[styles.factValue, { marginTop: 6 }]}>
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
              <Animated.View entering={enter(3, reduced)} style={styles.actions}>
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
                    onCta={() => setPortfolioAttempt((n) => n + 1)}
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
                      <Pressable
                        key={post.id}
                        onPress={() => router.push(`/post/${post.id}`)}
                        accessibilityRole="link"
                        accessibilityLabel={post.caption ?? `Réalisation ${i + 1}`}
                        style={({ pressed }) => [styles.cell, { width: cell, height: Math.round(cell * 1.25) }, pressed && { opacity: 0.85 }]}
                      >
                        <Image source={{ uri: post.media_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
                      </Pressable>
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
      </ScrollView>
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

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Spacing.xs, paddingBottom: Spacing.sm,
  },
  roundBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  roundBtnOnImage: { backgroundColor: 'rgba(11,10,9,0.55)', borderColor: Colors.glassBorderBright },

  identity: { paddingTop: Spacing.md, paddingBottom: Spacing.xl, gap: 6 },
  identityName: { marginTop: Spacing.sm },

  // Artist cover
  cover: { overflow: 'hidden', backgroundColor: Colors.bgSurface },
  coverBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center', paddingHorizontal: Layout.gutter,
  },
  coverActions: { flexDirection: 'row', gap: 8 },

  artistIdentity: { marginTop: -56, gap: 6 },
  avatarRing: {
    alignSelf: 'flex-start', borderRadius: 52, padding: 4, backgroundColor: Colors.bgPrimary,
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Spacing.xs, minHeight: 4 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 5 },

  facts: {
    flexDirection: 'row', alignItems: 'stretch',
    marginTop: Spacing.lg, paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  fact: { flex: 1, gap: 6, minWidth: 0 },
  factDivider: { marginHorizontal: Spacing.sm },
  factValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factNumber: { fontSize: 24, lineHeight: 28 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderDefault,
  },
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
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 56, paddingVertical: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  rowActive: { backgroundColor: Colors.glassBg },
  rowIcon: { width: ICON_COL - 12 },
  rowText: { flex: 1, minWidth: 0, gap: 1 },

  signOut: { marginTop: Spacing['2xl'], maxWidth: 360, width: '100%', alignSelf: 'center' },
});
