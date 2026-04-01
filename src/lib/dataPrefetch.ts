/**
 * Data prefetch: pre-warm React Query caches for the most visited pages
 * so navigation feels instant (no loading spinners).
 * Call once after auth is ready.
 */

import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PREFETCHED_KEY = "data-prefetched-at";
const PREFETCH_INTERVAL = 1000 * 60 * 15; // re-prefetch every 15 min

/** Prefetch Home page data */
async function prefetchHome(qc: QueryClient, userId: string) {
  // Home config
  qc.prefetchQuery({
    queryKey: ["home-config"],
    queryFn: async () => {
      const { data } = await supabase.from("home_config").select("*").limit(1).maybeSingle();
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });

  // Quick access playlists
  qc.prefetchQuery({
    queryKey: ["quick-playlists", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("playlists")
        .select("id, name, cover_url, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(4);
      return data || [];
    },
    staleTime: 60_000,
  });
}

/** Prefetch Library page data */
async function prefetchLibrary(qc: QueryClient, userId: string) {
  // All songs count + first page
  qc.prefetchQuery({
    queryKey: ["custom-songs", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("custom_songs")
        .select("id,title,artist,album,cover_url,stream_url,duration,genre,year")
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Playlists
  qc.prefetchQuery({
    queryKey: ["playlists", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("playlists")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Albums
  qc.prefetchQuery({
    queryKey: ["custom-albums", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("custom_albums")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Liked songs
  qc.prefetchQuery({
    queryKey: ["liked-songs", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("liked_songs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Recently played
  qc.prefetchQuery({
    queryKey: ["recently-played", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("recently_played")
        .select("*")
        .eq("user_id", userId)
        .order("played_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

/** Prefetch Radio page data */
async function prefetchRadio(qc: QueryClient, userId: string) {
  qc.prefetchQuery({
    queryKey: ["custom-radios", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("custom_radio_stations")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });
}

/** Main entry — call once after auth, runs in background */
export function startDataPrefetch(qc: QueryClient, userId: string) {
  const last = localStorage.getItem(PREFETCHED_KEY);
  if (last && Date.now() - parseInt(last, 10) < PREFETCH_INTERVAL) return;

  const run = () => {
    localStorage.setItem(PREFETCHED_KEY, String(Date.now()));
    Promise.allSettled([
      prefetchHome(qc, userId),
      prefetchLibrary(qc, userId),
      prefetchRadio(qc, userId),
    ]).catch(() => {});
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(run, { timeout: 5000 });
  } else {
    setTimeout(run, 2000);
  }
}
