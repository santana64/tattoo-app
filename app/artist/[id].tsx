import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ScrollView, StyleSheet, View, TouchableOpacity,
  Dimensions, Animated as RNAnimated,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn, FadeInDown, FadeInUp,
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TBadge } from '@/components/ui/TBadge';
import { TButton } from '@/components/ui/TButton';
import { TChip } from '@/components/ui/TChip';
import { TDivider } from '@/components/ui/TDivider';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { ARTISTS, POSTS } from '@/constants/mock-data';
import { Toast } from '@/components/ui/TToast';

const { width: SCREEN_W } = Dimensions.get('window');
const COVER_H = 320;
const GALLERY_CELL = (SCREEN_W - Spacing.lg * 2 - 4) / 3;

const STATUS_CONFIG = {
  open:   { label: 'Ouvert aux demandes', variant: 'success' as const, dot: '#34D399', canRequest: true },
  paused: { label: 'En pause',            variant: 'warning' as const, dot: '#FBBF24', canRequest: false },
  closed: { label: 'Fermé',               variant: 'error'   as const, dot: '#F87171', canRequest: false },
};

// ─── FAQ accordion item
function FaqItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [open, setOpen] = useState(false);
  const rotation = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  const toggle = () => {
    rotation.value = withSpring(open ? 0 : 1, { damping: 12 });
    setOpen(!open);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <TouchableOpacity onPress={toggle} activeOpacity={0.85} style={styles.faqItem}>
      <View style={styles.faqRow}>
        <TText variant="bodySmall" weight="semibold" style={{ flex: 1 }}>{question}</TText>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
        </Animated.View>
      </View>
      {open && (
        <Animated.View entering={FadeInDown.duration(200)}>
          <TText variant="bodySmall" color="secondary" style={styles.faqAnswer}>{answer}</TText>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

// ─── Gallery cell
function GalleryCell({ uri, onPress, index }: { uri: string; onPress: () => void; index: number }) {
  const isTall = index % 4 === 0;
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      entering={FadeIn.delay(index * 60).duration(400)}
      style={[styles.galleryCell, isTall && styles.galleryCellTall, scaleStyle]}
    >
      <TouchableOpacity
        onPress={() => {
          scale.value = withSpring(0.95, { damping: 10 }, () => { scale.value = withSpring(1); });
          onPress();
        }}
        activeOpacity={1}
        style={StyleSheet.absoluteFill}
      >
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" sharedTransitionTag={`gallery-${uri}`} />
        <LinearGradient colors={['transparent', 'rgba(5,5,8,0.3)']} style={StyleSheet.absoluteFill} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ArtistProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { savedArtistIds, toggleSaveArtist } = useAppStore();
  const { isAuthenticated } = useAuthStore();

  const artist = ARTISTS.find((a) => a.id === id) ?? ARTISTS[0];
  const artistPosts = POSTS.filter((p) => p.artistId === artist.id);
  const isSaved = savedArtistIds.has(artist.id);
  const booking = STATUS_CONFIG[artist.bookingStatus];

  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const saveScale = useSharedValue(1);
  const saveStyle = useAnimatedStyle(() => ({ transform: [{ scale: saveScale.value }] }));

  const scrollY = useRef(new RNAnimated.Value(0)).current;
  const coverParallax = scrollY.interpolate({ inputRange: [0, COVER_H], outputRange: [0, -COVER_H * 0.35], extrapolate: 'clamp' });
  const coverDim = scrollY.interpolate({ inputRange: [0, COVER_H * 0.5], outputRange: [0.5, 0.85], extrapolate: 'clamp' });
  const headerBg = scrollY.interpolate({ inputRange: [COVER_H * 0.4, COVER_H * 0.8], outputRange: ['rgba(5,5,8,0)', 'rgba(5,5,8,0.97)'], extrapolate: 'clamp' });
  const headerTitleOpacity = scrollY.interpolate({ inputRange: [COVER_H * 0.6, COVER_H * 0.9], outputRange: [0, 1], extrapolate: 'clamp' });

  const handleSave = useCallback(() => {
    saveScale.value = withSpring(1.4, { damping: 4 }, () => { saveScale.value = withSpring(1); });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleSaveArtist(artist.id);
  }, [artist.id]);

  const handleRequest = () => {
    if (!isAuthenticated) { router.push('/(auth)/sign-in'); return; }
    router.push({ pathname: '/request/new', params: { artistId: artist.id } });
  };

  return (
    <View style={styles.container}>
      {/* ─── Floating header (appears on scroll) ─── */}
      <RNAnimated.View style={[styles.floatingHeader, { paddingTop: insets.top, backgroundColor: headerBg }]}>
        <View style={styles.floatingHeaderInner}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <RNAnimated.View style={{ opacity: headerTitleOpacity, flex: 1, alignItems: 'center' }}>
            <TText variant="title2" weight="bold" numberOfLines={1}>{artist.blaze}</TText>
          </RNAnimated.View>
          <Animated.View style={saveStyle}>
            <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color={isSaved ? Colors.accentGlow : Colors.textPrimary}
              />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </RNAnimated.View>

      <RNAnimated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        onScroll={RNAnimated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        {/* ─── Cover with parallax ─── */}
        <View style={styles.coverWrap}>
          <RNAnimated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: coverParallax }] }]}>
            <Image
              source={{ uri: artist.coverUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              sharedTransitionTag={`artist-cover-${artist.id}`}
            />
          </RNAnimated.View>
          <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: coverDim }]} />
          <LinearGradient
            colors={['rgba(5,5,8,0.4)', 'transparent', 'rgba(5,5,8,0.95)']}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Buttons on cover (initial state, before header appears) */}
          <View style={[styles.coverButtons, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.glassBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Animated.View style={saveStyle}>
              <TouchableOpacity onPress={handleSave} style={styles.glassBtn}>
                <Ionicons
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={isSaved ? Colors.accentWarm : 'rgba(255,255,255,0.85)'}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Avatar pinned */}
          <View style={styles.avatarPinned}>
            <TAvatar
              uri={artist.avatarUrl}
              name={artist.blaze}
              size="2xl"
              isPremium={artist.tier === 'premium'}
            />
          </View>
        </View>

        {/* ─── Identity ─── */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.identity}>
          <View style={styles.nameRow}>
            <TText variant="title1" weight="bold" style={{ letterSpacing: -1 }}>{artist.blaze}</TText>
            {artist.isVerified && (
              <Ionicons name="checkmark-circle" size={20} color={Colors.info} style={{ marginLeft: 6 }} />
            )}
            {artist.tier === 'premium' && (
              <TBadge label="PREMIUM" variant="premium" style={{ marginLeft: 8 }} />
            )}
          </View>
          <TText variant="bodySmall" color="secondary" style={{ marginTop: 2 }}>{artist.city}</TText>
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, { borderColor: booking.dot + '30' }]}>
              <View style={[styles.statusDot, { backgroundColor: booking.dot }]} />
              <TText variant="micro" color="secondary" uppercase>{booking.label}</TText>
            </View>
            {artist.minBudget > 0 && (
              <TText variant="caption" style={{ color: Colors.accentWarm }}>
                À partir de {artist.minBudget}€
              </TText>
            )}
          </View>
        </Animated.View>

        {/* ─── Styles ─── */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stylesRow}>
            {artist.styles.map((s) => <TChip key={s} label={s} />)}
            {artist.specialties.map((s) => <TChip key={s} label={s} />)}
          </ScrollView>
        </Animated.View>

        <TDivider style={styles.divider} />

        {/* ─── Bio ─── */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.section}>
          <TText variant="body" color="secondary" style={styles.bio}>{artist.bio}</TText>
        </Animated.View>

        <TDivider style={styles.divider} />

        {/* ─── Gallery ─── */}
        <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <TText variant="label" color="tertiary" uppercase>Portfolio</TText>
            <TText variant="caption" color="tertiary">{artistPosts.length} œuvres</TText>
          </View>
          <View style={styles.gallery}>
            {artistPosts.map((post, i) => (
              <GalleryCell
                key={post.id}
                uri={post.mediaUrl}
                onPress={() => router.push(`/post/${post.id}`)}
                index={i}
              />
            ))}
          </View>
        </Animated.View>

        {/* ─── Rules ─── */}
        {artist.rules && (
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <TDivider style={styles.divider} />
            <View style={styles.section}>
              <TText variant="label" color="tertiary" uppercase style={{ marginBottom: Spacing['2xs'] }}>
                Règles de réservation
              </TText>
              <GlassCard variant="default" style={{ padding: Spacing.sm }}>
                <TText variant="bodySmall" color="secondary" style={{ lineHeight: 22 }}>{artist.rules}</TText>
              </GlassCard>
            </View>
          </Animated.View>
        )}

        {/* ─── Process ─── */}
        {artist.process && (
          <Animated.View entering={FadeInDown.delay(320).springify()}>
            <TDivider style={styles.divider} />
            <View style={styles.section}>
              <TText variant="label" color="tertiary" uppercase style={{ marginBottom: Spacing['2xs'] }}>
                Mon processus
              </TText>
              <GlassCard variant="default" style={{ padding: Spacing.sm }}>
                <TText variant="bodySmall" color="secondary" style={{ lineHeight: 22 }}>{artist.process}</TText>
              </GlassCard>
            </View>
          </Animated.View>
        )}

        {/* ─── Exclusions ─── */}
        {artist.exclusions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(340).springify()}>
            <TDivider style={styles.divider} />
            <View style={styles.section}>
              <TText variant="label" color="tertiary" uppercase style={{ marginBottom: Spacing['2xs'] }}>
                Je ne fais pas
              </TText>
              <View style={styles.exclusions}>
                {artist.exclusions.map((e) => (
                  <View key={e} style={styles.exclusionTag}>
                    <Ionicons name="close" size={11} color={Colors.error} />
                    <TText variant="caption" color="secondary" style={{ marginLeft: 4 }}>{e}</TText>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {/* ─── FAQ ─── */}
        {artist.faq.length > 0 && (
          <Animated.View entering={FadeInDown.delay(360).springify()}>
            <TDivider style={styles.divider} />
            <View style={styles.section}>
              <TText variant="label" color="tertiary" uppercase style={{ marginBottom: Spacing.xs }}>
                Questions fréquentes
              </TText>
              {artist.faq.map((item, i) => (
                <FaqItem key={i} index={i} question={item.question} answer={item.answer} />
              ))}
            </View>
          </Animated.View>
        )}
      </RNAnimated.ScrollView>

      {/* ─── Sticky CTA ─── */}
      <Animated.View
        entering={FadeInUp.delay(400).springify()}
        style={[styles.stickyBar, { paddingBottom: insets.bottom + 8 }]}
      >
        {booking.canRequest ? (
          <TButton
            title="Envoyer une demande →"
            variant="primary"
            onPress={handleRequest}
          />
        ) : (
          <View style={styles.closedBar}>
            <View style={{ flex: 1 }}>
              <TText variant="bodySmall" weight="semibold">
                {artist.bookingStatus === 'paused' ? 'Temporairement en pause' : 'Plus de demandes'}
              </TText>
              <TText variant="caption" color="tertiary">
                {artist.bookingStatus === 'paused'
                  ? 'Recheck prochainement'
                  : 'Ce tatoueur a fermé son carnet'}
              </TText>
            </View>
            <TButton
              title={notifyEnabled ? 'Notifié ✓' : 'Me notifier'}
              variant={notifyEnabled ? 'glow' : 'glass'}
              size="md"
              fullWidth={false}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setNotifyEnabled(prev => !prev);
                if (!notifyEnabled) {
                  Toast.success('Tu seras notifié quand cet artiste rouvre !');
                } else {
                  Toast.success('Notification désactivée.');
                }
              }}
            />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  // Floating header
  floatingHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
  },
  floatingHeaderInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing['2xs'], height: 56,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  // Cover
  coverWrap: { height: COVER_H, overflow: 'hidden', position: 'relative' },
  coverButtons: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
  },
  glassBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  avatarPinned: { position: 'absolute', bottom: -32, left: Spacing.lg },

  // Identity
  identity: { paddingHorizontal: Spacing.lg, paddingTop: 44, paddingBottom: Spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Spacing.xs },
  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)', gap: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },

  // Styles
  stylesRow: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, gap: 6 },

  // Sections
  divider: { marginHorizontal: Spacing.lg },
  section: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing['2xs'],
  },
  bio: { lineHeight: 26 },

  // Gallery
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  galleryCell: {
    width: GALLERY_CELL, height: GALLERY_CELL,
    overflow: 'hidden', borderRadius: Radius.xs,
    backgroundColor: Colors.bgSurface,
  },
  galleryCellTall: { height: GALLERY_CELL * 1.65 },

  // Exclusions
  exclusions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  exclusionTag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(248,113,113,0.08)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.15)',
  },

  // FAQ
  faqItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  faqAnswer: { marginTop: Spacing['2xs'], lineHeight: 20 },

  // Sticky CTA
  stickyBar: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    backgroundColor: 'rgba(5,5,8,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  closedBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
