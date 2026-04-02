import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { TText } from './TText';
import { TProgressBar } from './TProgressBar';
import { pickImage, pickFromCamera } from '@/lib/storage';

interface TImagePickerProps {
  value?: string | null;
  onPicked: (uri: string) => void;
  onUploadProgress?: (progress: number) => void;
  aspect?: [number, number];
  placeholder?: string;
  style?: ViewStyle;
  multiple?: false;
}

export function TImagePicker({
  value,
  onPicked,
  aspect,
  placeholder = 'Ajouter une photo',
  style,
}: TImagePickerProps) {
  const [showOptions, setShowOptions] = useState(false);

  const handleLibrary = async () => {
    setShowOptions(false);
    const uris = await pickImage({ aspect });
    if (uris?.[0]) onPicked(uris[0]);
  };

  const handleCamera = async () => {
    setShowOptions(false);
    const uri = await pickFromCamera();
    if (uri) onPicked(uri);
  };

  return (
    <View style={style}>
      <TouchableOpacity
        style={[styles.container, value ? styles.hasImage : styles.empty]}
        onPress={() => setShowOptions(true)}
        activeOpacity={0.8}
      >
        {value ? (
          <Animated.View entering={FadeIn} style={StyleSheet.absoluteFill}>
            <Image source={{ uri: value }} style={styles.preview} contentFit="cover" />
            <View style={styles.editOverlay}>
              <Ionicons name="camera" size={20} color="#fff" />
            </View>
          </Animated.View>
        ) : (
          <View style={styles.emptyContent}>
            <Ionicons name="add-circle-outline" size={36} color={Colors.textTertiary} />
            <TText variant="bodySmall" color="tertiary" style={{ marginTop: 8, textAlign: 'center' }}>
              {placeholder}
            </TText>
          </View>
        )}
      </TouchableOpacity>

      {showOptions && (
        <View style={styles.optionsOverlay}>
          <TouchableOpacity style={styles.optionBtn} onPress={handleLibrary}>
            <Ionicons name="images-outline" size={20} color={Colors.textPrimary} />
            <TText variant="bodySmall" style={{ marginLeft: 10 }}>Bibliothèque</TText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionBtn} onPress={handleCamera}>
            <Ionicons name="camera-outline" size={20} color={Colors.textPrimary} />
            <TText variant="bodySmall" style={{ marginLeft: 10 }}>Appareil photo</TText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.optionBtn, styles.cancelBtn]} onPress={() => setShowOptions(false)}>
            <TText variant="bodySmall" color="tertiary">Annuler</TText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: Radius.md, overflow: 'hidden' },
  empty: {
    height: 160,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
  },
  hasImage: { height: 200 },
  preview: { width: '100%', height: '100%' },
  emptyContent: { alignItems: 'center' },
  editOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderTopLeftRadius: Radius.sm,
  },
  optionsOverlay: {
    position: 'absolute',
    bottom: -160,
    left: 0,
    right: 0,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    zIndex: 10,
    overflow: 'hidden',
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  cancelBtn: { borderBottomWidth: 0 },
});
