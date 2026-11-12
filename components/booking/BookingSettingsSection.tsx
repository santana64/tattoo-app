import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { Toast } from '@/components/ui/TToast';
import { enterUp } from '@/components/motion';
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
  /** Entrance order in the page. */
  index?: number;
}

type Draft = { timezone: string; durations: number[]; notice: number };

const sortNumbers = (list: number[]) => [...list].sort((a, b) => a - b);
const draftFrom = (s: BookingSettings): Draft => ({
  timezone: s.timezone,
  durations: sortNumbers(s.sessionDurations),
  notice: s.cancelNoticeHours,
});

const tap = () => { if (Platform.OS !== 'web') Haptics.selectionAsync(); };

function Chip({ label, selected, onPress, role }: { label: string; selected: boolean; onPress: () => void; role: 'radio' | 'checkbox' }) {
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'checkbox' ? { checked: selected } : { selected, checked: selected }}
      style={(state) => {
        const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
        return [styles.chip, (pressed || hovered) && !selected && styles.chipHover, selected && styles.chipSelected];
      }}
    >
      <TText variant="caption" weight="medium" style={{ fontSize: 13, color: selected ? Colors.textInverse : Colors.textSecondary }}>
        {label}
      </TText>
    </Pressable>
  );
}

function Field({ label, helper, children, last }: { label: string; helper?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View style={[styles.field, !last && styles.fieldDivider]}>
      <TText variant="bodySmall" weight="semibold">{label}</TText>
      {children}
      {!!helper && <TText variant="caption" color="tertiary">{helper}</TText>}
    </View>
  );
}

/** Time zone, session lengths, cancellation notice and approximate location of an artist. */
export function BookingSettingsSection({ artistId, onSettings, index = 1 }: BookingSettingsSectionProps) {
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
      <Animated.View entering={enterUp(index)} style={styles.section}>
        <SectionHead />
        {state === 'error' ? (
          <View style={styles.inlineError} accessibilityRole="alert">
            <TText variant="bodySmall" color="secondary" style={{ flex: 1 }}>Vos réglages de réservation n’ont pas pu être chargés.</TText>
            <TButton title="Réessayer" variant="secondary" size="sm" fullWidth={false} onPress={() => setAttempt((n) => n + 1)} />
          </View>
        ) : (
          <View style={[styles.card, { gap: Spacing.sm, paddingVertical: Spacing.sm }]}>
            <TSkeleton width="40%" height={14} />
            <TSkeleton height={36} radius={Radius.full} />
            <TSkeleton width="50%" height={14} />
            <TSkeleton height={36} radius={Radius.full} />
          </View>
        )}
      </Animated.View>
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
    <Animated.View entering={enterUp(index)} style={styles.section}>
      <SectionHead />

      <View style={styles.card}>
        <Field label="Fuseau horaire" helper="Vos horaires d’ouverture et vos créneaux sont lus dans ce fuseau.">
          <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Fuseau horaire">
            {timezones.map((t) => (
              <Chip key={t.id} role="radio" label={t.label} selected={draft.timezone === t.id} onPress={() => update({ timezone: t.id })} />
            ))}
          </View>
        </Field>

        <Field
          label="Durées de séance proposées"
          helper="Le client choisit parmi ces durées en réservant. La plus courte sert à l’aperçu « Ce que voient les clients »."
        >
          <View style={styles.wrap}>
            {DURATION_CHOICES.map((m) => (
              <Chip key={m} role="checkbox" label={durationLabel(m)} selected={draft.durations.includes(m)} onPress={() => toggleDuration(m)} />
            ))}
          </View>
        </Field>

        <Field
          last
          label="Délai d’annulation"
          helper={draft.notice > 0
            ? `Un client peut annuler ou déplacer une séance confirmée jusqu’à ${noticeDeadline(draft.notice)}. Passé ce délai, il doit vous écrire.`
            : 'Un client peut annuler ou déplacer une séance confirmée jusqu’au début de celle-ci.'}
        >
          <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Délai d’annulation">
            {NOTICE_CHOICES.map((h) => (
              <Chip key={h} role="radio" label={noticeLabel(h)} selected={draft.notice === h} onPress={() => update({ notice: h })} />
            ))}
          </View>
        </Field>

        <View style={styles.saveRow}>
          {!!(saveError ?? (dirty ? validation : null)) && (
            <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="assertive">
              <Ionicons name="alert-circle-outline" size={16} color={Colors.errorLight} />
              <TText variant="caption" style={{ color: Colors.errorLight, flex: 1 }}>{saveError ?? validation}</TText>
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
      <View style={[styles.card, styles.locationCard]}>
        <View style={styles.locationHead}>
          <View style={[styles.dot, { backgroundColor: located ? Colors.success : Colors.textTertiary }]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <TText variant="bodySmall" weight="semibold" accessibilityLiveRegion="polite">
              {located ? 'Visible dans la recherche à proximité' : 'Non localisé'}
            </TText>
            <TText variant="caption" color="tertiary" numberOfLines={1}>
              {placeLabel ?? (city ? `Ville du profil : ${city}` : 'Aucune ville indiquée dans votre profil')}
            </TText>
          </View>
        </View>
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
            size="sm"
            fullWidth={false}
            disabled={!city || !!locating}
            loading={locating === 'locate'}
            onPress={locate}
            icon={<Ionicons name="location-outline" size={15} color={Colors.textPrimary} />}
          />
          {located && (
            <TButton
              title="Retirer"
              variant="ghost"
              size="sm"
              fullWidth={false}
              disabled={!!locating}
              loading={locating === 'clear'}
              onPress={clearLocation}
              accessibilityLabel="Retirer ma position de la recherche à proximité"
            />
          )}
        </View>
      </View>
    </Animated.View>
  );
}

function SectionHead() {
  return (
    <View style={styles.sectionHead}>
      <TText variant="label" color="accentWarm" uppercase>Réservation</TText>
      <TText variant="title2" serif accessibilityRole="header" style={styles.sectionTitle}>Réglages de réservation</TText>
      <TText variant="bodySmall" color="secondary" style={{ marginTop: 4 }}>
        Durées proposées, délai d’annulation et visibilité près de chez vos clients.
      </TText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: Spacing.lg },
  sectionHead: { marginBottom: Spacing.sm },
  sectionTitle: { fontSize: 24, lineHeight: 28, marginTop: 4 },

  card: {
    borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated, paddingHorizontal: Spacing.sm,
  },
  field: { paddingVertical: Spacing.sm, gap: Spacing['2xs'] },
  fieldDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 36, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderDefault,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  chipHover: { backgroundColor: Colors.glassBgMid },
  chipSelected: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },

  saveRow: {
    paddingVertical: Spacing.sm, gap: Spacing['2xs'],
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderSubtle,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  locationCard: { marginTop: Spacing.sm, paddingVertical: Spacing.sm, gap: Spacing['2xs'] },
  locationHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dot: { width: 6, height: 6, borderRadius: 3 },
  locationActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing['2xs'], marginTop: Spacing['3xs'] },

  inlineError: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    padding: Spacing.sm, borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
});
