import React from 'react';
import { ScrollView, StyleSheet, View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TBadge } from '@/components/ui/TBadge';
import { TButton } from '@/components/ui/TButton';
import { TDivider } from '@/components/ui/TDivider';
import { THeader } from '@/components/ui/THeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { Toast } from '@/components/ui/TToast';
import { PressableScale } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';

const ICON_COL = 34;
const APP_VERSION = Constants.expoConfig?.version;

function SettingRow({ icon, label, subtitle, detail, accent, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; subtitle?: string; detail?: string;
  accent?: boolean; onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      pressedScale={0.985}
      accessibilityRole="button"
      accessibilityLabel={[label, subtitle, detail].filter(Boolean).join(', ')}
      style={styles.row}
    >
      <Ionicons name={icon} size={19} color={accent ? Colors.accentWarm : Colors.textSecondary} style={styles.rowIcon} />
      <View style={styles.rowText}>
        <TText variant="body" weight="medium" numberOfLines={1}>{label}</TText>
        {!!subtitle && <TText variant="caption" color="tertiary" numberOfLines={1}>{subtitle}</TText>}
      </View>
      {!!detail && <TText variant="bodySmall" color={accent ? 'accentWarm' : 'tertiary'}>{detail}</TText>}
      <Ionicons name="chevron-forward" size={15} color={Colors.textTertiary} />
    </PressableScale>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const items = React.Children.toArray(children);
  return (
    <View style={styles.section}>
      <TText variant="label" color="tertiary" uppercase style={styles.sectionTitle}>{title}</TText>
      <View style={styles.sectionBody}>
        {items.map((child, i) => (
          <React.Fragment key={i}>
            {i > 0 && <TDivider inset={ICON_COL} />}
            {child}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const isArtist = user?.role === 'artist';
  const isPremium = isArtist && user?.artistTier === 'premium';
  const name = (isArtist ? user?.artistBlaze : undefined) ?? user?.displayName ?? 'Votre compte';

  const handleSignOut = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    signOut().catch(() => Toast.error('Déconnexion impossible. Réessayez.'));
  };

  return (
    <View style={styles.container}>
      <THeader title="Paramètres" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity */}
        <View style={styles.identity}>
          <TAvatar uri={user?.avatarUrl} name={name} size="xl" isPremium={isPremium} showBadge />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.nameRow}>
              <TText variant="displayS" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</TText>
              {isPremium && <TBadge label="Premium" variant="premium" />}
            </View>
            <TText variant="bodySmall" color="tertiary" numberOfLines={1}>
              {[user?.email, user?.city].filter(Boolean).join(' · ') || '—'}
            </TText>
          </View>
        </View>

        {/* Premium upsell — artists on the free plan only */}
        {isArtist && !isPremium && (
          <View>
            <GlassCard variant="premium" radius={14} style={styles.upsell}>
              <TText variant="label" color="accentWarm" uppercase>INKR Premium</TText>
              <TText variant="title2" serif style={styles.upsellTitle}>
                Un profil <TText variant="title2" serif italic color="accentGlow" style={styles.upsellTitle}>mis en avant</TText>
              </TText>
              <TText variant="bodySmall" color="secondary" style={{ marginBottom: Spacing.md }}>
                Statistiques détaillées, publications illimitées et personnalisation du profil.
              </TText>
              <TButton
                title="Découvrir Premium"
                variant="glow"
                size="sm"
                fullWidth={false}
                onPress={() => router.push('/settings/subscription')}
              />
            </GlassCard>
          </View>
        )}

        <Section title="Compte">
          <SettingRow icon="person-outline" label="Informations personnelles" subtitle="Nom, e-mail, ville" onPress={() => router.push('/settings/account')} />
          <SettingRow icon="notifications-outline" label="Notifications" subtitle="Push et e-mails" onPress={() => router.push('/settings/notifications')} />
          <SettingRow icon="shield-outline" label="Confidentialité" subtitle="Visibilité et données" onPress={() => router.push('/settings/privacy')} />
        </Section>

        {isArtist && (
          <Section title="Espace artiste">
            <SettingRow
              icon="card-outline"
              label="Abonnement"
              detail={isPremium ? 'Premium' : 'Gratuit'}
              accent={!isPremium}
              onPress={() => router.push('/settings/subscription')}
            />
            <SettingRow icon="color-palette-outline" label="Personnalisation" subtitle="Sections et informations du profil" onPress={() => router.push('/customization')} />
            <SettingRow icon="analytics-outline" label="Statistiques" subtitle="Vues, demandes, acceptation" onPress={() => router.push('/analytics')} />
          </Section>
        )}

        <Section title="Assistance">
          <SettingRow icon="help-circle-outline" label="Aide et support" onPress={() => router.push('/settings/support')} />
          <SettingRow icon="document-text-outline" label="Conditions d’utilisation" onPress={() => router.push('/legal/terms')} />
          <SettingRow icon="lock-closed-outline" label="Politique de confidentialité" onPress={() => router.push('/legal/privacy-policy')} />
        </Section>

        {/* Session and destructive actions, kept apart from everyday settings */}
        <View style={styles.dangerZone}>
          <TButton
            title="Se déconnecter"
            variant="secondary"
            size="md"
            onPress={handleSignOut}
            icon={<Ionicons name="log-out-outline" size={17} color={Colors.textPrimary} />}
          />
          <TButton
            title="Supprimer mon compte"
            variant="destructive"
            size="md"
            onPress={() => router.push('/settings/delete-account')}
            icon={<Ionicons name="trash-outline" size={17} color={Colors.errorLight} />}
          />
        </View>

        {!!APP_VERSION && (
          <TText variant="caption" color="tertiary" tabular style={styles.version}>INKR {APP_VERSION}</TText>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: {
    width: '100%', maxWidth: Layout.maxReading + Layout.gutter * 2, alignSelf: 'center',
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.lg,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },

  upsell: { marginBottom: Spacing.sm },
  upsellTitle: { fontSize: 24, lineHeight: 28 },

  section: { marginTop: Spacing.xl },
  sectionTitle: { marginBottom: Spacing['2xs'] },
  sectionBody: {
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 56, paddingVertical: 10,
  },
  rowIcon: { width: ICON_COL - 12 },
  rowText: { flex: 1, minWidth: 0, gap: 1 },

  dangerZone: {
    marginTop: Spacing['2xl'], paddingTop: Spacing.lg, gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  version: { textAlign: 'center', marginTop: Spacing.xl },
});
