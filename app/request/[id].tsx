import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TBadge } from '@/components/ui/TBadge';
import { TButton } from '@/components/ui/TButton';
import { TDivider } from '@/components/ui/TDivider';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { REQUESTS, PROJECT_TYPE_LABELS, SIZE_LABELS, STATUS_LABELS, DECLINE_REASONS } from '@/constants/mock-data';

const STATUS_VARIANT: Record<string, any> = {
  submitted: 'accent',
  accepted: 'success',
  declined: 'error',
  clarification_needed: 'warning',
  archived: 'default',
  completed: 'info',
};

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { updateRequestStatus } = useAppStore();
  const isArtist = user?.role === 'artist';

  const request = useAppStore((s) => s.requests.find((r) => r.id === id)) ?? REQUESTS[0];
  const [showDeclineOptions, setShowDeclineOptions] = useState(false);

  const DECLINE_OPTIONS = [
    { key: 'style_mismatch', label: 'Hors style' },
    { key: 'budget_mismatch', label: 'Hors budget' },
    { key: 'fully_booked', label: 'Planning complet' },
    { key: 'too_vague', label: 'Description trop vague' },
    { key: 'not_feasible', label: 'Non réalisable' },
    { key: 'other', label: 'Autre' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2">Demande</TText>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        {/* Client */}
        <View style={styles.clientSection}>
          <TAvatar uri={request.clientAvatar} name={request.clientName} size="xl" />
          <View style={styles.clientInfo}>
            <TText variant="title2" weight="semibold">{request.clientName}</TText>
            <TText variant="caption" color="secondary">
              {new Date(request.submittedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </TText>
          </View>
          <TBadge
            label={STATUS_LABELS[request.status]}
            variant={STATUS_VARIANT[request.status]}
            dot={request.status === 'submitted'}
          />
        </View>

        <TDivider />

        {/* Details */}
        <View style={styles.detailsSection}>
          <DetailRow label="Type" value={PROJECT_TYPE_LABELS[request.projectType]} />
          <DetailRow label="Zone" value={request.bodyZone} />
          <DetailRow label="Taille" value={SIZE_LABELS[request.sizeCategory]} />
          <DetailRow
            label="Budget"
            value={
              request.budgetMin && request.budgetMax
                ? `${request.budgetMin}–${request.budgetMax}€`
                : 'Non renseigné'
            }
          />
          <DetailRow label="Style" value={request.stylePreference || 'Non renseigné'} />
          <DetailRow
            label="Couleur"
            value={{ black_grey: 'Noir & gris', color: 'Couleur', artist_choice: 'Au choix' }[request.colorPreference] ?? ''}
          />
          <DetailRow
            label="Flexibilité"
            value={{ precise: 'Projet précis', open: 'Ouvert aux suggestions', full_trust: 'Confiance totale' }[request.flexibilityLevel] ?? ''}
          />
          <DetailRow label="1er tatouage" value={request.isFirstTattoo ? 'Oui' : 'Non'} />
        </View>

        <TDivider />

        {/* Description */}
        <View style={styles.descSection}>
          <TText variant="caption" color="secondary" style={styles.descLabel}>DESCRIPTION</TText>
          <TText variant="body" color="secondary" style={styles.descText}>
            {request.description}
          </TText>
        </View>

        {/* References */}
        {request.references.length > 0 && (
          <>
            <TDivider />
            <View style={styles.refsSection}>
              <TText variant="caption" color="secondary" style={styles.descLabel}>RÉFÉRENCES</TText>
              <View style={styles.refsGrid}>
                {request.references.map((ref, i) => (
                  <Image
                    key={i}
                    source={{ uri: ref }}
                    style={styles.refImage}
                    contentFit="cover"
                  />
                ))}
              </View>
            </View>
          </>
        )}

        {/* Decline reason if declined */}
        {request.status === 'declined' && request.declineReason && (
          <>
            <TDivider />
            <View style={styles.descSection}>
              <TText variant="caption" color="error" style={styles.descLabel}>MOTIF DE REFUS</TText>
              <TText variant="body" color="secondary">
                {DECLINE_REASONS[request.declineReason]}
              </TText>
            </View>
          </>
        )}

        {/* Decline options */}
        {showDeclineOptions && (
          <View style={styles.declineOptions}>
            <TText variant="bodySmall" weight="semibold" style={{ marginBottom: Spacing['2xs'] }}>
              Motif du refus
            </TText>
            {DECLINE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={styles.declineOpt}
                onPress={() => {
                  updateRequestStatus(request.id, 'declined');
                  setShowDeclineOptions(false);
                  router.back();
                }}
              >
                <TText variant="bodySmall" color="secondary">{opt.label}</TText>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowDeclineOptions(false)} style={{ marginTop: Spacing['2xs'] }}>
              <TText variant="bodySmall" color="tertiary" style={{ textAlign: 'center' }}>Annuler</TText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Artist actions */}
      {isArtist && request.status === 'submitted' && !showDeclineOptions && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + 8 }]}>
          <TButton
            title="Accepter"
            onPress={() => {
              updateRequestStatus(request.id, 'accepted');
              router.push(`/conversation/${request.id}`);
            }}
            style={{ flex: 2 }}
          />
          <TButton
            title="Refuser"
            variant="secondary"
            onPress={() => setShowDeclineOptions(true)}
            style={{ flex: 1 }}
          />
          <TButton
            title="Précision"
            variant="ghost"
            onPress={() => {
              updateRequestStatus(request.id, 'clarification_needed');
              router.push(`/conversation/${request.id}`);
            }}
            style={{ flex: 1 }}
          />
        </View>
      )}

      {(request.status === 'accepted' || request.status === 'clarification_needed') && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + 8 }]}>
          <TButton
            title="Ouvrir la conversation"
            onPress={() => router.push(`/conversation/${request.id}`)}
          />
        </View>
      )}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <TText variant="caption" color="tertiary" style={detailStyles.label}>{label}</TText>
      <TText variant="bodySmall" style={{ flex: 2 }}>{value}</TText>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  label: { flex: 1 },
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
  clientSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  clientInfo: { flex: 1 },
  detailsSection: { padding: Spacing.sm },
  descSection: { padding: Spacing.sm },
  descLabel: { marginBottom: Spacing['3xs'], letterSpacing: 0.3 },
  descText: { lineHeight: 24 },
  refsSection: { padding: Spacing.sm },
  refsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  refImage: { width: 100, height: 100, borderRadius: Radius.sm, backgroundColor: Colors.bgSurface },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing['2xs'],
    gap: 8,
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  declineOptions: {
    margin: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  declineOpt: {
    paddingVertical: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
});
