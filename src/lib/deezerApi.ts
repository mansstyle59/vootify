import { supabase } from "@/integrations/supabase/client";
import type { Song, Album } from "@/data/mockData";
import { jiosaavnApi } from "@/lib/jiosaavnApi";

interface DeezerTrack {
  id: number;
  title: string;
  duration: number;
  preview: string;
  artist: { id: number; name: string; picture_medium: string };
  album: { id: number; title: string; cover_medium: string; cover_big: string };
}

interface DeezerAlbum {
  id: number;
  title: string;
  cover_medium: string;
  cover_big: string;
  release_date: string;
  artist: { id: number; name: string };
  nb_tracks: number;
}


async function callDeezer(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("deezer-proxy", { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

function mapTrackToSong(track: DeezerTrack): Song {
  return {
    id: `dz-${track.id}`,
    title: track.title,
    artist: track.artist.name,
    album: track.album.title,
    duration: track.duration,
    coverUrl: track.album.cover_medium || track.album.cover_big,
    streamUrl: track.preview || "",
    liked: false,
  };
}

function mapDeezerAlbum(a: DeezerAlbum): Album {
  return {
    id: `dz-album-${a.id}`,
    title: a.title,
    artist: a.artist.name,
    coverUrl: a.cover_medium || a.cover_big,
    year: a.release_date ? parseInt(a.release_date.split("-")[0]) : 2024,
    songs: [],
  };
}


export const deezerApi = {
  async searchTracks(query: string, limit = 25, index = 0): Promise<Song[]> {
    const data = await callDeezer({ action: "search", query, limit, index });
    return (data.data || []).map(mapTrackToSong);
  },

  async getChartTracks(limit = 25): Promise<Song[]> {
    const data = await callDeezer({ action: "chart", limit });
    return (data.data || []).map(mapTrackToSong);
  },

  async getChartAlbums(limit = 25): Promise<Album[]> {
    const data = await callDeezer({ action: "chart_albums", limit });
    return (data.data || []).map(mapDeezerAlbum);
  },

  async searchAlbums(query: string, limit = 12): Promise<Album[]> {
    const data = await callDeezer({ action: "search_albums", query, limit });
    return (data.data || []).map(mapDeezerAlbum);
  },

  async getPlaylistTracks(playlistId: string, limit = 30): Promise<Song[]> {
    const data = await callDeezer({ action: "playlist", id: playlistId });
    const tracks = data.tracks?.data || [];
    return tracks.slice(0, limit).map(mapTrackToSong);
  },

  async getPlaylistInfo(playlistId: string): Promise<{ id: string; title: string; picture: string }> {
    const data = await callDeezer({ action: "playlist", id: playlistId });
    return {
      id: String(data.id),
      title: data.title || "Playlist",
      picture: data.picture_medium || data.picture_big || data.picture || "",
    };
  },

  async searchPlaylists(query: string, limit = 10): Promise<{ id: string; title: string; picture: string; nb_tracks: number; user: string }[]> {
    const data = await callDeezer({ action: "search_playlists", query, limit });
    return (data.data || []).map((p: any) => ({
      id: String(p.id),
      title: p.title,
      picture: p.picture_medium || p.picture_big || p.picture || "",
      nb_tracks: p.nb_tracks || 0,
      user: p.user?.name || "",
    }));
  },


  async getAlbumTracks(albumId: string): Promise<{ album: Album; tracks: Song[] }> {
    const id = albumId.replace("dz-album-", "");
    const data = await callDeezer({ action: "album", id });
    const album = mapDeezerAlbum(data);
    const tracks = (data.tracks?.data || []).map(mapTrackToSong);
    album.songs = tracks.map((t: Song) => t.id);
    return { album, tracks };
  },

  /** Search JioSaavn for a full stream URL matching a Deezer track */
  async resolveFullStream(song: Song): Promise<Song> {
    if (!song.id.startsWith("dz-")) return song;
    try {
      // Use "artist title" for more precise matching
      const query = `${song.artist.split(",")[0].trim()} ${song.title}`;
      const results = await jiosaavnApi.search(query, 8);

      // Find best match by comparing normalized titles
      const norm = (s: string) =>
        s.toLowerCase()
          .replace(/\(.*?\)/g, "")
          .replace(/\[.*?\]/g, "")
          .replace(/\bfeat\.?\s*/gi, "")
          .replace(/\bft\.?\s*/gi, "")
          .replace(/[^a-z0-9\s]/g, "")
          .replace(/\s+/g, " ")
          .trim();

      const targetTitle = norm(song.title);
      const targetArtist = norm(song.artist.split(",")[0]);

      const match = results.find((r) => {
        const t = norm(r.title);
        const a = norm(r.artist.split(",")[0]);
        // Title must be similar and artist must share keywords
        return (t.includes(targetTitle) || targetTitle.includes(t)) &&
               (a.includes(targetArtist) || targetArtist.includes(a));
      });

      if (match?.streamUrl) {
        return { ...song, streamUrl: match.streamUrl };
      }

      // Fallback: first result with stream
      const fallback = results.find((r) => r.streamUrl);
      if (fallback?.streamUrl) {
        return { ...song, streamUrl: fallback.streamUrl };
      }
    } catch (e) {
      console.error("JioSaavn resolve failed, using Deezer preview:", e);
    }
    return song;
  },

  /** Resolve full streams for an array of Deezer tracks */
  async resolveFullStreams(songs: Song[]): Promise<Song[]> {
    return Promise.all(songs.map((s) => deezerApi.resolveFullStream(s)));
  },
};
