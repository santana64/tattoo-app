import React, { useRef, useEffect, useState } from 'react';
import {
  ScrollView, StyleSheet, View, TouchableOpacity,
  Animated as RNAnimated, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn, FadeInDown, FadeInUp,
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow, Gradients } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TBadge } from '@/components/ui/TBadge';
import { TButton } from '@/components/ui/TButton';
import { TChip } from '@/components/ui/TChip';
import { TDivider } from '@/components/ui/TDivider';
import { GlassCard } from '@/components/ui/GlassCard';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/auth-store';
import { ARTISTS, POSTS } from '@/constants/mock-data';

const { width: SCREEN_W } = Dimensions.get('window');
const COVER_H = 280;
const GALLERY_GAP = 2;
const GALLERY_CELL = (SCREEN_W - Spacing.sm * 2 - GALLERY_GAP * 2) / 3;

// ── Animated stat counter
function StatCounter({ value, label, delay = 0, accent = false }: {
  value: number; label: string; delay?: number; accent?: boolean;
}) {
  const animated = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const timer = setTimeout(() => {
      RNAnimated.spring(animated, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 100 }).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);
  const scale = animated.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1.12, 1] });
  const opacity = animated.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] });
  return (
    <RNAnimated.View style={[styles.statItem, { transform: [{ scale }], opacity }]}>
      <TText variant="title1" weight="bold" style={[styles.statValue, accent && { color: Colors.accentWarm }]}>
        {value > 999 ? `${(value / 1000).toFixed(1)}k` : value}
      </TText>
      <TText variant="caption" color="tertiary">{label}</TText>
    </RNAnimated.View>
  );
}

// ── Menu item with spring
function MenuItem({ icon, label, onPress, accent = false, badge, subtitle, right }: {
  icon: string; label: string; onPress: () => void;
  accent?: boolean; badge?: number; subtitle?: string; right?: React.ReactNode;
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
        <View style={[styles.menuIconWrap, accent && styles.menuIconAccent]}>
          <Ionicons name={icon as any} size={18} color={accent ? Colors.accentWarm : Colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <TText variant="body" style={{ color: accent ? Colors.accentWarm : Colors.textPrimary }}>{label}</TText>
          {subtitle && <TText variant="caption" color="tertiary" style={{ marginTop: 1 }}>{subtitle}</TText>}
        </View>
        {right}
        {badge != null && badge > 0 && (
          <View style={styles.menuBadge}>
            <TText variant="micro" style={{ color: '#fff', fontSize: 9 }}>{badge}</TText>
          </View>
        )}
        <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Gallery cell with FadeIn
function GalleryCell({ uri, onPress, index }: { uri: string; onPress: () => void; index: number }) {
  const isTall = index % 5 === 0;
  return (
    <Animated.View entering={FadeIn.delay(index * 40).duration(400)} style={[styles.galleryCell, isTall && styles.galleryCellTall]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={StyleSheet.absoluteFill}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(3,3,5,0.35)']}
          style={StyleSheet.absoluteFill}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Booking status row
function BookingStatusRow({ status }: { status: 'open' | 'paused' | 'closed' }) {
  const statusConf = {
    open:   { color: Colors.successLight,  label: 'Disponible', icon: 'checkmark-circle-outline' },
    paused: { color: Colors.warningLight,  label: 'En pause',   icon: 'pause-circle-outline' },
    closed: { color: Colors.errorLight,    label: 'Fermé',      icon: 'close-circle-outline' },
  }[status];

  return (
    <View style={styles.bookingStatusRow}>
      <View style={[styles.bookingStatusDot, { backgroundColor: statusConf.color }]} />
      <TText variant="caption" style={{ color: statusConf.color, fontWeight: '600' }}>{statusConf.label}</TText>
      <TText variant="caption" color="tertiary" style={{ marginLeft: 'auto' }}>Modifier →</TText>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const isArtist = user?.role === 'artist';
  const artist = isArtist ? ARTISTS[0] : null;
  const artistPosts = artist ? POSTS.filter((p) => p.artistId === artist.id) : [];

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const coverTranslate = scrollY.interpolate({
    inputRange: [-100, 0, COVER_H],
    outputRange: [60, 0, -COVER_H * 0.45],
    extrapolate: 'clamp',
  });
  const coverScale = scrollY.interpolate({ inputRange: [-100, 0], outputRange: [1.25, 1], extrapolate: 'clamp' });
  const avatarOpacity = scrollY.interpolate({ inputRange: [0, COVER_H * 0.4], outputRange: [1, 0], extrapolate: 'clamp' });
  const headerTitleOpacity = scrollY.interpolate({ inputRange: [COVER_H * 0.5, COVER_H * 0.8], outputRange: [0, 1], extrapolate: 'clamp' });

  // ── CLIENT VIEW
  if (!isArtist) {
    return (
      <View style={styles.container}>
        <ScrollView
          style={{ paddingTop: insets.top }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.simpleHeader}>
            <TText variant="title1" weight="bold">Mon profil</TText>
            <TouchableOpacity onPress={() => router.push('/settings/index')} style={styles.headerBtn}>
              <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Hero */}
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.clientHero}>
            <View style={styles.clientAvatarRing}>
              <LinearGradient
                colors={[Colors.accentGlow, Colors.accentWarm, '#B86030']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.clientAvatarInner}>
                <TAvatar name={user?.displayName} size="2xl" />
              </View>
            </View>
            <TText variant="title1" weight="bold" style={{ marginTop: Spacing.sm, letterSpacing: -0.5 }}>
              {user?.displayName ?? 'Utilisateur'}
            </TText>
            {user?.city && (
              <TText variant="bodySmall" color="secondary" style={{ marginTop: 3 }}>
                📍 {user.city}
              </TText>
            )}
          </Animated.View>

          {/* Quick actions */}
          <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.clientQuickActions}>
            {[
              { icon: 'document-text-outline', label: 'Demandes', count: 2, onPress: () => router.push('/(tabs)/inbox') },
              { icon: 'bookmark-outline', label: 'Sauvegardés', count: 0, onPress: () => {} },
              { icon: 'heart-outline', label: 'Aimés', count: 0, onPress: () => {} },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.clientQuickAction}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); item.onPress(); }}
                activeOpacity={0.8}
              >
                <View style={styles.clientActionIcon}>
                  <Ionicons name={item.icon as any} size={22} color={Colors.accentWarm} />
                </View>
                <TText variant="bodySmall" weight="semibold" style={{ marginTop: 8 }}>{item.label}</TText>
                {item.count > 0 && (
                  <TText variant="micro" style={{ color: Colors.accentWarm, marginTop: 2 }}>
                    {item.count} nouveau{item.count > 1 ? 'x' : ''}
                  </TText>
                )}
              </TouchableOpacity>
            ))}
          </Animated.View>

          <TDivider style={{ marginHorizontal: Spacing.sm, marginVertical: Spacing.sm }} />

          {/* Settings menu */}
          <Animated.View entering={FadeInDown.delay(260).springify()} style={styles.menuSection}>
            <TText variant="label" color="tertiary" uppercase style={{ paddingHorizontal: Spacing.sm, marginBottom: Spacing['2xs'], letterSpacing: 2 }}>
              Mon compte
            </TText>
            <MenuItem icon="person-outline" label="Mon profil" subtitle="Modifier mes infos" onPress={() => router.push('/settings/account')} />
            <MenuItem icon="notifications-outline" label="Notifications" onPress={() => router.push('/settings/notifications')} />
            <MenuItem icon="shield-outline" label="Confidentialité" onPress={() => router.push('/settings/privacy')} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(320).springify()} style={[styles.menuSection, { marginTop: Spacing.sm }]}>
            <TText variant="label" color="tertiary" uppercase style={{ paddingHorizontal: Spacing.sm, marginBottom: Spacing['2xs'], letterSpacing: 2 }}>
              Support
            </TText>
            <MenuItem icon="help-circle-outline" label="Aide et support" onPress={() => router.push('/settings/support')} />
            <MenuItem icon="star-outline" label="Noter l'application" onPress={() => {}} accent />
          </Animated.View>

          {/* Artist CTA card */}
          <Animated.View entering={FadeInUp.delay(400).springify()} style={{ paddingHorizontal: Spacing.sm, paddingTop: Spacing.md }}>
            <GlassCard variant="premium" style={styles.artistCTACard}>
              <LinearGradient
                colors={['rgba(212,168,100,0.10)', 'rgba(212,168,100,0.03)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.artistCTAIcon}>
                <Ionicons name="color-palette" size={22} color={Colors.accentWarm} />
              </View>
              <TText variant="title2" weight="bold" style={{ marginBottom: 6 }}>Tu es tatoueur ?</TText>
              <TText variant="caption" color="secondary" style={{ marginBottom: Spacing.sm, lineHeight: 18 }}>
                Rejoins plus de 2 400 artistes qui gèrent leurs clients avec INKR.
              </TText>
              <TButton title="Créer un compte tatoueur →" variant="glow" size="sm" onPress={() => {}} />
            </GlassCard>
          </Animated.View>

          {/* Logout */}
          <Animated.View entering={FadeIn.delay(600)} style={{ paddingHorizontal: Spacing.sm, paddingTop: Spacing.xl }}>
            <TouchableOpacity
              onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); logout(); }}
              style={styles.logoutBtn}
            >
              <Ionicons name="log-out-outline" size={18} color={Colors.errorLight} />
              <TText variant="bodySmall" style={{ color: Colors.errorLight, marginLeft: 8 }}>Déconnexion</TText>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ── ARTIST VIEW
  return (
    <View style={styles.container}>
      {/* Floating header (appears on scroll) */}
      <RNAnimated.View style={[styles.floatingHeader, { paddingTop: insets.top, opacity: headerTitleOpacity }]}>
        <View style={styles.floatingHeaderInner}>
          <TText variant="title2" weight="bold">{artist!.blaze}</TText>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <TouchableOpacity onPress={() => router.push('/analytics')} style={styles.headerBtn}>
              <Ionicons name="bar-chart-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/settings/index')} style={styles.headerBtn}>
              <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
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
        {/* Cover + parallax */}
        <View style={styles.coverContainer}>
          <RNAnimated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: coverTranslate }, { scale: coverScale }] }]}>
            <Image source={{ uri: artist!.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </RNAnimated.View>
          <LinearGradient
            colors={['transparent', 'rgba(3,3,5,0.25)', 'rgba(3,3,5,0.98)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* Top buttons */}
          <View style={[styles.coverHeader, { paddingTop: insets.top + 8 }]}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => router.push('/analytics')} style={styles.coverBtn}>
              <Ionicons name="bar-chart-outline" size={19} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/settings/index')} style={styles.coverBtn}>
              <Ionicons name="settings-outline" size={19} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>
          {/* Avatar */}
          <RNAnimated.View style={[styles.coverAvatarWrap, { opacity: avatarOpacity }]}>
            <TAvatar uri={artist!.avatarUrl} name={artist!.blaze} size="2xl" isPremium={artist!.tier === 'premium'} />
          </RNAnimated.View>
        </View>

        {/* Identity section */}
        <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.identitySection}>
          <View style={styles.nameRow}>
            <TText variant="title1" weight="bold" style={{ letterSpacing: -1 }}>{artist!.blaze}</TText>
            {artist!.isVerified && <Ionicons name="checkmark-circle" size={20} color={Colors.infoLight} style={{ marginLeft: 6 }} />}
            {artist!.tier === 'premium' && <TBadge label="PREMIUM" variant="premium" style={{ marginLeft: 8 }} />}
          </View>
          <TText variant="bodySmall" color="secondary" style={{ marginTop: 3 }}>📍 {artist!.city}</TText>
          {artist!.minBudget > 0 && (
            <TText variant="caption" style={{ color: Colors.accentWarm, marginTop: 6, fontWeight: '600' }}>
              Tatouages à partir de {artist!.minBudget}€
            </TText>
          )}
          <TText variant="body" color="secondary" style={styles.bio}>{artist!.bio}</TText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Spacing.xs }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {artist!.styles.map((s) => <TChip key={s} label={s} />)}
            </View>
          </ScrollView>
        </Animated.View>

        {/* Stats card */}
        <Animated.View entering={FadeInDown.delay(220).springify()} style={styles.statsCardWrap}>
          <GlassCard variant="elevated" style={{ flexDirection: 'row', paddingVertical: Spacing.sm }}>
            <StatCounter value={artist!.stats.posts} label="Posts" delay={0} />
            <View style={styles.statDivider} />
            <StatCounter value={artist!.stats.profileViews} label="Vues profil" delay={80} />
            <View style={styles.statDivider} />
            <StatCounter value={artist!.stats.requestsThisMonth} label="Demandes" delay={160} accent />
          </GlassCard>
        </Animated.View>

        {/* Quick actions */}
        <Animated.View entering={FadeInDown.delay(280).springify()} style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={() => router.push(`/artist/${artist!.id}`)}>
            <Ionicons name="eye-outline" size={16} color={Colors.textSecondary} />
            <TText variant="caption" color="secondary" style={{ marginLeft: 6 }}>Voir profil</TText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtnPrimary, { flex: 1.2 }]} onPress={() => router.push('/create')}>
            <LinearGradient
              colors={[Colors.accentGlow, Colors.accentWarm, '#B06030']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="add" size={17} color={Colors.bgPrimary} />
            <TText variant="caption" style={{ color: Colors.bgPrimary, marginLeft: 5, fontWeight: '700' }}>Publier</TText>
          </TouchableOpacity>
          {artist!.tier === 'premium' && (
            <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={() => router.push('/customization')}>
              <Ionicons name="color-palette-outline" size={16} color={Colors.textSecondary} />
              <TText variant="caption" color="secondary" style={{ marginLeft: 5 }}>Perso</TText>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Booking status */}
        <Animated.View entering={FadeInDown.delay(320).springify()} style={{ paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm }}>
          <GlassCard variant="default">
            <BookingStatusRow status={artist!.bookingStatus} />
          </GlassCard>
        </Animated.View>

        <TDivider style={{ marginHorizontal: Spacing.sm, marginBottom: Spacing.sm }} />

        {/* Gallery */}
        {artistPosts.length > 0 && (
          <Animated.View entering={FadeInDown.delay(380).springify()} style={styles.gallerySection}>
            <View style={styles.gallerySectionHeader}>
              <TText variant="label" color="tertiary" uppercase style={{ letterSpacing: 2 }}>Galerie · {artistPosts.length}</TText>
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

        {/* Manage section */}
        <Animated.View entering={FadeInDown.delay(440).springify()} style={styles.menuSection}>
          <TText variant="label" color="tertiary" uppercase style={{ paddingHorizontal: Spacing.sm, marginBottom: Spacing['2xs'], letterSpacing: 2 }}>
            Gérer
          </TText>
          <MenuItem icon="analytics-outline" label="Analytics" subtitle="Vues, demandes, conversion" onPress={() => router.push('/analytics')} />
          <MenuItem icon="calendar-outline" label="Agenda" subtitle="Rendez-vous à venir" onPress={() => router.push('/(tabs)/agenda')} />
          <MenuItem icon="mail-outline" label="Inbox" subtitle="Demandes de tatouage" onPress={() => router.push('/(tabs)/inbox')} />
          {artist!.tier === 'premium' && (
            <MenuItem icon="book-outline" label="Manuel Premium" subtitle="Stratégie, tips, croissance" onPress={() => router.push('/premium-guide')} accent />
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).springify()} style={[styles.menuSection, { marginTop: Spacing.sm }]}>
          <TText variant="label" color="tertiary" uppercase style={{ paddingHorizontal: Spacing.sm, marginBottom: Spacing['2xs'], letterSpacing: 2 }}>
            Paramètres
          </TText>
          <MenuItem icon="settings-outline" label="Paramètres" onPress={() => router.push('/settings/index')} />
          <MenuItem
            icon="card-outline"
            label="Abonnement"
            subtitle={artist!.tier === 'premium' ? 'Premium actif' : 'Passer Premium'}
            onPress={() => router.push('/settings/subscription')}
            accent={artist!.tier !== 'premium'}
          />
          <MenuItem icon="help-circle-outline" label="Aide et support" onPress={() => router.push('/settings/support')} />
        </Animated.View>

        {/* Logout */}
        <Animated.View entering={FadeIn.delay(600)} style={{ paddingHorizontal: Spacing.sm, paddingTop: Spacing.xl }}>
          <TouchableOpacity
            onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); logout(); }}
            style={styles.logoutBtn}
          >
            <Ionicons name="log-out-outline" size={18} color={Colors.errorLight} />
            <TText variant="bodySmall" style={{ color: Colors.errorLight, marginLeft: 8 }}>Déconnexion</TText>
          </TouchableOpacity>
        </Animated.View>
      </RNAnimated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  floatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    backgroundColor: 'rgba(3,3,5,0.92)',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle,
  },
  floatingHeaderInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm, height: 56,
  },
  headerBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  simpleHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle,
  },

  clientHero: { alignItems: 'center', paddingVertical: Spacing.xl },
  clientAvatarRing: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  clientAvatarInner: {
    width: 82, height: 82, borderRadius: 41,
    overflow: 'hidden', backgroundColor: Colors.bgSubtle,
    alignItems: 'center', justifyContent: 'center',
    margin: 3,
  },
  clientQuickActions: {
    flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm,
  },
  clientQuickAction: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgSurface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSubtle,
  },
  clientActionIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.glassAmber,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderGlow,
  },

  coverContainer: { height: COVER_H, overflow: 'hidden', position: 'relative' },
  coverHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', paddingHorizontal: Spacing.sm, gap: 6,
  },
  coverBtn: {
    width: 38, height: 38, backgroundColor: 'rgba(0,0,0,0.38)',
    borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  coverAvatarWrap: { position: 'absolute', bottom: -28, left: Spacing.lg },

  identitySection: { paddingHorizontal: Spacing.lg, paddingTop: 44, paddingBottom: Spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  bio: { marginTop: Spacing.xs, lineHeight: 23 },

  statsCardWrap: { paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { letterSpacing: -1 },
  statDivider: { width: 1, backgroundColor: Colors.borderSubtle, marginVertical: 4 },

  actionsRow: { flexDirection: 'row', paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm, gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44,
    backgroundColor: Colors.bgSurface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderDefault,
  },
  actionBtnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44,
    borderRadius: Radius.md, overflow: 'hidden',
    ...GlowShadow.amber,
  },

  bookingStatusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2,
  },
  bookingStatusDot: { width: 8, height: 8, borderRadius: 4 },

  gallerySection: { paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm },
  gallerySectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing['2xs'],
  },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GALLERY_GAP },
  galleryCell: {
    width: GALLERY_CELL, height: GALLERY_CELL,
    backgroundColor: Colors.bgSurface, overflow: 'hidden',
    borderRadius: Radius.sm,
  },
  galleryCellTall: { height: GALLERY_CELL * 1.65 },

  menuSection: { paddingHorizontal: Spacing.sm },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: Spacing['2xs'],
    gap: Spacing.sm,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: Colors.bgSurface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderDefault,
  },
  menuIconAccent: { backgroundColor: Colors.glassAmber, borderColor: Colors.borderGlow },
  menuBadge: {
    backgroundColor: Colors.error, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },

  artistCTACard: { padding: Spacing.md, overflow: 'hidden' },
  artistCTAIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.glassAmber, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderGlow, marginBottom: Spacing.xs,
  },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: Radius.lg,
    backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)',
  },
});
