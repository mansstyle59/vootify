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

/** Prefetch Profile page data */
async function prefetchProfile(qc: QueryClient, userId: string) {
  qc.prefetchQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });

  qc.prefetchQuery({
    queryKey: ["subscription", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });
}

/** Prefetch recently visited artists & albums */
async function prefetchRecentArtistsAlbums(qc: QueryClient, userId: string) {
  // Get unique artists from recently played
  const { data: recent } = await supabase
    .from("recently_played")
    .select("artist, album")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(30);

  if (!recent || recent.length === 0) return;

  // Top 5 unique artists
  const seenArtists = new Set<string>();
  const topArtists: string[] = [];
  for (const r of recent) {
    if (r.artist && !seenArtists.has(r.artist)) {
      seenArtists.add(r.artist);
      topArtists.push(r.artist);
      if (topArtists.length >= 5) break;
    }
  }

  // Prefetch artist songs for each top artist
  for (const artist of topArtists) {
    qc.prefetchQuery({
      queryKey: ["artist-songs", artist],
      queryFn: async () => {
        const { data } = await supabase
          .from("custom_songs")
          .select("id,title,artist,album,cover_url,stream_url,duration,genre,year")
          .eq("artist", artist)
          .order("created_at", { ascending: false });
        return data || [];
      },
      staleTime: 1000 * 60 * 10,
    });
  }

  // Prefetch artist images
  if (topArtists.length > 0) {
    qc.prefetchQuery({
      queryKey: ["artist-images", topArtists],
      queryFn: async () => {
        const { data } = await supabase
          .from("artist_images")
          .select("*")
          .in("artist_name", topArtists);
        return data || [];
      },
      staleTime: 1000 * 60 * 30,
    });
  }

  // Top 5 unique albums
  const seenAlbums = new Set<string>();
  const topAlbumNames: string[] = [];
  for (const r of recent) {
    if (r.album && !seenAlbums.has(r.album)) {
      seenAlbums.add(r.album);
      topAlbumNames.push(r.album);
      if (topAlbumNames.length >= 5) break;
    }
  }

  // Prefetch album details
  if (topAlbumNames.length > 0) {
    qc.prefetchQuery({
      queryKey: ["recent-album-details"],
      queryFn: async () => {
        const { data } = await supabase
          .from("custom_albums")
          .select("*")
          .in("title", topAlbumNames);
        return data || [];
      },
      staleTime: 1000 * 60 * 10,
    });
  }
}

/** Main entry — call once after auth, runs in background */
export function startDataPrefetch(qc: QueryClient, userId: string) {
  const last = localStorage.getItem(PREFETCHED_KEY);
  if (last && Date.now() - parseInt(last, 10) < PREFETCH_INTERVAL) return;

  const run = () => {
    localStorage.setItem(PREFETCHED_KEY, String(Date.now()));
    // Phase 1: critical pages
    Promise.allSettled([
      prefetchHome(qc, userId),
      prefetchLibrary(qc, userId),
      prefetchRadio(qc, userId),
      prefetchProfile(qc, userId),
    ]).then(() => {
      // Phase 2: secondary data (artists/albums) after main pages are warm
      prefetchRecentArtistsAlbums(qc, userId).catch(() => {});
    }).catch(() => {});
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(run, { timeout: 5000 });
  } else {
    setTimeout(run, 2000);
  }
}
