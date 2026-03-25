/**
 * Local cache for radio metadata cover art URLs.
 * Key: "artist - title" → coverUrl from Deezer.
 * Avoids repeated edge function calls for the same song.
 */

const CACHE_KEY = "radio-cover-cache";
const MAX_ENTRIES = 300;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  coverUrl: string;
  ts: number;
}

type CacheStore = Record<string, CacheEntry>;

function readCache(): CacheStore {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(store: CacheStore) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {}
}

function makeKey(artist: string, title: string): string {
  return `${artist.toLowerCase().trim()}::${title.toLowerCase().trim()}`;
}

export const radioCoverCache = {
  get(artist: string, title: string): string | null {
    const store = readCache();
    const entry = store[makeKey(artist, title)];
    if (!entry) return null;
    if (Date.now() - entry.ts > TTL_MS) return null;
    return entry.coverUrl;
  },

  set(artist: string, title: string, coverUrl: string) {
    if (!coverUrl || !artist || !title) return;
    const store = readCache();
    store[makeKey(artist, title)] = { coverUrl, ts: Date.now() };

    const keys = Object.keys(store);
    if (keys.length > MAX_ENTRIES) {
      const sorted = keys.sort((a, b) => (store[a].ts || 0) - (store[b].ts || 0));
      const toRemove = sorted.slice(0, keys.length - MAX_ENTRIES);
      for (const k of toRemove) delete store[k];
    }

    writeCache(store);
  },

  clear() {
    localStorage.removeItem(CACHE_KEY);
  },

  stats(): { count: number } {
    return { count: Object.keys(readCache()).length };
  },
};
