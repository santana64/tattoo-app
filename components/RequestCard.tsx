import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, Pressable, type PressableProps } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, useReducedMotion } from 'react-native-reanimated';
import { format } from 'date-fns/format';
import { isSameYear } from 'date-fns/isSameYear';
import { isToday } from 'date-fns/isToday';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { fr } from 'date-fns/locale/fr';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from './ui/TText';
import { TAvatar } from './ui/TAvatar';
import { PressableScale, EASE_OUT } from './motion';
import type { TattooRequest, RequestStatus } from '@/store/request-store';
import { PROJECT_TYPE_LABELS } from '@/constants/tattoo';

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

/**
 * A question (no project) is never "waiting for an answer" as a project is: the
 * reply happens in the conversation, so its open states read as a thread.
 */
const INQUIRY_STATUS: Partial<Record<RequestStatus, { label: string; artistLabel?: string; color: string }>> = {
  submitted:            { label: 'Question envoyée', artistLabel: 'Question reçue', color: Colors.accentWarm },
  clarification_needed: { label: 'Question envoyée', artistLabel: 'Question reçue', color: Colors.accentWarm },
  accepted:             { label: 'Échange en cours', color: Colors.accentWarm },
  declined:             { label: 'Échange clos', color: Colors.textTertiary },
};

const statusMeta = (status: RequestStatus, inquiry?: boolean) =>
  (inquiry ? INQUIRY_STATUS[status] : undefined) ?? REQUEST_STATUS[status] ?? REQUEST_STATUS.archived;

export const requestStatusLabel = (status: RequestStatus, viewAs: RequestViewer, inquiry?: boolean) => {
  const s = statusMeta(status, inquiry);
  return viewAs === 'artist' && s.artistLabel ? s.artistLabel : s.label;
};

/** "Question" for an inquiry; the project summary otherwise. */
export const INQUIRY_LABEL = 'Question';

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

export function RequestStatusLine({ status, viewAs, strong, inquiry }: {
  status: RequestStatus; viewAs: RequestViewer; strong?: boolean; inquiry?: boolean;
}) {
  const s = statusMeta(status, inquiry);
  return (
    <View style={styles.statusLine}>
      <View style={[styles.statusDot, { backgroundColor: s.color }]} />
      <TText variant="caption" weight={strong ? 'medium' : 'regular'} color={strong ? 'primary' : 'secondary'}>
        {requestStatusLabel(status, viewAs, inquiry)}
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

  const inquiry = request.isInquiry;
  const needsAction = viewAs === 'artist' && request.status === 'submitted';
  const name = (viewAs === 'artist' ? request.clientName : request.artistName) ?? '';
  const avatar = viewAs === 'artist' ? request.clientAvatarUrl : request.artistAvatarUrl;
  const place = viewAs === 'client' ? request.artistCity : undefined;
  // A question has placeholder project fields ("Non précisé", size M): never show them.
  const summary = inquiry
    ? INQUIRY_LABEL
    : [projectTypeLabel(request.projectType), request.bodyZone, request.sizeCategory?.toUpperCase()].filter(Boolean).join(' · ');
  const date = formatListDate(request.submittedAt);
  const budget = inquiry ? null : formatBudget(request);
  const statusLabel = requestStatusLabel(request.status, viewAs, inquiry);
  const threadOpen = inquiry && request.status !== 'archived' && request.status !== 'declined';

  // Navigation, not a commit: press feedback is visual only (no haptic).
  const open = useCallback(() => router.push(`/request/${request.id}`), [request.id, router]);
  const openThread = useCallback(() => router.push(`/conversation/${request.id}`), [request.id, router]);

  return (
    <PressableScale
      onPress={open}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      pressedScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${summary}, ${statusLabel}${date ? `, envoyée le ${date}` : ''}`}
      accessibilityHint="Ouvre le détail de la demande"
      style={styles.row}
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

          <View style={styles.summaryRow}>
            {inquiry && <Ionicons name="help-circle-outline" size={13} color={Colors.accentWarm} />}
            <TText variant="caption" color={inquiry ? 'accentWarm' : 'secondary'} numberOfLines={1} style={styles.summary}>
              {summary}{place ? ` · ${place}` : ''}
            </TText>
          </View>

          {!!request.description && (
            <TText variant="bodySmall" color="tertiary" numberOfLines={2} style={styles.description}>
              {request.description}
            </TText>
          )}

          <View style={styles.footer}>
            <RequestStatusLine status={request.status} viewAs={viewAs} strong={needsAction} inquiry={inquiry} />
            <View style={styles.footerRight}>
              {!!budget && <TText variant="caption" color="secondary" tabular>{budget}</TText>}
              {threadOpen && (
                <Pressable
                  onPress={openThread}
                  accessibilityRole="button"
                  accessibilityLabel={viewAs === 'artist' ? `Répondre à ${name}` : `Voir la conversation avec ${name}`}
                  hitSlop={10}
                  style={({ pressed }) => [styles.messageLink, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="chatbubble-outline" size={13} color={Colors.accentWarm} />
                  <TText variant="caption" weight="medium" color="accentWarm">{viewAs === 'artist' ? 'Répondre' : 'Conversation'}</TText>
                </Pressable>
              )}
              {!inquiry && request.status === 'accepted' && viewAs === 'client' && (
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
    </PressableScale>
  );
}

// ─── Status timeline: a hairline rail drawn top-down on mount ─────────────────

export type TimelineState = 'done' | 'current' | 'upcoming' | 'ended';
export interface TimelineStep {
  key: string;
  label: string;
  detail?: string;
  state: TimelineState;
  /** Status color for current/ended steps. Done steps use the gold accent. */
  color?: string;
}

const STATE_A11Y: Record<TimelineState, string> = { done: 'terminé', current: 'en cours', upcoming: 'à venir', ended: 'clos' };

function TimelineRow({ step, index, last, nextState, reduced }: {
  step: TimelineStep; index: number; last: boolean; nextState?: TimelineState; reduced: boolean;
}) {
  const draw = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) { draw.set(1); return; }
    draw.set(withDelay(240 + index * 180, withTiming(1, { duration: 460, easing: EASE_OUT })));
  }, [draw, index, reduced]);
  const lineStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: draw.get() }] }));

  const color = step.color ?? Colors.accentWarm;
  const reached = step.state === 'done' && nextState !== undefined && nextState !== 'upcoming';
  const muted = step.state === 'upcoming';

  return (
    <View
      style={tl.row}
      accessible
      accessibilityLabel={`${step.label}${step.detail ? `, ${step.detail}` : ''}, ${STATE_A11Y[step.state]}`}
    >
      <View style={tl.rail}>
        {step.state === 'current' ? (
          <View style={[tl.ring, { borderColor: color }]}>
            <View style={[tl.dot, { backgroundColor: color }]} />
          </View>
        ) : (
          <View style={tl.ringSpacer}>
            <View
              style={[
                tl.dot,
                muted
                  ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.textTertiary }
                  : { backgroundColor: step.state === 'done' ? Colors.accentWarm : color },
              ]}
            />
          </View>
        )}
        {!last && (
          <View style={tl.track}>
            <Animated.View
              style={[tl.fill, { backgroundColor: reached ? Colors.accentWarm : Colors.borderDefault }, lineStyle]}
            />
          </View>
        )}
      </View>
      <View style={[tl.text, last && { paddingBottom: 0 }]}>
        <TText variant="bodySmall" weight={step.state === 'current' ? 'semibold' : 'medium'} color={muted ? 'tertiary' : 'primary'}>
          {step.label}
        </TText>
        {!!step.detail && (
          <TText variant="caption" color={muted ? 'tertiary' : 'secondary'} tabular style={{ marginTop: 1 }}>
            {step.detail}
          </TText>
        )}
      </View>
    </View>
  );
}

export function StatusTimeline({ steps }: { steps: TimelineStep[] }) {
  const reduced = useReducedMotion();
  return (
    <View accessibilityRole="list">
      {steps.map((s, i) => (
        <TimelineRow key={s.key} step={s} index={i} last={i === steps.length - 1} nextState={steps[i + 1]?.state} reduced={reduced} />
      ))}
    </View>
  );
}

const tl = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.xs },
  rail: { width: 18, alignItems: 'center' },
  ring: {
    width: 18, height: 18, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  ringSpacer: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  track: { flex: 1, width: 1, marginVertical: 4, overflow: 'hidden' },
  fill: { flex: 1, width: 1, transformOrigin: 'top' },
  text: { flex: 1, paddingBottom: Spacing.md, minHeight: 44 },
});

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
  },

  body: { flex: 1, gap: 3, minWidth: 0 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summary: { flexShrink: 1 },
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
