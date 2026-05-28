import React, { useState, useCallback } from 'react';
import {
  ScrollView, StyleSheet, View, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TBadge } from '@/components/ui/TBadge';
import { TButton } from '@/components/ui/TButton';
import { TDivider } from '@/components/ui/TDivider';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import {
  REQUESTS, PROJECT_TYPE_LABELS, SIZE_LABELS, STATUS_LABELS,
  DECLINE_REASONS,
} from '@/constants/mock-data';

const STATUS_CONFIG = {
  submitted:            { dot: '#60A5FA', variant: 'accent'   as const },
  accepted:             { dot: '#34D399', variant: 'success'  as const },
  declined:             { dot: '#F87171', variant: 'error'    as const },
  clarification_needed: { dot: '#FBBF24', variant: 'warning'  as const },
  completed:            { dot: '#818CF8', variant: 'info'     as const },
  archived:             { dot: Colors.textTertiary, variant: 'default' as const },
};

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={15} color={Colors.textTertiary} style={{ width: 20 }} />
      <TText variant="caption" color="tertiary" style={{ width: 100 }}>{label}</TText>
      <TText variant="bodySmall" style={{ flex: 1 }}>{value}</TText>
    </View>
  );
}

function ActionBtn({ label, icon, onPress, variant = 'default', loading = false }: {
  label: string; icon: string; onPress: () => void;
  variant?: 'default' | 'success' | 'error' | 'warning'; loading?: boolean;
}) {
  const scale = useSharedValue(1);
  const s = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const colors = {
    default: { bg: Colors.bgSurface, border: Colors.borderDefault, text: Colors.textPrimary },
    success: { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.3)', text: '#34D399' },
    error:   { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)', text: '#F87171' },
    warning: { bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.3)',  text: '#FBBF24' },
  }[variant];

  return (
    <Animated.View style={[s, { flex: 1 }]}>
      <TouchableOpacity
        onPress={() => {
          scale.value = withSpring(0.95, { damping: 10 }, () => { scale.value = withSpring(1); });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        activeOpacity={1}
        style={[styles.actionBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
      >
        <Ionicons name={icon as any} size={18} color={colors.text} />
        <TText variant="caption" weight="semibold" style={{ color: colors.text }}>{label}</TText>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { updateRequestStatus } = useAppStore();
  const isArtist = user?.role === 'artist';

  const [showDecline, setShowDecline] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');

  const request = useAppStore((s) => s.requests.find((r) => r.id === id))
    ?? REQUESTS.find((r) => r.id === id)
    ?? REQUESTS[0];

  const config = STATUS_CONFIG[request.status];

  const handleAccept = useCallback(() => {
    updateRequestStatus(request.id, 'accepted');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [request.id]);

  const handleDecline = useCallback(() => {
    if (!selectedReason) return;
    updateRequestStatus(request.id, 'declined');
    setShowDecline(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [request.id, selectedReason]);

  const handleClarification = useCallback(() => {
    updateRequestStatus(request.id, 'clarification_needed');
  }, [request.id]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2" weight="semibold">Demande</TText>
        <View style={{ width: 44 }} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Client identity */}
        <Animated.View entering={FadeInDown.delay(80).springify()}>
          <GlassCard variant="elevated" style={styles.clientCard}>
            <TAvatar uri={request.clientAvatar} name={request.clientName} size="xl" />
            <View style={{ flex: 1 }}>
              <TText variant="title2" weight="bold">{request.clientName}</TText>
              <TText variant="caption" color="secondary" style={{ marginTop: 2 }}>
                {new Date(request.submittedAt).toLocaleDateString('fr-FR', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </TText>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: config.dot }]} />
                <TBadge label={STATUS_LABELS[request.status]} variant={config.variant} />
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Project details */}
        <Animated.View entering={FadeInDown.delay(140).springify()}>
          <TText variant="label" color="tertiary" uppercase style={styles.sectionLabel}>
            Détails du projet
          </TText>
          <GlassCard variant="default" style={styles.detailsCard}>
            <InfoRow icon="add-circle-outline" label="Type"   value={PROJECT_TYPE_LABELS[request.projectType] ?? request.projectType} />
            <TDivider style={{ marginVertical: 6 }} />
            <InfoRow icon="body-outline"       label="Zone"   value={request.bodyZone} />
            <TDivider style={{ marginVertical: 6 }} />
            <InfoRow icon="resize-outline"     label="Taille" value={SIZE_LABELS[request.sizeCategory]?.split('·')[0]?.trim() ?? request.sizeCategory} />
            <TDivider style={{ marginVertical: 6 }} />
            <InfoRow icon="cash-outline"       label="Budget" value={`${request.budgetMin}–${request.budgetMax}€`} />
            {request.stylePrefs?.length > 0 && (
              <>
                <TDivider style={{ marginVertical: 6 }} />
                <InfoRow icon="color-palette-outline" label="Styles" value={request.stylePrefs.join(', ')} />
              </>
            )}
            {request.colorPref && (
              <>
                <TDivider style={{ marginVertical: 6 }} />
                <InfoRow icon="contrast-outline" label="Couleur" value={request.colorPref} />
              </>
            )}
            {request.isFlexible && (
              <>
                <TDivider style={{ marginVertical: 6 }} />
                <InfoRow icon="swap-horizontal-outline" label="Flexibilité" value="Ouvert aux suggestions" />
              </>
            )}
          </GlassCard>
        </Animated.View>

        {/* Description */}
        {request.description && (
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <TText variant="label" color="tertiary" uppercase style={styles.sectionLabel}>Description</TText>
            <GlassCard variant="default" style={{ padding: Spacing.sm }}>
              <TText variant="body" color="secondary" style={{ lineHeight: 24 }}>{request.description}</TText>
            </GlassCard>
          </Animated.View>
        )}

        {/* Decline reason (if declined) */}
        {request.status === 'declined' && request.declineReason && (
          <Animated.View entering={FadeInDown.delay(240).springify()}>
            <TText variant="label" color="tertiary" uppercase style={styles.sectionLabel}>Raison du refus</TText>
            <GlassCard variant="default" style={{ padding: Spacing.sm }}>
              <TText variant="bodySmall" color="secondary">{DECLINE_REASONS[request.declineReason] ?? request.declineReason}</TText>
            </GlassCard>
          </Animated.View>
        )}

        {/* Decline picker modal */}
        {showDecline && (
          <Animated.View entering={FadeInDown.duration(250)} style={styles.declinePanel}>
            <TText variant="bodySmall" weight="semibold" style={{ marginBottom: Spacing.sm }}>
              Raison du refus
            </TText>
            {Object.entries(DECLINE_REASONS).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                onPress={() => setSelectedReason(key)}
                style={[styles.declineOption, selectedReason === key && styles.declineOptionSelected]}
              >
                <Ionicons
                  name={selectedReason === key ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={selectedReason === key ? Colors.error : Colors.textTertiary}
                />
                <TText variant="bodySmall" style={{ marginLeft: 10, flex: 1 }}>{label as string}</TText>
              </TouchableOpacity>
            ))}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: Spacing.sm }}>
              <TButton title="Annuler" variant="glass" size="sm" onPress={() => setShowDecline(false)} />
              <TButton
                title="Confirmer le refus"
                variant="secondary"
                size="sm"
                disabled={!selectedReason}
                onPress={handleDecline}
              />
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Artist action bar */}
      {isArtist && request.status === 'submitted' && !showDecline && (
        <Animated.View
          entering={FadeIn.delay(400).springify()}
          style={[styles.actionBar, { paddingBottom: insets.bottom + 8 }]}
        >
          <ActionBtn label="Accepter" icon="checkmark-outline" onPress={handleAccept} variant="success" />
          <ActionBtn label="Clarifier" icon="help-outline" onPress={handleClarification} variant="warning" />
          <ActionBtn label="Refuser" icon="close-outline" onPress={() => setShowDecline(true)} variant="error" />
        </Animated.View>
      )}

      {/* Message CTA (accepted) */}
      {request.status === 'accepted' && (
        <Animated.View
          entering={FadeIn.delay(300)}
          style={[styles.singleAction, { paddingBottom: insets.bottom + 8 }]}
        >
          <TButton
            title="Ouvrir la conversation →"
            variant="primary"
            onPress={() => router.push(`/conversation/${request.id}`)}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xs'], height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm, gap: Spacing.sm },
  sectionLabel: { marginBottom: Spacing['2xs'] },
  clientCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  detailsCard: { padding: Spacing.sm },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 5,
  },
  declinePanel: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)',
  },
  declineOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle,
  },
  declineOptionSelected: {},
  actionBar: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm,
    backgroundColor: 'rgba(5,5,8,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderSubtle,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 48, borderRadius: Radius.md, borderWidth: 1, gap: 6,
  },
  singleAction: {
    paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm,
    backgroundColor: 'rgba(5,5,8,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderSubtle,
  },
});
