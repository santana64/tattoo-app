import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { Toast } from '@/components/ui/TToast';
import { useFeedStore } from '@/store/feed-store';
import { STYLES } from '@/constants/mock-data';

const MAX_STYLES = 3;

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
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePickMedia = async () => {
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
    if (!mediaUri || !user?.artistId) return;
    setIsPublishing(true);
    try {
      const { url } = await uploadPostMedia(mediaUri, user.artistId, setUploadProgress);
      const { error } = await supabase.from('posts').insert({
        artist_id: user.artistId,
        media_url: url,
        caption: caption.trim() || null,
        styles: selectedStyles,
        is_published: true,
      });
      if (error) throw error;
      Toast.success('Réalisation publiée');
      void useFeedStore.getState().refresh(user.id);
      router.back();
    } catch (e: any) {
      const detail = String(e?.message ?? e);
      console.warn('[create] publish failed:', detail, e);
      Toast.error(/row-level security|unauthorized|403/i.test(detail)
        ? 'Publication refusée par les règles de sécurité. Reconnectez-vous puis réessayez.'
        : 'Publication impossible. Vérifiez votre connexion puis réessayez.');
    } finally {
      setIsPublishing(false);
    }
  };

  const picker = (
    <PressableScale
      onPress={handlePickMedia}
      disabled={isPublishing}
      accessibilityRole="button"
      accessibilityLabel={mediaUri ? 'Changer la photo' : 'Sélectionner une photo'}
      style={[styles.mediaPicker, mediaUri ? styles.mediaPickerFilled : null]}
    >
      {mediaUri ? (
        <>
          <RevealImage uri={mediaUri} style={StyleSheet.absoluteFill} accessibilityLabel="Aperçu de la réalisation" />
          <LinearGradient colors={['rgba(11,10,9,0)', 'rgba(11,10,9,0.65)']} locations={[0.6, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <View style={styles.changeMediaBtn}>
            <Ionicons name="camera-outline" size={15} color={Colors.textPrimary} />
            <TText variant="caption" weight="medium">Changer la photo</TText>
          </View>
        </>
      ) : (
        <View style={styles.mediaPlaceholder}>
          <View style={styles.addIconRing}>
            <Ionicons name="add" size={26} color={Colors.accentWarm} />
          </View>
          <TText variant="body" weight="medium" style={{ marginTop: Spacing.sm }}>Sélectionner une photo</TText>
          <TText variant="caption" color="tertiary" style={{ marginTop: 2 }}>Format portrait 4:5 recommandé</TText>
        </View>
      )}
    </PressableScale>
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

      {isPublishing && (
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
        disabled={!mediaUri || isPublishing}
      />
      {!mediaUri && (
        <TText variant="caption" color="tertiary" style={{ textAlign: 'center', marginTop: Spacing['2xs'] }}>
          Ajoutez une photo pour publier.
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
