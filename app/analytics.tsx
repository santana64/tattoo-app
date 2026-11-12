import React, { useState, useEffect, useCallback } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  ArtCanvas, InkPanel, Kicker, Masthead, MetricGrid, PageWrap, Rule, SectionHead, type Metric,
} from '@/components/v5';
import { Panel, Segmented, cartelNumber } from '@/components/v5/studio';
import { useAuthStore } from '@/store/auth-store';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { supabase, type Tables } from '@/lib/supabase';
import { fetchArtistPortfolio } from '@/lib/catalog';

const DAY_INITIALS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // indexed by Date.getDay()
const CHART_H = 132;

/** Labels for the 7 buckets built below: oldest first, today last. */
function lastSevenDayLabels() {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    return DAY_INITIALS[d.getDay()];
  });
}

const formatNumber = (n: number) => n.toLocaleString('fr-FR');

// ─── Bar chart: ink bars on a ruled baseline, today in vermilion ──────────────
function BarChart({ data, labels, emptyLabel }: { data: number[]; labels: string[]; emptyLabel: string }) {
  const max = Math.max(...data, 1);
  const total = data.reduce((a, b) => a + b, 0);
  return (
    <View
      accessible
      accessibilityLabel={total === 0 ? emptyLabel : data.map((v, i) => `${labels[i]} : ${v}`).join(', ')}
    >
      <View style={styles.bars}>
        {data.map((val, i) => {
          const today = i === data.length - 1;
          return (
            <View key={i} style={styles.barCol}>
              <TText variant="micro" color="secondary" tabular style={{ opacity: val > 0 ? 1 : 0, letterSpacing: 0 }}>{val}</TText>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { height: `${(val / max) * 100}%`, backgroundColor: today ? Colors.flame : Colors.ink },
                    val > 0 && { minHeight: 2 },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
      <Rule tone="ink" />
      <View style={styles.barLabels}>
        {labels.map((l, i) => (
          <TText
            key={i}
            variant="micro"
            style={[styles.barLabel, { color: i === labels.length - 1 ? Colors.flameText : Colors.textSecondary }]}
          >
            {l}
          </TText>
        ))}
      </View>
      {total === 0 && <TText variant="caption" color="secondary" style={{ marginTop: Spacing['2xs'] }}>{emptyLabel}</TText>}
    </View>
  );
}

function ChartSkeleton() {
  return (
    <View style={{ marginTop: Spacing.md }}>
      <View style={[styles.bars, { alignItems: 'flex-end' }]}>
        {[40, 70, 30, 85, 55, 60, 45].map((h, i) => (
          <View key={i} style={styles.barCol}><TSkeleton width={18} height={Math.round((h / 100) * (CHART_H - 20))} /></View>
        ))}
      </View>
      <Rule tone="ink" />
    </View>
  );
}

type Hover = { pressed: boolean; hovered?: boolean };

interface AnalyticsData {
  profileViews: number;
  requestsReceived: number;
  acceptedRequests: number;
  responseRate: number;
  confirmedAppointments: number;
  viewsByDay: number[];
  requestsByDay: number[];
}

const EMPTY_ANALYTICS: AnalyticsData = {
  profileViews: 0,
  requestsReceived: 0,
  acceptedRequests: 0,
  responseRate: 0,
  confirmedAppointments: 0,
  viewsByDay: [0, 0, 0, 0, 0, 0, 0],
  requestsByDay: [0, 0, 0, 0, 0, 0, 0],
};

export default function AnalyticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isWide } = useContentDimensions();
  const { user } = useAuthStore();
  const isPremium = user?.artistTier === 'premium';
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');
  const [analytics, setAnalytics] = useState<AnalyticsData>(EMPTY_ANALYTICS);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [topPosts, setTopPosts] = useState<Tables<'posts'>[] | null>(null);

  const dayLabels = lastSevenDayLabels();
  const loading = state === 'loading';

  useEffect(() => {
    if (!user?.artistId) return;
    let active = true;

    const fetchAnalytics = async () => {
      const days = period === '7d' ? 7 : 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      // Profile views
      const { data: viewEvents, error: viewsError } = await supabase
        .from('artist_analytics_events')
        .select('created_at')
        .eq('artist_id', user.artistId!)
        .eq('event_type', 'profile_view')
        .gte('created_at', since.toISOString());

      // Requests received
      const { data: requests, error: requestsError } = await supabase
        .from('tattoo_requests')
        .select('status, submitted_at')
        .eq('artist_id', user.artistId!)
        .gte('submitted_at', since.toISOString());

      // Confirmed appointments
      const { count: confirmedCount } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('artist_id', user.artistId!)
        .eq('status', 'confirmed');

      if (!active) return;
      if (viewsError || requestsError) { setState('error'); return; }

      const totalReqs = requests?.length ?? 0;
      const acceptedReqs = requests?.filter((r) => r.status === 'accepted' || r.status === 'confirmed' || r.status === 'completed').length ?? 0;

      // Build per-day buckets (7 days)
      const viewsByDay = Array(7).fill(0);
      const reqsByDay = Array(7).fill(0);
      const now = Date.now();

      viewEvents?.forEach((e) => {
        if (!e.created_at) return;
        const daysAgo = Math.floor((now - new Date(e.created_at).getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo >= 0 && daysAgo < 7) viewsByDay[6 - daysAgo]++;
      });
      requests?.forEach((r) => {
        if (!r.submitted_at) return;
        const daysAgo = Math.floor((now - new Date(r.submitted_at).getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo >= 0 && daysAgo < 7) reqsByDay[6 - daysAgo]++;
      });

      setAnalytics({
        profileViews: viewEvents?.length ?? 0,
        requestsReceived: totalReqs,
        acceptedRequests: acceptedReqs,
        responseRate: totalReqs > 0 ? Math.round((acceptedReqs / totalReqs) * 100) : 0,
        confirmedAppointments: confirmedCount ?? 0,
        viewsByDay,
        requestsByDay: reqsByDay,
      });
      setState('ready');
    };

    setState('loading');
    fetchAnalytics().catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [user?.artistId, period, attempt]);

  // Most viewed published work (real counters on the posts table).
  const loadTopPosts = useCallback(() => {
    if (!user?.artistId) return undefined;
    let active = true;
    fetchArtistPortfolio(user.artistId)
      .then(({ posts }) => {
        if (!active) return;
        const sorted = [...posts].sort((a, b) => (b.views_count ?? 0) - (a.views_count ?? 0) || (b.likes_count ?? 0) - (a.likes_count ?? 0));
        setTopPosts(sorted.slice(0, 3));
      })
      .catch(() => { if (active) setTopPosts([]); });
    return () => { active = false; };
  }, [user?.artistId]);
  useEffect(() => loadTopPosts(), [loadTopPosts]);

  const periodLabel = period === '7d' ? '7 derniers jours' : '30 derniers jours';

  if (user && (user.role !== 'artist' || !user.artistId)) {
    return (
      <View style={styles.container}>
        <THeader title="Statistiques" showBack />
        <EmptyState
          icon="analytics-outline"
          title={user.role !== 'artist' ? 'Réservé aux artistes' : 'Profil artiste introuvable'}
          description={user.role !== 'artist'
            ? 'Les statistiques suivent les vues et les demandes reçues par un profil d’artiste.'
            : 'Terminez la création de votre profil d’artiste pour suivre vos statistiques.'}
          ctaLabel="Retour"
          onCta={() => router.back()}
        />
      </View>
    );
  }

  const funnel = [
    { label: 'Vues du profil', value: analytics.profileViews },
    { label: 'Demandes reçues', value: analytics.requestsReceived },
    { label: 'Demandes acceptées', value: analytics.acceptedRequests },
  ];

  const hasRequests = analytics.requestsReceived > 0;
  const metrics: Metric[] = [
    { label: 'Vues du profil', value: loading ? '—' : formatNumber(analytics.profileViews), hint: loading ? 'Chargement' : periodLabel },
    { label: 'Demandes reçues', value: loading ? '—' : formatNumber(analytics.requestsReceived), hint: loading ? 'Chargement' : periodLabel },
    {
      label: 'Taux d’acceptation',
      value: loading || !hasRequests ? '—' : `${formatNumber(analytics.responseRate)} %`,
      hint: loading ? 'Chargement' : hasRequests ? periodLabel : 'Aucune demande sur la période',
    },
    { label: 'Rendez-vous confirmés', value: loading ? '—' : formatNumber(analytics.confirmedAppointments), hint: loading ? 'Chargement' : 'Au statut confirmé' },
  ];

  const periodControl = (
    <Segmented
      accessibilityLabel="Période"
      value={period}
      onChange={setPeriod}
      options={[{ value: '7d', label: '7 jours' }, { value: '30d', label: '30 jours' }]}
    />
  );

  return (
    <View style={styles.container}>
      <THeader title="Statistiques" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        <PageWrap>
          <Masthead
            kicker="Studio / Indicateurs"
            title="La création."
            emphasis="Et sa portée."
            breakEmphasis
            description="Des indicateurs lisibles pour comprendre vos demandes, sans transformer votre travail en course aux chiffres."
            action={periodControl}
          />

          {state === 'error' ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Statistiques indisponibles"
              description="Le chargement a échoué. Vérifiez votre connexion."
              ctaLabel="Réessayer"
              onCta={() => setAttempt((n) => n + 1)}
              style={styles.inlineEmpty}
            />
          ) : (
            <>
              {/* Key metrics — real values only */}
              <MetricGrid items={metrics} />

              {/* Charts */}
              <View style={[styles.charts, isWide && styles.chartsWide]}>
                <Panel style={isWide ? { flex: 1 } : undefined}>
                  <Kicker>Évolution / 7 jours</Kicker>
                  <TText variant="displayS" style={styles.panelTitle}>Vues du profil.</TText>
                  <TText variant="caption" color="secondary">7 derniers jours, aujourd’hui à droite</TText>
                  {loading ? <ChartSkeleton /> : (
                    <BarChart data={analytics.viewsByDay} labels={dayLabels} emptyLabel="Aucune vue sur les 7 derniers jours." />
                  )}
                </Panel>
                <Panel style={isWide ? { flex: 1 } : undefined}>
                  <Kicker>Évolution / 7 jours</Kicker>
                  <TText variant="displayS" style={styles.panelTitle}>Demandes reçues.</TText>
                  <TText variant="caption" color="secondary">7 derniers jours, aujourd’hui à droite</TText>
                  {loading ? <ChartSkeleton /> : (
                    <BarChart data={analytics.requestsByDay} labels={dayLabels} emptyLabel="Aucune demande sur les 7 derniers jours." />
                  )}
                </Panel>
              </View>
            </>
          )}

          <View style={[styles.lower, isWide && styles.lowerWide]}>
            {/* Top posts — real view counters */}
            <View style={isWide ? { flex: 1.5 } : undefined}>
              <SectionHead kicker="Les plus vues" title="Les œuvres qui" emphasis="interpellent." />
              <Rule tone="ink" />
              {topPosts === null ? (
                <View style={{ gap: 10, marginTop: Spacing.sm }}>
                  {[0, 1, 2].map((i) => <TSkeleton key={i} height={64} />)}
                </View>
              ) : topPosts.length === 0 ? (
                <TText variant="bodySmall" color="secondary" style={{ marginTop: Spacing.md }}>
                  Publiez une réalisation pour suivre ses vues ici.
                </TText>
              ) : (
                <View>
                  {topPosts.map((post, i) => (
                    <Pressable
                      key={post.id}
                      onPress={() => router.push(`/post/${post.id}`)}
                      accessibilityRole="link"
                      accessibilityLabel={`${post.caption ?? `Réalisation ${i + 1}`}, ${post.views_count ?? 0} vues, ${post.likes_count ?? 0} j’aime`}
                      style={(s) => [
                        styles.postRow,
                        Platform.OS === 'web' && ({ cursor: 'pointer' } as object),
                        ((s as Hover).hovered || (s as Hover).pressed) && { backgroundColor: Colors.wash },
                      ]}
                    >
                      <TText variant="label" tabular style={styles.postIndex}>{cartelNumber(i + 1)}</TText>
                      <ArtCanvas uri={post.media_url} aspectRatio={1} style={styles.thumb} />
                      <TText variant="bodySmall" numberOfLines={2} style={{ flex: 1 }}>{post.caption || 'Sans légende'}</TText>
                      <View style={{ alignItems: 'flex-end' }}>
                        <TText variant="bodySmall" weight="semibold" tabular>{`${formatNumber(post.views_count ?? 0)} vues`}</TText>
                        <TText variant="caption" color="secondary" tabular>{`${formatNumber(post.likes_count ?? 0)} j’aime`}</TText>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Conversion path */}
            <InkPanel style={isWide ? { flex: 1 } : undefined}>
              {isPremium ? (
                <>
                  <Kicker tone="flameOnInk">Parcours de conversion</Kicker>
                  <TText variant="displayS" color="onInk" style={styles.panelTitle}>Au-delà des vues.</TText>
                  <TText variant="caption" color="onInkMuted">{periodLabel}</TText>
                  {analytics.profileViews === 0 && !loading ? (
                    <TText variant="bodySmall" color="onInkMuted" style={{ marginTop: Spacing.md }}>
                      Pas encore assez de vues sur la période pour calculer un parcours.
                    </TText>
                  ) : (
                    <View style={{ marginTop: Spacing.lg }}>
                      {funnel.map((step) => {
                        const pct = analytics.profileViews > 0 ? (step.value / analytics.profileViews) * 100 : 0;
                        return (
                          <View key={step.label} style={styles.funnelRow} accessible accessibilityLabel={`${step.label} : ${step.value}`}>
                            <View style={styles.funnelHead}>
                              <TText variant="displayS" color="onInk" style={styles.funnelLabel}>{step.label}</TText>
                              <TText variant="bodySmall" weight="semibold" tabular color="onInk">
                                {formatNumber(step.value)}
                                <TText variant="caption" tabular color="flameOnInk">{`  ${pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`}</TText>
                              </TText>
                            </View>
                            <View style={styles.funnelTrack}>
                              <View style={[styles.funnelFill, { width: `${Math.max(pct, step.value > 0 ? 2 : 0)}%` }]} />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Kicker tone="flameOnInk">INKR Premium</Kicker>
                  <TText variant="displayS" color="onInk" style={styles.panelTitle}>Parcours de conversion.</TText>
                  <TText variant="bodySmall" color="onInkMuted" style={{ marginTop: 4, marginBottom: Spacing.lg }}>
                    Voyez où vos visiteurs s’arrêtent, des vues du profil aux demandes acceptées.
                  </TText>
                  <TButton
                    title="Découvrir Premium"
                    variant="glow"
                    size="md"
                    fullWidth={false}
                    icon={<Ionicons name="arrow-forward" size={14} color="#FFFFFF" />}
                    iconPosition="right"
                    onPress={() => router.push('/settings/subscription')}
                  />
                </>
              )}
            </InkPanel>
          </View>
        </PageWrap>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  charts: { marginTop: Spacing.xl, gap: Spacing.md },
  chartsWide: { flexDirection: 'row', gap: 17 },
  panelTitle: { fontSize: 30, lineHeight: 32, letterSpacing: -0.6, marginTop: 10, marginBottom: 4 },
  bars: { flexDirection: 'row', height: CHART_H, gap: 8, alignItems: 'flex-end', marginTop: Spacing.md, paddingHorizontal: 4 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  barTrack: { flex: 1, width: '72%', maxWidth: 34, justifyContent: 'flex-end' },
  barFill: { width: '100%' },
  barLabels: { flexDirection: 'row', gap: 8, paddingHorizontal: 4, marginTop: 6 },
  barLabel: { flex: 1, textAlign: 'center', letterSpacing: 0 },

  lower: { marginTop: Spacing['3xl'], gap: Spacing.xl },
  lowerWide: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing['2xl'] },
  postRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, minHeight: 68,
    borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  postIndex: { width: 22, color: Colors.flameText },
  thumb: { width: 48, height: 48 },

  funnelRow: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.onInkLine },
  funnelHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  funnelLabel: { fontSize: 22, lineHeight: 25, flexShrink: 1 },
  funnelTrack: { height: 3, backgroundColor: Colors.onInkLine, overflow: 'hidden' },
  funnelFill: { height: '100%', backgroundColor: Colors.flame },
  inlineEmpty: { flex: 0, paddingVertical: Spacing.xl },
});
