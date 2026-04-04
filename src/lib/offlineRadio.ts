/**
 * Offline Radio Engine — smart offline mode for seamless music playback.
 *
 * Features:
 * 1. Auto-cache songs after playback (background, no UI)
 * 2. Offline radio mode: auto-play cached songs when network drops
 * 3. 200 MB storage cap with LRU eviction
 * 4. Smooth reconnection: fade back to live without audio cut
 * 5. Aggressive pre-buffering of current stream (handled by Audio element)
 */

import { offlineCache } from "@/lib/offlineCache";
import type { Song } from "@/data/mockData";

// ─── Config ──────────────────────────────────────────────────
const MAX_AUTO_CACHE_MB = 200;
const MAX_AUTO_CACHE_BYTES = MAX_AUTO_CACHE_MB * 1024 * 1024;
const AUTO_CACHE_CONCURRENCY = 2;

// ─── State ───────────────────────────────────────────────────
let _isOffline = !navigator.onLine;
let _offlineRadioActive = false;
let _autoCacheQueue: Song[] = [];
let _autoCacheRunning = false;
let _listeners: Array<(offline: boolean) => void> = [];
let _offlineRadioListeners: Array<(active: boolean) => void> = [];

// ─── Network Detection ──────────────────────────────────────

function updateOnlineStatus() {
  const wasOffline = _isOffline;
  _isOffline = !navigator.onLine;

  if (wasOffline !== _isOffline) {
    _listeners.forEach((fn) => fn(_isOffline));

    if (!_isOffline && _offlineRadioActive) {
      // Network came back — signal reconnection
      _offlineRadioActive = false;
      _offlineRadioListeners.forEach((fn) => fn(false));
      console.log("[offlineRadio] Network restored — exiting offline radio mode");
    }
  }
}

// Init listeners once
if (typeof window !== "undefined") {
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);

  // Also use Network Information API for faster detection
  const nav = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (conn) {
    conn.addEventListener("change", () => {
      // Small delay to let navigator.onLine update
      setTimeout(updateOnlineStatus, 100);
    });
  }
}

export function isOffline(): boolean {
  return _isOffline;
}

export function isOfflineRadioActive(): boolean {
  return _offlineRadioActive;
}

/** Subscribe to network status changes */
export function onNetworkChange(fn: (offline: boolean) => void): () => void {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter((l) => l !== fn);
  };
}

/** Subscribe to offline radio mode changes */
export function onOfflineRadioChange(fn: (active: boolean) => void): () => void {
  _offlineRadioListeners.push(fn);
  return () => {
    _offlineRadioListeners = _offlineRadioListeners.filter((l) => l !== fn);
  };
}

// ─── Auto-Cache After Playback ──────────────────────────────

/**
 * Queue a song for background caching after it finishes playing.
 * Respects the 200 MB limit — evicts oldest if needed.
 */
export function queueAutoCache(song: Song) {
  if (!song.streamUrl || song.album === "Radio en direct") return;
  // Deduplicate
  if (_autoCacheQueue.some((s) => s.id === song.id)) return;
  _autoCacheQueue.push(song);
  _runAutoCacheLoop();
}

async function _runAutoCacheLoop() {
  if (_autoCacheRunning) return;
  _autoCacheRunning = true;

  try {
    while (_autoCacheQueue.length > 0 && navigator.onLine) {
      const song = _autoCacheQueue.shift()!;

      // Already cached?
      if (await offlineCache.isCached(song.id)) continue;

      // Check storage — evict if needed
      await _enforceStorageLimit();

      // Check again after eviction
      const size = await offlineCache.getCacheSize();
      if (size >= MAX_AUTO_CACHE_BYTES) {
        console.log("[offlineRadio] Storage limit reached, skipping auto-cache");
        break;
      }

      try {
        await offlineCache.cacheSong(song);
        console.log(`[offlineRadio] Auto-cached: ${song.title}`);
      } catch (e) {
        console.warn(`[offlineRadio] Auto-cache failed: ${song.title}`, e);
      }

      // Yield to main thread
      await new Promise((r) => setTimeout(r, 100));
    }
  } finally {
    _autoCacheRunning = false;
  }
}

// ─── Storage Eviction (LRU by cachedAt) ─────────────────────

async function _enforceStorageLimit() {
  const size = await offlineCache.getCacheSize();
  if (size < MAX_AUTO_CACHE_BYTES * 0.9) return; // 90% threshold

  const allCached = await offlineCache.getAllCached();
  if (allCached.length === 0) return;

  // Sort by cachedAt ascending (oldest first)
  allCached.sort((a, b) => (a.cachedAt || 0) - (b.cachedAt || 0));

  let currentSize = size;
  const target = MAX_AUTO_CACHE_BYTES * 0.7; // Free down to 70%

  for (const song of allCached) {
    if (currentSize <= target) break;
    try {
      await offlineCache.removeCached(song.id);
      // Estimate ~3-5 MB per song
      currentSize -= 4 * 1024 * 1024;
      console.log(`[offlineRadio] Evicted oldest: ${song.title}`);
    } catch {}
  }
}

// ─── Offline Radio Mode ─────────────────────────────────────

/**
 * Get a shuffled playlist of all cached songs for offline radio mode.
 * Returns songs sorted by most recently cached (newest first),
 * then shuffled for variety.
 */
export async function getOfflineRadioQueue(): Promise<Song[]> {
  const cached = await offlineCache.getAllCached();
  if (cached.length === 0) return [];

  // Resolve cached URLs for all songs
  const resolved = await Promise.all(
    cached.map(async (song) => {
      const url = await offlineCache.getCachedUrl(song.id);
      if (!url) return null;
      return { ...song, streamUrl: url };
    })
  );

  const valid = resolved.filter(Boolean) as Song[];

  // Fisher-Yates shuffle
  for (let i = valid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [valid[i], valid[j]] = [valid[j], valid[i]];
  }

  return valid;
}

/**
 * Activate offline radio mode.
 * Called when network drops and there are cached songs available.
 */
export function activateOfflineRadio() {
  if (_offlineRadioActive) return;
  _offlineRadioActive = true;
  _offlineRadioListeners.forEach((fn) => fn(true));
  console.log("[offlineRadio] Offline radio mode activated");
}

/**
 * Check if we should enter offline radio mode and return the queue.
 * Returns null if we shouldn't (e.g., no cached songs, or already playing cached content).
 */
export async function shouldActivateOfflineRadio(
  currentSong: Song | null
): Promise<Song[] | null> {
  if (!_isOffline) return null;
  if (_offlineRadioActive) return null;

  // If current song is already from cache (blob URL), don't interrupt
  if (currentSong?.streamUrl?.startsWith("blob:")) return null;

  const queue = await getOfflineRadioQueue();
  if (queue.length === 0) return null;

  return queue;
}

/**
 * Try to resolve a song's audio URL for offline playback.
 * Returns cached blob URL if available, otherwise original URL.
 */
export async function resolveOfflineUrl(song: Song): Promise<string> {
  try {
    const cached = await offlineCache.getCachedUrl(song.id);
    if (cached) return cached;
  } catch {}
  return song.streamUrl || "";
}

// ─── Pre-buffer Enhancement ─────────────────────────────────

/**
 * Pre-buffer upcoming songs more aggressively.
 * Called during playback to ensure seamless transitions.
 */
export async function prebufferNext(queue: Song[], currentIdx: number): Promise<void> {
  const count = Math.min(3, queue.length - 1);
  for (let i = 1; i <= count; i++) {
    const nextIdx = (currentIdx + i) % queue.length;
    const song = queue[nextIdx];
    if (!song) continue;

    // If not cached, at least resolve URL to warm DNS/connection
    if (!song.streamUrl?.startsWith("blob:")) {
      try {
        const cached = await offlineCache.getCachedUrl(song.id);
        if (cached) {
          // Update the queue reference with cached URL for instant playback
          queue[nextIdx] = { ...song, streamUrl: cached };
        }
      } catch {}
    }
  }
}

// ─── Reconnection Handler ───────────────────────────────────

/**
 * Handle smooth reconnection when network comes back.
 * Returns true if we should transition back to live content.
 */
export function handleReconnection(): boolean {
  if (!_offlineRadioActive) return false;
  
  // The actual transition is handled by the listener system
  // The player should crossfade back to live content
  _offlineRadioActive = false;
  _offlineRadioListeners.forEach((fn) => fn(false));
  return true;
}

// ─── Cleanup ─────────────────────────────────────────────────

export function cleanup() {
  _autoCacheQueue = [];
  _autoCacheRunning = false;
  _offlineRadioActive = false;
}
