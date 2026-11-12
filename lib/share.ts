// Sharing a public page: the system share sheet when there is one, otherwise
// a copied link. The decisions (which URL, which strategy, what counts as a
// cancellation) are pure functions so tests/share.test.cjs can cover them.
import { Platform, Share } from 'react-native';
import { SITE_URL, absoluteUrl as siteUrl } from './site';

export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'failed';
export type ShareStrategy = 'native-sheet' | 'web-share' | 'clipboard' | 'legacy-copy' | 'none';

export interface ShareInput {
  title: string;
  text?: string;
  /** Absolute public URL, see absoluteUrl(). */
  url: string;
}

export interface ShareCapabilities {
  platform: 'web' | 'ios' | 'android' | 'other';
  /** navigator.share exists and accepts this payload. */
  webShare: boolean;
  /** navigator.clipboard.writeText exists (secure context). */
  clipboard: boolean;
  /** A DOM is available for the textarea + execCommand('copy') fallback. */
  legacyCopy: boolean;
}

/**
 * Public URL of an in-app path, built from the configured site URL (never
 * from window.location, which does not exist on native). Anything that is
 * not a plain path on this site is reduced to one, so a share can never
 * point somewhere else.
 */
export function absoluteUrl(path: string): string {
  let clean = String(path ?? '').trim();
  if (clean.startsWith(SITE_URL)) clean = clean.slice(SITE_URL.length);
  // Drop any scheme/host and protocol-relative prefix ("//evil.example").
  clean = clean.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '').replace(/\\/g, '/').replace(/^\/+/, '/');
  if (clean === '/' || clean === '') return SITE_URL;
  return siteUrl(clean);
}

/** The best way to share given what the device offers, in order of preference. */
export function chooseShareStrategy(caps: ShareCapabilities): ShareStrategy {
  if (caps.platform !== 'web') return 'native-sheet';
  if (caps.webShare) return 'web-share';
  if (caps.clipboard) return 'clipboard';
  if (caps.legacyCopy) return 'legacy-copy';
  return 'none';
}

/** A share sheet closed without choosing a target is not an error. */
export function isShareCancellation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === 'AbortError') return true;
  return typeof message === 'string' && /cancel|abort|dismiss/i.test(message);
}

/**
 * What React Native's Share.share receives. iOS shows the URL as a link
 * preview next to the text; Android only reads `message`, so the URL goes there.
 */
export function nativeShareContent(platform: ShareCapabilities['platform'], input: ShareInput) {
  const text = input.text?.trim();
  if (platform === 'ios') {
    return { title: input.title, message: text || input.title, url: input.url };
  }
  return { title: input.title, message: `${text || input.title}\n${input.url}` };
}

/** The payload handed to navigator.share. */
export function webShareData(input: ShareInput): { title: string; text?: string; url: string } {
  const text = input.text?.trim();
  return text ? { title: input.title, text, url: input.url } : { title: input.title, url: input.url };
}

// ── Effects ──────────────────────────────────────────────────────────────────

interface WebNavigator {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  canShare?: (data: { title?: string; text?: string; url?: string }) => boolean;
  clipboard?: { writeText?: (text: string) => Promise<void> };
}

interface WebDocument {
  createElement(tag: 'textarea'): {
    value: string;
    style: { [key: string]: string };
    setAttribute(name: string, value: string): void;
    select(): void;
  };
  body: { appendChild(node: unknown): unknown; removeChild(node: unknown): unknown } | null;
  execCommand?(command: string): boolean;
}

export interface ShareEnvironment {
  platform: ShareCapabilities['platform'];
  navigator?: WebNavigator;
  document?: WebDocument;
  nativeShare?: (content: { title?: string; message: string; url?: string }) => Promise<{ action: string }>;
}

export function capabilitiesOf(env: ShareEnvironment, input: ShareInput): ShareCapabilities {
  const nav = env.navigator;
  const data = webShareData(input);
  let webShare = typeof nav?.share === 'function';
  if (webShare && typeof nav?.canShare === 'function') {
    try { webShare = nav.canShare(data); } catch { webShare = false; }
  }
  return {
    platform: env.platform,
    webShare,
    clipboard: typeof nav?.clipboard?.writeText === 'function',
    legacyCopy: !!env.document?.body && typeof env.document.execCommand === 'function',
  };
}

function legacyCopy(doc: WebDocument, text: string): boolean {
  if (!doc.body || typeof doc.execCommand !== 'function') return false;
  const area = doc.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  Object.assign(area.style, { position: 'fixed', top: '0', left: '-9999px', opacity: '0' });
  doc.body.appendChild(area);
  try {
    area.select();
    return doc.execCommand('copy');
  } catch {
    return false;
  } finally {
    doc.body.removeChild(area);
  }
}

async function copyLink(env: ShareEnvironment, url: string): Promise<ShareOutcome> {
  const writeText = env.navigator?.clipboard?.writeText;
  if (typeof writeText === 'function') {
    try {
      await writeText.call(env.navigator?.clipboard, url);
      return 'copied';
    } catch {
      // Permission refused or insecure context: try the legacy path below.
    }
  }
  return env.document && legacyCopy(env.document, url) ? 'copied' : 'failed';
}

/** Runs a share with an explicit environment (used directly by the tests). */
export async function performShare(input: ShareInput, env: ShareEnvironment): Promise<ShareOutcome> {
  const strategy = chooseShareStrategy(capabilitiesOf(env, input));
  switch (strategy) {
    case 'native-sheet': {
      if (!env.nativeShare) return 'failed';
      try {
        const result = await env.nativeShare(nativeShareContent(env.platform, input));
        return result.action === 'dismissedAction' ? 'dismissed' : 'shared';
      } catch (error) {
        return isShareCancellation(error) ? 'dismissed' : 'failed';
      }
    }
    case 'web-share': {
      try {
        await env.navigator!.share!(webShareData(input));
        return 'shared';
      } catch (error) {
        if (isShareCancellation(error)) return 'dismissed';
        // Refused outside a user gesture, unsupported payload…: copy instead.
        return copyLink(env, input.url);
      }
    }
    case 'clipboard':
    case 'legacy-copy':
      return copyLink(env, input.url);
    default:
      return 'failed';
  }
}

function currentEnvironment(): ShareEnvironment {
  if (Platform.OS === 'web') {
    const g = globalThis as { navigator?: WebNavigator; document?: WebDocument };
    return { platform: 'web', navigator: g.navigator, document: g.document };
  }
  return {
    platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other',
    nativeShare: (content) => Share.share(content, { dialogTitle: content.title, subject: content.title }),
  };
}

/** Shares a public link with the best mechanism available on this device. */
export function shareLink(input: ShareInput): Promise<ShareOutcome> {
  return performShare(input, currentEnvironment());
}
