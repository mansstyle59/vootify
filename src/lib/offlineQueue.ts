/**
 * Offline Action Queue — queues user actions (likes, plays, etc.)
 * when offline and syncs them when connectivity returns.
 */

import { supabase } from "@/integrations/supabase/client";

interface QueuedAction {
  id: string;
  type: "like" | "unlike" | "play" | "playlist_add";
  payload: Record<string, unknown>;
  createdAt: number;
}

const QUEUE_KEY = "vootify-offline-queue";

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

/** Add an action to the offline queue */
export function enqueueAction(
  type: QueuedAction["type"],
  payload: Record<string, unknown>
) {
  const queue = getQueue();
  queue.push({
    id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    type,
    payload,
    createdAt: Date.now(),
  });
  saveQueue(queue);
}

/** Get pending action count */
export function getPendingCount(): number {
  return getQueue().length;
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
        // Duplicate is okay (409)
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
      default:
        return true;
    }
  } catch {
    return false;
  }
}

/** Flush the queue — process all pending actions */
export async function flushQueue(): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedAction[] = [];
  let synced = 0;

  for (const action of queue) {
    const ok = await processAction(action);
    if (ok) {
      synced++;
    } else {
      // Keep failed actions for retry (discard if older than 7 days)
      if (Date.now() - action.createdAt < 7 * 24 * 60 * 60 * 1000) {
        remaining.push(action);
      }
    }
  }

  saveQueue(remaining);
  return synced;
}

/** Auto-sync: listen for online events and flush */
export function initOfflineSync() {
  const sync = async () => {
    if (!navigator.onLine) return;
    const count = await flushQueue();
    if (count > 0) {
      console.log(`[offlineQueue] Synced ${count} queued action(s)`);
    }
  };

  window.addEventListener("online", sync);

  // Also try on visibility change (PWA comes back to foreground)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      sync();
    }
  });

  // Initial sync in case we're already online with pending items
  if (navigator.onLine) {
    setTimeout(sync, 2000);
  }
}
