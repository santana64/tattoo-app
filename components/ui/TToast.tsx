import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '@/constants/theme';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastState {
  visible: boolean;
  config: ToastConfig;
}

// ─── Singleton toast emitter ──────────────────────────────────────────────────
type Listener = (config: ToastConfig) => void;
const listeners: Listener[] = [];

export const Toast = {
  show: (config: ToastConfig) => listeners.forEach((l) => l(config)),
  success: (message: string) => Toast.show({ message, type: 'success' }),
  error: (message: string) => Toast.show({ message, type: 'error' }),
  info: (message: string) => Toast.show({ message, type: 'info' }),
};

const ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'close-circle',
  info: 'information-circle',
  warning: 'warning',
};

const COLORS: Record<ToastType, string> = {
  success: Colors.success,
  error: Colors.error,
  info: Colors.accent,
  warning: '#F59E0B',
};

// ─── Toast Provider component ─────────────────────────────────────────────────
export function ToastProvider() {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-120);
  const [state, setState] = React.useState<ToastState>({ visible: false, config: { message: '' } });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const hide = () => {
    translateY.value = withTiming(-120, { duration: 300 }, () => {
      runOnJS(setState)({ visible: false, config: { message: '' } });
    });
  };

  const show = (config: ToastConfig) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState({ visible: true, config });
    translateY.value = withSpring(insets.top + 8, { damping: 15, stiffness: 200 });
    timerRef.current = setTimeout(hide, config.duration ?? 3000);
  };

  useEffect(() => {
    listeners.push(show);
    return () => {
      const idx = listeners.indexOf(show);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  if (!state.visible) return null;
  const type = state.config.type ?? 'info';
  const color = COLORS[type];

  return (
    <Animated.View style={[styles.toast, animStyle]}>
      <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
        <Ionicons name={ICONS[type]} size={18} color={color} />
      </View>
      <Text style={styles.message} numberOfLines={2}>{state.config.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 9999,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  message: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
});
