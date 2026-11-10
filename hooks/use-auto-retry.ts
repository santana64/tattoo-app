import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** Waits between automatic retries; after the last one the user retries by hand. */
export const RETRY_DELAYS_MS = [2000, 5000, 12000] as const;

/** Delay before retry number `attempt` (0-based), or null once the budget is spent. */
export function retryDelay(attempt: number): number | null {
  return attempt >= 0 && attempt < RETRY_DELAYS_MS.length ? RETRY_DELAYS_MS[attempt] : null;
}

/**
 * Retries a failed load on its own: a few times with growing pauses, and at
 * once when the browser reports the connection is back. A screen that failed
 * during a brief network drop recovers without the user pressing "Réessayer".
 *
 * `failed`: the load ended in error and nothing is shown. `loading`: a load is
 * in progress. The retry budget is only refilled by a load that succeeded.
 */
export function useAutoRetry(failed: boolean, loading: boolean, retry: () => void) {
  const attempts = useRef(0);
  const retryRef = useRef(retry);
  useEffect(() => {
    retryRef.current = retry;
  });

  useEffect(() => {
    if (!failed || loading) {
      return;
    }
    const delay = retryDelay(attempts.current);
    const timer = delay === null ? undefined : setTimeout(() => {
      attempts.current += 1;
      retryRef.current();
    }, delay);

    const onOnline = () => {
      attempts.current = 0;
      retryRef.current();
    };
    const canListen = Platform.OS === 'web' && typeof window !== 'undefined';
    if (canListen) window.addEventListener('online', onOnline);

    return () => {
      if (timer) clearTimeout(timer);
      if (canListen) window.removeEventListener('online', onOnline);
    };
  }, [failed, loading]);

  // A successful load gives the next failure a fresh budget.
  useEffect(() => {
    if (!failed && !loading) attempts.current = 0;
  }, [failed, loading]);
}
