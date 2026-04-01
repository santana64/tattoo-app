import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { useAuthStore } from '@/store/auth-store';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuthStore();
  const [confirmation, setConfirmation] = useState('');
  const isConfirmed = confirmation === 'SUPPRIMER';

  const handleDelete = () => {
    if (!isConfirmed) return;
    signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2">Supprimer mon compte</TText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={32} color={Colors.error} style={{ marginBottom: Spacing.sm }} />
          <TText variant="title2" weight="semibold" style={{ marginBottom: Spacing['2xs'] }}>
            Tu es sur le point de supprimer ton compte.
          </TText>
          <TText variant="body" color="secondary" style={{ lineHeight: 24 }}>
            Cette action est irréversible après 30 jours.
          </TText>
        </View>

        <View style={styles.section}>
          <TText variant="bodySmall" weight="semibold" style={{ marginBottom: Spacing['2xs'] }}>
            Ce qui sera supprimé
          </TText>
          {[
            'Ton profil et toutes tes informations',
            'Tes posts et ta galerie',
            'Tes demandes et conversations',
            'Tes données personnelles',
          ].map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Ionicons name="close-circle" size={16} color={Colors.error} />
              <TText variant="bodySmall" color="secondary" style={{ marginLeft: 8 }}>{item}</TText>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <TText variant="bodySmall" weight="semibold" style={{ marginBottom: Spacing['2xs'] }}>
            Ce qui reste (30 jours)
          </TText>
          {[
            'Les rendez-vous confirmés dans l\'agenda de tes clients',
          ].map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.warning} />
              <TText variant="bodySmall" color="secondary" style={{ marginLeft: 8 }}>{item}</TText>
            </View>
          ))}
        </View>

        <View style={styles.graceNote}>
          <TText variant="bodySmall" color="secondary" style={{ lineHeight: 22 }}>
            Ton compte sera <TText variant="bodySmall" weight="semibold">désactivé immédiatement</TText>. Tu as{' '}
            <TText variant="bodySmall" weight="semibold">30 jours</TText> pour changer d'avis. Passé ce délai, tout sera définitivement supprimé.
          </TText>
        </View>

        <View style={styles.confirmSection}>
          <TText variant="bodySmall" weight="semibold" style={{ marginBottom: Spacing['2xs'] }}>
            Pour confirmer, tape <TText variant="bodySmall" weight="bold" color="error">SUPPRIMER</TText>
          </TText>
          <TextInput
            style={[styles.confirmInput, isConfirmed && styles.confirmInputValid]}
            value={confirmation}
            onChangeText={setConfirmation}
            placeholder="SUPPRIMER"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        <TButton
          title="Supprimer mon compte"
          variant="destructive"
          onPress={handleDelete}
          disabled={!isConfirmed}
          style={{ marginHorizontal: Spacing.sm }}
        />

        <TouchableOpacity onPress={() => router.back()} style={styles.cancelLink}>
          <TText variant="bodySmall" color="accent">Annuler</TText>
        </TouchableOpacity>
      </ScrollView>
    </View>
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
  scroll: { flex: 1 },
  warningBox: {
    margin: Spacing.sm,
    padding: Spacing.lg,
    backgroundColor: 'rgba(248,113,113,0.06)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.2)',
    alignItems: 'center',
  },
  section: {
    padding: Spacing.sm,
    gap: Spacing['3xs'],
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 3,
  },
  graceNote: {
    margin: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  confirmSection: { padding: Spacing.sm, marginBottom: Spacing.sm },
  confirmInput: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    padding: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: 16,
    letterSpacing: 2,
  },
  confirmInputValid: {
    borderColor: Colors.error,
  },
  cancelLink: { alignItems: 'center', paddingVertical: Spacing.md },
});
