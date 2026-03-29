/**
 * App Cache Manager — handles first-open data download,
 * version-aware silent updates, and instant subsequent loads.
 *
 * Uses IndexedDB for large data, localStorage for lightweight flags.
 */

import { supabase } from "@/integrations/supabase/client";

const CACHE_VERSION_KEY = "vootify-cache-version";
const CACHE_READY_KEY = "vootify-cache-ready";
const CURRENT_CACHE_VERSION = "2";

/** Check if the app has been fully cached before */
export function isCacheReady(): boolean {
  try {
    return localStorage.getItem(CACHE_READY_KEY) === "true";
  } catch {
    return false;
  }
}

/** Get the cached version */
function getCachedVersion(): string | null {
  try {
    return localStorage.getItem(CACHE_VERSION_KEY);
  } catch {
    return null;
  }
}

/** Mark cache as ready */
function markCacheReady() {
  try {
    localStorage.setItem(CACHE_READY_KEY, "true");
    localStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
  } catch {}
}

/** Check if cache needs a version update */
export function needsCacheUpdate(): boolean {
  return getCachedVersion() !== CURRENT_CACHE_VERSION;
}

export interface CacheProgress {
  step: string;
  current: number;
  total: number;
  percent: number;
}

type ProgressCallback = (p: CacheProgress) => void;

/**
 * Perform the initial data download with progress tracking.
 * Pre-caches critical API data so the SW will serve them instantly.
 */
export async function performInitialCache(
  userId: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const steps = [
    { label: "Profil utilisateur", weight: 1 },
    { label: "Morceaux favoris", weight: 2 },
    { label: "Playlists & morceaux", weight: 2 },
    { label: "Albums & artistes", weight: 2 },
    { label: "Historique récent", weight: 1 },
    { label: "Configuration", weight: 1 },
    { label: "Finalisation", weight: 1 },
  ];
  const totalWeight = steps.reduce((s, st) => s + st.weight, 0);
  let doneWeight = 0;

  const report = (stepIdx: number) => {
    doneWeight += steps[stepIdx].weight;
    onProgress?.({
      step: steps[stepIdx].label,
      current: stepIdx + 1,
      total: steps.length,
      percent: Math.round((doneWeight / totalWeight) * 100),
    });
  };

  const base = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1`;
  const session = (await supabase.auth.getSession()).data.session;
  const headers: Record<string, string> = {
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${session?.access_token || ""}`,
  };

  // Global timeout — never block the user more than 8 seconds
  const timeout = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 8000));

  const cacheWork = async () => {
    // 0 — Profile
    await fetch(`${base}/profiles?user_id=eq.${userId}&limit=1`, { headers });
    report(0);

    // 1 — Liked songs
    await fetch(`${base}/liked_songs?user_id=eq.${userId}&order=created_at.desc&limit=200`, { headers });
    report(1);

    // 2 — Playlists
    await fetch(`${base}/playlists?user_id=eq.${userId}&order=created_at.desc`, { headers });
    report(2);

    // 3 — Recently played
    await fetch(`${base}/recently_played?user_id=eq.${userId}&order=played_at.desc&limit=30`, { headers });
    report(3);

    // 4 — Home config + audio settings
    await Promise.all([
      fetch(`${base}/home_config?limit=1`, { headers }),
      fetch(`${base}/user_audio_settings?user_id=eq.${userId}&limit=1`, { headers }),
    ]);
    report(4);

    // 5 — Finalize
    markCacheReady();
    report(5);
  };

  try {
    const result = await Promise.race([cacheWork(), timeout]);
    if (result === "timeout") {
      console.warn("[appCache] Timeout — releasing user");
      markCacheReady();
      onProgress?.({ step: "Finalisation", current: steps.length, total: steps.length, percent: 100 });
    }
  } catch (e) {
    console.warn("[appCache] Initial cache partially failed:", e);
    markCacheReady();
    onProgress?.({ step: "Finalisation", current: steps.length, total: steps.length, percent: 100 });
  }

  // Pre-cache covers in background (non-blocking)
  preCacheCovers(userId).catch(() => {});
  preCacheFridayCovers().catch(() => {});
}

/** Pre-fetch ALL song covers into IndexedDB for offline display */
async function preCacheCovers(_userId: string) {
  const COVERS_CACHED_KEY = "vootify-covers-cached-v1";
  try {
    // Skip if already done this session
    if (sessionStorage.getItem(COVERS_CACHED_KEY)) return;

    // Fetch all songs with covers
    const { data: songs } = await supabase
      .from("custom_songs")
      .select("id, cover_url")
      .not("cover_url", "is", null);

    if (!songs || songs.length === 0) return;

    // Open IndexedDB directly to batch-store covers
    const DB_NAME = "music-offline-cache";
    const DB_VERSION = 2;
    const COVER_STORE = "covers";

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("audio")) d.createObjectStore("audio");
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta");
        if (!d.objectStoreNames.contains(COVER_STORE)) d.createObjectStore(COVER_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // Check which covers are already cached
    const existingKeys = await new Promise<Set<string>>((resolve) => {
      const tx = db.transaction(COVER_STORE, "readonly");
      const req = tx.objectStore(COVER_STORE).getAllKeys();
      req.onsuccess = () => resolve(new Set((req.result || []).map(String)));
      req.onerror = () => resolve(new Set());
    });

    const missing = songs.filter((s) => s.cover_url && !existingKeys.has(s.id));
    if (missing.length === 0) {
      sessionStorage.setItem(COVERS_CACHED_KEY, "1");
      return;
    }

    // Download in small batches to avoid overwhelming the network
    const BATCH = 6;
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (s) => {
          const res = await fetch(s.cover_url!, { mode: "cors" }).catch(() => null);
          if (!res || !res.ok) return null;
          const blob = await res.blob();
          if (blob.size === 0) return null;
          return { id: s.id, blob };
        })
      );

      // Store successful downloads
      const toStore = results
        .filter((r): r is PromiseFulfilledResult<{ id: string; blob: Blob } | null> => r.status === "fulfilled")
        .map((r) => r.value)
        .filter(Boolean) as { id: string; blob: Blob }[];

      if (toStore.length > 0) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(COVER_STORE, "readwrite");
          const store = tx.objectStore(COVER_STORE);
          toStore.forEach((item) => store.put(item.blob, item.id));
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }

      // Yield to main thread between batches
      if (i + BATCH < missing.length) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    sessionStorage.setItem(COVERS_CACHED_KEY, "1");
  } catch (e) {
    console.warn("[appCache] Cover pre-cache failed:", e);
  }
}

/** Pre-fetch Friday release covers into IndexedDB for offline display */
async function preCacheFridayCovers() {
  const KEY = "vootify-friday-covers-cached-v1";
  try {
    if (sessionStorage.getItem(KEY)) return;

    const { data: releases } = await supabase
      .from("friday_releases" as any)
      .select("album_id, cover_url")
      .order("position", { ascending: true })
      .limit(25) as any;

    if (!releases || releases.length === 0) return;

    const DB_NAME = "music-offline-cache";
    const DB_VERSION = 2;
    const COVER_STORE = "covers";

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("audio")) d.createObjectStore("audio");
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta");
        if (!d.objectStoreNames.contains(COVER_STORE)) d.createObjectStore(COVER_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // Use album_id as key prefix to avoid collisions with song covers
    const existingKeys = await new Promise<Set<string>>((resolve) => {
      const tx = db.transaction(COVER_STORE, "readonly");
      const req = tx.objectStore(COVER_STORE).getAllKeys();
      req.onsuccess = () => resolve(new Set((req.result || []).map(String)));
      req.onerror = () => resolve(new Set());
    });

    const missing = releases.filter(
      (r: any) => r.cover_url && !existingKeys.has(`friday-${r.album_id}`)
    );
    if (missing.length === 0) {
      sessionStorage.setItem(KEY, "1");
      return;
    }

    const BATCH = 6;
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (r: any) => {
          const res = await fetch(r.cover_url, { mode: "cors" }).catch(() => null);
          if (!res || !res.ok) return null;
          const blob = await res.blob();
          if (blob.size === 0) return null;
          return { id: `friday-${r.album_id}`, blob };
        })
      );

      const toStore = results
        .filter((r): r is PromiseFulfilledResult<{ id: string; blob: Blob } | null> => r.status === "fulfilled")
        .map((r) => r.value)
        .filter(Boolean) as { id: string; blob: Blob }[];

      if (toStore.length > 0) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(COVER_STORE, "readwrite");
          const store = tx.objectStore(COVER_STORE);
          toStore.forEach((item) => store.put(item.blob, item.id));
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }

      if (i + BATCH < missing.length) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    sessionStorage.setItem(KEY, "1");
  } catch (e) {
    console.warn("[appCache] Friday covers pre-cache failed:", e);
  }
}

/** Get a cached Friday release cover as an object URL */
export async function getFridayCoverUrl(albumId: number): Promise<string | null> {
  try {
    const DB_NAME = "music-offline-cache";
    const DB_VERSION = 2;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return new Promise((resolve) => {
      const tx = db.transaction("covers", "readonly");
      const req = tx.objectStore("covers").get(`friday-${albumId}`);
      req.onsuccess = () => {
        if (req.result instanceof Blob) {
          resolve(URL.createObjectURL(req.result));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Check if Friday releases data is stale (older than current week's Friday) */
export function isFridayDataStale(): boolean {
  try {
    const lastRefresh = localStorage.getItem("vootify-friday-last-refresh");
    if (!lastRefresh) return true;
    const lastDate = new Date(lastRefresh);
    const now = new Date();
    // Find most recent Friday 6:00 UTC
    const daysSinceFriday = (now.getUTCDay() + 2) % 7; // 0=Fri, 1=Sat, ...
    const lastFriday = new Date(now);
    lastFriday.setUTCDate(now.getUTCDate() - daysSinceFriday);
    lastFriday.setUTCHours(6, 0, 0, 0);
    return lastDate < lastFriday;
  } catch {
    return true;
  }
}

/** Mark Friday data as freshly refreshed */
export function markFridayRefreshed() {
  try {
    localStorage.setItem("vootify-friday-last-refresh", new Date().toISOString());
    // Clear session flag so covers get re-cached
    sessionStorage.removeItem("vootify-friday-covers-cached-v1");
  } catch {}
}

/**
 * Silent background refresh — called on subsequent opens.
 * Re-fetches data so the SW gets fresh copies without blocking UI.
 */
export function silentCacheRefresh(userId: string) {
  const run = async () => {
    const base = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1`;
    const session = (await supabase.auth.getSession()).data.session;
    const headers: Record<string, string> = {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session?.access_token || ""}`,
    };

    await Promise.allSettled([
      fetch(`${base}/liked_songs?user_id=eq.${userId}&order=created_at.desc&limit=200`, { headers }),
      fetch(`${base}/playlists?user_id=eq.${userId}&order=created_at.desc`, { headers }),
      fetch(`${base}/recently_played?user_id=eq.${userId}&order=played_at.desc&limit=30`, { headers }),
      fetch(`${base}/home_config?limit=1`, { headers }),
      fetch(`${base}/user_audio_settings?user_id=eq.${userId}&limit=1`, { headers }),
      fetch(`${base}/friday_releases?order=position.asc&limit=25`, { headers }),
    ]);

    // Refresh Friday covers if stale
    if (isFridayDataStale()) {
      await preCacheFridayCovers();
      markFridayRefreshed();
    }

    // Update version if needed
    if (needsCacheUpdate()) {
      await preCacheCovers(userId);
      markCacheReady();
    }
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => run(), { timeout: 10000 });
  } else {
    setTimeout(run, 4000);
  }
}
