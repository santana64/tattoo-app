import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Gradients, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { THeader } from '@/components/ui/THeader';
import { TProgressBar } from '@/components/ui/TProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArtistRouteLoading } from '@/components/ArtistRouteLoading';
import { Toast } from '@/components/ui/TToast';
import { Kicker, Masthead, PageWrap, Rule } from '@/components/v5';
import { Panel } from '@/components/v5/studio';
import { StoryMedia } from '@/components/social/StoryViewer';
import { useAuthStore } from '@/store/auth-store';
import { useContentDimensions } from '@/hooks/useContentDimensions';
import { pickFromCamera, pickImage, uploadPostMedia } from '@/lib/storage';
import { publishStory } from '@/lib/care';

const CAPTION_MAX = 200;
const FRAME_MAX_W = 340;

type Hover = { pressed: boolean; hovered?: boolean };

export default function NewStoryScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  if (isLoading) return <ArtistRouteLoading title="Nouvelle story" />;

  if (!user || user.role !== 'artist' || !user.artistId) {
    return (
      <View style={styles.container}>
        <THeader title="Nouvelle story" showBack />
        <EmptyState
          icon="aperture-outline"
          title="Réservé aux artistes"
          description={user?.role === 'artist'
            ? 'Terminez votre profil d’artiste pour publier des stories.'
            : 'Les stories sont publiées par les artistes, pour 24 heures.'}
          ctaLabel="Fermer"
          onCta={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        />
      </View>
    );
  }

  return <StoryForm artistId={user.artistId} />;
}

function StoryForm({ artistId }: { artistId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, isWide, gutter } = useContentDimensions();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const choose = async (source: 'library' | 'camera') => {
    if (publishing) return;
    const uri = source === 'camera' ? await pickFromCamera() : (await pickImage({ aspect: [9, 16] }))?.[0];
    if (uri) { setImageUri(uri); setFormError(null); }
  };

  const publish = async () => {
    if (publishing) return;
    if (!imageUri) { setFormError('Choisissez une image.'); return; }
    if (caption.trim().length > CAPTION_MAX) { setFormError(`La légende fait ${CAPTION_MAX} caractères au plus.`); return; }
    setFormError(null);
    setPublishing(true);
    setProgress(0);
    try {
      const { url } = await uploadPostMedia(imageUri, artistId, setProgress);
      const error = await publishStory(artistId, url, caption);
      if (error) { setFormError(error); return; }
      Toast.success('Story publiée');
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    } catch (e: unknown) {
      const detail = String((e as { message?: unknown } | null)?.message ?? e);
      setFormError(/row-level security|unauthorized|403/i.test(detail)
        ? 'Envoi refusé par les règles de sécurité. Reconnectez-vous puis réessayez.'
        : 'Envoi de l’image impossible. Vérifiez votre connexion puis réessayez.');
    } finally {
      setPublishing(false);
    }
  };

  const frameW = Math.min(FRAME_MAX_W, width - gutter * 2);
  const trimmed = caption.trim();

  const preview = (
    <View style={{ width: frameW, alignSelf: isWide ? 'flex-start' : 'center' }}>
      <Kicker tone="muted" style={{ marginBottom: Spacing.sm }}>Aperçu / Story</Kicker>
      <Pressable
        onPress={() => { void choose('library'); }}
        disabled={publishing}
        accessibilityRole="button"
        accessibilityLabel={imageUri ? 'Changer l’image' : 'Choisir une image'}
        style={(state) => [
          styles.frame,
          { width: frameW, height: Math.round(frameW * 16 / 9) },
          !imageUri && styles.frameEmpty,
          !imageUri && (state as Hover).hovered && { backgroundColor: Colors.wash },
          Platform.OS === 'web' && ({ cursor: 'pointer' } as object),
        ]}
      >
        {imageUri ? (
          <>
            <StoryMedia uri={imageUri} label="Aperçu de la story" />
            {!!trimmed && (
              <>
                <LinearGradient colors={Gradients.cardBottom} style={styles.previewShade} pointerEvents="none" />
                <TText variant="bodySmall" color="onInk" style={styles.previewCaption} numberOfLines={5}>{trimmed}</TText>
              </>
            )}
            <View style={styles.changePlate}>
              <Ionicons name="images-outline" size={14} color={Colors.ink} />
              <TText variant="label" weight="bold" uppercase style={styles.plateText}>Changer</TText>
            </View>
          </>
        ) : (
          <View style={styles.emptyContent}>
            <View style={styles.iconFrame}>
              <Ionicons name="add" size={22} color={Colors.ink} />
            </View>
            <TText variant="bodySmall" weight="semibold" style={styles.center}>Choisir une image</TText>
            <TText variant="caption" color="secondary" style={styles.center}>Format vertical 9:16 conseillé</TText>
          </View>
        )}
      </Pressable>
      {Platform.OS !== 'web' && (
        <TButton
          title="Prendre une photo"
          variant="secondary"
          size="md"
          onPress={() => { void choose('camera'); }}
          disabled={publishing}
          icon={<Ionicons name="camera-outline" size={16} color={Colors.ink} />}
          style={{ marginTop: Spacing['2xs'] }}
        />
      )}
    </View>
  );

  const form = (
    <View>
      <Kicker>Story / 24 heures</Kicker>
      <TText variant="bodySmall" color="secondary" style={styles.lede}>
        Une image, visible par tous pendant 24 heures, puis elle disparaît d’elle-même.
      </TText>

      <TInput
        label="Légende"
        optional
        value={caption}
        onChangeText={(t) => { setCaption(t); setFormError(null); }}
        placeholder="Séance du jour, flash disponible, place libérée…"
        multiline
        maxLength={CAPTION_MAX}
        helper={`${caption.length} / ${CAPTION_MAX}`}
        inputStyle={styles.captionInput}
        editable={!publishing}
      />

      <Rule tone="ink" style={{ marginBottom: Spacing.md }} />

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
        title={publishing ? 'Publication…' : 'Publier pour 24 h'}
        onPress={() => { void publish(); }}
        loading={publishing}
        disabled={publishing || !imageUri}
      />
      {!imageUri && (
        <TText variant="caption" color="secondary" style={{ textAlign: 'center', marginTop: Spacing['2xs'] }}>
          Choisissez une image pour publier.
        </TText>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <THeader title="Nouvelle story" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PageWrap>
          <Masthead
            kicker="Story / Nouvelle"
            title="Le geste"
            emphasis="du jour."
            description="Un instant de l’atelier, visible 24 heures : une image et, si vous le souhaitez, une légende."
          />
          {isWide ? (
            <View style={styles.columns}>
              <Panel style={styles.colForm}>{form}</Panel>
              {preview}
            </View>
          ) : (
            <>
              {preview}
              <View style={styles.formStacked}>{form}</View>
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
  colForm: { flex: 1, minWidth: 0, maxWidth: 640 },
  formStacked: { marginTop: Spacing.xl },
  center: { textAlign: 'center' },

  frame: { overflow: 'hidden', backgroundColor: Colors.inkPanel },
  frameEmpty: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.ink,
  },
  emptyContent: { alignItems: 'center', gap: 8, paddingHorizontal: Spacing.lg },
  iconFrame: {
    width: 48, height: 48, marginBottom: 4,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.ink,
  },
  previewShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 160 },
  previewCaption: { position: 'absolute', left: Spacing.sm, right: Spacing.sm, bottom: Spacing.lg, textAlign: 'center' },
  changePlate: {
    position: 'absolute', top: Spacing['2xs'], right: Spacing['2xs'],
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 32, paddingHorizontal: 10,
    backgroundColor: Colors.paper,
  },
  plateText: { color: Colors.ink, letterSpacing: 0.8 },

  lede: { marginTop: Spacing.xs, marginBottom: Spacing.lg, maxWidth: 460 },
  captionInput: { minHeight: 96, textAlignVertical: 'top', paddingTop: 14 },
  progressWrap: { marginBottom: Spacing.md },
  formError: { marginBottom: Spacing.sm },
});
