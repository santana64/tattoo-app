import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, FadeInUp, FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { useMessageStore, Message } from '@/store/message-store';
import { useRequestStore } from '@/store/request-store';
import { useAuthStore } from '@/store/auth-store';
import { Image } from 'expo-image';
import { pickImage, uploadFile } from '@/lib/storage';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { fetchMessages, subscribeToRequest, unsubscribeFromRequest, sendMessage, markAsRead, messagesByRequest } = useMessageStore();
  const { getRequest } = useRequestStore();

  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
    sendScale.value = withSpring(text.trim().length > 0 ? 1 : 0, { damping: 15, stiffness: 200 });
  }, [text]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !user?.id || isSending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSending(true);
    const content = text.trim();
    setText('');
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

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderId === user?.id;
    const isSystem = item.messageType === 'system';

    if (isSystem) {
      return (
        <Animated.View entering={FadeIn} style={styles.systemMsg}>
          <TText variant="caption" color="tertiary" style={{ textAlign: 'center' }}>{item.content}</TText>
        </Animated.View>
      );
    }

    return (
      <Animated.View
        entering={FadeInUp.delay(Math.min(index * 30, 200)).springify()}
        style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}
      >
        {item.messageType === 'image' ? (
          <TouchableOpacity activeOpacity={0.9}>
            <Image
              source={{ uri: item.content }}
              style={[styles.imageBubble, isMe ? styles.bubbleMe : styles.bubbleThem]}
              contentFit="cover"
              transition={300}
            />
          </TouchableOpacity>
        ) : (
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem, item.pending && styles.bubblePending]}>
            <TText variant="bodySmall" style={isMe ? styles.textMe : styles.textThem}>
              {item.content}
            </TText>
          </View>
        )}
        <TText variant="caption" color="tertiary" style={[styles.timestamp, isMe ? styles.timestampMe : styles.timestampThem]}>
          {format(new Date(item.createdAt), 'HH:mm', { locale: fr })}
          {item.failed && ' ✗'}
        </TText>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <TText variant="bodySmall" weight="semibold" numberOfLines={1}>
            {request?.artistName ?? request?.clientName ?? 'Conversation'}
          </TText>
          {request && (
            <TText variant="caption" color="tertiary" numberOfLines={1}>
              {request.bodyZone}
            </TText>
          )}
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push(`/request/${id}`)}>
          <Ionicons name="information-circle-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Context banner */}
      {request && (
        <View style={styles.contextBanner}>
          <Ionicons name="document-text-outline" size={14} color={Colors.textTertiary} />
          <TText variant="caption" color="tertiary" style={{ marginLeft: 6, flex: 1 }}>
            {request.sizeCategory?.toUpperCase()} · {request.budgetMin ? `${request.budgetMin}–${request.budgetMax}€` : 'Budget flexible'}
          </TText>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[styles.list, { paddingBottom: 12 }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.attachBtn} onPress={handleImageSend} disabled={isUploading}>
          {isUploading
            ? <ActivityIndicator size="small" color={Colors.textTertiary} />
            : <Ionicons name="image-outline" size={22} color={Colors.textSecondary} />}
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor={Colors.textTertiary}
          multiline
          maxLength={1000}
        />

        <AnimatedTouchable
          style={[styles.sendBtn, sendBtnStyle]}
          onPress={handleSend}
          disabled={!text.trim() || isSending}
        >
          {isSending
            ? <ActivityIndicator size="small" color={Colors.bgPrimary} />
            : <Ionicons name="arrow-up" size={18} color={Colors.bgPrimary} />}
        </AnimatedTouchable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xs'],
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    backgroundColor: Colors.bgElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  list: { paddingHorizontal: Spacing.sm, paddingTop: Spacing.sm },
  systemMsg: { alignItems: 'center', marginVertical: 8 },
  bubbleRow: { marginBottom: 4 },
  bubbleRowMe: { alignItems: 'flex-end' },
  bubbleRowThem: { alignItems: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: { backgroundColor: Colors.accent, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: Colors.bgSurface, borderBottomLeftRadius: 4 },
  bubblePending: { opacity: 0.6 },
  imageBubble: { width: 200, height: 200, borderRadius: Radius.md },
  textMe: { color: Colors.bgPrimary },
  textThem: { color: Colors.textPrimary },
  timestamp: { fontSize: 10, marginTop: 2 },
  timestampMe: { marginRight: 4 },
  timestampThem: { marginLeft: 4 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.sm,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.bgPrimary,
    gap: 8,
  },
  attachBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: Colors.textPrimary,
    fontSize: FontSize.body,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
