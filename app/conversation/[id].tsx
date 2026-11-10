import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform,
  ActivityIndicator, useWindowDimensions,
  type NativeSyntheticEvent, type TextInputKeyPressEventData,
} from 'react-native';
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
import { Colors, Spacing, Radius, FontSize, Fonts, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { GlassSurface, RevealImage, EASE_OUT, EASE_IN_OUT } from '@/components/motion';
import { RequestStatusLine, formatBudget, projectTypeLabel } from '@/components/RequestCard';
import { useMessageStore, Message } from '@/store/message-store';
import { useRequestStore, type TattooRequest } from '@/store/request-store';
import { useAuthStore } from '@/store/auth-store';
import { pickImage, uploadFile } from '@/lib/storage';
import { AppointmentPanel } from '@/components/AppointmentPanel';

const THREAD_MAX = 720;
const MAX_LENGTH = 1000;
const GROUP_WINDOW_MIN = 5;

// Short, quiet arrival for a freshly appended bubble only (never on history).
const bubbleEnter = FadeInDown.duration(200)
  .easing(EASE_OUT)
  .reduceMotion(ReduceMotion.System);
const rowLayout = LinearTransition.duration(200).easing(EASE_IN_OUT).reduceMotion(ReduceMotion.System);

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
      <TText variant="caption" color="tertiary" style={{ textTransform: 'capitalize' }}>{label}</TText>
      <View style={styles.daySepLine} />
    </View>
  );
}

function Bubble({ row, isMe, maxWidth, animate }: { row: Row; isMe: boolean; maxWidth: number; animate: boolean }) {
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

  // Sender-side corners tighten inside a group; the first bubble keeps a soft top corner.
  const corner = isMe
    ? { borderTopRightRadius: firstInGroup ? 18 : 6, borderBottomRightRadius: 6 }
    : { borderTopLeftRadius: firstInGroup ? 18 : 6, borderBottomLeftRadius: 6 };

  return (
    <Animated.View
      entering={animate ? bubbleEnter : undefined}
      style={[styles.bubbleRow, isMe ? styles.rowMe : styles.rowThem, { marginTop: firstInGroup ? 10 : 2 }]}
    >
      {msg.messageType === 'image' ? (
        <RevealImage
          uri={msg.content}
          style={[styles.imageBubble, corner, msg.pending && styles.pending]}
          accessibilityLabel={isMe ? 'Image envoyée' : 'Image reçue'}
        />
      ) : (
        <View style={[styles.bubble, { maxWidth }, isMe ? styles.bubbleMe : styles.bubbleThem, corner, msg.pending && styles.pending]}>
          <TText variant="body" style={{ color: isMe ? Colors.textInverse : Colors.textPrimary, fontSize: 15, lineHeight: 22 }} selectable>
            {msg.content}
          </TText>
        </View>
      )}
      {(lastInGroup || msg.pending || msg.failed) && (
        <View style={[styles.meta, isMe ? { justifyContent: 'flex-end' } : null]}>
          {msg.failed ? (
            <View style={styles.metaFailed} accessibilityRole="alert">
              <Ionicons name="alert-circle-outline" size={12} color={Colors.errorLight} />
              <TText variant="micro" style={{ color: Colors.errorLight }}>Non envoyé</TText>
            </View>
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
          <TSkeleton width={w} height={i === 3 ? 58 : 38} radius={16} />
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
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { user } = useAuthStore();
  const {
    fetchMessages, subscribeToRequest, unsubscribeFromRequest,
    sendMessage, markAsRead, messagesByRequest,
  } = useMessageStore();
  const { getRequest, fetchRequest } = useRequestStore();

  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [baseline, setBaseline] = useState<Set<string> | null>(null);
  const [fetchedRequest, setFetchedRequest] = useState<TattooRequest | null>(null);
  const flatListRef = useRef<FlatList<Row>>(null);

  const messages = useMemo(() => messagesByRequest[id] ?? [], [messagesByRequest, id]);
  const rows = useMemo(() => buildRows(messages), [messages]);
  const request = getRequest(id) ?? fetchedRequest;

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchMessages(id).finally(() => { if (active) setLoaded(true); });
    subscribeToRequest(id);
    if (user?.id) markAsRead(id, user.id);
    return () => {
      active = false;
      unsubscribeFromRequest();
    };
  }, [id, user?.id, fetchMessages, subscribeToRequest, unsubscribeFromRequest, markAsRead]);

  // Context for the header when the thread is opened directly (deep link, notification).
  useEffect(() => {
    if (!id || !user?.id || getRequest(id)) return;
    let active = true;
    fetchRequest(id, user.id).then((r) => { if (active) setFetchedRequest(r); }).catch(() => {});
    return () => { active = false; };
  }, [id, user?.id, getRequest, fetchRequest]);

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
    if (!text.trim() || !user?.id || isSending) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const content = text.trim();
    setText('');
    setIsSending(true);
    await sendMessage(id, user.id, content);
    setIsSending(false);
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [text, user?.id, id, isSending, sendMessage]);

  const handleImageSend = async () => {
    const uris = await pickImage();
    if (!uris?.[0] || !user?.id) return;
    setIsUploading(true);
    try {
      const { url } = await uploadFile(uris[0], 'posts-media', `conv/${id}/${Date.now()}.jpg`);
      await sendMessage(id, user.id, url, 'image');
    } catch {
      Toast.error('Image non envoyée. Vérifiez votre connexion puis réessayez.');
    } finally {
      setIsUploading(false);
    }
  };

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
  const summary = request
    ? [projectTypeLabel(request.projectType), request.bodyZone, request.sizeCategory?.toUpperCase(), formatBudget(request)].filter(Boolean).join(' · ')
    : '';
  const bubbleMax = Math.min(width * 0.78, 520);
  const canSend = !!text.trim() && !isSending;

  const renderRow = useCallback(({ item }: { item: Row }) => {
    const isMe = item.msg.senderId === user?.id;
    const animate = !!baseline && !baseline.has(item.msg.id)
      && (item.msg.id.startsWith('optimistic-') || !isMe);
    return (
      <View>
        {item.dayLabel && <DaySeparator label={item.dayLabel} />}
        <Bubble row={item} isMe={isMe} maxWidth={bubbleMax} animate={animate} />
      </View>
    );
  }, [user?.id, baseline, bubbleMax]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={6} style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.6 }]}>
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <TText variant="title2" serif numberOfLines={1} style={{ fontSize: 20, lineHeight: 24 }} accessibilityRole="header">
              {counterpart || 'Conversation'}
            </TText>
            {!!summary && <TText variant="caption" color="tertiary" numberOfLines={1} tabular>{summary}</TText>}
          </View>
          <Pressable
            onPress={() => router.push(`/request/${id}`)}
            accessibilityRole="button"
            accessibilityLabel="Voir la demande"
            hitSlop={6}
            style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="document-text-outline" size={18} color={Colors.textPrimary} />
          </Pressable>
        </View>
        {request && (
          <View style={styles.contextRow}>
            <RequestStatusLine status={request.status} viewAs={isArtist ? 'artist' : 'client'} />
            <Pressable onPress={() => router.push(`/request/${id}`)} accessibilityRole="link" hitSlop={8} style={styles.contextLink}>
              <TText variant="caption" color="secondary" style={{ textDecorationLine: 'underline' }}>Voir la demande</TText>
            </Pressable>
          </View>
        )}
        {request && ['accepted', 'confirmed', 'completed'].includes(request.status) && (
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
        contentContainerStyle={[styles.list, rows.length === 0 && { flexGrow: 1 }]}
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
                isArtist
                  ? `Écrivez à ${counterpart || 'votre client'} pour préciser le projet et convenir d’un rendez-vous.`
                  : `Présentez-vous et précisez votre projet${counterpart ? ` à ${counterpart}` : ''}.`
              }
            />
          )
        }
      />

      {/* ── Composer ── */}
      <GlassSurface style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.composerInner}>
          <Pressable
            onPress={handleImageSend}
            disabled={isUploading}
            accessibilityRole="button"
            accessibilityLabel="Envoyer une image"
            accessibilityState={{ disabled: isUploading, busy: isUploading }}
            hitSlop={4}
            style={({ pressed }) => [styles.attachBtn, pressed && { opacity: 0.6 }]}
          >
            {isUploading
              ? <ActivityIndicator size="small" color={Colors.textSecondary} />
              : <Ionicons name="image-outline" size={20} color={Colors.textSecondary} />}
          </Pressable>

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
              selectionColor={Colors.accentWarm}
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
            style={({ pressed }) => [styles.sendBtn, !canSend && styles.sendBtnDisabled, pressed && canSend && { opacity: 0.85 }]}
          >
            {isSending
              ? <ActivityIndicator size="small" color={Colors.textInverse} />
              : <Ionicons name="arrow-up" size={18} color={Colors.textInverse} />}
          </Pressable>
        </View>
        {text.length > MAX_LENGTH - 100 && (
          <TText variant="micro" color="tertiary" tabular style={styles.counter}>{text.length} / {MAX_LENGTH}</TText>
        )}
      </GlassSurface>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  appointmentSlot: { marginTop: 10 },
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  header: {
    paddingHorizontal: Spacing.sm,
    paddingTop: 6,
    paddingBottom: Spacing['2xs'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerInner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    width: '100%', maxWidth: THREAD_MAX + Layout.gutter * 2, alignSelf: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  roundBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  contextRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', maxWidth: THREAD_MAX, alignSelf: 'center',
    paddingTop: Spacing['2xs'], paddingHorizontal: 4,
  },
  contextLink: { minHeight: 28, justifyContent: 'center' },

  list: {
    width: '100%', maxWidth: THREAD_MAX + Layout.gutter * 2, alignSelf: 'center',
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.xs, paddingBottom: Spacing.md,
  },

  daySep: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.lg, marginBottom: Spacing['2xs'] },
  daySepLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderDefault },

  systemMsg: { alignItems: 'center', marginVertical: Spacing.sm, paddingHorizontal: Spacing.lg },

  bubbleRow: {},
  rowMe: { alignItems: 'flex-end' },
  rowThem: { alignItems: 'flex-start' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMe: { backgroundColor: Colors.accentAction },
  bubbleThem: {
    backgroundColor: Colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  pending: { opacity: 0.55 },
  imageBubble: { width: 220, height: 220, borderRadius: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingHorizontal: 4 },
  metaFailed: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  composer: {
    paddingTop: 10, paddingHorizontal: Layout.gutter,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  composerInner: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing['2xs'],
    width: '100%', maxWidth: THREAD_MAX, alignSelf: 'center',
  },
  attachBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  inputWrap: {
    flex: 1, minHeight: 44, justifyContent: 'center',
    backgroundColor: Colors.bgElevated, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.borderDefault,
    paddingHorizontal: 14,
  },
  inputWrapFocused: { borderColor: Colors.borderFocus },
  input: {
    maxHeight: 140, paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    color: Colors.textPrimary, fontFamily: Fonts.sans, fontSize: FontSize.body,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : null),
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accentAction,
  },
  sendBtnDisabled: { opacity: 0.38 },
  counter: { textAlign: 'right', width: '100%', maxWidth: THREAD_MAX, alignSelf: 'center', marginTop: 4 },
});
