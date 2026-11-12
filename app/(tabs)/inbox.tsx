import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  FlatList, StyleSheet, View, Pressable, ScrollView, RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { RequestCard, REQUEST_STATUS } from '@/components/RequestCard';
import { supabase } from '@/lib/supabase';
import { useRequestStore, type TattooRequest, type RequestStatus } from '@/store/request-store';
import { useAuthStore } from '@/store/auth-store';
import { enterUp } from '@/components/motion';

const LIST_MAX = 760;

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

function FilterChip({ label, active, dot, count, onPress }: {
  label: string; active: boolean; dot?: string; count?: number; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={count ? `${label}, ${count}` : label}
      style={(state) => {
        const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
        return [styles.chip, (pressed || hovered) && !active && styles.chipHover, active && styles.chipActive];
      }}
    >
      {dot && <View style={[styles.chipDot, { backgroundColor: dot }]} />}
      <TText variant="caption" weight="medium" style={{ fontSize: 13, color: active ? Colors.textInverse : Colors.textSecondary }}>
        {label}
      </TText>
      {!!count && (
        <TText variant="caption" tabular style={{ fontSize: 12, color: active ? Colors.textInverse : Colors.textTertiary, opacity: active ? 0.7 : 1 }}>
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
          <TSkeleton width={48} height={48} radius={24} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TSkeleton width="42%" height={18} />
              <TSkeleton width={44} height={12} />
            </View>
            <TSkeleton width="60%" height={12} />
            <TSkeleton width="90%" height={12} />
            <TSkeleton width="35%" height={12} style={{ marginTop: 4 }} />
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
    const list: { value: FilterValue; label: string; dot?: string; count?: number }[] = STATUS_FILTERS.map((f) => ({
      value: f.value,
      label: isArtist ? f.artistLabel : f.clientLabel,
      dot: f.value === 'all' ? undefined : REQUEST_STATUS[f.value].color,
      count: f.value === 'all' ? undefined : counts[f.value],
    }));
    if ((counts.inquiry ?? 0) > 0 || activeFilter === 'inquiry') {
      list.splice(1, 0, { value: 'inquiry', label: 'Questions', dot: Colors.accentWarm, count: counts.inquiry });
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
    // Virtualized rows never animate in; only the masthead and filters do.
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.frame}>
        {/* Masthead */}
        <Animated.View entering={enterUp(0)} style={styles.header}>
          <View style={{ flex: 1 }}>
            <TText variant="displayM" accessibilityRole="header">
              {isArtist ? 'Boîte de ' : 'Vos '}
              <TText variant="displayM" italic color="accentGlow">{isArtist ? 'réception' : 'demandes'}</TText>
            </TText>
            <TText variant="bodySmall" color="tertiary" tabular style={{ marginTop: 4 }} accessibilityLiveRegion="polite">
              {subtitle}
            </TText>
          </View>
          <Pressable
            onPress={() => (isArtist ? router.push('/settings') : router.push('/(tabs)/explore'))}
            accessibilityRole="button"
            accessibilityLabel={isArtist ? 'Réglages' : 'Nouvelle demande : trouver un artiste'}
            hitSlop={6}
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name={isArtist ? 'settings-outline' : 'add'} size={20} color={Colors.textPrimary} />
          </Pressable>
        </Animated.View>

        {/* Filters */}
        {!!user && total > 0 && (
          <Animated.View entering={enterUp(1)}>
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
                  dot={f.dot}
                  count={f.count}
                  active={activeFilter === f.value}
                  onPress={() => setActiveFilter(f.value)}
                />
              ))}
            </ScrollView>
          </Animated.View>
        )}
      </View>

      <FlatList
        data={showSkeleton || !user ? [] : filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderRequest}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }, (filtered.length === 0 || !user) && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
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
  frame: { width: '100%', maxWidth: LIST_MAX + Layout.gutter * 2, alignSelf: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingHorizontal: Layout.gutter,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    marginTop: 4,
  },

  filterScroller: { flexGrow: 0 },
  filters: { paddingHorizontal: Layout.gutter, paddingBottom: Spacing.sm, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  chipHover: { backgroundColor: Colors.glassBgMid },
  chipActive: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },
  chipDot: { width: 6, height: 6, borderRadius: 3 },

  list: {
    width: '100%',
    maxWidth: LIST_MAX + Layout.gutter * 2,
    alignSelf: 'center',
    paddingHorizontal: Layout.gutter - Spacing['2xs'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
  },
});
