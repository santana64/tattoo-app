import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay,
  FadeIn, FadeInUp, SlideInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, FontSize, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { useMessageStore, Message } from '@/store/message-store';
import { useRequestStore } from '@/store/request-store';
import { useAuthStore } from '@/store/auth-store';
import { pickImage, uploadFile } from '@/lib/storage';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const { width: W } = Dimensions.get('window');

// ─── Typing Indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animate = (v: typeof dot1, delay: number) => {
      v.value = withDelay(delay, withSpring(1, { damping: 4, stiffness: 200 }, () => {
        v.value = withSpring(0, { damping: 4 });
      }));
    };
    const interval = setInterval(() => {
      animate(dot1, 0);
      animate(dot2, 150);
      animate(dot3, 300);
    }, 900);
    return () => clearInterval(interval);
  }, []);

  const d1Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value * -5 }] }));
  const d2Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value * -5 }] }));
  const d3Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value * -5 }] }));

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.typingWrap}>
      <View style={styles.typingBubble}>
        <Animated.View style={[styles.typingDot, d1Style]} />
        <Animated.View style={[styles.typingDot, d2Style]} />
        <Animated.View style={[styles.typingDot, d3Style]} />
      </View>
    </Animated.View>
  );
}

// ─── Message Bubble V3 ─────────────────────────────────────────────────────────
function MessageBubble({ item, isMe, index }: { item: Message; isMe: boolean; index: number }) {
  const scale = useSharedValue(0.88);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const d = Math.min(index * 20, 280);
    scale.value = withDelay(d, withSpring(1, { damping: 14, stiffness: 220 }));
    opacity.value = withDelay(d, withTiming(1, { duration: 180 }));
  }, []);

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // System message
  if (item.messageType === 'system') {
    return (
      <Animated.View entering={FadeIn.duration(300)} style={styles.systemMsg}>
        <View style={styles.systemMsgInner}>
          <TText variant="caption" color="tertiary" style={{ textAlign: 'center' }}>{item.content}</TText>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem, bubbleStyle]}>
      {item.messageType === 'image' ? (
        <TouchableOpacity activeOpacity={0.9} style={[isMe ? styles.bubbleMe : styles.bubbleThem, { padding: 3, borderRadius: Radius.lg }]}>
          <Image
            source={{ uri: item.content }}
            style={styles.imageBubble}
            contentFit="cover"
            transition={300}
          />
        </TouchableOpacity>
      ) : (
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem, item.pending && styles.bubblePending]}>
          {!isMe && (
            <LinearGradient
              colors={['rgba(255,255,255,0.04)', 'transparent']}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          )}
          <TText variant="bodySmall" style={isMe ? styles.textMe : styles.textThem} selectable>
            {item.content}
          </TText>
        </View>
      )}
      <View style={isMe ? styles.metaRowMe : styles.metaRowThem}>
        <TText variant="micro" color="tertiary" style={styles.timestamp}>
          {format(new Date(item.createdAt), 'HH:mm', { locale: fr })}
        </TText>
        {isMe && !item.pending && (
          <TText style={styles.readReceipt}> ✓✓</TText>
        )}
        {item.failed && <TText style={styles.failedReceipt}> ✗</TText>}
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const {
    fetchMessages, subscribeToRequest, unsubscribeFromRequest,
    sendMessage, markAsRead, messagesByRequest,
  } = useMessageStore();
  const { getRequest } = useRequestStore();

  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const messages = messagesByRequest[id] ?? [];
  const request = getRequest(id);

  const sendScale = useSharedValue(0);

  useEffect(() => {
    if (!id) return;
    fetchMessages(id);
    subscribeToRequest(id);
    if (user?.id) markAsRead(id, user.id);
    return () => unsubscribeFromRequest();
  }, [id]);

  useEffect(() => {
    sendScale.value = withSpring(text.trim().length > 0 ? 1 : 0, { damping: 14, stiffness: 220 });
  }, [text]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !user?.id || isSending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const content = text.trim();
    setText('');
    setIsSending(true);
    await sendMessage(id, user.id, content);
    setIsSending(false);
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [text, user?.id, id, isSending]);

  const handleImageSend = async () => {
    const uris = await pickImage();
    if (!uris?.[0] || !user?.id) return;
    setIsUploading(true);
    try {
      const { url } = await uploadFile(uris[0], 'posts-media', `conv/${id}/${Date.now()}.jpg`);
      await sendMessage(id, user.id, url, 'image');
    } finally {
      setIsUploading(false);
    }
  };

  const sendBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
    opacity: sendScale.value,
  }));

  const attachBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: text.length > 0 ? withSpring(0, { damping: 14 }) : withSpring(1, { damping: 14 }) }],
    opacity: text.length > 0 ? withTiming(0, { duration: 120 }) : withTiming(1, { duration: 120 }),
  }));

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderId === user?.id;
    return <MessageBubble item={item} isMe={isMe} index={index} />;
  }, [user?.id]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ── */}
      <Animated.View entering={FadeIn.duration(280)} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <TText variant="bodySmall" weight="semibold" numberOfLines={1}>
            {request?.artistName ?? request?.clientName ?? 'Conversation'}
          </TText>
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <TText variant="micro" color="tertiary">En ligne</TText>
          </View>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push(`/request/${id}`)}>
          <Ionicons name="information-circle-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Context banner ── */}
      {request && (
        <Animated.View entering={SlideInDown.duration(320)} style={styles.contextBanner}>
          <LinearGradient
            colors={['rgba(212,168,100,0.07)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Ionicons name="color-palette-outline" size={13} color={Colors.accentWarm} />
          <TText variant="caption" style={styles.contextType}>
            {request.projectType}
          </TText>
          <TText variant="caption" color="tertiary" style={styles.contextDetail} numberOfLines={1}>
            · {request.sizeCategory?.toUpperCase()} · {request.budgetMin ? `${request.budgetMin}–${request.budgetMax}€` : 'Budget flexible'}
          </TText>
          <TouchableOpacity onPress={() => router.push(`/request/${id}`)} style={styles.contextViewBtn}>
            <TText variant="micro" color="tertiary">Voir →</TText>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Messages ── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[styles.list, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListFooterComponent={showTyping ? <TypingIndicator /> : null}
      />

      {/* ── Input bar ── */}
      <Animated.View
        entering={SlideInDown.delay(180).duration(320)}
        style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}
      >
        {/* Top fade edge */}
        <LinearGradient
          colors={['rgba(3,3,5,0)', 'rgba(3,3,5,0.9)']}
          style={styles.inputFade}
          pointerEvents="none"
        />
        <View style={styles.inputRow}>
          {/* Attach button — hides when typing */}
          <Animated.View style={[styles.attachBtnWrap, attachBtnStyle]}>
            <TouchableOpacity style={styles.attachBtn} onPress={handleImageSend} disabled={isUploading}>
              {isUploading
                ? <ActivityIndicator size="small" color={Colors.textTertiary} />
                : <Ionicons name="image-outline" size={21} color={Colors.textSecondary} />}
            </TouchableOpacity>
          </Animated.View>

          {/* Text input */}
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Message…"
              placeholderTextColor={Colors.textTertiary}
              multiline
              maxLength={1000}
              returnKeyType="default"
            />
          </View>

          {/* Send button — appears when text present */}
          <Animated.View style={sendBtnStyle}>
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={handleSend}
              disabled={!text.trim() || isSending}
              activeOpacity={0.82}
            >
              <LinearGradient
                colors={[Colors.accentGlow, Colors.accentWarm]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {isSending
                ? <ActivityIndicator size="small" color={Colors.bgPrimary} />
                : <Ionicons name="arrow-up" size={17} color={Colors.bgPrimary} />}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xs'],
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
    backgroundColor: 'rgba(3,3,5,0.97)',
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.successLight,
  },

  // Context banner
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
    overflow: 'hidden',
  },
  contextType: {
    color: Colors.accentWarm,
    fontWeight: '600',
    marginLeft: 6,
  },
  contextDetail: {
    marginLeft: 6,
    flex: 1,
  },
  contextViewBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  // Message list
  list: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },

  // System message
  systemMsg: {
    alignItems: 'center',
    marginVertical: 10,
  },
  systemMsgInner: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },

  // Bubble row
  bubbleRow: {
    marginBottom: 4,
  },
  bubbleRowMe: {
    alignItems: 'flex-end',
  },
  bubbleRowThem: {
    alignItems: 'flex-start',
  },

  // Bubble body
  bubble: {
    maxWidth: W * 0.75,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  bubbleMe: {
    backgroundColor: Colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: Colors.bgSurface,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  bubblePending: {
    opacity: 0.5,
  },
  imageBubble: {
    width: 200,
    height: 200,
    borderRadius: Radius.md - 3,
  },
  textMe: {
    color: Colors.bgPrimary,
  },
  textThem: {
    color: Colors.textPrimary,
  },

  // Timestamps / read receipts
  metaRowMe: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
    marginRight: 2,
    gap: 1,
  },
  metaRowThem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    marginLeft: 2,
  },
  timestamp: {
    fontSize: 10,
  },
  readReceipt: {
    fontSize: 10,
    color: Colors.accentWarm,
  },
  failedReceipt: {
    fontSize: 10,
    color: Colors.errorLight,
  },

  // Typing indicator
  typingWrap: {
    alignItems: 'flex-start',
    paddingLeft: 2,
    marginBottom: 8,
  },
  typingBubble: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.textTertiary,
  },

  // Input bar
  inputBar: {
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
    paddingHorizontal: Spacing.sm,
    paddingTop: 10,
  },
  inputFade: {
    position: 'absolute',
    top: -20,
    left: 0,
    right: 0,
    height: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  attachBtnWrap: {
    // used for animated opacity/scale
  },
  attachBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
  },
  input: {
    minHeight: 38,
    maxHeight: 120,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: Colors.textPrimary,
    fontSize: FontSize.body,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...GlowShadow.amber,
  },
});
