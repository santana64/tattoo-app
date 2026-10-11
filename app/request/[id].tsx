import React, { useState, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format, isValid, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TButton } from '@/components/ui/TButton';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { styleName } from '@/components/ArtistCard';
import {
  RequestStatusLine, StatusTimeline, SIZE_RANGE, COLOR_LABEL, FLEX_LABEL,
  formatBudget, projectTypeLabel, type TimelineStep, type RequestViewer,
} from '@/components/RequestCard';
import { BottomSheet, GlassSurface, RevealImage, enterUp } from '@/components/motion';
import { useRequestStore, type TattooRequest, type RequestStatus } from '@/store/request-store';
import { AppointmentPanel } from '@/components/AppointmentPanel';
import { useAuthStore } from '@/store/auth-store';
// Decline reason keys are persisted values; this taxonomy (not fixture data) maps them to labels.
import { DECLINE_REASONS } from '@/constants/mock-data';

const DOSSIER_MAX = 720;

function formatLong(iso: string | null | undefined, withTime = false): string | undefined {
  if (!iso) return undefined;
  const d = parseISO(iso);
  if (!isValid(d)) return undefined;
  return format(d, withTime ? "d MMMM yyyy 'à' HH:mm" : 'd MMMM yyyy', { locale: fr });
}

function buildTimeline(r: TattooRequest, viewAs: RequestViewer): TimelineStep[] {
  const sent: TimelineStep = { key: 'sent', label: 'Demande envoyée', detail: formatLong(r.submittedAt, true), state: 'done' };
  const accepted: TimelineStep = { key: 'accepted', label: 'Demande acceptée', detail: formatLong(r.acceptedAt), state: 'done' };
  const appointment: TimelineStep = { key: 'appointment', label: 'Rendez-vous', state: 'upcoming' };
  const session: TimelineStep = { key: 'session', label: 'Séance réalisée', state: 'upcoming' };
  const reply = viewAs === 'artist' ? 'Votre réponse' : 'Réponse de l’artiste';
  switch (r.status) {
    case 'submitted':
      return [sent, { key: 'reply', label: reply, detail: 'En attente', state: 'current', color: Colors.warning }, appointment, session];
    case 'clarification_needed':
      return [sent, {
        key: 'reply', label: 'Précision demandée',
        detail: viewAs === 'artist' ? 'En attente du client' : 'L’artiste attend des précisions',
        state: 'current', color: Colors.warning,
      }, appointment, session];
    case 'accepted':
      return [sent, accepted, { ...appointment, detail: 'À convenir avec l’artiste', state: 'current', color: Colors.success }, session];
    case 'confirmed':
      return [sent, accepted, { ...appointment, label: 'Rendez-vous confirmé', state: 'current', color: Colors.success }, session];
    case 'completed':
      return [sent, accepted, { ...appointment, label: 'Rendez-vous confirmé', state: 'done' }, { ...session, state: 'done' }];
    case 'declined':
      return [sent, {
        key: 'declined', label: 'Demande refusée',
        detail: r.declineReason ? DECLINE_REASONS[r.declineReason] ?? r.declineReason : undefined,
        state: 'ended', color: Colors.error,
      }];
    case 'archived':
    default:
      return [sent, { key: 'archived', label: 'Demande archivée', state: 'ended', color: Colors.textTertiary }];
  }
}

function nextStepCopy(r: TattooRequest, viewAs: RequestViewer, counterpart: string): string | null {
  if (viewAs === 'artist') {
    switch (r.status) {
      case 'submitted': return 'Répondez à cette demande : acceptez-la, demandez des précisions ou refusez-la.';
      case 'clarification_needed': return 'Vous avez demandé des précisions. Vous pouvez toujours accepter ou refuser la demande.';
      case 'accepted': return 'Vous avez accepté ce projet. Proposez un créneau ci-dessous, puis poursuivez l’échange dans la conversation.';
      case 'confirmed': return 'Rendez-vous confirmé. Après la séance, marquez-la comme réalisée.';
      default: return null;
    }
  }
  switch (r.status) {
    case 'submitted': return `${counterpart} n’a pas encore répondu. Sa réponse apparaîtra ici.`;
    case 'clarification_needed': return `${counterpart} souhaite des précisions sur votre projet.`;
    case 'accepted': return `${counterpart} a accepté votre projet. Le créneau proposé apparaîtra ci-dessous ; échangez dans la conversation pour le devis.`;
    case 'confirmed': return 'Votre rendez-vous est confirmé.';
    case 'completed': return 'Séance réalisée. Vous pouvez laisser un avis.';
    case 'declined': return `${counterpart} ne peut pas réaliser ce projet.`;
    default: return null;
  }
}

// ─── Pieces ───────────────────────────────────────────────────────────────────
function Section({ title, index, children }: { title: string; index: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={enterUp(index, 80)} style={styles.section}>
      <TText variant="label" color="accentWarm" uppercase style={styles.sectionTitle}>{title}</TText>
      {children}
    </Animated.View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <TText variant="bodySmall" color="tertiary" style={styles.factLabel}>{label}</TText>
      <TText variant="bodySmall" weight="medium" tabular style={{ flex: 1 }}>{value}</TText>
    </View>
  );
}

function DossierSkeleton() {
  return (
    <View style={[styles.body, { gap: 12, paddingTop: Spacing.lg }]}>
      <TSkeleton width="35%" height={11} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <TSkeleton width={64} height={64} radius={32} />
        <View style={{ flex: 1, gap: 8 }}>
          <TSkeleton width="60%" height={28} />
          <TSkeleton width="35%" height={12} />
        </View>
      </View>
      <TSkeleton height={150} radius={Radius.md} style={{ marginTop: Spacing.lg }} />
      <TSkeleton height={200} radius={Radius.md} style={{ marginTop: Spacing.sm }} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { fetchRequest, updateStatus } = useRequestStore();
  const [request, setRequest] = useState<TattooRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<RequestStatus | null>(null);
  const savingRef = useRef(false);
  const [showDecline, setShowDecline] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');

  useEffect(() => {
    let active = true;
    setRequest(null); setLoading(true); setError(null);
    if (!user) { setLoading(false); return; }
    fetchRequest(id, user.id).then((data) => { if (active) setRequest(data); })
      .catch(() => { if (active) setError('Impossible de charger la demande.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, user, attempt, fetchRequest]);

  const changeStatus = async (status: RequestStatus) => {
    if (!request || savingRef.current) return;
    savingRef.current = true; setSaving(true); setPending(status); setError(null);
    const result = await updateStatus(request.id, status, status === 'declined' ? { declineReason: selectedReason } : undefined);
    savingRef.current = false; setSaving(false); setPending(null);
    if (result.error) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(result.error);
      return;
    }
    setRequest(useRequestStore.getState().getRequest(request.id) ?? request);
    setShowDecline(false);
    // One haptic per commit (accept, decline, clarification), paired with the status change on screen.
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  const handleAccept = () => { void changeStatus('accepted'); };
  const handleDecline = () => { if (selectedReason) void changeStatus('declined'); };
  const handleClarification = () => { void changeStatus('clarification_needed'); };

  // ── Loading / unavailable ──
  if (!request) {
    return (
      <View style={styles.container}>
        <THeader showBack title="Demande" />
        {loading ? <DossierSkeleton /> : !user ? (
          <EmptyState
            icon="lock-closed-outline"
            title="Connectez-vous"
            description="Cette demande n’est visible que par vous et l’artiste concerné."
            ctaLabel="Se connecter"
            onCta={() => router.push('/(auth)/sign-in')}
          />
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title="Chargement impossible" description={`${error} Vérifiez votre connexion.`} ctaLabel="Réessayer" onCta={() => setAttempt((n) => n + 1)} />
        ) : (
          <EmptyState
            icon="document-text-outline"
            title="Demande introuvable"
            description="Cette demande n’existe pas ou vous n’y avez pas accès."
            ctaLabel="Mes demandes"
            onCta={() => router.replace('/(tabs)/inbox')}
          />
        )}
      </View>
    );
  }

  const isArtist = user?.artistId === request.artistId;
  const viewAs: RequestViewer = isArtist ? 'artist' : 'client';
  const counterpart = (isArtist ? request.clientName : request.artistName) ?? '';
  const counterpartAvatar = isArtist ? request.clientAvatarUrl : request.artistAvatarUrl;
  const canAnswer = isArtist && (request.status === 'submitted' || request.status === 'clarification_needed');
  const canChat = ['accepted', 'confirmed', 'completed'].includes(request.status);
  const hasBar = canAnswer || canChat;
  const guidance = nextStepCopy(request, viewAs, counterpart);
  const styles_ = request.stylePreference?.split(',').map((s) => styleName(s.trim())).filter(Boolean).join(', ');
  const references = request.references ?? [];
  const submitted = formatLong(request.submittedAt);

  return (
    <View style={styles.container}>
      <THeader showBack title="Demande" />

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + (hasBar ? 190 : Spacing['2xl']) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Identity ── */}
        <Animated.View entering={enterUp(0)} style={styles.hero}>
          <TText variant="label" color="tertiary" uppercase tabular>
            {isArtist ? 'Demande reçue' : 'Votre demande'}{submitted ? ` · ${submitted}` : ''}
          </TText>
          <View style={styles.identity}>
            <TAvatar uri={counterpartAvatar} name={counterpart} size="xl" />
            <View style={{ flex: 1 }}>
              <TText variant="displayS" numberOfLines={2} accessibilityRole="header">{counterpart}</TText>
              <TText variant="caption" color="secondary" style={{ marginTop: 2 }}>
                {isArtist ? (request.isFirstTattoo ? 'Client · premier tatouage' : 'Client') : request.artistCity || 'Artiste'}
              </TText>
            </View>
          </View>
          <RequestStatusLine status={request.status} viewAs={viewAs} strong />
        </Animated.View>

        {/* ── Status timeline ── */}
        <Section title="Suivi" index={1}>
          <StatusTimeline steps={buildTimeline(request, viewAs)} />
          {!!guidance && <TText variant="bodySmall" color="secondary" style={styles.guidance}>{guidance}</TText>}
          {['accepted', 'confirmed', 'completed'].includes(request.status) && (
            <View style={{ marginTop: Spacing.md }}>
              <AppointmentPanel
                requestId={request.id}
                requestStatus={request.status}
                viewAs={viewAs}
                counterpart={counterpart}
                onChanged={() => setAttempt((n) => n + 1)}
              />
            </View>
          )}
        </Section>

        {!!request.artistNotes && (
          <Section title="Note de l’artiste" index={2}>
            <TText variant="body" color="secondary" style={styles.prose}>{request.artistNotes}</TText>
          </Section>
        )}

        {/* ── Project ── */}
        <Section title="Le projet" index={2}>
          <Fact label="Type" value={projectTypeLabel(request.projectType)} />
          <Fact label="Zone" value={request.bodyZone || '—'} />
          <Fact label="Taille" value={`${request.sizeCategory.toUpperCase()} · ${SIZE_RANGE[request.sizeCategory] ?? ''}`} />
          <Fact label="Budget" value={formatBudget(request)} />
          <Fact label="Couleur" value={COLOR_LABEL[request.colorPreference] ?? request.colorPreference} />
          {!!styles_ && <Fact label="Styles" value={styles_} />}
          <Fact label="Approche" value={FLEX_LABEL[request.flexibilityLevel] ?? request.flexibilityLevel} />
          {!isArtist && request.isFirstTattoo && <Fact label="Premier tatouage" value="Oui" />}
        </Section>

        {!!request.description && (
          <Section title="Description" index={3}>
            <TText variant="body" color="secondary" style={styles.prose} selectable>{request.description}</TText>
          </Section>
        )}

        {references.length > 0 && (
          <Section title="Références" index={4}>
            <View style={styles.refGrid}>
              {references.map((uri, i) => (
                <RevealImage key={uri} uri={uri} style={styles.refTile} accessibilityLabel={`Image de référence ${i + 1}`} />
              ))}
            </View>
          </Section>
        )}

        {request.status === 'declined' && !!request.declineReason && (
          <Section title="Motif du refus" index={5}>
            <TText variant="body" color="secondary">{DECLINE_REASONS[request.declineReason] ?? request.declineReason}</TText>
          </Section>
        )}
      </ScrollView>

      {/* ── Pinned actions ── */}
      {hasBar && !showDecline && (
        <GlassSurface style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.barInner}>
            {!!error && (
              <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                <Ionicons name="alert-circle-outline" size={16} color={Colors.errorLight} />
                <TText variant="caption" style={{ color: Colors.errorLight, flex: 1 }}>{error}</TText>
              </View>
            )}
            {canAnswer ? (
              <>
                <View style={styles.barRow}>
                  {request.status !== 'clarification_needed' && (
                    <TButton
                      title="Demander des précisions"
                      variant="secondary"
                      size="md"
                      onPress={handleClarification}
                      loading={pending === 'clarification_needed'}
                      disabled={saving}
                      fullWidth={false}
                      style={{ flex: 1 }}
                    />
                  )}
                  <TButton
                    title="Refuser"
                    variant="secondary"
                    size="md"
                    onPress={() => { setError(null); setShowDecline(true); }}
                    disabled={saving}
                    fullWidth={false}
                    style={{ flex: request.status === 'clarification_needed' ? 1 : undefined, minWidth: 110 }}
                  />
                </View>
                <TButton title="Accepter la demande" onPress={handleAccept} loading={pending === 'accepted'} disabled={saving} />
              </>
            ) : (
              <TButton
                title="Ouvrir la conversation"
                onPress={() => router.push(`/conversation/${request.id}`)}
                icon={<Ionicons name="chatbubble-outline" size={16} color={Colors.textInverse} />}
              />
            )}
          </View>
        </GlassSurface>
      )}

      {/* ── Decline reasons ── */}
      <BottomSheet visible={showDecline} onClose={() => setShowDecline(false)} accessibilityLabel="Motif du refus">
        <TText variant="displayS">Motif du refus</TText>
        <TText variant="bodySmall" color="secondary" style={{ marginTop: 4, marginBottom: Spacing.sm }}>
          {counterpart} verra ce motif sur sa demande.
        </TText>
        <View accessibilityRole="radiogroup">
          {Object.entries(DECLINE_REASONS).map(([key, label]) => {
            const selected = selectedReason === key;
            return (
              <Pressable
                key={key}
                onPress={() => setSelectedReason(key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, selected }}
                style={styles.reasonRow}
              >
                <View style={[styles.radio, selected && styles.radioOn]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
                <TText variant="body" weight={selected ? 'medium' : 'regular'} style={{ flex: 1 }}>{label}</TText>
              </Pressable>
            );
          })}
        </View>
        {!!error && (
          <TText variant="caption" style={{ color: Colors.errorLight, marginTop: Spacing.xs }} accessibilityRole="alert">{error}</TText>
        )}
        <View style={styles.sheetActions}>
          <TButton
            title="Confirmer le refus"
            variant="destructive"
            onPress={handleDecline}
            loading={pending === 'declined'}
            disabled={!selectedReason || saving}
          />
          <TButton title="Annuler" variant="ghost" size="md" onPress={() => setShowDecline(false)} />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  body: {
    width: '100%', maxWidth: DOSSIER_MAX + Layout.gutter * 2, alignSelf: 'center',
    paddingHorizontal: Layout.gutter,
  },

  hero: { paddingTop: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.sm },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  section: {
    paddingVertical: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  sectionTitle: { marginBottom: Spacing.sm },
  guidance: { marginTop: Spacing.xs, maxWidth: Layout.maxReading },
  prose: { maxWidth: Layout.maxReading },

  fact: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle,
  },
  factLabel: { width: 112 },

  refGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  refTile: { width: 104, height: 130, borderRadius: Radius.sm },

  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingTop: 12, paddingHorizontal: Layout.gutter,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  barInner: { width: '100%', maxWidth: DOSSIER_MAX, alignSelf: 'center', gap: Spacing['2xs'] },
  barRow: { flexDirection: 'row', gap: Spacing['2xs'] },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 4 },

  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle,
  },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.textTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.error },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.error },
  sheetActions: { marginTop: Spacing.md, gap: Spacing['2xs'] },
});

