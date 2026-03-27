import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import type { Song } from "@/data/mockData";

function rowToSong(row: any): Song {
  return {
    id: row.song_id || `custom-${row.id}`,
    title: row.title,
    artist: row.artist,
    album: row.album || "",
    duration: row.duration || 0,
    coverUrl: row.cover_url || "",
    streamUrl: row.stream_url || "",
    liked: false,
    year: row.year || undefined,
    genre: row.genre || undefined,
  };
}

function customRowToSong(row: any): Song {
  return {
    id: `custom-${row.id}`,
    title: row.title,
    artist: row.artist,
    album: row.album || "",
    duration: row.duration || 0,
    coverUrl: row.cover_url || "",
    streamUrl: row.stream_url || "",
    liked: false,
    year: row.year || undefined,
    genre: row.genre || undefined,
  };
}

function customRowToSong(row: any): Song {
  return {
    id: `custom-${row.id}`,
    title: row.title,
    artist: row.artist,
    album: row.album || "",
    duration: row.duration || 0,
    coverUrl: row.cover_url || "",
    streamUrl: row.stream_url || "",
    liked: false,
  };
}

/** Recently added custom songs (by admin) */
export function useRecentlyAdded(limit = 20) {
  return useQuery({
    queryKey: ["local-recently-added", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_songs")
        .select("*")
        .not("stream_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []).map(customRowToSong);
    },
    staleTime: 2 * 60 * 1000,
  });
}

/** Recently played songs (user-specific) */
export function useRecentlyListened(limit = 20) {
  const userId = usePlayerStore((s) => s.userId);
  return useQuery({
    queryKey: ["local-recently-listened", userId, limit],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("recently_played")
        .select("*")
        .eq("user_id", userId)
        .order("played_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []).map(rowToSong);
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // refresh more often
  });
}

/** Most played songs (count occurrences in recently_played) */
export function useMostPlayed(limit = 20) {
  const userId = usePlayerStore((s) => s.userId);
  return useQuery({
    queryKey: ["local-most-played", userId, limit],
    queryFn: async () => {
      if (!userId) return [];
      // Fetch all recently_played and count by song_id
      const { data, error } = await supabase
        .from("recently_played")
        .select("*")
        .eq("user_id", userId)
        .order("played_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const countMap = new Map<string, { count: number; row: any }>();
      for (const row of data) {
        const key = row.song_id;
        const existing = countMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          countMap.set(key, { count: 1, row });
        }
      }

      return Array.from(countMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .filter((e) => e.count >= 2) // at least 2 plays
        .map((e) => rowToSong(e.row));
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

/** Recommended songs based on liked artists or random from catalog */
export function useRecommended(limit = 20) {
  const userId = usePlayerStore((s) => s.userId);
  const likedSongs = usePlayerStore((s) => s.likedSongs);

  return useQuery({
    queryKey: ["local-recommended", userId, likedSongs.length, limit],
    queryFn: async () => {
      // Get all available custom songs
      const { data: allSongs, error } = await supabase
        .from("custom_songs")
        .select("*")
        .not("stream_url", "is", null);
      if (error) throw error;
      if (!allSongs || allSongs.length === 0) return [];

      const mapped = allSongs.map(customRowToSong);

      // If user has liked songs, prioritize same artists
      if (likedSongs.length > 0) {
        const likedArtists = new Set(
          likedSongs.flatMap((s) => s.artist.toLowerCase().split(",").map((a) => a.trim()))
        );
        const likedIds = new Set(likedSongs.map((s) => s.id));

        // Score: artist match + some randomness
        const day = new Date().getDate();
        const scored = mapped
          .filter((s) => !likedIds.has(s.id)) // exclude already liked
          .map((s) => {
            const artists = s.artist.toLowerCase().split(",").map((a) => a.trim());
            const artistMatch = artists.some((a) => likedArtists.has(a));
            const hash = (s.id.charCodeAt(0) * 31 + day) % 100;
            return { song: s, score: (artistMatch ? 100 : 0) + hash };
          })
          .sort((a, b) => b.score - a.score);

        return scored.slice(0, limit).map((s) => s.song);
      }

      // No liked songs: shuffle catalog
      const day = new Date().getDate();
      const shuffled = [...mapped].sort((a, b) => {
        const ha = (a.id.charCodeAt(0) * 31 + day) % 100;
        const hb = (b.id.charCodeAt(0) * 31 + day) % 100;
        return ha - hb;
      });

      return shuffled.slice(0, limit);
    },
    staleTime: 5 * 60 * 1000,
  });
}
