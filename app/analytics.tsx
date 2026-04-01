import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TBadge } from '@/components/ui/TBadge';
import { TDivider } from '@/components/ui/TDivider';
import { useAuthStore } from '@/store/auth-store';

// Simple bar chart
function SimpleBarChart({ data, max }: { data: number[]; max: number }) {
  return (
    <View style={chartStyles.container}>
      {data.map((val, i) => (
        <View key={i} style={chartStyles.barWrapper}>
          <View style={[chartStyles.bar, { height: Math.max(4, (val / max) * 100) }]} />
        </View>
      ))}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 4 },
  barWrapper: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 100 },
  bar: { width: '80%', backgroundColor: Colors.accent, borderRadius: 3 },
});

export default function AnalyticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const isPremium = user?.artistTier === 'premium';
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');

  const profileViews = [120, 95, 180, 220, 145, 310, 240];
  const requests = [2, 1, 4, 3, 2, 5, 3];

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2">Analytics</TText>
        <View style={{ width: 44 }} />
      </View>

      {/* Period selector */}
      <View style={styles.periodSelector}>
        {(['7d', '30d'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
          >
            <TText
              variant="caption"
              weight="semibold"
              style={{ color: period === p ? Colors.textInverse : Colors.textSecondary }}
            >
              {p === '7d' ? '7 jours' : '30 jours'}
            </TText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Key metrics */}
      <View style={styles.metricsGrid}>
        <MetricCard label="Vues profil" value="1 310" trend="+12%" positive />
        <MetricCard label="Demandes reçues" value="20" trend="+5%" positive />
        <MetricCard label="Taux de réponse" value="85%" trend="" positive />
        <MetricCard label="RDV confirmés" value="8" trend="+2" positive />
      </View>

      <TDivider style={styles.divider} />

      {/* Profile views chart */}
      <View style={styles.chartSection}>
        <TText variant="bodySmall" weight="semibold" style={styles.chartTitle}>
          Vues profil — 7 derniers jours
        </TText>
        <SimpleBarChart data={profileViews} max={Math.max(...profileViews)} />
        <View style={styles.chartLabels}>
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
            <TText key={i} variant="caption" color="tertiary" style={{ flex: 1, textAlign: 'center' }}>
              {d}
            </TText>
          ))}
        </View>
      </View>

      <TDivider style={styles.divider} />

      {/* Top posts */}
      <View style={styles.section}>
        <TText variant="bodySmall" weight="semibold" style={styles.sectionTitle}>
          Posts les plus vus
        </TText>
        {[
          { title: 'Oni mask épaule', views: 847, likes: 398 },
          { title: 'Chrysanthème et carpe koï', views: 623, likes: 284 },
          { title: 'Géométrie sacrée avant-bras', views: 412, likes: 203 },
        ].map((post, i) => (
          <View key={i} style={styles.postRow}>
            <TText variant="caption" color="tertiary" style={styles.postRank}>
              {i + 1}
            </TText>
            <TText variant="bodySmall" style={{ flex: 1 }}>{post.title}</TText>
            <TText variant="caption" color="secondary">{post.views} vues</TText>
            <TText variant="caption" color="tertiary" style={{ marginLeft: 8 }}>
              {post.likes} ♥
            </TText>
          </View>
        ))}
      </View>

      {/* Premium funnel */}
      {isPremium && (
        <>
          <TDivider style={styles.divider} />
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <TText variant="bodySmall" weight="semibold">Funnel de conversion</TText>
              <TBadge label="Premium" variant="premium" />
            </View>
            <View style={styles.funnel}>
              {[
                { label: 'Vues du feed', value: 4200, pct: '100%' },
                { label: 'Vues profil', value: 1310, pct: '31%' },
                { label: 'Demandes envoyées', value: 20, pct: '1.5%' },
                { label: 'RDV confirmés', value: 8, pct: '40%' },
              ].map((step, i) => (
                <View key={i} style={styles.funnelStep}>
                  <View style={[styles.funnelBar, { width: `${parseFloat(step.pct) * 2}%` as any }]} />
                  <View style={styles.funnelText}>
                    <TText variant="bodySmall">{step.label}</TText>
                    <View style={styles.funnelNumbers}>
                      <TText variant="bodySmall" weight="semibold">{step.value.toLocaleString('fr')}</TText>
                      <TText variant="caption" color="tertiary" style={{ marginLeft: 8 }}>{step.pct}</TText>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {!isPremium && (
        <>
          <TDivider style={styles.divider} />
          <TouchableOpacity style={styles.premiumCta} onPress={() => router.push('/settings/subscription')}>
            <TBadge label="Premium" variant="premium" />
            <TText variant="bodySmall" color="secondary" style={{ flex: 1, marginLeft: Spacing['2xs'] }}>
              Débloque le funnel de conversion et les analytics avancées.
            </TText>
            <Ionicons name="chevron-forward" size={16} color={Colors.accentWarm} />
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

function MetricCard({ label, value, trend, positive }: { label: string; value: string; trend: string; positive: boolean }) {
  return (
    <View style={metricStyles.card}>
      <TText variant="caption" color="tertiary" style={{ marginBottom: 4 }}>{label}</TText>
      <TText variant="title1" weight="bold">{value}</TText>
      {trend ? (
        <TText variant="caption" style={{ color: positive ? Colors.success : Colors.error, marginTop: 2 }}>
          {trend}
        </TText>
      ) : null}
    </View>
  );
}

const metricStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  periodSelector: {
    flexDirection: 'row',
    margin: Spacing.sm,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    padding: 4,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  periodBtnActive: { backgroundColor: Colors.accentAction },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  divider: { marginHorizontal: Spacing.sm, marginVertical: Spacing['2xs'] },
  chartSection: { padding: Spacing.sm },
  chartTitle: { marginBottom: Spacing['2xs'] },
  chartLabels: { flexDirection: 'row', marginTop: 4 },
  section: { padding: Spacing.sm },
  sectionTitle: { marginBottom: Spacing['2xs'] },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing['2xs'] },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  postRank: { width: 24 },
  funnel: { gap: 8 },
  funnelStep: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.sm,
    padding: Spacing['2xs'],
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  funnelBar: {
    height: 3,
    backgroundColor: Colors.accent,
    borderRadius: 2,
    marginBottom: 6,
    minWidth: 20,
  },
  funnelText: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  funnelNumbers: { flexDirection: 'row', alignItems: 'center' },
  premiumCta: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: 'rgba(200,168,130,0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(200,168,130,0.2)',
  },
});
