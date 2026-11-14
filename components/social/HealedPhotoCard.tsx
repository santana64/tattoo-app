import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Kicker } from '@/components/v5';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TImagePicker } from '@/components/ui/TImagePicker';
import { TProgressBar } from '@/components/ui/TProgressBar';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { Toast } from '@/components/ui/TToast';
import { RevealImage, fadeIn } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import { uploadHealedPhoto } from '@/lib/storage';
import {
  fetchAppointmentHealedPhoto, sendHealedPhoto, setHealedPhotoPublic, type HealedPhoto,
} from '@/lib/care';

interface HealedPhotoCardProps {
  appointmentId: string;
  role: 'client' | 'artist';
  completed: boolean;
}

const NOTE_MAX = 300;

/**
 * Switch visual drawn like the kit Toggle (wash track off, ink track with a
 * vermilion knob on); the surrounding row owns the press and the accessibility state.
 */
function Switch({ value }: { value: boolean }) {
  return (
    <View style={[styles.track, value && styles.trackOn]} importantForAccessibility="no-hide-descendants">
      <View style={[styles.knob, value && styles.knobOn]} />
    </View>
  );
}

function PublicRow({ value, onToggle, disabled, hint }: {
  value: boolean; onToggle: () => void; disabled?: boolean; hint: string;
}) {
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
      accessibilityRole="switch"
      accessibilityLabel="Afficher sur le profil de l’artiste"
      accessibilityHint={hint}
      accessibilityState={{ checked: value, disabled }}
      aria-checked={Platform.OS === 'web' ? value : undefined}
      style={[styles.toggleRow, disabled && { opacity: 0.6 }]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <TText variant="bodySmall" weight="medium">Afficher sur le profil de l’artiste</TText>
        <TText variant="caption" color="tertiary" style={{ marginTop: 2 }}>{hint}</TText>
      </View>
      <Switch value={value} />
    </Pressable>
  );
}

/**
 * The healed result of a finished session. The client sends one photo (and may
 * show it on the artist's profile); the artist sees it once sent.
 */
export function HealedPhotoCard({ appointmentId, role, completed }: HealedPhotoCardProps) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [photo, setPhoto] = useState<HealedPhoto | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingVisibility, setSavingVisibility] = useState(false);

  useEffect(() => {
    if (!completed) return;
    let active = true;
    setState('loading');
    fetchAppointmentHealedPhoto(appointmentId)
      .then((p) => { if (active) { setPhoto(p); setState('ready'); } })
      .catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [appointmentId, completed, attempt]);

  const send = useCallback(async () => {
    if (sending || !userId) return;
    if (!imageUri) { setFormError('Choisissez une photo.'); return; }
    if (note.trim().length > NOTE_MAX) { setFormError(`La note fait ${NOTE_MAX} caractères au plus.`); return; }
    setFormError(null);
    setSending(true);
    setProgress(0);
    try {
      const { url } = await uploadHealedPhoto(imageUri, userId, setProgress);
      const error = await sendHealedPhoto(appointmentId, url, note, isPublic);
      if (error) { setFormError(error); return; }
      Toast.success('Photo envoyée');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const saved = await fetchAppointmentHealedPhoto(appointmentId).catch(() => null);
      setPhoto(saved ?? {
        id: '', appointment_id: appointmentId, artist_id: null, client_id: userId,
        photo_url: url, note: note.trim() || null, is_public: isPublic, created_at: new Date().toISOString(),
      });
      setImageUri(null);
      setNote('');
    } catch {
      setFormError('Envoi de la photo impossible. Vérifiez votre connexion puis réessayez.');
    } finally {
      setSending(false);
    }
  }, [appointmentId, imageUri, isPublic, note, sending, userId]);

  const toggleVisibility = useCallback(async () => {
    if (!photo?.id || savingVisibility) return;
    const next = !photo.is_public;
    setSavingVisibility(true);
    setPhoto({ ...photo, is_public: next });
    const ok = await setHealedPhotoPublic(photo.id, next);
    setSavingVisibility(false);
    if (!ok) {
      setPhoto((p) => (p ? { ...p, is_public: !next } : p));
      Toast.error('Modification impossible. Réessayez.');
    }
  }, [photo, savingVisibility]);

  if (!completed) return null;

  if (state === 'loading') {
    return role === 'artist' ? null : (
      <View style={styles.card} accessibilityLabel="Chargement de la photo cicatrisée">
        <TSkeleton width="55%" height={14} />
        <TSkeleton height={160} style={{ marginTop: Spacing.sm }} />
      </View>
    );
  }

  if (state === 'error') {
    return role === 'artist' ? null : (
      <View style={styles.card}>
        <TText variant="bodySmall" color="secondary">La photo cicatrisée n’a pas pu être chargée.</TText>
        <TButton title="Réessayer" variant="secondary" size="sm" fullWidth={false} onPress={() => setAttempt((n) => n + 1)} style={{ marginTop: Spacing.xs, alignSelf: 'flex-start' }} />
      </View>
    );
  }

  // ── A photo exists: both parties see it ──
  if (photo) {
    const isClient = role === 'client';
    return (
      <Animated.View entering={fadeIn()} style={styles.card}>
        <Kicker tone="flame">Cicatrisé</Kicker>
        <TText variant="displayS" style={styles.heading}>
          {isClient ? 'Votre photo cicatrisée' : 'Photo cicatrisée envoyée par votre client'}
        </TText>
        <RevealImage
          uri={photo.photo_url}
          style={styles.photo}
          contentFit="cover"
          accessibilityLabel={photo.note ? `Tatouage cicatrisé : ${photo.note}` : 'Tatouage cicatrisé'}
        />
        {!!photo.note && (
          <TText variant="body" serif italic color="secondary" style={styles.note} selectable>« {photo.note} »</TText>
        )}
        {isClient && photo.id ? (
          <PublicRow
            value={photo.is_public}
            onToggle={() => { void toggleVisibility(); }}
            disabled={savingVisibility}
            hint={photo.is_public ? 'Visible dans la section « Cicatrisés » de son profil.' : 'Visible seulement par vous et l’artiste.'}
          />
        ) : (
          <View style={styles.visibility}>
            <Ionicons name={photo.is_public ? 'eye-outline' : 'eye-off-outline'} size={15} color={Colors.textTertiary} />
            <TText variant="caption" color="tertiary">
              {photo.is_public
                ? isClient ? 'Affichée sur le profil de l’artiste' : 'Affichée sur votre profil, section « Cicatrisés »'
                : isClient ? 'Visible seulement par vous et l’artiste' : 'Privée : votre client ne l’a pas rendue publique'}
            </TText>
          </View>
        )}
      </Animated.View>
    );
  }

  // ── No photo yet: only the client is invited to send one ──
  if (role !== 'client') return null;

  return (
    <Animated.View entering={fadeIn()} style={styles.card}>
      <Kicker tone="flame">Après la séance</Kicker>
      <TText variant="displayS" style={styles.heading}>
        Votre tatouage a cicatrisé{' '}? <TText variant="displayS" italic color="accentGlow" style={styles.headingType}>Montrez le résultat.</TText>
      </TText>
      <TText variant="bodySmall" color="secondary" style={styles.lede}>
        Une photo prise à la lumière du jour, quelques semaines après la séance, montre le vrai travail de l’artiste.
      </TText>

      <TImagePicker
        value={imageUri}
        onPicked={(uri) => { setImageUri(uri); setFormError(null); }}
        aspect={[4, 5]}
        placeholder="Ajouter la photo cicatrisée"
        style={{ marginBottom: Spacing.md }}
      />

      <TInput
        label="Un mot pour l’artiste"
        optional
        value={note}
        onChangeText={(t) => { setNote(t); setFormError(null); }}
        placeholder="Comment s’est passée la cicatrisation ?"
        multiline
        maxLength={NOTE_MAX}
        helper={`${note.length} / ${NOTE_MAX}`}
        inputStyle={styles.noteInput}
        editable={!sending}
      />

      <PublicRow
        value={isPublic}
        onToggle={() => setIsPublic((v) => !v)}
        disabled={sending}
        hint={isPublic ? 'Elle rejoindra la section « Cicatrisés » de son profil.' : 'Seuls vous et l’artiste la verrez.'}
      />

      {sending && (
        <View style={styles.progressWrap}>
          <TProgressBar progress={progress} color={Colors.flame} />
          <TText variant="caption" color="tertiary" tabular style={{ marginTop: 6 }}>
            Envoi en cours… {Math.round(progress * 100)} %
          </TText>
        </View>
      )}

      {!!formError && (
        <TText variant="bodySmall" color="error" style={styles.formError} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {formError}
        </TText>
      )}

      <TButton
        title={sending ? 'Envoi…' : 'Envoyer'}
        onPress={() => { void send(); }}
        loading={sending}
        disabled={sending || !imageUri || !userId}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.line,
    borderTopWidth: 2, borderTopColor: Colors.flame,
    backgroundColor: Colors.white,
  },
  heading: { marginTop: 8, fontSize: 28, lineHeight: 30, letterSpacing: -0.5 },
  headingType: { fontSize: 28, lineHeight: 30, letterSpacing: -0.5 },
  lede: { marginTop: Spacing['2xs'], marginBottom: Spacing.md },
  photo: { width: '100%', aspectRatio: 4 / 5, maxHeight: 520, marginTop: Spacing.sm, backgroundColor: Colors.clay },
  note: { marginTop: Spacing.xs, fontSize: 18, lineHeight: 24 },
  visibility: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  noteInput: { minHeight: 84, textAlignVertical: 'top', paddingTop: 14 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    minHeight: 60, marginTop: Spacing.xs, marginBottom: Spacing.md,
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: Colors.line,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  track: {
    width: 58, height: 30, borderRadius: Radius.full, padding: 5,
    borderWidth: 1, borderColor: Colors.ink, backgroundColor: Colors.wash,
    flexDirection: 'row', alignItems: 'center',
  },
  trackOn: { backgroundColor: Colors.ink, justifyContent: 'flex-end' },
  knob: { width: 18, height: 18, borderRadius: Radius.full, backgroundColor: '#FFFFFF' },
  knobOn: { backgroundColor: Colors.flame },

  progressWrap: { marginBottom: Spacing.md },
  formError: { marginBottom: Spacing.sm },
});
