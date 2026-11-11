import React, { useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TChip } from '@/components/ui/TChip';
import { THeader } from '@/components/ui/THeader';
import { TImagePicker } from '@/components/ui/TImagePicker';
import { TProgressBar } from '@/components/ui/TProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { EASE_OUT, MotionDuration, PressableScale, enterUp, fadeIn } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import { uploadPostMedia } from '@/lib/storage';
import { createFlash, flashInputError, type FlashInput } from '@/lib/studio';
import { STYLES } from '@/constants/tattoo';

const MIN_COPIES = 1;
const MAX_COPIES = 50;
const MAX_TITLE = 80;
const MAX_ZONE = 60;

/** "180" → 180; empty → null; anything else → NaN. */
function parseEuros(text: string): number | null {
  const clean = text.trim().replace(/\s/g, '');
  if (!clean) return null;
  return /^\d{1,6}$/.test(clean) ? Number(clean) : NaN;
}

/** "2,5" h → 150 min; empty → null; outside 0,5–24 h → NaN. */
function parseDurationMinutes(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (!clean) return null;
  if (!/^\d{1,2}(\.\d+)?$/.test(clean)) return NaN;
  const hours = Number(clean);
  return hours >= 0.5 && hours <= 24 ? Math.round(hours * 60) : NaN;
}

// ─── Toggle: 180ms state transition, visual only (the row owns the press) ─────
function Toggle({ value }: { value: boolean }) {
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(value ? 1 : 0, { duration: MotionDuration.state, easing: EASE_OUT }));
  }, [value, p]);
  const onStyle = useAnimatedStyle(() => ({ opacity: p.get() }));
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: p.get() * 18 }] }));
  return (
    <View style={toggleStyles.track} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, toggleStyles.on, onStyle]} />
      <Animated.View style={[toggleStyles.knob, knobStyle]} />
    </View>
  );
}

const toggleStyles = StyleSheet.create({
  track: {
    width: 46, height: 28, borderRadius: 14,
    backgroundColor: Colors.bgSubtle,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    overflow: 'hidden',
  },
  on: { backgroundColor: Colors.accentWarm, borderRadius: 14 },
  knob: {
    position: 'absolute', top: 2.5, left: 2.5,
    width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.textPrimary,
  },
});

function StepButton({ icon, label, onPress, disabled }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic
      pressedScale={0.92}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={[styles.stepBtn, disabled && styles.stepBtnDisabled]}
    >
      <Ionicons name={icon} size={18} color={Colors.textPrimary} />
    </PressableScale>
  );
}

export default function NewFlashScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  if (!user || user.role !== 'artist' || !user.artistId) {
    return (
      <View style={styles.container}>
        <THeader title="Nouveau flash" showBack />
        <EmptyState
          icon="brush-outline"
          title="Réservé aux tatoueurs"
          description={user?.role === 'artist'
            ? 'Terminez votre profil d’artiste pour publier des flashs.'
            : 'Seuls les artistes peuvent publier des flashs.'}
          ctaLabel="Fermer"
          onCta={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        />
      </View>
    );
  }

  return <FlashForm artistId={user.artistId} />;
}

function FlashForm({ artistId }: { artistId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [style, setStyle] = useState<string | null>(null);
  const [bodyZone, setBodyZone] = useState('');
  const [priceText, setPriceText] = useState('');
  const [copies, setCopies] = useState(MIN_COPIES);
  const [isColor, setIsColor] = useState(false);
  const [durationText, setDurationText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [publishing, setPublishing] = useState(false);

  const price = parseEuros(priceText);
  const duration = parseDurationMinutes(durationText);
  const priceError = Number.isNaN(price) ? 'Un prix en euros, sans centimes.' : undefined;
  const durationError = Number.isNaN(duration) ? 'Entre 0,5 et 24 heures, par exemple 2,5.' : undefined;

  const handlePublish = async () => {
    if (publishing) return;
    if (durationError) { setFormError(durationError); return; }
    const draft: Partial<FlashInput> = {
      title, style: style ?? undefined, bodyZone, price: price ?? undefined, totalCopies: copies,
      imageUrl: imageUri ?? undefined, isColor, estimatedDurationMin: duration ?? undefined,
    };
    const invalid = flashInputError(draft);
    if (invalid) { setFormError(invalid); return; }
    if (!imageUri || !style || price === null) return;

    setFormError(null);
    setPublishing(true);
    setProgress(0);
    try {
      const { url } = await uploadPostMedia(imageUri, artistId, setProgress);
      const { id, error } = await createFlash(artistId, {
        title, style, bodyZone, price, totalCopies: copies, imageUrl: url, isColor,
        estimatedDurationMin: duration ?? undefined,
      });
      if (error || !id) { setFormError(error ?? 'Publication impossible. Réessayez.'); return; }
      Toast.success('Flash publié');
      router.replace({ pathname: '/flash/[id]', params: { id } });
    } catch (e: any) {
      const detail = String(e?.message ?? e);
      console.warn('[flash] publish failed:', detail);
      setFormError(/row-level security|unauthorized|403/i.test(detail)
        ? 'Envoi refusé par les règles de sécurité. Reconnectez-vous puis réessayez.'
        : 'Envoi de l’image impossible. Vérifiez votre connexion puis réessayez.');
    } finally {
      setPublishing(false);
    }
  };

  const picker = (
    <View>
      <TImagePicker
        value={imageUri}
        onPicked={(uri) => { setImageUri(uri); setFormError(null); }}
        aspect={[3, 4]}
        placeholder="Ajouter le dessin du flash"
        style={styles.picker}
      />
      <TText variant="caption" color="tertiary" style={styles.pickerHint}>
        Le dessin tel qu’il sera tatoué, sur fond neutre, format portrait 3:4.
      </TText>
    </View>
  );

  const form = (
    <View>
      <TInput
        label="Titre"
        value={title}
        onChangeText={(t) => { setTitle(t); setFormError(null); }}
        placeholder="Serpent et pivoine"
        maxLength={MAX_TITLE}
      />

      <TText variant="caption" weight="medium" color="secondary" style={styles.fieldLabel}>Style</TText>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Style">
        {STYLES.map((s) => (
          <TChip
            key={s.id}
            label={s.name}
            selected={style === s.slug}
            onPress={() => { setStyle(s.slug); setFormError(null); }}
          />
        ))}
      </View>

      <TInput
        label="Emplacement conseillé"
        optional
        value={bodyZone}
        onChangeText={setBodyZone}
        placeholder="Avant-bras, mollet…"
        maxLength={MAX_ZONE}
        containerStyle={{ marginTop: Spacing.sm }}
      />

      <TInput
        label="Prix"
        value={priceText}
        onChangeText={(t) => { setPriceText(t); setFormError(null); }}
        placeholder="180"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={6}
        error={priceError}
        rightElement={<TText variant="bodySmall" color="tertiary">€</TText>}
      />

      {/* Copies */}
      <View style={styles.stepperRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <TText variant="body" weight="medium">Nombre d’exemplaires</TText>
          <TText variant="caption" color="tertiary" style={{ marginTop: 2 }}>1 = pièce unique</TText>
        </View>
        <View
          style={styles.stepper}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Nombre d’exemplaires"
          accessibilityValue={{ min: MIN_COPIES, max: MAX_COPIES, now: copies }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'increment') setCopies((n) => Math.min(MAX_COPIES, n + 1));
            if (e.nativeEvent.actionName === 'decrement') setCopies((n) => Math.max(MIN_COPIES, n - 1));
          }}
        >
          <StepButton icon="remove" label="Un exemplaire de moins" disabled={copies <= MIN_COPIES} onPress={() => setCopies((n) => Math.max(MIN_COPIES, n - 1))} />
          <TText variant="title2" serif tabular style={styles.stepValue}>{copies}</TText>
          <StepButton icon="add" label="Un exemplaire de plus" disabled={copies >= MAX_COPIES} onPress={() => setCopies((n) => Math.min(MAX_COPIES, n + 1))} />
        </View>
      </View>

      {/* Colour */}
      <Pressable
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setIsColor((v) => !v);
        }}
        accessibilityRole="switch"
        accessibilityLabel="Couleur"
        accessibilityHint="Indique si le flash est tatoué en couleur."
        accessibilityState={{ checked: isColor }}
        style={styles.toggleRow}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <TText variant="body" weight="medium">Couleur</TText>
          <TText variant="caption" color="tertiary" style={{ marginTop: 2 }}>
            {isColor ? 'Tatoué en couleur.' : 'Tatoué en noir et gris.'}
          </TText>
        </View>
        <Toggle value={isColor} />
      </Pressable>

      <TInput
        label="Durée estimée"
        optional
        value={durationText}
        onChangeText={(t) => { setDurationText(t); setFormError(null); }}
        placeholder="2,5"
        keyboardType="decimal-pad"
        inputMode="decimal"
        maxLength={5}
        error={durationError}
        rightElement={<TText variant="bodySmall" color="tertiary">heures</TText>}
      />

      {publishing && (
        <Animated.View entering={fadeIn()} style={styles.progressWrap}>
          <TProgressBar progress={progress} color={Colors.accentWarm} />
          <TText variant="caption" color="tertiary" tabular style={{ marginTop: 6 }}>
            Envoi en cours… {Math.round(progress * 100)} %
          </TText>
        </Animated.View>
      )}

      {!!formError && (
        <TText variant="bodySmall" color="error" style={styles.formError} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {formError}
        </TText>
      )}

      <TButton
        title={publishing ? 'Publication…' : 'Publier le flash'}
        onPress={() => { void handlePublish(); }}
        loading={publishing}
        disabled={publishing}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <THeader title="Nouveau flash" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={wide ? styles.columnsWide : undefined}>
          <Animated.View entering={enterUp(0)} style={wide ? styles.colMedia : undefined}>{picker}</Animated.View>
          <Animated.View entering={enterUp(1)} style={wide ? styles.colForm : styles.formStacked}>{form}</Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  content: {
    width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center',
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.lg,
  },
  columnsWide: { flexDirection: 'row', gap: Spacing['2xl'], alignItems: 'flex-start' },
  colMedia: { flex: 1, maxWidth: 440 },
  colForm: { flex: 1, maxWidth: Layout.maxReading },
  formStacked: { marginTop: Spacing.lg },

  picker: { borderRadius: Radius.xl },
  pickerHint: { marginTop: Spacing['2xs'] },

  fieldLabel: { marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },

  stepperRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs, marginBottom: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2xs'] },
  stepBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  stepBtnDisabled: { opacity: 0.38 },
  stepValue: { minWidth: 32, textAlign: 'center', fontSize: 22 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    minHeight: 60, marginBottom: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },

  progressWrap: { marginBottom: Spacing.md },
  formError: { marginBottom: Spacing.sm },
});
