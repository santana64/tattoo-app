import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { THeader } from '@/components/ui/THeader';
import { BottomSheet } from '@/components/motion';
import { Masthead } from '@/components/v5';
import { SETTINGS_PANE, SettingsNotice, SettingsSection } from '@/components/v5/SettingsParts';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useAuthStore } from '@/store/auth-store';

const CONFIRM_WORD = 'SUPPRIMER';

const CONSEQUENCES = [
  'Votre profil et vos informations personnelles',
  'Vos publications, votre galerie et tout votre contenu',
  'Vos demandes, conversations et historique',
  'Vos rendez-vous, passés et à venir',
  'Votre abonnement Premium, résilié immédiatement',
];

export default function DeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isWide, gutter } = useContentDimensions();
  const { deleteAccount } = useAuthStore();
  const [confirmation, setConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isConfirmed = confirmation === CONFIRM_WORD;

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const { error } = await deleteAccount();
      if (error) {
        setDeleteError(error);
        return;
      }
      router.replace('/(auth)/welcome');
    } catch {
      setDeleteError('La suppression a échoué. Votre compte est intact : vérifiez votre connexion puis réessayez.');
    } finally {
      setIsDeleting(false);
    }
  };

  const openConfirmation = () => {
    if (!isConfirmed) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDeleteError(null);
    setSheetOpen(true);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <THeader title="Supprimer le compte" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingBottom: insets.bottom + Spacing['3xl'] }]}
      >
        {/* Statement: no vermilion flourish on an irreversible action */}
        <Masthead
          kicker="Paramètres / Suppression"
          title="Supprimer votre compte."
          description="Votre compte et vos données seront supprimés immédiatement et définitivement. Cette action est irréversible."
        />

        <View style={styles.pane}>
          {/* Consequences */}
          <SettingsSection number="01" title="Ce qui sera supprimé" style={styles.firstSection}>
            {CONSEQUENCES.map((item) => (
              <View key={item} style={styles.listRow}>
                <Ionicons name="close" size={16} color={Colors.error} style={styles.listIcon} />
                <TText variant="bodySmall" style={styles.listText}>{item}</TText>
              </View>
            ))}
          </SettingsSection>

          <SettingsNotice label="À savoir" style={styles.note}>
            Vos demandes et rendez-vous disparaissent aussi chez les personnes concernées. Prévenez-les avant de supprimer votre compte.
          </SettingsNotice>

          {/* Typed confirmation */}
          <SettingsSection number="02" title="Confirmation">
            <View style={styles.confirm}>
              <TInput
                label={`Saisissez ${CONFIRM_WORD} pour confirmer`}
                value={confirmation}
                onChangeText={setConfirmation}
                placeholder={CONFIRM_WORD}
                autoCapitalize="characters"
                autoCorrect={false}
                selectionColor={Colors.error}
                error={confirmation.length >= CONFIRM_WORD.length && !isConfirmed ? `Saisissez exactement ${CONFIRM_WORD}.` : undefined}
                helper={isConfirmed ? 'Confirmation saisie.' : undefined}
              />
            </View>
          </SettingsSection>

          <View style={[styles.actions, isWide && styles.actionsWide]}>
            <TButton
              title="Supprimer mon compte"
              variant="destructive"
              onPress={openConfirmation}
              disabled={!isConfirmed || isDeleting}
              loading={isDeleting}
              fullWidth={!isWide}
            />
            <TButton title="Annuler" variant="ghost" fullWidth={!isWide} onPress={() => router.back()} />
          </View>
        </View>
      </ScrollView>

      {/* Last step: a deliberate second gesture before an irreversible action */}
      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} accessibilityLabel="Confirmer la suppression du compte">
        <TText variant="displayS">Dernière confirmation</TText>
        <TText variant="bodySmall" color="secondary" style={styles.sheetBody}>
          Votre compte et toutes vos données vont être supprimés maintenant. Cette action ne peut pas être annulée.
        </TText>
        {deleteError ? (
          <TText variant="bodySmall" color="error" style={styles.sheetError} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            {deleteError}
          </TText>
        ) : null}
        <View style={styles.sheetActions}>
          <TButton
            title="Supprimer définitivement"
            variant="destructive"
            loading={isDeleting}
            disabled={isDeleting}
            onPress={() => { void handleDelete(); }}
          />
          <TButton title="Garder mon compte" variant="secondary" onPress={() => setSheetOpen(false)} />
        </View>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  content: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },
  pane: { width: '100%', maxWidth: SETTINGS_PANE },
  firstSection: { marginTop: 0 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  listIcon: { width: 18 },
  listText: { flex: 1 },
  note: { marginTop: Spacing.lg },
  confirm: { paddingTop: Spacing.md },
  actions: { gap: 10, marginTop: Spacing.xs },
  actionsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  sheetBody: { marginTop: Spacing['2xs'], marginBottom: Spacing.lg },
  sheetError: { marginTop: -Spacing.sm, marginBottom: Spacing.md },
  sheetActions: { gap: 10, marginTop: Spacing.xs },
});
