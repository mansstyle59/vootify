/**
 * Local cache for successful HD resolutions.
 * Avoids re-resolving the same Deezer track every time.
 * Uses localStorage with a simple key based on song id.
 */

const CACHE_KEY = "hd-resolution-cache";
const MAX_ENTRIES = 500;

export interface CachedResolution {
  streamUrl: string;
  coverUrl?: string;
  resolvedViaCustom?: boolean;
  /** Timestamp when cached */
  ts: number;
}

type CacheStore = Record<string, CachedResolution>;

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

export const hdCache = {
  get(songId: string): CachedResolution | null {
    const store = readCache();
    return store[songId] || null;
  },

  set(songId: string, resolution: CachedResolution) {
    const store = readCache();
    store[songId] = resolution;

    // Evict oldest entries if over limit
    const keys = Object.keys(store);
    if (keys.length > MAX_ENTRIES) {
      const sorted = keys.sort((a, b) => (store[a].ts || 0) - (store[b].ts || 0));
      const toRemove = sorted.slice(0, keys.length - MAX_ENTRIES);
      for (const k of toRemove) delete store[k];
    }

    writeCache(store);
  },

  /** Remove a specific entry (e.g. when user reports bad match) */
  remove(songId: string) {
    const store = readCache();
    delete store[songId];
    writeCache(store);
  },

  /** Clear entire cache */
  clear() {
    localStorage.removeItem(CACHE_KEY);
  },

  /** Get cache stats */
  stats(): { count: number } {
    const store = readCache();
    return { count: Object.keys(store).length };
  },
};
