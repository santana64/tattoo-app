import React, { useState, useMemo } from 'react';
import { FlatList, StyleSheet, View, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TChip } from '@/components/ui/TChip';
import { ArtistCard } from '@/components/ArtistCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAppStore } from '@/store/app-store';
import { ARTISTS, STYLES } from '@/constants/mock-data';
import type { Artist } from '@/constants/mock-data';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { savedArtistIds, toggleSaveArtist } = useAppStore();
  const [query, setQuery] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedAvailability, setSelectedAvailability] = useState<boolean>(false);

  const filtered = useMemo(() => {
    return ARTISTS.filter((a) => {
      const matchQuery =
        !query ||
        a.blaze.toLowerCase().includes(query.toLowerCase()) ||
        a.city.toLowerCase().includes(query.toLowerCase());
      const matchStyle = !selectedStyle || a.styles.includes(selectedStyle);
      const matchAvail = !selectedAvailability || a.bookingStatus === 'open';
      return matchQuery && matchStyle && matchAvail;
    });
  }, [query, selectedStyle, selectedAvailability]);

  const renderArtist = ({ item }: { item: Artist }) => (
    <ArtistCard
      artist={item}
      isSaved={savedArtistIds.has(item.id)}
      onSave={toggleSaveArtist}
    />
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TText variant="title1" weight="bold">Explorer</TText>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchField}
            placeholder="Recherche artiste, ville..."
            placeholderTextColor={Colors.textTertiary}
            value={query}
            onChangeText={setQuery}
          />
          {query ? (
            <Ionicons
              name="close-circle"
              size={18}
              color={Colors.textTertiary}
              onPress={() => setQuery('')}
            />
          ) : null}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersRow}>
        <TChip
          label="Disponible"
          selected={selectedAvailability}
          onPress={() => setSelectedAvailability((v) => !v)}
        />
        {STYLES.slice(0, 6).map((s) => (
          <TChip
            key={s.id}
            label={s.name}
            selected={selectedStyle === s.slug}
            onPress={() => setSelectedStyle(selectedStyle === s.slug ? null : s.slug)}
          />
        ))}
      </View>

      {/* Results */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderArtist}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <TText variant="caption" color="tertiary" style={styles.count}>
            {filtered.length} artiste{filtered.length > 1 ? 's' : ''}
          </TText>
        }
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="Aucun résultat."
            description="Essaie d'autres filtres ou une autre ville."
            ctaLabel="Effacer les filtres"
            onCta={() => {
              setQuery('');
              setSelectedStyle(null);
              setSelectedAvailability(false);
            }}
            style={{ marginTop: 40 }}
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
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  searchRow: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingHorizontal: Spacing.sm,
    height: 48,
    gap: 8,
  },
  searchField: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.body,
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing['2xs'],
    paddingBottom: Spacing['2xs'],
    flexWrap: 'wrap',
  },
  list: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing['2xs'],
  },
  count: {
    marginBottom: Spacing['2xs'],
  },
});
