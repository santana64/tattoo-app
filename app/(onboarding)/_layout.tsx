import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="client/step1" />
      <Stack.Screen name="client/step2" />
      <Stack.Screen name="client/step3" />
      <Stack.Screen name="artist/step1" />
      <Stack.Screen name="artist/step2" />
      <Stack.Screen name="artist/step3" />
      <Stack.Screen name="artist/step4" />
      <Stack.Screen name="artist/step5" />
      <Stack.Screen name="paywall" />
    </Stack>
  );
}
