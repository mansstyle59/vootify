/**
 * Queue Preloader — pre-buffers upcoming tracks in the queue
 * using hidden Audio elements for instant DJ-like transitions.
 *
 * Strategy:
 * - Maintains a pool of up to 3 pre-buffered Audio elements
 * - Resolves cached URLs (IndexedDB) before network URLs
 * - Cleans up stale buffers when the queue changes
 * - Exposes a fast getter for the next track's ready Audio
 */

import { Song } from "@/data/mockData";
import { offlineCache } from "@/lib/offlineCache";

const MAX_PRELOADED = 3;

interface PreloadedTrack {
  songId: string;
  audio: HTMLAudioElement;
  ready: boolean;
  url: string;
}

const _pool: PreloadedTrack[] = [];
let _currentQueueIds: string[] = [];

/**
 * Get the resolved playback URL for a song
 * (cached blob URL preferred, then stream URL)
 */
async function resolveUrl(song: Song): Promise<string | null> {
  try {
    const cached = await offlineCache.getCachedUrl(song.id);
    if (cached) return cached;
  } catch {}
  return song.streamUrl || null;
}

/**
 * Create a hidden Audio element that buffers a track
 */
function createPreloadAudio(url: string, songId: string): PreloadedTrack {
  const audio = new Audio();
  audio.preload = "auto";
  audio.setAttribute("playsinline", "true");
  audio.crossOrigin = "anonymous";
  audio.volume = 0; // silent — only buffering
  audio.src = url;

  const entry: PreloadedTrack = { songId, audio, ready: false, url };

  // Mark ready when enough data is buffered for playback
  const onCanPlay = () => {
    entry.ready = true;
    audio.removeEventListener("canplaythrough", onCanPlay);
  };
  audio.addEventListener("canplaythrough", onCanPlay);

  // Start buffering (load triggers network fetch)
  audio.load();

  return entry;
}

/**
 * Dispose a preloaded entry — release memory
 */
function disposeEntry(entry: PreloadedTrack) {
  try {
    entry.audio.pause();
    entry.audio.removeAttribute("src");
    entry.audio.load(); // Release buffer
  } catch {}
}

/**
 * Update the preload pool based on current queue state.
 * Call this whenever the current song or queue changes.
 *
 * @param currentSongId - The currently playing song ID
 * @param queue - The full queue
 * @param shuffle - Whether shuffle is on (skip preload if true)
 */
export async function updateQueuePreload(
  currentSongId: string,
  queue: Song[],
  shuffle: boolean
): Promise<void> {
  // In shuffle mode, next track is random — preloading less useful
  // but we still preload 1 random track for snappiness
  const idx = queue.findIndex((s) => s.id === currentSongId);
  if (idx === -1) return;

  // Determine upcoming songs to preload
  const upcoming: Song[] = [];
  const count = shuffle ? 1 : MAX_PRELOADED;

  for (let i = 1; i <= count; i++) {
    const nextIdx = (idx + i) % queue.length;
    if (nextIdx === idx) break; // Queue wrapped — single song
    const song = queue[nextIdx];
    if (song && song.duration !== 0 && song.streamUrl) {
      upcoming.push(song);
    }
  }

  const upcomingIds = upcoming.map((s) => s.id);
  _currentQueueIds = upcomingIds;

  // Remove entries that are no longer upcoming
  for (let i = _pool.length - 1; i >= 0; i--) {
    if (!upcomingIds.includes(_pool[i].songId)) {
      disposeEntry(_pool[i]);
      _pool.splice(i, 1);
    }
  }

  // Add new entries for songs not yet preloading
  for (const song of upcoming) {
    if (_pool.some((e) => e.songId === song.id)) continue;

    const url = await resolveUrl(song);
    if (!url) continue;

    // Check if queue context changed while we were resolving
    if (!_currentQueueIds.includes(song.id)) continue;

    const entry = createPreloadAudio(url, song.id);
    _pool.push(entry);

    console.log(`[queuePreloader] Buffering: ${song.title}`);
  }
}

/**
 * Get the pre-buffered URL for a song (if available).
 * Returns the resolved URL that's already been fetched/buffered.
 */
export function getPreloadedUrl(songId: string): string | null {
  const entry = _pool.find((e) => e.songId === songId);
  return entry?.url || null;
}

/**
 * Check if a specific track is fully buffered and ready
 */
export function isTrackReady(songId: string): boolean {
  const entry = _pool.find((e) => e.songId === songId);
  return entry?.ready || false;
}

/**
 * Consume (remove) a preloaded entry after it starts playing.
 * The main player takes over — we release our buffer.
 */
export function consumePreloaded(songId: string): void {
  const idx = _pool.findIndex((e) => e.songId === songId);
  if (idx !== -1) {
    disposeEntry(_pool[idx]);
    _pool.splice(idx, 1);
  }
}

/**
 * Clear all preloaded tracks (e.g., on logout or queue clear)
 */
export function clearPreloadPool(): void {
  for (const entry of _pool) {
    disposeEntry(entry);
  }
  _pool.length = 0;
  _currentQueueIds = [];
}

/**
 * Get preload pool status for debugging
 */
export function getPreloadStatus(): { songId: string; ready: boolean }[] {
  return _pool.map((e) => ({ songId: e.songId, ready: e.ready }));
}
