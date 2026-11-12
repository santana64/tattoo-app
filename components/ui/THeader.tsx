import React from 'react';
import { View, StyleSheet, Pressable, ViewStyle, Platform } from 'react-native';
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
  /** Floats over photography: no ground, the back button becomes a paper plate. */
  transparent?: boolean;
}

/**
 * Stacked-screen bar: square back button, the screen name as a tracked-capitals
 * breadcrumb, an ink rule underneath.
 */
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
        { paddingTop: insets.top + 8 },
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
            style={(state) => {
              const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
              return [
                styles.backButton,
                transparent && styles.backOnImage,
                (pressed || hovered) && styles.backActive,
              ];
            }}
          >
            {(state) => {
              const { pressed, hovered } = state as { pressed: boolean; hovered?: boolean };
              return <Ionicons name="arrow-back" size={18} color={pressed || hovered ? '#FFFFFF' : Colors.ink} />;
            }}
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}

        {title ? (
          <TText
            variant="label"
            weight="bold"
            uppercase
            style={styles.title}
            numberOfLines={1}
            accessibilityRole="header"
          >
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
    paddingBottom: 10,
    paddingHorizontal: Spacing.sm,
    zIndex: 10,
  },
  solid: {
    backgroundColor: Colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.line,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transitionProperty: 'background-color, border-color', transitionDuration: '180ms' } as object)
      : null),
  },
  backOnImage: {
    backgroundColor: Colors.paper,
    borderColor: Colors.paper,
  },
  backActive: {
    backgroundColor: Colors.flame,
    borderColor: Colors.flame,
  },
  spacer: { width: 44 },
  title: {
    flex: 1,
    textAlign: 'center',
    letterSpacing: 1.4,
  },
  right: {
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
