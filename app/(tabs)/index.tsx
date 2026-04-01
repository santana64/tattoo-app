import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { EmptyState } from '@/components/ui/EmptyState';
import { PostCard } from '@/components/PostCard';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { Post } from '@/constants/mock-data';

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { posts, toggleLike } = useAppStore();
  const { user, isAuthenticated } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  }, []);

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard post={item} onLike={toggleLike} />
    ),
    [toggleLike]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TText variant="title1" weight="bold" style={styles.logo}>
          TATTOO
        </TText>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/explore')} style={styles.headerBtn}>
            <Ionicons name="search-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <EmptyState
            icon="images-outline"
            title="Ton feed se construit."
            description="Explore des artistes près de toi pour commencer."
            ctaLabel="Explorer"
            onCta={() => router.push('/explore')}
            style={{ marginTop: 80 }}
          />
        }
        ListFooterComponent={
          posts.length > 0 ? (
            <View style={styles.footer}>
              <TText variant="caption" color="tertiary" style={styles.footerText}>
                Explore d'autres artistes →
              </TText>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  logo: {
    letterSpacing: 4,
    color: Colors.accent,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing['2xs'],
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  footer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    letterSpacing: 0.3,
  },
});
