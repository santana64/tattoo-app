import React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TDivider } from '@/components/ui/TDivider';
import { TBadge } from '@/components/ui/TBadge';
import { useAuthStore } from '@/store/auth-store';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuthStore();
  const isArtist = user?.role === 'artist';

  const handleSignOut = () => {
    signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2">Paramètres</TText>
        <View style={{ width: 44 }} />
      </View>

      {/* User info */}
      <View style={styles.userSection}>
        <TAvatar name={user?.displayName} size="xl" />
        <View style={styles.userInfo}>
          <TText variant="title2" weight="semibold">{user?.displayName ?? 'Utilisateur'}</TText>
          <TText variant="caption" color="secondary">{user?.email}</TText>
          {isArtist && user?.artistTier && (
            <TBadge
              label={user.artistTier === 'premium' ? 'Premium' : 'Normal'}
              variant={user.artistTier === 'premium' ? 'premium' : 'default'}
              style={{ marginTop: 4 }}
            />
          )}
        </View>
        <TouchableOpacity onPress={() => router.push('/settings/account')} style={styles.editBtn}>
          <TText variant="caption" color="accent">Modifier</TText>
        </TouchableOpacity>
      </View>

      <TDivider style={styles.divider} />

      {/* Compte */}
      <SettingsSection title="COMPTE">
        <SettingsItem icon="person-outline" label="Mon compte" onPress={() => router.push('/settings/account')} />
        <SettingsItem icon="notifications-outline" label="Notifications" onPress={() => router.push('/settings/notifications')} />
        <SettingsItem icon="lock-closed-outline" label="Confidentialité" onPress={() => router.push('/settings/privacy')} />
      </SettingsSection>

      {isArtist && (
        <>
          <TDivider style={styles.divider} />
          <SettingsSection title="ABONNEMENT">
            <SettingsItem
              icon="card-outline"
              label="Mon abonnement"
              onPress={() => router.push('/settings/subscription')}
              badge={user?.artistTier === 'premium' ? 'Premium' : 'Normal'}
              badgeVariant={user?.artistTier === 'premium' ? 'premium' : 'default'}
            />
          </SettingsSection>
        </>
      )}

      <TDivider style={styles.divider} />

      <SettingsSection title="AIDE ET LÉGAL">
        <SettingsItem icon="help-circle-outline" label="Centre d'aide" onPress={() => router.push('/settings/support')} />
        <SettingsItem icon="document-text-outline" label="Conditions générales" onPress={() => {}} />
        <SettingsItem icon="shield-outline" label="Politique de confidentialité" onPress={() => {}} />
        <SettingsItem icon="flag-outline" label="Politique de contenu" onPress={() => {}} />
      </SettingsSection>

      <TDivider style={styles.divider} />

      <SettingsSection title="DONNÉES">
        <SettingsItem icon="download-outline" label="Exporter mes données" onPress={() => {}} />
        <SettingsItem icon="pause-circle-outline" label="Désactiver mon compte" onPress={() => {}} />
      </SettingsSection>

      <TDivider style={styles.divider} />

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <TText variant="body" color="error">Se déconnecter</TText>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => router.push('/settings/delete-account')}
      >
        <TText variant="caption" color="tertiary">Supprimer mon compte</TText>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.section}>
      <TText variant="label" color="tertiary" style={sectionStyles.sectionTitle}>
        {title}
      </TText>
      {children}
    </View>
  );
}

function SettingsItem({
  icon,
  label,
  onPress,
  badge,
  badgeVariant,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  badge?: string;
  badgeVariant?: any;
}) {
  return (
    <TouchableOpacity style={sectionStyles.item} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={icon as any} size={20} color={Colors.textSecondary} style={sectionStyles.icon} />
      <TText variant="body" style={{ flex: 1 }}>{label}</TText>
      {badge && <TBadge label={badge} variant={badgeVariant} style={{ marginRight: 8 }} />}
      <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

const sectionStyles = StyleSheet.create({
  section: { paddingHorizontal: Spacing.sm, paddingTop: Spacing['2xs'] },
  sectionTitle: { marginBottom: Spacing['3xs'], paddingHorizontal: Spacing['2xs'] },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  icon: { marginRight: Spacing.sm },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  userInfo: { flex: 1 },
  editBtn: { padding: 8 },
  divider: { marginHorizontal: Spacing.sm },
  signOutBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  deleteBtn: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    alignItems: 'flex-start',
  },
});
