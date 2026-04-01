import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { TInput } from '@/components/ui/TInput';
import { TChip } from '@/components/ui/TChip';
import { STYLES } from '@/constants/mock-data';

export default function CreatePostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [mediaSelected, setMediaSelected] = useState(false);

  const toggleStyle = (slug: string) =>
    setSelectedStyles((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug].slice(0, 3)
    );

  const handlePublish = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TText variant="title2">Nouveau post</TText>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Media picker */}
        <TouchableOpacity
          style={[styles.mediaPicker, mediaSelected && styles.mediaSelected]}
          onPress={() => setMediaSelected(true)}
          activeOpacity={0.85}
        >
          {mediaSelected ? (
            <View style={styles.mediaPreview}>
              <Ionicons name="image" size={48} color={Colors.textTertiary} />
              <TText variant="bodySmall" color="tertiary" style={{ marginTop: 8 }}>
                Photo sélectionnée ✓
              </TText>
              <TText variant="caption" color="tertiary">
                Appuie pour changer
              </TText>
            </View>
          ) : (
            <View style={styles.mediaPlaceholder}>
              <Ionicons name="camera-outline" size={48} color={Colors.textTertiary} />
              <TText variant="bodySmall" color="secondary" style={{ marginTop: 8 }}>
                Ajouter une photo ou vidéo
              </TText>
              <TText variant="caption" color="tertiary" style={{ marginTop: 4 }}>
                JPEG, PNG · Vidéo max 60s
              </TText>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.form}>
          <TInput
            label="Légende"
            value={caption}
            onChangeText={setCaption}
            placeholder="Quelques mots sur cette pièce..."
            multiline
            numberOfLines={3}
            inputStyle={{ height: 80, textAlignVertical: 'top', paddingTop: 8 }}
            optional
          />

          <TText variant="caption" color="secondary" style={styles.sectionLabel}>
            TAGS DE STYLE (max 3)
          </TText>
          <View style={styles.stylesGrid}>
            {STYLES.map((s) => (
              <TChip
                key={s.id}
                label={s.name}
                selected={selectedStyles.includes(s.slug)}
                onPress={() => toggleStyle(s.slug)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TButton
          title="Publier"
          onPress={handlePublish}
          disabled={!mediaSelected}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  mediaPicker: {
    margin: Spacing.sm,
    height: 280,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.borderDefault,
    borderStyle: 'dashed',
    backgroundColor: Colors.bgSurface,
    overflow: 'hidden',
  },
  mediaSelected: {
    borderStyle: 'solid',
    borderColor: Colors.accent,
  },
  mediaPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mediaPreview: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  form: { paddingHorizontal: Spacing.sm },
  sectionLabel: { marginBottom: Spacing['2xs'], letterSpacing: 0.5 },
  stylesGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  footer: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing['2xs'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.bgPrimary,
  },
});
