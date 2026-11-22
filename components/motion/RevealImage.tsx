import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image, ImageContentFit } from 'expo-image';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, useReducedMotion } from 'react-native-reanimated';
import { Colors } from '@/constants/theme';
import { EASE_OUT, MotionDuration } from './tokens';

// Android Fabric can reparent text during image loads inside virtualized artist cards.
// Keep the native image stable while preserving animated reveals on Web/iOS.
const ImageSurface = Platform.OS === 'android' ? View : Animated.View;

interface RevealImageProps {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  accessibilityLabel?: string;
  /** Rendered when there is no uri or the image fails to load. */
  fallback?: React.ReactNode;
}

/**
 * "Gallery lights on": the photograph fades up from the wall and settles from
 * 1.04 to 1 once its pixels are decoded — never a pop-in, never a blank flash.
 */
export function RevealImage({ uri, style, contentFit = 'cover', accessibilityLabel, fallback }: RevealImageProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const [failed, setFailed] = React.useState(false);

  const anim = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: reduced ? 1 : 1.04 - progress.get() * 0.04 }],
  }));

  const showFallback = !uri || failed;

  return (
    <View style={[styles.frame, style]}>
      {showFallback ? fallback : (
        <ImageSurface style={[StyleSheet.absoluteFill, Platform.OS !== 'android' && anim]}>
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit={contentFit}
            cachePolicy="memory-disk"
            accessibilityLabel={accessibilityLabel}
            onLoad={() => { if (Platform.OS !== 'android') progress.set(withTiming(1, { duration: reduced ? 150 : MotionDuration.reveal, easing: EASE_OUT })); }}
            onError={() => setFailed(true)}
          />
        </ImageSurface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: Colors.bgSurface },
});
