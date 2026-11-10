import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { useFonts } from 'expo-font';
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from '@expo-google-fonts/geist';
import { useAuthStore } from '@/store/auth-store';
import { Colors } from '@/constants/theme';
import { ToastProvider } from '@/components/ui/TToast';
import { registerForPushNotifications } from '@/lib/notifications';
import { authRedirect } from '@/lib/auth-routing';
import { Seo } from '@/components/Seo';
import { pageMeta } from '@/lib/site';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initialize, isLoading, isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });
  // A font failure must not lock the app behind the splash: fall back to system fonts.
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    return initialize();
  }, [initialize]);

  useEffect(() => {
    if (isLoading || !fontsReady) return;
    SplashScreen.hideAsync();

    const redirect = authRedirect(segments, isAuthenticated, user);
    if (redirect) router.replace(redirect);
  }, [isLoading, fontsReady, isAuthenticated, user, segments, router]);

  // Register push notifications when user is logged in
  useEffect(() => {
    if (user?.id) {
      registerForPushNotifications(user.id).catch(() => {});
    }
  }, [user?.id]);

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bgPrimary }}>
      <SafeAreaProvider>
        <Seo {...pageMeta(segments)} />
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
          <Stack.Screen name="admin" options={{ animation: 'slide_from_right' }} />
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
