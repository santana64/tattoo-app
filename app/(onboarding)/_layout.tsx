import { Stack } from 'expo-router';
import { Colors } from '@/constants/theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Same wall color behind every step: no white flash between screens.
        contentStyle: { backgroundColor: Colors.bgPrimary },
      }}
    >
      <Stack.Screen name="client/step1" />
      <Stack.Screen name="client/step2" />
      <Stack.Screen name="client/step3" />
      <Stack.Screen name="artist/step1" />
      <Stack.Screen name="artist/step2" />
      <Stack.Screen name="artist/step3" />
      <Stack.Screen name="artist/step4" />
      <Stack.Screen name="artist/step5" />
    </Stack>
  );
}
