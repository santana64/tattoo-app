import React, { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from './ui/TText';
import { TAvatar } from './ui/TAvatar';
import { TBadge } from './ui/TBadge';
import type { TattooRequest } from '@/constants/mock-data';
import { STATUS_LABELS, PROJECT_TYPE_LABELS, SIZE_LABELS } from '@/constants/mock-data';

interface RequestCardProps {
  request: TattooRequest;
  viewAs: 'artist' | 'client';
}

const STATUS_CONFIG: Record<TattooRequest['status'], {
  variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent';
  dot: string;
  bg: string;
}> = {
  submitted:             { variant: 'accent',   dot: '#60A5FA', bg: 'rgba(96,165,250,0.06)' },
  accepted:              { variant: 'success',  dot: '#34D399', bg: 'rgba(52,211,153,0.06)' },
  declined:              { variant: 'error',    dot: '#F87171', bg: 'rgba(248,113,113,0.05)' },
  clarification_needed:  { variant: 'warning',  dot: '#FBBF24', bg: 'rgba(251,191,36,0.05)'  },
  completed:             { variant: 'info',     dot: '#818CF8', bg: 'rgba(129,140,248,0.05)' },
  archived:              { variant: 'default',  dot: Colors.textTertiary, bg: 'transparent'  },
};

const PROJECT_ICONS: Record<string, string> = {
  new:       'add-circle-outline',
  cover_up:  'color-wand-outline',
  touch_up:  'brush-outline',
  extension: 'expand-outline',
};

export function RequestCard({ request, viewAs }: RequestCardProps) {
  const router = useRouter();
  const config = STATUS_CONFIG[request.status];
  const isNew = request.status === 'submitted' && viewAs === 'artist';

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 12 }, () => { scale.value = withSpring(1); });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/request/${request.id}`);
  }, [request.id]);

  return (
    <Animated.View entering={FadeIn.duration(350)} style={animStyle}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handlePress}
        style={[styles.container, { backgroundColor: config.bg || Colors.bgElevated }, isNew && styles.containerNew]}
      >
        {/* New request accent line */}
        {isNew && <View style={styles.newBar} />}

        {/* Top row */}
        <View style={styles.topRow}>
          <TAvatar uri={request.clientAvatar} name={request.clientName} size="lg" />

          <View style={styles.body}>
            <View style={styles.nameRow}>
              <TText variant="bodySmall" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                {request.clientName}
              </TText>
              <TText variant="caption" color="tertiary">
                {new Date(request.submittedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </TText>
            </View>

            {/* Project type + zone */}
            <View style={styles.detailRow}>
              <Ionicons
                name={(PROJECT_ICONS[request.projectType] ?? 'add-circle-outline') as any}
                size={12}
                color={Colors.textTertiary}
              />
              <TText variant="caption" color="secondary" numberOfLines={1}>
                {PROJECT_TYPE_LABELS[request.projectType]} · {request.bodyZone}
              </TText>
            </View>

            {/* Budget + size */}
            <View style={styles.detailRow}>
              <Ionicons name="cash-outline" size={12} color={Colors.textTertiary} />
              <TText variant="caption" color="secondary">
                {request.budgetMin}–{request.budgetMax}€
              </TText>
              <TText variant="caption" color="tertiary"> · </TText>
              <TText variant="caption" color="secondary">
                {SIZE_LABELS[request.sizeCategory]?.split('·')[0]?.trim()}
              </TText>
            </View>
          </View>
        </View>

        {/* Description */}
        {request.description ? (
          <TText
            variant="caption"
            color="tertiary"
            numberOfLines={2}
            style={styles.description}
          >
            {request.description}
          </TText>
        ) : null}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: config.dot }]} />
            <TBadge label={STATUS_LABELS[request.status]} variant={config.variant} />
          </View>
          {isNew && (
            <View style={styles.newPill}>
              <TText variant="micro" style={{ color: Colors.accent }}>Nouvelle →</TText>
            </View>
          )}
          {request.status === 'accepted' && viewAs === 'client' && (
            <TouchableOpacity
              onPress={() => router.push(`/conversation/${request.id}`)}
              style={styles.messageBtn}
            >
              <Ionicons name="chatbubble-outline" size={14} color={Colors.accentWarm} />
              <TText variant="micro" style={{ color: Colors.accentWarm, marginLeft: 4 }}>Message</TText>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing['2xs'],
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
    gap: Spacing['2xs'],
  },
  containerNew: {
    borderColor: 'rgba(96,165,250,0.25)',
    ...GlowShadow.white,
  },
  newBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 3,
    backgroundColor: '#60A5FA',
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing['2xs'] },
  body: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  description: {
    paddingTop: Spacing['2xs'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  footer: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing['2xs'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  newPill: {
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'rgba(96,165,250,0.10)',
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.20)',
  },
  messageBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(200,168,130,0.08)',
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(200,168,130,0.20)',
  },
});
