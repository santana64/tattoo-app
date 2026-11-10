import React from 'react';
import { View, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from './TText';

interface THeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  style?: ViewStyle;
  transparent?: boolean;
}

export function THeader({
  title,
  showBack = false,
  onBack,
  rightElement,
  style,
  transparent = false,
}: THeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 6 },
        transparent ? styles.transparent : styles.solid,
        style,
      ]}
    >
      <View style={styles.inner}>
        {showBack ? (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={8}
            style={({ pressed }) => [styles.backButton, transparent && styles.backOnImage, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}

        {title ? (
          <TText variant="bodySmall" weight="semibold" style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </TText>
        ) : <View style={{ flex: 1 }} />}

        <View style={styles.right}>
          {rightElement || <View style={styles.spacer} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
    paddingHorizontal: Spacing.sm,
    zIndex: 10,
  },
  solid: {
    backgroundColor: Colors.bgPrimary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderDefault,
  },
  backOnImage: {
    backgroundColor: 'rgba(11,10,9,0.55)',
    borderColor: Colors.glassBorderBright,
  },
  spacer: { width: 40 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
  },
  right: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
