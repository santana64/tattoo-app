import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuthStore } from '@/store/auth-store';

const CONSEQUENCES = [
  'Ton profil et toutes tes informations personnelles',
  'Tes posts, ta galerie et tout ton contenu',
  'Tes demandes, conversations et historique',
  'Tes données de paiement et préférences',
  'Ton accès Premium et tous les avantages associés',
];

export default function DeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuthStore();
  const [confirmation, setConfirmation] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmed = confirmation === 'SUPPRIMER';

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;
    setIsDeleting(true);
    try {
      await signOut();
      router.replace('/(auth)/welcome');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2" weight="semibold">Supprimer mon compte</TText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: Spacing.sm, paddingTop: Spacing.md }}
      >
        {/* ── Warning hero card ────────────────────────── */}
        <Animated.View entering={FadeIn.delay(60).duration(500)}>
          <GlassCard variant="default" style={styles.warningCard}>
            {/* Red icon circle */}
            <View style={styles.warningIconCircle}>
              <Ionicons name="warning" size={32} color={Colors.error} />
            </View>

            <TText
              variant="title2"
              weight="semibold"
              style={styles.warningTitle}
            >
              Cette action est irréversible
            </TText>

            <TText variant="bodySmall" style={styles.warningBody}>
              Ton compte sera{' '}
              <TText variant="bodySmall" weight="semibold" style={{ color: Colors.textPrimary }}>
                désactivé immédiatement
              </TText>
              . Tu disposes de{' '}
              <TText variant="bodySmall" weight="semibold" style={{ color: Colors.textPrimary }}>
                30 jours
              </TText>{' '}
              pour changer d'avis. Passé ce délai, toutes tes données seront définitivement et irrémédiablement supprimées.
            </TText>
          </GlassCard>
        </Animated.View>

        {/* ── Consequences list ─────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(140).springify()}>
          <TText variant="caption" weight="semibold" style={styles.sectionLabel}>
            CE QUI SERA SUPPRIMÉ
          </TText>
          <GlassCard variant="default" style={styles.card} padding={0}>
            {CONSEQUENCES.map((item, idx) => (
              <View
                key={item}
                style={[
                  styles.consequenceRow,
                  idx < CONSEQUENCES.length - 1 && styles.consequenceRowBorder,
                ]}
              >
                <View style={styles.xIconWrap}>
                  <Ionicons name="close" size={14} color={Colors.error} />
                </View>
                <TText variant="bodySmall" style={{ flex: 1, color: Colors.textSecondary }}>
                  {item}
                </TText>
              </View>
            ))}
          </GlassCard>
        </Animated.View>

        {/* ── Grace period note ─────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(220).springify()}>
          <GlassCard variant="default" style={styles.graceCard}>
            <View style={styles.graceRow}>
              <Ionicons name="time-outline" size={18} color={Colors.warning} style={{ flexShrink: 0 }} />
              <TText variant="bodySmall" style={styles.graceText}>
                Les rendez-vous confirmés dans l'agenda de tes clients restent visibles pendant 30 jours.
              </TText>
            </View>
          </GlassCard>
        </Animated.View>

        {/* ── Confirmation input ────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <TText variant="caption" weight="semibold" style={styles.sectionLabel}>
            CONFIRMATION
          </TText>
          <GlassCard variant="default" style={styles.card}>
            <TText variant="bodySmall" style={styles.confirmLabel}>
              Tape{' '}
              <TText variant="bodySmall" weight="bold" style={{ color: Colors.error }}>
                SUPPRIMER
              </TText>{' '}
              pour confirmer
            </TText>
            <TextInput
              style={[
                styles.confirmInput,
                isFocused && styles.confirmInputFocused,
                isConfirmed && styles.confirmInputValid,
              ]}
              value={confirmation}
              onChangeText={setConfirmation}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="SUPPRIMER"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              selectionColor={Colors.error}
            />
          </GlassCard>
        </Animated.View>

        {/* ── Delete CTA ───────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(380).springify()} style={{ marginTop: Spacing.xs }}>
          <TouchableOpacity
            activeOpacity={isConfirmed ? 0.8 : 1}
            onPress={handleDelete}
            disabled={!isConfirmed || isDeleting}
            style={[
              styles.deleteBtn,
              isConfirmed ? styles.deleteBtnEnabled : styles.deleteBtnDisabled,
            ]}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <TText
                variant="body"
                weight="semibold"
                style={{ color: isConfirmed ? '#fff' : Colors.textTertiary, letterSpacing: 0.3 }}
              >
                Supprimer mon compte
              </TText>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Cancel link */}
        <Animated.View entering={FadeInDown.delay(440).springify()}>
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelLink}>
            <TText variant="bodySmall" style={{ color: Colors.textSecondary }}>Annuler</TText>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  sectionLabel: {
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    marginLeft: 4,
    marginTop: Spacing.md,
  },
  card: {
    marginBottom: 0,
  },
  warningCard: {
    borderColor: 'rgba(239,68,68,0.20)',
    borderWidth: 1,
    backgroundColor: 'rgba(239,68,68,0.05)',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  warningIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1.5,
    borderColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningTitle: {
    color: Colors.error,
    textAlign: 'center',
  },
  warningBody: {
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  consequenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 13,
    gap: Spacing.xs,
  },
  consequenceRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  xIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  graceCard: {
    marginTop: Spacing.xs,
    borderColor: 'rgba(245,158,11,0.20)',
    backgroundColor: 'rgba(245,158,11,0.04)',
  },
  graceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  graceText: {
    flex: 1,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  confirmLabel: {
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    lineHeight: 22,
  },
  confirmInput: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 14,
    color: Colors.error,
    fontSize: 16,
    letterSpacing: 3,
    fontWeight: '600',
  },
  confirmInputFocused: {
    borderColor: 'rgba(239,68,68,0.40)',
  },
  confirmInputValid: {
    borderColor: Colors.error,
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  deleteBtn: {
    height: 54,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnEnabled: {
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  deleteBtnDisabled: {
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
});
