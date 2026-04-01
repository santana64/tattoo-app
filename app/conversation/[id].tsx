import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TAvatar } from '@/components/ui/TAvatar';
import { TDivider } from '@/components/ui/TDivider';
import { MESSAGES_BY_REQUEST, REQUESTS, ARTISTS } from '@/constants/mock-data';
import type { Message } from '@/constants/mock-data';
import { useAuthStore } from '@/store/auth-store';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const isArtist = user?.role === 'artist';

  const request = REQUESTS.find((r) => r.id === id) ?? REQUESTS[1];
  const artist = ARTISTS.find((a) => a.id === request.artistId) ?? ARTISTS[0];

  const [messages, setMessages] = useState<Message[]>(
    MESSAGES_BY_REQUEST[id] ?? MESSAGES_BY_REQUEST['r2'] ?? []
  );
  const [inputText, setInputText] = useState('');
  const listRef = useRef<FlatList>(null);

  const sendMessage = () => {
    if (!inputText.trim()) return;
    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      senderId: isArtist ? 'a1' : 'client',
      senderName: isArtist ? artist.blaze : request.clientName,
      content: inputText.trim(),
      messageType: 'text',
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isSystem = item.messageType === 'system' || item.messageType === 'appointment_confirmed';
    const isMe = (isArtist && item.senderId === 'a1') || (!isArtist && item.senderId === 'client');

    if (isSystem) {
      return (
        <View style={msgStyles.systemMsg}>
          <TText variant="caption" color="tertiary" style={{ textAlign: 'center' }}>
            {item.content}
          </TText>
        </View>
      );
    }

    return (
      <View style={[msgStyles.bubble, isMe ? msgStyles.bubbleMe : msgStyles.bubbleThem]}>
        <TText
          variant="bodySmall"
          style={{
            color: isMe ? Colors.textInverse : Colors.textPrimary,
            lineHeight: 22,
          }}
        >
          {item.content}
        </TText>
        <TText
          variant="label"
          style={{
            color: isMe ? 'rgba(10,10,10,0.5)' : Colors.textTertiary,
            marginTop: 3,
            alignSelf: 'flex-end',
          }}
        >
          {new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </TText>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <TAvatar uri={isArtist ? request.clientAvatar : artist.avatarUrl} name={isArtist ? request.clientName : artist.blaze} size="sm" />
          <View style={{ marginLeft: 8 }}>
            <TText variant="bodySmall" weight="semibold">
              {isArtist ? request.clientName : artist.blaze}
            </TText>
            <TText variant="caption" color="tertiary">
              {request.bodyZone} · {request.projectType === 'new' ? 'Nouveau' : request.projectType}
            </TText>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push(`/request/${request.id}`)}
          style={styles.headerBtn}
        >
          <Ionicons name="document-text-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Context banner */}
      <TouchableOpacity
        style={styles.contextBanner}
        onPress={() => router.push(`/request/${request.id}`)}
        activeOpacity={0.8}
      >
        <Ionicons name="information-circle-outline" size={16} color={Colors.textTertiary} />
        <TText variant="caption" color="tertiary" style={{ marginLeft: 6, flex: 1 }}>
          {request.bodyZone} · {request.sizeCategory.toUpperCase()} · {request.budgetMin}–{request.budgetMax}€
        </TText>
        <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
      </TouchableOpacity>

      <TDivider />

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[styles.messageList, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Message..."
            placeholderTextColor={Colors.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={sendMessage}
            style={[styles.sendBtn, inputText.trim() ? styles.sendBtnActive : undefined]}
            disabled={!inputText.trim()}
          >
            <Ionicons
              name="send"
              size={18}
              color={inputText.trim() ? Colors.textInverse : Colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const msgStyles = StyleSheet.create({
  systemMsg: {
    paddingVertical: Spacing['2xs'],
    paddingHorizontal: Spacing.xl,
    marginVertical: 4,
    alignItems: 'center',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginVertical: 2,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.accentAction,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.bgElevated,
    borderBottomLeftRadius: 4,
  },
});

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
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing['3xs'],
    backgroundColor: Colors.bgSurface,
  },
  messageList: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  inputBar: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing['2xs'],
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingLeft: Spacing.sm,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  textInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.body,
    maxHeight: 100,
    paddingVertical: 4,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: Colors.accentAction,
  },
});
