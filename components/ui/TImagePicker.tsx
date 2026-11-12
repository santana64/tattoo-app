import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ViewStyle, Modal } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing } from '@/constants/theme';
import { PressableScale } from '@/components/motion/PressableScale';
import { RevealImage } from '@/components/motion/RevealImage';
import { BottomSheet } from '@/components/motion/BottomSheet';
import { TText } from './TText';
import { pickImage, pickFromCamera } from '@/lib/storage';

const SHEET_EXIT_MS = 280;

interface TImagePickerProps {
  value?: string | null;
  onPicked: (uri: string) => void;
  onUploadProgress?: (progress: number) => void;
  aspect?: [number, number];
  placeholder?: string;
  style?: ViewStyle;
  multiple?: false;
  /**
   * Size the tile to `aspect` (a true preview of the crop) instead of the
   * compact fixed height. Off by default.
   */
  fillAspect?: boolean;
  /** Short note under the placeholder, e.g. the recommended format. */
  hint?: string;
}

function SourceOption({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.option}>
      <Ionicons name={icon} size={20} color={Colors.ink} />
      <TText variant="body" weight="medium">{label}</TText>
    </PressableScale>
  );
}

export function TImagePicker({
  value,
  onPicked,
  aspect,
  placeholder = 'Ajouter une photo',
  style,
  fillAspect = false,
  hint,
}: TImagePickerProps) {
  const [showOptions, setShowOptions] = useState(false);
  // The sheet lives in a transparent Modal so it covers the whole screen, not just this tile.
  const [modalMounted, setModalMounted] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const openSheet = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setModalMounted(true);
    setShowOptions(true);
  };

  /** Let the sheet slide out and the Modal unmount before the system picker is presented. */
  const closeSheet = () => new Promise<void>((resolve) => {
    setShowOptions(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setModalMounted(false);
      resolve();
    }, SHEET_EXIT_MS);
  });

  const handleLibrary = async () => {
    await closeSheet();
    const uris = await pickImage({ aspect });
    if (uris?.[0]) onPicked(uris[0]);
  };

  const handleCamera = async () => {
    await closeSheet();
    const uri = await pickFromCamera();
    if (uri) onPicked(uri);
  };

  return (
    <View style={style}>
      <PressableScale
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={value ? 'Changer la photo' : placeholder}
        style={[
          styles.container,
          value ? styles.hasImage : styles.empty,
          fillAspect && aspect ? { height: undefined, aspectRatio: aspect[0] / aspect[1] } : null,
        ]}
      >
        {value ? (
          <>
            <RevealImage key={value} uri={value} style={StyleSheet.absoluteFill} accessibilityLabel="Photo sélectionnée" />
            <View style={styles.editPlate}>
              <Ionicons name="camera-outline" size={14} color={Colors.ink} />
              <TText variant="label" weight="bold" uppercase style={{ color: Colors.ink, letterSpacing: 0.8 }}>Changer</TText>
            </View>
          </>
        ) : (
          <View style={styles.emptyContent}>
            <View style={styles.iconFrame}>
              <Ionicons name="add" size={20} color={Colors.ink} />
            </View>
            <TText variant="bodySmall" weight="semibold" style={styles.placeholder}>
              {placeholder}
            </TText>
            {hint ? (
              <TText variant="caption" color="secondary" style={styles.placeholder}>{hint}</TText>
            ) : null}
          </View>
        )}
      </PressableScale>

      <Modal
        visible={modalMounted}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => void closeSheet()}
      >
        <GestureHandlerRootView style={styles.modalRoot}>
          <BottomSheet
            visible={showOptions}
            onClose={() => void closeSheet()}
            accessibilityLabel="Choisir la source de la photo"
          >
            <TText variant="label" weight="bold" uppercase style={styles.sheetLabel}>
              Ajouter une photo
            </TText>
            <SourceOption icon="images-outline" label="Choisir dans la photothèque" onPress={handleLibrary} />
            <View style={styles.divider} />
            <SourceOption icon="camera-outline" label="Prendre une photo" onPress={handleCamera} />
            <View style={styles.divider} />
            <PressableScale
              onPress={() => void closeSheet()}
              accessibilityRole="button"
              accessibilityLabel="Annuler"
              style={styles.option}
            >
              <TText variant="body" color="secondary">Annuler</TText>
            </PressableScale>
          </BottomSheet>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  empty: {
    height: 160,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  hasImage: { height: 200, backgroundColor: Colors.clay },
  emptyContent: { alignItems: 'center', gap: 8, paddingHorizontal: Spacing.sm },
  iconFrame: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.ink,
    marginBottom: 4,
  },
  placeholder: { textAlign: 'center' },
  editPlate: {
    position: 'absolute',
    right: Spacing['2xs'],
    bottom: Spacing['2xs'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 10,
    backgroundColor: Colors.paper,
  },
  modalRoot: { flex: 1 },
  sheetLabel: { marginBottom: Spacing['2xs'], color: Colors.ink },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 52,
  },
  divider: { height: 1, backgroundColor: Colors.line },
});
