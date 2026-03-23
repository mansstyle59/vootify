import { supabase } from "@/integrations/supabase/client";
import type { Song } from "@/data/mockData";

interface FsoundTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
  streamUrl: string;
  plays: number;
}

function trackToSong(t: FsoundTrack): Song {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    duration: t.duration,
    coverUrl: t.coverUrl,
    streamUrl: t.streamUrl,
    liked: false,
  };
}

export const fsoundApi = {
  async getPopularTracks(limit = 20): Promise<Song[]> {
    const { data, error } = await supabase.functions.invoke("fsound-proxy", {
      body: { action: "popular", limit },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Failed to fetch popular tracks");
    return (data.tracks || []).map(trackToSong);
  },

  async searchTracks(query: string, limit = 15): Promise<Song[]> {
    const { data, error } = await supabase.functions.invoke("fsound-proxy", {
      body: { action: "search", query, limit },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Search failed");
    return (data.tracks || []).map(trackToSong);
  },
};
