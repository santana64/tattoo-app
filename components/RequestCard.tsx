import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable, Platform, type PressableProps } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns/format';
import { isSameYear } from 'date-fns/isSameYear';
import { isToday } from 'date-fns/isToday';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { fr } from 'date-fns/locale/fr';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { TText } from './ui/TText';
import { TAvatar } from './ui/TAvatar';
import { Kicker, StatusDot, TextLink, type StatusTone } from './v5';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import type { TattooRequest, RequestStatus } from '@/store/request-store';
import { PROJECT_TYPE_LABELS } from '@/constants/tattoo';

// ─── Shared request vocabulary (used by inbox, request detail, conversation) ──

export type RequestViewer = 'artist' | 'client';

interface StatusMeta {
  label: string;
  artistLabel?: string;
  tone: StatusTone;
  /** The artist's tone when the status asks them to act. */
  artistTone?: StatusTone;
}

/** Status display: 6px dot + small capitals (StatusDot). */
export const REQUEST_STATUS: Record<RequestStatus, StatusMeta> = {
  submitted:            { label: 'En attente de réponse', artistLabel: 'Nouvelle demande', tone: 'wait', artistTone: 'alert' },
  clarification_needed: { label: 'Précision demandée', tone: 'wait' },
  accepted:             { label: 'Acceptée', tone: 'open' },
  confirmed:            { label: 'Rendez-vous confirmé', tone: 'open' },
  declined:             { label: 'Refusée', tone: 'alert' },
  completed:            { label: 'Terminée', tone: 'closed' },
  archived:             { label: 'Archivée', tone: 'closed' },
};

/**
 * A question (no project) is never "waiting for an answer" as a project is: the
 * reply happens in the conversation, so its open states read as a thread.
 */
const INQUIRY_STATUS: Partial<Record<RequestStatus, StatusMeta>> = {
  submitted:            { label: 'Question envoyée', artistLabel: 'Question reçue', tone: 'wait', artistTone: 'alert' },
  clarification_needed: { label: 'Question envoyée', artistLabel: 'Question reçue', tone: 'wait', artistTone: 'alert' },
  accepted:             { label: 'Échange en cours', tone: 'open' },
  declined:             { label: 'Échange clos', tone: 'closed' },
};

const statusMeta = (status: RequestStatus, inquiry?: boolean) =>
  (inquiry ? INQUIRY_STATUS[status] : undefined) ?? REQUEST_STATUS[status] ?? REQUEST_STATUS.archived;

export const requestStatusLabel = (status: RequestStatus, viewAs: RequestViewer, inquiry?: boolean) => {
  const s = statusMeta(status, inquiry);
  return viewAs === 'artist' && s.artistLabel ? s.artistLabel : s.label;
};

export const requestStatusTone = (status: RequestStatus, viewAs: RequestViewer, inquiry?: boolean): StatusTone => {
  const s = statusMeta(status, inquiry);
  return viewAs === 'artist' && s.artistTone ? s.artistTone : s.tone;
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

export function RequestStatusLine({ status, viewAs, inquiry, onInk }: {
  status: RequestStatus; viewAs: RequestViewer; inquiry?: boolean; onInk?: boolean;
}) {
  return (
    <StatusDot
      tone={requestStatusTone(status, viewAs, inquiry)}
      label={requestStatusLabel(status, viewAs, inquiry)}
      onInk={onInk}
      style={styles.statusLine}
    />
  );
}

// ─── Card: one line of the inbox ledger ───────────────────────────────────────

interface RequestCardProps {
  request: TattooRequest;
  viewAs: RequestViewer;
  onPressIn?: PressableProps['onPressIn'];
  onPressOut?: PressableProps['onPressOut'];
}

type Hover = { pressed: boolean; hovered?: boolean };
const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color', transitionDuration: '180ms' } as object)
  : null;

export function RequestCard({ request, viewAs, onPressIn, onPressOut }: RequestCardProps) {
  const router = useRouter();
  const { isWide } = useContentDimensions();

  const inquiry = request.isInquiry;
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
  const canWrite = !inquiry && request.status === 'accepted' && viewAs === 'client';

  // Navigation, not a commit: press feedback is visual only (no haptic).
  const open = useCallback(() => router.push(`/request/${request.id}`), [request.id, router]);
  const openThread = useCallback(() => router.push(`/conversation/${request.id}`), [request.id, router]);

  const action = threadOpen ? (
    <TextLink
      label={viewAs === 'artist' ? 'Répondre' : 'Conversation'}
      icon="chatbubble-outline"
      onPress={openThread}
      accessibilityLabel={viewAs === 'artist' ? `Répondre à ${name}` : `Voir la conversation avec ${name}`}
    />
  ) : canWrite ? (
    <TextLink label="Écrire" icon="chatbubble-outline" onPress={openThread} accessibilityLabel={`Écrire à ${name}`} />
  ) : null;

  const subject = (
    <TText variant="caption" color={inquiry ? 'accentWarm' : 'secondary'} numberOfLines={1} style={styles.summary}>
      {summary}{place ? ` · ${place}` : ''}
    </TText>
  );

  return (
    <Pressable
      onPress={open}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${summary}, ${statusLabel}${date ? `, envoyée le ${date}` : ''}`}
      accessibilityHint="Ouvre le détail de la demande"
      style={(state) => [styles.row, webPointer, ((state as Hover).hovered || state.pressed) && styles.rowActive]}
    >
      {(state) => {
        const lit = (state as Hover).hovered || state.pressed;
        const title = (
          <TText variant="displayS" numberOfLines={1} style={[styles.name, lit && { color: Colors.flameText }]}>
            {name}
          </TText>
        );

        if (isWide) {
          return (
            <View style={styles.wideRow}>
              <TAvatar uri={avatar} name={name} size="md" />
              <View style={styles.wideSubject}>
                {title}
                {subject}
              </View>
              <View style={styles.wideStatus}>
                <RequestStatusLine status={request.status} viewAs={viewAs} inquiry={inquiry} />
              </View>
              <TText variant="caption" tabular color="secondary" numberOfLines={1} style={styles.wideBudget}>
                {budget ?? '—'}
              </TText>
              <TText variant="caption" tabular color="tertiary" numberOfLines={1} style={styles.wideDate}>{date}</TText>
              <View style={styles.wideAction}>{action}</View>
            </View>
          );
        }

        return (
          <>
            <View style={styles.topLine}>
              <RequestStatusLine status={request.status} viewAs={viewAs} inquiry={inquiry} />
              {!!date && <TText variant="caption" color="tertiary" tabular>{date}</TText>}
            </View>
            <View style={styles.main}>
              <TAvatar uri={avatar} name={name} size="lg" />
              <View style={styles.body}>
                {title}
                {subject}
                {!!request.description && (
                  <TText variant="bodySmall" color="tertiary" numberOfLines={2} style={styles.description}>
                    {request.description}
                  </TText>
                )}
              </View>
            </View>
            {(!!budget || !!action) && (
              <View style={styles.footer}>
                {budget ? <TText variant="caption" color="secondary" tabular>{budget}</TText> : <View />}
                {action}
              </View>
            )}
          </>
        );
      }}
    </Pressable>
  );
}

/** Column titles of the wide ledger; aligned with the wide RequestCard. */
export function RequestLedgerHead({ viewAs }: { viewAs: RequestViewer }) {
  return (
    <View style={[styles.wideRow, styles.ledgerHead]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.avatarSpacer} />
      <Kicker tone="muted" style={styles.wideSubject}>{viewAs === 'artist' ? 'Client · projet' : 'Artiste · projet'}</Kicker>
      <Kicker tone="muted" style={styles.wideStatus}>État</Kicker>
      <Kicker tone="muted" style={styles.wideBudget}>Budget</Kicker>
      <Kicker tone="muted" style={styles.wideDate}>Date</Kicker>
      <View style={styles.wideAction} />
    </View>
  );
}

// ─── Status timeline: vermilion dots on a hairline ────────────────────────────

export type TimelineState = 'done' | 'current' | 'upcoming' | 'ended';
export interface TimelineStep {
  key: string;
  label: string;
  detail?: string;
  state: TimelineState;
}

const STATE_A11Y: Record<TimelineState, string> = { done: 'terminé', current: 'en cours', upcoming: 'à venir', ended: 'clos' };
const STATE_WORD: Record<TimelineState, string> = { done: 'Terminée', current: 'En cours', upcoming: 'À venir', ended: 'Close' };

function TimelineRow({ step, index, last }: { step: TimelineStep; index: number; last: boolean }) {
  const muted = step.state === 'upcoming';
  return (
    <View
      style={tl.row}
      accessible
      accessibilityLabel={`${step.label}${step.detail ? `, ${step.detail}` : ''}, ${STATE_A11Y[step.state]}`}
    >
      <View style={tl.rail}>
        <View style={tl.marker}>
          {step.state === 'current' ? (
            <View style={tl.ring}><View style={[tl.dot, tl.dotFlame]} /></View>
          ) : (
            <View
              style={[
                tl.dot,
                step.state === 'done' && tl.dotFlame,
                step.state === 'upcoming' && tl.dotOpen,
                step.state === 'ended' && tl.dotEnded,
              ]}
            />
          )}
        </View>
        {!last && <View style={tl.line} />}
      </View>
      <View style={[tl.text, last && { paddingBottom: 0 }]}>
        <Kicker tone={step.state === 'current' ? 'flame' : 'muted'}>
          {`Étape ${String(index + 1).padStart(2, '0')} · ${STATE_WORD[step.state]}`}
        </Kicker>
        <TText variant="displayS" style={[tl.label, muted && { color: Colors.textTertiary }]}>{step.label}</TText>
        {!!step.detail && (
          <TText variant="caption" color={muted ? 'tertiary' : 'secondary'} tabular style={{ marginTop: 2 }}>
            {step.detail}
          </TText>
        )}
      </View>
    </View>
  );
}

export function StatusTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <View accessibilityRole="list">
      {steps.map((s, i) => (
        <TimelineRow key={s.key} step={s} index={i} last={i === steps.length - 1} />
      ))}
    </View>
  );
}

const tl = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
  rail: { width: 18, alignItems: 'center' },
  marker: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: 18, height: 18, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.flame,
    alignItems: 'center', justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: Radius.full },
  dotFlame: { backgroundColor: Colors.flame },
  dotOpen: { backgroundColor: Colors.paper, borderWidth: 1, borderColor: Colors.metal },
  dotEnded: { backgroundColor: Colors.metal },
  line: { flex: 1, width: 1, marginTop: 4, marginBottom: 2, backgroundColor: Colors.line },
  text: { flex: 1, minWidth: 0, paddingBottom: Spacing.lg, minHeight: 44 },
  label: { fontSize: 24, lineHeight: 27, letterSpacing: -0.4, marginTop: 6 },
});

const styles = StyleSheet.create({
  statusLine: { flexShrink: 1 },

  row: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['2xs'],
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  rowActive: { backgroundColor: Colors.wash },

  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.xs, marginBottom: Spacing.xs },
  main: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
  body: { flex: 1, gap: 3, minWidth: 0 },
  name: { fontSize: 24, lineHeight: 27, letterSpacing: -0.4 },
  summary: { flexShrink: 1 },
  description: { marginTop: 4 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.xs,
    marginTop: Spacing['2xs'], minHeight: 32,
  },

  wideRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  ledgerHead: { paddingHorizontal: Spacing['2xs'], paddingBottom: Spacing.xs },
  avatarSpacer: { width: 40 },
  wideSubject: { flex: 1, minWidth: 0, gap: 3 },
  wideStatus: { width: 190 },
  wideBudget: { width: 130 },
  wideDate: { width: 64, textAlign: 'right' },
  wideAction: { width: 140, alignItems: 'flex-end' },
});
