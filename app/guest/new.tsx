import React, { useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { THeader } from '@/components/ui/THeader';
import { TImagePicker } from '@/components/ui/TImagePicker';
import { TProgressBar } from '@/components/ui/TProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { PressableScale, enterUp, fadeIn } from '@/components/motion';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';
import { uploadPostMedia } from '@/lib/storage';
import { createGuestSpot, guestSpotInputError, type GuestSpotInput } from '@/lib/studio';

const MIN_SLOTS = 1;
const MAX_SLOTS = 20;
/** How far ahead a guest can be announced, and how long it can last. */
const MAX_DAYS_AHEAD = 365;
const MAX_LENGTH_DAYS = 60;
const MAX_DESCRIPTION = 600;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const dayFmtYear = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const formatDay = (d: Date) => (d.getFullYear() === new Date().getFullYear() ? dayFmt : dayFmtYear).format(d);

/** "180" → 180; empty → null; anything else → NaN. */
function parseEuros(text: string): number | null {
  const clean = text.trim().replace(/\s/g, '');
  if (!clean) return null;
  return /^\d{1,6}$/.test(clean) ? Number(clean) : NaN;
}

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
      <Ionicons name={icon} size={17} color={Colors.textPrimary} />
    </PressableScale>
  );
}

/** One day, moved by a day (‹ ›) or a week (« »), kept within [min, max]. */
function DayStepper({ label, value, min, max, onChange }: {
  label: string; value: Date; min: Date; max: Date; onChange: (d: Date) => void;
}) {
  const move = (days: number) => {
    const next = addDays(value, days);
    onChange(next < min ? min : next > max ? max : next);
  };
  const atMin = sameDay(value, min) || value < min;
  const atMax = sameDay(value, max) || value > max;
  return (
    <View style={styles.dayRow}>
      <TText variant="caption" weight="medium" color="secondary">{label}</TText>
      <View
        style={styles.dayStepper}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: formatDay(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment' && !atMax) move(1);
          if (e.nativeEvent.actionName === 'decrement' && !atMin) move(-1);
        }}
      >
        <StepButton icon="play-back-outline" label={`${label} : une semaine plus tôt`} disabled={atMin} onPress={() => move(-7)} />
        <StepButton icon="remove" label={`${label} : un jour plus tôt`} disabled={atMin} onPress={() => move(-1)} />
        <TText variant="bodySmall" weight="medium" tabular numberOfLines={2} style={styles.dayValue}>
          {formatDay(value)}
        </TText>
        <StepButton icon="add" label={`${label} : un jour plus tard`} disabled={atMax} onPress={() => move(1)} />
        <StepButton icon="play-forward-outline" label={`${label} : une semaine plus tard`} disabled={atMax} onPress={() => move(7)} />
      </View>
    </View>
  );
}

export default function NewGuestSpotScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  if (!user || user.role !== 'artist' || !user.artistId) {
    return (
      <View style={styles.container}>
        <THeader title="Annoncer un guest" showBack />
        <EmptyState
          icon="airplane-outline"
          title="Réservé aux tatoueurs"
          description={user?.role === 'artist'
            ? 'Terminez votre profil d’artiste pour annoncer un guest.'
            : 'Seuls les artistes peuvent annoncer un guest.'}
          ctaLabel="Fermer"
          onCta={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        />
      </View>
    );
  }

  return <GuestForm artistId={user.artistId} />;
}

function GuestForm({ artistId }: { artistId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const today = startOfDay(new Date());
  const [hostCity, setHostCity] = useState('');
  const [hostStudio, setHostStudio] = useState('');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(addDays(today, 2));
  const [priceText, setPriceText] = useState('');
  const [slots, setSlots] = useState(4);
  const [description, setDescription] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [artistCity, setArtistCity] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [publishing, setPublishing] = useState(false);

  // The home city tells visitors where the artist usually works; optional.
  useEffect(() => {
    let active = true;
    supabase.from('artists').select('city').eq('id', artistId).maybeSingle()
      .then(({ data }) => { if (active && data?.city?.trim()) setArtistCity(data.city.trim()); }, () => {});
    return () => { active = false; };
  }, [artistId]);

  const price = parseEuros(priceText);
  const priceError = Number.isNaN(price) ? 'Un prix en euros, sans centimes.' : undefined;
  const lengthDays = Math.round((dateTo.getTime() - dateFrom.getTime()) / 86_400_000) + 1;

  const changeStart = (d: Date) => {
    setDateFrom(d);
    // The end follows the start so the range always stays valid.
    if (dateTo < d) setDateTo(d);
    else if (dateTo > addDays(d, MAX_LENGTH_DAYS - 1)) setDateTo(addDays(d, MAX_LENGTH_DAYS - 1));
    setFormError(null);
  };

  const handlePublish = async () => {
    if (publishing) return;
    const draft: Partial<GuestSpotInput> = {
      hostCity, hostStudio, dateFrom, dateTo, priceFrom: price ?? undefined,
      description, coverImageUrl: coverUri ?? undefined, slotsTotal: slots,
    };
    const invalid = guestSpotInputError(draft);
    if (invalid) { setFormError(invalid); return; }
    if (!coverUri || price === null) return;

    setFormError(null);
    setPublishing(true);
    setProgress(0);
    try {
      const { url } = await uploadPostMedia(coverUri, artistId, setProgress);
      const error = await createGuestSpot(artistId, {
        hostCity, hostStudio, dateFrom, dateTo, priceFrom: price,
        description, coverImageUrl: url, slotsTotal: slots, artistCity,
      });
      if (error) { setFormError(error); return; }
      Toast.success('Guest annoncé');
      if (router.canGoBack()) router.back();
      else router.replace({ pathname: '/artist/[id]', params: { id: artistId } });
    } catch (e: any) {
      const detail = String(e?.message ?? e);
      console.warn('[guest] publish failed:', detail);
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
        value={coverUri}
        onPicked={(uri) => { setCoverUri(uri); setFormError(null); }}
        aspect={[4, 3]}
        placeholder="Ajouter une image de couverture"
      />
      <TText variant="caption" color="tertiary" style={styles.pickerHint}>
        Le studio, une pièce récente ou un flash disponible sur place.
      </TText>
    </View>
  );

  const form = (
    <View>
      <TInput
        label="Ville"
        value={hostCity}
        onChangeText={(t) => { setHostCity(t); setFormError(null); }}
        placeholder="Lyon"
        autoCapitalize="words"
        maxLength={80}
      />
      <TInput
        label="Studio d’accueil"
        value={hostStudio}
        onChangeText={(t) => { setHostStudio(t); setFormError(null); }}
        placeholder="Nom du studio"
        maxLength={80}
      />

      <View style={styles.dates}>
        <View style={styles.datesHead}>
          <TText variant="label" color="tertiary" uppercase>Dates</TText>
          <TText variant="caption" color="tertiary" tabular>
            {lengthDays} jour{lengthDays > 1 ? 's' : ''}
          </TText>
        </View>
        <DayStepper
          label="Du"
          value={dateFrom}
          min={today}
          max={addDays(today, MAX_DAYS_AHEAD)}
          onChange={changeStart}
        />
        <DayStepper
          label="Au"
          value={dateTo}
          min={dateFrom}
          max={addDays(dateFrom, MAX_LENGTH_DAYS - 1)}
          onChange={(d) => { setDateTo(d); setFormError(null); }}
        />
      </View>

      <TInput
        label="Prix à partir de"
        value={priceText}
        onChangeText={(t) => { setPriceText(t); setFormError(null); }}
        placeholder="150"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={6}
        error={priceError}
        rightElement={<TText variant="bodySmall" color="tertiary">€</TText>}
      />

      <View style={styles.stepperRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <TText variant="body" weight="medium">Places</TText>
          <TText variant="caption" color="tertiary" style={{ marginTop: 2 }}>Le nombre de projets que vous prenez sur place.</TText>
        </View>
        <View
          style={styles.stepper}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Places"
          accessibilityValue={{ min: MIN_SLOTS, max: MAX_SLOTS, now: slots }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'increment') setSlots((n) => Math.min(MAX_SLOTS, n + 1));
            if (e.nativeEvent.actionName === 'decrement') setSlots((n) => Math.max(MIN_SLOTS, n - 1));
          }}
        >
          <StepButton icon="remove" label="Une place de moins" disabled={slots <= MIN_SLOTS} onPress={() => setSlots((n) => Math.max(MIN_SLOTS, n - 1))} />
          <TText variant="title2" serif tabular style={styles.stepValue}>{slots}</TText>
          <StepButton icon="add" label="Une place de plus" disabled={slots >= MAX_SLOTS} onPress={() => setSlots((n) => Math.min(MAX_SLOTS, n + 1))} />
        </View>
      </View>

      <TInput
        label="Description"
        value={description}
        onChangeText={(t) => { setDescription(t); setFormError(null); }}
        placeholder="Flashs disponibles, projets sur mesure, comment réserver…"
        multiline
        numberOfLines={4}
        maxLength={MAX_DESCRIPTION}
        inputStyle={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 14 }}
        helper={description.length > MAX_DESCRIPTION - 100 ? `${description.length} / ${MAX_DESCRIPTION}` : undefined}
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
        title={publishing ? 'Publication…' : 'Annoncer le guest'}
        onPress={() => { void handlePublish(); }}
        loading={publishing}
        disabled={publishing}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <THeader title="Annoncer un guest" showBack />
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
  colMedia: { flex: 1, maxWidth: 480 },
  colForm: { flex: 1, maxWidth: Layout.maxReading },
  formStacked: { marginTop: Spacing.lg },

  pickerHint: { marginTop: Spacing['2xs'] },

  dates: {
    marginBottom: Spacing.md, paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  datesHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing['2xs'] },
  dayRow: { marginTop: Spacing.xs, gap: 6 },
  dayStepper: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 6, borderRadius: Radius.lg,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderColor: Colors.borderDefault,
  },
  dayValue: { flex: 1, textAlign: 'center' },

  stepperRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs, marginBottom: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2xs'] },
  stepBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  stepBtnDisabled: { opacity: 0.38 },
  stepValue: { minWidth: 32, textAlign: 'center', fontSize: 22 },

  progressWrap: { marginBottom: Spacing.md },
  formError: { marginBottom: Spacing.sm },
});
