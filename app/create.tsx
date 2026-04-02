import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TChip } from '@/components/ui/TChip';
import { TProgressBar } from '@/components/ui/TProgressBar';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';
import { pickImage, uploadPostMedia } from '@/lib/storage';
import { Toast } from '@/components/ui/TToast';
import { STYLES } from '@/constants/mock-data';

export default function CreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

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
      prev.includes(slug) ? prev.filter((s) => s !== slug) : prev.length < 3 ? [...prev, slug] : prev
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
      Toast.success('Post publié !');
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2">Nouveau post</TText>
        <View style={{ width: 44 }} />
      </View>

      {isPublishing && (
        <View style={{ paddingHorizontal: Spacing.sm }}>
          <TProgressBar progress={uploadProgress} />
        </View>
      )}

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {/* Media picker */}
        <Animated.View entering={FadeIn.delay(100)}>
          <TouchableOpacity
            style={[styles.mediaPicker, mediaUri && styles.mediaPickerFilled]}
            onPress={handlePickMedia}
            activeOpacity={0.8}
          >
            {mediaUri ? (
              <Animated.View entering={ZoomIn.springify()} style={StyleSheet.absoluteFill}>
                <Image source={{ uri: mediaUri }} style={styles.mediaPreview} contentFit="cover" />
                <View style={styles.changeMediaBtn}>
                  <Ionicons name="camera" size={18} color="#fff" />
                  <TText variant="caption" style={{ color: '#fff', marginLeft: 4 }}>Changer</TText>
                </View>
              </Animated.View>
            ) : (
              <View style={styles.mediaPlaceholder}>
                <Ionicons name="add-circle-outline" size={48} color={Colors.textTertiary} />
                <TText variant="bodySmall" color="tertiary" style={{ marginTop: 10, textAlign: 'center' }}>
                  Touche pour sélectionner{'\n'}une photo (4:5)
                </TText>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Caption */}
        <Animated.View entering={FadeInUp.delay(200).springify()}>
          <TInput
            label="Légende"
            value={caption}
            onChangeText={setCaption}
            placeholder="Décris ton travail…"
            multiline
            numberOfLines={3}
            style={styles.captionInput}
          />
        </Animated.View>

        {/* Style tags */}
        <Animated.View entering={FadeInUp.delay(300).springify()}>
          <TText variant="caption" color="secondary" style={styles.sectionLabel}>
            STYLES (max 3)
          </TText>
          <View style={styles.stylesGrid}>
            {STYLES.map((style) => (
              <TChip
                key={style.id}
                label={`${style.emoji}  ${style.name}`}
                selected={selectedStyles.includes(style.slug)}
                onPress={() => toggleStyle(style.slug)}
                disabled={!selectedStyles.includes(style.slug) && selectedStyles.length >= 3}
              />
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400).springify()}>
          <TButton
            title="Publier"
            onPress={handlePublish}
            loading={isPublishing}
            disabled={!mediaUri}
          />
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xs'],
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.sm, gap: Spacing.sm },
  mediaPicker: {
    height: 280,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgElevated,
    overflow: 'hidden',
  },
  mediaPickerFilled: { borderStyle: 'solid', borderColor: 'transparent' },
  mediaPreview: { width: '100%', height: '100%' },
  mediaPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  changeMediaBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  captionInput: { minHeight: 80 },
  sectionLabel: { marginBottom: 8 },
  stylesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.sm },
});
