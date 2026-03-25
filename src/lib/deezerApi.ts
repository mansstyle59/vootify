import { supabase } from "@/integrations/supabase/client";
import type { Song, Album } from "@/data/mockData";
import { jiosaavnApi } from "@/lib/jiosaavnApi";

/** Normalize a string for fuzzy matching */
const norm = (s: string) =>
  s.toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\bfeat\.?\s*/gi, "")
    .replace(/\bft\.?\s*/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

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

    // Load blacklist for this song
    let blacklistedUrls: string[] = [];
    try {
      const stored = localStorage.getItem("hd-blacklist");
      if (stored) {
        const blacklist: Record<string, string[]> = JSON.parse(stored);
        const key = `${song.title}|||${song.artist}`;
        blacklistedUrls = blacklist[key] || [];
      }
    } catch {}

    try {
      // Use "artist title" for more precise matching
      const query = `${song.artist.split(",")[0].trim()} ${song.title}`;
      const results = await jiosaavnApi.search(query, 8);

      // Filter out blacklisted URLs
      const filtered = results.filter((r) => !r.streamUrl || !blacklistedUrls.includes(r.streamUrl));

      const targetTitle = norm(song.title);
      const targetArtist = norm(song.artist.split(",")[0]);

      const match = filtered.find((r) => {
        const t = norm(r.title);
        const a = norm(r.artist.split(",")[0]);
        return (t.includes(targetTitle) || targetTitle.includes(t)) &&
               (a.includes(targetArtist) || targetArtist.includes(a));
      });

      if (match?.streamUrl) {
        return { ...song, streamUrl: match.streamUrl };
      }

      // Fallback: first non-blacklisted result with stream
      const fallback = filtered.find((r) => r.streamUrl);
      if (fallback?.streamUrl) {
        return { ...song, streamUrl: fallback.streamUrl };
      }
    } catch (e) {
      console.error("JioSaavn resolve failed:", e);
    }

    // Fallback: search admin custom_songs for a matching track
    try {
      const targetTitle = norm(song.title);
      const targetArtist = norm(song.artist.split(",")[0]);
      const { data: customSongs } = await supabase
        .from("custom_songs")
        .select("*")
        .not("stream_url", "is", null);

      if (customSongs && customSongs.length > 0) {
        const customMatch = customSongs.find((c) => {
          const ct = norm(c.title);
          const ca = norm(c.artist.split(",")[0]);
          return (ct.includes(targetTitle) || targetTitle.includes(ct)) &&
                 (ca.includes(targetArtist) || targetArtist.includes(ca));
        });

        if (customMatch?.stream_url) {
          console.log("Resolved via admin custom song:", customMatch.title);
          return {
            ...song,
            streamUrl: customMatch.stream_url,
            coverUrl: customMatch.cover_url || song.coverUrl,
            resolvedViaCustom: true,
          };
        }
      }
    } catch (e) {
      console.error("Custom songs fallback failed:", e);
    }

    // No full stream found
    return { ...song, streamUrl: "" };
  },

  /** Resolve full streams for an array of Deezer tracks */
  async resolveFullStreams(songs: Song[]): Promise<Song[]> {
    return Promise.all(songs.map((s) => deezerApi.resolveFullStream(s)));
  },
};
