import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View, ViewStyle, StyleProp, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming, interpolate, Extrapolation, useReducedMotion,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Layout } from '@/constants/theme';
import { EASE_SHEET, Springs } from './tokens';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

function closeHaptic() {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Modal sheet with a real drag: follows the finger, rubber-bands upward,
 * dismisses on a flick OR a long pull, and snaps back with the gesture's velocity.
 */
export function BottomSheet({ visible, onClose, children, style, accessibilityLabel }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const offscreen = height;
  const y = useSharedValue(offscreen);
  const [mounted, setMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.set(offscreen);
      y.set(reduced ? withTiming(0, { duration: 1 }) : withSpring(0, Springs.sheet));
    } else if (mounted) {
      y.set(withTiming(offscreen, { duration: reduced ? 1 : 240, easing: EASE_SHEET }, (done) => {
        if (done) scheduleOnRN(setMounted, false);
      }));
    }
  }, [visible, mounted, offscreen, reduced, y]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      // Rubber-band when pulled above the resting position.
      y.set(e.translationY < 0 ? e.translationY * 0.2 : e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(closeHaptic);
        scheduleOnRN(onClose);
      } else {
        y.set(withSpring(0, { ...Springs.snapBack, velocity: e.velocityY }));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [0, offscreen * 0.6], [1, 0], Extrapolation.CLAMP),
  }));

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, { paddingBottom: insets.bottom + 16 }, style, sheetStyle]}
        accessibilityViewIsModal
        accessibilityLabel={accessibilityLabel}
      >
        <GestureDetector gesture={pan}>
          <View style={styles.grabZone} accessibilityRole="adjustable" accessibilityLabel="Faire glisser pour fermer">
            <View style={styles.handle} />
          </View>
        </GestureDetector>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: Colors.scrim },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignSelf: 'center', width: '100%', maxWidth: 560,
    backgroundColor: Colors.paper,
    borderTopWidth: 2, borderTopColor: Colors.ink,
    paddingHorizontal: Layout.gutter,
  },
  grabZone: { paddingTop: 10, paddingBottom: 18, alignItems: 'center' },
  handle: { width: 44, height: 3, backgroundColor: Colors.ink },
});
