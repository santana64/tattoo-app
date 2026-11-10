import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { format } from 'date-fns/format';
import { fr } from 'date-fns/locale/fr';
import { Colors, Spacing, Layout, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TBadge } from '@/components/ui/TBadge';
import { TAvatar } from '@/components/ui/TAvatar';
import { THeader } from '@/components/ui/THeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { PressableScale } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import {
  listReports, listVerifications, resolveReport, reviewVerification, setBan,
  REPORT_REASONS, type ReportDecision, type ReportRow, type ReportStatus, type VerificationRow,
} from '@/lib/moderation';

type Tab = 'reports' | 'verifications';

const REPORT_FILTERS: { value: ReportStatus; label: string }[] = [
  { value: 'pending', label: 'À traiter' },
  { value: 'actioned', label: 'Sanctionnés' },
  { value: 'dismissed', label: 'Classés' },
];

const formatDate = (iso: string | null) => (iso ? format(new Date(iso), 'd MMM yyyy, HH:mm', { locale: fr }) : '—');

function Segment<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segmentItem, selected && styles.segmentItemSelected]}
          >
            <TText variant="bodySmall" weight={selected ? 'semibold' : 'medium'} color={selected ? 'primary' : 'tertiary'}>
              {option.label}
            </TText>
          </PressableScale>
        );
      })}
    </View>
  );
}

function ReportCard({ report, busy, onDecide, onUnban }: {
  report: ReportRow; busy: boolean;
  onDecide: (decision: ReportDecision) => void; onUnban: () => void;
}) {
  const pending = report.status === 'pending';
  const canRemove = report.target_type === 'post' || report.target_type === 'review';
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <TBadge label={REPORT_REASONS[report.reason]} variant="default" />
        <TText variant="caption" color="tertiary" tabular>{formatDate(report.created_at)}</TText>
      </View>

      <TText variant="body" weight="semibold" style={styles.cardTitle}>{report.target_label ?? 'Contenu supprimé'}</TText>
      <View style={styles.targetRow}>
        {!!report.target_media_url && (
          <Image
            source={{ uri: report.target_media_url }}
            style={styles.thumb}
            contentFit="cover"
            accessibilityLabel="Contenu signalé"
          />
        )}
        {!!report.target_excerpt && (
          <TText variant="bodySmall" color="secondary" numberOfLines={5} style={{ flex: 1 }}>
            {report.target_excerpt}
          </TText>
        )}
      </View>

      <TText variant="caption" color="tertiary" style={styles.meta}>
        Signalé par {report.reporter_name ?? 'un compte supprimé'}
        {report.description ? ` : « ${report.description} »` : ''}
      </TText>
      {!!report.target_owner_name && (
        <TText variant="caption" color={report.target_owner_banned ? 'accentWarm' : 'tertiary'} style={styles.meta}>
          Auteur : {report.target_owner_name}{report.target_owner_banned ? ' · compte suspendu' : ''}
        </TText>
      )}

      {pending ? (
        <View style={styles.actions}>
          {canRemove && (
            <TButton
              title="Retirer le contenu"
              variant="secondary"
              size="sm"
              disabled={busy}
              onPress={() => onDecide({ status: 'actioned', removeContent: true })}
            />
          )}
          {!!report.target_owner_id && !report.target_owner_banned && (
            <TButton
              title={canRemove ? 'Retirer et suspendre le compte' : 'Suspendre le compte'}
              variant="destructive"
              size="sm"
              disabled={busy}
              onPress={() => onDecide({ status: 'actioned', removeContent: canRemove, banOwner: true })}
            />
          )}
          <TButton
            title="Classer sans suite"
            variant="ghost"
            size="sm"
            disabled={busy}
            onPress={() => onDecide({ status: 'dismissed' })}
          />
        </View>
      ) : report.target_owner_banned && !!report.target_owner_id ? (
        <View style={styles.actions}>
          <TButton title="Lever la suspension" variant="secondary" size="sm" disabled={busy} onPress={onUnban} />
        </View>
      ) : null}
    </View>
  );
}

function VerificationCard({ item, busy, onReview }: {
  item: VerificationRow; busy: boolean; onReview: (approve: boolean) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.artistRow}>
        <TAvatar uri={item.avatar_url ?? undefined} name={item.blaze} size="md" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <TText variant="body" weight="semibold" numberOfLines={1}>{item.blaze}</TText>
          <TText variant="caption" color="tertiary" numberOfLines={1}>
            {item.city} · {item.stat_posts ?? 0} publication{(item.stat_posts ?? 0) > 1 ? 's' : ''}
          </TText>
        </View>
      </View>
      {!!item.bio && (
        <TText variant="bodySmall" color="secondary" numberOfLines={4} style={styles.meta}>{item.bio}</TText>
      )}
      <TText variant="caption" color="tertiary" tabular style={styles.meta}>
        Demande du {formatDate(item.submitted_at)} · compte créé le {formatDate(item.account_created_at)}
      </TText>
      <View style={styles.actions}>
        <TButton title="Vérifier le profil" variant="primary" size="sm" disabled={busy} onPress={() => onReview(true)} />
        <TButton title="Refuser" variant="ghost" size="sm" disabled={busy} onPress={() => onReview(false)} />
      </View>
    </View>
  );
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const isAdmin = useAuthStore((s) => s.user?.isAdmin === true);

  const [tab, setTab] = useState<Tab>('reports');
  const [filter, setFilter] = useState<ReportStatus>('pending');
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [reportResult, verificationResult] = await Promise.all([listReports(filter), listVerifications()]);
    setReports(reportResult.reports);
    setVerifications(verificationResult.verifications);
    setLoadError(reportResult.error ?? verificationResult.error);
    setLoading(false);
    setRefreshing(false);
  }, [filter]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    void load();
  }, [isAdmin, load]);

  const run = async (id: string, action: () => Promise<string | null>, done: string) => {
    if (busyId) return;
    setBusyId(id);
    const error = await action();
    setBusyId(null);
    if (error) {
      Toast.error(error);
      return;
    }
    Toast.success(done);
    void load();
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <THeader title="Modération" showBack />
        <EmptyState
          icon="lock-closed-outline"
          title="Accès réservé"
          description="Cet espace est réservé à l’équipe de modération."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <THeader title="Modération" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={Colors.accentWarm}
            colors={[Colors.accentWarm]}
          />
        }
      >
        <Segment
          options={[
            { value: 'reports' as Tab, label: 'Signalements' },
            { value: 'verifications' as Tab, label: `Vérifications${verifications.length ? ` (${verifications.length})` : ''}` },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'reports' && (
          <View style={styles.filters}>
            <Segment options={REPORT_FILTERS} value={filter} onChange={setFilter} />
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={Colors.textTertiary} style={styles.loader} accessibilityLabel="Chargement" />
        ) : loadError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Chargement impossible"
            description={loadError}
            ctaLabel="Réessayer"
            onCta={() => { setLoading(true); void load(); }}
            style={styles.empty}
          />
        ) : tab === 'reports' ? (
          reports.length ? (
            reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                busy={busyId === report.id}
                onDecide={(decision) => run(
                  report.id,
                  () => resolveReport(report.id, decision),
                  decision.status === 'dismissed' ? 'Signalement classé' : 'Signalement traité',
                )}
                onUnban={() => run(report.id, () => setBan(report.target_owner_id as string, false), 'Suspension levée')}
              />
            ))
          ) : (
            <EmptyState
              icon="checkmark-done-outline"
              title={filter === 'pending' ? 'Aucun signalement à traiter' : 'Aucun signalement ici'}
              description={filter === 'pending' ? 'Les nouveaux signalements apparaîtront ici.' : undefined}
              style={styles.empty}
            />
          )
        ) : verifications.length ? (
          verifications.map((item) => (
            <VerificationCard
              key={item.artist_id}
              item={item}
              busy={busyId === item.artist_id}
              onReview={(approve) => run(
                item.artist_id,
                () => reviewVerification(item.artist_id, approve),
                approve ? 'Profil vérifié' : 'Demande refusée',
              )}
            />
          ))
        ) : (
          <EmptyState
            icon="ribbon-outline"
            title="Aucune demande de vérification"
            description="Les artistes qui demandent le badge vérifié apparaîtront ici."
            style={styles.empty}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: {
    width: '100%', maxWidth: Layout.maxReading + Layout.gutter * 2, alignSelf: 'center',
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.lg,
  },
  segment: {
    flexDirection: 'row', gap: 4, padding: 4, borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  segmentItem: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm, paddingHorizontal: 8 },
  segmentItemSelected: { backgroundColor: Colors.bgElevated },
  filters: { marginTop: Spacing.sm },
  loader: { marginTop: Spacing['2xl'] },
  empty: { marginTop: Spacing['2xl'] },
  card: {
    marginTop: Spacing.md, padding: Spacing.sm, borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitle: { marginTop: Spacing.xs },
  targetRow: { flexDirection: 'row', gap: 12, marginTop: Spacing['2xs'] },
  thumb: { width: 72, height: 72, borderRadius: Radius.sm, backgroundColor: Colors.bgElevated },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meta: { marginTop: Spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.sm },
});
