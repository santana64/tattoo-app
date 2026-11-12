import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { format } from 'date-fns/format';
import { formatDistanceToNowStrict } from 'date-fns/formatDistanceToNowStrict';
import { fr } from 'date-fns/locale/fr';
import { Colors, Spacing, Layout, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TAvatar } from '@/components/ui/TAvatar';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { BottomSheet } from '@/components/motion';
import { Kicker, Masthead, Rule, StatusDot, type StatusTone } from '@/components/v5';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useAuthStore } from '@/store/auth-store';
import {
  listReports, listVerifications, resolveReport, reviewVerification, setBan,
  REPORT_REASONS, type ReportDecision, type ReportRow, type ReportStatus, type VerificationRow,
} from '@/lib/moderation';
import { clearClientErrors, fetchClientErrors } from '@/lib/care';
import { groupClientErrors, type ClientErrorGroup } from '@/lib/error-reporting';

type Tab = 'reports' | 'verifications' | 'errors';
type Hover = { pressed: boolean; hovered?: boolean };

const PLATFORM_LABELS: Record<string, string> = { web: 'Web', ios: 'iOS', android: 'Android' };
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' });
const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color, color', transitionDuration: '180ms' } as object)
  : null;

const relativeDate = (iso: string) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: fr });

const REPORT_FILTERS: { value: ReportStatus; label: string }[] = [
  { value: 'pending', label: 'À traiter' },
  { value: 'actioned', label: 'Sanctionnés' },
  { value: 'dismissed', label: 'Classés' },
];

const REPORT_STATUS: Record<ReportStatus, { tone: StatusTone; label: string }> = {
  pending: { tone: 'alert', label: 'À traiter' },
  actioned: { tone: 'closed', label: 'Sanctionné' },
  dismissed: { tone: 'closed', label: 'Classé' },
};

const formatDate = (iso: string | null) => (iso ? format(new Date(iso), 'd MMM yyyy, HH:mm', { locale: fr }) : '—');

/** Board tabs: tracked capitals over a hairline, the current one underlined in vermilion. */
function Tabs<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (value: T) => void;
}) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={(state) => [
              styles.tab,
              webPointer,
              selected && styles.tabSelected,
              !selected && (state as Hover).hovered && styles.tabHover,
            ]}
          >
            <TText
              variant="label"
              weight="bold"
              uppercase
              numberOfLines={1}
              style={{ color: selected ? Colors.ink : Colors.textSecondary, letterSpacing: 1.1 }}
            >
              {option.label}
            </TText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Secondary filter: pills (the only rounded control), same tab semantics. */
function FilterPills<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (value: T) => void;
}) {
  return (
    <View style={styles.pills} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={{ top: 4, bottom: 4 }}
            style={(state) => [
              styles.pill,
              webPointer,
              !selected && ((state as Hover).hovered || (state as Hover).pressed) && styles.pillHover,
              selected && styles.pillSelected,
            ]}
          >
            <TText variant="caption" weight="semibold" style={{ color: selected ? Colors.paper : Colors.ink, fontSize: 12.5 }}>
              {option.label}
            </TText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Ledger row: content at the left, actions in their own column on wide screens. */
function LedgerRow({ wide, children, actions }: { wide: boolean; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <View style={[styles.ledgerRow, wide && styles.ledgerRowWide]}>
      <View style={styles.ledgerMain}>{children}</View>
      {actions ? <View style={[styles.actions, wide && styles.actionsWide]}>{actions}</View> : null}
    </View>
  );
}

function ReportCard({ report, busy, wide, onDecide, onUnban }: {
  report: ReportRow; busy: boolean; wide: boolean;
  onDecide: (decision: ReportDecision) => void; onUnban: () => void;
}) {
  const pending = report.status === 'pending';
  const canRemove = report.target_type === 'post' || report.target_type === 'review';
  // The row's status is an untyped string from the RPC: unknown values fall back to "pending" styling.
  const status = (REPORT_STATUS as Record<string, { tone: StatusTone; label: string } | undefined>)[report.status]
    ?? REPORT_STATUS.pending;

  const actions = pending ? (
    <>
      {canRemove && (
        <TButton
          title="Retirer le contenu"
          variant="secondary"
          size="sm"
          fullWidth={wide}
          disabled={busy}
          onPress={() => onDecide({ status: 'actioned', removeContent: true })}
        />
      )}
      {!!report.target_owner_id && !report.target_owner_banned && (
        <TButton
          title={canRemove ? 'Retirer et suspendre le compte' : 'Suspendre le compte'}
          variant="destructive"
          size="sm"
          fullWidth={wide}
          disabled={busy}
          onPress={() => onDecide({ status: 'actioned', removeContent: canRemove, banOwner: true })}
        />
      )}
      <TButton
        title="Classer sans suite"
        variant="ghost"
        size="sm"
        fullWidth={wide}
        disabled={busy}
        onPress={() => onDecide({ status: 'dismissed' })}
      />
    </>
  ) : report.target_owner_banned && !!report.target_owner_id ? (
    <TButton title="Lever la suspension" variant="secondary" size="sm" fullWidth={wide} disabled={busy} onPress={onUnban} />
  ) : undefined;

  return (
    <LedgerRow wide={wide} actions={actions}>
      <View style={styles.rowHead}>
        <StatusDot tone={status.tone} label={status.label} />
        <TText variant="caption" color="secondary" tabular>{formatDate(report.created_at)}</TText>
      </View>
      <Kicker tone="flame" style={styles.reason}>{REPORT_REASONS[report.reason]}</Kicker>

      <TText variant="displayS" style={styles.rowTitle}>{report.target_label ?? 'Contenu supprimé'}</TText>
      {(!!report.target_media_url || !!report.target_excerpt) && (
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
      )}

      <TText variant="caption" color="secondary" style={styles.meta}>
        Signalé par {report.reporter_name ?? 'un compte supprimé'}
        {report.description ? ` : « ${report.description} »` : ''}
      </TText>
      {!!report.target_owner_name && (
        <TText variant="caption" color={report.target_owner_banned ? 'accentWarm' : 'secondary'} style={styles.meta}>
          Auteur : {report.target_owner_name}{report.target_owner_banned ? ' · compte suspendu' : ''}
        </TText>
      )}
    </LedgerRow>
  );
}

function VerificationCard({ item, busy, wide, onReview }: {
  item: VerificationRow; busy: boolean; wide: boolean; onReview: (approve: boolean) => void;
}) {
  return (
    <LedgerRow
      wide={wide}
      actions={(
        <>
          <TButton title="Vérifier le profil" variant="primary" size="sm" fullWidth={wide} disabled={busy} onPress={() => onReview(true)} />
          <TButton title="Refuser" variant="ghost" size="sm" fullWidth={wide} disabled={busy} onPress={() => onReview(false)} />
        </>
      )}
    >
      <View style={styles.rowHead}>
        <StatusDot tone="wait" label="En attente" />
        <TText variant="caption" color="secondary" tabular>{formatDate(item.submitted_at)}</TText>
      </View>
      <View style={styles.artistRow}>
        <TAvatar uri={item.avatar_url ?? undefined} name={item.blaze} size="lg" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <TText variant="displayS" numberOfLines={1} style={styles.artistName}>{item.blaze}</TText>
          <TText variant="caption" color="secondary" numberOfLines={1}>
            {item.city} · {item.stat_posts ?? 0} publication{(item.stat_posts ?? 0) > 1 ? 's' : ''}
          </TText>
        </View>
      </View>
      {!!item.bio && (
        <TText variant="bodySmall" color="secondary" numberOfLines={4} style={styles.meta}>{item.bio}</TText>
      )}
      <TText variant="caption" color="secondary" tabular style={styles.meta}>
        Demande du {formatDate(item.submitted_at)} · compte créé le {formatDate(item.account_created_at)}
      </TText>
    </LedgerRow>
  );
}

/** Column heads of the error ledger (wide screens only). */
function ErrorTableHead() {
  return (
    <View style={styles.tableHead} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Kicker tone="muted" style={styles.colMessage}>Message</Kicker>
      <Kicker tone="muted" style={styles.colCount}>Nombre</Kicker>
      <Kicker tone="muted" style={styles.colPlatform}>Plateformes</Kicker>
      <Kicker tone="muted" style={styles.colWhen}>Dernière fois</Kicker>
    </View>
  );
}

function ErrorCard({ group, wide }: { group: ClientErrorGroup; wide: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { latest } = group;
  const platforms = group.platforms.map((p) => PLATFORM_LABELS[p] ?? p).join(', ');
  const details = [
    latest.route ?? 'Route inconnue',
    platforms || 'Plateforme inconnue',
    latest.app_version ? `v${latest.app_version}` : null,
  ].filter(Boolean).join(' · ');
  const occurrences = group.count > 1 ? `${group.count} occurrences` : '1 occurrence';

  const stack = latest.stack ? (
    <>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        hitSlop={6}
        style={[styles.stackToggle, webPointer]}
      >
        <TText variant="label" weight="bold" uppercase style={styles.stackToggleLabel}>
          {expanded ? 'Masquer la pile d’appels' : 'Voir la pile d’appels'}
        </TText>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.ink} />
      </Pressable>
      {expanded && (
        <View style={styles.stackBox}>
          <TText variant="caption" color="onInkMuted" selectable style={styles.stackText}>{latest.stack}</TText>
        </View>
      )}
    </>
  ) : null;

  if (wide) {
    return (
      <View style={styles.tableRow}>
        <View style={styles.tableCells}>
          <View style={styles.colMessage}>
            <TText variant="bodySmall" weight="semibold" selectable>{group.message}</TText>
            <TText variant="caption" color="secondary" style={styles.meta}>
              {[latest.route ?? 'Route inconnue', latest.app_version ? `v${latest.app_version}` : null].filter(Boolean).join(' · ')}
            </TText>
            {group.count > 1 && (
              <TText variant="caption" color="secondary" tabular style={styles.metaTight}>
                Première fois {relativeDate(group.firstSeen)}
              </TText>
            )}
          </View>
          <TText variant="bodySmall" tabular style={styles.colCount} accessibilityLabel={occurrences}>{group.count}</TText>
          <TText variant="caption" color="secondary" style={styles.colPlatform}>{platforms || 'Plateforme inconnue'}</TText>
          <TText variant="caption" color="secondary" tabular style={styles.colWhen}>{relativeDate(latest.created_at)}</TText>
        </View>
        {stack}
      </View>
    );
  }

  return (
    <View style={styles.tableRow}>
      <View style={styles.rowHead}>
        <StatusDot tone="alert" label={occurrences} />
        <TText variant="caption" color="secondary" tabular>{relativeDate(latest.created_at)}</TText>
      </View>
      <TText variant="bodySmall" weight="semibold" style={styles.meta} selectable>{group.message}</TText>
      <TText variant="caption" color="secondary" style={styles.meta}>{details}</TText>
      {group.count > 1 && (
        <TText variant="caption" color="secondary" tabular style={styles.metaTight}>
          Première fois {relativeDate(group.firstSeen)}
        </TText>
      )}
      {stack}
    </View>
  );
}

/** Loading: three ledger rows in outline. */
function LedgerSkeleton() {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Chargement">
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.ledgerRow}>
          <TSkeleton width={120} height={10} radius={Radius.sm} />
          <TSkeleton width="70%" height={24} radius={Radius.sm} style={{ marginTop: Spacing.sm }} />
          <TSkeleton width="45%" height={12} radius={Radius.sm} style={{ marginTop: Spacing.xs }} />
        </View>
      ))}
    </View>
  );
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { isWide, gutter } = useContentDimensions();
  const isAdmin = useAuthStore((s) => s.user?.isAdmin === true);

  const [tab, setTab] = useState<Tab>('reports');
  const [filter, setFilter] = useState<ReportStatus>('pending');
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorGroups, setErrorGroups] = useState<ClientErrorGroup[]>([]);
  const [errorsLoading, setErrorsLoading] = useState(true);
  const [errorsLoadError, setErrorsLoadError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    const [reportResult, verificationResult] = await Promise.all([listReports(filter), listVerifications()]);
    setReports(reportResult.reports);
    setVerifications(verificationResult.verifications);
    setLoadError(reportResult.error ?? verificationResult.error);
    setLoading(false);
    setRefreshing(false);
  }, [filter]);

  // Loaded on its own: a missing table (migration 012 not applied) must not hide moderation.
  const loadErrors = useCallback(async () => {
    try {
      setErrorGroups(groupClientErrors(await fetchClientErrors(200)));
      setErrorsLoadError(null);
    } catch {
      setErrorsLoadError('Les erreurs signalées n’ont pas pu être chargées.');
    }
    setErrorsLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    void load();
  }, [isAdmin, load]);

  useEffect(() => {
    if (!isAdmin || tab !== 'errors') return;
    void loadErrors();
  }, [isAdmin, tab, loadErrors]);

  const refresh = () => {
    setRefreshing(true);
    if (tab === 'errors') void loadErrors();
    else void load();
  };

  const clearErrors = async () => {
    if (clearing) return;
    setClearing(true);
    const ok = await clearClientErrors();
    setClearing(false);
    if (!ok) {
      Toast.error('Suppression impossible. Réessayez.');
      return;
    }
    setConfirmClear(false);
    setErrorGroups([]);
    Toast.success('Erreurs effacées');
    void loadErrors();
  };

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
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: insets.bottom + Spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={Colors.flameText}
            colors={[Colors.flameText]}
          />
        }
      >
        <Masthead
          kicker="Confiance & sécurité / Modération"
          title="Un espace"
          emphasis="qui protège."
          description="Signalements de contenus, demandes de badge vérifié et erreurs remontées par les appareils."
        />

        <Tabs
          options={[
            { value: 'reports' as Tab, label: 'Signalements' },
            { value: 'verifications' as Tab, label: `Vérifications${verifications.length ? ` (${verifications.length})` : ''}` },
            { value: 'errors' as Tab, label: 'Erreurs' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'reports' && (
          <View style={styles.filters}>
            <FilterPills options={REPORT_FILTERS} value={filter} onChange={setFilter} />
          </View>
        )}

        {tab === 'errors' ? (
          errorsLoading ? (
            <LedgerSkeleton />
          ) : errorsLoadError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Chargement impossible"
              description={errorsLoadError}
              ctaLabel="Réessayer"
              onCta={() => { setErrorsLoading(true); void loadErrors(); }}
              style={styles.empty}
            />
          ) : errorGroups.length ? (
            <>
              <View style={styles.errorsHead}>
                <TText variant="caption" color="secondary" style={{ flex: 1 }}>
                  Les plus récentes d’abord, regroupées par message identique.
                </TText>
                <TButton
                  title="Tout effacer"
                  variant="destructive"
                  size="sm"
                  fullWidth={false}
                  onPress={() => setConfirmClear(true)}
                />
              </View>
              {isWide ? <ErrorTableHead /> : <Rule tone="ink" />}
              {errorGroups.map((group) => <ErrorCard key={group.message} group={group} wide={isWide} />)}
            </>
          ) : (
            <EmptyState
              icon="pulse-outline"
              title="Aucune erreur signalée"
              description="Les plantages rencontrés sur les appareils apparaîtront ici."
              style={styles.empty}
            />
          )
        ) : loading ? (
          <LedgerSkeleton />
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
            <View>
              <Rule tone="ink" />
              {reports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  wide={isWide}
                  busy={busyId === report.id}
                  onDecide={(decision) => run(
                    report.id,
                    () => resolveReport(report.id, decision),
                    decision.status === 'dismissed' ? 'Signalement classé' : 'Signalement traité',
                  )}
                  onUnban={() => run(report.id, () => setBan(report.target_owner_id as string, false), 'Suspension levée')}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="checkmark-done-outline"
              title={filter === 'pending' ? 'Aucun signalement à traiter' : 'Aucun signalement ici'}
              description={filter === 'pending' ? 'Les nouveaux signalements apparaîtront ici.' : undefined}
              style={styles.empty}
            />
          )
        ) : verifications.length ? (
          <View>
            <Rule tone="ink" />
            {verifications.map((item) => (
              <VerificationCard
                key={item.artist_id}
                item={item}
                wide={isWide}
                busy={busyId === item.artist_id}
                onReview={(approve) => run(
                  item.artist_id,
                  () => reviewVerification(item.artist_id, approve),
                  approve ? 'Profil vérifié' : 'Demande refusée',
                )}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="ribbon-outline"
            title="Aucune demande de vérification"
            description="Les artistes qui demandent le badge vérifié apparaîtront ici."
            style={styles.empty}
          />
        )}
      </ScrollView>

      {/* Confirmation in a sheet: Alert.alert is a no-op on web. */}
      <BottomSheet visible={confirmClear} onClose={() => setConfirmClear(false)} accessibilityLabel="Effacer les erreurs">
        <TText variant="displayS">Tout effacer{' '}?</TText>
        <TText variant="bodySmall" color="secondary" style={styles.meta}>
          Toutes les erreurs signalées seront supprimées définitivement. Celles qui surviendront ensuite apparaîtront de nouveau ici.
        </TText>
        <View style={styles.sheetActions}>
          <TButton title="Tout effacer" variant="destructive" onPress={() => void clearErrors()} loading={clearing} />
          <TButton title="Annuler" variant="ghost" size="md" onPress={() => setConfirmClear(false)} disabled={clearing} />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  content: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.line },
  tab: {
    flexShrink: 1,
    minHeight: 48,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabSelected: { borderBottomColor: Colors.flame },
  tabHover: { backgroundColor: Colors.wash },

  filters: { marginTop: Spacing.md },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  pillHover: { backgroundColor: Colors.wash, borderColor: Colors.ink },
  pillSelected: { backgroundColor: Colors.ink, borderColor: Colors.ink },

  empty: { marginTop: Spacing.lg },

  ledgerRow: { paddingVertical: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.line },
  ledgerRowWide: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing['2xl'] },
  ledgerMain: { flex: 1, minWidth: 0 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  reason: { marginTop: Spacing.sm },
  rowTitle: { fontSize: 24, lineHeight: 28, marginTop: 6 },
  targetRow: { flexDirection: 'row', gap: 12, marginTop: Spacing.xs },
  thumb: { width: 72, height: 72, backgroundColor: Colors.clay },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: Spacing.sm },
  artistName: { fontSize: 24, lineHeight: 28 },
  meta: { marginTop: Spacing.xs },
  metaTight: { marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.md },
  actionsWide: { flexDirection: 'column', flexWrap: 'nowrap', width: 240, marginTop: 0 },

  errorsHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: Spacing.lg, marginBottom: Spacing.md },
  tableHead: {
    flexDirection: 'row', gap: Spacing.md, paddingBottom: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.ink,
  },
  tableRow: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line },
  tableCells: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  colMessage: { flex: 3, minWidth: 0 },
  colCount: { width: 72 },
  colPlatform: { flex: 1, minWidth: 0 },
  colWhen: { width: 130 },

  stackToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 44, marginTop: 4 },
  stackToggleLabel: { color: Colors.ink, letterSpacing: 1 },
  stackBox: { marginTop: Spacing['3xs'], padding: Spacing.sm, backgroundColor: Colors.inkPanel },
  stackText: { fontFamily: MONO, fontSize: 11.5, lineHeight: 17 },
  sheetActions: { gap: 10, marginTop: Spacing.lg },
});
