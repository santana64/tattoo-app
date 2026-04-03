import React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TBadge } from '@/components/ui/TBadge';
import { TDivider } from '@/components/ui/TDivider';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuthStore } from '@/store/auth-store';
import { ARTISTS } from '@/constants/mock-data';

function SettingRow({ icon, label, subtitle, onPress, destructive, accent, rightElement }: {
  icon: string; label: string; subtitle?: string;
  onPress?: () => void; destructive?: boolean; accent?: boolean; rightElement?: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        style={styles.settingRow}
        onPress={() => {
          if (!onPress) return;
          scale.value = withSpring(0.97, { damping: 14 }, () => { scale.value = withSpring(1); });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        activeOpacity={1}
      >
        <View style={[
          styles.settingIcon,
          accent && styles.settingIconAccent,
          destructive && styles.settingIconDestructive,
        ]}>
          <Ionicons
            name={icon as any}
            size={18}
            color={destructive ? Colors.errorLight : accent ? Colors.accentWarm : Colors.textSecondary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TText variant="body" style={{
            color: destructive ? Colors.errorLight : accent ? Colors.accentWarm : Colors.textPrimary
          }}>{label}</TText>
          {subtitle && <TText variant="caption" color="tertiary" style={{ marginTop: 1 }}>{subtitle}</TText>}
        </View>
        {rightElement}
        {onPress && <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />}
      </TouchableOpacity>
    </Animated.View>
  );
}

function Section({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={styles.section}>
      <TText variant="label" color="tertiary" uppercase style={styles.sectionTitle}>{title}</TText>
      <View style={styles.sectionBody}>{children}</View>
    </Animated.View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const isArtist = user?.role === 'artist';
  const artist = isArtist ? ARTISTS[0] : null;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title1" weight="bold" style={{ letterSpacing: -0.5 }}>Paramètres</TText>
        <View style={{ width: 44 }} />
      </Animated.View>

      {/* Profile card */}
      <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.profileCardWrap}>
        <GlassCard variant="elevated" style={styles.profileCard}>
          <TAvatar uri={artist?.avatarUrl} name={user?.displayName} size="lg" isPremium={artist?.tier === 'premium'} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TText variant="title2" weight="bold" numberOfLines={1}>{user?.displayName ?? 'Utilisateur'}</TText>
              {artist?.tier === 'premium' && <TBadge label="PRO" variant="premium" />}
            </View>
            <TText variant="caption" color="tertiary" style={{ marginTop: 2 }}>{user?.email ?? '—'}</TText>
            {user?.city && <TText variant="caption" color="tertiary">📍 {user.city}</TText>}
          </View>
          <TouchableOpacity onPress={() => router.push('/settings/account')} style={styles.editBtn}>
            <Ionicons name="pencil" size={15} color={Colors.textSecondary} />
          </TouchableOpacity>
        </GlassCard>
      </Animated.View>

      {/* Premium upgrade banner */}
      {isArtist && artist?.tier !== 'premium' && (
        <Animated.View entering={FadeInDown.delay(130).springify()} style={styles.upgradeBanner}>
          <LinearGradient
            colors={['rgba(212,168,100,0.15)', 'rgba(212,168,100,0.04)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="star" size={18} color={Colors.accentGlow} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <TText variant="bodySmall" weight="semibold" style={{ color: Colors.accentWarm }}>Passe à INKR Premium</TText>
            <TText variant="caption" color="secondary">Analytics, profil mis en avant, posts illimités</TText>
          </View>
          <TouchableOpacity onPress={() => router.push('/settings/subscription')} style={styles.upgradeCTA}>
            <TText variant="caption" weight="bold" style={{ color: Colors.bgPrimary }}>Voir</TText>
          </TouchableOpacity>
        </Animated.View>
      )}

      <Section title="Compte" delay={160}>
        <SettingRow icon="person-outline" label="Informations personnelles" subtitle="Nom, email, ville" onPress={() => router.push('/settings/account')} />
        <TDivider />
        <SettingRow icon="notifications-outline" label="Notifications" subtitle="Push, email, sons" onPress={() => router.push('/settings/notifications')} />
        <TDivider />
        <SettingRow icon="shield-outline" label="Confidentialité" subtitle="Visibilité, données" onPress={() => router.push('/settings/privacy')} />
      </Section>

      {isArtist && (
        <Section title="Artiste" delay={220}>
          <SettingRow icon="card-outline" label="Abonnement" subtitle={artist?.tier === 'premium' ? 'Premium · actif' : 'Offre gratuite'} onPress={() => router.push('/settings/subscription')} accent />
          <TDivider />
          <SettingRow icon="color-palette-outline" label="Personnalisation" subtitle="Thème, couleurs profil" onPress={() => router.push('/customization')} />
          <TDivider />
          <SettingRow icon="analytics-outline" label="Analytics" subtitle="Performance & stats" onPress={() => router.push('/analytics')} />
        </Section>
      )}

      <Section title="Support" delay={280}>
        <SettingRow icon="help-circle-outline" label="Aide et support" onPress={() => router.push('/settings/support')} />
        <TDivider />
        <SettingRow icon="star-outline" label="Évaluer INKR" subtitle="App Store / Google Play" onPress={() => {}} accent />
        <TDivider />
        <SettingRow icon="document-text-outline" label="CGU & Confidentialité" onPress={() => {}} />
      </Section>

      <Section title="Zone danger" delay={340}>
        <SettingRow
          icon="log-out-outline"
          label="Déconnexion"
          destructive
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            logout();
          }}
        />
        <TDivider />
        <SettingRow
          icon="trash-outline"
          label="Supprimer mon compte"
          destructive
          onPress={() => router.push('/settings/delete-account')}
        />
      </Section>

      <Animated.View entering={FadeIn.delay(500)} style={styles.version}>
        <TText variant="caption" color="tertiary">INKR v3.0.0 · Build 2026.04</TText>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xs'], paddingBottom: Spacing.sm,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  profileCardWrap: { paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm },
  profileCard: { flexDirection: 'row', alignItems: 'center' },
  editBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.bgSubtle, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderDefault,
  },
  upgradeBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.sm, marginBottom: Spacing.sm,
    padding: Spacing.sm, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.borderGlow,
  },
  upgradeCTA: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.accentWarm, borderRadius: Radius.full,
  },
  section: { paddingHorizontal: Spacing.sm, marginBottom: Spacing.md },
  sectionTitle: { letterSpacing: 2, marginBottom: Spacing['2xs'], paddingHorizontal: Spacing['2xs'] },
  sectionBody: {
    backgroundColor: Colors.bgCard ?? Colors.bgElevated,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.borderSubtle, overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: Spacing.sm, gap: Spacing.sm,
  },
  settingIcon: {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: Colors.bgSurface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderDefault,
  },
  settingIconAccent: { backgroundColor: Colors.glassAmber, borderColor: Colors.borderGlow },
  settingIconDestructive: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.20)' },
  version: { alignItems: 'center', paddingVertical: Spacing.xl },
});
