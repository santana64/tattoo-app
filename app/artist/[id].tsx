import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TBadge } from '@/components/ui/TBadge';
import { TButton } from '@/components/ui/TButton';
import { TChip } from '@/components/ui/TChip';
import { TDivider } from '@/components/ui/TDivider';
import { TCard } from '@/components/ui/TCard';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { ARTISTS, POSTS } from '@/constants/mock-data';

const { width } = Dimensions.get('window');
const COVER_HEIGHT = 240;

export default function ArtistProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { savedArtistIds, toggleSaveArtist } = useAppStore();
  const { isAuthenticated } = useAuthStore();

  const artist = ARTISTS.find((a) => a.id === id) ?? ARTISTS[0];
  const artistPosts = POSTS.filter((p) => p.artistId === artist.id);
  const isSaved = savedArtistIds.has(artist.id);

  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const bookingConfig = {
    open: { label: 'Ouvert aux demandes', variant: 'success' as const, canRequest: true },
    paused: { label: 'En pause', variant: 'warning' as const, canRequest: false },
    closed: { label: 'Fermé', variant: 'error' as const, canRequest: false },
  }[artist.bookingStatus];

  const handleRequest = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/sign-in');
      return;
    }
    router.push({ pathname: '/request/new', params: { artistId: artist.id } });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Cover */}
        <View style={styles.cover}>
          <Image source={{ uri: artist.coverUrl }} style={styles.coverImage} contentFit="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(10,10,10,0.7)']}
            style={StyleSheet.absoluteFill}
          />
          {/* Header overlay buttons */}
          <View style={[styles.headerOverlay, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.overlayBtn}>
              <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => toggleSaveArtist(artist.id)} style={styles.overlayBtn}>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color={isSaved ? Colors.accent : Colors.textPrimary}
              />
            </TouchableOpacity>
          </View>
          {/* Avatar pinned to bottom of cover */}
          <View style={styles.avatarPinned}>
            <TAvatar uri={artist.avatarUrl} name={artist.blaze} size="2xl" isPremium={artist.tier === 'premium'} />
          </View>
        </View>

        {/* Identity */}
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <TText variant="title1" weight="bold">{artist.blaze}</TText>
            {artist.isVerified && (
              <Ionicons name="checkmark-circle" size={18} color={Colors.info} style={{ marginLeft: 6 }} />
            )}
            {artist.tier === 'premium' && (
              <TBadge label="PRO" variant="premium" style={{ marginLeft: 8 }} />
            )}
          </View>
          <TText variant="bodySmall" color="secondary">{artist.city}</TText>

          <View style={styles.statusRow}>
            <TBadge label={bookingConfig.label} variant={bookingConfig.variant} dot />
            {artist.minBudget > 0 && (
              <TText variant="caption" color="tertiary">
                · À partir de {artist.minBudget}€
              </TText>
            )}
          </View>
        </View>

        {/* Styles */}
        <View style={styles.stylesRow}>
          {artist.styles.map((s) => <TChip key={s} label={s} />)}
          {artist.specialties.map((s) => <TChip key={s} label={s} />)}
        </View>

        <TDivider style={styles.divider} />

        {/* Bio */}
        <View style={styles.section}>
          <TText variant="body" color="secondary" style={styles.bio}>
            {artist.bio}
          </TText>
        </View>

        <TDivider style={styles.divider} />

        {/* Gallery */}
        <View style={styles.section}>
          <TText variant="bodySmall" weight="semibold" style={styles.sectionTitle}>
            Galerie
          </TText>
          <View style={styles.gallery}>
            {artistPosts.map((post) => (
              <TouchableOpacity
                key={post.id}
                style={styles.galleryItem}
                onPress={() => router.push(`/post/${post.id}`)}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: post.mediaUrl }}
                  style={styles.galleryImage}
                  contentFit="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Rules */}
        {artist.rules && (
          <>
            <TDivider style={styles.divider} />
            <View style={styles.section}>
              <TText variant="bodySmall" weight="semibold" style={styles.sectionTitle}>
                Règles de réservation
              </TText>
              <TText variant="bodySmall" color="secondary" style={styles.rulesText}>
                {artist.rules}
              </TText>
            </View>
          </>
        )}

        {/* Process */}
        {artist.process && (
          <>
            <TDivider style={styles.divider} />
            <View style={styles.section}>
              <TText variant="bodySmall" weight="semibold" style={styles.sectionTitle}>
                Mon processus
              </TText>
              <TText variant="bodySmall" color="secondary" style={styles.rulesText}>
                {artist.process}
              </TText>
            </View>
          </>
        )}

        {/* Exclusions */}
        {artist.exclusions.length > 0 && (
          <>
            <TDivider style={styles.divider} />
            <View style={styles.section}>
              <TText variant="bodySmall" weight="semibold" style={styles.sectionTitle}>
                Je ne fais pas
              </TText>
              <View style={styles.exclusions}>
                {artist.exclusions.map((e) => (
                  <View key={e} style={styles.exclusionTag}>
                    <Ionicons name="close" size={12} color={Colors.error} />
                    <TText variant="caption" color="secondary" style={{ marginLeft: 4 }}>{e}</TText>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* FAQ */}
        {artist.faq.length > 0 && (
          <>
            <TDivider style={styles.divider} />
            <View style={styles.section}>
              <TText variant="bodySmall" weight="semibold" style={styles.sectionTitle}>
                Questions fréquentes
              </TText>
              {artist.faq.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.faqItem}
                  onPress={() => setFaqOpen(faqOpen === i ? null : i)}
                  activeOpacity={0.8}
                >
                  <View style={styles.faqRow}>
                    <TText variant="bodySmall" weight="semibold" style={{ flex: 1 }}>
                      {item.question}
                    </TText>
                    <Ionicons
                      name={faqOpen === i ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={Colors.textTertiary}
                    />
                  </View>
                  {faqOpen === i && (
                    <TText variant="bodySmall" color="secondary" style={styles.faqAnswer}>
                      {item.answer}
                    </TText>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 8 }]}>
        {bookingConfig.canRequest ? (
          <TButton
            title="Envoyer une demande"
            onPress={handleRequest}
          />
        ) : (
          <View style={styles.closedBar}>
            <TText variant="bodySmall" color="secondary" style={{ flex: 1 }}>
              {artist.bookingStatus === 'paused'
                ? 'Cet artiste est temporairement en pause.'
                : 'Cet artiste ne prend plus de demandes.'}
            </TText>
            <TButton
              title="Me notifier"
              variant="secondary"
              size="md"
              fullWidth={false}
              onPress={() => {}}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  cover: { height: COVER_HEIGHT, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingBottom: 8,
  },
  overlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10,10,10,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPinned: {
    position: 'absolute',
    bottom: -48,
    left: Spacing.lg,
  },
  identity: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.sm,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing['2xs'] },
  stylesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  divider: { marginHorizontal: Spacing.lg },
  section: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  sectionTitle: { marginBottom: Spacing['2xs'] },
  bio: { lineHeight: 24 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  galleryItem: { width: (width - Spacing.lg * 2 - 4) / 3 },
  galleryImage: { width: '100%', aspectRatio: 1, backgroundColor: Colors.bgSurface },
  rulesText: { lineHeight: 22 },
  exclusions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  exclusionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248,113,113,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  faqItem: {
    paddingVertical: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  faqAnswer: { marginTop: Spacing['2xs'], lineHeight: 20 },
  stickyBar: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing['2xs'],
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  closedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
