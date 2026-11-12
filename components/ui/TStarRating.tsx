import React from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, useReducedMotion,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors, SpringConfig } from '@/constants/theme';

interface TStarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
}

const MIN_TARGET = 40;

function Star({ index, filled, onPress, size }: {
  index: number; filled: boolean; onPress?: () => void; size: number;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const icon = (
    <Ionicons
      name={filled ? 'star' : 'star-outline'}
      size={size}
      color={filled ? Colors.flame : Colors.metal}
    />
  );

  if (!onPress) return <View style={styles.staticStar}>{icon}</View>;

  const pad = Math.max(0, (MIN_TARGET - size) / 2);
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => { if (!reduced) scale.value = withSpring(0.9, SpringConfig.snappy); }}
        onPressOut={() => { scale.value = withSpring(1, SpringConfig.gentle); }}
        accessibilityRole="button"
        accessibilityLabel={`${index} étoile${index > 1 ? 's' : ''} sur 5`}
        accessibilityState={{ selected: filled }}
        style={{ padding: pad }}
      >
        {icon}
      </Pressable>
    </Animated.View>
  );
}

export function TStarRating({ value, onChange, size = 28, readonly = false }: TStarRatingProps) {
  const interactive = !!onChange && !readonly;
  const rounded = Math.round(value);
  return (
    <View
      style={[styles.row, !interactive && styles.rowStatic]}
      accessible={!interactive}
      accessibilityRole={interactive ? undefined : 'image'}
      accessibilityLabel={interactive ? undefined : `Note : ${rounded} sur 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          index={i}
          filled={i <= rounded}
          onPress={interactive ? () => onChange!(i) : undefined}
          size={size}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  rowStatic: { gap: 2 },
  staticStar: { alignItems: 'center', justifyContent: 'center' },
});
