import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { useAuthStore } from '@/store/auth-store';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

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
          <Stack.Screen name="request/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="request/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="conversation/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="create" options={{ presentation: 'modal' }} />
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
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
