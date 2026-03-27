/**
 * Automatic metadata & cover art search using Deezer API (free, no key required).
 * Falls back to MusicBrainz + Cover Art Archive.
 */

const DEEZER_API = "https://api.deezer.com";
const MB_BASE = "https://musicbrainz.org/ws/2";
const CAA_BASE = "https://coverartarchive.org";
const USER_AGENT = "Vootify/1.0 (music-app)";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface DeezerMeta {
  coverUrl: string;
  album?: string;
  artist?: string;
  title?: string;
  year?: number;
  genre?: string;
  duration?: number;
  source: "deezer" | "musicbrainz";
}

/**
 * Search Deezer for track metadata including cover, album, genre, year.
 */
async function searchDeezer(artist: string, title: string, album?: string): Promise<DeezerMeta | null> {
  try {
    // Build query: prefer artist + title, add album if available
    let query = `artist:"${artist}" track:"${title}"`;
    if (album) query = `artist:"${artist}" album:"${album}" track:"${title}"`;

    const res = await fetch(`${DEEZER_API}/search?q=${encodeURIComponent(query)}&limit=3`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.data || data.data.length === 0) {
      // Retry with simpler query
      const simpleRes = await fetch(`${DEEZER_API}/search?q=${encodeURIComponent(`${artist} ${title}`)}&limit=3`);
      if (!simpleRes.ok) return null;
      const simpleData = await simpleRes.json();
      if (!simpleData.data || simpleData.data.length === 0) return null;
      data.data = simpleData.data;
    }

    const track = data.data[0];
    const coverUrl = track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || "";

    if (!coverUrl) return null;

    // Fetch album details for genre and year
    let genre: string | undefined;
    let year: number | undefined;
    const albumId = track.album?.id;

    if (albumId) {
      try {
        const albumRes = await fetch(`${DEEZER_API}/album/${albumId}`);
        if (albumRes.ok) {
          const albumData = await albumRes.json();
          // Extract release year
          if (albumData.release_date) {
            const y = parseInt(albumData.release_date.split("-")[0], 10);
            if (y > 1900 && y <= new Date().getFullYear() + 1) year = y;
          }
          // Extract genre
          if (albumData.genres?.data?.length > 0) {
            genre = albumData.genres.data[0].name;
          }
        }
      } catch {
        // Album detail fetch failed, continue with what we have
      }
    }

    return {
      coverUrl,
      album: track.album?.title || undefined,
      artist: track.artist?.name || undefined,
      title: track.title || undefined,
      year,
      genre,
      duration: track.duration || undefined,
      source: "deezer",
    };
  } catch {
    return null;
  }
}

/**
 * Search MusicBrainz + Cover Art Archive as fallback.
 */
async function searchMusicBrainz(artist: string, title: string, album?: string, year?: number): Promise<DeezerMeta | null> {
  // Try album search
  if (album) {
    try {
      let query = `release:${encodeLucene(album)} AND artist:${encodeLucene(artist)}`;
      if (year) query += ` AND date:${year}`;
      const url = `${MB_BASE}/release/?query=${encodeURIComponent(query)}&fmt=json&limit=3`;
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
      if (res.ok) {
        const data = await res.json();
        for (const release of data.releases || []) {
          const coverUrl = await getCoverFromCAA(release.id);
          if (coverUrl) return { coverUrl, source: "musicbrainz" };
          await delay(300);
        }
      }
    } catch { /* silent */ }
  }

  // Try recording search
  try {
    const query = `recording:${encodeLucene(title)} AND artist:${encodeLucene(artist)}`;
    const url = `${MB_BASE}/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=3`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if (res.ok) {
      const data = await res.json();
      for (const rec of data.recordings || []) {
        for (const rel of (rec.releases || []).slice(0, 2)) {
          const coverUrl = await getCoverFromCAA(rel.id);
          if (coverUrl) return { coverUrl, source: "musicbrainz" };
          await delay(300);
        }
      }
    }
  } catch { /* silent */ }

  return null;
}

async function getCoverFromCAA(releaseId: string): Promise<string | null> {
  try {
    const res = await fetch(`${CAA_BASE}/release/${releaseId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const images = data.images || [];
    const front = images.find((img: any) => img.front === true);
    if (front) return front.thumbnails?.large || front.thumbnails?.small || front.image;
    if (images.length > 0) return images[0].thumbnails?.large || images[0].thumbnails?.small || images[0].image;
  } catch { /* silent */ }
  return null;
}

function encodeLucene(text: string): string {
  return text.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&");
}

/**
 * Search for cover art and metadata. Tries Deezer first, then MusicBrainz.
 */
export async function searchCoverArt(params: {
  artist: string;
  album?: string;
  title?: string;
  year?: number;
}): Promise<DeezerMeta | null> {
  const { artist, title, album, year } = params;
  if (!artist) return null;

  // Try Deezer first (fast, rich metadata)
  if (title) {
    const deezer = await searchDeezer(artist, title, album);
    if (deezer) return deezer;
  }

  // Fallback to MusicBrainz (cover only)
  if (title || album) {
    const mb = await searchMusicBrainz(artist, title || "", album, year);
    if (mb) return mb;
  }

  return null;
}

/**
 * Batch search covers + metadata for multiple songs.
 * Groups by album to avoid redundant searches.
 * Returns a map of index → DeezerMeta.
 */
export async function batchSearchCovers(
  songs: Array<{
    artist: string;
    album?: string;
    title: string;
    coverUrl?: string;
    year?: number;
  }>,
  onProgress?: (done: number, total: number) => void
): Promise<Map<number, DeezerMeta>> {
  const results = new Map<number, DeezerMeta>();
  const needsSearch = songs
    .map((s, i) => ({ ...s, index: i }))
    .filter((s) => !s.coverUrl);

  if (needsSearch.length === 0) return results;

  const albumCache = new Map<string, DeezerMeta | null>();
  let done = 0;

  for (const song of needsSearch) {
    const albumKey = song.album
      ? `${song.artist.toLowerCase()}|||${song.album.toLowerCase()}`
      : "";

    // Check album cache
    if (albumKey && albumCache.has(albumKey)) {
      const cached = albumCache.get(albumKey);
      if (cached) results.set(song.index, cached);
      done++;
      onProgress?.(done, needsSearch.length);
      continue;
    }

    // Small delay to be respectful
    await delay(300);

    const result = await searchCoverArt({
      artist: song.artist,
      album: song.album,
      title: song.title,
      year: song.year,
    });

    if (result) {
      results.set(song.index, result);
      if (albumKey) albumCache.set(albumKey, result);
    } else {
      if (albumKey) albumCache.set(albumKey, null);
    }

    done++;
    onProgress?.(done, needsSearch.length);
  }

  return results;
}
