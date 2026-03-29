/**
 * Auto-download liked/recent songs when on Wi-Fi.
 * Respects a localStorage toggle and runs in the background.
 */
import { offlineCache } from "@/lib/offlineCache";
import { supabase } from "@/integrations/supabase/client";
import type { Song } from "@/data/mockData";

const STORAGE_KEY = "auto-download-wifi";
const CONCURRENCY = 4;

export function isAutoDownloadEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function setAutoDownloadEnabled(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}

/** Returns true if the device is on Wi-Fi (or wired). */
function isOnWifi(): boolean {
  const nav = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (!conn) return navigator.onLine; // fallback: assume yes if online
  return conn.type === "wifi" || conn.type === "ethernet" || conn.effectiveType === "4g";
}

let running = false;

/**
 * Run a background sync: download liked + recent songs that aren't cached yet.
 * Safe to call multiple times — will no-op if already running.
 */
export async function runAutoDownload(userId: string) {
  if (running || !isAutoDownloadEnabled() || !isOnWifi()) return;
  running = true;

  try {
    // Fetch liked songs
    const { data: liked } = await supabase
      .from("liked_songs")
      .select("song_id, title, artist, album, cover_url, stream_url, duration")
      .eq("user_id", userId)
      .not("stream_url", "is", null);

    // Fetch recent songs
    const { data: recent } = await supabase
      .from("recently_played")
      .select("song_id, title, artist, album, cover_url, stream_url, duration")
      .eq("user_id", userId)
      .not("stream_url", "is", null)
      .order("played_at", { ascending: false })
      .limit(50);

    // Merge & deduplicate
    const seen = new Set<string>();
    const songs: Song[] = [];
    for (const row of [...(liked || []), ...(recent || [])]) {
      if (seen.has(row.song_id)) continue;
      seen.add(row.song_id);
      songs.push({
        id: row.song_id,
        title: row.title,
        artist: row.artist,
        album: row.album || "",
        coverUrl: row.cover_url || "",
        streamUrl: row.stream_url || "",
        duration: row.duration || 0,
        liked: false,
      });
    }

    // Filter already cached
    const uncached: Song[] = [];
    for (const s of songs) {
      if (!(await offlineCache.isCached(s.id))) uncached.push(s);
    }

    if (uncached.length === 0) return;

    // Download in parallel
    const queue = [...uncached];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        if (!isOnWifi()) return; // stop if we lose Wi-Fi
        const song = queue.shift()!;
        try {
          await offlineCache.cacheSong(song);
        } catch (e) {
          console.warn("[auto-dl] skip", song.title, e);
        }
      }
    });
    await Promise.all(workers);
    console.log(`[auto-dl] Downloaded ${uncached.length - queue.length} songs`);
  } catch (e) {
    console.warn("[auto-dl] Error", e);
  } finally {
    running = false;
  }
}

/** Start listening for Wi-Fi connection events to trigger auto-download. */
export function initAutoDownload(getUserId: () => string | null) {
  const nav = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

  const check = () => {
    const uid = getUserId();
    if (uid && isAutoDownloadEnabled() && isOnWifi()) {
      // Delay to not compete with app startup
      setTimeout(() => runAutoDownload(uid), 5000);
    }
  };

  if (conn) {
    conn.addEventListener("change", check);
  }
  window.addEventListener("online", check);

  // Also check on visibility change (PWA reopen)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });

  // Initial check
  check();
}
