import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, LinearTransition, ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns/format';
import { isToday } from 'date-fns/isToday';
import { isYesterday } from 'date-fns/isYesterday';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { differenceInMinutes } from 'date-fns/differenceInMinutes';
import { fr } from 'date-fns/locale/fr';
import { Colors, Spacing, FontSize, Fonts } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton, Kicker, TextLink } from '@/components/v5';
import { RevealImage, EASE_OUT, EASE_IN_OUT } from '@/components/motion';
import { INQUIRY_LABEL, RequestStatusLine, formatBudget, projectTypeLabel } from '@/components/RequestCard';
import { useMessageStore, Message } from '@/store/message-store';
import { useRequestStore, type TattooRequest } from '@/store/request-store';
import { useAuthStore } from '@/store/auth-store';
import { AppointmentPanel } from '@/components/AppointmentPanel';

const THREAD_MAX = 760;
const MAX_LENGTH = 1000;
const GROUP_WINDOW_MIN = 5;

// Short, quiet arrival for a freshly appended bubble only (never on history).
const bubbleEnter = FadeInDown.duration(200)
  .easing(EASE_OUT)
  .reduceMotion(ReduceMotion.System);
const rowLayout = LinearTransition.duration(200).easing(EASE_IN_OUT).reduceMotion(ReduceMotion.System);

type Hover = { pressed: boolean; hovered?: boolean };

interface Row {
  msg: Message;
  dayLabel: string | null;
  lastInGroup: boolean;
  firstInGroup: boolean;
}

function dayLabelOf(d: Date): string {
  if (isToday(d)) return 'Aujourd’hui';
  if (isYesterday(d)) return 'Hier';
  return format(d, 'EEEE d MMMM', { locale: fr });
}

function buildRows(messages: Message[]): Row[] {
  return messages.map((msg, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const d = parseISO(msg.createdAt);
    const pd = prev ? parseISO(prev.createdAt) : null;
    const nd = next ? parseISO(next.createdAt) : null;
    const sameDayAsPrev = pd && isValid(pd) && isValid(d) && pd.toDateString() === d.toDateString();
    const joinsPrev = !!prev && prev.senderId === msg.senderId && prev.messageType !== 'system' && !!sameDayAsPrev
      && Math.abs(differenceInMinutes(d, pd as Date)) < GROUP_WINDOW_MIN;
    const joinsNext = !!next && next.senderId === msg.senderId && next.messageType !== 'system' && nd && isValid(nd)
      && nd.toDateString() === d.toDateString() && Math.abs(differenceInMinutes(nd, d)) < GROUP_WINDOW_MIN;
    return {
      msg,
      dayLabel: !sameDayAsPrev && isValid(d) ? dayLabelOf(d) : null,
      firstInGroup: !joinsPrev,
      lastInGroup: !joinsNext,
    };
  });
}

// ─── Pieces ───────────────────────────────────────────────────────────────────
function DaySeparator({ label }: { label: string }) {
  return (
    <View style={styles.daySep} accessibilityRole="header">
      <View style={styles.daySepLine} />
      <Kicker tone="muted">{label}</Kicker>
      <View style={styles.daySepLine} />
    </View>
  );
}

function Bubble({ row, isMe, maxWidth, animate, onRetry }: { row: Row; isMe: boolean; maxWidth: number; animate: boolean; onRetry: () => void }) {
  const { msg, firstInGroup, lastInGroup } = row;
  const d = parseISO(msg.createdAt);
  const time = isValid(d) ? format(d, 'HH:mm') : '';

  if (msg.messageType === 'system') {
    return (
      <Animated.View entering={animate ? bubbleEnter : undefined} style={styles.systemMsg}>
        <TText variant="caption" color="secondary" style={{ textAlign: 'center', maxWidth: 420 }}>{msg.content}</TText>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={animate ? bubbleEnter : undefined}
      style={[isMe ? styles.rowMe : styles.rowThem, { marginTop: firstInGroup ? 12 : 3 }]}
    >
      {msg.messageType === 'image' ? (
        <RevealImage
          uri={msg.content}
          style={[styles.imageBubble, !isMe && styles.imageThem, msg.pending && styles.pending]}
          accessibilityLabel={isMe ? 'Image envoyée' : 'Image reçue'}
        />
      ) : (
        <View style={[styles.bubble, { maxWidth }, isMe ? styles.bubbleMe : styles.bubbleThem, msg.pending && styles.pending]}>
          <TText variant="body" style={{ color: isMe ? Colors.onInk : Colors.ink, fontSize: 15, lineHeight: 23 }} selectable>
            {msg.content}
          </TText>
        </View>
      )}
      {(lastInGroup || msg.pending || msg.failed) && (
        <View style={[styles.meta, isMe ? { justifyContent: 'flex-end' } : null]}>
          {msg.failed ? (
            <Pressable style={styles.metaFailed} accessibilityRole="button" accessibilityLabel="Message non envoyé. Réessayer" onPress={onRetry}>
              <Ionicons name="alert-circle-outline" size={12} color={Colors.error} />
              <TText variant="micro" style={{ color: Colors.error }}>Non envoyé · Réessayer</TText>
            </Pressable>
          ) : msg.pending ? (
            <TText variant="micro" color="tertiary">Envoi…</TText>
          ) : (
            <TText variant="micro" color="tertiary" tabular>{time}</TText>
          )}
        </View>
      )}
    </Animated.View>
  );
}

function ThreadSkeleton() {
  return (
    <View style={{ gap: 10, paddingTop: Spacing.md }} accessibilityLabel="Chargement des messages">
      {[160, 220, 120, 240, 180].map((w, i) => (
        <View key={i} style={{ alignItems: i % 2 ? 'flex-end' : 'flex-start' }}>
          <TSkeleton width={w} height={i === 3 ? 58 : 40} />
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, gutter } = useContentDimensions();
  const reduced = useReducedMotion();
  const { user } = useAuthStore();
  const {
    fetchMessages, subscribeToRequest, unsubscribeFromRequest,
    sendMessage, retryMessage, markAsRead, messagesByRequest,
  } = useMessageStore();
  const { fetchRequest } = useRequestStore();

  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [baseline, setBaseline] = useState<Set<string> | null>(null);
  const [fetchedRequest, setFetchedRequest] = useState<{ viewerId: string; value: TattooRequest } | null>(null);
  const [requestLoading, setRequestLoading] = useState(true);
  const [requestError, setRequestError] = useState(false);
  const [requestAttempt, setRequestAttempt] = useState(0);
  const flatListRef = useRef<FlatList<Row>>(null);

  const messages = useMemo(() => messagesByRequest[id] ?? [], [messagesByRequest, id]);
  const rows = useMemo(() => buildRows(messages), [messages]);
  const request = fetchedRequest && fetchedRequest.viewerId === user?.id && fetchedRequest.value.id === id
    ? fetchedRequest.value : null;

  useEffect(() => {
    setText(''); setFetchedRequest(null); setLoaded(false); setBaseline(null);
  }, [id, user?.id]);

  useEffect(() => {
    if (!request?.id || !user?.id) return;
    let active = true;
    fetchMessages(id).finally(() => { if (active) setLoaded(true); });
    subscribeToRequest(id);
    if (user?.id) markAsRead(id, user.id);
    return () => {
      active = false;
      unsubscribeFromRequest();
    };
  }, [id, request?.id, user?.id, fetchMessages, subscribeToRequest, unsubscribeFromRequest, markAsRead]);

  // Authorize the dossier before loading messages, subscribing, or showing the composer.
  useEffect(() => {
    setFetchedRequest(null); setRequestError(false); setRequestLoading(true);
    if (!id || !user?.id) { setRequestLoading(false); return; }
    let active = true;
    fetchRequest(id, user.id)
      .then((r) => { if (active && r) setFetchedRequest({ viewerId: user.id, value: r }); })
      .catch(() => { if (active) setRequestError(true); })
      .finally(() => { if (active) setRequestLoading(false); });
    return () => { active = false; };
  }, [id, user?.id, fetchRequest, requestAttempt]);

  // History never animates: remember what was already there when the thread opened.
  useEffect(() => {
    if (loaded && baseline === null) setBaseline(new Set(messages.map((m) => m.id)));
  }, [loaded, baseline, messages]);

  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: !reduced }), 80);
    return () => clearTimeout(t);
  }, [messages.length, reduced]);

  const handleSend = useCallback(async () => {
    if (!request || !text.trim() || !user?.id || isSending) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const content = text.trim();
    setText('');
    setIsSending(true);
    await sendMessage(id, user.id, content);
    setIsSending(false);
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [text, user?.id, id, isSending, sendMessage, request]);

  // Web: Enter sends, Shift+Enter adds a line.
  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (Platform.OS !== 'web') return;
    const ev = e.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean };
    if (ev.key === 'Enter' && !ev.shiftKey) {
      (e as unknown as { preventDefault?: () => void }).preventDefault?.();
      void handleSend();
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/inbox'));

  // Same rule as the request page: whoever is not the client of this request is its artist.
  const isArtist = !!request && request.clientId !== user?.id;
  const counterpart = request ? ((isArtist ? request.clientName : request.artistName) ?? '') : '';
  // A question has placeholder project fields: the header only says what it is.
  const inquiry = !!request?.isInquiry;
  const summary = !request
    ? ''
    : inquiry
      ? INQUIRY_LABEL
      : [projectTypeLabel(request.projectType), request.bodyZone, request.sizeCategory?.toUpperCase(), formatBudget(request)].filter(Boolean).join(' · ');
  const detailsLabel = inquiry ? 'Voir la question' : 'Voir la demande';
  const bubbleMax = Math.min(width * 0.78, 520);
  const canSend = !!request && !!text.trim() && !isSending;

  const renderRow = useCallback(({ item }: { item: Row }) => {
    const isMe = item.msg.senderId === user?.id;
    const animate = !!baseline && !baseline.has(item.msg.id)
      && (item.msg.pending || !isMe);
    return (
      <View>
        {item.dayLabel && <DaySeparator label={item.dayLabel} />}
        <Bubble row={item} isMe={isMe} maxWidth={bubbleMax} animate={animate}
          onRetry={() => { if (isMe) void retryMessage(id, item.msg.id); }} />
      </View>
    );
  }, [user?.id, baseline, bubbleMax, retryMessage, id]);

  if (!request) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingHorizontal: gutter }]}>
          <IconButton icon="arrow-back" label="Retour" onPress={goBack} />
        </View>
        {requestLoading ? <ThreadSkeleton /> : (
          <EmptyState
            icon={user ? 'lock-closed-outline' : 'person-outline'}
            title={requestError ? 'Conversation indisponible' : user ? 'Conversation introuvable' : 'Connectez-vous'}
            description={requestError
              ? 'Le chargement a échoué. Vérifiez votre connexion puis réessayez.'
              : 'Cette conversation est réservée au client et à l’artiste concernés.'}
            ctaLabel={requestError ? 'Réessayer' : user ? 'Mes demandes' : 'Se connecter'}
            onCta={requestError
              ? () => setRequestAttempt((n) => n + 1)
              : () => router.replace(user ? '/(tabs)/inbox' : '/(auth)/sign-in')}
          />
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <View style={styles.headerInner}>
          <IconButton icon="arrow-back" label="Retour" onPress={goBack} />
          <View style={styles.headerCenter}>
            <TText variant="displayS" numberOfLines={1} style={styles.headerName} accessibilityRole="header">
              {counterpart || 'Conversation'}
            </TText>
            {!!summary && <TText variant="caption" color="tertiary" numberOfLines={1} tabular>{summary}</TText>}
          </View>
          <IconButton icon="document-text-outline" label={detailsLabel} onPress={() => router.push(`/request/${id}`)} />
        </View>
        {request && (
          <View style={styles.contextRow}>
            <RequestStatusLine status={request.status} viewAs={isArtist ? 'artist' : 'client'} inquiry={inquiry} />
            <View style={styles.contextLinks}>
              {inquiry && !isArtist && (
                <TextLink
                  label="Transformer en projet"
                  onPress={() => router.push(`/request/new?artistId=${request.artistId}`)}
                  accessibilityLabel={`Transformer en projet : décrire un projet à ${counterpart || 'l’artiste'}`}
                />
              )}
              <TextLink label={detailsLabel} onPress={() => router.push(`/request/${id}`)} />
            </View>
          </View>
        )}
        {request && !inquiry && ['accepted', 'confirmed', 'completed'].includes(request.status) && (
          <View style={styles.appointmentSlot}>
            <AppointmentPanel
              compact
              requestId={request.id}
              requestStatus={request.status}
              viewAs={isArtist ? 'artist' : 'client'}
              counterpart={counterpart}
              onChanged={() => { if (user) void fetchRequest(id, user.id); }}
            />
          </View>
        )}
      </View>

      {/* ── Thread ── */}
      <Animated.FlatList
        ref={flatListRef}
        data={rows}
        keyExtractor={(item) => item.msg.id}
        renderItem={renderRow}
        itemLayoutAnimation={reduced ? undefined : rowLayout}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }, rows.length === 0 && { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          !loaded ? <ThreadSkeleton /> : (
            <EmptyState
              icon="chatbubbles-outline"
              title="Commencez l’échange"
              description={
                inquiry
                  ? isArtist
                    ? `Répondez à la question de ${counterpart || 'votre client'}.`
                    : `Posez votre question${counterpart ? ` à ${counterpart}` : ''}.`
                  : isArtist
                    ? `Écrivez à ${counterpart || 'votre client'} pour préciser le projet et convenir d’un rendez-vous.`
                    : `Présentez-vous et précisez votre projet${counterpart ? ` à ${counterpart}` : ''}.`
              }
            />
          )
        }
      />

      {/* ── Composer: a ruled bar, square controls ── */}
      <View style={[styles.composer, { paddingBottom: insets.bottom + 10, paddingHorizontal: gutter }]}>
        <View style={styles.composerInner}>
          <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              onKeyPress={handleKeyPress}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={counterpart ? `Écrire à ${counterpart}` : 'Écrire un message'}
              placeholderTextColor={Colors.textTertiary}
              selectionColor={Colors.flame}
              multiline
              maxLength={MAX_LENGTH}
              accessibilityLabel="Message"
            />
          </View>

          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Envoyer le message"
            accessibilityState={{ disabled: !canSend, busy: isSending }}
            style={(state) => [
              styles.squareBtn,
              styles.sendBtn,
              ((state as Hover).hovered || state.pressed) && canSend && styles.sendActive,
              !canSend && styles.sendBtnDisabled,
            ]}
          >
            {isSending
              ? <ActivityIndicator size="small" color={Colors.paper} />
              : <Ionicons name="arrow-up" size={18} color={Colors.paper} />}
          </Pressable>
        </View>
        {text.length > MAX_LENGTH - 100 && (
          <TText variant="micro" color="tertiary" tabular style={styles.counter}>{text.length} / {MAX_LENGTH}</TText>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const webPointer = Platform.OS === 'web'
  ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '180ms' } as object)
  : null;

const styles = StyleSheet.create({
  appointmentSlot: { marginTop: 10, width: '100%', maxWidth: THREAD_MAX, alignSelf: 'center' },
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    paddingTop: 8,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    width: '100%', maxWidth: THREAD_MAX, alignSelf: 'center',
  },
  headerCenter: { flex: 1, minWidth: 0, alignItems: 'center' },
  headerName: { fontSize: 24, lineHeight: 26, letterSpacing: -0.4 },
  contextRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
    columnGap: Spacing.sm, rowGap: 4,
    width: '100%', maxWidth: THREAD_MAX, alignSelf: 'center',
    paddingTop: Spacing['2xs'],
  },
  contextLinks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: Spacing.md },

  list: {
    width: '100%', maxWidth: THREAD_MAX, alignSelf: 'center',
    paddingTop: Spacing.xs, paddingBottom: Spacing.md,
  },

  daySep: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.lg, marginBottom: Spacing['2xs'] },
  daySepLine: { flex: 1, height: 1, backgroundColor: Colors.line },

  systemMsg: { alignItems: 'center', marginVertical: Spacing.sm, paddingHorizontal: Spacing.lg },

  rowMe: { alignItems: 'flex-end' },
  rowThem: { alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 16, paddingVertical: 11 },
  bubbleMe: { backgroundColor: Colors.inkPanel },
  bubbleThem: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line },
  pending: { opacity: 0.55 },
  imageBubble: { width: 220, height: 220 },
  imageThem: { borderWidth: 1, borderColor: Colors.line },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaFailed: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  composer: {
    paddingTop: 10,
    backgroundColor: Colors.paper,
    borderTopWidth: 1, borderTopColor: Colors.ink,
  },
  composerInner: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing['2xs'],
    width: '100%', maxWidth: THREAD_MAX, alignSelf: 'center',
  },
  squareBtn: {
    width: 46, height: 46,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    ...webPointer,
  },
  inputWrap: {
    flex: 1, minHeight: 46, justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.line,
    paddingHorizontal: 14,
  },
  inputWrapFocused: { borderColor: Colors.ink },
  input: {
    maxHeight: 140, paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    color: Colors.ink, fontFamily: Fonts.sans, fontSize: FontSize.body,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : null),
  },
  sendBtn: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  sendActive: { backgroundColor: Colors.flame, borderColor: Colors.flame },
  sendBtnDisabled: { opacity: 0.38 },
  counter: { textAlign: 'right', width: '100%', maxWidth: THREAD_MAX, alignSelf: 'center', marginTop: 4 },
});
