/**
 * Smart Preloader — preloads next track in queue and auto-caches
 * most played tracks in background for instant playback.
 */

import { offlineCache } from "@/lib/offlineCache";
import { supabase } from "@/integrations/supabase/client";
import { Song } from "@/data/mockData";

const MAX_CACHE_SIZE_MB = 500; // Max cache size in MB
const MAX_CACHE_SIZE = MAX_CACHE_SIZE_MB * 1024 * 1024;
const TOP_TRACKS_TO_CACHE = 10;

let _preloadingTrackId: string | null = null;

/**
 * Preload the next track in the queue into IndexedDB cache
 * for instant gapless transition.
 */
export async function preloadNextTrack(nextSong: Song | null): Promise<void> {
  if (!nextSong || !nextSong.streamUrl) return;
  if (nextSong.duration === 0) return; // Skip radio streams

  // Skip if already preloading this track or already cached
  if (_preloadingTrackId === nextSong.id) return;
  _preloadingTrackId = nextSong.id;

  try {
    const cached = await offlineCache.isCached(nextSong.id);
    if (cached) {
      _preloadingTrackId = null;
      return;
    }

    // Use link prefetch hint for the browser to load in background
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = nextSong.streamUrl;
    link.as = "fetch";
    document.head.appendChild(link);

    // Clean up after 30 seconds
    setTimeout(() => {
      try { document.head.removeChild(link); } catch {}
    }, 30000);
  } catch {
    // Silent fail — preloading is best-effort
  } finally {
    _preloadingTrackId = null;
  }
}

/**
 * Auto-cache the most played tracks in background.
 * Call after login, during idle time.
 */
export async function autoCacheTopTracks(userId: string): Promise<void> {
  try {
    // Check cache size first — skip if already too large
    const currentSize = await offlineCache.getCacheSize();
    if (currentSize >= MAX_CACHE_SIZE) {
      await evictOldestCached(currentSize - MAX_CACHE_SIZE + 50 * 1024 * 1024); // Free 50MB
    }

    // Get most played tracks (by frequency in recently_played)
    const { data: recentRaw } = await supabase
      .from("recently_played")
      .select("song_id, title, artist, album, cover_url, stream_url, duration")
      .eq("user_id", userId)
      .order("played_at", { ascending: false })
      .limit(100);

    if (!recentRaw || recentRaw.length === 0) return;

    // Count play frequency
    const freq = new Map<string, { count: number; song: Song }>();
    for (const r of recentRaw) {
      const existing = freq.get(r.song_id);
      if (existing) {
        existing.count++;
      } else {
        freq.set(r.song_id, {
          count: 1,
          song: {
            id: r.song_id,
            title: r.title,
            artist: r.artist,
            album: r.album || "",
            coverUrl: r.cover_url || "",
            streamUrl: r.stream_url || "",
            duration: r.duration || 0,
            liked: false,
          },
        });
      }
    }

    // Sort by frequency, take top N
    const topTracks = Array.from(freq.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_TRACKS_TO_CACHE);

    // Cache each track that isn't already cached
    for (const { song } of topTracks) {
      if (!song.streamUrl || song.duration === 0) continue;

      const alreadyCached = await offlineCache.isCached(song.id);
      if (alreadyCached) continue;

      // Check size before each download
      const size = await offlineCache.getCacheSize();
      if (size >= MAX_CACHE_SIZE) break;

      try {
        await offlineCache.cacheSong(song);
        console.log(`[smartPreload] Auto-cached: ${song.title}`);
      } catch (e) {
        console.warn(`[smartPreload] Failed to cache: ${song.title}`, e);
      }

      // Small delay between downloads to not overwhelm the network
      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch (e) {
    console.warn("[smartPreload] Auto-cache failed:", e);
  }
}

/**
 * Evict oldest cached tracks to free up space.
 * Removes tracks by cachedAt timestamp (oldest first).
 */
export async function evictOldestCached(bytesToFree: number): Promise<void> {
  try {
    const allCached = await offlineCache.getAllCached();
    if (allCached.length === 0) return;

    // Sort by cachedAt ascending (oldest first)
    allCached.sort((a, b) => (a.cachedAt || 0) - (b.cachedAt || 0));

    let freed = 0;
    for (const song of allCached) {
      if (freed >= bytesToFree) break;
      // Rough estimate: 4MB per song
      freed += 4 * 1024 * 1024;
      await offlineCache.removeCached(song.id);
      console.log(`[smartPreload] Evicted: ${song.title}`);
    }
  } catch (e) {
    console.warn("[smartPreload] Eviction failed:", e);
  }
}
