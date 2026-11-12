import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { BottomSheet } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import { contactArtist, MESSAGE_MAX } from '@/lib/care';

interface ContactArtistSheetProps {
  visible: boolean;
  onClose(): void;
  artistId: string;
  artistName: string;
}

/** The sheet slides out before its Modal unmounts. */
const SHEET_EXIT_MS = 280;

/**
 * A question to an artist, without a project. Opens (or continues) a light
 * thread in the inbox and leads straight to the conversation.
 */
export function ContactArtistSheet({ visible, onClose, artistId, artistName }: ContactArtistSheetProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [mounted, setMounted] = useState(visible);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the Modal while the sheet animates out.
  useEffect(() => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    if (visible) setMounted(true);
    else exitTimer.current = setTimeout(() => setMounted(false), SHEET_EXIT_MS);
    return () => { if (exitTimer.current) clearTimeout(exitTimer.current); };
  }, [visible]);

  // Signed out: the sign-in comes back to the artist's page.
  useEffect(() => {
    if (visible && !user) {
      onClose();
      router.push({ pathname: '/(auth)/sign-in', params: { next: `/artist/${artistId}` } });
    }
  }, [visible, user, artistId, onClose, router]);

  const send = useCallback(async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    const { requestId, error: failure } = await contactArtist(artistId, message);
    setSending(false);
    if (failure || !requestId) { setError(failure ?? 'Envoi impossible. Réessayez.'); return; }
    setMessage('');
    onClose();
    router.push(`/conversation/${requestId}`);
  }, [artistId, message, onClose, router, sending]);

  const length = message.trim().length;
  const canSend = length >= 2 && length <= MESSAGE_MAX && !sending;

  if (!user) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <BottomSheet visible={visible} onClose={onClose} accessibilityLabel={`Écrire à ${artistName}`}>
            <TText variant="displayS" accessibilityRole="header">Écrire à {artistName}</TText>
            <TText variant="bodySmall" color="secondary" style={styles.helper}>
              Une question avant de vous lancer ? {artistName} vous répondra ici.
            </TText>
            <TInput
              value={message}
              onChangeText={(t) => { setMessage(t); setError(null); }}
              placeholder="Vos disponibilités, un style, un emplacement…"
              accessibilityLabel={`Message à ${artistName}`}
              multiline
              maxLength={MESSAGE_MAX}
              autoFocus={Platform.OS === 'web'}
              editable={!sending}
              error={error ?? undefined}
              helper={`${message.length} / ${MESSAGE_MAX}`}
              inputStyle={styles.input}
              containerStyle={styles.field}
            />
            <View style={styles.actions}>
              <TButton title="Envoyer" onPress={() => { void send(); }} loading={sending} disabled={!canSend} />
              <TButton title="Annuler" variant="ghost" size="md" onPress={onClose} disabled={sending} />
            </View>
          </BottomSheet>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  helper: { marginTop: 4, marginBottom: Spacing.sm },
  field: { marginBottom: Spacing.xs },
  input: { minHeight: 110, maxHeight: 220, textAlignVertical: 'top', paddingTop: 14 },
  actions: { gap: Spacing['2xs'] },
});
