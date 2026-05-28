import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  FlatList, StyleSheet, View, TouchableOpacity,
  ScrollView, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn, FadeInDown, FadeInRight,
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  interpolate, Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { RequestCard } from '@/components/RequestCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { useRequestStore } from '@/store/request-store';
import { useAuthStore } from '@/store/auth-store';
import type { TattooRequest } from '@/constants/mock-data';

// ─── Filter definitions ────────────────────────────────────────────────────────
type FilterValue = TattooRequest['status'] | 'all';

const STATUS_FILTERS: {
  label: string;
  value: FilterValue;
  color?: string;
  icon?: string;
}[] = [
  { label: 'Tous',      value: 'all',       icon: 'apps-outline' },
  { label: 'Nouveau',   value: 'submitted', color: '#60A5FA', icon: 'flash-outline' },
  { label: 'Accepté',   value: 'accepted',  color: '#34D399', icon: 'checkmark-circle-outline' },
  { label: 'En cours',  value: 'in_progress', color: Colors.accentWarm, icon: 'time-outline' },
  { label: 'Archivé',   value: 'archived',  color: Colors.textTertiary, icon: 'archive-outline' },
];

// ─── Artist summary banner ────────────────────────────────────────────────────
function ArtistSummaryBanner({
  newCount,
  totalCount,
}: {
  newCount: number;
  totalCount: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.bannerWrap}>
      <GlassCard variant="glow" style={styles.banner}>
        <LinearGradient
          colors={['rgba(212,168,100,0.10)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.bannerLeft}>
          <TText
            variant="displayM"
            weight="black"
            style={styles.bannerNum}
          >
            {newCount}
          </TText>
          <TText variant="caption" color="secondary">
            nouvelle{newCount !== 1 ? 's' : ''} demande{newCount !== 1 ? 's' : ''}
          </TText>
        </View>
        <View style={styles.bannerDivider} />
        <View style={styles.bannerRight}>
          <TText variant="title2" weight="bold">{totalCount}</TText>
          <TText variant="caption" color="tertiary">au total</TText>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

// ─── Filter pill with animated active state ───────────────────────────────────
function FilterPill({
  label,
  value,
  active,
  color,
  icon,
  count,
  onPress,
}: {
  label: string;
  value: FilterValue;
  active: boolean;
  color?: string;
  icon?: string;
  count?: number;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSpring(0.88, { damping: 8 }, () => {
      scale.value = withSpring(1, { damping: 12 });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const activeColor = color ?? Colors.accentWarm;

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={1}
        style={[
          styles.filterPill,
          active && [
            styles.filterPillActive,
            { borderColor: `${activeColor}55` },
          ],
        ]}
      >
        {active && (
          <LinearGradient
            colors={[`${activeColor}18`, `${activeColor}06`]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {icon && (
          <Ionicons
            name={icon as any}
            size={13}
            color={active ? activeColor : Colors.textTertiary}
          />
        )}
        <TText
          variant="caption"
          weight={active ? 'semibold' : 'regular'}
          style={{ color: active ? Colors.textPrimary : Colors.textTertiary }}
        >
          {label}
        </TText>
        {count != null && count > 0 && (
          <View
            style={[
              styles.filterBadge,
              active && { backgroundColor: activeColor },
            ]}
          >
            <TText variant="micro" style={{ color: active ? '#fff' : Colors.textTertiary, fontSize: 9 }}>
              {count > 99 ? '99+' : count}
            </TText>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Request card wrapper with press animation ────────────────────────────────
function AnimatedRequestCard({
  item,
  index,
  isArtist,
}: {
  item: TattooRequest;
  index: number;
  isArtist: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 50, 400)).springify()}
      style={animStyle}
    >
      <RequestCard
        request={item}
        viewAs={isArtist ? 'artist' : 'client'}
        onPressIn={() => {
          scale.value = withSpring(0.975, { damping: 14, stiffness: 300 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 300 });
        }}
      />
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { requests: realRequests, fetchRequests, isLoading } = useRequestStore();
  const isArtist = user?.role === 'artist';
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch real requests on mount
  useEffect(() => {
    if (user?.id) {
      fetchRequests(user.id, user.role);
    }
  }, [user?.id]);

  // Adapt real requests to mock type shape expected by RequestCard
  const myRequests = realRequests.map((r) => ({
    ...r,
    clientAvatar: r.clientAvatarUrl ?? '',
    budgetMin: r.budgetMin ?? 0,
    budgetMax: r.budgetMax ?? 0,
    colorPreference: r.colorPreference,
    stylePreference: r.stylePreference ?? '',
    references: r.references ?? [],
  })) as unknown as TattooRequest[];

  const filtered = myRequests.filter(
    (r) => activeFilter === 'all' || r.status === activeFilter
  );

  const countByStatus = useCallback(
    (status: TattooRequest['status']) =>
      myRequests.filter((r) => r.status === status).length,
    [myRequests]
  );

  const newCount = countByStatus('submitted');
  const totalCount = myRequests.length;
  const unreadTotal = newCount; // alias for header badge

  const handleRefresh = async () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (user?.id) await fetchRequests(user.id, user.role);
    setIsRefreshing(false);
  };

  const handleEmptyCta = useCallback(() => {
    if (activeFilter !== 'all') {
      setActiveFilter('all');
    } else if (isArtist) {
      router.push('/(tabs)/profile');
    } else {
      router.push('/(tabs)/explore');
    }
  }, [activeFilter, isArtist]);

  const renderRequest = useCallback(
    ({ item, index }: { item: TattooRequest; index: number }) => (
      <AnimatedRequestCard item={item} index={index} isArtist={isArtist} />
    ),
    [isArtist]
  );

  const emptyTitle =
    activeFilter === 'all'
      ? isArtist
        ? 'Aucune demande pour l\'instant.'
        : 'Pas encore de demande.'
      : 'Rien dans ce filtre.';

  const emptyDescription =
    activeFilter === 'all' && isArtist
      ? 'Optimise ton profil pour apparaître dans plus de recherches.'
      : activeFilter === 'all'
      ? 'Explore les artistes et envoie ta première demande.'
      : undefined;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <Animated.View entering={FadeIn.duration(380)} style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerTitleRow}>
            <TText variant="displayM" weight="black" style={styles.headerTitle}>
              {isArtist ? 'Inbox' : 'Demandes'}
            </TText>
            {/* Total badge */}
            {totalCount > 0 && (
              <View style={styles.totalBadge}>
                <TText variant="micro" style={{ color: Colors.textSecondary, fontSize: 10 }}>
                  {totalCount}
                </TText>
              </View>
            )}
            {/* Unread dot */}
            {unreadTotal > 0 && <View style={styles.unreadDotHeader} />}
          </View>
          {isArtist && newCount > 0 && (
            <Animated.View entering={FadeInRight.delay(150).duration(300)}>
              <TText variant="caption" style={{ color: Colors.accentWarm, marginTop: 2 }}>
                {newCount} en attente de réponse
              </TText>
            </Animated.View>
          )}
        </View>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() =>
            isArtist ? router.push('/settings/index') : router.push('/(tabs)/explore')
          }
        >
          <Ionicons
            name={isArtist ? 'settings-outline' : 'add'}
            size={20}
            color={isArtist ? Colors.textSecondary : Colors.accentWarm}
          />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Artist summary banner ── */}
      {isArtist && newCount > 0 && (
        <ArtistSummaryBanner newCount={newCount} totalCount={totalCount} />
      )}

      {/* ── Filter tabs ── */}
      <Animated.View entering={FadeInDown.delay(160).springify()}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          {STATUS_FILTERS.map((f) => {
            const count =
              f.value !== 'all'
                ? countByStatus(f.value as TattooRequest['status'])
                : undefined;
            return (
              <FilterPill
                key={f.value}
                label={f.label}
                value={f.value}
                active={activeFilter === f.value}
                color={f.color}
                icon={f.icon}
                count={count}
                onPress={() => setActiveFilter(f.value)}
              />
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* ── List ── */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderRequest}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accentWarm}
            colors={[Colors.accentWarm]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={activeFilter === 'all' ? 'mail-outline' : 'filter-outline'}
            title={emptyTitle}
            description={emptyDescription}
            ctaLabel={activeFilter !== 'all' ? 'Voir tout' : isArtist ? 'Mon profil' : 'Explorer'}
            onCta={handleEmptyCta}
            style={{ marginTop: 64 }}
          />
        }
        ListFooterComponent={
          filtered.length > 0 ? (
            <Animated.View entering={FadeIn.delay(350)} style={styles.footer}>
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

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing['2xs'],
  },
  headerLeft: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    letterSpacing: -2,
    fontSize: 34,
  },
  totalBadge: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  unreadDotHeader: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accentGlow,
    marginBottom: 2,
    ...GlowShadow.amber,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginTop: 4,
  },

  // Artist summary banner
  bannerWrap: {
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    overflow: 'hidden',
  },
  bannerLeft: {
    alignItems: 'flex-start',
    flex: 1,
  },
  bannerNum: {
    letterSpacing: -3,
    lineHeight: 44,
    fontSize: 44,
    color: Colors.accentWarm,
  },
  bannerDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.borderGlow,
    marginHorizontal: Spacing.md,
  },
  bannerRight: {
    alignItems: 'center',
  },

  // Filter pills
  filtersContainer: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: 8,
    flexDirection: 'row',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 5,
    overflow: 'hidden',
  },
  filterPillActive: {
    backgroundColor: Colors.bgElevated,
  },
  filterBadge: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 8,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  // List
  list: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing['2xs'],
  },
  footer: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
});
