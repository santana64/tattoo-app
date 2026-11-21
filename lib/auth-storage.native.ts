import * as SecureStore from 'expo-secure-store';

// SecureStore has historically enforced a ~2 kB per-value limit on iOS.
// Supabase's session JSON can exceed that, so store short, ASCII-encoded chunks.
const CHUNK_LENGTH = 1500;
const MAX_CHUNKS = 40;
type Slot = 'a' | 'b';
type Manifest = { version: 1; slot: Slot; chunks: number; retired: number };

function storagePrefix(key: string): string {
  // Supabase's storage keys have this shape (e.g. sb-<ref>-auth-token-code-verifier).
  // Reject unusual keys rather than silently generating colliding SecureStore names.
  if (!/^[A-Za-z0-9._-]{1,180}$/.test(key)) throw new Error('Invalid authentication storage key');
  return `inkr.auth.${key}`;
}

function partKey(prefix: string, slot: Slot, index: number) {
  return `${prefix}.${slot}.${index}`;
}

async function readManifest(prefix: string): Promise<Manifest | null> {
  const raw = await SecureStore.getItemAsync(`${prefix}.manifest`);
  if (!raw) return null;
  try {
    const m = JSON.parse(raw) as Partial<Manifest>;
    if (m.version === 1 && (m.slot === 'a' || m.slot === 'b')
      && Number.isInteger(m.chunks) && Number.isInteger(m.retired)
      && (m.chunks ?? 0) > 0 && (m.chunks ?? 0) <= MAX_CHUNKS
      && (m.retired ?? -1) >= 0 && (m.retired ?? -1) <= MAX_CHUNKS) return m as Manifest;
  } catch { /* A damaged manifest must not expose partial credentials. */ }
  return null;
}

/** Supabase Auth storage on iOS/Android, with atomic slot-switching. */
export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    const prefix = storagePrefix(key);
    const manifest = await readManifest(prefix);
    if (!manifest) return null;
    const parts: string[] = [];
    for (let i = 0; i < manifest.chunks; i++) {
      const chunk = await SecureStore.getItemAsync(partKey(prefix, manifest.slot, i));
      if (chunk === null) return null; // Don't return an incomplete session or PKCE verifier.
      parts.push(chunk);
    }
    try { return decodeURIComponent(parts.join('')); }
    catch { return null; }
  },

  async setItem(key: string, value: string): Promise<void> {
    const prefix = storagePrefix(key);
    const old = await readManifest(prefix);
    const slot: Slot = old?.slot === 'a' ? 'b' : 'a';
    const encoded = encodeURIComponent(value); // ASCII-only: chunk size is also byte size.
    const count = Math.max(1, Math.ceil(encoded.length / CHUNK_LENGTH));
    if (count > MAX_CHUNKS) throw new Error('Authentication session exceeds secure storage capacity');

    let written = 0;
    try {
      // An inactive slot is populated entirely before publishing its manifest.
      for (let i = 0; i < count; i++) {
        await SecureStore.setItemAsync(partKey(prefix, slot, i), encoded.slice(i * CHUNK_LENGTH, (i + 1) * CHUNK_LENGTH));
        written++;
      }
      await SecureStore.setItemAsync(`${prefix}.manifest`, JSON.stringify({ version: 1, slot, chunks: count, retired: old?.chunks ?? 0 } satisfies Manifest));
    } catch (error) {
      for (let i = 0; i < written; i++) {
        await SecureStore.deleteItemAsync(partKey(prefix, slot, i)).catch(() => {});
      }
      throw error;
    }

    // Old credentials are removed after the new version is committed.
    // If cleanup is interrupted, the manifest retains the old count for retry.
    if (old) {
      const previousSlot: Slot = slot === 'a' ? 'b' : 'a';
      let cleaned = true;
      for (let i = 0; i < old.chunks; i++) {
        try { await SecureStore.deleteItemAsync(partKey(prefix, previousSlot, i)); }
        catch { cleaned = false; }
      }
      for (let i = count; i < old.retired; i++) {
        try { await SecureStore.deleteItemAsync(partKey(prefix, slot, i)); }
        catch { cleaned = false; }
      }
      if (cleaned) {
        await SecureStore.setItemAsync(`${prefix}.manifest`, JSON.stringify({ version: 1, slot, chunks: count, retired: 0 } satisfies Manifest)).catch(() => {});
      }
    }
  },

  async removeItem(key: string): Promise<void> {
    const prefix = storagePrefix(key);
    const manifest = await readManifest(prefix);
    // Remove the pointer first: subsequent reads cannot return a signed-in session.
    await SecureStore.deleteItemAsync(`${prefix}.manifest`);
    if (!manifest) return;
    const other: Slot = manifest.slot === 'a' ? 'b' : 'a';
    for (let i = 0; i < manifest.chunks; i++) await SecureStore.deleteItemAsync(partKey(prefix, manifest.slot, i));
    for (let i = 0; i < manifest.retired; i++) await SecureStore.deleteItemAsync(partKey(prefix, other, i));
  },
};
