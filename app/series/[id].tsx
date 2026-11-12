import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { THeader } from '@/components/ui/THeader';
import { TSkeleton } from '@/components/ui/TSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { ShareButton } from '@/components/ui/ShareButton';
import { PressableScale, RevealImage, enterUp } from '@/components/motion';
import { ArtworkLabel } from '@/components/gallery/ArtworkLabel';
import { Lightbox, type LightboxItem } from '@/components/gallery/Lightbox';
import { ArtPlaceholder, styleName } from '@/components/ArtistCard';
import { isVideoMedia } from '@/components/PostCard';
import { Seo } from '@/components/Seo';
import { useAuthStore } from '@/store/auth-store';
import { supabase, type Tables } from '@/lib/supabase';
import { isUuid } from '@/lib/catalog';
import { toDescription } from '@/lib/site';
import { artworkLabel, type ArtistSeries } from '@/lib/studio';

const WIDE = 900;
const LABEL_W = 300;
const WORKS_MAX = 200;
const DESCRIPTION_MAX = 400;

type SeriesArtist = Pick<Tables<'artists'>, 'id' | 'blaze' | 'city'>;
type Work = Tables<'posts'>;

interface Exhibition {
  series: ArtistSeries;
  artist: SeriesArtist | null;
  works: Work[];
}

const pieces = (n: number) => (n === 0 ? 'Aucune pièce' : n === 1 ? '1 pièce' : `${n} pièces`);

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
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE;
  const frameW = Math.min(width, Layout.maxContent) - (wide ? Layout.gutter * 2 : 0);
  const artW = wide ? frameW - LABEL_W - Spacing['2xl'] : width;
  const artH = wide
    ? Math.round(Math.min(height * 0.82, artW * 1.2, 880))
    : Math.round(Math.min(width * 1.25, height * 0.72));
  return { wide, artH };
}

function SeriesSkeleton() {
  const { wide, artH } = useWorkFrame();
  return (
    <View style={styles.container} accessibilityLabel="Chargement de l’exposition">
      <THeader showBack />
      <View style={[styles.intro, wide && styles.introWide]}>
        <TSkeleton width={90} height={11} />
        <TSkeleton width="70%" height={wide ? 56 : 44} style={{ marginTop: Spacing.sm }} />
        <TSkeleton width={140} height={14} style={{ marginTop: Spacing.sm }} />
        <TSkeleton width="92%" height={14} style={{ marginTop: Spacing.lg }} />
        <TSkeleton width="80%" height={14} style={{ marginTop: 8 }} />
      </View>
      <View style={wide ? styles.workRowWide : undefined}>
        <TSkeleton height={artH} radius={wide ? Radius.xl : 0} style={wide ? { flex: 1 } : undefined} />
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
        <THeader showBack />
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
  const { wide, artH } = useWorkFrame();
  const { user } = useAuthStore();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const isOwner = !!user?.artistId && user.artistId === series.artist_id;
  const blaze = artist?.blaze ?? 'Artiste Inkr';
  const curatorText = series.description?.trim() ?? '';
  const viewerItems = useMemo(() => works.map(toLightboxItem), [works]);
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

  const intro = (
    <View style={[styles.intro, wide && styles.introWide]}>
      <Animated.View entering={enterUp(0, 60)}>
        <TText variant="label" color="accentWarm" uppercase>Exposition</TText>
        <TText
          variant={wide ? 'displayXL' : 'displayL'}
          italic
          accessibilityRole="header"
          style={styles.title}
        >
          {series.title}
        </TText>
        <PressableScale
          onPress={openArtist}
          pressedScale={0.98}
          accessibilityRole="link"
          accessibilityLabel={`Voir le profil de ${blaze}`}
          hitSlop={6}
          style={styles.artistLink}
        >
          <TText variant="body" color="secondary">par </TText>
          <TText variant="body" weight="medium" numberOfLines={1} style={styles.artistName}>{blaze}</TText>
          {!!artist?.city && <TText variant="body" color="tertiary" numberOfLines={1}>{` · ${artist.city}`}</TText>}
          <Ionicons name="arrow-forward" size={14} color={Colors.accentWarm} />
        </PressableScale>
      </Animated.View>

      <Animated.View entering={enterUp(1, 60)} style={styles.reading}>
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
            {!!curatorText && <TText variant="body" color="secondary" style={styles.curator}>{curatorText}</TText>}
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
                icon={<Ionicons name="create-outline" size={15} color={Colors.textPrimary} />}
                style={styles.editButton}
              />
            )}
          </>
        )}
      </Animated.View>

      <View style={styles.countRow}>
        <View style={styles.rule} />
        <TText variant="label" color="tertiary" uppercase tabular>{pieces(works.length)}</TText>
        <View style={styles.rule} />
      </View>
    </View>
  );

  const renderWork = ({ item, index }: { item: Work; index: number }) => {
    const label = artworkLabel(item, styleName);
    const flipped = wide && index % 2 === 1;
    return (
      <Animated.View
        entering={index < 2 ? enterUp(index + 2, 60) : undefined}
        style={[styles.work, wide && styles.workRowWide, flipped && styles.workFlipped]}
      >
        <Pressable
          onPress={() => setViewerIndex(index)}
          accessibilityRole="button"
          accessibilityLabel={`Agrandir « ${label.title} », pièce ${index + 1} sur ${works.length}`}
          accessibilityHint="Ouvre la visionneuse plein écran"
          style={[styles.art, { height: artH }, wide && styles.artWide, styles.zoomable]}
        >
          <RevealImage
            uri={item.media_url}
            contentFit="contain"
            style={[StyleSheet.absoluteFill, styles.mat]}
            accessibilityLabel={label.title}
            fallback={<ArtPlaceholder name={blaze} size={88} />}
          />
        </Pressable>
        <View style={[styles.labelCol, wide && styles.labelColWide]}>
          <TText variant="label" color="tertiary" tabular style={styles.number}>
            {String(index + 1).padStart(2, '0')} / {String(works.length).padStart(2, '0')}
          </TText>
          <ArtworkLabel post={item} artistName={blaze} />
          <PressableScale
            onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
            accessibilityRole="link"
            accessibilityLabel={`Voir la fiche de « ${label.title} »`}
            hitSlop={6}
            style={styles.workLink}
          >
            <TText variant="caption" weight="medium" color="accentGlow">Voir la fiche</TText>
            <Ionicons name="arrow-forward" size={12} color={Colors.accentGlow} />
          </PressableScale>
        </View>
      </Animated.View>
    );
  };

  const footer = (
    <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing['3xl'] }]}>
      {works.length === 0 ? (
        <TText variant="bodySmall" color="tertiary" style={styles.centerText}>
          {isOwner
            ? 'Aucune pièce publiée dans cette série. Ajoutez-en depuis vos publications.'
            : 'Les pièces de cette série ne sont pas encore exposées.'}
        </TText>
      ) : (
        <TText variant="label" color="tertiary" uppercase style={styles.centerText}>Fin de l’exposition</TText>
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
        rightElement={(
          <ShareButton
            title={`${series.title} — ${blaze}`}
            text={curatorText || `Exposition « ${series.title} » de ${blaze} sur Inkr.`}
            path={`/series/${series.id}`}
          />
        )}
      />

      <FlatList
        data={works}
        keyExtractor={(work) => work.id}
        renderItem={renderWork}
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

  intro: {
    width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center',
    paddingHorizontal: Layout.gutter, paddingTop: Spacing.xl, paddingBottom: Spacing.xl,
  },
  introWide: { paddingTop: Spacing['4xl'], paddingBottom: Spacing['2xl'] },
  title: { marginTop: Spacing.xs, maxWidth: 900 },
  artistLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 36, marginTop: Spacing.xs },
  artistName: { flexShrink: 1 },

  reading: { marginTop: Spacing.lg, maxWidth: Layout.maxReading },
  curator: { lineHeight: 27 },
  textArea: { minHeight: 140, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: Spacing['2xs'], marginTop: Spacing.xs },
  editButton: { alignSelf: 'flex-start', marginTop: Spacing.sm },

  countRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xl },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderDefault },

  work: { width: '100%', maxWidth: Layout.maxContent, alignSelf: 'center', marginBottom: Spacing['2xl'] },
  workRowWide: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing['2xl'],
    paddingHorizontal: Layout.gutter, marginBottom: Spacing['4xl'],
  },
  workFlipped: { flexDirection: 'row-reverse' },

  art: { width: '100%', backgroundColor: Colors.bgInk },
  artWide: { flex: 1, width: undefined, borderRadius: Radius.xl, overflow: 'hidden' },
  mat: { backgroundColor: 'transparent' },
  zoomable: Platform.OS === 'web' ? ({ cursor: 'zoom-in' } as object) : {},

  labelCol: { paddingHorizontal: Layout.gutter, paddingTop: Spacing.md },
  labelColWide: { width: LABEL_W, paddingHorizontal: 0, paddingTop: 0, paddingBottom: Spacing.xs },
  number: { marginBottom: Spacing.xs },
  workLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36, marginTop: Spacing.xs },

  footer: { alignItems: 'center', paddingHorizontal: Layout.gutter, paddingTop: Spacing.lg, gap: Spacing.md },
  centerText: { textAlign: 'center', maxWidth: 420 },
  footerButton: { marginTop: Spacing['2xs'] },
});
