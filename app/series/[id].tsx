import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Colors, Layout, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { ShareButton } from '@/components/ui/ShareButton';
import { enterUp } from '@/components/motion';
import { Kicker, Rule, TextLink } from '@/components/v5';
import { ArtworkLabel } from '@/components/gallery/ArtworkLabel';
import { Lightbox, type LightboxItem } from '@/components/gallery/Lightbox';
import { PlateMark, WorkPlate } from '@/components/gallery/WorkPlate';
import { styleName } from '@/components/ArtistCard';
import { isVideoMedia } from '@/components/PostCard';
import { Seo } from '@/components/Seo';
import { useAuthStore } from '@/store/auth-store';
import { supabase, type Tables } from '@/lib/supabase';
import { isUuid } from '@/lib/catalog';
import { toDescription } from '@/lib/site';
import { artworkLabel, type ArtistSeries } from '@/lib/studio';

const WORKS_MAX = 200;
const DESCRIPTION_MAX = 400;
/** Wide screens hang the pieces three by three, each a step lower: the "picture film". */
const FILM = 3;
const FILM_GAP = 24;
const FILM_STEPS = [0, 72, 136];

type SeriesArtist = Pick<Tables<'artists'>, 'id' | 'blaze' | 'city'>;
type Work = Tables<'posts'>;

interface Exhibition {
  series: ArtistSeries;
  artist: SeriesArtist | null;
  works: Work[];
}

interface FilmRow { key: string; items: { work: Work; index: number }[] }

const pieces = (n: number) => (n === 0 ? 'Aucune pièce' : n === 1 ? '1 pièce' : `${n} pièces`);
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Same wording as the static page written by scripts/postexport-web.js. */
function seriesDescription(series: ArtistSeries, artist: SeriesArtist | null): string {
  const text = series.description?.trim();
  if (text) return toDescription(text);
  const blaze = artist?.blaze ?? 'un artiste Inkr';
  const city = artist?.city?.trim();
  return toDescription(`Série « ${series.title} » de ${blaze}${city ? `, tatoueur à ${city}` : ''}. Découvrez l’exposition sur Inkr.`);
}

function toLightboxItem(work: Work): LightboxItem {
  const label = artworkLabel(work, styleName);
  return { id: work.id, uri: work.media_url, title: label.title, subtitle: label.lines[0] ?? null };
}

function useWorkFrame() {
  const { width, height, isWide, gutter } = useContentDimensions();
  const innerW = Math.min(width, Layout.maxContent) - gutter * 2;
  const filmW = (innerW - FILM_GAP * (FILM - 1)) / FILM;
  const artH = isWide
    ? Math.round(filmW * 1.25)
    : Math.round(Math.min(width * 1.25, height * 0.72));
  return { wide: isWide, artH, filmW, gutter, width };
}

/** Title in the editorial serif; its last word in vermilion italic, as on every v5 masthead. */
function ExhibitionTitle({ title, size }: { title: string; size: number }) {
  const words = title.trim().split(/\s+/);
  const type = { fontSize: size, lineHeight: Math.round(size * 0.94), letterSpacing: -size * 0.045 };
  const head = words.length > 1 ? words.slice(0, -1).join(' ') : title;
  const tail = words.length > 1 ? words[words.length - 1] : null;
  return (
    <TText variant="displayXL" accessibilityRole="header" style={[type, styles.title]}>
      {head}
      {tail ? <TText variant="displayXL" italic style={[type, { color: Colors.accentGlow }]}>{` ${tail}`}</TText> : null}
    </TText>
  );
}

function SeriesSkeleton() {
  const { wide, artH, filmW, gutter } = useWorkFrame();
  return (
    <View style={styles.container} accessibilityLabel="Chargement de l’exposition">
      <THeader showBack title="Exposition" />
      <View style={[styles.page, { paddingHorizontal: gutter }]}>
        <View style={[styles.intro, wide && styles.introWide]}>
          <TSkeleton width={140} height={10} radius={0} />
          <TSkeleton width="70%" height={wide ? 84 : 48} radius={0} style={{ marginTop: Spacing.md }} />
          <TSkeleton width={160} height={12} radius={0} style={{ marginTop: Spacing.md }} />
        </View>
        {wide ? (
          <View style={styles.filmRow}>
            {FILM_STEPS.map((step) => (
              <TSkeleton key={step} width={filmW} height={artH} radius={0} style={{ marginTop: step }} />
            ))}
          </View>
        ) : (
          <TSkeleton height={artH} radius={0} style={{ marginHorizontal: -gutter }} />
        )}
      </View>
    </View>
  );
}

export default function SeriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [exhibition, setExhibition] = useState<Exhibition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setExhibition(null); setLoading(true); setError(false);
    async function load() {
      try {
        if (!isUuid(id)) return;
        const { data: series, error: seriesError } = await supabase.from('artist_series').select('*').eq('id', id).maybeSingle();
        if (seriesError) throw seriesError;
        if (!series) return;
        const [artist, works] = await Promise.all([
          supabase.from('artists').select('id,blaze,city').eq('id', series.artist_id).maybeSingle(),
          supabase.from('posts').select('*')
            .eq('series_id', series.id).eq('is_published', true).eq('media_type', 'photo')
            .order('published_at', { ascending: false }).limit(WORKS_MAX),
        ]);
        if (artist.error) throw artist.error;
        if (works.error) throw works.error;
        const photos = (works.data ?? []).filter((w) => !isVideoMedia(w.media_url, w.media_type));
        if (active) setExhibition({ series, artist: artist.data, works: photos });
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [id, attempt]);

  if (loading) return <SeriesSkeleton />;
  if (!exhibition) {
    return (
      <View style={styles.container}>
        <THeader showBack title="Exposition" />
        <EmptyState
          icon={error ? 'cloud-offline-outline' : 'albums-outline'}
          title={error ? 'Exposition inaccessible' : 'Exposition introuvable'}
          description={error
            ? 'Le chargement a échoué. Vérifiez votre connexion puis réessayez.'
            : 'Cette série a été retirée ou ce lien n’est plus valide.'}
          ctaLabel={error ? 'Réessayer' : 'Explorer les artistes'}
          onCta={() => (error ? setAttempt((n) => n + 1) : router.replace('/(tabs)/explore'))}
        />
      </View>
    );
  }
  return (
    <ExhibitionContent
      key={exhibition.series.id}
      exhibition={exhibition}
      onSeriesChange={(series) => setExhibition((current) => (current ? { ...current, series } : current))}
    />
  );
}

function ExhibitionContent({ exhibition, onSeriesChange }: {
  exhibition: Exhibition;
  onSeriesChange: (series: ArtistSeries) => void;
}) {
  const { series, artist, works } = exhibition;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { wide, artH, filmW, gutter, width } = useWorkFrame();
  const { user } = useAuthStore();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const isOwner = !!user?.artistId && user.artistId === series.artist_id;
  const blaze = artist?.blaze ?? 'Artiste Inkr';
  const curatorText = series.description?.trim() ?? '';
  const viewerItems = useMemo(() => works.map(toLightboxItem), [works]);
  const rows = useMemo<FilmRow[]>(() => {
    const size = wide ? FILM : 1;
    const out: FilmRow[] = [];
    for (let i = 0; i < works.length; i += size) {
      const items = works.slice(i, i + size).map((work, j) => ({ work, index: i + j }));
      out.push({ key: items[0].work.id, items });
    }
    return out;
  }, [works, wide]);
  const openArtist = () => router.push({ pathname: '/artist/[id]', params: { id: series.artist_id } });

  const startEditing = () => { setDraft(curatorText); setEditing(true); };

  const saveText = async () => {
    const clean = draft.trim();
    if (clean.length > DESCRIPTION_MAX) { Toast.error(`Le texte est limité à ${DESCRIPTION_MAX} caractères.`); return; }
    if (saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('artist_series').update({ description: clean || null }).eq('id', series.id).select().maybeSingle();
      // RLS filters a row the person does not own: no row back means nothing was saved.
      if (error || !data) throw error ?? new Error('not_saved');
      onSeriesChange(data);
      setEditing(false);
      Toast.success('Texte enregistré');
    } catch {
      Toast.error('Le texte n’a pas été enregistré. Réessayez.');
    } finally {
      setSaving(false);
    }
  };

  const titleSize = wide
    ? Math.min(120, Math.max(68, width * 0.075))
    : Math.min(64, Math.max(44, width * 0.13));

  const curator = (
    <Animated.View entering={enterUp(1, 60)} style={wide ? styles.readingWide : styles.reading}>
      {editing ? (
        <View>
          <TInput
            label="Texte de l’exposition"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={DESCRIPTION_MAX}
            placeholder="Présentez cette série : l’idée, la période, ce qui relie ces pièces."
            helper={`${draft.length} / ${DESCRIPTION_MAX}`}
            inputStyle={styles.textArea}
            accessibilityLabel="Texte de l’exposition"
            autoFocus
          />
          <View style={styles.editActions}>
            <TButton title="Enregistrer" size="md" fullWidth={false} loading={saving} disabled={saving} onPress={() => { void saveText(); }} />
            <TButton title="Annuler" variant="ghost" size="md" fullWidth={false} disabled={saving} onPress={() => setEditing(false)} />
          </View>
        </View>
      ) : (
        <>
          {!!curatorText && (
            <TText variant={wide ? 'body' : 'bodySmall'} color="secondary" style={styles.curator}>{curatorText}</TText>
          )}
          {isOwner && !curatorText && (
            <TText variant="bodySmall" color="tertiary" style={styles.curator}>
              Ajoutez quelques lignes pour présenter cette série à vos visiteurs.
            </TText>
          )}
          {isOwner && (
            <TButton
              title={curatorText ? 'Modifier le texte' : 'Écrire le texte'}
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={startEditing}
              icon={<Ionicons name="create-outline" size={15} color={Colors.ink} />}
              style={styles.editButton}
            />
          )}
        </>
      )}
    </Animated.View>
  );

  const intro = (
    <View style={[styles.page, { paddingHorizontal: gutter }]}>
      <View style={[styles.intro, wide && styles.introWide]}>
        <Animated.View entering={enterUp(0, 60)} style={wide ? styles.introMain : undefined}>
          <Kicker tone="flame">{`Exposition · ${pieces(works.length)}`}</Kicker>
          <ExhibitionTitle title={series.title} size={titleSize} />
          <TextLink
            label={`par ${blaze}${artist?.city ? ` · ${artist.city}` : ''}`}
            onPress={openArtist}
            accessibilityLabel={`Voir le profil de ${blaze}`}
            style={styles.artistLink}
          />
        </Animated.View>
        {curator}
      </View>
    </View>
  );

  const cartel = (work: Work, index: number) => {
    const label = artworkLabel(work, styleName);
    return (
      <View style={styles.cartel}>
        <Kicker tone="muted" style={styles.number}>{`${pad2(index + 1)} / ${pad2(works.length)}`}</Kicker>
        <ArtworkLabel post={work} artistName={blaze} />
        <TextLink
          label="Voir la fiche"
          onPress={() => router.push({ pathname: '/post/[id]', params: { id: work.id } })}
          accessibilityLabel={`Voir la fiche de « ${label.title} »`}
          style={styles.workLink}
        />
      </View>
    );
  };

  const piece = (work: Work, index: number, height: number, fit: 'cover' | 'contain') => {
    const label = artworkLabel(work, styleName);
    return (
      <Pressable
        onPress={() => setViewerIndex(index)}
        accessibilityRole="button"
        accessibilityLabel={`Agrandir « ${label.title} », pièce ${index + 1} sur ${works.length}`}
        accessibilityHint="Ouvre la visionneuse plein écran"
        style={styles.zoomable}
      >
        <WorkPlate
          uri={work.media_url}
          contentFit={fit}
          tone={index % 3 === 1 ? 'bone' : 'clay'}
          accessibilityLabel={label.title}
          style={[{ height }, fit === 'contain' && styles.mat]}
        >
          <PlateMark label={`N° ${pad2(index + 1)}`} />
        </WorkPlate>
      </Pressable>
    );
  };

  const renderRow = ({ item, index: rowIndex }: { item: FilmRow; index: number }) => {
    if (!wide) {
      const { work, index } = item.items[0];
      return (
        <Animated.View entering={rowIndex < 2 ? enterUp(rowIndex + 2, 60) : undefined} style={styles.workPhone}>
          {piece(work, index, artH, 'contain')}
          <View style={{ paddingHorizontal: gutter }}>{cartel(work, index)}</View>
        </Animated.View>
      );
    }
    return (
      <Animated.View
        entering={rowIndex < 1 ? enterUp(2, 60) : undefined}
        style={[styles.page, styles.filmRow, { paddingHorizontal: gutter }]}
      >
        {item.items.map(({ work, index }, j) => (
          <View key={work.id} style={{ width: filmW, marginTop: FILM_STEPS[j] }}>
            {piece(work, index, artH, 'cover')}
            {cartel(work, index)}
          </View>
        ))}
      </Animated.View>
    );
  };

  const footer = (
    <View style={[styles.page, styles.footer, { paddingHorizontal: gutter, paddingBottom: insets.bottom + Spacing['3xl'] }]}>
      <Rule tone="ink" />
      <View style={styles.footerInner}>
        {works.length === 0 ? (
          <TText variant="bodySmall" color="secondary" style={styles.centerText}>
            {isOwner
              ? 'Aucune pièce publiée dans cette série. Ajoutez-en depuis vos publications.'
              : 'Les pièces de cette série ne sont pas encore exposées.'}
          </TText>
        ) : (
          <Kicker tone="muted" style={styles.centerText}>Fin de l’exposition</Kicker>
        )}
        <TButton
          title={`Tout le portfolio de ${blaze}`}
          variant="secondary"
          size="md"
          fullWidth={false}
          onPress={openArtist}
          style={styles.footerButton}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Seo
        title={`${series.title} — ${blaze} | Inkr`}
        description={seriesDescription(series, artist)}
        image={works[0]?.media_url}
        type="article"
        indexable={works.length > 0}
      />
      <THeader
        showBack
        title="Exposition"
        rightElement={(
          <ShareButton
            title={`${series.title} — ${blaze}`}
            text={curatorText || `Exposition « ${series.title} » de ${blaze} sur Inkr.`}
            path={`/series/${series.id}`}
          />
        )}
      />

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        ListHeaderComponent={intro}
        ListFooterComponent={footer}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      <Lightbox
        visible={viewerIndex !== null}
        onClose={() => setViewerIndex(null)}
        items={viewerItems}
        index={viewerIndex ?? 0}
        onIndexChange={setViewerIndex}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  page: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center' },

  intro: {
    paddingTop: Spacing.xl, paddingBottom: Spacing.xl, marginBottom: Spacing.xl,
    borderBottomWidth: 1, borderBottomColor: Colors.ink,
  },
  introWide: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing['2xl'],
    paddingTop: Spacing['3xl'], paddingBottom: Spacing['2xl'], marginBottom: Spacing['3xl'],
  },
  introMain: { flex: 1, minWidth: 0 },
  title: { marginTop: Spacing.md, maxWidth: 900, color: Colors.ink },
  artistLink: { alignSelf: 'flex-start', marginTop: Spacing.md, minHeight: 44 },

  reading: { marginTop: Spacing.md, maxWidth: Layout.maxReading },
  readingWide: { width: 380, flexShrink: 1, paddingBottom: Spacing.xs },
  curator: { lineHeight: 26 },
  textArea: { minHeight: 140, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: Spacing['2xs'], marginTop: Spacing.xs },
  editButton: { alignSelf: 'flex-start', marginTop: Spacing.sm },

  // Phones: one piece per screen, contained on the gallery wash.
  workPhone: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center', marginBottom: Spacing['2xl'] },
  mat: { backgroundColor: Colors.wash },
  zoomable: Platform.OS === 'web' ? ({ cursor: 'zoom-in' } as object) : {},

  // Wide: the picture film, three pieces stepping down.
  filmRow: { flexDirection: 'row', alignItems: 'flex-start', gap: FILM_GAP, marginBottom: Spacing['3xl'] },

  cartel: { paddingTop: Spacing.md },
  number: { marginBottom: Spacing.xs },
  workLink: { alignSelf: 'flex-start', marginTop: Spacing.xs, minHeight: 44 },

  footer: { paddingTop: Spacing.lg },
  footerInner: { alignItems: 'center', paddingTop: Spacing.xl, gap: Spacing.md },
  centerText: { textAlign: 'center', maxWidth: 420 },
  footerButton: { marginTop: Spacing['2xs'] },
});
