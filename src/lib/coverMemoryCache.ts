/**
 * In-memory LRU cover image cache.
 * Avoids repeated network/IndexedDB lookups for the same cover URL.
 * Pre-warms visible covers and queue covers for instant display.
 */

const MAX_ENTRIES = 150;
const PREFETCH_BATCH = 8;

interface CacheEntry {
  url: string;       // resolved URL (blob or network)
  loaded: boolean;   // image fully decoded
  ts: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<void>>();

/** Get a cached entry by key (cover URL or songId) */
export function getCachedCover(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  entry.ts = Date.now();
  return entry.url;
}

/** Store a resolved cover in memory */
export function setCachedCover(key: string, url: string, loaded = false) {
  if (!key || !url) return;
  // Evict oldest if full
  if (cache.size >= MAX_ENTRIES) {
    let oldest: string | null = null;
    let oldestTs = Infinity;
    for (const [k, v] of cache) {
      if (v.ts < oldestTs) { oldest = k; oldestTs = v.ts; }
    }
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { url, loaded, ts: Date.now() });
}

/** Mark a cover as fully loaded/decoded */
export function markCoverLoaded(key: string) {
  const entry = cache.get(key);
  if (entry) entry.loaded = true;
}

/** Check if a cover is already loaded */
export function isCoverLoaded(key: string): boolean {
  return cache.get(key)?.loaded ?? false;
}

/**
 * Prefetch a list of image URLs into the browser cache.
 * Uses <link rel="prefetch"> for non-blocking background loading,
 * with Image() decode as fallback.
 */
export function prefetchCovers(urls: string[]) {
  const unique = urls.filter((u) => u && !cache.has(u) && !inflight.has(u));
  const batch = unique.slice(0, PREFETCH_BATCH);

  for (const url of batch) {
    const promise = new Promise<void>((resolve) => {
      // Use Image API for actual decoding + browser cache
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.decoding = "async";
      img.onload = () => {
        setCachedCover(url, url, true);
        inflight.delete(url);
        resolve();
      };
      img.onerror = () => {
        inflight.delete(url);
        resolve();
      };
      img.src = url;
    });
    inflight.set(url, promise);
  }
}

/**
 * Prefetch covers for a queue of songs.
 * Call when queue changes or on scroll.
 */
export function prefetchQueueCovers(songs: Array<{ coverUrl?: string; id?: string }>) {
  const urls = songs
    .map((s) => s.coverUrl)
    .filter(Boolean) as string[];
  prefetchCovers(urls);
}

/** Clear entire memory cache */
export function clearCoverCache() {
  cache.clear();
  inflight.clear();
}

/** Stats for debugging */
export function coverCacheStats() {
  return {
    entries: cache.size,
    inflight: inflight.size,
    loaded: Array.from(cache.values()).filter((e) => e.loaded).length,
  };
}
