import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ViewStyle, Modal } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '@/constants/theme';
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
      <Ionicons name={icon} size={20} color={Colors.textPrimary} />
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
        style={[styles.container, value ? styles.hasImage : styles.empty]}
      >
        {value ? (
          <>
            <RevealImage key={value} uri={value} style={StyleSheet.absoluteFill} accessibilityLabel="Photo sélectionnée" />
            <View style={styles.editPill}>
              <Ionicons name="camera-outline" size={14} color={Colors.textPrimary} />
              <TText variant="caption" weight="medium">Changer</TText>
            </View>
          </>
        ) : (
          <View style={styles.emptyContent}>
            <View style={styles.iconRing}>
              <Ionicons name="add" size={20} color={Colors.accentWarm} />
            </View>
            <TText variant="bodySmall" color="secondary" style={styles.placeholder}>
              {placeholder}
            </TText>
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
            <TText variant="label" color="tertiary" uppercase style={styles.sheetLabel}>
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
  container: { borderRadius: Radius.lg, overflow: 'hidden' },
  empty: {
    height: 160,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
  },
  hasImage: { height: 200, backgroundColor: Colors.bgSurface },
  emptyContent: { alignItems: 'center', gap: 10, paddingHorizontal: Spacing.sm },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderGlow,
    backgroundColor: Colors.glassAmber,
  },
  placeholder: { textAlign: 'center' },
  editPill: {
    position: 'absolute',
    right: Spacing['2xs'],
    bottom: Spacing['2xs'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: 'rgba(11,10,9,0.65)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassBorderBright,
  },
  modalRoot: { flex: 1 },
  sheetLabel: { marginBottom: Spacing['2xs'] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 52,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.borderDefault },
});
