import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

// Stories the viewer has already opened. Kept for the session, and in
// localStorage on the web so rings stay muted after a reload. Stories expire
// after 24 hours, so a short bounded list is enough.
const STORAGE_KEY = 'inkr.seen-stories';
const MAX_IDS = 400;

let ids: string[] | null = null;
let snapshot: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function webStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function ensureLoaded(): string[] {
  if (ids) return ids;
  ids = [];
  const storage = webStorage();
  if (storage) {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
      if (Array.isArray(parsed)) ids = parsed.filter((v): v is string => typeof v === 'string').slice(-MAX_IDS);
    } catch {
      ids = [];
    }
  }
  snapshot = new Set(ids);
  return ids;
}

export function markStorySeen(storyId: string): void {
  const list = ensureLoaded();
  if (snapshot.has(storyId)) return;
  list.push(storyId);
  if (list.length > MAX_IDS) list.splice(0, list.length - MAX_IDS);
  snapshot = new Set(list);
  try {
    webStorage()?.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Private mode or a full quota: the session still remembers.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): ReadonlySet<string> {
  ensureLoaded();
  return snapshot;
}

const EMPTY: ReadonlySet<string> = new Set();

/** The ids of the stories already seen on this device. */
export function useSeenStories(): ReadonlySet<string> {
  // Server rendering has no storage: start empty, the client fills in.
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
