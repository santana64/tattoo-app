import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from './ui/TText';
import { TAvatar } from './ui/TAvatar';
import { TBadge } from './ui/TBadge';
import type { TattooRequest } from '@/constants/mock-data';
import { STATUS_LABELS, PROJECT_TYPE_LABELS, SIZE_LABELS } from '@/constants/mock-data';

interface RequestCardProps {
  request: TattooRequest;
  viewAs: 'artist' | 'client';
}

const statusVariant: Record<TattooRequest['status'], 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent'> = {
  submitted: 'accent',
  accepted: 'success',
  declined: 'error',
  clarification_needed: 'warning',
  archived: 'default',
  completed: 'info',
};

export function RequestCard({ request, viewAs }: RequestCardProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.container}
      onPress={() => router.push(`/request/${request.id}`)}
    >
      {request.status === 'submitted' && viewAs === 'artist' && (
        <View style={styles.unreadBar} />
      )}

      <View style={styles.row}>
        <TAvatar uri={request.clientAvatar} name={request.clientName} size="lg" />

        <View style={styles.body}>
          <View style={styles.topRow}>
            <TText variant="bodySmall" weight="semibold" numberOfLines={1} style={styles.name}>
              {request.clientName}
            </TText>
            <TText variant="caption" color="tertiary">
              {new Date(request.submittedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </TText>
          </View>

          <TText variant="caption" color="secondary" numberOfLines={1}>
            {PROJECT_TYPE_LABELS[request.projectType]} · {request.bodyZone} · {SIZE_LABELS[request.sizeCategory].split('·')[0].trim()}
          </TText>

          <View style={styles.bottomRow}>
            <TText variant="caption" color="tertiary">
              {request.budgetMin}–{request.budgetMax}€
            </TText>
            <TBadge
              label={STATUS_LABELS[request.status]}
              variant={statusVariant[request.status]}
              dot={request.status === 'submitted'}
            />
          </View>
        </View>
      </View>

      {request.description ? (
        <TText variant="caption" color="tertiary" numberOfLines={2} style={styles.description}>
          {request.description}
        </TText>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing['2xs'],
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.accent,
    borderTopLeftRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  body: {
    flex: 1,
    marginLeft: Spacing['2xs'],
    gap: 3,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    flex: 1,
    marginRight: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  description: {
    marginTop: Spacing['2xs'],
    paddingTop: Spacing['2xs'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
});
