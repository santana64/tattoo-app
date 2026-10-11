import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable, Platform, type PressableProps } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format, isSameYear, isToday, isValid, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Colors, Spacing, Radius, SpringConfig } from '@/constants/theme';
import { TText } from './ui/TText';
import { TAvatar } from './ui/TAvatar';
import type { TattooRequest, RequestStatus } from '@/store/request-store';
import { PROJECT_TYPE_LABELS } from '@/constants/mock-data';

// ─── Shared request vocabulary (used by inbox, request detail, conversation) ──

export type RequestViewer = 'artist' | 'client';

/** Status display: 6px dot + label. Waiting = warning, open/positive = success. */
export const REQUEST_STATUS: Record<RequestStatus, { label: string; artistLabel?: string; color: string }> = {
  submitted:            { label: 'En attente de réponse', artistLabel: 'Nouvelle demande', color: Colors.warning },
  clarification_needed: { label: 'Précision demandée', color: Colors.warning },
  accepted:             { label: 'Acceptée', color: Colors.success },
  confirmed:            { label: 'Rendez-vous confirmé', color: Colors.success },
  declined:             { label: 'Refusée', color: Colors.error },
  completed:            { label: 'Terminée', color: Colors.textSecondary },
  archived:             { label: 'Archivée', color: Colors.textTertiary },
};

export const requestStatusLabel = (status: RequestStatus, viewAs: RequestViewer) => {
  const s = REQUEST_STATUS[status] ?? REQUEST_STATUS.archived;
  return viewAs === 'artist' && s.artistLabel ? s.artistLabel : s.label;
};

export const SIZE_RANGE: Record<TattooRequest['sizeCategory'], string> = {
  xs: 'moins de 3 cm',
  s:  '3 à 7 cm',
  m:  '7 à 15 cm',
  l:  '15 à 25 cm',
  xl: '25 cm et plus',
};

export const COLOR_LABEL: Record<TattooRequest['colorPreference'], string> = {
  black_grey:    'Noir et gris',
  color:         'Couleur',
  artist_choice: 'Au choix de l’artiste',
};

export const FLEX_LABEL: Record<TattooRequest['flexibilityLevel'], string> = {
  precise:    'Projet précis',
  open:       'Ouvert aux suggestions',
  full_trust: 'Carte blanche à l’artiste',
};

export const projectTypeLabel = (type: string) => PROJECT_TYPE_LABELS[type] ?? type;

const euros = (n: number) => n.toLocaleString('fr-FR');

export function formatBudget(r: Pick<TattooRequest, 'budgetMin' | 'budgetMax' | 'budgetUnknown'>): string {
  if (r.budgetUnknown) return 'À définir';
  const { budgetMin: min, budgetMax: max } = r;
  if (min == null && max == null) return 'Non précisé';
  if (min != null && max != null) return min === max ? `${euros(min)} €` : `${euros(min)} – ${euros(max)} €`;
  return min != null ? `dès ${euros(min)} €` : `jusqu’à ${euros(max as number)} €`;
}

/** Compact list date: time today, "12 oct." this year, "12/10/24" otherwise. */
export function formatListDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = parseISO(iso);
  if (!isValid(d)) return '';
  if (isToday(d)) return format(d, 'HH:mm', { locale: fr });
  if (isSameYear(d, new Date())) return format(d, 'd MMM', { locale: fr });
  return format(d, 'dd/MM/yy', { locale: fr });
}

export function RequestStatusLine({ status, viewAs, strong }: { status: RequestStatus; viewAs: RequestViewer; strong?: boolean }) {
  const s = REQUEST_STATUS[status] ?? REQUEST_STATUS.archived;
  return (
    <View style={styles.statusLine}>
      <View style={[styles.statusDot, { backgroundColor: s.color }]} />
      <TText variant="caption" weight={strong ? 'medium' : 'regular'} color={strong ? 'primary' : 'secondary'}>
        {requestStatusLabel(status, viewAs)}
      </TText>
    </View>
  );
}

// ─── Card: one editorial row in the inbox ─────────────────────────────────────

interface RequestCardProps {
  request: TattooRequest;
  viewAs: RequestViewer;
  onPressIn?: PressableProps['onPressIn'];
  onPressOut?: PressableProps['onPressOut'];
}

export function RequestCard({ request, viewAs, onPressIn, onPressOut }: RequestCardProps) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const needsAction = viewAs === 'artist' && request.status === 'submitted';
  const name = (viewAs === 'artist' ? request.clientName : request.artistName) ?? '';
  const avatar = viewAs === 'artist' ? request.clientAvatarUrl : request.artistAvatarUrl;
  const place = viewAs === 'client' ? request.artistCity : undefined;
  const summary = [projectTypeLabel(request.projectType), request.bodyZone, request.sizeCategory?.toUpperCase()]
    .filter(Boolean).join(' · ');
  const date = formatListDate(request.submittedAt);
  const budget = formatBudget(request);
  const statusLabel = requestStatusLabel(request.status, viewAs);

  const open = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/request/${request.id}`);
  }, [request.id, router]);

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={open}
        onPressIn={(e) => {
          if (!reduced) scale.value = withSpring(0.985, SpringConfig.snappy);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          scale.value = withSpring(1, SpringConfig.gentle);
          onPressOut?.(e);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${summary}, ${statusLabel}${date ? `, envoyée le ${date}` : ''}`}
        accessibilityHint="Ouvre le détail de la demande"
        style={(state) => {
          const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
          return [styles.row, (pressed || hovered) && styles.rowActive];
        }}
      >
        <TAvatar uri={avatar} name={name} size="lg" />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <TText variant="title2" serif numberOfLines={1} style={styles.name}>
              {name}
            </TText>
            {!!date && (
              <TText variant="caption" color="tertiary" tabular>
                {date}
              </TText>
            )}
          </View>

          <TText variant="caption" color="secondary" numberOfLines={1}>
            {summary}{place ? ` · ${place}` : ''}
          </TText>

          {!!request.description && (
            <TText variant="bodySmall" color="tertiary" numberOfLines={2} style={styles.description}>
              {request.description}
            </TText>
          )}

          <View style={styles.footer}>
            <RequestStatusLine status={request.status} viewAs={viewAs} strong={needsAction} />
            <View style={styles.footerRight}>
              <TText variant="caption" color="secondary" tabular>{budget}</TText>
              {request.status === 'accepted' && viewAs === 'client' && (
                <Pressable
                  onPress={() => router.push(`/conversation/${request.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Écrire à ${name}`}
                  hitSlop={10}
                  style={({ pressed }) => [styles.messageLink, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="chatbubble-outline" size={13} color={Colors.accentWarm} />
                  <TText variant="caption" weight="medium" color="accentWarm">Écrire</TText>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderDefault,
    borderRadius: Radius.sm,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transitionDuration: '160ms' } as object : null),
  },
  rowActive: { backgroundColor: Colors.glassBg },

  body: { flex: 1, gap: 3, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.xs },
  name: { flex: 1, fontSize: 21, lineHeight: 26 },
  description: { marginTop: 4 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    marginTop: Spacing['2xs'],
  },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  messageLink: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 28 },
});
