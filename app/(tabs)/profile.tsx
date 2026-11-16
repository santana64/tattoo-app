import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TBadge } from '@/components/ui/TBadge';
import { TButton } from '@/components/ui/TButton';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { PressableScale } from '@/components/motion';
import {
  ArtCanvas, EditorialTitle, InkPanel, Kicker, Masthead, MetricGrid, PageWrap, Rule, SectionHead,
  SettingRow, StatusDot, TextLink, type Metric, type StatusTone,
} from '@/components/v5';
import { InkActionRow, NumberedRow, Panel } from '@/components/v5/studio';
import { BOOKING_STATUS, styleName } from '@/components/ArtistCard';
import { INQUIRY_LABEL, formatListDate, projectTypeLabel } from '@/components/RequestCard';
import { useAuthStore } from '@/store/auth-store';
import { useRequestStore, type TattooRequest } from '@/store/request-store';
import { useArtist } from '@/hooks/use-artist';
import { useContentDimensions, useShell } from '@/hooks/useContentDimensions';
import { fetchArtistPortfolio, isUuid } from '@/lib/catalog';
import type { Tables } from '@/lib/supabase';

const GAP = 3;
const PRIORITY_MAX = 4;

const STATUS_TONE: Record<'open' | 'paused' | 'closed', StatusTone> = { open: 'open', paused: 'wait', closed: 'closed' };

const formatCount = (n: number) => n.toLocaleString('fr-FR');

// ─── Building blocks ──────────────────────────────────────────────────────────
function SignOutButton({ onSignOut }: { onSignOut: () => void }) {
  return (
    <View style={styles.signOut}>
      <TButton
        title="Se déconnecter"
        variant="destructive"
        size="md"
        onPress={onSignOut}
        icon={<Ionicons name="log-out-outline" size={17} color={Colors.error} />}
      />
    </View>
  );
}

function ProfileSkeleton({ top }: { top: number }) {
  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <PageWrap style={{ gap: 14, paddingTop: Spacing.xl }}>
        <TSkeleton width={120} height={11} />
        <TSkeleton width="60%" height={48} />
        <TSkeleton width="40%" height={48} />
        <TSkeleton height={1} style={{ marginTop: Spacing.sm }} />
        <TSkeleton height={120} style={{ marginTop: Spacing.md }} />
        <TSkeleton height={220} />
      </PageWrap>
    </View>
  );
}

/** One request waiting for the artist's decision. */
function PriorityRow({ request, onPress }: { request: TattooRequest; onPress: () => void }) {
  const name = request.clientName || 'Client';
  const summary = request.isInquiry
    ? INQUIRY_LABEL
    : [projectTypeLabel(request.projectType), request.bodyZone].filter(Boolean).join(' · ');
  const date = formatListDate(request.submittedAt);
  return (
    <SettingRow
      title={name}
      description={[summary, date].filter(Boolean).join(' · ')}
      onPress={onPress}
      accessibilityLabel={`${name}, ${summary}${date ? `, reçue le ${date}` : ''}. Ouvre la demande`}
    />
  );
}

function PrioritySkeleton() {
  return (
    <View style={{ gap: 18, paddingTop: 18 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ gap: 8 }}>
          <TSkeleton width="45%" height={22} />
          <TSkeleton width="65%" height={12} />
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width, isWide, gutter } = useContentDimensions();
  const { hasSidebar } = useShell();
  const { user, signOut } = useAuthStore();
  const isArtist = user?.role === 'artist';
  const artistId = isArtist ? user?.artistId ?? '' : '';
  const isPremium = user?.artistTier === 'premium';
  const userId = user?.id;

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

  // Requests (shared store, the same one the inbox and the tab badge read). The
  // first focus loads with a visible state; later focuses refresh in place.
  const requests = useRequestStore((s) => s.requests);
  const requestsError = useRequestStore((s) => s.error);
  const fetchRequests = useRequestStore((s) => s.fetchRequests);
  const requestsLoadedRef = useRef(false);
  const [requestsReady, setRequestsReady] = useState(false);
  const loadRequests = useCallback(() => {
    if (!isArtist || !userId) return undefined;
    let active = true;
    // A previous failure is retried with a visible state so the error can clear.
    const silent = requestsLoadedRef.current && !useRequestStore.getState().error;
    fetchRequests(userId, 'artist', silent ? { silent: true } : undefined)
      .finally(() => {
        requestsLoadedRef.current = true;
        if (active) setRequestsReady(true);
      });
    return () => { active = false; };
  }, [isArtist, userId, fetchRequests]);
  useFocusEffect(loadRequests);

  const handleSignOut = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    signOut().catch(() => Toast.error('Déconnexion impossible. Réessayez.'));
  };

  if (!user) return <ProfileSkeleton top={insets.top} />;

  const bottomPad = hasSidebar ? Spacing['3xl'] : insets.bottom + 110;

  const adminRow = user.isAdmin ? (
    <SettingRow title="Modération" description="Signalements et vérifications" onPress={() => router.push('/admin')} />
  ) : null;

  // ── Client ──────────────────────────────────────────────────────────────────
  if (!isArtist) {
    const name = user.displayName || 'Votre profil';
    const meta = [user.city, user.email].filter(Boolean).join(' · ');

    const identity = (
      <InkPanel style={[styles.clientIdentity, isWide && { flex: 1, minHeight: 420 }]}>
        <Kicker tone="flameOnInk">Compte client</Kicker>
        <TAvatar uri={user.avatarUrl} name={user.displayName} size="xl" style={{ marginTop: Spacing.lg }} />
        <EditorialTitle size="section" onInk numberOfLines={2} style={{ marginTop: Spacing.md }}>{name}</EditorialTitle>
        {meta ? (
          <TText variant="bodySmall" color="onInkMuted" numberOfLines={2} style={{ marginTop: Spacing.xs }}>{meta}</TText>
        ) : null}
        <TText variant="bodySmall" color="onInkMuted" style={styles.clientNote}>
          Votre identité sert à faciliter les échanges avec les artistes, pas à exposer vos données.
        </TText>
        <View style={styles.clientIdentityAction}>
          <TButton
            title="Modifier mon profil"
            variant="glass"
            size="md"
            fullWidth={false}
            onPress={() => router.push('/settings/account')}
          />
        </View>
      </InkPanel>
    );

    const projects = (
      <View style={isWide ? { flex: 1.15 } : undefined}>
        <Kicker>Vos projets</Kicker>
        <Rule tone="ink" style={{ marginTop: 12 }} />
        <NumberedRow index={1} title="Mes demandes" description="Suivi et messages avec les artistes" onPress={() => router.push('/(tabs)/inbox')} />
        <NumberedRow index={2} title="Artistes enregistrés" description="Les profils que vous gardez sous la main" onPress={() => router.push('/saved')} />
        <NumberedRow index={3} title="Réalisations aimées" description="Les pièces qui vous ont arrêté" onPress={() => router.push('/saved?tab=liked')} />
      </View>
    );

    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
        >
          <PageWrap>
            <Masthead
              kicker="Profil / Votre espace"
              title="Le carnet"
              emphasis="de soi."
              breakEmphasis
              description="Vos demandes, les artistes que vous suivez de près et vos préférences, au même endroit."
            />

            <View style={[styles.split, isWide && styles.splitWide]}>
              {identity}
              {projects}
            </View>

            {/* Artist acquisition: one quiet block, no invented social proof */}
            <Panel style={styles.block}>
              <Kicker tone="flame">Espace artiste</Kicker>
              <TText variant="displayS" style={styles.ctaTitle}>
                Vous êtes <TText variant="displayS" italic color="accentGlow" style={styles.ctaTitle}>tatoueur</TText> ?
              </TText>
              <TText variant="bodySmall" color="secondary" style={styles.ctaBody}>
                Présentez votre portfolio, recevez des demandes détaillées et suivez vos rendez-vous au même endroit.
              </TText>
              <TButton
                title="Créer un espace artiste"
                variant="secondary"
                size="md"
                fullWidth={false}
                onPress={() => router.push('/(auth)/role-select')}
              />
            </Panel>

            <View style={styles.block}>
              <SectionHead kicker="Le compte" title="Réglages" emphasis="et aide." />
              <Rule tone="ink" />
              <SettingRow title="Informations personnelles" description="Nom, ville" onPress={() => router.push('/settings/account')} />
              <SettingRow title="Notifications" onPress={() => router.push('/settings/notifications')} />
              <SettingRow title="Confidentialité" onPress={() => router.push('/settings/privacy')} />
              <SettingRow title="Paramètres" description="Tous les réglages du compte" onPress={() => router.push('/settings')} />
              <SettingRow title="Aide et support" onPress={() => router.push('/settings/support')} />
              {adminRow}
            </View>

            <SignOutButton onSignOut={handleSignOut} />
          </PageWrap>
        </ScrollView>
      </View>
    );
  }

  // ── Artist: the studio ──────────────────────────────────────────────────────
  const blaze = artist?.blaze ?? user.artistBlaze ?? user.displayName;
  const city = artist?.city ?? user.city ?? '';
  const stylesLabel = (artist?.styles ?? []).slice(0, 3).map(styleName);
  const bookingKey = artist?.bookingStatus ?? user.artistBookingStatus;
  const status = bookingKey ? BOOKING_STATUS[bookingKey] : null;
  const hasPublicProfile = isUuid(artistId);

  // Figures: only what the stores and the artist record actually hold.
  const requestsLoading = !requestsReady;
  const pending = requests.filter((r) => r.status === 'submitted');
  const statValue = (n: number | undefined) => (artistLoading ? '—' : artist && n !== undefined ? formatCount(n) : '—');
  const metrics: Metric[] = [
    {
      label: 'Nouvelles demandes',
      value: requestsLoading || requestsError ? '—' : formatCount(pending.length),
      hint: requestsLoading ? 'Chargement' : requestsError ? 'Indisponible' : 'À traiter',
      onPress: () => router.push('/(tabs)/inbox'),
    },
    {
      label: 'Demandes du mois',
      value: statValue(artist?.stats.requestsThisMonth),
      hint: artistLoading ? 'Chargement' : undefined,
      onPress: () => router.push('/analytics'),
    },
    {
      label: 'Vues du profil',
      value: statValue(artist?.stats.profileViews),
      hint: artistLoading ? 'Chargement' : undefined,
      onPress: () => router.push('/analytics'),
    },
    {
      label: 'Publications',
      value: statValue(artist?.stats.posts),
      hint: artistLoading ? 'Chargement' : undefined,
      onPress: hasPublicProfile ? () => router.push(`/artist/${artistId}`) : undefined,
    },
  ];

  // Portfolio grid geometry, from the width actually left to the page.
  const contentW = Math.min(width, Layout.maxContent) - gutter * 2;
  const cols = isWide ? 6 : contentW >= 560 ? 4 : 3;
  const cell = Math.floor((contentW - GAP * (cols - 1)) / cols);
  const shown = photos.slice(0, cols * 2);

  let priorityBody: React.ReactNode;
  if (requestsLoading && requests.length === 0) {
    priorityBody = <PrioritySkeleton />;
  } else if (requestsError && pending.length === 0) {
    priorityBody = (
      <View style={styles.priorityNote} accessibilityRole="alert">
        <TText variant="bodySmall" color="secondary">Les demandes n’ont pas pu être chargées.</TText>
        <TextLink
          label="Réessayer"
          icon="refresh"
          onPress={() => { if (userId) void fetchRequests(userId, 'artist'); }}
          style={{ marginTop: Spacing.xs }}
        />
      </View>
    );
  } else if (pending.length === 0) {
    priorityBody = (
      <View style={styles.priorityNote}>
        <TText variant="displayS" style={styles.quietTitle}>Rien en attente.</TText>
        <TText variant="bodySmall" color="secondary" style={{ marginTop: 6 }}>
          Aucune demande n’attend votre réponse. Les nouvelles demandes apparaîtront ici.
        </TText>
      </View>
    );
  } else {
    priorityBody = (
      <View>
        {!!requestsError && (
          <View style={styles.priorityNote} accessibilityRole="alert">
            <TText variant="bodySmall" color="secondary">Actualisation impossible. Ces demandes peuvent dater.</TText>
            <TextLink label="Réessayer" icon="refresh" onPress={() => { if (userId) void fetchRequests(userId, 'artist'); }} />
          </View>
        )}
        {pending.slice(0, PRIORITY_MAX).map((r) => (
          <PriorityRow key={r.id} request={r} onPress={() => router.push(`/request/${r.id}`)} />
        ))}
        {pending.length > PRIORITY_MAX ? (
          <TText variant="caption" color="tertiary" tabular style={{ marginTop: Spacing.sm }}>
            {`${pending.length - PRIORITY_MAX} autre${pending.length - PRIORITY_MAX > 1 ? 's' : ''} dans la boîte de réception`}
          </TText>
        ) : null}
      </View>
    );
  }

  type StudioAction = { label: string; hint: string; to: Href; a11y?: string };
  const premiumActions: StudioAction[] = [
    { label: 'Personnalisation', hint: 'Sections et informations du profil', to: '/customization' },
    { label: 'Guide Premium', hint: 'Conseils pour votre profil', to: '/premium-guide' },
  ];
  const actions: StudioAction[] = [
    { label: 'Publier une œuvre', hint: 'Photo, vidéo ou lien', to: '/create', a11y: 'Publier une réalisation' },
    { label: 'Publier une story', hint: 'Visible pendant 24 heures', to: '/story/new' },
    { label: 'Publier un flash', hint: 'Un dessin prêt à réserver', to: '/flash/new' },
    { label: 'Annoncer un guest', hint: 'Vos dates dans un autre studio', to: '/guest/new' },
    { label: 'Agenda', hint: 'Rendez-vous à venir', to: '/(tabs)/agenda' },
    { label: 'Horaires et disponibilités', hint: 'Créneaux visibles par vos clients', to: '/availability' },
    { label: 'Statistiques', hint: 'Vues, demandes, acceptation', to: '/analytics' },
    ...(isPremium ? premiumActions : []),
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <PageWrap>
          <Masthead
            kicker="Le studio / Outils d’atelier"
            title="Le studio."
            emphasis="Votre rythme."
            titleSize="section"
            description="Vos demandes et vos prochains gestes, au même endroit."
            style={styles.studioMasthead}
            action={(
              <TButton
                title="Nouvelle publication"
                size="md"
                fullWidth={false}
                icon={<Ionicons name="add" size={17} color={Colors.paper} />}
                iconPosition="right"
                onPress={() => router.push('/create')}
                accessibilityLabel="Publier une réalisation"
              />
            )}
          />

          {/* ─── Identity strip ─── */}
          <View style={[styles.identity, isWide && styles.identityWide]}>
            <View style={styles.identityMain}>
              <TAvatar uri={artist?.avatarUrl || user.avatarUrl} name={blaze} size="lg" isPremium={isPremium} showBadge />
              <View style={{ flex: 1, minWidth: 0 }}>
                <TText variant="displayS" numberOfLines={1} style={styles.blaze} accessibilityRole="header">{blaze}</TText>
                <TText variant="caption" color="secondary" numberOfLines={1} style={{ marginTop: 2 }}>
                  {[city, ...stylesLabel].filter(Boolean).join(' · ') || 'Complétez votre profil pour être trouvé'}
                </TText>
                {(isPremium || artist?.isVerified) ? (
                  <View style={styles.badges}>
                    {isPremium ? <TBadge label="Premium" variant="premium" /> : null}
                    {artist?.isVerified ? (
                      <View style={styles.verified}>
                        <Ionicons name="checkmark" size={13} color={Colors.flameText} />
                        <TText variant="caption" color="secondary">Profil vérifié</TText>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>

            <View style={[styles.identitySide, isWide && styles.identitySideWide]}>
              <View style={styles.availability}>
                <Kicker tone="muted">Disponibilité</Kicker>
                <View style={styles.availabilityLine}>
                  {status && bookingKey
                    ? <StatusDot tone={STATUS_TONE[bookingKey]} label={status.label} />
                    : <TText variant="caption" color="secondary">Non renseignée</TText>}
                  <TextLink
                    label="Modifier"
                    icon="create-outline"
                    onPress={() => router.push('/(onboarding)/artist/step4')}
                    accessibilityLabel="Modifier la disponibilité"
                  />
                </View>
              </View>
              <TButton
                title="Voir mon profil"
                variant="secondary"
                size="md"
                fullWidth={false}
                disabled={!hasPublicProfile}
                onPress={() => router.push(`/artist/${artistId}`)}
                accessibilityLabel="Voir mon profil public"
              />
            </View>
          </View>

          {/* ─── Board: priority beside the ink actions ─── */}
          <View style={[styles.board, isWide && styles.boardWide]}>
            <Panel style={isWide ? { flex: 1.7 } : undefined}>
              <View style={styles.priorityHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Kicker>Votre priorité</Kicker>
                  <TText variant="displayS" accessibilityRole="header" style={styles.panelTitle}>La boîte de réception.</TText>
                </View>
                <TextLink label="Toutes les demandes" onPress={() => router.push('/(tabs)/inbox')} />
              </View>
              <Rule tone="ink" style={{ marginTop: Spacing.sm }} />
              {priorityBody}
            </Panel>

            <InkPanel style={isWide ? { flex: 1 } : undefined}>
              <Kicker tone="flameOnInk">Atelier / Actions</Kicker>
              <EditorialTitle size="section" onInk style={styles.inkTitle}>{'Créer.\nPartager.\nOrganiser.'}</EditorialTitle>
              <View style={{ marginTop: Spacing.lg }}>
                {actions.map((a, i) => (
                  <InkActionRow
                    key={a.label}
                    index={i + 1}
                    label={a.label}
                    hint={a.hint}
                    accessibilityLabel={a.a11y ? `${a.a11y}, ${a.hint}` : undefined}
                    onPress={() => router.push(a.to)}
                    last={i === actions.length - 1}
                  />
                ))}
              </View>
            </InkPanel>
          </View>

          {/* Figures follow the work that needs a decision. */}
          <Kicker style={styles.metricsKicker}>Vue artiste / Vos chiffres</Kicker>
          <MetricGrid items={metrics} />

          {/* ─── Portfolio ─── */}
          <View style={styles.block}>
            <SectionHead
              kicker="Votre vitrine"
              title="Portfolio."
              action={portfolioState === 'ready' && photos.length > shown.length && hasPublicProfile
                ? { label: `Tout voir (${photos.length})`, onPress: () => router.push(`/artist/${artistId}`) }
                : undefined}
            />

            {portfolioState === 'loading' && (
              <View style={styles.grid}>
                {Array.from({ length: cols }).map((_, i) => (
                  <TSkeleton key={i} width={cell} height={Math.round(cell * 1.25)} />
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
                    style={{ width: cell }}
                  >
                    <ArtCanvas uri={post.media_url} />
                  </PressableScale>
                ))}
              </View>
            )}
          </View>

          {/* ─── Account ─── */}
          <View style={styles.block}>
            <SectionHead kicker="Le compte" title="Réglages" emphasis="et aide." />
            <Rule tone="ink" />
            <SettingRow
              title="Abonnement"
              description={isPremium ? 'Premium' : 'Gratuit · découvrir Premium'}
              onPress={() => router.push('/settings/subscription')}
              accessibilityLabel={`Abonnement, ${isPremium ? 'Premium' : 'Gratuit'}`}
            />
            <SettingRow title="Paramètres" description="Compte, notifications, confidentialité" onPress={() => router.push('/settings')} />
            <SettingRow title="Aide et support" onPress={() => router.push('/settings/support')} />
            {adminRow}
          </View>

          <SignOutButton onSignOut={handleSignOut} />
        </PageWrap>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  block: { marginTop: Spacing['3xl'] },

  // Client
  split: { gap: Spacing.xl },
  splitWide: { flexDirection: 'row', alignItems: 'stretch', gap: Spacing['2xl'] },
  clientIdentity: {},
  clientNote: { marginTop: Spacing.lg, maxWidth: 420, lineHeight: 22 },
  clientIdentityAction: { marginTop: Spacing.xl, alignSelf: 'flex-start' },
  ctaTitle: { fontSize: 32, lineHeight: 34, letterSpacing: -0.6 },
  ctaBody: { marginTop: Spacing.xs, marginBottom: Spacing.md, maxWidth: Layout.maxReading },

  // Artist identity strip
  studioMasthead: { paddingTop: Spacing.lg, paddingBottom: Spacing.lg, marginBottom: Spacing.lg },
  identity: { gap: Spacing.lg, marginBottom: Spacing.xl },
  identityWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identityMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1, minWidth: 0 },
  blaze: { fontSize: 32, lineHeight: 34, letterSpacing: -0.6 },
  badges: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  identitySide: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.md },
  identitySideWide: { alignItems: 'center', gap: Spacing.xl },
  availability: { gap: 6 },
  availabilityLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: Spacing.md, rowGap: 4 },

  metricsKicker: { marginTop: Spacing['3xl'], marginBottom: Spacing.sm },

  // Board
  board: { marginTop: Spacing.xl, gap: Spacing.md },
  boardWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 17 },
  priorityHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.sm },
  panelTitle: { marginTop: 10, fontSize: 32, lineHeight: 34, letterSpacing: -0.6 },
  priorityNote: { paddingVertical: Spacing.lg },
  quietTitle: { fontSize: 26, lineHeight: 28 },
  inkTitle: { marginTop: Spacing.md },

  // Portfolio
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  inlineEmpty: { flex: 0, paddingVertical: Spacing.xl, paddingHorizontal: 0 },

  signOut: { marginTop: Spacing['2xl'], maxWidth: 360, width: '100%' },
});
