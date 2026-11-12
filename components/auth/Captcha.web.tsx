// Cloudflare Turnstile, rendered only when EXPO_PUBLIC_TURNSTILE_SITE_KEY is
// set. Supabase Auth verifies the token (captchaToken) with the secret key
// pasted in the dashboard; nothing secret lives in the client.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { TText } from '@/components/ui/TText';
import { TButton } from '@/components/ui/TButton';
import { StatusDot } from '@/components/v5';
import type { CaptchaProps } from './Captcha';

export type { CaptchaProps } from './Captcha';

const SITE_KEY = (process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
// Automatic resets after an error before giving up (an invalid site key would loop forever).
const MAX_AUTO_RESETS = 2;

/** Whether auth calls must carry a captcha token on this platform. */
export const CAPTCHA_REQUIRED = SITE_KEY.length > 0;

interface TurnstileRenderOptions {
  sitekey: string;
  theme: 'auto' | 'light' | 'dark';
  language: string;
  size: 'normal' | 'flexible' | 'compact';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'timeout-callback': () => void;
  'error-callback': (code?: string) => boolean | void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | null | undefined;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

/** Injects the Turnstile script once per page; a failed load can be retried. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.addEventListener('load', () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('turnstile_unavailable'));
    }, { once: true });
    script.addEventListener('error', () => {
      script.remove();
      reject(new Error('turnstile_load_failed'));
    }, { once: true });
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

type Status = 'loading' | 'ready' | 'failed';

export function Captcha({ onToken, resetKey = 0, style }: CaptchaProps) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const lastResetKey = useRef(resetKey);
  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!CAPTCHA_REQUIRED) return;
    let cancelled = false;
    let autoResets = 0;

    loadTurnstile().then((turnstile) => {
      if (cancelled || !container.current) return;
      const reset = () => {
        if (widgetId.current) turnstile.reset(widgetId.current);
      };
      widgetId.current = turnstile.render(container.current, {
        sitekey: SITE_KEY,
        // v5 pages are paper: the light widget sits on them without a dark box.
        theme: 'light',
        language: 'fr',
        size: 'flexible',
        callback: (token) => {
          autoResets = 0;
          onTokenRef.current(token);
        },
        'expired-callback': () => {
          onTokenRef.current(null);
          reset();
        },
        'timeout-callback': () => {
          onTokenRef.current(null);
          reset();
        },
        'error-callback': () => {
          onTokenRef.current(null);
          if (autoResets < MAX_AUTO_RESETS) {
            autoResets += 1;
            reset();
          } else {
            setStatus('failed');
          }
          // Handled here: Turnstile must not throw on its own.
          return true;
        },
      }) ?? null;
      setStatus(widgetId.current ? 'ready' : 'failed');
    }, () => {
      if (!cancelled) setStatus('failed');
    });

    return () => {
      cancelled = true;
      const id = widgetId.current;
      widgetId.current = null;
      if (id) window.turnstile?.remove(id);
      onTokenRef.current(null);
    };
  }, [attempt]);

  // Tokens are single-use: the form bumps resetKey after every attempt.
  useEffect(() => {
    if (lastResetKey.current === resetKey) return;
    lastResetKey.current = resetKey;
    onTokenRef.current(null);
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, [resetKey]);

  if (!CAPTCHA_REQUIRED) return null;

  const retry = () => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  };

  return (
    <View style={[styles.wrap, style]}>
      <div
        ref={container}
        aria-label="Vérification anti-robot"
        style={{ width: '100%', minHeight: status === 'failed' ? 0 : 65, display: status === 'failed' ? 'none' : 'block' }}
      />
      {status === 'failed' && (
        <View style={styles.failed} accessibilityRole="alert">
          <StatusDot tone="alert" label="Vérification indisponible" />
          <TText variant="caption" color="secondary" style={styles.failedText}>
            La vérification anti-robot n’a pas pu s’afficher. Vérifiez votre connexion ou désactivez le bloqueur de contenus pour ce site, puis réessayez.
          </TText>
          <TButton title="Réessayer" variant="secondary" size="sm" fullWidth={false} onPress={retry} style={styles.retry} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginBottom: Spacing.sm },
  failed: {
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.line,
    borderTopColor: Colors.flame,
    backgroundColor: Colors.white,
  },
  failedText: { marginTop: 8 },
  retry: { marginTop: Spacing.xs, alignSelf: 'flex-start' },
});
