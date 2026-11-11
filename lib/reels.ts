// Reels: short videos, either uploaded to Inkr or linked from TikTok / Instagram.
// Pure helpers only (no React, no network), so they are unit-tested as is.

export type ReelProvider = 'tiktok' | 'instagram';

export interface ParsedReel {
  provider: ReelProvider;
  /** Canonical page of the video: what is stored in posts.media_url (see migration 010). */
  canonicalUrl: string;
  /** Address of the provider's embeddable player. */
  embedUrl: string;
}

export const REEL_PROVIDER_LABEL: Record<ReelProvider, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 90;
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

const TIKTOK_PATH = /^\/@([A-Za-z0-9._]{1,64})\/video\/([0-9]{8,24})\/?$/;
const INSTAGRAM_PATH = /^\/(?:[A-Za-z0-9._]{1,30}\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]{5,32})\/?$/;

function embedUrlFor(provider: ReelProvider, id: string): string {
  return provider === 'tiktok'
    ? `https://www.tiktok.com/embed/v2/${id}`
    : `https://www.instagram.com/reel/${id}/embed`;
}

/**
 * Reads a TikTok or Instagram video link pasted by an artist.
 * Returns null for anything else, including shortened links (vm.tiktok.com,
 * instagr.am), which cannot be turned into a player without following them.
 */
export function parseReelUrl(input: string): ParsedReel | null {
  const raw = input.trim();
  if (!raw || raw.length > 500) return null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password || url.port) return null;

  const host = url.hostname.toLowerCase();

  if (host === 'www.tiktok.com' || host === 'tiktok.com' || host === 'm.tiktok.com') {
    const match = TIKTOK_PATH.exec(url.pathname);
    if (!match) return null;
    const [, user, id] = match;
    return {
      provider: 'tiktok',
      canonicalUrl: `https://www.tiktok.com/@${user}/video/${id}`,
      embedUrl: embedUrlFor('tiktok', id),
    };
  }

  if (host === 'www.instagram.com' || host === 'instagram.com' || host === 'm.instagram.com') {
    const match = INSTAGRAM_PATH.exec(url.pathname);
    if (!match) return null;
    const id = match[1];
    return {
      provider: 'instagram',
      canonicalUrl: `https://www.instagram.com/reel/${id}/`,
      embedUrl: embedUrlFor('instagram', id),
    };
  }

  return null;
}

/**
 * Player address for a stored linked reel. The stored URL is parsed again
 * rather than trusted, so only a genuine provider address can reach an iframe.
 */
export function reelEmbedUrl(provider: string | null | undefined, mediaUrl: string | null | undefined): string | null {
  if (!provider || !mediaUrl) return null;
  const parsed = parseReelUrl(mediaUrl);
  return parsed && parsed.provider === provider ? parsed.embedUrl : null;
}

/** Why a picked video file cannot be published, in French, or null when it can. */
export function videoFileError(file: { size?: number | null; mimeType?: string | null; durationMs?: number | null }): string | null {
  if (file.mimeType && !(VIDEO_MIME_TYPES as readonly string[]).includes(file.mimeType.toLowerCase())) {
    return 'Format non pris en charge. Choisissez une vidéo MP4, MOV ou WebM.';
  }
  if (typeof file.size === 'number' && file.size > MAX_VIDEO_BYTES) {
    return 'Vidéo trop lourde : 50 Mo maximum.';
  }
  if (typeof file.durationMs === 'number' && file.durationMs > MAX_VIDEO_SECONDS * 1000) {
    return `Vidéo trop longue : ${MAX_VIDEO_SECONDS} secondes maximum.`;
  }
  return null;
}

/** File extension for an uploaded video, from its MIME type. */
export function videoExtension(mimeType: string | null | undefined): 'mp4' | 'mov' | 'webm' {
  const type = (mimeType ?? '').toLowerCase();
  if (type === 'video/quicktime') return 'mov';
  if (type === 'video/webm') return 'webm';
  return 'mp4';
}
