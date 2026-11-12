import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated from 'react-native-reanimated';
import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { THeader } from '@/components/ui/THeader';
import { TProgressBar } from '@/components/ui/TProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Toast } from '@/components/ui/TToast';
import { PressableScale, enterUp, fadeIn } from '@/components/motion';
import { StoryMedia } from '@/components/social/StoryViewer';
import { useAuthStore } from '@/store/auth-store';
import { pickFromCamera, pickImage, uploadPostMedia } from '@/lib/storage';
import { publishStory } from '@/lib/care';

const CAPTION_MAX = 200;
const FRAME_MAX_W = 340;

export default function NewStoryScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

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
  const { width } = useWindowDimensions();
  const wide = width >= 860;

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

  const frameW = Math.min(FRAME_MAX_W, width - Layout.gutter * 2);
  const trimmed = caption.trim();

  const preview = (
    <View style={{ width: frameW, alignSelf: wide ? 'flex-start' : 'center' }}>
      <PressableScale
        onPress={() => { void choose('library'); }}
        disabled={publishing}
        accessibilityRole="button"
        accessibilityLabel={imageUri ? 'Changer l’image' : 'Choisir une image'}
        style={[styles.frame, { width: frameW, height: Math.round(frameW * 16 / 9) }, !imageUri && styles.frameEmpty]}
      >
        {imageUri ? (
          <>
            <StoryMedia uri={imageUri} label="Aperçu de la story" />
            {!!trimmed && (
              <>
                <LinearGradient colors={['rgba(7,6,5,0)', 'rgba(7,6,5,0.85)']} style={styles.previewShade} pointerEvents="none" />
                <TText variant="bodySmall" style={styles.previewCaption} numberOfLines={5}>{trimmed}</TText>
              </>
            )}
            <View style={styles.changePill}>
              <Ionicons name="images-outline" size={14} color={Colors.textPrimary} />
              <TText variant="caption" weight="medium">Changer</TText>
            </View>
          </>
        ) : (
          <View style={styles.emptyContent}>
            <View style={styles.iconRing}>
              <Ionicons name="add" size={22} color={Colors.accentWarm} />
            </View>
            <TText variant="bodySmall" color="secondary" style={styles.center}>Choisir une image</TText>
            <TText variant="caption" color="tertiary" style={styles.center}>Format vertical 9:16 conseillé</TText>
          </View>
        )}
      </PressableScale>
      {Platform.OS !== 'web' && (
        <TButton
          title="Prendre une photo"
          variant="ghost"
          size="md"
          onPress={() => { void choose('camera'); }}
          disabled={publishing}
          icon={<Ionicons name="camera-outline" size={16} color={Colors.textSecondary} />}
          style={{ marginTop: Spacing['2xs'] }}
        />
      )}
    </View>
  );

  const form = (
    <View>
      <TText variant="label" color="accentWarm" uppercase>Story</TText>
      <TText variant="displayS" accessibilityRole="header" style={styles.title}>
        Un instant de l’atelier, <TText variant="displayS" italic color="accentGlow">pour 24 h</TText>
      </TText>
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
        title={publishing ? 'Publication…' : 'Publier pour 24 h'}
        onPress={() => { void publish(); }}
        loading={publishing}
        disabled={publishing || !imageUri}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <THeader title="Nouvelle story" showBack />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing['2xl'] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={wide ? styles.columns : undefined}>
          <Animated.View entering={enterUp(0)}>{preview}</Animated.View>
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
  columns: { flexDirection: 'row', gap: Spacing['2xl'], alignItems: 'flex-start', justifyContent: 'center' },
  colForm: { flex: 1, maxWidth: Layout.maxReading },
  formStacked: { marginTop: Spacing.xl },
  center: { textAlign: 'center' },

  frame: { borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: Colors.bgInk },
  frameEmpty: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderDefault,
  },
  emptyContent: { alignItems: 'center', gap: 8, paddingHorizontal: Spacing.lg },
  iconRing: {
    width: 48, height: 48, borderRadius: 24, marginBottom: 4,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.borderGlow,
    backgroundColor: Colors.glassAmber,
  },
  previewShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 160 },
  previewCaption: { position: 'absolute', left: Spacing.sm, right: Spacing.sm, bottom: Spacing.lg, textAlign: 'center' },
  changePill: {
    position: 'absolute', top: Spacing['2xs'], right: Spacing['2xs'],
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 30, paddingHorizontal: 12, borderRadius: 15,
    backgroundColor: 'rgba(11,10,9,0.65)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.glassBorderBright,
  },

  title: { marginTop: 6 },
  lede: { marginTop: Spacing['2xs'], marginBottom: Spacing.lg, maxWidth: 460 },
  captionInput: { minHeight: 96, textAlignVertical: 'top', paddingTop: 14 },
  progressWrap: { marginBottom: Spacing.md },
  formError: { marginBottom: Spacing.sm },
});
