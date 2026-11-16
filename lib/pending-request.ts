import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

interface PendingScope {
  userId: string;
  artistId: string;
  flashId?: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AGE_MS = 30 * 86400_000;

function keyFor(scope: PendingScope): string {
  const flash = scope.flashId && UUID.test(scope.flashId) ? scope.flashId : 'none';
  return `inkr_pending_v1_${scope.userId}_${scope.artistId}_${flash}`;
}

async function read(key: string): Promise<string | null> {
  if (Platform.OS !== 'web') return SecureStore.getItemAsync(key);
  if (typeof localStorage === 'undefined') throw new Error('Stockage local indisponible.');
  return localStorage.getItem(key);
}

async function write(key: string, value: string): Promise<void> {
  if (Platform.OS !== 'web') return SecureStore.setItemAsync(key, value);
  if (typeof localStorage === 'undefined') throw new Error('Stockage local indisponible.');
  localStorage.setItem(key, value);
}

async function remove(key: string): Promise<void> {
  if (Platform.OS !== 'web') return SecureStore.deleteItemAsync(key);
  if (typeof localStorage === 'undefined') throw new Error('Stockage local indisponible.');
  localStorage.removeItem(key);
}

/** Stores only an opaque request id, never the brief or image URIs. */
export async function savePendingRequest(scope: PendingScope, requestId: string): Promise<void> {
  if (!UUID.test(requestId)) throw new Error('Identifiant de demande invalide.');
  await write(keyFor(scope), JSON.stringify({ id: requestId, createdAt: Date.now() }));
}

export async function loadPendingRequest(scope: PendingScope): Promise<string | null> {
  const key = keyFor(scope);
  const raw = await read(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (UUID.test(value.id) && Number.isFinite(value.createdAt)
      && Date.now() >= value.createdAt && Date.now() - value.createdAt <= MAX_AGE_MS) return value.id;
  } catch { /* Corrupt local data is discarded below. */ }
  await remove(key);
  return null;
}

export async function clearPendingRequest(scope: PendingScope): Promise<void> {
  await remove(keyFor(scope));
}
