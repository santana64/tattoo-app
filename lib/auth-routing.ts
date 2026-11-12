export function isPublicRoute(segments: readonly string[]): boolean {
  const [group, screen] = segments;
  return !group || group === '(auth)' || group === 'artist' || group === 'post' || group === 'reels' || group === 'series'
    || (group === 'flash' && screen !== 'new')
    || group === 'legal' || (group === 'auth' && screen === 'callback')
    || (group === '(tabs)' && (!screen || screen === 'index' || screen === 'explore'));
}

export function authRedirect(segments: readonly string[], authenticated: boolean, user: { onboardingCompleted: boolean; role: 'artist' | 'user' } | null) {
  const [group, screen] = segments;
  if (group === 'auth' && screen === 'callback') return null;
  if (!authenticated || !user) return isPublicRoute(segments) ? null : '/(auth)/sign-in';
  if (user.onboardingCompleted) {
    // A client may come back to role selection to open an artist space.
    if (group === '(auth)' && screen === 'role-select' && user.role === 'user') return null;
    return group === '(auth)' || group === '(onboarding)' ? '/(tabs)' : null;
  }
  if (group === '(onboarding)' || (isPublicRoute(segments) && group !== '(auth)')) return null;
  if (group === '(auth)' && screen === 'role-select') return null;
  // profiles.role defaults to 'user', so an unfinished 'user' has not necessarily chosen:
  // let them pick client or artist first. Artists resume their own steps.
  return user.role === 'artist' ? '/(onboarding)/artist/step1' : '/(auth)/role-select';
}

/**
 * Where to send someone back after signing in. Only in-app paths are accepted,
 * so a crafted link cannot turn the sign-in screen into an open redirect.
 */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== 'string' || next.length > 300) return null;
  if (!/^\/[A-Za-z0-9]/.test(next)) return null;
  if (next.includes('//') || next.includes('\\') ||/[\s<>"'`]/.test(next)) return null;
  if (/^\/(auth|sign-in|welcome|role-select)(\/|\?|$)/.test(next)) return null;
  return next;
}
