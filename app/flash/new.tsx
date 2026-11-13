import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TChip } from '@/components/ui/TChip';
import { THeader } from '@/components/ui/THeader';
import { TImagePicker } from '@/components/ui/TImagePicker';
import { TProgressBar } from '@/components/ui/TProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArtistRouteLoading } from '@/components/ArtistRouteLoading';
import { Toast } from '@/components/ui/TToast';
import { Kicker, Masthead, PageWrap, Rule, SettingRow, Toggle } from '@/components/v5';
import { CartelPreview, Panel, StepControl } from '@/components/v5/studio';
import { useAuthStore } from '@/store/auth-store';
import { useContentDimensions } from '@/hooks/useContentDimensions';
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

/** 150 → "2 h 30". */
const hoursLabel = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
};

const STYLE_NAMES = new Map(STYLES.map((s) => [s.slug, s.name]));

export default function NewFlashScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  if (isLoading) return <ArtistRouteLoading title="Nouveau flash" />;

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
  const { isWide } = useContentDimensions();

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
    <TImagePicker
      value={imageUri}
      onPicked={(uri) => { setImageUri(uri); setFormError(null); }}
      aspect={[3, 4]}
      fillAspect
      placeholder="Ajouter le dessin du flash"
      hint="Le dessin tel qu’il sera tatoué, sur fond neutre, format portrait 3:4."
    />
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

      <TText variant="caption" weight="semibold" style={styles.fieldLabel}>Style</TText>
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
        rightElement={<TText variant="bodySmall" color="secondary">€</TText>}
      />

      <Rule tone="ink" />
      {/* Copies */}
      <View style={styles.stepperRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <TText variant="displayS" style={styles.rowTitle}>Exemplaires</TText>
          <TText variant="caption" color="secondary" style={{ marginTop: 2 }}>1 = pièce unique</TText>
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
          <StepControl icon="remove" label="Un exemplaire de moins" disabled={copies <= MIN_COPIES} onPress={() => setCopies((n) => Math.max(MIN_COPIES, n - 1))} />
          <TText variant="displayS" tabular style={styles.stepValue}>{copies}</TText>
          <StepControl icon="add" label="Un exemplaire de plus" disabled={copies >= MAX_COPIES} onPress={() => setCopies((n) => Math.min(MAX_COPIES, n + 1))} />
        </View>
      </View>

      {/* Colour */}
      <SettingRow
        title="Couleur"
        description={isColor ? 'Tatoué en couleur.' : 'Tatoué en noir et gris.'}
        right={(
          <Toggle
            value={isColor}
            label="Couleur"
            onChange={(next) => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsColor(next);
            }}
          />
        )}
      />

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
        rightElement={<TText variant="bodySmall" color="secondary">heures</TText>}
        containerStyle={{ marginTop: Spacing.md }}
      />
    </View>
  );

  const preview = (
    <CartelPreview
      kicker="Aperçu / Flash"
      title={title}
      rows={[
        { label: 'Style', value: style ? STYLE_NAMES.get(style) ?? style : null },
        { label: 'Prix', value: price !== null && !Number.isNaN(price) ? `${price.toLocaleString('fr-FR')} €` : null },
        { label: 'Exemplaires', value: copies === 1 ? 'Pièce unique' : `${copies} exemplaires` },
        { label: 'Encre', value: isColor ? 'Couleur' : 'Noir et gris' },
        { label: 'Durée estimée', value: duration !== null && !Number.isNaN(duration) ? hoursLabel(duration) : null },
        { label: 'Emplacement conseillé', value: bodyZone },
      ]}
    />
  );

  const submit = (
    <View>
      {publishing && (
        <View style={styles.progressWrap}>
          <TProgressBar progress={progress} color={Colors.flame} />
          <TText variant="caption" color="secondary" tabular style={{ marginTop: 6 }}>
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
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PageWrap>
          <Masthead
            kicker="Flash / Nouveau"
            title="Dessiné pour"
            emphasis="être porté."
            breakEmphasis
            description="Un flash indique son style, son prix, le nombre d’exemplaires et la façon dont il est tatoué."
          />
          {isWide ? (
            <View style={styles.columns}>
              <Panel style={styles.colForm}>
                {form}
                <Rule tone="ink" style={{ marginVertical: Spacing.md }} />
                {submit}
              </Panel>
              <View style={styles.colPreview}>
                <Kicker tone="muted" style={{ marginBottom: Spacing.sm }}>Aperçu / Avant envoi</Kicker>
                {picker}
                <View style={{ marginTop: Spacing.lg }}>{preview}</View>
              </View>
            </View>
          ) : (
            <>
              {picker}
              <View style={styles.formStacked}>{form}</View>
              <Rule tone="ink" style={{ marginTop: Spacing.md }} />
              <View style={{ paddingVertical: Spacing.lg }}>{preview}</View>
              {submit}
            </>
          )}
        </PageWrap>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  columns: { flexDirection: 'row', gap: Spacing['2xl'], alignItems: 'flex-start' },
  colForm: { flex: 1.25, minWidth: 0 },
  colPreview: { flex: 1, minWidth: 0, maxWidth: 440 },
  formStacked: { marginTop: Spacing.lg },

  fieldLabel: { marginBottom: 8, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },

  stepperRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  rowTitle: { fontSize: 24, lineHeight: 28, letterSpacing: -0.4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2xs'] },
  stepValue: { minWidth: 36, textAlign: 'center', fontSize: 28, lineHeight: 30 },

  progressWrap: { marginBottom: Spacing.md },
  formError: { marginBottom: Spacing.sm },
});
