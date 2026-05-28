import React, { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Colors, Spacing, Radius, GlowShadow } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TProgressBar } from '@/components/ui/TProgressBar';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';
import { pickImage, uploadPostMedia } from '@/lib/storage';
import { Toast } from '@/components/ui/TToast';
import { STYLES } from '@/constants/mock-data';

export default function CreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  // Only artists can post
  if (!user || user.role !== 'artist') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.gateWrap}>
          <Ionicons name="brush-outline" size={48} color={Colors.accentWarm} style={{ marginBottom: Spacing.md }} />
          <TText variant="title2" weight="bold" style={{ textAlign: 'center', marginBottom: Spacing.xs }}>
            Réservé aux tatoueurs
          </TText>
          <TText variant="body" color="secondary" style={{ textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 22 }}>
            Seuls les artistes peuvent publier du contenu sur le feed.
          </TText>
          <TButton title="Fermer" variant="glass" onPress={() => router.back()} />
        </Animated.View>
      </View>
    );
  }

  return <CreateForm user={user} router={router} insets={insets} />;
}

function CreateForm({ user, router, insets }: any) {
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
        : prev.length < 3
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
      Toast.success('Post publié ! 🎉');
      router.back();
    } catch (e: any) {
      Toast.error(e.message ?? 'Erreur lors de la publication.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2" weight="semibold">Nouveau post</TText>
        <View style={{ width: 44 }} />
      </Animated.View>

      {isPublishing && (
        <View style={styles.progressWrap}>
          <TProgressBar progress={uploadProgress} />
          <TText variant="micro" color="tertiary" style={{ marginTop: 4, textAlign: 'center' }}>
            Envoi en cours…
          </TText>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 50 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Media picker */}
        <Animated.View entering={FadeIn.delay(100).duration(400)}>
          <TouchableOpacity
            style={[styles.mediaPicker, mediaUri && styles.mediaPickerFilled]}
            onPress={handlePickMedia}
            activeOpacity={0.85}
          >
            {mediaUri ? (
              <Animated.View entering={ZoomIn.springify()} style={StyleSheet.absoluteFill}>
                <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <LinearGradient
                  colors={['transparent', 'rgba(5,5,8,0.6)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.changeMediaBtn}>
                  <Ionicons name="camera" size={16} color="#fff" />
                  <TText variant="caption" style={{ color: '#fff', marginLeft: 5 }}>Changer</TText>
                </View>
              </Animated.View>
            ) : (
              <View style={styles.mediaPlaceholder}>
                <View style={styles.addIconCircle}>
                  <Ionicons name="add" size={32} color={Colors.accentWarm} />
                </View>
                <TText variant="bodySmall" color="tertiary" style={{ marginTop: 12, textAlign: 'center' }}>
                  Sélectionner une photo
                </TText>
                <TText variant="caption" color="tertiary" style={{ marginTop: 4 }}>
                  Format 4:5 recommandé
                </TText>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Caption */}
        <Animated.View entering={FadeInDown.delay(180).springify()}>
          <TInput
            label="Légende"
            value={caption}
            onChangeText={setCaption}
            placeholder="Décris ton travail, l'inspiration, le processus…"
            multiline
            numberOfLines={3}
            style={{ minHeight: 88 }}
          />
        </Animated.View>

        {/* Style tags */}
        <Animated.View entering={FadeInDown.delay(250).springify()}>
          <View style={styles.tagsSectionHeader}>
            <TText variant="label" color="tertiary" uppercase>Styles</TText>
            <TText variant="caption" color="tertiary">
              {selectedStyles.length}/3
            </TText>
          </View>
          <View style={styles.stylesGrid}>
            {STYLES.map((style, i) => {
              const isSelected = selectedStyles.includes(style.slug);
              const isDisabled = !isSelected && selectedStyles.length >= 3;
              return (
                <Animated.View key={style.id} entering={FadeIn.delay(280 + i * 30)}>
                  <TouchableOpacity
                    onPress={() => !isDisabled && toggleStyle(style.slug)}
                    activeOpacity={0.8}
                    style={[styles.styleTag, isSelected && styles.styleTagSelected, isDisabled && styles.styleTagDisabled]}
                  >
                    <TText style={styles.styleEmoji}>{style.emoji}</TText>
                    <TText
                      variant="caption"
                      style={{ color: isSelected ? Colors.accentWarm : isDisabled ? Colors.textTertiary : Colors.textSecondary }}
                    >
                      {style.name}
                    </TText>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        {/* Publish button */}
        <Animated.View entering={FadeInUp.delay(400).springify()}>
          <TButton
            title={isPublishing ? 'Publication…' : 'Publier sur le feed'}
            onPress={handlePublish}
            loading={isPublishing}
            disabled={!mediaUri || isPublishing}
            variant="primary"
          />
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  gateWrap: { paddingHorizontal: Spacing.xl, alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xs'],
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  progressWrap: { paddingHorizontal: Spacing.sm, paddingTop: Spacing['2xs'] },
  content: { padding: Spacing.sm, gap: Spacing.sm },

  // Media picker
  mediaPicker: {
    height: 300,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgElevated,
    overflow: 'hidden',
  },
  mediaPickerFilled: { borderStyle: 'solid', borderColor: 'transparent' },
  mediaPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  addIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(200,168,130,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(200,168,130,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  changeMediaBtn: {
    position: 'absolute', bottom: 12, right: 12,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
  },

  // Style tags
  tagsSectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.xs,
  },
  stylesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.sm },
  styleTag: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.borderSubtle,
    gap: 6,
  },
  styleTagSelected: {
    backgroundColor: 'rgba(200,168,130,0.10)',
    borderColor: Colors.accentWarm,
  },
  styleTagDisabled: { opacity: 0.35 },
  styleEmoji: { fontSize: 14 },
});
