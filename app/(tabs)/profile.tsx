import React, { useRef, useEffect } from 'react';
import {
  ScrollView, StyleSheet, View, TouchableOpacity,
  Animated as RNAnimated, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TBadge } from '@/components/ui/TBadge';
import { TButton } from '@/components/ui/TButton';
import { TChip } from '@/components/ui/TChip';
import { TDivider } from '@/components/ui/TDivider';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuthStore } from '@/store/auth-store';
import { ARTISTS, POSTS } from '@/constants/mock-data';

const { width: SCREEN_W } = Dimensions.get('window');
const COVER_H = 260;
const GALLERY_GAP = 2;
const GALLERY_CELL = (SCREEN_W - Spacing.sm * 2 - GALLERY_GAP * 2) / 3;

function StatCounter({ value, label, delay = 0 }: { value: number; label: string; delay?: number }) {
  const animated = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const timer = setTimeout(() => {
      RNAnimated.spring(animated, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 120 }).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);
  const scale = animated.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.5, 1.1, 1] });
  const opacity = animated.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] });
  return (
    <RNAnimated.View style={[styles.statItem, { transform: [{ scale }], opacity }]}>
      <TText variant="title1" weight="bold" style={styles.statValue}>
        {value > 999 ? `${(value / 1000).toFixed(1)}k` : value}
      </TText>
      <TText variant="caption" color="tertiary">{label}</TText>
    </RNAnimated.View>
  );
}

function MenuItem({ icon, label, onPress, accent = false, badge }: {
  icon: string; label: string; onPress: () => void; accent?: boolean; badge?: number;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => {
          scale.value = withSpring(0.97, { damping: 12 }, () => { scale.value = withSpring(1); });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        activeOpacity={1}
      >
        <View style={[styles.menuIconWrap, accent && styles.menuIconWrapAccent]}>
          <Ionicons name={icon as any} size={18} color={accent ? Colors.accentWarm : Colors.textSecondary} />
        </View>
        <TText variant="body" style={{ flex: 1, color: accent ? Colors.accentWarm : Colors.textPrimary }}>{label}</TText>
        {badge != null && badge > 0 && (
          <View style={styles.menuBadge}>
            <TText variant="micro" style={{ color: '#fff', fontSize: 9 }}>{badge}</TText>
          </View>
        )}
        <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function GalleryCell({ uri, onPress, index }: { uri: string; onPress: () => void; index: number }) {
  const isTall = index % 5 === 0;
  return (
    <Animated.View entering={FadeIn.delay(index * 50).duration(400)} style={[styles.galleryCell, isTall && styles.galleryCellTall]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={StyleSheet.absoluteFill}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const isArtist = user?.role === 'artist';
  const artist = isArtist ? ARTISTS[0] : null;
  const artistPosts = artist ? POSTS.filter((p) => p.artistId === artist.id) : [];

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const coverTranslate = scrollY.interpolate({ inputRange: [-100, 0, COVER_H], outputRange: [50, 0, -COVER_H * 0.4], extrapolate: 'clamp' });
  const coverScale = scrollY.interpolate({ inputRange: [-100, 0], outputRange: [1.2, 1], extrapolate: 'clamp' });
  const avatarOpacity = scrollY.interpolate({ inputRange: [0, COVER_H * 0.5], outputRange: [1, 0], extrapolate: 'clamp' });
  const headerTitleOpacity = scrollY.interpolate({ inputRange: [COVER_H * 0.6, COVER_H * 0.9], outputRange: [0, 1], extrapolate: 'clamp' });

  if (!isArtist) {
    return (
      <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
        <View style={styles.simpleHeader}>
          <TText variant="title1" weight="bold">Mon profil</TText>
          <TouchableOpacity onPress={() => router.push('/settings/index')} style={styles.headerBtn}>
            <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.clientHero}>
          <View style={styles.clientAvatarRing}>
            <TAvatar name={user?.displayName} size="2xl" />
          </View>
          <TText variant="title1" weight="bold" style={{ marginTop: Spacing.sm }}>{user?.displayName ?? 'Utilisateur'}</TText>
          {user?.city && <TText variant="bodySmall" color="secondary" style={{ marginTop: 2 }}>{user.city}</TText>}
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.clientActions}>
          {[
            { icon: 'document-text-outline', label: 'Demandes', onPress: () => router.push('/(tabs)/inbox') },
            { icon: 'bookmark-outline', label: 'Sauvegardés', onPress: () => {} },
            { icon: 'heart-outline', label: 'Aimés', onPress: () => {} },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.clientAction} onPress={item.onPress}>
              <Ionicons name={item.icon as any} size={22} color={Colors.accentWarm} />
              <TText variant="caption" color="secondary" style={{ marginTop: 4 }}>{item.label}</TText>
            </TouchableOpacity>
          ))}
        </Animated.View>
        <TDivider style={{ marginVertical: Spacing.sm }} />
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.menuSection}>
          <MenuItem icon="settings-outline" label="Paramètres" onPress={() => router.push('/settings/index')} />
          <MenuItem icon="help-circle-outline" label="Aide et support" onPress={() => router.push('/settings/support')} />
          <MenuItem icon="shield-outline" label="Confidentialité" onPress={() => {}} />
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.artistCTA}>
          <GlassCard variant="premium" style={styles.artistCTACard}>
            <TText variant="title2" weight="bold" style={{ marginBottom: 6 }}>Tu es tatoueur ?</TText>
            <TText variant="caption" color="secondary" style={{ marginBottom: Spacing.sm, lineHeight: 18 }}>
              Rejoins plus de 2 000 artistes qui gèrent leurs clients avec TATTOO.
            </TText>
            <TButton title="Créer un compte tatoueur →" variant="glow" size="sm" onPress={() => {}} />
          </GlassCard>
        </Animated.View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <RNAnimated.View style={[styles.floatingHeader, { paddingTop: insets.top, opacity: headerTitleOpacity }]}>
        <View style={styles.floatingHeaderInner}>
          <TText variant="title2" weight="bold">{artist!.blaze}</TText>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity onPress={() => router.push('/analytics')} style={styles.headerBtn}>
              <Ionicons name="bar-chart-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/settings/index')} style={styles.headerBtn}>
              <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </RNAnimated.View>

      <RNAnimated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        onScroll={RNAnimated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        <View style={styles.coverContainer}>
          <RNAnimated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: coverTranslate }, { scale: coverScale }] }]}>
            <Image source={{ uri: artist!.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </RNAnimated.View>
          <LinearGradient colors={['transparent', 'rgba(5,5,8,0.3)', 'rgba(5,5,8,0.98)']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
          <View style={[styles.coverHeader, { paddingTop: insets.top + 8 }]}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => router.push('/analytics')} style={styles.coverBtn}>
              <Ionicons name="bar-chart-outline" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/settings/index')} style={styles.coverBtn}>
              <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
          <RNAnimated.View style={[styles.coverAvatarWrap, { opacity: avatarOpacity }]}>
            <TAvatar uri={artist!.avatarUrl} name={artist!.blaze} size="2xl" isPremium={artist!.tier === 'premium'} />
          </RNAnimated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.identitySection}>
          <View style={styles.nameRow}>
            <TText variant="title1" weight="bold" style={{ letterSpacing: -1 }}>{artist!.blaze}</TText>
            {artist!.isVerified && <Ionicons name="checkmark-circle" size={20} color={Colors.info} style={{ marginLeft: 6 }} />}
            {artist!.tier === 'premium' && <TBadge label="PREMIUM" variant="premium" style={{ marginLeft: 8 }} />}
          </View>
          <TText variant="bodySmall" color="secondary" style={{ marginTop: 2 }}>{artist!.city}</TText>
          {artist!.minBudget > 0 && (
            <TText variant="caption" style={{ color: Colors.accentWarm, marginTop: 6 }}>À partir de {artist!.minBudget}€</TText>
          )}
          <TText variant="body" color="secondary" style={styles.bio} numberOfLines={3}>{artist!.bio}</TText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Spacing.xs }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {artist!.styles.map((s) => <TChip key={s} label={s} />)}
            </View>
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).springify()} style={{ paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm }}>
          <GlassCard variant="elevated" style={{ flexDirection: 'row', paddingVertical: Spacing.sm }}>
            <StatCounter value={artist!.stats.posts} label="Posts" delay={0} />
            <View style={styles.statDivider} />
            <StatCounter value={artist!.stats.profileViews} label="Vues profil" delay={100} />
            <View style={styles.statDivider} />
            <StatCounter value={artist!.stats.requestsThisMonth} label="Demandes" delay={200} />
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={() => router.push(`/artist/${artist!.id}`)}>
            <Ionicons name="eye-outline" size={17} color={Colors.textSecondary} />
            <TText variant="caption" color="secondary" style={{ marginLeft: 6 }}>Voir profil</TText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtnAccent, { flex: 1 }]} onPress={() => router.push('/create')}>
            <Ionicons name="add" size={18} color={Colors.accentWarm} />
            <TText variant="caption" style={{ color: Colors.accentWarm, marginLeft: 6 }}>Publier</TText>
          </TouchableOpacity>
          {artist!.tier === 'premium' && (
            <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={() => router.push('/customization')}>
              <Ionicons name="color-palette-outline" size={17} color={Colors.textSecondary} />
              <TText variant="caption" color="secondary" style={{ marginLeft: 6 }}>Perso</TText>
            </TouchableOpacity>
          )}
        </Animated.View>

        <TDivider style={{ marginHorizontal: Spacing.sm, marginBottom: Spacing.sm }} />

        {artistPosts.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.gallerySection}>
            <View style={styles.gallerySectionHeader}>
              <TText variant="label" color="tertiary" uppercase>Galerie</TText>
              <TouchableOpacity onPress={() => router.push(`/artist/${artist!.id}`)}>
                <TText variant="caption" style={{ color: Colors.accentWarm }}>Tout voir →</TText>
              </TouchableOpacity>
            </View>
            <View style={styles.galleryGrid}>
              {artistPosts.map((post, i) => (
                <GalleryCell key={post.id} uri={post.mediaUrl} onPress={() => router.push(`/post/${post.id}`)} index={i} />
              ))}
            </View>
          </Animated.View>
        )}

        <TDivider style={{ marginHorizontal: Spacing.sm, marginVertical: Spacing.sm }} />

        <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.menuSection}>
          <MenuItem icon="analytics-outline" label="Analytics" onPress={() => router.push('/analytics')} />
          <MenuItem icon="calendar-outline" label="Agenda" onPress={() => router.push('/(tabs)/agenda')} />
          {artist!.tier === 'premium' && (
            <MenuItem icon="book-outline" label="Manuel Premium" onPress={() => router.push('/premium-guide')} accent />
          )}
          <TDivider style={{ marginVertical: Spacing['2xs'] }} />
          <MenuItem icon="settings-outline" label="Paramètres" onPress={() => router.push('/settings/index')} />
          <MenuItem icon="help-circle-outline" label="Aide et support" onPress={() => router.push('/settings/support')} />
        </Animated.View>
      </RNAnimated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  floatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    backgroundColor: 'rgba(5,5,8,0.92)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  floatingHeaderInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm, height: 56,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  simpleHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle,
  },
  clientHero: { alignItems: 'center', paddingVertical: Spacing.xl },
  clientAvatarRing: { padding: 3, borderRadius: 999, borderWidth: 2, borderColor: Colors.accentWarm },
  clientActions: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl, paddingVertical: Spacing.sm },
  clientAction: {
    alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    backgroundColor: Colors.bgSurface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.borderSubtle, minWidth: 88,
  },
  coverContainer: { height: COVER_H, overflow: 'hidden', position: 'relative' },
  coverHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', paddingHorizontal: Spacing.sm, gap: 4,
  },
  coverBtn: {
    width: 38, height: 38, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 19,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  coverAvatarWrap: { position: 'absolute', bottom: -28, left: Spacing.lg },
  identitySection: { paddingHorizontal: Spacing.lg, paddingTop: 44, paddingBottom: Spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  bio: { marginTop: Spacing.xs, lineHeight: 22 },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { letterSpacing: -1 },
  statDivider: { width: 1, backgroundColor: Colors.borderSubtle, marginVertical: 4 },
  actionsRow: { flexDirection: 'row', paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm, gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44,
    backgroundColor: Colors.bgSurface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  actionBtnAccent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44,
    backgroundColor: 'rgba(200,168,130,0.08)', borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(200,168,130,0.25)',
  },
  gallerySection: { paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm },
  gallerySectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing['2xs'] },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GALLERY_GAP },
  galleryCell: { width: GALLERY_CELL, height: GALLERY_CELL, backgroundColor: Colors.bgSurface, overflow: 'hidden', borderRadius: Radius.xs },
  galleryCellTall: { height: GALLERY_CELL * 1.6 },
  menuSection: { paddingHorizontal: Spacing.sm },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: Spacing['2xs'], gap: Spacing.sm },
  menuIconWrap: {
    width: 34, height: 34, borderRadius: Radius.sm, backgroundColor: Colors.bgSurface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  menuIconWrapAccent: { backgroundColor: 'rgba(200,168,130,0.08)', borderColor: 'rgba(200,168,130,0.25)' },
  menuBadge: {
    backgroundColor: Colors.error, borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  artistCTA: { paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm },
  artistCTACard: { padding: Spacing.md },
});
