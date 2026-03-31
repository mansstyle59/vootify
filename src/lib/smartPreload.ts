/**
 * Smart Preloader — intelligent cache management with:
 * - Usage-score-based eviction (frequency × recency × favorites)
 * - Proactive storage alerts at 85%/95%
 * - Auto-cache most played tracks in background
 * - Preload next track for gapless playback
 */

import { offlineCache } from "@/lib/offlineCache";
import { supabase } from "@/integrations/supabase/client";
import { Song } from "@/data/mockData";
import { toast } from "sonner";

const MAX_CACHE_SIZE_MB = 900; // Near 1GB limit
const MAX_CACHE_SIZE = MAX_CACHE_SIZE_MB * 1024 * 1024;
const TOP_TRACKS_TO_CACHE = 10;
const ALERT_85_KEY = "cache-alert-85";
const ALERT_95_KEY = "cache-alert-95";
const ALERT_COOLDOWN = 24 * 60 * 60 * 1000; // 24h between alerts

let _preloadingTrackId: string | null = null;

/**
 * Calculate a priority score for a cached song.
 * Higher = more important to keep.
 * Formula: playCount × recencyWeight × likedBonus
 */
function calculateScore(
  songId: string,
  playCounts: Map<string, number>,
  lastPlayed: Map<string, number>,
  likedIds: Set<string>
): number {
  const plays = playCounts.get(songId) || 0;
  const lastTs = lastPlayed.get(songId) || 0;

  // Recency: exponential decay over 30 days
  const ageMs = Date.now() - lastTs;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const recency = Math.exp(-ageDays / 30); // 1.0 for just played, ~0.37 at 30 days

  // Liked bonus: 2x priority
  const likedBonus = likedIds.has(songId) ? 2 : 1;

  // Score: plays × recency × liked
  return Math.max(0.01, plays * recency * likedBonus);
}

/**
 * Check storage usage and show proactive alerts
 */
export async function checkStorageAlerts() {
  try {
    const [currentSize, songCount] = await Promise.all([
      offlineCache.getCacheSize(),
      offlineCache.getAllCachedCount(),
    ]);

    const sizePercent = (currentSize / (1024 * 1024 * 1024)) * 100; // % of 1GB
    const countPercent = (songCount / 300) * 100;
    const usage = Math.max(sizePercent, countPercent);

    if (usage >= 95 && !recentlyAlerted(ALERT_95_KEY)) {
      markAlerted(ALERT_95_KEY);
      toast.warning("Stockage hors-ligne presque plein", {
        description: `${songCount}/300 titres · ${formatSize(currentSize)}/1 Go. Les anciens titres seront remplacés automatiquement.`,
        duration: 6000,
      });
    } else if (usage >= 85 && !recentlyAlerted(ALERT_85_KEY)) {
      markAlerted(ALERT_85_KEY);
      toast.info("Stockage hors-ligne à 85%", {
        description: `${songCount}/300 titres · ${formatSize(currentSize)}/1 Go`,
        duration: 4000,
      });
    }
  } catch {}
}

function recentlyAlerted(key: string): boolean {
  const ts = localStorage.getItem(key);
  return !!ts && Date.now() - parseInt(ts, 10) < ALERT_COOLDOWN;
}

function markAlerted(key: string) {
  localStorage.setItem(key, String(Date.now()));
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} Mo`;
}

/**
 * Preload the next track in the queue into browser cache
 */
export async function preloadNextTrack(nextSong: Song | null): Promise<void> {
  if (!nextSong || !nextSong.streamUrl) return;
  if (nextSong.duration === 0) return;

  if (_preloadingTrackId === nextSong.id) return;
  _preloadingTrackId = nextSong.id;

  try {
    const cached = await offlineCache.isCached(nextSong.id);
    if (cached) {
      _preloadingTrackId = null;
      return;
    }

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = nextSong.streamUrl;
    link.as = "fetch";
    document.head.appendChild(link);

    setTimeout(() => {
      try { document.head.removeChild(link); } catch {}
    }, 30000);
  } catch {
  } finally {
    _preloadingTrackId = null;
  }
}

/**
 * Intelligent eviction: remove lowest-score tracks to free space.
 * Considers play frequency, recency, and liked status.
 */
export async function smartEvict(
  bytesToFree: number,
  userId?: string
): Promise<number> {
  try {
    const allCached = await offlineCache.getAllCached();
    if (allCached.length === 0) return 0;

    // Build usage data
    const playCounts = new Map<string, number>();
    const lastPlayed = new Map<string, number>();
    const likedIds = new Set<string>();

    if (userId) {
      // Fetch play history
      const { data: history } = await supabase
        .from("recently_played")
        .select("song_id, played_at")
        .eq("user_id", userId)
        .order("played_at", { ascending: false })
        .limit(500);

      for (const h of history || []) {
        playCounts.set(h.song_id, (playCounts.get(h.song_id) || 0) + 1);
        if (!lastPlayed.has(h.song_id)) {
          lastPlayed.set(h.song_id, new Date(h.played_at).getTime());
        }
      }

      // Fetch liked songs
      const { data: liked } = await supabase
        .from("liked_songs")
        .select("song_id")
        .eq("user_id", userId);

      for (const l of liked || []) {
        likedIds.add(l.song_id);
      }
    }

    // Score all cached songs
    const scored = allCached.map((song) => ({
      ...song,
      score: calculateScore(song.id, playCounts, lastPlayed, likedIds),
    }));

    // Sort by score ascending (lowest first = evict first)
    scored.sort((a, b) => a.score - b.score);

    let freed = 0;
    let evicted = 0;
    for (const song of scored) {
      if (freed >= bytesToFree) break;
      // Rough estimate: 4MB per song
      freed += 4 * 1024 * 1024;
      await offlineCache.removeCached(song.id);
      evicted++;
      console.log(`[smartEvict] Removed: ${song.title} (score: ${song.score.toFixed(2)})`);
    }

    if (evicted > 0) {
      toast.info(`${evicted} titre${evicted > 1 ? "s" : ""} ancien${evicted > 1 ? "s" : ""} supprimé${evicted > 1 ? "s" : ""} du cache`, {
        description: "Les titres les moins écoutés ont été retirés pour libérer de l'espace",
        duration: 4000,
      });
    }

    return evicted;
  } catch (e) {
    console.warn("[smartEvict] Failed:", e);
    return 0;
  }
}

/**
 * Auto-cache the most played tracks in background.
 * Uses smart eviction when space is needed.
 */
export async function autoCacheTopTracks(userId: string): Promise<void> {
  try {
    const currentSize = await offlineCache.getCacheSize();

    // Check storage alerts
    await checkStorageAlerts();

    // If over limit, smart-evict
    if (currentSize >= MAX_CACHE_SIZE) {
      await smartEvict(currentSize - MAX_CACHE_SIZE + 50 * 1024 * 1024, userId);
    }

    const { data: recentRaw } = await supabase
      .from("recently_played")
      .select("song_id, title, artist, album, cover_url, stream_url, duration")
      .eq("user_id", userId)
      .order("played_at", { ascending: false })
      .limit(100);

    if (!recentRaw || recentRaw.length === 0) return;

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

    const topTracks = Array.from(freq.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_TRACKS_TO_CACHE);

    for (const { song } of topTracks) {
      if (!song.streamUrl || song.duration === 0) continue;
      const alreadyCached = await offlineCache.isCached(song.id);
      if (alreadyCached) continue;

      const size = await offlineCache.getCacheSize();
      if (size >= MAX_CACHE_SIZE) {
        // Try smart eviction for one more song
        const evicted = await smartEvict(5 * 1024 * 1024, userId);
        if (evicted === 0) break;
      }

      try {
        await offlineCache.cacheSong(song);
        console.log(`[smartPreload] Auto-cached: ${song.title}`);
      } catch (e) {
        console.warn(`[smartPreload] Failed to cache: ${song.title}`, e);
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch (e) {
    console.warn("[smartPreload] Auto-cache failed:", e);
  }
}

/**
 * @deprecated Use smartEvict instead
 */
export async function evictOldestCached(bytesToFree: number): Promise<void> {
  await smartEvict(bytesToFree);
}
