import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAppStore } from '@/store/app-store';
import { useFeedStore } from '@/store/feed-store';
import { POSTS, ARTISTS } from '@/constants/mock-data';

const { width: SCREEN_W } = Dimensions.get('window');
const CELL = (SCREEN_W - Spacing.sm * 2 - 2) / 3;

type Tab = 'saved' | 'liked';

export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();

  const [activeTab, setActiveTab] = useState<Tab>(
    params.tab === 'liked' ? 'liked' : 'saved'
  );

  // App store — mock posts / saved artists
  const { savedPostIds, savedArtistIds } = useAppStore();
  // Feed store — real saved posts
  const { savedPostIds: feedSavedIds, posts: feedPosts } = useFeedStore();

  const savedPosts = useMemo(() => {
    // Combine mock + real saved
    const mockSaved = POSTS.filter((p) => savedPostIds.has(p.id));
    const feedSaved = feedPosts.filter((p) => feedSavedIds.has(p.id));
    // Merge deduplicated by id
    const ids = new Set<string>();
    return [...feedSaved.map(p => ({
      id: p.id,
      mediaUrl: p.mediaUrl,
      artistName: p.artistName,
      artistAvatarUrl: p.artistAvatarUrl ?? '',
      likes: p.likesCount,
    })), ...mockSaved.map(p => ({
      id: p.id,
      mediaUrl: p.mediaUrl,
      artistName: p.artist.blaze,
      artistAvatarUrl: p.artist.avatarUrl,
      likes: p.likes,
    }))].filter((p) => {
      if (ids.has(p.id)) return false;
      ids.add(p.id);
      return true;
    });
  }, [savedPostIds, feedSavedIds, feedPosts]);

  const likedPosts = useMemo(() => {
    return POSTS.filter((p) => p.isLiked).map(p => ({
      id: p.id,
      mediaUrl: p.mediaUrl,
      artistName: p.artist.blaze,
      artistAvatarUrl: p.artist.avatarUrl,
      likes: p.likes,
    }));
  }, []);

  const savedArtists = useMemo(
    () => ARTISTS.filter((a) => savedArtistIds.has(a.id)),
    [savedArtistIds]
  );

  const activePosts = activeTab === 'saved' ? savedPosts : likedPosts;

  const renderPost = ({ item, index }: { item: typeof activePosts[0]; index: number }) => (
    <Animated.View entering={FadeIn.delay(index * 30).duration(300)}>
      <TouchableOpacity
        onPress={() => router.push(`/post/${item.id}`)}
        activeOpacity={0.85}
        style={styles.cell}
      >
        <Image source={{ uri: item.mediaUrl }} style={styles.cellImg} contentFit="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(3,3,5,0.6)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cellMeta}>
          <TText variant="micro" style={{ color: 'rgba(255,255,255,0.7)' }} numberOfLines={1}>
            {item.artistName}
          </TText>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2" weight="semibold">Mes tatouages</TText>
        <View style={{ width: 40 }} />
      </Animated.View>

      {/* Tabs */}
      <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.tabs}>
        {(['saved', 'liked'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(tab); }}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <Ionicons
              name={tab === 'saved' ? 'bookmark' : 'heart'}
              size={15}
              color={activeTab === tab ? Colors.accentWarm : Colors.textTertiary}
            />
            <TText
              variant="bodySmall"
              weight={activeTab === tab ? 'semibold' : 'regular'}
              style={{ color: activeTab === tab ? Colors.accentWarm : Colors.textTertiary, marginLeft: 6 }}
            >
              {tab === 'saved' ? 'Sauvegardés' : 'Aimés'}
            </TText>
            <View style={[styles.tabBadge, activeTab === tab && styles.tabBadgeActive]}>
              <TText variant="micro" style={{ color: activeTab === tab ? Colors.bgPrimary : Colors.textTertiary, fontSize: 10 }}>
                {tab === 'saved' ? savedPosts.length : likedPosts.length}
              </TText>
            </View>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* Saved Artists (only on saved tab) */}
      {activeTab === 'saved' && savedArtists.length > 0 && (
        <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.artistsSection}>
          <TText variant="label" color="tertiary" uppercase style={styles.sectionLabel}>
            Artistes sauvegardés · {savedArtists.length}
          </TText>
          <FlatList
            horizontal
            data={savedArtists}
            keyExtractor={(a) => a.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: Spacing.sm, gap: Spacing.xs }}
            renderItem={({ item: artist }) => (
              <TouchableOpacity
                onPress={() => router.push(`/artist/${artist.id}`)}
                activeOpacity={0.85}
                style={styles.artistPill}
              >
                <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="lg" isPremium={artist.tier === 'premium'} />
                <TText variant="micro" color="secondary" style={{ marginTop: 5 }} numberOfLines={1}>
                  {artist.blaze}
                </TText>
                <View style={[styles.artistStatusDot, {
                  backgroundColor: artist.bookingStatus === 'open' ? Colors.successLight : Colors.textTertiary,
                }]} />
              </TouchableOpacity>
            )}
          />
        </Animated.View>
      )}

      {/* Posts grid */}
      <TText variant="label" color="tertiary" uppercase style={[styles.sectionLabel, { paddingHorizontal: Spacing.sm }]}>
        {activeTab === 'saved' ? 'Posts sauvegardés' : 'Posts aimés'} · {activePosts.length}
      </TText>

      <FlatList
        data={activePosts}
        keyExtractor={(p) => p.id}
        renderItem={renderPost}
        numColumns={3}
        contentContainerStyle={{ paddingHorizontal: Spacing.sm, paddingBottom: insets.bottom + 90, gap: 2 }}
        columnWrapperStyle={{ gap: 2 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon={activeTab === 'saved' ? 'bookmark-outline' : 'heart-outline'}
            title={activeTab === 'saved' ? 'Aucun post sauvegardé' : 'Aucun post aimé'}
            description={activeTab === 'saved'
              ? 'Sauvegarde des posts depuis le feed pour les retrouver ici.'
              : 'Like des posts depuis le feed ou les profils artistes.'}
            style={{ marginTop: 40 }}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  tabs: {
    flexDirection: 'row',
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.md,
    gap: 4,
  },
  tabActive: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: 'rgba(212,168,100,0.2)',
  },
  tabBadge: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 2,
  },
  tabBadgeActive: { backgroundColor: Colors.accentWarm },

  sectionLabel: { letterSpacing: 1.5, marginBottom: Spacing['2xs'], marginTop: Spacing['2xs'] },

  artistsSection: { marginBottom: Spacing.xs },
  artistPill: { width: 68, alignItems: 'center' },
  artistStatusDot: {
    position: 'absolute', bottom: 28, right: 4,
    width: 9, height: 9, borderRadius: 4.5,
    borderWidth: 1.5, borderColor: Colors.bgPrimary,
  },

  cell: {
    width: CELL, height: CELL,
    backgroundColor: Colors.bgSurface,
    overflow: 'hidden',
    borderRadius: 2,
  },
  cellImg: { ...StyleSheet.absoluteFillObject },
  cellMeta: {
    position: 'absolute', bottom: 4, left: 4, right: 4,
  },
});
