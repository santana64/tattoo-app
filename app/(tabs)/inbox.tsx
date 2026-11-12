import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  FlatList, StyleSheet, View, Pressable, ScrollView, RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton, Masthead, Rule } from '@/components/v5';
import { RequestCard, RequestLedgerHead } from '@/components/RequestCard';
import { supabase } from '@/lib/supabase';
import { useRequestStore, type TattooRequest, type RequestStatus } from '@/store/request-store';
import { useAuthStore } from '@/store/auth-store';
import { useContentDimensions, useShell } from '@/hooks/useContentDimensions';

// ─── Filters ──────────────────────────────────────────────────────────────────
/** 'inquiry': questions written without a project, whatever their status. */
type FilterValue = RequestStatus | 'all' | 'inquiry';

const STATUS_FILTERS: { value: RequestStatus | 'all'; artistLabel: string; clientLabel: string }[] = [
  { value: 'all',                  artistLabel: 'Toutes',     clientLabel: 'Toutes' },
  { value: 'submitted',            artistLabel: 'Nouvelles',  clientLabel: 'En attente' },
  { value: 'accepted',             artistLabel: 'Acceptées',  clientLabel: 'Acceptées' },
  { value: 'clarification_needed', artistLabel: 'À préciser', clientLabel: 'À préciser' },
  { value: 'archived',             artistLabel: 'Archivées',  clientLabel: 'Archivées' },
];

type Hover = { pressed: boolean; hovered?: boolean };

/** Filter pill (same drawing as TChip) carrying a tab role and a count. */
function FilterChip({ label, active, count, onPress }: {
  label: string; active: boolean; count?: number; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={count ? `${label}, ${count}` : label}
      hitSlop={4}
      style={(state) => {
        const { pressed, hovered } = state as Hover;
        return [styles.chip, (pressed || hovered) && !active && styles.chipHover, active && styles.chipActive];
      }}
    >
      <TText variant="caption" weight="semibold" style={{ fontSize: 12.5, lineHeight: 16, color: active ? Colors.paper : Colors.ink }}>
        {label}
      </TText>
      {!!count && (
        <TText variant="caption" tabular style={{ fontSize: 12, lineHeight: 16, color: active ? Colors.onInkMuted : Colors.textTertiary }}>
          {count > 99 ? '99+' : count}
        </TText>
      )}
    </Pressable>
  );
}

function InboxSkeleton() {
  return (
    <View accessibilityLabel="Chargement des demandes">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <TSkeleton width={90} height={10} />
          <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
            <TSkeleton width={48} height={48} />
            <View style={{ flex: 1, gap: 8 }}>
              <TSkeleton width="50%" height={22} />
              <TSkeleton width="70%" height={12} />
              <TSkeleton width="90%" height={12} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { gutter, isWide } = useContentDimensions();
  const { hasSidebar } = useShell();
  const { user } = useAuthStore();
  const { requests, fetchRequests, isLoading, error } = useRequestStore();
  const isArtist = user?.role === 'artist';
  const viewAs = isArtist ? 'artist' : 'client';
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    fetchRequests(user.id, user.role).finally(() => { if (active) setHasLoaded(true); });
    return () => { active = false; };
  }, [user?.id, user?.role, fetchRequests]);

  // Tabs stay mounted: refresh silently whenever the tab regains focus.
  useFocusEffect(useCallback(() => {
    if (user?.id && hasLoaded) void fetchRequests(user.id, user.role, { silent: true });
  }, [user?.id, user?.role, hasLoaded, fetchRequests]));

  // Live updates: a new request (artist) or a status change (client) appears without reloading.
  useEffect(() => {
    if (!user?.id) return;
    const filter = user.role === 'artist'
      ? (user.artistId ? `artist_id=eq.${user.artistId}` : null)
      : `client_id=eq.${user.id}`;
    if (!filter) return;
    const channel = supabase
      .channel(`requests:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tattoo_requests', filter }, () => {
        void fetchRequests(user.id, user.role, { silent: true });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, user?.role, user?.artistId, fetchRequests]);

  const counts = useMemo(() => {
    const map: Partial<Record<FilterValue, number>> = {};
    for (const r of requests) {
      map[r.status] = (map[r.status] ?? 0) + 1;
      if (r.isInquiry) map.inquiry = (map.inquiry ?? 0) + 1;
    }
    return map;
  }, [requests]);

  const filtered = useMemo(
    () => requests.filter((r) => activeFilter === 'all'
      || (activeFilter === 'inquiry' ? r.isInquiry : r.status === activeFilter)),
    [requests, activeFilter],
  );

  // The "Questions" chip only exists while there are questions (or while it is selected).
  const filters = useMemo(() => {
    const list: { value: FilterValue; label: string; count?: number }[] = STATUS_FILTERS.map((f) => ({
      value: f.value,
      label: isArtist ? f.artistLabel : f.clientLabel,
      count: f.value === 'all' ? undefined : counts[f.value],
    }));
    if ((counts.inquiry ?? 0) > 0 || activeFilter === 'inquiry') {
      list.splice(1, 0, { value: 'inquiry', label: 'Questions', count: counts.inquiry });
    }
    return list;
  }, [counts, isArtist, activeFilter]);

  const newCount = counts.submitted ?? 0;
  const inProgress = (counts.submitted ?? 0) + (counts.clarification_needed ?? 0) + (counts.accepted ?? 0) + (counts.confirmed ?? 0);
  const total = requests.length;

  const handleRefresh = async () => {
    if (!user?.id) return;
    setIsRefreshing(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchRequests(user.id, user.role);
    setIsRefreshing(false);
  };

  const retry = () => { if (user?.id) void fetchRequests(user.id, user.role); };

  const handleEmptyCta = useCallback(() => {
    if (activeFilter !== 'all') setActiveFilter('all');
    else if (isArtist) router.push('/(tabs)/profile');
    else router.push('/(tabs)/explore');
  }, [activeFilter, isArtist, router]);

  const renderRequest = useCallback(
    // Virtualized rows never animate in.
    ({ item }: { item: TattooRequest }) => <RequestCard request={item} viewAs={viewAs} />,
    [viewAs],
  );

  const subtitle = !user
    ? 'Vos échanges avec les artistes'
    : !hasLoaded && isLoading
      ? 'Chargement…'
      : total === 0
        ? isArtist ? 'Les demandes de vos clients arrivent ici' : 'Vos projets envoyés aux artistes'
        : isArtist
          ? `${newCount} nouvelle${newCount > 1 ? 's' : ''} · ${total} au total`
          : `${inProgress} en cours · ${total} au total`;

  const showSkeleton = !!user && isLoading && requests.length === 0 && !isRefreshing;

  const emptyComponent = !user ? (
    <EmptyState
      icon="mail-outline"
      title="Connectez-vous"
      description="Vos demandes et les réponses des artistes apparaissent ici une fois connecté."
      ctaLabel="Se connecter"
      onCta={() => router.push('/(auth)/sign-in')}
    />
  ) : showSkeleton ? (
    <InboxSkeleton />
  ) : error ? (
    <EmptyState
      icon="cloud-offline-outline"
      title="Chargement impossible"
      description="Vos demandes n’ont pas pu être chargées. Vérifiez votre connexion puis réessayez."
      ctaLabel="Réessayer"
      onCta={retry}
    />
  ) : (
    <EmptyState
      icon={activeFilter === 'all' ? 'mail-outline' : 'funnel-outline'}
      title={activeFilter !== 'all' ? 'Aucune demande ici' : isArtist ? 'Aucune demande pour le moment' : 'Pas encore de demande'}
      description={
        activeFilter !== 'all'
          ? 'Aucune demande ne correspond à ce filtre.'
          : isArtist
            ? 'Un profil complet, avec portfolio et conditions, aide les clients à vous écrire.'
            : 'Trouvez un artiste dont le travail vous parle et décrivez-lui votre projet.'
      }
      ctaLabel={activeFilter !== 'all' ? 'Voir toutes les demandes' : isArtist ? 'Compléter mon profil' : 'Explorer les artistes'}
      onCta={handleEmptyCta}
    />
  );

  const header = (
    <View>
      <Masthead
        kicker={isArtist ? 'Atelier · Demandes' : 'Votre parcours · Projets'}
        title={isArtist ? 'Boîte de' : 'Vos'}
        emphasis={isArtist ? 'réception.' : 'projets.'}
        description={isArtist
          ? 'Les demandes de vos clients, de la première question au rendez-vous.'
          : 'Chaque projet garde son brief, ses échanges et ses rendez-vous au même endroit.'}
        action={isArtist ? (
          <IconButton icon="settings-outline" label="Réglages" onPress={() => router.push('/settings')} />
        ) : (
          <TButton
            title="Nouveau projet"
            variant="secondary"
            size="md"
            fullWidth={false}
            onPress={() => router.push('/(tabs)/explore')}
            accessibilityLabel="Nouvelle demande : trouver un artiste"
          />
        )}
        style={styles.masthead}
      />

      <View style={styles.toolbar}>
        <TText variant="label" weight="bold" uppercase tabular color="tertiary" accessibilityLiveRegion="polite" style={styles.count}>
          {subtitle}
        </TText>
        {!!user && total > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
            style={styles.filterScroller}
            accessibilityRole="tablist"
          >
            {filters.map((f) => (
              <FilterChip
                key={f.value}
                label={f.label}
                count={f.count}
                active={activeFilter === f.value}
                onPress={() => setActiveFilter(f.value)}
              />
            ))}
          </ScrollView>
        )}
      </View>
      {isWide && !!user && !showSkeleton && filtered.length > 0 && <RequestLedgerHead viewAs={viewAs} />}
      <Rule tone="ink" />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={showSkeleton || !user ? [] : filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderRequest}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.list,
          { paddingHorizontal: gutter, paddingBottom: insets.bottom + (hasSidebar ? Spacing['2xl'] : 110) },
          (filtered.length === 0 || !user) && { flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        refreshControl={
          user ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.accentWarm}
              colors={[Colors.accentWarm]}
            />
          ) : undefined
        }
        ListEmptyComponent={emptyComponent}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  list: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },

  masthead: { borderBottomWidth: 0, marginBottom: 0 },
  toolbar: { gap: Spacing.xs, paddingBottom: Spacing.sm },
  count: { marginBottom: 2 },

  filterScroller: { flexGrow: 0 },
  filters: { gap: 8, paddingRight: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.line,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '180ms' } as object)
      : null),
  },
  chipHover: { backgroundColor: Colors.wash, borderColor: Colors.ink },
  chipActive: { backgroundColor: Colors.ink, borderColor: Colors.ink },

  skeletonRow: {
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xs'],
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
});
