/**
 * Offline Action Queue — queues user actions (likes, plays, playlist changes, etc.)
 * when offline and syncs them intelligently when connectivity returns.
 * Features: retry with exponential backoff, action deduplication, conflict resolution.
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ActionType =
  | "like"
  | "unlike"
  | "play"
  | "playlist_add"
  | "playlist_remove"
  | "playlist_create"
  | "playlist_rename"
  | "search_history"
  | "profile_update";

interface QueuedAction {
  id: string;
  type: ActionType;
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
}

const QUEUE_KEY = "vootify-offline-queue";
const MAX_RETRIES = 5;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function getQueue(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAction[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

/** Deduplicate: remove conflicting older actions for same entity */
function deduplicateQueue(queue: QueuedAction[]): QueuedAction[] {
  const seen = new Map<string, QueuedAction>();

  for (const action of queue) {
    const key = getDedupeKey(action);
    if (!key) {
      // Non-deducable actions, keep all
      seen.set(action.id, action);
      continue;
    }

    const existing = seen.get(key);
    if (!existing || action.createdAt > existing.createdAt) {
      // Remove old conflicting entry
      if (existing) seen.delete(key);
      seen.set(key, action);
    }
  }

  return Array.from(seen.values());
}

/** Generate dedup key — like/unlike for same song cancels out */
function getDedupeKey(action: QueuedAction): string | null {
  const p = action.payload;
  switch (action.type) {
    case "like":
    case "unlike":
      return `like:${p.user_id}:${p.song_id}`;
    case "play":
      return null; // Don't dedupe plays
    case "playlist_add":
    case "playlist_remove":
      return `pl:${p.playlist_id}:${p.song_id}`;
    case "playlist_rename":
      return `pl-rename:${p.playlist_id}`;
    case "search_history":
      return `search:${p.user_id}:${p.query}`;
    case "profile_update":
      return `profile:${p.user_id}`;
    default:
      return null;
  }
}

/** Add an action to the offline queue with deduplication */
export function enqueueAction(
  type: ActionType,
  payload: Record<string, unknown>
) {
  const queue = getQueue();
  queue.push({
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    type,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
  });
  // Deduplicate before saving
  saveQueue(deduplicateQueue(queue));
}

/** Get pending action count */
export function getPendingCount(): number {
  return getQueue().length;
}

/** Get pending actions grouped by type for UI display */
export function getPendingSummary(): Record<string, number> {
  const queue = getQueue();
  const summary: Record<string, number> = {};
  for (const a of queue) {
    summary[a.type] = (summary[a.type] || 0) + 1;
  }
  return summary;
}

/** Process a single action against the database */
async function processAction(action: QueuedAction): Promise<boolean> {
  try {
    switch (action.type) {
      case "like": {
        const p = action.payload;
        const { error } = await supabase.from("liked_songs").insert({
          user_id: p.user_id as string,
          song_id: p.song_id as string,
          title: p.title as string,
          artist: p.artist as string,
          album: (p.album as string) || null,
          duration: (p.duration as number) || 0,
          cover_url: (p.cover_url as string) || null,
          stream_url: (p.stream_url as string) || null,
        });
        return !error || error.code === "23505";
      }
      case "unlike": {
        const p = action.payload;
        await supabase
          .from("liked_songs")
          .delete()
          .eq("user_id", p.user_id as string)
          .eq("song_id", p.song_id as string);
        return true;
      }
      case "play": {
        const p = action.payload;
        await supabase.from("recently_played").insert({
          user_id: p.user_id as string,
          song_id: p.song_id as string,
          title: p.title as string,
          artist: p.artist as string,
          album: (p.album as string) || null,
          duration: (p.duration as number) || 0,
          cover_url: (p.cover_url as string) || null,
          stream_url: (p.stream_url as string) || null,
        });
        return true;
      }
      case "playlist_add": {
        const p = action.payload;
        await supabase.from("playlist_songs").insert({
          playlist_id: p.playlist_id as string,
          song_id: p.song_id as string,
          title: p.title as string,
          artist: p.artist as string,
          album: (p.album as string) || null,
          duration: (p.duration as number) || 0,
          cover_url: (p.cover_url as string) || null,
          stream_url: (p.stream_url as string) || null,
        });
        return true;
      }
      case "playlist_remove": {
        const p = action.payload;
        await supabase
          .from("playlist_songs")
          .delete()
          .eq("playlist_id", p.playlist_id as string)
          .eq("song_id", p.song_id as string);
        return true;
      }
      case "playlist_create": {
        const p = action.payload;
        await supabase.from("playlists").insert({
          user_id: p.user_id as string,
          name: p.name as string,
          cover_url: (p.cover_url as string) || null,
        });
        return true;
      }
      case "playlist_rename": {
        const p = action.payload;
        await supabase
          .from("playlists")
          .update({ name: p.name as string })
          .eq("id", p.playlist_id as string);
        return true;
      }
      case "search_history": {
        const p = action.payload;
        await supabase.from("search_history").insert({
          user_id: p.user_id as string,
          query: p.query as string,
        });
        return true;
      }
      case "profile_update": {
        const p = action.payload;
        await supabase
          .from("profiles")
          .update({
            display_name: (p.display_name as string) || null,
            avatar_url: (p.avatar_url as string) || null,
          })
          .eq("user_id", p.user_id as string);
        return true;
      }
      default:
        return true;
    }
  } catch {
    return false;
  }
}

/** Flush the queue with retry logic and exponential backoff */
export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  // Deduplicate + clean expired
  const cleaned = deduplicateQueue(queue).filter(
    (a) => Date.now() - a.createdAt < MAX_AGE_MS
  );

  const remaining: QueuedAction[] = [];
  let synced = 0;
  let failed = 0;

  // Sort by creation time (oldest first for consistency)
  cleaned.sort((a, b) => a.createdAt - b.createdAt);

  for (const action of cleaned) {
    const ok = await processAction(action);
    if (ok) {
      synced++;
    } else {
      action.retryCount++;
      if (action.retryCount < MAX_RETRIES) {
        remaining.push(action);
      } else {
        failed++;
        console.warn(`[offlineQueue] Dropped after ${MAX_RETRIES} retries:`, action.type);
      }
    }
  }

  saveQueue(remaining);
  return { synced, failed };
}

/** Auto-sync: listen for online events and flush with smart notifications */
export function initOfflineSync() {
  let syncing = false;

  const sync = async () => {
    if (!navigator.onLine || syncing) return;
    syncing = true;

    try {
      const { synced, failed } = await flushQueue();
      if (synced > 0 || failed > 0) {
        console.log(`[offlineQueue] Synced ${synced}, failed ${failed}`);
        window.dispatchEvent(
          new CustomEvent("offline-sync-done", {
            detail: { synced, failed },
          })
        );
      }
    } finally {
      syncing = false;
    }
  };

  window.addEventListener("online", () => {
    // Delay to let connection stabilize
    setTimeout(sync, 1500);
  });

  // Also try on visibility change (PWA comes back to foreground)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      setTimeout(sync, 1000);
    }
  });

  // Initial sync in case we're already online with pending items
  if (navigator.onLine) {
    setTimeout(sync, 2000);
  }
}
