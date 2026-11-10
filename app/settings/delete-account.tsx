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
import { TDivider } from '@/components/ui/TDivider';
import { THeader } from '@/components/ui/THeader';
import { BottomSheet } from '@/components/motion';
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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
      >
        {/* Statement */}
        <View style={styles.hero}>
          <View style={styles.iconRing}>
            <Ionicons name="alert-outline" size={22} color={Colors.error} />
          </View>
          <TText variant="displayM" accessibilityRole="header">
            Supprimer <TText variant="displayM" italic style={{ color: Colors.errorLight }}>votre compte</TText>
          </TText>
          <TText variant="body" color="secondary" style={styles.lead}>
            Votre compte et vos données seront supprimés immédiatement et définitivement. Cette action est irréversible.
          </TText>
        </View>

        {/* Consequences */}
        <TText variant="label" color="tertiary" uppercase style={styles.sectionLabel}>Ce qui sera supprimé</TText>
        <View style={styles.list}>
          {CONSEQUENCES.map((item, idx) => (
            <React.Fragment key={item}>
              {idx > 0 && <TDivider inset={30} />}
              <View style={styles.listRow}>
                <Ionicons name="close" size={16} color={Colors.error} style={{ width: 18 }} />
                <TText variant="bodySmall" color="secondary" style={{ flex: 1 }}>{item}</TText>
              </View>
            </React.Fragment>
          ))}
        </View>

        <View style={styles.note}>
          <Ionicons name="time-outline" size={16} color={Colors.warning} />
          <TText variant="caption" color="secondary" style={{ flex: 1 }}>
            Vos demandes et rendez-vous disparaissent aussi chez les personnes concernées. Prévenez-les avant de supprimer votre compte.
          </TText>
        </View>

        {/* Typed confirmation */}
        <TText variant="label" color="tertiary" uppercase style={styles.sectionLabel}>Confirmation</TText>
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

        <View style={styles.actions}>
          <TButton
            title="Supprimer mon compte"
            variant="destructive"
            onPress={openConfirmation}
            disabled={!isConfirmed || isDeleting}
            loading={isDeleting}
            icon={<Ionicons name="trash-outline" size={17} color={Colors.errorLight} />}
          />
          <TButton title="Annuler" variant="ghost" onPress={() => router.back()} />
        </View>
      </ScrollView>

      {/* Last step: a deliberate second gesture before an irreversible action */}
      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} accessibilityLabel="Confirmer la suppression du compte">
        <TText variant="displayS">Dernière confirmation</TText>
        <TText variant="bodySmall" color="secondary" style={styles.sheetBody}>
          Votre compte et toutes vos données vont être supprimés maintenant. Cette action ne peut pas être annulée.
        </TText>
        {deleteError ? (
          <TText variant="bodySmall" style={styles.sheetError} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            {deleteError}
          </TText>
        ) : null}
        <View style={styles.actions}>
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
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: {
    width: '100%', maxWidth: Layout.maxReading + Layout.gutter * 2, alignSelf: 'center',
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.xl,
  },
  hero: { marginBottom: Spacing.xl },
  iconRing: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217,105,95,0.45)',
    backgroundColor: 'rgba(217,105,95,0.08)',
    marginBottom: Spacing.md,
  },
  lead: { marginTop: Spacing.xs },
  sectionLabel: { marginBottom: Spacing['2xs'], marginTop: Spacing.lg },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: Spacing.md },
  actions: { gap: 10, marginTop: Spacing.xs },
  sheetBody: { marginTop: Spacing['2xs'], marginBottom: Spacing.lg },
  sheetError: { color: Colors.errorLight, marginTop: -Spacing.sm, marginBottom: Spacing.md },
});
