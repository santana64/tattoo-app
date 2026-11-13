import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TProgressBar } from '@/components/ui/TProgressBar';
import { THeader } from '@/components/ui/THeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { TChip } from '@/components/ui/TChip';
import { RevealImage } from '@/components/motion';
import { Kicker, Masthead, PageWrap, Rule, SettingRow, Toggle } from '@/components/v5';
import { CartelPreview, OptionChip, Panel, Segmented } from '@/components/v5/studio';
import { useAuthStore, type AppUser } from '@/store/auth-store';
import { useContentDimensions } from '@/hooks/useContentDimensions';
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

const STYLE_NAMES = new Map(STYLES.map((s) => [s.slug, s.name]));

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
  const { isWide } = useContentDimensions();
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
      router.replace('/(tabs)/profile');
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
    <Segmented
      role="tab"
      accessibilityLabel="Type de média"
      value={kind}
      onChange={setKind}
      disabled={isPublishing}
      options={MEDIA_KINDS.map((o) => ({ value: o.value, label: o.label, icon: o.icon }))}
      style={styles.kinds}
    />
  );

  const videoSeconds = video?.durationMs ? Math.round(video.durationMs / 1000) : null;
  const mediaArea = kind === 'link' ? (
    <View style={styles.linkPanel} accessibilityLiveRegion="polite">
      <View style={styles.iconFrame}>
        <Ionicons name={reel ? (reel.provider === 'tiktok' ? 'logo-tiktok' : 'logo-instagram') : 'link-outline'} size={22} color={Colors.ink} />
      </View>
      <TText variant="bodySmall" weight="semibold" style={styles.center}>
        {reel ? `Vidéo ${REEL_PROVIDER_LABEL[reel.provider]} reconnue` : 'Vidéo TikTok ou reel Instagram'}
      </TText>
      <TText variant="caption" color="secondary" style={styles.center}>
        {reel ? 'Elle sera lue depuis votre profil et le fil.' : 'Collez son adresse dans le formulaire.'}
      </TText>
    </View>
  ) : (
    <Pressable
      onPress={handlePickMedia}
      disabled={isPublishing}
      accessibilityRole="button"
      accessibilityLabel={kind === 'video'
        ? (video ? 'Changer la vidéo' : 'Sélectionner une vidéo')
        : (mediaUri ? 'Changer la photo' : 'Sélectionner une photo')}
      style={(state) => [
        styles.mediaPicker,
        (kind === 'photo' ? mediaUri : video) ? styles.mediaPickerFilled : null,
        Platform.OS === 'web' && ({ cursor: 'pointer' } as object),
        (state as { hovered?: boolean }).hovered && !(kind === 'photo' && mediaUri) && { backgroundColor: Colors.wash },
      ]}
    >
      {kind === 'photo' && mediaUri ? (
        <>
          <RevealImage uri={mediaUri} style={StyleSheet.absoluteFill} accessibilityLabel="Aperçu de la réalisation" />
          <View style={styles.changePlate}>
            <Ionicons name="camera-outline" size={14} color={Colors.ink} />
            <TText variant="label" weight="bold" uppercase style={styles.plateText}>Changer la photo</TText>
          </View>
        </>
      ) : kind === 'video' && video ? (
        <View style={styles.mediaPlaceholder}>
          <View style={styles.iconFrame}>
            <Ionicons name="checkmark" size={22} color={Colors.ink} />
          </View>
          <TText variant="bodySmall" weight="semibold">Vidéo sélectionnée</TText>
          <TText variant="caption" color="secondary" tabular>
            {videoSeconds ? `${videoSeconds} s · ` : ''}Appuyez pour en choisir une autre
          </TText>
        </View>
      ) : (
        <View style={styles.mediaPlaceholder}>
          <View style={styles.iconFrame}>
            <Ionicons name="add" size={22} color={Colors.ink} />
          </View>
          <TText variant="bodySmall" weight="semibold">
            {kind === 'video' ? 'Sélectionner une vidéo' : 'Sélectionner une photo'}
          </TText>
          <TText variant="caption" color="secondary" style={styles.center}>
            {kind === 'video'
              ? `Verticale, ${MAX_VIDEO_SECONDS} s et 50 Mo maximum`
              : 'Format portrait 4:5 recommandé'}
          </TText>
        </View>
      )}
    </Pressable>
  );

  const form = (
    <View>
      {kindSwitch}

      {kind === 'link' && (
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
      )}

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
        <Kicker>Styles</Kicker>
        <TText variant="caption" color="secondary" tabular accessibilityLiveRegion="polite">
          {selectedStyles.length} / {MAX_STYLES}
        </TText>
      </View>
      <View style={styles.stylesGrid}>
        {STYLES.map((style) => {
          const isSelected = selectedStyles.includes(style.slug);
          const isDisabled = !isSelected && selectedStyles.length >= MAX_STYLES;
          return (
            <OptionChip
              key={style.id}
              role="checkbox"
              label={style.name}
              selected={isSelected}
              disabled={isDisabled}
              onPress={() => toggleStyle(style.slug)}
            />
          );
        })}
      </View>

      {/* ── Cartel: the wall label of the piece ── */}
      <View style={styles.cartel}>
        <View style={styles.tagsHeader}>
          <Kicker>Cartel</Kicker>
          <TText variant="caption" color="secondary">Optionnel</TText>
        </View>
        <TText variant="caption" color="secondary" style={styles.cartelLead}>
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
              rightElement={<TText variant="bodySmall" color="secondary">heures</TText>}
            />
            <View style={styles.toggleRow}>
              <SettingRow
                title="Photo cicatrisée"
                description="La pièce a été photographiée une fois guérie."
                right={(
                  <Toggle
                    value={isHealed}
                    label="Photo cicatrisée"
                    onChange={(next) => {
                      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsHealed(next);
                    }}
                  />
                )}
              />
            </View>
          </>
        )}

        <TText variant="caption" weight="semibold" style={styles.seriesLabel}>Série</TText>
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
          <View style={styles.newSeries}>
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
          </View>
        )}
      </View>
    </View>
  );

  // What the post will carry, read back before sending.
  const seriesTitle = seriesList.find((s) => s.id === seriesId)?.title;
  const preview = (
    <CartelPreview
      title={title}
      rows={[
        { label: 'Média', value: kind === 'photo' ? (mediaUri ? 'Photo' : null) : kind === 'video' ? (video ? 'Vidéo' : null) : (reel ? `Lien ${REEL_PROVIDER_LABEL[reel.provider]}` : null) },
        { label: 'Emplacement', value: isPhoto ? bodyZone : null },
        { label: 'Durée de séance', value: isPhoto && sessionHours !== null && !Number.isNaN(sessionHours) ? `${sessionHours.toLocaleString('fr-FR')} h` : null },
        { label: 'État', value: isPhoto && isHealed ? 'Cicatrisé' : null },
        { label: 'Styles', value: selectedStyles.map((slug) => STYLE_NAMES.get(slug) ?? slug).join(', ') },
        { label: 'Série', value: seriesTitle },
      ]}
      note={caption.trim() ? `« ${caption.trim()} »` : 'Sans légende.'}
    />
  );

  const submit = (
    <View style={styles.submit}>
      {isPublishing && kind !== 'link' && (
        <View style={styles.progressWrap}>
          <TProgressBar progress={uploadProgress} color={Colors.flame} />
          <TText variant="caption" color="secondary" tabular style={{ marginTop: 6 }}>
            Envoi en cours… {Math.round(uploadProgress * 100)} %
          </TText>
        </View>
      )}

      <TButton
        title={isPublishing ? 'Publication…' : 'Publier'}
        onPress={handlePublish}
        loading={isPublishing}
        disabled={!canPublish || isPublishing}
      />
      {!canPublish && (
        <TText variant="caption" color="secondary" style={{ textAlign: 'center', marginTop: Spacing['2xs'] }}>
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
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PageWrap>
          <Masthead
            kicker="Publication / Œuvre"
            title="Une pièce."
            emphasis="Une histoire."
            breakEmphasis
            description="Publiez une réalisation avec son contexte : le média, quelques styles et, si vous le souhaitez, son cartel."
          />
          {isWide ? (
            <View style={styles.columns}>
              <Panel style={styles.colForm}>
                {form}
                <Rule tone="ink" style={{ marginBottom: Spacing.md }} />
                {submit}
              </Panel>
              <View style={styles.colPreview}>
                <Kicker tone="muted" style={{ marginBottom: Spacing.sm }}>Aperçu / Avant envoi</Kicker>
                {mediaArea}
                <View style={{ marginTop: Spacing.lg }}>{preview}</View>
              </View>
            </View>
          ) : (
            <>
              {mediaArea}
              <View style={styles.formStacked}>{form}</View>
              <Rule tone="ink" />
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
  colPreview: { flex: 1, minWidth: 0, maxWidth: 480 },
  formStacked: { marginTop: Spacing.lg },
  center: { textAlign: 'center' },

  // Media
  kinds: { alignSelf: 'stretch', marginBottom: Spacing.lg },
  linkPanel: {
    alignItems: 'center', justifyContent: 'center', padding: Spacing.md, gap: 8, minHeight: 220,
    borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.white,
  },
  mediaPicker: {
    aspectRatio: 4 / 5,
    maxHeight: 560,
    width: '100%',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.ink,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  mediaPickerFilled: { borderStyle: 'solid', borderColor: Colors.line, backgroundColor: Colors.clay },
  mediaPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: 8, backgroundColor: Colors.white },
  iconFrame: {
    width: 48, height: 48, marginBottom: 4,
    borderWidth: 1, borderColor: Colors.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  changePlate: {
    position: 'absolute', bottom: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.paper, paddingHorizontal: 10, minHeight: 32,
  },
  plateText: { color: Colors.ink, letterSpacing: 0.8 },

  // Style chips
  tagsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  stylesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.lg },

  // Cartel
  cartel: {
    marginBottom: Spacing.lg, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  cartelLead: { marginTop: -4, marginBottom: Spacing.md },
  toggleRow: { marginTop: -Spacing.xs, marginBottom: Spacing.md },
  seriesLabel: { marginBottom: 8, fontSize: 12 },
  seriesRow: { flexDirection: 'row', flexWrap: 'wrap' },
  newSeries: { marginTop: Spacing['2xs'] },

  submit: {},
  progressWrap: { marginBottom: Spacing.md },
});
