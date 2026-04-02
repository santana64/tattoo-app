import React, { useState, useCallback } from 'react';
import { FlatList, StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { RequestCard } from '@/components/RequestCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import type { TattooRequest } from '@/constants/mock-data';

const STATUS_FILTERS: { label: string; value: TattooRequest['status'] | 'all'; color?: string }[] = [
  { label: 'Toutes', value: 'all' },
  { label: 'Nouvelles', value: 'submitted', color: '#60A5FA' },
  { label: 'Acceptées', value: 'accepted', color: '#34D399' },
  { label: 'Refusées', value: 'declined', color: '#F87171' },
  { label: 'Archivées', value: 'archived' },
];

function ArtistSummaryBanner({ newCount, totalCount }: { newCount: number; totalCount: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.bannerWrap}>
      <GlassCard variant="glow" style={styles.banner}>
        <View style={styles.bannerLeft}>
          <TText variant="displayM" weight="black" style={styles.bannerNum}>{newCount}</TText>
          <TText variant="caption" color="secondary">nouvelle{newCount > 1 ? 's' : ''} demande{newCount > 1 ? 's' : ''}</TText>
        </View>
        <View style={styles.bannerDivider} />
        <View style={styles.bannerRight}>
          <TText variant="title2" weight="bold">{totalCount}</TText>
          <TText variant="caption" color="tertiary">total</TText>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

function FilterPill({ label, value, active, color, count, onPress }: {
  label: string; value: string; active: boolean; color?: string; count?: number; onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handlePress = () => {
    scale.value = withSpring(0.9, { damping: 8 }, () => { scale.value = withSpring(1); });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };
  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity onPress={handlePress} activeOpacity={1} style={[styles.filterPill, active && styles.filterPillActive]}>
        {color && <View style={[styles.filterDot, { backgroundColor: active ? color : Colors.textTertiary }]} />}
        <TText variant="caption" weight={active ? 'semibold' : 'regular'} style={{ color: active ? Colors.textPrimary : Colors.textTertiary }}>
          {label}
        </TText>
        {count != null && count > 0 && (
          <View style={[styles.filterBadge, active && { backgroundColor: color ?? Colors.accentWarm }]}>
            <TText variant="micro" style={{ color: '#fff', fontSize: 9 }}>{count}</TText>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { requests } = useAppStore();
  const isArtist = user?.role === 'artist';
  const [activeFilter, setActiveFilter] = useState<TattooRequest['status'] | 'all'>('all');

  const filtered = requests.filter((r) => {
    const matchArtist = isArtist ? r.artistId === (user?.artistId ?? 'a1') : r.clientName === 'Théo M.';
    const matchFilter = activeFilter === 'all' || r.status === activeFilter;
    return matchArtist && matchFilter;
  });

  const countByStatus = (status: TattooRequest['status']) =>
    requests.filter((r) => {
      const matchArtist = isArtist ? r.artistId === (user?.artistId ?? 'a1') : r.clientName === 'Théo M.';
      return matchArtist && r.status === status;
    }).length;

  const newCount = countByStatus('submitted');
  const totalFiltered = requests.filter((r) =>
    isArtist ? r.artistId === (user?.artistId ?? 'a1') : r.clientName === 'Théo M.'
  ).length;

  const handleEmptyCta = useCallback(() => {
    if (activeFilter !== 'all') setActiveFilter('all');
    else if (isArtist) router.push('/(tabs)/profile');
    else router.push('/(tabs)/explore');
  }, [activeFilter, isArtist]);

  const renderRequest = useCallback(
    ({ item, index }: { item: TattooRequest; index: number }) => (
      <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
        <RequestCard request={item} viewAs={isArtist ? 'artist' : 'client'} />
      </Animated.View>
    ),
    [isArtist]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <View>
          <TText variant="displayM" weight="black" style={styles.headerTitle}>
            {isArtist ? 'Inbox' : 'Demandes'}
          </TText>
          {isArtist && newCount > 0 && (
            <TText variant="caption" style={{ color: Colors.accentWarm, marginTop: 2 }}>
              {newCount} en attente de réponse
            </TText>
          )}
        </View>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => isArtist ? router.push('/settings/index') : router.push('/(tabs)/explore')}>
          <Ionicons name={isArtist ? 'settings-outline' : 'add'} size={20} color={isArtist ? Colors.textSecondary : Colors.accentWarm} />
        </TouchableOpacity>
      </Animated.View>

      {isArtist && newCount > 0 && <ArtistSummaryBanner newCount={newCount} totalCount={totalFiltered} />}

      <Animated.View entering={FadeInDown.delay(150).springify()}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {STATUS_FILTERS.map((f) => (
            <FilterPill
              key={f.value}
              label={f.label}
              value={f.value}
              active={activeFilter === f.value}
              color={f.color}
              count={f.value !== 'all' ? countByStatus(f.value as TattooRequest['status']) : undefined}
              onPress={() => setActiveFilter(f.value)}
            />
          ))}
        </ScrollView>
      </Animated.View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderRequest}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon={activeFilter === 'all' ? 'mail-outline' : 'filter-outline'}
            title={activeFilter === 'all' ? (isArtist ? 'Aucune demande.' : 'Pas encore de demande.') : 'Rien dans ce filtre.'}
            description={activeFilter === 'all' && isArtist ? 'Optimise ton profil pour apparaître dans plus de recherches.' : undefined}
            ctaLabel={activeFilter !== 'all' ? 'Voir toutes' : isArtist ? 'Mon profil' : 'Explorer'}
            onCta={handleEmptyCta}
            style={{ marginTop: 60 }}
          />
        }
        ListFooterComponent={
          filtered.length > 0 ? (
            <Animated.View entering={FadeIn.delay(300)} style={styles.footer}>
              <TText variant="caption" color="tertiary">
                {filtered.length} demande{filtered.length > 1 ? 's' : ''}
              </TText>
            </Animated.View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm, paddingTop: Spacing.xs, paddingBottom: Spacing['2xs'],
  },
  headerTitle: { letterSpacing: -2, fontSize: 34 },
  headerIconBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgSurface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderSubtle, marginTop: 4,
  },
  bannerWrap: { paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm },
  banner: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  bannerLeft: { alignItems: 'flex-start' },
  bannerNum: { letterSpacing: -3, lineHeight: 44, fontSize: 44, color: Colors.accentWarm },
  bannerDivider: { width: 1, height: 40, backgroundColor: Colors.borderGlow, marginHorizontal: Spacing.md },
  bannerRight: { alignItems: 'center' },
  filters: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm, gap: 8 },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.bgSurface, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderSubtle, gap: 6,
  },
  filterPillActive: { backgroundColor: Colors.bgElevated, borderColor: Colors.borderDefault },
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  filterBadge: {
    backgroundColor: Colors.textTertiary, borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  list: { paddingHorizontal: Spacing.sm, paddingTop: Spacing['2xs'] },
  footer: { paddingVertical: Spacing.md, alignItems: 'center' },
});
