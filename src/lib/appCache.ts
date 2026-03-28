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
    { label: "Playlists", weight: 1 },
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
      fetch(`${base}/home_config?id=eq.global&limit=1`, { headers }),
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
}

/** Pre-fetch cover images so the SW caches them */
async function preCacheCovers(userId: string) {
  try {
    const [{ data: recent }, { data: liked }] = await Promise.all([
      supabase.from("recently_played").select("cover_url").eq("user_id", userId).order("played_at", { ascending: false }).limit(20),
      supabase.from("liked_songs").select("cover_url").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);

    const urls = new Set<string>();
    [...(recent || []), ...(liked || [])].forEach((r) => {
      if (r.cover_url) urls.add(r.cover_url);
    });

    await Promise.allSettled(
      Array.from(urls).slice(0, 40).map((url) => fetch(url, { mode: "no-cors" }).catch(() => {}))
    );
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
      fetch(`${base}/home_config?id=eq.global&limit=1`, { headers }),
      fetch(`${base}/user_audio_settings?user_id=eq.${userId}&limit=1`, { headers }),
    ]);

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
