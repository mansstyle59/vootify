import { supabase } from "@/integrations/supabase/client";
import type { Song, Album } from "@/data/mockData";
import { jiosaavnApi } from "@/lib/jiosaavnApi";
import { hdCache } from "@/lib/hdCache";
import { resolveLog } from "@/lib/resolveLog";

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


// ── In-memory cache for custom songs (avoids repeated DB queries) ──
let _customSongsCache: { data: any[] | null; ts: number } = { data: null, ts: 0 };
const CUSTOM_CACHE_TTL = 60_000; // 60 seconds

async function getCachedCustomSongs() {
  const now = Date.now();
  if (_customSongsCache.data && now - _customSongsCache.ts < CUSTOM_CACHE_TTL) {
    return _customSongsCache.data;
  }
  const { data } = await supabase
    .from("custom_songs")
    .select("*")
    .not("stream_url", "is", null);
  _customSongsCache = { data: data || [], ts: now };
  return _customSongsCache.data;
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

  /**
   * Unified stream resolution pipeline:
   *   1. HD cache (instant)
   *   2. Custom songs DB (priority — user-uploaded full tracks)
   *   3. JioSaavn search (HD fallback)
   * Works for any song (dz-, custom-, js-, or no prefix).
   * Returns song with resolved streamUrl or streamUrl="" if nothing found.
   */
  async resolveFullStream(song: Song, onStep?: (step: string) => void): Promise<Song> {
    const step = onStep || (() => {});
    // ── 1. HD Cache (instant, synchronous lookup) ──
    const cached = hdCache.get(song.id);
    if (cached) {
      return {
        ...song,
        streamUrl: cached.streamUrl,
        coverUrl: cached.coverUrl || song.coverUrl,
        resolvedViaCustom: cached.resolvedViaCustom,
      };
    }

    const targetTitle = norm(song.title);
    const targetArtist = norm(song.artist.split(",")[0]);
    const targetDuration = song.duration;

    // Load blacklist
    let blacklistedUrls: string[] = [];
    try {
      const stored = localStorage.getItem("hd-blacklist");
      if (stored) {
        const bl: Record<string, string[]> = JSON.parse(stored);
        blacklistedUrls = bl[`${song.title}|||${song.artist}`] || [];
      }
    } catch {}

    /** Score a candidate */
    const scoreCandidate = (r: { title: string; artist: string; duration: number; streamUrl: string }): number => {
      if (!r.streamUrl || blacklistedUrls.includes(r.streamUrl)) return -1;
      const t = norm(r.title);
      const a = norm(r.artist.split(",")[0]);
      let score = 0;
      score += matchScore(t, targetTitle) * 2;
      score += matchScore(a, targetArtist) * 1.5;
      if (r.duration > 0 && targetDuration > 0) {
        const diff = Math.abs(r.duration - targetDuration);
        if (diff <= 5) score += 40;
        else if (diff <= 15) score += 25;
        else if (diff <= 30) score += 10;
        else if (diff > 60) score -= 20;
      }
      return score;
    };

    // ── 2 & 3. Custom songs + JioSaavn — run in PARALLEL for minimal latency ──
    step("Résolution…");

    // Custom songs query — with in-memory cache to avoid repeated DB calls
    const customPromise = (async () => {
      try {
        // Use cached custom songs list (refreshed every 60s)
        const customSongs = await getCachedCustomSongs();
        if (!customSongs || customSongs.length === 0) return null;

        let bestCustom: typeof customSongs[0] | null = null;
        let bestScore = 0;

        for (const c of customSongs) {
          const cTitle = norm(c.title);
          const cArtist = norm(c.artist.split(",")[0]);
          const titleScore = matchScore(cTitle, targetTitle);
          const artistScore = matchScore(cArtist, targetArtist);
          let score = titleScore * 2 + artistScore * 1.5;
          if (c.duration > 0 && targetDuration > 0) {
            const diff = Math.abs(c.duration - targetDuration);
            if (diff <= 5) score += 40;
            else if (diff <= 15) score += 30;
            else if (diff <= 30) score += 15;
          }
          if (cTitle.includes(targetTitle) || targetTitle.includes(cTitle)) {
            score += 30;
          }
          if (score > bestScore) {
            bestScore = score;
            bestCustom = c;
          }
        }

        if (bestCustom?.stream_url && bestScore >= 60) {
          return { custom: bestCustom, score: bestScore };
        }
        return null;
      } catch {
        return null;
      }
    })();

    // JioSaavn HD search — PARALLEL batches instead of sequential
    const saavnPromise = (async () => {
      try {
        const mainArtist = song.artist.split(",")[0].trim();
        const cleanTitle = song.title.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").trim();
        const noFeatTitle = song.title.replace(/\s*(feat\.?|ft\.?|featuring)\s*.*/i, "").trim();
        const queries = [
          `${mainArtist} ${song.title}`,
          `${mainArtist} ${cleanTitle}`,
          song.title,
          `${song.title} ${mainArtist}`,
          cleanTitle,
          noFeatTitle !== cleanTitle ? `${mainArtist} ${noFeatTitle}` : null,
          noFeatTitle !== cleanTitle ? noFeatTitle : null,
        ].filter(Boolean) as string[];

        const seen = new Set<string>();
        const uniqueQueries = queries.filter((q) => {
          const n = norm(q);
          if (seen.has(n) || n.length < 3) return false;
          seen.add(n);
          return true;
        });

        let bestMatch: Song | null = null;
        let bestScore = 0;

        // Run first 3 queries in parallel for speed
        const batch1 = uniqueQueries.slice(0, 3);
        const batch1Results = await Promise.allSettled(
          batch1.map((q) => jiosaavnApi.search(q, 10))
        );

        for (const r of batch1Results) {
          if (r.status !== "fulfilled") continue;
          for (const track of r.value) {
            const s = scoreCandidate(track);
            if (s > bestScore) { bestScore = s; bestMatch = track; }
          }
        }

        // If good enough, skip remaining queries
        if (bestScore >= 150) {
          return bestMatch?.streamUrl && bestScore >= 40
            ? { match: bestMatch, score: bestScore }
            : null;
        }

        // Run remaining queries in parallel
        const batch2 = uniqueQueries.slice(3);
        if (batch2.length > 0) {
          const batch2Results = await Promise.allSettled(
            batch2.map((q) => jiosaavnApi.search(q, 10))
          );
          for (const r of batch2Results) {
            if (r.status !== "fulfilled") continue;
            for (const track of r.value) {
              const s = scoreCandidate(track);
              if (s > bestScore) { bestScore = s; bestMatch = track; }
            }
          }
        }

        if (bestMatch?.streamUrl && bestScore >= 40) {
          return { match: bestMatch, score: bestScore };
        }
        return null;
      } catch {
        return null;
      }
    })();

    // Wait for BOTH in parallel — use whichever wins
    const [customResult, saavnResult] = await Promise.all([customPromise, saavnPromise]);

    // Custom always takes priority when found
    if (customResult) {
      const { custom: bestCustom, score: bestScore } = customResult;
      const resolved = {
        ...song,
        streamUrl: bestCustom.stream_url!,
        coverUrl: bestCustom.cover_url || song.coverUrl,
        resolvedViaCustom: true,
      };
      hdCache.set(song.id, {
        streamUrl: resolved.streamUrl,
        coverUrl: bestCustom.cover_url || undefined,
        resolvedViaCustom: true,
        ts: Date.now(),
      });
      resolveLog.add({
        songId: song.id,
        originalTitle: song.title,
        originalArtist: song.artist,
        resolvedTitle: bestCustom.title,
        resolvedArtist: bestCustom.artist,
        source: "custom",
        streamUrl: bestCustom.stream_url!,
        titleCorrected: norm(bestCustom.title) !== targetTitle,
        artistCorrected: norm(bestCustom.artist.split(",")[0]) !== targetArtist,
        ts: Date.now(),
      });
      return resolved;
    }

    if (saavnResult) {
      const { match: bestMatch, score: bestScore } = saavnResult;
      const titleOk = matchScore(norm(bestMatch.title), targetTitle) >= 50;
      const artistOk = matchScore(norm(bestMatch.artist.split(",")[0]), targetArtist) >= 40;
      hdCache.set(song.id, {
        streamUrl: bestMatch.streamUrl,
        coverUrl: bestMatch.coverUrl || undefined,
        ts: Date.now(),
      });
      resolveLog.add({
        songId: song.id,
        originalTitle: song.title,
        originalArtist: song.artist,
        resolvedTitle: bestMatch.title,
        resolvedArtist: bestMatch.artist,
        source: "hd",
        streamUrl: bestMatch.streamUrl,
        titleCorrected: !titleOk,
        artistCorrected: !artistOk,
        ts: Date.now(),
      });
      return { ...song, streamUrl: bestMatch.streamUrl, coverUrl: bestMatch.coverUrl || song.coverUrl };
    }

    // No full stream found — log it
    resolveLog.add({
      songId: song.id,
      originalTitle: song.title,
      originalArtist: song.artist,
      source: "none",
      streamUrl: "",
      titleCorrected: false,
      artistCorrected: false,
      ts: Date.now(),
    });
    console.warn("[resolve] no source found for:", song.title);
    return { ...song, streamUrl: "" };
  },

  /** Resolve full streams for an array of tracks */
  async resolveFullStreams(songs: Song[]): Promise<Song[]> {
    return Promise.all(songs.map((s) => deezerApi.resolveFullStream(s)));
  },
};
