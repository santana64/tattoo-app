import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, Layout } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TProgressBar } from '@/components/ui/TProgressBar';
import { THeader } from '@/components/ui/THeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { PressableScale, RevealImage, enterUp, fadeIn } from '@/components/motion';
import { useAuthStore, type AppUser } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';
import { pickImage, uploadPostMedia } from '@/lib/storage';
import { pickVideo, uploadPostVideo, type PickedVideo } from '@/lib/video-upload';
import { MAX_VIDEO_SECONDS, parseReelUrl, REEL_PROVIDER_LABEL, videoFileError } from '@/lib/reels';
import { Toast } from '@/components/ui/TToast';
import { useFeedStore } from '@/store/feed-store';
import { STYLES } from '@/constants/tattoo';

const MAX_STYLES = 3;

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
    setIsPublishing(true);
    setUploadProgress(0);
    try {
      const common = {
        artist_id: user.artistId,
        caption: caption.trim() || null,
        styles: selectedStyles,
        is_published: true,
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

  progressWrap: { marginBottom: Spacing.md },
});
