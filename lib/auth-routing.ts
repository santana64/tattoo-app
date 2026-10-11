export function isPublicRoute(segments: readonly string[]): boolean {
  const [group, screen] = segments;
  return !group || group === '(auth)' || group === 'artist' || group === 'post'
    || group === 'legal' || (group === 'auth' && screen === 'callback')
    || (group === '(tabs)' && (!screen || screen === 'index' || screen === 'explore'));
}

export function authRedirect(segments: readonly string[], authenticated: boolean, user: { onboardingCompleted: boolean; role: 'artist' | 'user' } | null) {
  const [group, screen] = segments;
  if (group === 'auth' && screen === 'callback') return null;
  if (!authenticated || !user) return isPublicRoute(segments) ? null : '/(auth)/sign-in';
  if (user.onboardingCompleted) {
    return group === '(auth)' || group === '(onboarding)' ? '/(tabs)' : null;
  }
  if (group === '(onboarding)' || (isPublicRoute(segments) && group !== '(auth)')) return null;
  if (group === '(auth)' && screen === 'role-select') return null;
  return user.role === 'artist' ? '/(onboarding)/artist/step1' : '/(onboarding)/client/step1';
}
