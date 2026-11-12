import React, { Component, useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { router, type ErrorBoundaryProps, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { reportCrash } from '@/lib/error-reporting';

const HOME = '/';
// A chunk that no longer exists after a deploy: only a full page load fetches the new one.
const STALE_CHUNK = /loading (css )?chunk|failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i;

/**
 * Navigates once the navigator is mounted again. Unmounting the root navigator
 * drops its state, so after a reset the app restarts from its first screen.
 */
function replaceWhenReady(href: string, attemptsLeft = 30): void {
  try {
    router.replace(href as Href);
  } catch {
    if (attemptsLeft > 0) requestAnimationFrame(() => replaceWhenReady(href, attemptsLeft - 1));
  }
}

function isStaleChunk(error: Error | null): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!error && STALE_CHUNK.test(error.message);
}

interface CrashFallbackProps {
  onRetry: () => void;
  onHome: () => void;
}

/**
 * Full-screen fallback. It may render outside the root providers (root layout
 * crash), so it relies on neither safe-area insets nor gestures.
 */
export function CrashFallback({ onRetry, onHome }: CrashFallbackProps) {
  return (
    <View style={styles.screen} accessibilityLiveRegion="assertive">
      <View style={styles.column}>
        <View style={styles.iconFrame}>
          <Ionicons name="alert-circle-outline" size={22} color={Colors.accentWarm} />
        </View>
        <TText variant="displayS" style={styles.title} accessibilityRole="header">
          Quelque chose s’est mal passé
        </TText>
        <TText variant="bodySmall" color="secondary" style={styles.text}>
          Cet écran a rencontré un problème inattendu : réessayez, ou revenez à l’accueil.
        </TText>
        <View style={styles.actions}>
          <TButton title="Réessayer" size="md" onPress={onRetry} />
          <TButton title="Retour à l’accueil" variant="secondary" size="md" onPress={onHome} />
        </View>
      </View>
    </View>
  );
}

interface AppErrorBoundaryProps {
  children: ReactNode;
  /** Current path, read when an error is caught: reported (sanitised) and used by "Réessayer". */
  getRoute?: () => string;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

/** Catches render errors below the root layout, reports them and offers a way out. */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };
  private failedRoute = HOME;

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown): void {
    let route = HOME;
    try {
      route = this.props.getRoute?.() || HOME;
    } catch {
      // Keep the home route.
    }
    this.failedRoute = route;
    reportCrash(error, route);
    // A crash during start-up must not stay hidden behind the splash screen.
    SplashScreen.hideAsync().catch(() => {});
  }

  private reset(target: string): void {
    if (isStaleChunk(this.state.error)) {
      window.location.assign(target);
      return;
    }
    this.setState({ error: null }, () => replaceWhenReady(target));
  }

  private retry = () => this.reset(this.failedRoute);
  private goHome = () => this.reset(HOME);

  render() {
    if (this.state.error) return <CrashFallback onRetry={this.retry} onHome={this.goHome} />;
    return this.props.children;
  }
}

/** expo-router's per-route boundary, exported from the root layout: catches errors of the layout itself. */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportCrash(error);
    SplashScreen.hideAsync().catch(() => {});
  }, [error]);

  const restart = (target?: string) => {
    if (isStaleChunk(error)) {
      if (target) window.location.assign(target);
      else window.location.reload();
      return;
    }
    void retry().then(() => {
      if (target) replaceWhenReady(target);
    });
  };

  return <CrashFallback onRetry={() => restart()} onHome={() => restart(HOME)} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing['3xl'],
  },
  column: { width: '100%', maxWidth: 420, alignItems: 'center' },
  iconFrame: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderGlow,
    backgroundColor: Colors.glassAmber,
    marginBottom: Spacing.md,
  },
  title: { textAlign: 'center', marginBottom: Spacing['2xs'] },
  text: { textAlign: 'center', maxWidth: 360, marginBottom: Spacing.lg },
  actions: { width: '100%', maxWidth: 320, gap: 10 },
});
