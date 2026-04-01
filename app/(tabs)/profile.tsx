import React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TBadge } from '@/components/ui/TBadge';
import { TButton } from '@/components/ui/TButton';
import { TChip } from '@/components/ui/TChip';
import { TDivider } from '@/components/ui/TDivider';
import { useAuthStore } from '@/store/auth-store';
import { ARTISTS, POSTS } from '@/constants/mock-data';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const isArtist = user?.role === 'artist';

  // For demo: use artist a1 if artist role
  const artist = isArtist ? ARTISTS[0] : null;
  const artistPosts = artist ? POSTS.filter((p) => p.artistId === artist.id) : [];

  if (!isArtist) {
    return (
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TText variant="title1" weight="bold">Mon profil</TText>
          <TouchableOpacity onPress={() => router.push('/settings/index')} style={styles.headerBtn}>
            <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.clientProfile}>
          <TAvatar name={user?.displayName} size="2xl" />
          <TText variant="title1" weight="bold" style={{ marginTop: Spacing.sm }}>
            {user?.displayName ?? 'Utilisateur'}
          </TText>
          {user?.city && (
            <TText variant="bodySmall" color="secondary">
              {user.city}
            </TText>
          )}
        </View>

        <TDivider style={styles.divider} />

        <View style={styles.menuSection}>
          <MenuItem icon="document-text-outline" label="Mes demandes" onPress={() => router.push('/(tabs)/inbox')} />
          <MenuItem icon="bookmark-outline" label="Artistes sauvegardés" onPress={() => {}} />
          <MenuItem icon="heart-outline" label="Posts aimés" onPress={() => {}} />
          <TDivider style={{ marginVertical: Spacing['2xs'] }} />
          <MenuItem icon="settings-outline" label="Paramètres" onPress={() => router.push('/settings/index')} />
          <MenuItem icon="help-circle-outline" label="Aide et support" onPress={() => router.push('/settings/support')} />
        </View>

        <View style={styles.tattooerCTA}>
          <TText variant="bodySmall" color="secondary" style={{ textAlign: 'center', marginBottom: Spacing.sm }}>
            Tu es tatoueur ?
          </TText>
          <TButton title="Créer un compte tatoueur" variant="secondary" size="md" fullWidth={false} />
        </View>
      </ScrollView>
    );
  }

  // Artist view
  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TText variant="title1" weight="bold">Mon profil</TText>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push('/analytics')}
            style={styles.headerBtn}
          >
            <Ionicons name="bar-chart-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings/index')} style={styles.headerBtn}>
            <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Cover */}
      <View style={styles.coverContainer}>
        <Image
          source={{ uri: artist!.coverUrl }}
          style={styles.cover}
          contentFit="cover"
        />
        <View style={styles.coverOverlay} />
        <View style={styles.coverContent}>
          <TAvatar uri={artist!.avatarUrl} name={artist!.blaze} size="2xl" isPremium={artist!.tier === 'premium'} />
        </View>
      </View>

      <View style={styles.artistInfo}>
        <View style={styles.artistNameRow}>
          <TText variant="title1" weight="bold">{artist!.blaze}</TText>
          {artist!.isVerified && (
            <Ionicons name="checkmark-circle" size={18} color={Colors.info} style={{ marginLeft: 4 }} />
          )}
          {artist!.tier === 'premium' && (
            <TBadge label="PREMIUM" variant="premium" style={{ marginLeft: 8 }} />
          )}
        </View>
        <TText variant="bodySmall" color="secondary">{artist!.city}</TText>
        <TText variant="body" color="secondary" style={styles.bio}>{artist!.bio}</TText>

        <View style={styles.stylesRow}>
          {artist!.styles.map((s) => (
            <TChip key={s} label={s} />
          ))}
        </View>
      </View>

      {/* Quick stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <TText variant="title1" weight="bold">{artist!.stats.posts}</TText>
          <TText variant="caption" color="tertiary">Posts</TText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <TText variant="title1" weight="bold">{artist!.stats.profileViews.toLocaleString('fr')}</TText>
          <TText variant="caption" color="tertiary">Vues profil</TText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <TText variant="title1" weight="bold">{artist!.stats.requestsThisMonth}</TText>
          <TText variant="caption" color="tertiary">Demandes / mois</TText>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { flex: 2 }]}
          onPress={() => router.push(`/artist/${artist!.id}`)}
        >
          <Ionicons name="eye-outline" size={18} color={Colors.textSecondary} />
          <TText variant="caption" color="secondary" style={{ marginLeft: 6 }}>Voir mon profil</TText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { flex: 1 }]}
          onPress={() => router.push('/create')}
        >
          <Ionicons name="add" size={18} color={Colors.textSecondary} />
          <TText variant="caption" color="secondary" style={{ marginLeft: 6 }}>Post</TText>
        </TouchableOpacity>
        {artist!.tier === 'premium' && (
          <TouchableOpacity
            style={[styles.actionBtn, { flex: 1 }]}
            onPress={() => router.push('/customization')}
          >
            <Ionicons name="color-palette-outline" size={18} color={Colors.accentWarm} />
            <TText variant="caption" style={{ color: Colors.accentWarm, marginLeft: 6 }}>Perso</TText>
          </TouchableOpacity>
        )}
      </View>

      <TDivider />

      {/* Gallery preview */}
      <View style={styles.gallerySection}>
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

      {/* Menu */}
      <TDivider style={styles.divider} />
      <View style={styles.menuSection}>
        <MenuItem icon="analytics-outline" label="Analytics" onPress={() => router.push('/analytics')} />
        {artist!.tier === 'premium' && (
          <MenuItem
            icon="book-outline"
            label="Manuel Premium"
            onPress={() => router.push('/premium-guide')}
            accent
          />
        )}
        <MenuItem icon="calendar-outline" label="Agenda" onPress={() => router.push('/(tabs)/agenda')} />
        <TDivider style={{ marginVertical: Spacing['2xs'] }} />
        <MenuItem icon="settings-outline" label="Paramètres" onPress={() => router.push('/settings/index')} />
        <MenuItem icon="help-circle-outline" label="Aide et support" onPress={() => router.push('/settings/support')} />
      </View>
    </ScrollView>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  accent = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.8}>
      <Ionicons
        name={icon as any}
        size={20}
        color={accent ? Colors.accentWarm : Colors.textSecondary}
        style={styles.menuIcon}
      />
      <TText variant="body" style={{ flex: 1, color: accent ? Colors.accentWarm : Colors.textPrimary }}>
        {label}
      </TText>
      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerActions: { flexDirection: 'row' },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  clientProfile: { alignItems: 'center', padding: Spacing.xl },
  coverContainer: { height: 200, position: 'relative' },
  cover: { width: '100%', height: '100%' },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.4)',
  },
  coverContent: {
    position: 'absolute',
    bottom: -48,
    left: Spacing.lg,
  },
  artistInfo: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.sm,
  },
  artistNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  bio: { marginTop: Spacing['2xs'], lineHeight: 22, marginBottom: Spacing.sm },
  stylesRow: { flexDirection: 'row', flexWrap: 'wrap' },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    marginHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: Spacing.sm,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, backgroundColor: Colors.borderSubtle, marginVertical: 4 },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  gallerySection: { paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm },
  sectionTitle: { marginBottom: Spacing['2xs'] },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  galleryItem: { width: '33%' },
  galleryImage: { width: '100%', aspectRatio: 1, backgroundColor: Colors.bgSurface },
  divider: { marginVertical: Spacing.sm },
  menuSection: { paddingHorizontal: Spacing.sm },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing['2xs'],
  },
  menuIcon: { marginRight: Spacing.sm },
  tattooerCTA: { alignItems: 'center', paddingVertical: Spacing.xl },
});
