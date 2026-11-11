import React, { useEffect, useState } from 'react';
import {
  View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TProgressBar } from '@/components/ui/TProgressBar';
import { THeader } from '@/components/ui/THeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { TChip } from '@/components/ui/TChip';
import { EASE_OUT, MotionDuration, PressableScale, RevealImage, enterUp, fadeIn } from '@/components/motion';
import { useAuthStore, type AppUser } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';
import { pickImage, uploadPostMedia } from '@/lib/storage';
import { pickVideo, uploadPostVideo, type PickedVideo } from '@/lib/video-upload';
import { MAX_VIDEO_SECONDS, parseReelUrl, REEL_PROVIDER_LABEL, videoFileError } from '@/lib/reels';
import { Toast } from '@/components/ui/TToast';
import { useFeedStore } from '@/store/feed-store';
import { STYLES } from '@/constants/tattoo';
import { createSeries, fetchArtistSeries, type ArtistSeries } from '@/lib/studio';

const MAX_STYLES = 3;
const MAX_TITLE = 80;
const MAX_ZONE = 60;
const MAX_SERIES_TITLE = 60;

/** "2,5" or "2.5" → 2.5 (one decimal, as stored); empty → null; anything else → NaN. */
function parseSessionHours(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (!clean) return null;
  if (!/^\d{1,2}(\.\d+)?$/.test(clean)) return NaN;
  const hours = Math.round(Number(clean) * 10) / 10;
  return hours >= 0.5 && hours <= 99 ? hours : NaN;
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

type MediaKind = 'photo' | 'video' | 'link';
const MEDIA_KINDS: { value: MediaKind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'photo', label: 'Photo', icon: 'image-outline' },
  { value: 'video', label: 'Vidéo', icon: 'videocam-outline' },
  { value: 'link', label: 'Lien', icon: 'link-outline' },
];

export default function CreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  // Only artists can post
  if (!user || user.role !== 'artist') {
    return (
      <View style={styles.container}>
        <THeader title="Nouvelle réalisation" showBack />
        <EmptyState
          icon="brush-outline"
          title="Réservé aux tatoueurs"
          description="Seuls les artistes peuvent publier des réalisations."
          ctaLabel="Fermer"
          onCta={() => router.back()}
        />
      </View>
    );
  }

  return <CreateForm user={user} router={router} insets={insets} />;
}

function CreateForm({ user, router, insets }: {
  user: AppUser; router: ReturnType<typeof useRouter>; insets: EdgeInsets;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [kind, setKind] = useState<MediaKind>('photo');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [link, setLink] = useState('');
  const reel = parseReelUrl(link);
  const linkError = link.trim() && !reel
    ? 'Collez l’adresse complète d’une vidéo TikTok ou d’un reel Instagram.'
    : undefined;
  const canPublish = kind === 'photo' ? !!mediaUri : kind === 'video' ? !!video : !!reel;
  const [caption, setCaption] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPublishing, setIsPublishing] = useState(false);

  // ── Cartel (wall label), all optional ──
  const [title, setTitle] = useState('');
  const [bodyZone, setBodyZone] = useState('');
  const [sessionText, setSessionText] = useState('');
  const [isHealed, setIsHealed] = useState(false);
  const [seriesList, setSeriesList] = useState<ArtistSeries[]>([]);
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [newSeriesOpen, setNewSeriesOpen] = useState(false);
  const [newSeriesTitle, setNewSeriesTitle] = useState('');
  const [newSeriesError, setNewSeriesError] = useState<string | null>(null);
  const [creatingSeries, setCreatingSeries] = useState(false);
  const isPhoto = kind === 'photo';
  const sessionHours = parseSessionHours(sessionText);
  const sessionError = isPhoto && Number.isNaN(sessionHours)
    ? 'Indiquez une durée entre 0,5 et 99 heures, par exemple 3,5.'
    : undefined;

  useEffect(() => {
    let active = true;
    if (!user.artistId) return;
    fetchArtistSeries(user.artistId)
      .then((list) => { if (active) setSeriesList(list); })
      // Series are optional: without them the selector only offers to create one.
      .catch(() => {});
    return () => { active = false; };
  }, [user.artistId]);

  const handleCreateSeries = async () => {
    if (!user.artistId || creatingSeries) return;
    setCreatingSeries(true);
    setNewSeriesError(null);
    const { series, error } = await createSeries(user.artistId, newSeriesTitle);
    setCreatingSeries(false);
    if (error || !series) { setNewSeriesError(error ?? 'Création impossible. Réessayez.'); return; }
    setSeriesList((prev) => [...prev, series]);
    setSeriesId(series.id);
    setNewSeriesTitle('');
    setNewSeriesOpen(false);
  };

  const handlePickMedia = async () => {
    if (kind === 'video') {
      const picked = await pickVideo();
      if (!picked) return;
      const refusal = videoFileError(picked);
      if (refusal) {
        Toast.error(refusal);
        return;
      }
      setVideo(picked);
      return;
    }
    const uris = await pickImage({ aspect: [4, 5] });
    if (uris?.[0]) setMediaUri(uris[0]);
  };

  const toggleStyle = (slug: string) => {
    setSelectedStyles((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length < MAX_STYLES
        ? [...prev, slug]
        : prev
    );
  };

  const handlePublish = async () => {
    if (!canPublish || !user?.artistId) return;
    if (sessionError) { Toast.error(sessionError); return; }
    setIsPublishing(true);
    setUploadProgress(0);
    try {
      // Only what a label can say about the medium: videos carry a title and a series.
      // Empty fields are left out, so a post without a cartel never depends on them.
      const label: { title?: string; body_zone?: string; session_hours?: number; is_healed?: boolean; series_id?: string } = {};
      if (title.trim()) label.title = title.trim();
      if (seriesId) label.series_id = seriesId;
      if (isPhoto) {
        if (bodyZone.trim()) label.body_zone = bodyZone.trim();
        if (sessionHours !== null) label.session_hours = sessionHours;
        if (isHealed) label.is_healed = true;
      }
      const common = {
        artist_id: user.artistId,
        caption: caption.trim() || null,
        styles: selectedStyles,
        is_published: true,
        ...label,
      };
      let row;
      if (kind === 'photo' && mediaUri) {
        const { url } = await uploadPostMedia(mediaUri, user.artistId, setUploadProgress);
        row = { ...common, media_url: url };
      } else if (kind === 'video' && video) {
        const uploaded = await uploadPostVideo(video, user.artistId, setUploadProgress);
        row = { ...common, media_url: uploaded.url, media_type: 'video' as const, thumbnail_url: uploaded.thumbnailUrl };
      } else if (kind === 'link' && reel) {
        // The canonical address is what the database accepts (migration 010).
        row = { ...common, media_url: reel.canonicalUrl, media_type: 'video' as const, embed_provider: reel.provider };
      } else {
        return;
      }
      const { error } = await supabase.from('posts').insert(row);
      if (error) throw error;
      Toast.success(kind === 'photo' ? 'Réalisation publiée' : 'Vidéo publiée');
      void useFeedStore.getState().refresh(user.id);
      router.back();
    } catch (e: any) {
      const detail = String(e?.message ?? e);
      console.warn('[create] publish failed:', detail, e);
      Toast.error(/row-level security|unauthorized|403/i.test(detail)
        ? 'Publication refusée par les règles de sécurité. Reconnectez-vous puis réessayez.'
        : /series_not_owned/.test(detail)
          ? 'Cette série n’est plus disponible. Choisissez-en une autre.'
        : /posts_label_check/.test(detail)
          ? 'Le cartel contient une valeur trop longue. Raccourcissez le titre ou l’emplacement.'
        : /^(Vidéo|Format)/.test(detail)
          ? detail
          : /mime|size|payload/i.test(detail)
            ? 'Ce fichier n’est pas accepté. Choisissez une vidéo MP4, MOV ou WebM de 50 Mo maximum.'
            : 'Publication impossible. Vérifiez votre connexion puis réessayez.');
    } finally {
      setIsPublishing(false);
    }
  };

  const kindSwitch = (
    <View style={styles.kinds} accessibilityRole="tablist">
      {MEDIA_KINDS.map((option) => {
        const selected = option.value === kind;
        return (
          <PressableScale
            key={option.value}
            onPress={() => setKind(option.value)}
            disabled={isPublishing}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={[styles.kind, selected && styles.kindSelected]}
          >
            <Ionicons name={option.icon} size={15} color={selected ? Colors.textPrimary : Colors.textTertiary} />
            <TText variant="bodySmall" weight={selected ? 'semibold' : 'medium'} color={selected ? 'primary' : 'tertiary'}>
              {option.label}
            </TText>
          </PressableScale>
        );
      })}
    </View>
  );

  const videoSeconds = video?.durationMs ? Math.round(video.durationMs / 1000) : null;
  const mediaArea = kind === 'link' ? (
    <View style={[styles.mediaPicker, styles.linkPanel]}>
      <View style={styles.addIconRing}>
        <Ionicons name={reel ? (reel.provider === 'tiktok' ? 'logo-tiktok' : 'logo-instagram') : 'link-outline'} size={24} color={Colors.accentWarm} />
      </View>
      <TText variant="body" weight="medium" style={{ marginTop: Spacing.sm, textAlign: 'center' }}>
        {reel ? `Vidéo ${REEL_PROVIDER_LABEL[reel.provider]} reconnue` : 'Vidéo TikTok ou reel Instagram'}
      </TText>
      <TText variant="caption" color="tertiary" style={{ marginTop: 2, textAlign: 'center' }}>
        {reel ? 'Elle sera lue depuis votre profil et le fil.' : 'Collez son adresse ci-dessous.'}
      </TText>
      <View style={styles.linkInput}>
        <TInput
          label="Adresse de la vidéo"
          value={link}
          onChangeText={setLink}
          placeholder="https://www.tiktok.com/@vous/video/…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          inputMode="url"
          error={linkError}
          helper={reel ? 'Lien valide.' : undefined}
        />
      </View>
    </View>
  ) : (
    <PressableScale
      onPress={handlePickMedia}
      disabled={isPublishing}
      accessibilityRole="button"
      accessibilityLabel={kind === 'video'
        ? (video ? 'Changer la vidéo' : 'Sélectionner une vidéo')
        : (mediaUri ? 'Changer la photo' : 'Sélectionner une photo')}
      style={[styles.mediaPicker, (kind === 'photo' ? mediaUri : video) ? styles.mediaPickerFilled : null]}
    >
      {kind === 'photo' && mediaUri ? (
        <>
          <RevealImage uri={mediaUri} style={StyleSheet.absoluteFill} accessibilityLabel="Aperçu de la réalisation" />
          <LinearGradient colors={['rgba(11,10,9,0)', 'rgba(11,10,9,0.65)']} locations={[0.6, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <View style={styles.changeMediaBtn}>
            <Ionicons name="camera-outline" size={15} color={Colors.textPrimary} />
            <TText variant="caption" weight="medium">Changer la photo</TText>
          </View>
        </>
      ) : kind === 'video' && video ? (
        <View style={styles.mediaPlaceholder}>
          <View style={styles.addIconRing}>
            <Ionicons name="checkmark" size={26} color={Colors.accentWarm} />
          </View>
          <TText variant="body" weight="medium" style={{ marginTop: Spacing.sm }}>Vidéo sélectionnée</TText>
          <TText variant="caption" color="tertiary" tabular style={{ marginTop: 2 }}>
            {videoSeconds ? `${videoSeconds} s · ` : ''}Appuyez pour en choisir une autre
          </TText>
        </View>
      ) : (
        <View style={styles.mediaPlaceholder}>
          <View style={styles.addIconRing}>
            <Ionicons name="add" size={26} color={Colors.accentWarm} />
          </View>
          <TText variant="body" weight="medium" style={{ marginTop: Spacing.sm }}>
            {kind === 'video' ? 'Sélectionner une vidéo' : 'Sélectionner une photo'}
          </TText>
          <TText variant="caption" color="tertiary" style={{ marginTop: 2 }}>
            {kind === 'video'
              ? `Verticale, ${MAX_VIDEO_SECONDS} s et 50 Mo maximum`
              : 'Format portrait 4:5 recommandé'}
          </TText>
        </View>
      )}
    </PressableScale>
  );

  const picker = (
    <View>
      {kindSwitch}
      {mediaArea}
    </View>
  );

  const form = (
    <View>
      <TInput
        label="Légende"
        optional
        value={caption}
        onChangeText={setCaption}
        placeholder="L’idée, la zone, le processus…"
        multiline
        numberOfLines={3}
        inputStyle={{ minHeight: 96, textAlignVertical: 'top', paddingTop: 14 }}
      />

      <View style={styles.tagsHeader}>
        <TText variant="label" color="tertiary" uppercase>Styles</TText>
        <TText variant="caption" color="tertiary" tabular accessibilityLiveRegion="polite">
          {selectedStyles.length} / {MAX_STYLES}
        </TText>
      </View>
      <View style={styles.stylesGrid}>
        {STYLES.map((style) => {
          const isSelected = selectedStyles.includes(style.slug);
          const isDisabled = !isSelected && selectedStyles.length >= MAX_STYLES;
          return (
            <PressableScale
              key={style.id}
              onPress={() => !isDisabled && toggleStyle(style.slug)}
              disabled={isDisabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected, disabled: isDisabled }}
              accessibilityLabel={style.name}
              style={[styles.chip, isSelected && styles.chipSelected, isDisabled && styles.chipDisabled]}
            >
              <TText variant="caption" weight="medium" style={{ fontSize: 13, color: isSelected ? Colors.textInverse : Colors.textSecondary }}>
                {style.name}
              </TText>
            </PressableScale>
          );
        })}
      </View>

      {/* ── Cartel: the wall label of the piece ── */}
      <View style={styles.cartel}>
        <View style={styles.tagsHeader}>
          <TText variant="label" color="tertiary" uppercase>Cartel</TText>
          <TText variant="caption" color="tertiary">Optionnel</TText>
        </View>
        <TText variant="caption" color="tertiary" style={styles.cartelLead}>
          {isPhoto
            ? 'Comme l’étiquette au mur d’une galerie : un titre, l’emplacement, la durée de la séance.'
            : 'Un titre et, si vous le souhaitez, la série à laquelle appartient la vidéo.'}
        </TText>

        <TInput
          label="Titre"
          optional
          value={title}
          onChangeText={setTitle}
          placeholder="Sans titre"
          maxLength={MAX_TITLE}
          helper={title.length > MAX_TITLE - 15 ? `${title.length} / ${MAX_TITLE}` : undefined}
        />

        {isPhoto && (
          <>
            <TInput
              label="Emplacement"
              optional
              value={bodyZone}
              onChangeText={setBodyZone}
              placeholder="Avant-bras, omoplate, mollet…"
              maxLength={MAX_ZONE}
            />
            <TInput
              label="Durée de séance"
              optional
              value={sessionText}
              onChangeText={setSessionText}
              placeholder="3,5"
              keyboardType="decimal-pad"
              inputMode="decimal"
              maxLength={5}
              error={sessionError}
              rightElement={<TText variant="bodySmall" color="tertiary">heures</TText>}
            />
            <Pressable
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsHealed((v) => !v);
              }}
              accessibilityRole="switch"
              accessibilityLabel="Photo cicatrisée"
              accessibilityHint="Indique que la pièce a été photographiée une fois cicatrisée."
              accessibilityState={{ checked: isHealed }}
              style={styles.toggleRow}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <TText variant="body" weight="medium">Photo cicatrisée</TText>
                <TText variant="caption" color="tertiary" style={{ marginTop: 2 }}>
                  La pièce a été photographiée une fois guérie.
                </TText>
              </View>
              <Toggle value={isHealed} />
            </Pressable>
          </>
        )}

        <TText variant="caption" weight="medium" color="secondary" style={styles.seriesLabel}>Série</TText>
        <View style={styles.seriesRow}>
          {seriesList.map((s) => (
            <TChip
              key={s.id}
              label={s.title}
              selected={seriesId === s.id}
              onPress={() => setSeriesId((current) => (current === s.id ? null : s.id))}
            />
          ))}
          <TChip
            label="+ Nouvelle série"
            selected={newSeriesOpen}
            onPress={() => { setNewSeriesOpen((v) => !v); setNewSeriesError(null); }}
          />
        </View>
        {newSeriesOpen && (
          <Animated.View entering={fadeIn()} style={styles.newSeries}>
            <TInput
              label="Titre de la série"
              value={newSeriesTitle}
              onChangeText={(text) => { setNewSeriesTitle(text); setNewSeriesError(null); }}
              placeholder="Botanique, Flash d’été…"
              maxLength={MAX_SERIES_TITLE}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => { void handleCreateSeries(); }}
              error={newSeriesError ?? undefined}
              containerStyle={{ marginBottom: Spacing.xs }}
            />
            <TButton
              title="Créer la série"
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => { void handleCreateSeries(); }}
              loading={creatingSeries}
              disabled={!newSeriesTitle.trim() || creatingSeries}
            />
          </Animated.View>
        )}
      </View>

      {isPublishing && kind !== 'link' && (
        <Animated.View entering={fadeIn()} style={styles.progressWrap}>
          <TProgressBar progress={uploadProgress} color={Colors.accentWarm} />
          <TText variant="caption" color="tertiary" tabular style={{ marginTop: 6 }}>
            Envoi en cours… {Math.round(uploadProgress * 100)} %
          </TText>
        </Animated.View>
      )}

      <TButton
        title={isPublishing ? 'Publication…' : 'Publier'}
        onPress={handlePublish}
        loading={isPublishing}
        disabled={!canPublish || isPublishing}
      />
      {!canPublish && (
        <TText variant="caption" color="tertiary" style={{ textAlign: 'center', marginTop: Spacing['2xs'] }}>
          {kind === 'photo' ? 'Ajoutez une photo pour publier.' : kind === 'video' ? 'Ajoutez une vidéo pour publier.' : 'Collez un lien pour publier.'}
        </TText>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <THeader title="Nouvelle réalisation" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.columns, wide && styles.columnsWide]}>
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
  columns: {},
  columnsWide: { flexDirection: 'row', gap: Spacing['2xl'], alignItems: 'flex-start' },
  colMedia: { flex: 1, maxWidth: 520 },
  colForm: { flex: 1, maxWidth: Layout.maxReading },
  formStacked: { marginTop: Spacing.lg },

  // Media picker
  kinds: {
    flexDirection: 'row', gap: 4, padding: 4, marginBottom: Spacing.sm, borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderDefault,
  },
  kind: {
    flex: 1, minHeight: 40, flexDirection: 'row', gap: 6,
    alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm,
  },
  kindSelected: { backgroundColor: Colors.bgElevated },
  linkPanel: { alignItems: 'center', justifyContent: 'center', padding: Spacing.md },
  linkInput: { alignSelf: 'stretch', marginTop: Spacing.md },
  mediaPicker: {
    aspectRatio: 4 / 5,
    maxHeight: 560,
    width: '100%',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.bgElevated,
    overflow: 'hidden',
  },
  mediaPickerFilled: { borderStyle: 'solid', borderColor: Colors.borderSubtle },
  mediaPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  addIconRing: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderGlow,
    backgroundColor: Colors.glassAmber,
    alignItems: 'center', justifyContent: 'center',
  },
  changeMediaBtn: {
    position: 'absolute', bottom: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(11,10,9,0.6)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderBright,
    borderRadius: Radius.full,
    paddingHorizontal: 12, height: 34,
  },

  // Style chips
  tagsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  stylesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.lg },
  chip: {
    height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderDefault,
  },
  chipSelected: { backgroundColor: Colors.accentAction, borderColor: Colors.accentAction },
  chipDisabled: { opacity: 0.38 },

  // Cartel
  cartel: {
    marginBottom: Spacing.lg, paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.borderDefault,
  },
  cartelLead: { marginTop: -4, marginBottom: Spacing.md },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    minHeight: 56, marginBottom: Spacing.md,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as object : null),
  },
  seriesLabel: { marginBottom: 8 },
  seriesRow: { flexDirection: 'row', flexWrap: 'wrap' },
  newSeries: { marginTop: Spacing['2xs'] },

  progressWrap: { marginBottom: Spacing.md },
});
