import React, { useState } from 'react';
import { FlatList, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TChip } from '@/components/ui/TChip';
import { RequestCard } from '@/components/RequestCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import type { TattooRequest } from '@/constants/mock-data';

const FILTERS: { label: string; value: TattooRequest['status'] | 'all' }[] = [
  { label: 'Toutes', value: 'all' },
  { label: 'Nouvelles', value: 'submitted' },
  { label: 'Acceptées', value: 'accepted' },
  { label: 'Refusées', value: 'declined' },
  { label: 'Archivées', value: 'archived' },
];

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

  const newCount = requests.filter(
    (r) => r.status === 'submitted' && r.artistId === (user?.artistId ?? 'a1')
  ).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TText variant="title1" weight="bold">
          {isArtist ? 'Inbox' : 'Mes demandes'}
        </TText>
        {isArtist && newCount > 0 && (
          <View style={styles.badge}>
            <TText variant="label" color="inverse" style={{ fontSize: 10 }}>
              {newCount}
            </TText>
          </View>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filtersScroll}>
        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <TChip
              key={f.value}
              label={f.label}
              selected={activeFilter === f.value}
              onPress={() => setActiveFilter(f.value)}
            />
          ))}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RequestCard request={item} viewAs={isArtist ? 'artist' : 'client'} />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="mail-outline"
            title={activeFilter === 'all' ? 'Aucune demande pour l\'instant.' : 'Rien dans ce filtre.'}
            description={
              activeFilter === 'all' && isArtist
                ? 'Complète ton profil pour que les clients te trouvent plus facilement.'
                : undefined
            }
            ctaLabel={
              activeFilter !== 'all'
                ? 'Voir toutes les demandes'
                : isArtist
                ? 'Compléter mon profil'
                : 'Explorer des artistes'
            }
            onCta={() => {
              if (activeFilter !== 'all') {
                setActiveFilter('all');
              } else if (isArtist) {
                router.push('/(tabs)/profile');
              } else {
                router.push('/(tabs)/explore');
              }
            }}
            style={{ marginTop: 60 }}
          />
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
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
    gap: Spacing['2xs'],
  },
  badge: {
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filtersScroll: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing['2xs'],
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  list: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing['2xs'],
  },
});
