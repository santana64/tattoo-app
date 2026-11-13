import React, { useState, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns/format';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { fr } from 'date-fns/locale/fr';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TButton } from '@/components/ui/TButton';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { DetailRow, InkPanel, Kicker, Masthead, PageWrap } from '@/components/v5';
import { styleName } from '@/components/ArtistCard';
import {
  RequestStatusLine, StatusTimeline, SIZE_RANGE, COLOR_LABEL, FLEX_LABEL,
  formatBudget, projectTypeLabel, type TimelineStep, type RequestViewer,
} from '@/components/RequestCard';
import { BottomSheet, GlassSurface, RevealImage } from '@/components/motion';
import { useRequestStore, type TattooRequest, type RequestStatus } from '@/store/request-store';
import { AppointmentPanel, formatPreferredSlot, upcomingPreferredSlots } from '@/components/AppointmentPanel';
import { useAuthStore } from '@/store/auth-store';
import { useContentDimensions } from '@/hooks/useContentDimensions';
// Decline reason keys are persisted values; this taxonomy (not fixture data) maps them to labels.
import { DECLINE_REASONS } from '@/constants/tattoo';
import { attachReference, pickImage, removeReference, signedRequestReferences, type SignedRequestReference } from '@/lib/storage';

const ASIDE_W = 380;
const BAR_MAX = 760;

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
      return [sent, { key: 'reply', label: reply, detail: 'En attente', state: 'current' }, appointment, session];
    case 'clarification_needed':
      return [sent, {
        key: 'reply', label: 'Précision demandée',
        detail: viewAs === 'artist' ? 'En attente du client' : 'L’artiste attend des précisions',
        state: 'current',
      }, appointment, session];
    case 'accepted':
      return [sent, accepted, { ...appointment, detail: 'À convenir avec l’artiste', state: 'current' }, session];
    case 'confirmed':
      return [sent, accepted, { ...appointment, label: 'Rendez-vous confirmé', state: 'current' }, session];
    case 'completed':
      return [sent, accepted, { ...appointment, label: 'Rendez-vous confirmé', state: 'done' }, { ...session, state: 'done' }];
    case 'declined':
      return [sent, {
        key: 'declined', label: 'Demande refusée',
        detail: r.declineReason ? DECLINE_REASONS[r.declineReason] ?? r.declineReason : undefined,
        state: 'ended',
      }];
    case 'archived':
    default:
      return [sent, { key: 'archived', label: 'Demande archivée', state: 'ended' }];
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
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Kicker tone="flame" style={styles.sectionTitle}>{title}</Kicker>
      {children}
    </View>
  );
}

function DossierSkeleton() {
  return (
    <PageWrap style={{ gap: 12, paddingTop: Spacing.xl }}>
      <TSkeleton width="30%" height={11} />
      <TSkeleton width="70%" height={44} />
      <TSkeleton width="45%" height={14} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: Spacing.lg }}>
        <TSkeleton width={64} height={64} />
        <View style={{ flex: 1, gap: 8 }}>
          <TSkeleton width="50%" height={24} />
          <TSkeleton width="30%" height={12} />
        </View>
      </View>
      <TSkeleton height={180} style={{ marginTop: Spacing.lg }} />
    </PageWrap>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isWide, gutter } = useContentDimensions();
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
  const [signedReferences, setSignedReferences] = useState<SignedRequestReference[]>([]);
  const [referencesError, setReferencesError] = useState(false);
  const [referencesLoading, setReferencesLoading] = useState(true);
  const [referenceActionError, setReferenceActionError] = useState<string | null>(null);
  const [referenceBusy, setReferenceBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setRequest(null); setLoading(true); setError(null);
    if (!user) { setLoading(false); return; }
    fetchRequest(id, user.id).then((data) => { if (active) setRequest(data); })
      .catch(() => { if (active) setError('Impossible de charger la demande.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, user, attempt, fetchRequest]);

  useEffect(() => {
    let active = true;
    setSignedReferences([]);
    setReferencesError(false);
    setReferencesLoading(true);
    if (!request?.id) return;
    const refresh = () => signedRequestReferences(request.id)
      .then((items) => { if (active) { setSignedReferences(items); setReferencesError(false); setReferencesLoading(false); } })
      .catch(() => { if (active) { setReferencesError(true); setReferencesLoading(false); } });
    void refresh();
    // Signed links expire after five minutes; keep a long-open dossier usable.
    const interval = setInterval(() => { void refresh(); }, 4 * 60 * 1000);
    return () => { active = false; clearInterval(interval); };
  }, [request?.id, attempt]);

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

  // RLS only returns a request to its client or its artist, and fetchRequest checks
  // artist ownership: not being the client therefore means being the artist.
  // (Comparing user.artistId alone breaks when the cached profile lags behind.)
  const isArtist = request.clientId !== user?.id;
  const viewAs: RequestViewer = isArtist ? 'artist' : 'client';
  const counterpart = (isArtist ? request.clientName : request.artistName) ?? '';
  const counterpartAvatar = isArtist ? request.clientAvatarUrl : request.artistAvatarUrl;
  // A question (no project) is answered in the conversation: no accept/decline, no booking.
  const inquiry = request.isInquiry;
  const inquiryOpen = inquiry && request.status !== 'archived' && request.status !== 'declined';
  const canAnswer = !inquiry && isArtist && (request.status === 'submitted' || request.status === 'clarification_needed');
  const canChat = inquiry ? inquiryOpen : ['accepted', 'confirmed', 'completed'].includes(request.status);
  const hasBar = canAnswer || canChat;
  const guidance = inquiry
    ? isArtist
      ? `${counterpart || 'Ce client'} vous pose une question, sans projet pour l’instant. Répondez-lui dans la conversation.`
      : `${counterpart || 'L’artiste'} vous répondra dans la conversation. Prêt à aller plus loin ? Transformez votre question en projet.`
    : nextStepCopy(request, viewAs, counterpart);
  const styles_ = request.stylePreference?.split(',').map((s) => styleName(s.trim())).filter(Boolean).join(', ');
  const references: { path: string | null; url: string }[] = [
    ...(request.references ?? []).filter((url) => /^https:\/\//.test(url)).map((url) => ({ path: null, url })),
    ...signedReferences,
  ];
  const usedReferenceSlots = signedReferences.map((item) => Number(item.path.match(/ref_([0-2])\.jpg$/)?.[1])).filter(Number.isInteger);
  const freeReferenceSlots = [0, 1, 2].filter((index) => !usedReferenceSlots.includes(index));

  const handleAddReferences = async () => {
    if (referenceBusy || referencesLoading || referencesError || isArtist || !freeReferenceSlots.length) return;
    setReferenceBusy(true); setReferenceActionError(null);
    try {
      const picked = await pickImage({ multiple: true });
      for (const [i, uri] of (picked ?? []).slice(0, freeReferenceSlots.length).entries()) {
        await attachReference(uri, request.id, freeReferenceSlots[i]);
      }
    } catch {
      setReferenceActionError('Certaines images n’ont pas été ajoutées. Réessayez.');
    } finally {
      setReferenceBusy(false);
      setAttempt((value) => value + 1);
    }
  };

  const handleRemoveReference = async (path: string) => {
    if (referenceBusy || isArtist) return;
    setReferenceBusy(true); setReferenceActionError(null);
    try {
      await removeReference(request.id, path);
    } catch {
      setReferenceActionError('Impossible de retirer cette image pour le moment.');
    } finally {
      setReferenceBusy(false);
      setAttempt((value) => value + 1);
    }
  };
  const submitted = formatLong(request.submittedAt);
  const awaitingAnswer = !inquiry && (request.status === 'submitted' || request.status === 'clarification_needed');
  const wishedSlots = upcomingPreferredSlots(request.preferredSlots);

  const kicker = `${inquiry ? (isArtist ? 'Question reçue' : 'Votre question') : isArtist ? 'Demande reçue' : 'Votre demande'}${submitted ? ` · ${submitted}` : ''}`;
  const zone = request.bodyZone?.trim();
  const title = inquiry ? 'Une question' : projectTypeLabel(request.projectType);
  const emphasis = inquiry
    ? `${isArtist ? 'de' : 'à'} ${counterpart || (isArtist ? 'votre client' : 'l’artiste')}.`
    : zone ? `${zone.toLowerCase()}.` : undefined;

  // ── The cartel: who, where it stands, and the brief ──
  const identity = (onInk: boolean) => (
    <View style={styles.identity}>
      <TAvatar uri={counterpartAvatar} name={counterpart} size={onInk ? 'xl' : 'lg'} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Kicker tone={onInk ? 'onInkMuted' : 'muted'}>{isArtist ? 'Client' : 'Artiste'}</Kicker>
        <TText variant="displayS" numberOfLines={2} style={[styles.name, { color: onInk ? Colors.onInk : Colors.ink }]}>
          {counterpart}
        </TText>
        <TText variant="caption" style={{ color: onInk ? Colors.onInkMuted : Colors.textSecondary }}>
          {isArtist ? (request.isFirstTattoo ? 'Client · premier tatouage' : 'Client') : request.artistCity || 'Artiste'}
        </TText>
      </View>
    </View>
  );

  const brief = (onInk: boolean) => (
    <View>
      <DetailRow onInk={onInk} label="Type" value={projectTypeLabel(request.projectType)} />
      <DetailRow onInk={onInk} label="Zone" value={request.bodyZone || '—'} />
      <DetailRow onInk={onInk} label="Taille" value={`${request.sizeCategory.toUpperCase()} · ${SIZE_RANGE[request.sizeCategory] ?? ''}`} />
      <DetailRow onInk={onInk} label="Budget" value={formatBudget(request)} />
      <DetailRow onInk={onInk} label="Couleur" value={COLOR_LABEL[request.colorPreference] ?? request.colorPreference} />
      {!!styles_ && <DetailRow onInk={onInk} label="Styles" value={styles_} />}
      <DetailRow
        onInk={onInk}
        label="Approche"
        value={FLEX_LABEL[request.flexibilityLevel] ?? request.flexibilityLevel}
        last={!(!isArtist && request.isFirstTattoo)}
      />
      {!isArtist && request.isFirstTattoo && <DetailRow onInk={onInk} label="Premier tatouage" value="Oui" last />}
    </View>
  );

  const main = (
    <View style={styles.main}>
      {/* Phone: the counterpart opens the dossier, the status right under. */}
      {!isWide && (
        <View style={styles.phoneIdentity}>
          {identity(false)}
          <RequestStatusLine status={request.status} viewAs={viewAs} inquiry={inquiry} />
        </View>
      )}

      {/* ── A question: the conversation is the whole story ── */}
      {inquiry && (
        <Section title="Échange">
          <TText variant="bodySmall" color="secondary" style={styles.prose}>{guidance}</TText>
        </Section>
      )}

      {/* ── Status timeline ── */}
      {!inquiry && (
        <Section title="Suivi">
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
                preferredSlots={request.preferredSlots}
              />
            </View>
          )}
        </Section>
      )}

      {/* Before acceptance the booking panel is hidden: keep the wished slots in view. */}
      {awaitingAnswer && wishedSlots.length > 0 && (
        <Section title={isArtist ? 'Créneaux souhaités' : 'Vos créneaux souhaités'}>
          {wishedSlots.map((iso, i) => (
            <View key={iso} style={[styles.slotRow, i === wishedSlots.length - 1 && styles.slotRowLast]}>
              <TText variant="caption" tabular color="tertiary" style={styles.slotIndex}>{String(i + 1).padStart(2, '0')}</TText>
              <TText variant="bodySmall" weight="medium" tabular style={{ flex: 1 }}>{formatPreferredSlot(iso)}</TText>
            </View>
          ))}
          <TText variant="caption" color="tertiary" style={{ marginTop: Spacing.xs }}>
            {isArtist
              ? 'Une fois la demande acceptée, proposez l’un de ces créneaux en un geste.'
              : `${counterpart} confirmera l’un d’eux ou vous en proposera un autre.`}
          </TText>
        </Section>
      )}

      {!!request.artistNotes && (
        <Section title="Note de l’artiste">
          <TText variant="body" color="secondary" style={styles.prose}>{request.artistNotes}</TText>
        </Section>
      )}

      {/* ── Project (a question has none: its fields are placeholders). On wide, it is the ink cartel. ── */}
      {!inquiry && !isWide && <Section title="Le projet">{brief(false)}</Section>}

      {!!request.description && (
        <Section title={inquiry ? 'Premier message' : 'Description'}>
          <TText variant="body" color="secondary" style={styles.prose} selectable>{request.description}</TText>
        </Section>
      )}

      {(references.length > 0 || (!isArtist && !inquiry)) && (
        <Section title="Références">
          <View style={styles.refGrid}>
            {references.map((item, i) => (
              <View key={item.path ?? item.url} style={{ gap: Spacing.xs }}>
                <RevealImage uri={item.url} style={styles.refTile} accessibilityLabel={`Image de référence ${i + 1}`} />
                {!isArtist && item.path && (
                  <Pressable disabled={referenceBusy} accessibilityRole="button" accessibilityLabel={`Retirer la référence ${i + 1}`} onPress={() => { if (item.path) void handleRemoveReference(item.path); }}>
                    <TText variant="caption" color="error">Retirer</TText>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
          {!isArtist && !inquiry && !referencesLoading && !referencesError && freeReferenceSlots.length > 0 && (
            <TButton title="Ajouter une référence" variant="secondary" loading={referenceBusy} onPress={handleAddReferences} />
          )}
          {!!referenceActionError && <TText variant="caption" color="error" accessibilityRole="alert">{referenceActionError}</TText>}
        </Section>
      )}
      {referencesError && (
        <Section title="Références">
          <TText variant="bodySmall" color="secondary">Impossible de charger les images pour le moment.</TText>
          <TButton title="Réessayer" variant="secondary" onPress={() => setAttempt((value) => value + 1)} />
        </Section>
      )}

      {request.status === 'declined' && !!request.declineReason && (
        <Section title="Motif du refus">
          <TText variant="body" color="secondary">{DECLINE_REASONS[request.declineReason] ?? request.declineReason}</TText>
        </Section>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <THeader showBack title={inquiry ? 'Question' : 'Demande'} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + (hasBar ? 190 : Spacing['2xl']) }}
        showsVerticalScrollIndicator={false}
      >
        <PageWrap>
          <Masthead
            kicker={kicker}
            title={title}
            emphasis={emphasis}
            description={isWide ? guidance ?? undefined : undefined}
            action={isWide ? <RequestStatusLine status={request.status} viewAs={viewAs} inquiry={inquiry} /> : undefined}
          />

          {isWide ? (
            <View style={styles.wide}>
              {main}
              <InkPanel style={styles.aside}>
                {identity(true)}
                <View style={styles.asideStatus}>
                  <RequestStatusLine status={request.status} viewAs={viewAs} inquiry={inquiry} onInk />
                </View>
                {!inquiry && (
                  <>
                    <Kicker tone="flameOnInk" style={styles.asideKicker}>Le brief</Kicker>
                    {brief(true)}
                  </>
                )}
              </InkPanel>
            </View>
          ) : main}
        </PageWrap>
      </ScrollView>

      {/* ── Pinned actions ── */}
      {hasBar && !showDecline && (
        <GlassSurface style={[styles.bar, { paddingBottom: insets.bottom + 12, paddingHorizontal: gutter }]}>
          <View style={styles.barInner}>
            {!!error && (
              <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
                <TText variant="caption" style={{ color: Colors.error, flex: 1 }}>{error}</TText>
              </View>
            )}
            {inquiry ? (
              <>
                <TButton
                  title={isArtist ? 'Répondre' : 'Ouvrir la conversation'}
                  onPress={() => router.push(`/conversation/${request.id}`)}
                  icon={<Ionicons name="chatbubble-outline" size={16} color={Colors.paper} />}
                />
                {!isArtist && (
                  <TButton
                    title="Transformer en projet"
                    variant="secondary"
                    size="md"
                    onPress={() => router.push(`/request/new?artistId=${request.artistId}`)}
                    accessibilityLabel={`Transformer en projet : décrire un projet à ${counterpart}`}
                  />
                )}
              </>
            ) : canAnswer ? (
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
                icon={<Ionicons name="chatbubble-outline" size={16} color={Colors.paper} />}
              />
            )}
          </View>
        </GlassSurface>
      )}

      {/* ── Decline reasons ── */}
      <BottomSheet visible={showDecline} onClose={() => setShowDecline(false)} accessibilityLabel="Motif du refus">
        <Kicker tone="flame">Refuser la demande</Kicker>
        <TText variant="displayS" style={{ marginTop: 8 }}>Motif du refus</TText>
        <TText variant="bodySmall" color="secondary" style={{ marginTop: 4, marginBottom: Spacing.sm }}>
          {counterpart} verra ce motif sur sa demande.
        </TText>
        <View accessibilityRole="radiogroup" style={styles.reasons}>
          {Object.entries(DECLINE_REASONS).map(([key, label]) => {
            const selected = selectedReason === key;
            return (
              <Pressable
                key={key}
                onPress={() => setSelectedReason(key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, selected }}
                style={(state) => [
                  styles.reasonRow,
                  ((state as { hovered?: boolean }).hovered || state.pressed) && { backgroundColor: Colors.wash },
                ]}
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
          <TText variant="caption" style={{ color: Colors.error, marginTop: Spacing.xs }} accessibilityRole="alert">{error}</TText>
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

  wide: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing['2xl'] },
  main: { flex: 1, minWidth: 0 },
  aside: { width: ASIDE_W },
  asideStatus: { marginTop: Spacing.md, marginBottom: Spacing.lg },
  asideKicker: { marginBottom: Spacing.xs },

  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { fontSize: 30, lineHeight: 31, letterSpacing: -0.6 },
  phoneIdentity: { gap: Spacing.sm, paddingBottom: Spacing.lg },

  section: {
    paddingTop: Spacing.lg, paddingBottom: Spacing.xl,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  sectionTitle: { marginBottom: Spacing.md },
  guidance: { marginTop: Spacing.xs, maxWidth: Layout.maxReading },
  prose: { maxWidth: Layout.maxReading },

  slotRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 44,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  slotRowLast: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  slotIndex: { width: 22 },

  refGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  refTile: { width: 104, height: 130 },

  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  barInner: { width: '100%', maxWidth: BAR_MAX, alignSelf: 'center', gap: Spacing['2xs'] },
  barRow: { flexDirection: 'row', gap: Spacing['2xs'] },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 4 },

  reasons: { borderTopWidth: 1, borderTopColor: Colors.line },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    minHeight: 48, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  radio: {
    width: 20, height: 20, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.error },
  radioDot: { width: 10, height: 10, borderRadius: Radius.full, backgroundColor: Colors.error },
  sheetActions: { marginTop: Spacing.md, gap: Spacing['2xs'] },
});
