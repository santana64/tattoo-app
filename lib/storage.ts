import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';

export type UploadBucket = 'avatars' | 'covers' | 'posts-media' | 'request-references' | 'healed-photos';

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
  onProgress?: (progress: number) => void,
  // Upsert needs SELECT + UPDATE storage policies; unique paths only need INSERT.
  upsert = true,
): Promise<UploadResult> {
  onProgress?.(0.1);
  const compressed = await compressImage(uri);
  onProgress?.(0.3);
  const blob = await uriToBlob(compressed);
  onProgress?.(0.5);

  const { data, error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert,
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
  onProgress?: (p: number) => void,
  upsert = true,
): Promise<UploadResult> {
  return uploadFile(uri, 'avatars', `${userId}/avatar.jpg`, onProgress, upsert);
}

// ─── Upload cover ──────────────────────────────────────────────────────────────
export async function uploadCover(
  uri: string,
  artistId: string,
  onProgress?: (p: number) => void,
  upsert = true,
): Promise<UploadResult> {
  return uploadFile(uri, 'covers', `${artistId}/cover.jpg`, onProgress, upsert);
}

// ─── Upload post media ────────────────────────────────────────────────────────
export async function uploadPostMedia(
  uri: string,
  artistId: string,
  onProgress?: (p: number) => void
): Promise<UploadResult> {
  const filename = `${artistId}/${Date.now()}.jpg`;
  // Unique name: a plain insert is enough (upsert would also need SELECT + UPDATE policies).
  return uploadFile(uri, 'posts-media', filename, onProgress, false);
}

// ─── Upload healed photo ──────────────────────────────────────────────────────
export async function uploadHealedPhoto(
  uri: string,
  userId: string,
  onProgress?: (p: number) => void
): Promise<UploadResult> {
  // The storage policy only lets a user write under a first folder named after their id.
  return uploadFile(uri, 'healed-photos', `${userId}/${Date.now()}.jpg`, onProgress, false);
}

// ─── Upload request reference ─────────────────────────────────────────────────
export async function uploadReference(
  uri: string,
  requestId: string,
  index: number,
  onProgress?: (p: number) => void
): Promise<{ path: string }> {
  onProgress?.(0.1);
  const compressed = await compressImage(uri);
  const blob = await uriToBlob(compressed);
  if (blob.size > 10 * 1024 * 1024) throw new Error('Cette image dépasse la limite de 10 Mo.');
  const path = `${requestId}/ref_${index}.jpg`;
  const { error } = await supabase.storage.from('request-references').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  onProgress?.(1);
  // This bucket is private. A public URL would be unusable and misleading.
  return { path };
}

export interface SignedRequestReference { path: string; url: string }

export async function saveReferenceMetadata(requestId: string, path: string): Promise<void> {
  if (!['ref_0.jpg', 'ref_1.jpg', 'ref_2.jpg'].some((name) => path === `${requestId}/${name}`)) {
    throw new Error('Chemin de référence invalide.');
  }
  const { data, error } = await supabase.from('request_references')
    .select('id').eq('request_id', requestId).eq('url', path).maybeSingle();
  if (error) throw error;
  if (data) return;
  const { error: insertError } = await supabase.from('request_references').insert({ request_id: requestId, url: path });
  if (insertError && insertError.code !== '23505') throw insertError;
}

export async function attachReference(uri: string, requestId: string, index: number): Promise<{ path: string }> {
  const result = await uploadReference(uri, requestId, index);
  await saveReferenceMetadata(requestId, result.path);
  return result;
}

export async function removeReference(requestId: string, path: string): Promise<void> {
  if (!['ref_0.jpg', 'ref_1.jpg', 'ref_2.jpg'].some((name) => path === `${requestId}/${name}`)) {
    throw new Error('Chemin de référence invalide.');
  }
  const { error: deleteError } = await supabase.from('request_references')
    .delete().eq('request_id', requestId).eq('url', path);
  if (deleteError) throw deleteError;
  // If Storage fails, the object remains visible in the dossier and the client can retry.
  const { error } = await supabase.storage.from('request-references').remove([path]);
  if (error) throw error;
}

export async function signedRequestReferences(requestId: string, expiresIn = 300): Promise<SignedRequestReference[]> {
  const bucket = supabase.storage.from('request-references');
  const { data: files, error } = await bucket.list(requestId, { limit: 10, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw error;
  const paths = (files ?? [])
    .filter((file) => /^ref_[0-2]\.jpg$/.test(file.name))
    .map((file) => `${requestId}/${file.name}`);
  const signed = await Promise.all(paths.map(async (path) => {
    const { data, error: signError } = await bucket.createSignedUrl(path, expiresIn);
    if (signError) throw signError;
    return { path, url: data.signedUrl };
  }));
  return signed;
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
