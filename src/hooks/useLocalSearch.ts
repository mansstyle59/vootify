import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import type { Song } from "@/data/mockData";

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

/** Fetch all local songs (cached aggressively) */
export function useAllLocalSongs() {
  return useQuery({
    queryKey: ["all-local-songs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_songs")
        .select("*")
        .not("stream_url", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(customRowToSong);
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Fuzzy helpers ───

/** Remove accents, lowercase, strip noise */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\bfeat\.?\s*/gi, "")
    .replace(/\bft\.?\s*/gi, "")
    .replace(/[''`]/g, "'")
    .replace(/[^a-z0-9\s']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Simple Levenshtein distance for short strings */
function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // Optimise: if too different in length, skip
  if (Math.abs(a.length - b.length) > 3) return Math.max(a.length, b.length);

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

/** Check if query fuzzy-matches a target word */
function fuzzyWordMatch(query: string, target: string): boolean {
  if (target.includes(query)) return true;
  if (query.length <= 2) return target.startsWith(query);
  const maxDist = query.length <= 4 ? 1 : 2;
  // Check each word of target
  const words = target.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(query)) return true;
    if (levenshtein(query, word.slice(0, query.length + 2)) <= maxDist) return true;
  }
  return false;
}

export interface LocalSearchResult {
  song: Song;
  score: number;
}

/** Score and rank songs against a query */
export function searchLocalSongs(
  songs: Song[],
  query: string,
  recentlyPlayedIds?: Set<string>
): LocalSearchResult[] {
  if (!query || query.length < 1) return [];
  const q = normalize(query);
  const qWords = q.split(/\s+/).filter(Boolean);
  if (qWords.length === 0) return [];

  const results: LocalSearchResult[] = [];

  for (const song of songs) {
    const t = normalize(song.title);
    const ar = normalize(song.artist);
    const al = normalize(song.album);
    let score = 0;

    // Exact matches (highest priority)
    if (t === q) score += 200;
    else if (t.startsWith(q)) score += 150;
    else if (t.includes(q)) score += 100;

    if (ar === q) score += 180;
    else if (ar.startsWith(q)) score += 140;
    else if (ar.includes(q)) score += 90;

    if (al === q) score += 80;
    else if (al.startsWith(q)) score += 60;
    else if (al.includes(q)) score += 40;

    // Per-word matching (including fuzzy)
    for (const w of qWords) {
      if (t.includes(w)) score += 20;
      else if (fuzzyWordMatch(w, t)) score += 10;

      if (ar.includes(w)) score += 18;
      else if (fuzzyWordMatch(w, ar)) score += 8;

      if (al.includes(w)) score += 12;
      else if (fuzzyWordMatch(w, al)) score += 5;
    }

    // Popularity boost (recently played)
    if (recentlyPlayedIds?.has(song.id)) score += 15;

    if (score > 0) {
      results.push({ song, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/** Get unique artists from songs */
export function extractArtists(songs: Song[]): string[] {
  const map = new Map<string, number>();
  for (const s of songs) {
    s.artist.split(",").forEach((a) => {
      const name = a.trim();
      if (name) map.set(name, (map.get(name) || 0) + 1);
    });
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name]) => name);
}

/** Get suggestion completions from all songs */
export function getSuggestions(
  songs: Song[],
  query: string,
  limit = 6
): { type: "song" | "artist"; label: string; sub?: string; coverUrl?: string; song?: Song }[] {
  if (!query || query.length < 1) return [];
  const q = normalize(query);
  const items: { type: "song" | "artist"; label: string; sub?: string; coverUrl?: string; song?: Song; score: number }[] = [];

  // Artists
  const seenArtists = new Set<string>();
  for (const song of songs) {
    const artists = song.artist.split(",").map((a) => a.trim());
    for (const artist of artists) {
      const na = normalize(artist);
      if (!seenArtists.has(na) && (na.includes(q) || fuzzyWordMatch(q, na))) {
        seenArtists.add(na);
        const score = na.startsWith(q) ? 100 : na.includes(q) ? 80 : 50;
        items.push({ type: "artist", label: artist, coverUrl: song.coverUrl, score });
      }
    }
  }

  // Songs
  for (const song of songs) {
    const t = normalize(song.title);
    if (t.includes(q) || fuzzyWordMatch(q, t)) {
      const score = t.startsWith(q) ? 90 : t.includes(q) ? 70 : 40;
      items.push({ type: "song", label: song.title, sub: song.artist, coverUrl: song.coverUrl, song, score });
    }
  }

  items.sort((a, b) => b.score - a.score);
  return items.slice(0, limit).map(({ score, ...rest }) => rest);
}
