import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';

export type UploadBucket = 'avatars' | 'covers' | 'posts-media' | 'request-references';

export interface UploadResult {
  url: string;
  path: string;
}

// ─── Compress image before upload ────────────────────────────────────────────
async function compressImage(uri: string, maxWidth = 1200): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

// ─── Convert URI to Blob ──────────────────────────────────────────────────────
async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

// ─── Upload a single file ─────────────────────────────────────────────────────
export async function uploadFile(
  uri: string,
  bucket: UploadBucket,
  path: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  onProgress?.(0.1);
  const compressed = await compressImage(uri);
  onProgress?.(0.3);
  const blob = await uriToBlob(compressed);
  onProgress?.(0.5);

  const { data, error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  onProgress?.(0.9);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  onProgress?.(1);
  return { url: urlData.publicUrl, path: data.path };
}

// ─── Upload avatar ─────────────────────────────────────────────────────────────
export async function uploadAvatar(
  uri: string,
  userId: string,
  onProgress?: (p: number) => void
): Promise<UploadResult> {
  return uploadFile(uri, 'avatars', `${userId}/avatar.jpg`, onProgress);
}

// ─── Upload cover ──────────────────────────────────────────────────────────────
export async function uploadCover(
  uri: string,
  artistId: string,
  onProgress?: (p: number) => void
): Promise<UploadResult> {
  return uploadFile(uri, 'covers', `${artistId}/cover.jpg`, onProgress);
}

// ─── Upload post media ────────────────────────────────────────────────────────
export async function uploadPostMedia(
  uri: string,
  artistId: string,
  onProgress?: (p: number) => void
): Promise<UploadResult> {
  const filename = `${artistId}/${Date.now()}.jpg`;
  return uploadFile(uri, 'posts-media', filename, onProgress);
}

// ─── Upload request reference ─────────────────────────────────────────────────
export async function uploadReference(
  uri: string,
  requestId: string,
  index: number,
  onProgress?: (p: number) => void
): Promise<UploadResult> {
  return uploadFile(uri, 'request-references', `${requestId}/ref_${index}.jpg`, onProgress);
}

// ─── Pick image from library ──────────────────────────────────────────────────
export async function pickImage(options?: {
  multiple?: boolean;
  aspect?: [number, number];
}): Promise<string[] | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: options?.multiple ?? false,
    allowsEditing: !options?.multiple,
    aspect: options?.aspect,
    quality: 0.9,
  });

  if (result.canceled) return null;
  return result.assets.map((a) => a.uri);
}

// ─── Pick from camera ─────────────────────────────────────────────────────────
export async function pickFromCamera(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.9,
  });

  if (result.canceled) return null;
  return result.assets[0].uri;
}
