import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/constants/theme';
import { TText } from './TText';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface TAvatarProps {
  uri?: string | null;
  name?: string;
  size?: AvatarSize;
  showBadge?: boolean;
  isPremium?: boolean;
  style?: ViewStyle;
}

const sizeMap: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
  '2xl': 96,
};

/**
 * Square portrait plate. Without a photo: the first initial in serif italic on
 * a clay ground, like a monogram stamped on a cartel.
 */
export function TAvatar({ uri, name, size = 'md', showBadge = false, isPremium = false, style }: TAvatarProps) {
  const dim = sizeMap[size];
  const initial = name?.trim()?.[0]?.toLowerCase() ?? '?';

  return (
    <View style={[{ width: dim, height: dim }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: dim, height: dim, backgroundColor: Colors.clay }}
          contentFit="cover"
          accessibilityLabel={name ? `Portrait de ${name}` : undefined}
        />
      ) : (
        <View style={[styles.fallback, { width: dim, height: dim }]}>
          <TText
            variant="displayS"
            italic
            style={{ fontSize: dim * 0.58, lineHeight: dim * 0.66, letterSpacing: 0, color: Colors.ink }}
          >
            {initial}
          </TText>
        </View>
      )}
      {showBadge && isPremium && <View style={styles.badge} />}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: Colors.clay,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.clayDeep,
  },
  // Premium marker: a vermilion corner, not a floating dot.
  badge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 10,
    height: 10,
    backgroundColor: Colors.flame,
    borderWidth: 2,
    borderColor: Colors.paper,
  },
});
