import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { useAuthStore } from '@/store/auth-store';
import { Colors } from '@/constants/theme';
import { ToastProvider } from '@/components/ui/TToast';
import { registerForPushNotifications } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initialize, isLoading, isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    SplashScreen.hideAsync();

    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';
    const inTabs = segments[0] === '(tabs)';

    if (!isAuthenticated && !inAuth) {
      router.replace('/(auth)/welcome');
      return;
    }
    if (isAuthenticated && user && !user.onboardingCompleted && !inOnboarding) {
      router.replace(
        user.role === 'artist'
          ? '/(onboarding)/artist/step1'
          : '/(onboarding)/client/step1'
      );
      return;
    }
    if (isAuthenticated && user?.onboardingCompleted && (inAuth || inOnboarding)) {
      router.replace('/(tabs)');
      return;
    }
    if (isAuthenticated && user && !user.role && !inAuth) {
      router.replace('/(auth)/role-select');
    }
  }, [isLoading, isAuthenticated, user]);

  // Register push notifications when user is logged in
  useEffect(() => {
    if (user?.id) {
      registerForPushNotifications(user.id).catch(() => {});
    }
  }, [user?.id]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bgPrimary }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={Colors.bgPrimary} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
          <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="artist/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="post/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="request/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="request/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="conversation/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="review/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="appointment/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings/account" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings/notifications" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings/privacy" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings/subscription" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings/support" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings/delete-account" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="analytics" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="customization" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="premium-guide" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="saved" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="legal/terms" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
          <Stack.Screen name="legal/privacy-policy" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        </Stack>
        <ToastProvider />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
