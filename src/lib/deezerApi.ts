import { supabase } from "@/integrations/supabase/client";
import type { Song, Album } from "@/data/mockData";
import { jiosaavnApi } from "@/lib/jiosaavnApi";
import { hdCache } from "@/lib/hdCache";

/** Normalize a string for fuzzy matching — aggressive cleaning */
const norm = (s: string) =>
  s.toLowerCase()
    .replace(/\(.*?\)/g, "")         // remove (remix), (feat. X), etc.
    .replace(/\[.*?\]/g, "")         // remove [deluxe], [explicit]
    .replace(/\bfeat\.?\s*/gi, "")
    .replace(/\bft\.?\s*/gi, "")
    .replace(/\bwith\s+/gi, "")
    .replace(/\bprod\.?\s*/gi, "")
    .replace(/[''\u2019`\u0060]/g, "") // normalize apostrophes → remove
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[ç]/g, "c")
    .replace(/[ñ]/g, "n")
    .replace(/[œ]/g, "oe")
    .replace(/[æ]/g, "ae")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Score how well two strings match (0 = no match, higher = better) */
function matchScore(a: string, b: string): number {
  if (a === b) return 100;
  if (a.startsWith(b) || b.startsWith(a)) return 80;
  if (a.includes(b) || b.includes(a)) return 60;
  // Word overlap
  const wa = new Set(a.split(" "));
  const wb = new Set(b.split(" "));
  const overlap = [...wa].filter((w) => wb.has(w)).length;
  const total = Math.max(wa.size, wb.size);
  if (total === 0) return 0;
  return Math.round((overlap / total) * 50);
}

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

    const targetTitle = norm(song.title);
    const targetArtist = norm(song.artist.split(",")[0]);
    const targetDuration = song.duration; // seconds

    /** Score a candidate result against the target song */
    const scoreCandidate = (r: Song): number => {
      if (!r.streamUrl || blacklistedUrls.includes(r.streamUrl)) return -1;
      const t = norm(r.title);
      const a = norm(r.artist.split(",")[0]);
      let score = 0;

      // Title match (most important)
      score += matchScore(t, targetTitle) * 2;

      // Artist match
      score += matchScore(a, targetArtist) * 1.5;

      // Duration proximity bonus (within 10s = great, within 30s = ok)
      if (r.duration > 0 && targetDuration > 0) {
        const diff = Math.abs(r.duration - targetDuration);
        if (diff <= 5) score += 40;
        else if (diff <= 15) score += 25;
        else if (diff <= 30) score += 10;
        else if (diff > 60) score -= 20; // penalty for very different durations
      }

      return score;
    };

    // PRIORITY 1: Check admin custom_songs first
    try {
      const { data: customSongs } = await supabase
        .from("custom_songs")
        .select("*")
        .not("stream_url", "is", null);

      if (customSongs && customSongs.length > 0) {
        let bestCustom: typeof customSongs[0] | null = null;
        let bestScore = 0;

        for (const c of customSongs) {
          const ct = norm(c.title);
          const ca = norm(c.artist.split(",")[0]);
          let score = 0;
          score += matchScore(ct, targetTitle) * 2;
          score += matchScore(ca, targetArtist) * 1.5;
          if (c.duration > 0 && targetDuration > 0) {
            const diff = Math.abs(c.duration - targetDuration);
            if (diff <= 15) score += 30;
            else if (diff <= 30) score += 15;
          }
          if (score > bestScore) {
            bestScore = score;
            bestCustom = c;
          }
        }

        if (bestCustom?.stream_url && bestScore >= 80) {
          console.log("Resolved via admin custom song (priority):", bestCustom.title, `(score: ${bestScore})`);
          return {
            ...song,
            streamUrl: bestCustom.stream_url,
            coverUrl: bestCustom.cover_url || song.coverUrl,
            resolvedViaCustom: true,
          };
        }
      }
    } catch (e) {
      console.error("Custom songs check failed:", e);
    }

    // PRIORITY 2: Search JioSaavn for full stream
    try {
      const mainArtist = song.artist.split(",")[0].trim();
      const queries = [
        `${mainArtist} ${song.title}`,
        song.title,
        `${song.title} ${mainArtist}`,
      ];

      const seen = new Set<string>();
      const uniqueQueries = queries.filter((q) => {
        const n = norm(q);
        if (seen.has(n)) return false;
        seen.add(n);
        return true;
      });

      let bestMatch: Song | null = null;
      let bestScore = 0;

      for (const q of uniqueQueries) {
        try {
          const results = await jiosaavnApi.search(q, 10);
          for (const r of results) {
            const s = scoreCandidate(r);
            if (s > bestScore) {
              bestScore = s;
              bestMatch = r;
            }
          }
          if (bestScore >= 200) break;
        } catch {
          // continue with next query
        }
      }

      if (bestMatch?.streamUrl && bestScore >= 80) {
        return { ...song, streamUrl: bestMatch.streamUrl };
      }
    } catch (e) {
      console.error("JioSaavn resolve failed:", e);
    }

    // No full stream found
    return { ...song, streamUrl: "" };
  },

  /** Resolve full streams for an array of Deezer tracks */
  async resolveFullStreams(songs: Song[]): Promise<Song[]> {
    return Promise.all(songs.map((s) => deezerApi.resolveFullStream(s)));
  },
};
