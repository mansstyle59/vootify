/**
 * Cache warm-up: preload critical data & covers on app startup
 * so subsequent navigations feel instant.
 */

import { supabase } from "@/integrations/supabase/client";
import { prefetchCovers, setCachedCover } from "@/lib/coverMemoryCache";

const WARMED_KEY = "cache-warmed-at";
const WARMUP_INTERVAL = 1000 * 60 * 30; // re-warm every 30 min

/** Pre-fetch critical Supabase data so the SW caches it */
async function warmApiData(userId: string) {
  const base = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1`;
  const headers: Record<string, string> = {
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
  };

  // Fire critical queries in parallel — the SW will cache responses
  const queries = [
    fetch(`${base}/liked_songs?user_id=eq.${userId}&order=created_at.desc&limit=100`, { headers }),
    fetch(`${base}/playlists?user_id=eq.${userId}&order=created_at.desc`, { headers }),
    fetch(`${base}/recently_played?user_id=eq.${userId}&order=played_at.desc&limit=30`, { headers }),
    fetch(`${base}/profiles?user_id=eq.${userId}&limit=1`, { headers }),
    fetch(`${base}/home_config?limit=1`, { headers }),
    // Pre-cache for offline navigation
    fetch(`${base}/custom_songs?select=id,title,artist,album,cover_url,stream_url,duration,genre,year&order=created_at.desc&limit=500`, { headers }),
    fetch(`${base}/custom_albums?order=created_at.desc&limit=50`, { headers }),
    fetch(`${base}/artist_images?limit=100`, { headers }),
  ];

  await Promise.allSettled(queries);
}

/** Pre-load cover images into memory cache + browser cache */
async function warmCovers(userId: string) {
  try {
    const [{ data: recent }, { data: liked }, { data: catalog }] = await Promise.all([
      supabase.from("recently_played").select("cover_url").eq("user_id", userId).order("played_at", { ascending: false }).limit(20),
      supabase.from("liked_songs").select("cover_url").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("custom_songs").select("cover_url").order("created_at", { ascending: false }).limit(40),
    ]);

    const urls = new Set<string>();
    [...(recent || []), ...(liked || []), ...(catalog || [])].forEach((r) => {
      if (r.cover_url) urls.add(r.cover_url);
    });

    // Prefetch into memory cache + browser cache
    const coverUrls = Array.from(urls).slice(0, 50);
    prefetchCovers(coverUrls);

    // Also store URLs in memory for instant resolution
    coverUrls.forEach((url) => setCachedCover(url, url));
  } catch {}
}

/** Main warm-up entry point — call once after auth is ready */
export function startCacheWarmup(userId: string) {
  // Skip if recently warmed
  const last = localStorage.getItem(WARMED_KEY);
  if (last && Date.now() - parseInt(last, 10) < WARMUP_INTERVAL) return;

  // Run in idle callback to avoid blocking UI
  const run = () => {
    localStorage.setItem(WARMED_KEY, String(Date.now()));
    Promise.allSettled([warmApiData(userId), warmCovers(userId)])
      .then(() => {
        // After API/covers are warmed, auto-cache top played tracks in deep background
        if ("requestIdleCallback" in window) {
          requestIdleCallback(() => autoCacheTopTracks(userId), { timeout: 30000 });
        } else {
          setTimeout(() => autoCacheTopTracks(userId), 15000);
        }
      })
      .catch(() => {});
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(run, { timeout: 8000 });
  } else {
    setTimeout(run, 5000);
  }
}
