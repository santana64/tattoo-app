import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { Toast } from '@/components/ui/TToast';
import { Kicker, SectionHead, StatusDot, TextLink } from '@/components/v5';
import { OptionChip, Panel } from '@/components/v5/studio';
import { supabase } from '@/lib/supabase';
import {
  DURATION_CHOICES, NOTICE_CHOICES, TIMEZONE_CHOICES, bookingSettingsError, durationLabel, fetchBookingSettings,
  geocodeCity, noticeLabel, saveArtistLocation, saveBookingSettings, type BookingSettings,
} from '@/lib/care';
import { noticeDeadline } from './booking-copy';

interface BookingSettingsSectionProps {
  artistId: string;
  /** Called once the settings are known (null when they could not be read) and after each save. */
  onSettings?: (settings: BookingSettings | null) => void;
  /** Position of the section in the page (kept for callers; the studio has no entrance motion). */
  index?: number;
}

type Draft = { timezone: string; durations: number[]; notice: number };

const sortNumbers = (list: number[]) => [...list].sort((a, b) => a - b);
const draftFrom = (s: BookingSettings): Draft => ({
  timezone: s.timezone,
  durations: sortNumbers(s.sessionDurations),
  notice: s.cancelNoticeHours,
});

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <TText variant="displayS" style={styles.fieldTitle}>{label}</TText>
      {children}
      {!!helper && <TText variant="caption" color="secondary">{helper}</TText>}
    </View>
  );
}

/** Time zone, session lengths, cancellation notice and approximate location of an artist. */
export function BookingSettingsSection({ artistId, onSettings }: BookingSettingsSectionProps) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState<BookingSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [city, setCity] = useState<string>('');
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [locating, setLocating] = useState<'locate' | 'clear' | null>(null);

  const onSettingsRef = React.useRef(onSettings);
  useEffect(() => { onSettingsRef.current = onSettings; }, [onSettings]);

  useEffect(() => {
    let active = true;
    setState('loading');
    Promise.all([
      fetchBookingSettings(artistId),
      supabase.from('artists').select('city').eq('id', artistId).maybeSingle(),
    ])
      .then(([settings, row]) => {
        if (!active) return;
        if (!settings) throw new Error('booking settings not found');
        setSaved(settings);
        setDraft(draftFrom(settings));
        setCity(row.data?.city?.trim() ?? '');
        setState('ready');
        onSettingsRef.current?.(settings);
      })
      .catch(() => {
        if (!active) return;
        setState('error');
        onSettingsRef.current?.(null);
      });
    return () => { active = false; };
  }, [artistId, attempt]);

  const update = useCallback((patch: Partial<Draft>) => {
    setSaveError(null);
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }, []);

  if (state !== 'ready' || !draft || !saved) {
    return (
      <Panel>
        <Head />
        {state === 'error' ? (
          <View style={styles.inlineError} accessibilityRole="alert">
            <TText variant="bodySmall" color="secondary" style={{ flex: 1 }}>Vos réglages de réservation n’ont pas pu être chargés.</TText>
            <TextLink label="Réessayer" icon="refresh" onPress={() => setAttempt((n) => n + 1)} />
          </View>
        ) : (
          <View style={{ gap: Spacing.sm, paddingVertical: Spacing.md }}>
            <TSkeleton width="40%" height={20} />
            <TSkeleton height={36} />
            <TSkeleton width="50%" height={20} />
            <TSkeleton height={36} />
          </View>
        )}
      </Panel>
    );
  }

  const candidate = { timezone: draft.timezone, sessionDurations: draft.durations, cancelNoticeHours: draft.notice };
  const validation = bookingSettingsError(candidate);
  const dirty = draft.timezone !== saved.timezone
    || draft.durations.join(',') !== sortNumbers(saved.sessionDurations).join(',')
    || draft.notice !== saved.cancelNoticeHours;

  const timezones: { id: string; label: string }[] = TIMEZONE_CHOICES.some((t) => t.id === draft.timezone)
    ? [...TIMEZONE_CHOICES]
    : [{ id: draft.timezone, label: draft.timezone.replace(/_/g, ' ') }, ...TIMEZONE_CHOICES];

  const toggleDuration = (min: number) => {
    const has = draft.durations.includes(min);
    update({ durations: sortNumbers(has ? draft.durations.filter((d) => d !== min) : [...draft.durations, min]) });
  };

  const save = async () => {
    if (!dirty || validation || saving) return;
    setSaving(true); setSaveError(null);
    const error = await saveBookingSettings(candidate);
    setSaving(false);
    if (error) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSaveError(error);
      return;
    }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const next: BookingSettings = { ...saved, ...candidate };
    setSaved(next);
    setDraft(draftFrom(next));
    Toast.success('Réglages enregistrés');
    onSettingsRef.current?.(next);
  };

  // ── Location ──
  const located = saved.latitude !== null && saved.longitude !== null;
  const locate = async () => {
    if (locating || !city) return;
    setLocating('locate');
    try {
      const place = await geocodeCity(city);
      if (!place) { Toast.error(`« ${city} » est introuvable. Vérifiez la ville de votre profil.`); return; }
      const ok = await saveArtistLocation({ latitude: place.latitude, longitude: place.longitude });
      if (!ok) { Toast.error('La position n’a pas pu être enregistrée. Réessayez.'); return; }
      const label = place.label || city;
      setSaved((s) => (s ? { ...s, latitude: place.latitude, longitude: place.longitude } : s));
      setPlaceLabel(label);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.success(`Position enregistrée : ${label}`);
    } catch {
      Toast.error('Le service de localisation ne répond pas. Réessayez.');
    } finally {
      setLocating(null);
    }
  };
  const clearLocation = async () => {
    if (locating) return;
    setLocating('clear');
    const ok = await saveArtistLocation(null);
    setLocating(null);
    if (!ok) { Toast.error('La position n’a pas pu être retirée. Réessayez.'); return; }
    setSaved((s) => (s ? { ...s, latitude: null, longitude: null } : s));
    setPlaceLabel(null);
    Toast.success('Vous n’apparaissez plus dans la recherche à proximité');
  };

  return (
    <Panel>
      <Head />

      <View>
        <Field label="Fuseau horaire" helper="Vos horaires d’ouverture et vos créneaux sont lus dans ce fuseau.">
          <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Fuseau horaire">
            {timezones.map((t) => (
              <OptionChip key={t.id} role="radio" label={t.label} selected={draft.timezone === t.id} onPress={() => update({ timezone: t.id })} />
            ))}
          </View>
        </Field>

        <Field
          label="Durées de séance proposées"
          helper="Le client choisit parmi ces durées en réservant. La plus courte sert à l’aperçu « Ce que voient les clients »."
        >
          <View style={styles.wrap}>
            {DURATION_CHOICES.map((m) => (
              <OptionChip key={m} role="checkbox" label={durationLabel(m)} selected={draft.durations.includes(m)} onPress={() => toggleDuration(m)} />
            ))}
          </View>
        </Field>

        <Field
          label="Délai d’annulation"
          helper={draft.notice > 0
            ? `Un client peut annuler ou déplacer une séance confirmée jusqu’à ${noticeDeadline(draft.notice)}. Passé ce délai, il doit vous écrire.`
            : 'Un client peut annuler ou déplacer une séance confirmée jusqu’au début de celle-ci.'}
        >
          <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Délai d’annulation">
            {NOTICE_CHOICES.map((h) => (
              <OptionChip key={h} role="radio" label={noticeLabel(h)} selected={draft.notice === h} onPress={() => update({ notice: h })} />
            ))}
          </View>
        </Field>

        <View style={styles.saveRow}>
          {!!(saveError ?? (dirty ? validation : null)) && (
            <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="assertive">
              <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
              <TText variant="caption" color="error" style={{ flex: 1 }}>{saveError ?? validation}</TText>
            </View>
          )}
          <TButton
            title="Enregistrer les réglages"
            size="md"
            onPress={save}
            loading={saving}
            disabled={!dirty || !!validation}
          />
        </View>
      </View>

      {/* ── Location ── */}
      <View style={styles.location}>
        <Kicker tone="muted">Recherche à proximité</Kicker>
        <TText variant="displayS" style={styles.fieldTitle}>Localiser ma ville.</TText>
        <View accessibilityLiveRegion="polite">
          <StatusDot
            tone={located ? 'open' : 'closed'}
            label={located ? 'Visible dans la recherche à proximité' : 'Non localisé'}
          />
        </View>
        <TText variant="caption" color="secondary" numberOfLines={1}>
          {placeLabel ?? (city ? `Ville du profil : ${city}` : 'Aucune ville indiquée dans votre profil')}
        </TText>
        <TText variant="caption" color="secondary">
          Seule la position approximative de votre ville est enregistrée, jamais une adresse.
        </TText>
        {!city && (
          <TText variant="caption" color="warning">Indiquez votre ville dans votre profil pour pouvoir être localisé.</TText>
        )}
        <View style={styles.locationActions}>
          <TButton
            title={located ? 'Relocaliser ma ville' : 'Localiser ma ville'}
            variant="secondary"
            size="md"
            fullWidth={false}
            disabled={!city || !!locating}
            loading={locating === 'locate'}
            onPress={locate}
            icon={<Ionicons name="location-outline" size={15} color={Colors.ink} />}
          />
          {located && (
            <TButton
              title="Retirer"
              variant="ghost"
              size="md"
              fullWidth={false}
              disabled={!!locating}
              loading={locating === 'clear'}
              onPress={clearLocation}
              accessibilityLabel="Retirer ma position de la recherche à proximité"
            />
          )}
        </View>
      </View>
    </Panel>
  );
}

function Head() {
  return (
    <SectionHead
      kicker="02 / Réservation"
      title="Vos réglages."
      description="Fuseau horaire, durées proposées, délai d’annulation et visibilité près de chez vos clients."
      style={{ marginBottom: Spacing.md }}
    />
  );
}

const styles = StyleSheet.create({
  field: { paddingVertical: Spacing.md, gap: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.line },
  fieldTitle: { fontSize: 24, lineHeight: 27, letterSpacing: -0.4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  saveRow: { paddingVertical: Spacing.md, gap: Spacing['2xs'], borderTopWidth: 1, borderTopColor: Colors.line },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  location: { paddingTop: Spacing.md, gap: Spacing['2xs'], borderTopWidth: 1, borderTopColor: Colors.ink },
  locationActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing['2xs'], marginTop: Spacing.xs },

  inlineError: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.ink,
  },
});
