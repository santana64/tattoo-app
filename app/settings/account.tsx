import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TInput } from '@/components/ui/TInput';
import { TButton } from '@/components/ui/TButton';
import { TDivider } from '@/components/ui/TDivider';
import { useAuthStore } from '@/store/auth-store';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2">Mon compte</TText>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.form}>
        <TInput label="Nom affiché" value={displayName} onChangeText={setDisplayName} placeholder="Ton prénom ou pseudonyme" />
        <TInput label="Email de contact" value={email} onChangeText={setEmail} placeholder="ton@email.com" keyboardType="email-address" autoCapitalize="none" />
      </View>

      <TDivider style={styles.divider} />

      <View style={styles.section}>
        <TText variant="caption" color="secondary" style={styles.sectionTitle}>MÉTHODES DE CONNEXION</TText>
        <View style={styles.authMethod}>
          <Ionicons name="logo-apple" size={20} color={Colors.textSecondary} />
          <TText variant="bodySmall" style={{ flex: 1, marginLeft: Spacing.sm }}>Apple</TText>
          <TText variant="caption" color="success">Connecté</TText>
        </View>
        <View style={styles.authMethod}>
          <Ionicons name="logo-google" size={20} color={Colors.textTertiary} />
          <TText variant="bodySmall" color="secondary" style={{ flex: 1, marginLeft: Spacing.sm }}>Google</TText>
          <TouchableOpacity>
            <TText variant="caption" color="accent">Lier</TText>
          </TouchableOpacity>
        </View>
      </View>

      <TDivider style={styles.divider} />

      <View style={styles.section}>
        <TText variant="caption" color="secondary" style={styles.sectionTitle}>SESSIONS ACTIVES</TText>
        <View style={styles.sessionRow}>
          <Ionicons name="phone-portrait-outline" size={20} color={Colors.textSecondary} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <TText variant="bodySmall">iPhone 15 Pro · Paris</TText>
            <TText variant="caption" color="tertiary">Actif maintenant · Connexion actuelle</TText>
          </View>
        </View>
        <TouchableOpacity style={{ marginTop: Spacing['2xs'] }}>
          <TText variant="caption" color="error">Déconnecter toutes les autres sessions</TText>
        </TouchableOpacity>
      </View>

      <View style={styles.saveBtn}>
        <TButton
          title="Enregistrer"
          onPress={() => {
            updateProfile({ displayName, email });
            router.back();
          }}
        />
      </View>
    </ScrollView>
  );
}

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
  form: { padding: Spacing.sm },
  divider: { marginHorizontal: Spacing.sm },
  section: { padding: Spacing.sm },
  sectionTitle: { marginBottom: Spacing['2xs'] },
  authMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing['2xs'],
  },
  saveBtn: { padding: Spacing.sm, marginTop: Spacing.sm },
});
