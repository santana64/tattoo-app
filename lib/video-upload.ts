import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { MAX_VIDEO_SECONDS, videoExtension, videoFileError } from './reels';

export interface PickedVideo {
  uri: string;
  mimeType: string | null;
  size: number | null;
  durationMs: number | null;
}

export interface UploadedVideo {
  url: string;
  /** Poster image, when one could be captured (web only for now). */
  thumbnailUrl: string | null;
}

const POSTER_WIDTH = 720;
const POSTER_TIMEOUT_MS = 8000;

/** Lets the artist choose a short video from their library. Returns null when cancelled or refused. */
export async function pickVideo(): Promise<PickedVideo | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    allowsEditing: false,
    videoMaxDuration: MAX_VIDEO_SECONDS,
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? null,
    size: asset.fileSize ?? null,
    durationMs: asset.duration ?? null,
  };
}

/**
 * First frame of a video as a JPEG, for the feed and the profile grid.
 * Browser only: native has no built-in way to decode a frame, so the cards
 * fall back to the neutral video placeholder there.
 */
async function capturePoster(uri: string): Promise<Blob | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;

  return new Promise<Blob | null>((resolve) => {
    const video = document.createElement('video');
    let settled = false;
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(blob);
    };
    const timer = setTimeout(() => finish(null), POSTER_TIMEOUT_MS);

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onerror = () => finish(null);
    video.onloadeddata = () => {
      // A little past the start: the very first frame is often black.
      video.currentTime = Math.min(0.4, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      try {
        const scale = Math.min(1, POSTER_WIDTH / (video.videoWidth || POSTER_WIDTH));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round((video.videoWidth || POSTER_WIDTH) * scale);
        canvas.height = Math.round((video.videoHeight || POSTER_WIDTH) * scale);
        const context = canvas.getContext('2d');
        if (!context) return finish(null);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.8);
      } catch {
        finish(null);
      }
    };
    video.src = uri;
  });
}

/**
 * Uploads a reel to the artist's folder of the posts-media bucket.
 * Throws an Error with a French message when the file cannot be published.
 */
export async function uploadPostVideo(
  video: PickedVideo,
  artistId: string,
  onProgress?: (progress: number) => void,
): Promise<UploadedVideo> {
  onProgress?.(0.05);
  const blob = await (await fetch(video.uri)).blob();
  const mimeType = (video.mimeType ?? blob.type ?? '').toLowerCase() || 'video/mp4';

  const refusal = videoFileError({ size: blob.size, mimeType, durationMs: video.durationMs });
  if (refusal) throw new Error(refusal);

  onProgress?.(0.15);
  const stamp = Date.now();
  const path = `${artistId}/${stamp}.${videoExtension(mimeType)}`;
  const { data, error } = await supabase.storage.from('posts-media').upload(path, blob, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw error;
  onProgress?.(0.8);

  // The poster is a nicety: the reel is published even if it cannot be made.
  let thumbnailUrl: string | null = null;
  try {
    const poster = await capturePoster(video.uri);
    if (poster) {
      const posterPath = `${artistId}/${stamp}-poster.jpg`;
      const uploaded = await supabase.storage.from('posts-media').upload(posterPath, poster, {
        contentType: 'image/jpeg',
        upsert: false,
      });
      if (!uploaded.error) {
        thumbnailUrl = supabase.storage.from('posts-media').getPublicUrl(uploaded.data.path).data.publicUrl;
      }
    }
  } catch {
    thumbnailUrl = null;
  }

  onProgress?.(1);
  return { url: supabase.storage.from('posts-media').getPublicUrl(data.path).data.publicUrl, thumbnailUrl };
}
