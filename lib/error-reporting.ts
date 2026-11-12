// Uncaught errors go to the app's own database (report_client_error, see
// lib/care.ts). Only the error itself, a route stripped of ids and query
// string, the platform and the app version leave the device.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { reportError, type ClientError } from './care';

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
interface ErrorUtilsLike {
  getGlobalHandler: () => GlobalHandler | undefined;
  setGlobalHandler: (handler: GlobalHandler) => void;
}
interface HermesLike {
  enablePromiseRejectionTracker?: (options: {
    allRejections: boolean;
    onUnhandled: (id: number, rejection: unknown) => void;
  }) => void;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const NETWORK_FAILURE = /failed to fetch|network request failed|networkerror when attempting to fetch|load failed|network connection was lost|internet connection appears to be offline|err_internet_disconnected/i;
const ABORTED = /^aborterror\b|signal is aborted|(operation|request|fetch) (is|was) aborted|user aborted a request/i;
const MAX_ROUTE_LENGTH = 200;

function readString(value: unknown, key: 'message' | 'name' | 'stack'): string {
  if (typeof value === 'string') return key === 'message' ? value : '';
  if (value && typeof value === 'object') {
    const field = (value as Record<string, unknown>)[key];
    if (typeof field === 'string') return field;
  }
  return '';
}

/** Whether the device says it has no network. Native has no reliable signal: a report sent offline simply never arrives. */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && (navigator as { onLine?: boolean }).onLine === false;
}

/**
 * Filters out what nobody can act on: errors without a message, ResizeObserver
 * loop warnings, cross-origin "Script error.", aborted requests, and network
 * failures while the device is offline.
 */
export function shouldReport(error: unknown, offline: boolean = isOffline()): boolean {
  const message = readString(error, 'message').trim();
  if (!message) return false;
  if (/resizeobserver loop/i.test(message)) return false;
  if (/^script error\.?$/i.test(message)) return false;
  if (readString(error, 'name') === 'AbortError' || ABORTED.test(message)) return false;
  if (offline && NETWORK_FAILURE.test(message)) return false;
  return true;
}

/**
 * Keeps the shape of a path and nothing that says who looked at what:
 * no query string or fragment, and UUIDs, long ids, numeric ids and
 * e-mail-like segments become ":id".
 */
export function sanitizeRoute(path: string): string {
  let raw = typeof path === 'string' ? path.trim() : '';
  raw = raw.replace(/^https?:\/\/[^/?#]*/i, '').replace(/^[a-z][a-z0-9+.-]*:\/\//i, '/');
  raw = raw.split(/[?#]/, 1)[0] ?? '';
  const segments = raw.split('/').filter(Boolean).map((segment) => {
    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      // Malformed escape: judge the raw segment.
    }
    const isId = UUID.test(decoded)
      || /^\d{4,}$/.test(decoded)
      || decoded.includes('@')
      || (decoded.length >= 16 && /^[\w-]+$/.test(decoded) && /\d/.test(decoded));
    return isId ? ':id' : segment;
  });
  const clean = `/${segments.join('/')}`;
  return clean.length > MAX_ROUTE_LENGTH ? clean.slice(0, MAX_ROUTE_LENGTH) : clean;
}

/** reportError formats real Error objects; plain rejections ({ message }) and strings become one. */
function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  const normalized = new Error(readString(error, 'message').trim());
  const name = readString(error, 'name');
  if (name) normalized.name = name;
  // An empty stack is stored as null: a stack built here would point at this file.
  normalized.stack = readString(error, 'stack');
  return normalized;
}

export function appVersion(): string | undefined {
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' && version ? version : undefined;
}

const isDevelopment = () => typeof __DEV__ !== 'undefined' && __DEV__;

let installed = false;
let routeProvider: () => string = () => '/';

function currentRoute(): string {
  try {
    return routeProvider();
  } catch {
    return '/';
  }
}

/** Reports one error with its context. Never throws; silent in development. */
export function reportCrash(error: unknown, route?: string): void {
  try {
    if (isDevelopment() || !shouldReport(error)) return;
    reportError(toError(error), {
      route: sanitizeRoute(route ?? currentRoute()),
      platform: Platform.OS,
      appVersion: appVersion(),
    });
  } catch {
    // Reporting must never break the app.
  }
}

/** Listens for uncaught errors once; later calls only update the route provider. */
export function installErrorReporting(getRoute: () => string): void {
  routeProvider = getRoute;
  if (installed) return;

  if (Platform.OS === 'web') {
    // Static rendering evaluates modules without a window.
    if (typeof window === 'undefined') return;
    installed = true;
    window.addEventListener('error', (event) => reportCrash(event.error ?? event.message));
    window.addEventListener('unhandledrejection', (event) => reportCrash(event.reason));
    return;
  }

  installed = true;
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      reportCrash(error);
      previous?.(error, isFatal);
    });
  }
  // Hermes tracks unhandled rejections only in development (for LogBox); in
  // release builds they would vanish without a trace.
  if (!isDevelopment()) {
    const hermes = (globalThis as { HermesInternal?: HermesLike }).HermesInternal;
    hermes?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id, rejection) => reportCrash(rejection),
    });
  }
}

// ── Admin view ───────────────────────────────────────────────────────────────

export interface ClientErrorGroup {
  message: string;
  count: number;
  /** Most recent occurrence: its route, platform, version and stack are shown. */
  latest: ClientError;
  firstSeen: string;
  platforms: string[];
}

/** Groups identical messages, the group with the most recent occurrence first. */
export function groupClientErrors(rows: readonly ClientError[]): ClientErrorGroup[] {
  const groups = new Map<string, ClientErrorGroup>();
  const time = (iso: string) => new Date(iso).getTime();
  for (const row of rows) {
    const group = groups.get(row.message);
    if (!group) {
      groups.set(row.message, {
        message: row.message, count: 1, latest: row, firstSeen: row.created_at,
        platforms: row.platform ? [row.platform] : [],
      });
      continue;
    }
    group.count += 1;
    if (time(row.created_at) > time(group.latest.created_at)) group.latest = row;
    if (time(row.created_at) < time(group.firstSeen)) group.firstSeen = row.created_at;
    if (row.platform && !group.platforms.includes(row.platform)) group.platforms.push(row.platform);
  }
  return [...groups.values()].sort((a, b) => time(b.latest.created_at) - time(a.latest.created_at));
}
