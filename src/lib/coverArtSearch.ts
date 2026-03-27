/**
 * Automatic cover art search using MusicBrainz + Cover Art Archive.
 * Both APIs are free and require no API key.
 */

const MB_BASE = "https://musicbrainz.org/ws/2";
const CAA_BASE = "https://coverartarchive.org";
const USER_AGENT = "Vootify/1.0 (music-app)";

/** Delay helper to respect MusicBrainz rate limit (1 req/sec) */
function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface CoverResult {
  coverUrl: string;
  source: "musicbrainz";
}

/**
 * Search for album cover art on MusicBrainz + Cover Art Archive.
 * Tries: artist+album, then artist+title as fallback.
 */
export async function searchCoverArt(params: {
  artist: string;
  album?: string;
  title?: string;
  year?: number;
}): Promise<CoverResult | null> {
  const { artist, album, title, year } = params;
  if (!artist) return null;

  // Try album search first
  if (album) {
    const result = await searchByRelease(artist, album, year);
    if (result) return result;
  }

  // Fallback: search by artist + title (recording → release)
  if (title) {
    const result = await searchByRecording(artist, title);
    if (result) return result;
  }

  return null;
}

async function searchByRelease(
  artist: string,
  album: string,
  year?: number
): Promise<CoverResult | null> {
  try {
    let query = `release:${encodeQuery(album)} AND artist:${encodeQuery(artist)}`;
    if (year) query += ` AND date:${year}`;

    const url = `${MB_BASE}/release/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const releases = data.releases || [];

    for (const release of releases) {
      const coverUrl = await getCoverFromRelease(release.id);
      if (coverUrl) return { coverUrl, source: "musicbrainz" };
      await delay(300);
    }
  } catch {
    // Silently fail
  }
  return null;
}

async function searchByRecording(
  artist: string,
  title: string
): Promise<CoverResult | null> {
  try {
    const query = `recording:${encodeQuery(title)} AND artist:${encodeQuery(artist)}`;
    const url = `${MB_BASE}/recording/?query=${encodeURIComponent(query)}&fmt=json&limit=3`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const recordings = data.recordings || [];

    for (const rec of recordings) {
      const releases = rec.releases || [];
      for (const rel of releases.slice(0, 2)) {
        const coverUrl = await getCoverFromRelease(rel.id);
        if (coverUrl) return { coverUrl, source: "musicbrainz" };
        await delay(300);
      }
    }
  } catch {
    // Silently fail
  }
  return null;
}

async function getCoverFromRelease(releaseId: string): Promise<string | null> {
  try {
    const url = `${CAA_BASE}/release/${releaseId}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const images = data.images || [];

    // Prefer front cover
    const front = images.find((img: any) => img.front === true);
    if (front) {
      return front.thumbnails?.large || front.thumbnails?.small || front.image;
    }
    // Fallback to first image
    if (images.length > 0) {
      return images[0].thumbnails?.large || images[0].thumbnails?.small || images[0].image;
    }
  } catch {
    // Silently fail
  }
  return null;
}

function encodeQuery(text: string): string {
  // Escape special Lucene characters
  return text.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&");
}

/**
 * Batch search covers for multiple songs.
 * Groups by album to avoid redundant searches.
 * Returns a map of index → coverUrl.
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
): Promise<Map<number, string>> {
  const results = new Map<number, string>();
  const needsCover = songs
    .map((s, i) => ({ ...s, index: i }))
    .filter((s) => !s.coverUrl);

  if (needsCover.length === 0) return results;

  // Group by album+artist to avoid duplicate searches
  const albumCache = new Map<string, string | null>();
  let done = 0;

  for (const song of needsCover) {
    const albumKey = song.album
      ? `${song.artist.toLowerCase()}|||${song.album.toLowerCase()}`
      : "";

    // Check album cache first
    if (albumKey && albumCache.has(albumKey)) {
      const cached = albumCache.get(albumKey);
      if (cached) {
        results.set(song.index, cached);
      }
      done++;
      onProgress?.(done, needsCover.length);
      continue;
    }

    // Search
    await delay(1100); // MusicBrainz rate limit
    const result = await searchCoverArt({
      artist: song.artist,
      album: song.album,
      title: song.title,
      year: song.year,
    });

    if (result) {
      results.set(song.index, result.coverUrl);
      if (albumKey) albumCache.set(albumKey, result.coverUrl);
    } else {
      if (albumKey) albumCache.set(albumKey, null);
    }

    done++;
    onProgress?.(done, needsCover.length);
  }

  return results;
}
