import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollView, StyleSheet, View, TouchableOpacity, Animated as RNAnimated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TBadge } from '@/components/ui/TBadge';
import { TDivider } from '@/components/ui/TDivider';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuthStore } from '@/store/auth-store';

// ─── Animated bar chart
function BarChart({ data, labels, color = Colors.accentWarm }: { data: number[]; labels: string[]; color?: string }) {
  const max = Math.max(...data, 1);
  const anims = useRef(data.map(() => new RNAnimated.Value(0))).current;

  useEffect(() => {
    const animations = anims.map((a, i) =>
      RNAnimated.timing(a, {
        toValue: data[i] / max,
        duration: 600,
        delay: i * 60,
        useNativeDriver: false,
      })
    );
    RNAnimated.stagger(60, animations).start();
  }, []);

  return (
    <View style={chartStyles.wrap}>
      <View style={chartStyles.bars}>
        {data.map((val, i) => (
          <View key={i} style={chartStyles.barCol}>
            <View style={chartStyles.barBg}>
              <RNAnimated.View
                style={[
                  chartStyles.bar,
                  {
                    backgroundColor: color,
                    height: anims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <TText variant="micro" color="tertiary" style={chartStyles.label}>{labels[i]}</TText>
          </View>
        ))}
      </View>
    </View>
  );
}
const chartStyles = StyleSheet.create({
  wrap: { marginTop: Spacing.sm },
  bars: { flexDirection: 'row', height: 90, gap: 4, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barBg: { flex: 1, width: '80%', justifyContent: 'flex-end', backgroundColor: Colors.bgSurface, borderRadius: 3, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 3 },
  label: { textAlign: 'center' },
});

// ─── Animated metric card
function MetricCard({ label, value, trend, positive, delay = 0, icon }: {
  label: string; value: string; trend?: string; positive?: boolean; delay?: number; icon?: string;
}) {
  const anim = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      RNAnimated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 120 }).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);
  const scale = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.7, 1.05, 1] });
  const opacity = anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] });

  return (
    <RNAnimated.View style={[metricStyles.card, { transform: [{ scale }], opacity }]}>
      {icon && (
        <View style={metricStyles.iconWrap}>
          <Ionicons name={icon as any} size={16} color={Colors.accentWarm} />
        </View>
      )}
      <TText variant="caption" color="tertiary" style={{ marginBottom: 6 }}>{label}</TText>
      <TText variant="title1" weight="bold" style={{ letterSpacing: -1 }}>{value}</TText>
      {trend ? (
        <TText variant="micro" style={{ color: positive ? Colors.success : Colors.error, marginTop: 4 }}>
          {positive ? '↑ ' : '↓ '}{trend}
        </TText>
      ) : null}
    </RNAnimated.View>
  );
}
const metricStyles = StyleSheet.create({
  card: {
    flex: 1, minWidth: '45%',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg, padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  iconWrap: {
    width: 30, height: 30, borderRadius: Radius.sm,
    backgroundColor: 'rgba(200,168,130,0.10)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
});

export default function AnalyticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const isPremium = user?.artistTier === 'premium';
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');

  const views7d  = [120, 95, 180, 220, 145, 310, 240];
  const req7d    = [2, 1, 4, 3, 2, 5, 3];
  const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2" weight="semibold">Analytics</TText>
        <View style={{ width: 44 }} />
      </Animated.View>

      {/* Period selector */}
      <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.periodWrap}>
        <View style={styles.periodSelector}>
          {(['7d', '30d'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <TText variant="caption" weight="semibold" style={{ color: period === p ? Colors.bgPrimary : Colors.textSecondary }}>
                {p === '7d' ? '7 jours' : '30 jours'}
              </TText>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* Key metrics */}
      <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.metricsGrid}>
        <MetricCard label="Vues profil"        value="1 310" trend="+12%"  positive icon="eye-outline"         delay={0} />
        <MetricCard label="Demandes reçues"    value="20"    trend="+5%"   positive icon="document-text-outline" delay={60} />
        <MetricCard label="Taux de réponse"    value="85%"                          icon="checkmark-circle-outline" delay={120} />
        <MetricCard label="RDV confirmés"      value="8"     trend="+2"    positive icon="calendar-outline"     delay={180} />
      </Animated.View>

      <TDivider style={styles.divider} />

      {/* Profile views chart */}
      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.chartSection}>
        <TText variant="label" color="tertiary" uppercase style={{ marginBottom: 4 }}>Vues profil — 7 jours</TText>
        <BarChart data={views7d} labels={dayLabels} color={Colors.accentWarm} />
      </Animated.View>

      <TDivider style={styles.divider} />

      {/* Requests chart */}
      <Animated.View entering={FadeInDown.delay(260).springify()} style={styles.chartSection}>
        <TText variant="label" color="tertiary" uppercase style={{ marginBottom: 4 }}>Demandes reçues</TText>
        <BarChart data={req7d} labels={dayLabels} color={Colors.info} />
      </Animated.View>

      <TDivider style={styles.divider} />

      {/* Top posts */}
      <Animated.View entering={FadeInDown.delay(320).springify()} style={styles.section}>
        <TText variant="label" color="tertiary" uppercase style={{ marginBottom: Spacing.sm }}>Posts les plus vus</TText>
        {[
          { title: 'Oni mask épaule',              views: 847, likes: 398 },
          { title: 'Chrysanthème et carpe koï',    views: 623, likes: 284 },
          { title: 'Géométrie sacrée avant-bras',  views: 412, likes: 203 },
        ].map((post, i) => (
          <View key={i} style={styles.postRow}>
            <TText variant="bodySmall" weight="bold" color="tertiary" style={{ width: 20 }}>{i + 1}</TText>
            <TText variant="bodySmall" style={{ flex: 1 }}>{post.title}</TText>
            <View style={styles.postStats}>
              <TText variant="caption" color="secondary">{post.views}</TText>
              <TText variant="micro" color="tertiary"> vues</TText>
            </View>
          </View>
        ))}
      </Animated.View>

      {/* Premium funnel */}
      {isPremium && (
        <Animated.View entering={FadeInDown.delay(380).springify()}>
          <TDivider style={styles.divider} />
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <TText variant="label" color="tertiary" uppercase>Funnel de conversion</TText>
              <TBadge label="Premium" variant="premium" />
            </View>
            <GlassCard variant="glow" style={{ padding: Spacing.sm, gap: Spacing['2xs'] }}>
              {[
                { label: 'Vues feed', value: 4200, pct: 100 },
                { label: 'Vues profil', value: 1310, pct: 31 },
                { label: 'Demandes', value: 20, pct: 1.5 },
                { label: 'RDV confirmés', value: 8, pct: 0.2 },
              ].map((step, i) => (
                <View key={i} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <TText variant="caption" color="secondary">{step.label}</TText>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TText variant="caption" weight="semibold">{step.value.toLocaleString('fr')}</TText>
                      <TText variant="caption" color="tertiary">{step.pct}%</TText>
                    </View>
                  </View>
                  <View style={styles.funnelBg}>
                    <LinearGradient
                      colors={[Colors.accentWarm, Colors.accentGlow]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[styles.funnelFill, { width: `${Math.min(step.pct * 2.5, 100)}%` as any }]}
                    />
                  </View>
                </View>
              ))}
            </GlassCard>
          </View>
        </Animated.View>
      )}

      {!isPremium && (
        <Animated.View entering={FadeInDown.delay(380).springify()}>
          <TDivider style={styles.divider} />
          <TouchableOpacity
            style={styles.premiumCta}
            onPress={() => router.push('/settings/subscription')}
            activeOpacity={0.85}
          >
            <GlassCard variant="premium" style={styles.premiumCtaInner}>
              <TBadge label="Premium" variant="premium" />
              <TText variant="bodySmall" weight="semibold" style={{ marginTop: Spacing.xs }}>
                Funnel de conversion
              </TText>
              <TText variant="caption" color="secondary" style={{ marginTop: 4, lineHeight: 18 }}>
                Visualise ton parcours client complet : du feed aux RDV confirmés.
              </TText>
              <View style={styles.upgradeCta}>
                <TText variant="caption" style={{ color: Colors.accentWarm }}>Passer Premium →</TText>
              </View>
            </GlassCard>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xs'], height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  periodWrap: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg, padding: 4,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.md },
  periodBtnActive: { backgroundColor: Colors.accentWarm },
  metricsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 8, paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm,
  },
  divider: { marginHorizontal: Spacing.sm, marginVertical: Spacing.sm },
  chartSection: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm },
  section: { paddingHorizontal: Spacing.sm },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  postRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle,
  },
  postStats: { flexDirection: 'row', alignItems: 'baseline' },
  funnelBg: {
    height: 6, backgroundColor: Colors.bgSurface,
    borderRadius: 3, overflow: 'hidden',
  },
  funnelFill: { height: '100%', borderRadius: 3 },
  premiumCta: { paddingHorizontal: Spacing.sm },
  premiumCtaInner: { padding: Spacing.md },
  upgradeCta: {
    marginTop: Spacing.sm, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(200,168,130,0.12)',
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(200,168,130,0.25)',
  },
});
