import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TDivider } from '@/components/ui/TDivider';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { EASE_OUT, MotionDuration, PressableScale, RevealImage, enterUp } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import { supabase, type Tables } from '@/lib/supabase';
import { fetchArtistPortfolio } from '@/lib/catalog';

const DAY_INITIALS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // indexed by Date.getDay()

/** Labels for the 7 buckets built below: oldest first, today last. */
function lastSevenDayLabels() {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    return DAY_INITIALS[d.getDay()];
  });
}

// ─── Count-up: once, on first real value, ~700ms ease-out ─────────────────────
function useCountUp(target: number | null, reduced: boolean) {
  const [shown, setShown] = useState<number | null>(target);
  const played = useRef(false);
  useEffect(() => {
    if (target === null) { setShown(null); return undefined; }
    if (played.current || reduced || target === 0) { played.current = true; setShown(target); return undefined; }
    played.current = true;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / MotionDuration.reveal);
      const eased = 1 - Math.pow(1 - t, 4);
      setShown(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced]);
  return shown;
}

function Metric({ label, value, suffix = '', caption, loading, reduced }: {
  label: string; value: number | null; suffix?: string; caption?: string; loading: boolean; reduced: boolean;
}) {
  const shown = useCountUp(loading ? null : value, reduced);
  const display = value === null ? '—' : `${(shown ?? 0).toLocaleString('fr-FR')}${suffix}`;
  return (
    <View style={styles.metric} accessible accessibilityLabel={loading ? `${label}, chargement` : `${label} : ${value === null ? 'non disponible' : `${value}${suffix}`}`}>
      <TText variant="label" color="tertiary" uppercase numberOfLines={1}>{label}</TText>
      {loading ? (
        <TSkeleton width={72} height={34} style={{ marginTop: 8 }} />
      ) : (
        <TText variant="displayM" tabular style={styles.metricValue}>{display}</TText>
      )}
      {!!caption && <TText variant="caption" color="tertiary">{caption}</TText>}
    </View>
  );
}

// ─── Understated bar chart: grows once (scaleY), today in gold ────────────────
function Bar({ ratio, progress, highlight }: { ratio: number; progress: SharedValue<number>; highlight: boolean }) {
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: Math.max(ratio * progress.get(), 0.001) }] }));
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, { backgroundColor: highlight ? Colors.accentWarm : Colors.textTertiary }, style]} />
    </View>
  );
}

function BarChart({ data, labels, reduced, emptyLabel }: { data: number[]; labels: string[]; reduced: boolean; emptyLabel: string }) {
  const max = Math.max(...data, 1);
  const total = data.reduce((a, b) => a + b, 0);
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    progress.set(withTiming(1, { duration: reduced ? 1 : MotionDuration.reveal, easing: EASE_OUT }));
  }, [progress, reduced]);

  return (
    <View
      accessible
      accessibilityLabel={total === 0 ? emptyLabel : data.map((v, i) => `${labels[i]} : ${v}`).join(', ')}
    >
      <View style={styles.bars}>
        {data.map((val, i) => (
          <View key={i} style={styles.barCol}>
            <TText variant="micro" color="tertiary" tabular style={{ opacity: val > 0 ? 1 : 0 }}>{val}</TText>
            <Bar ratio={val / max} progress={progress} highlight={i === data.length - 1} />
            <TText variant="micro" color={i === data.length - 1 ? 'accentWarm' : 'tertiary'}>{labels[i]}</TText>
          </View>
        ))}
      </View>
      {total === 0 && <TText variant="caption" color="tertiary" style={{ marginTop: Spacing['2xs'] }}>{emptyLabel}</TText>}
    </View>
  );
}

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
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
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

  const wide = width >= 820;
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

  return (
    <View style={styles.container}>
      <THeader title="Statistiques" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={enterUp(0)} style={styles.titleRow}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <TText variant="label" color="accentWarm" uppercase>Votre activité</TText>
            <TText variant="displayM" style={{ marginTop: 4 }} accessibilityRole="header">
              Les <TText variant="displayM" italic color="accentGlow">chiffres</TText>
            </TText>
          </View>
          <View style={styles.periodToggle} accessibilityRole="radiogroup">
            {(['7d', '30d'] as const).map((p) => {
              const active = period === p;
              return (
                <PressableScale
                  key={p}
                  onPress={() => setPeriod(p)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.periodBtn, active && styles.periodBtnActive]}
                >
                  <TText variant="bodySmall" weight="medium" style={{ color: active ? Colors.textInverse : Colors.textSecondary }}>
                    {p === '7d' ? '7 jours' : '30 jours'}
                  </TText>
                </PressableScale>
              );
            })}
          </View>
        </Animated.View>

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
            <Animated.View entering={enterUp(1)} style={[styles.metrics, wide && styles.metricsWide]}>
              <Metric label="Vues du profil" value={analytics.profileViews} caption={periodLabel} loading={loading} reduced={reduced} />
              <Metric label="Demandes reçues" value={analytics.requestsReceived} caption={periodLabel} loading={loading} reduced={reduced} />
              <Metric
                label="Taux d’acceptation"
                value={analytics.requestsReceived > 0 ? analytics.responseRate : null}
                suffix=" %"
                caption={analytics.requestsReceived > 0 ? periodLabel : 'Aucune demande sur la période'}
                loading={loading}
                reduced={reduced}
              />
              <Metric label="Rendez-vous confirmés" value={analytics.confirmedAppointments} caption="Au statut confirmé" loading={loading} reduced={reduced} />
            </Animated.View>

            {/* Charts */}
            <View style={[styles.charts, wide && styles.chartsWide]}>
              <View style={styles.chart}>
                <TText variant="title2" serif style={styles.chartTitle}>Vues du profil</TText>
                <TText variant="caption" color="tertiary">7 derniers jours, aujourd’hui à droite</TText>
                {loading ? <TSkeleton height={120} radius={Radius.sm} style={{ marginTop: Spacing.sm }} /> : (
                  <BarChart data={analytics.viewsByDay} labels={dayLabels} reduced={reduced} emptyLabel="Aucune vue sur les 7 derniers jours." />
                )}
              </View>
              <View style={styles.chart}>
                <TText variant="title2" serif style={styles.chartTitle}>Demandes reçues</TText>
                <TText variant="caption" color="tertiary">7 derniers jours, aujourd’hui à droite</TText>
                {loading ? <TSkeleton height={120} radius={Radius.sm} style={{ marginTop: Spacing.sm }} /> : (
                  <BarChart data={analytics.requestsByDay} labels={dayLabels} reduced={reduced} emptyLabel="Aucune demande sur les 7 derniers jours." />
                )}
              </View>
            </View>
          </>
        )}

        {/* Top posts — real view counters */}
        <View style={styles.section}>
          <TText variant="title2" serif style={styles.chartTitle}>Réalisations les plus vues</TText>
          {topPosts === null ? (
            <View style={{ gap: 10, marginTop: Spacing.sm }}>
              {[0, 1, 2].map((i) => <TSkeleton key={i} height={56} radius={Radius.sm} />)}
            </View>
          ) : topPosts.length === 0 ? (
            <TText variant="bodySmall" color="tertiary" style={{ marginTop: Spacing.xs }}>
              Publiez une réalisation pour suivre ses vues ici.
            </TText>
          ) : (
            <View style={styles.list}>
              {topPosts.map((post, i) => (
                <React.Fragment key={post.id}>
                  {i > 0 && <TDivider inset={76} />}
                  <PressableScale
                    onPress={() => router.push(`/post/${post.id}`)}
                    pressedScale={0.985}
                    accessibilityRole="link"
                    accessibilityLabel={`${post.caption ?? `Réalisation ${i + 1}`}, ${post.views_count ?? 0} vues, ${post.likes_count ?? 0} j’aime`}
                    style={styles.postRow}
                  >
                    <TText variant="bodySmall" color="accentWarm" tabular style={{ width: 16 }}>{i + 1}</TText>
                    <RevealImage uri={post.media_url} style={styles.thumb} />
                    <TText variant="bodySmall" numberOfLines={1} style={{ flex: 1 }}>{post.caption || 'Sans légende'}</TText>
                    <View style={{ alignItems: 'flex-end' }}>
                      <TText variant="bodySmall" weight="medium" tabular>{(post.views_count ?? 0).toLocaleString('fr-FR')} vues</TText>
                      <TText variant="caption" color="tertiary" tabular>{(post.likes_count ?? 0).toLocaleString('fr-FR')} j’aime</TText>
                    </View>
                  </PressableScale>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* Conversion path */}
        {isPremium ? (
          <View style={styles.section}>
            <TText variant="title2" serif style={styles.chartTitle}>Parcours de conversion</TText>
            <TText variant="caption" color="tertiary">{periodLabel}</TText>
            {analytics.profileViews === 0 && !loading ? (
              <TText variant="bodySmall" color="tertiary" style={{ marginTop: Spacing.xs }}>
                Pas encore assez de vues sur la période pour calculer un parcours.
              </TText>
            ) : (
              <View style={{ marginTop: Spacing.sm, gap: Spacing.sm }}>
                {funnel.map((step) => {
                  const pct = analytics.profileViews > 0 ? (step.value / analytics.profileViews) * 100 : 0;
                  return (
                    <View key={step.label} accessible accessibilityLabel={`${step.label} : ${step.value}`}>
                      <View style={styles.funnelHead}>
                        <TText variant="bodySmall" color="secondary">{step.label}</TText>
                        <TText variant="bodySmall" weight="medium" tabular>
                          {step.value.toLocaleString('fr-FR')}
                          <TText variant="caption" color="tertiary" tabular>{`  ${pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`}</TText>
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
          </View>
        ) : (
          <View style={styles.section}>
            <GlassCard variant="premium" radius={Radius.lg}>
              <TText variant="label" color="accentWarm" uppercase>INKR Premium</TText>
              <TText variant="title2" serif style={[styles.chartTitle, { marginTop: 6 }]}>Parcours de conversion</TText>
              <TText variant="bodySmall" color="secondary" style={{ marginTop: 4, marginBottom: Spacing.md }}>
                Voyez où vos visiteurs s’arrêtent, des vues du profil aux demandes acceptées.
              </TText>
              <TButton
                title="Découvrir Premium"
                variant="glow"
                size="sm"
                fullWidth={false}
                icon={<Ionicons name="arrow-forward" size={14} color={Colors.textInverse} />}
                iconPosition="right"
                onPress={() => router.push('/settings/subscription')}
              />
            </GlassCard>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: {
    width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center',
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.xl,
  },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.md },
  periodToggle: {
    flexDirection: 'row', gap: 4, padding: 3,
    borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  periodBtn: { height: 36, paddingHorizontal: 16, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  periodBtnActive: { backgroundColor: Colors.accentAction },

  metrics: {
    flexDirection: 'row', flexWrap: 'wrap', marginTop: Spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  metricsWide: { flexWrap: 'nowrap' },
  metric: {
    flexGrow: 1, flexBasis: '50%', minWidth: 150, paddingVertical: Spacing.md, paddingRight: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  metricValue: { marginTop: 6 },

  charts: { marginTop: Spacing.xl, gap: Spacing.xl },
  chartsWide: { flexDirection: 'row' },
  chart: { flex: 1 },
  chartTitle: { fontSize: 22, lineHeight: 26 },
  bars: { flexDirection: 'row', height: 132, gap: 6, alignItems: 'flex-end', marginTop: Spacing.sm },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barTrack: { flex: 1, width: '70%', maxWidth: 28, justifyContent: 'flex-end', borderRadius: 2, overflow: 'hidden', backgroundColor: Colors.bgSurface },
  barFill: { height: '100%', width: '100%', transformOrigin: 'bottom' },

  section: { marginTop: Spacing['2xl'] },
  list: {
    marginTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  postRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 64 },
  thumb: { width: 44, height: 44, borderRadius: Radius.sm },

  funnelHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  funnelTrack: { height: 4, borderRadius: 2, backgroundColor: Colors.bgSurface, overflow: 'hidden' },
  funnelFill: { height: '100%', borderRadius: 2, backgroundColor: Colors.accentWarm },
  inlineEmpty: { flex: 0, paddingVertical: Spacing.xl },
});
