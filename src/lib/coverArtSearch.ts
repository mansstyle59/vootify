import { supabase } from "@/integrations/supabase/client";

/** Call the Deezer API through the server-side proxy. */
async function deezerSearch(path: string): Promise<any | null> {
  try {
    const { data, error } = await supabase.functions.invoke("deezer-proxy", {
      body: { path },
    });
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Search for an artist's image on Deezer.
 * Returns the highest-quality available picture URL.
 */
export async function searchArtistImage(name: string): Promise<string | null> {
  if (!name) return null;
  const data = await deezerSearch(`/search/artist?q=${encodeURIComponent(name)}`);
  const first = data?.data?.[0];
  if (!first) return null;
  return first.picture_xl || first.picture_big || first.picture_medium || null;
}

/**
 * Search for cover art and metadata for a track/album on Deezer.
 */
export async function searchCoverArt(params: {
  artist?: string;
  title?: string;
  album?: string;
}): Promise<{ coverUrl?: string; album?: string; genre?: string; year?: number } | null> {
  const { artist, title, album } = params;
  const query = [
    artist ? `artist:"${artist}"` : "",
    title ? `track:"${title}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!query) return null;

  const data = await deezerSearch(`/search?q=${encodeURIComponent(query)}`);
  const first = data?.data?.[0];
  if (!first) return null;

  const albumObj = first.album;
  const releaseYear = albumObj?.release_date
    ? parseInt(albumObj.release_date.slice(0, 4), 10) || undefined
    : undefined;

  return {
    coverUrl:
      albumObj?.cover_xl || albumObj?.cover_big || albumObj?.cover_medium || undefined,
    album: album || albumObj?.title || undefined,
    genre: first.genre_id ? undefined : undefined, // genre not in basic search results
    year: releaseYear,
  };
}

/**
 * Batch search cover art for multiple items.
 * Returns a Map from item index to metadata found.
 * Items that already have a coverUrl are skipped.
 */
export async function batchSearchCovers(
  items: Array<{ artist?: string; title?: string; album?: string; coverUrl?: string }>,
  onProgress?: (done: number, total: number) => void
): Promise<Map<number, { coverUrl?: string; album?: string; genre?: string; year?: number }>> {
  const results = new Map<number, { coverUrl?: string; album?: string; genre?: string; year?: number }>();
  const DELAY_MS = 300; // polite delay between requests

  const needsFetch = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => !item.coverUrl && (item.artist || item.title));

  for (let i = 0; i < needsFetch.length; i++) {
    const { item, idx } = needsFetch[i];
    try {
      const meta = await searchCoverArt({ artist: item.artist, title: item.title, album: item.album });
      if (meta) {
        results.set(idx, meta);
      }
    } catch {
      // ignore individual failures
    }
    onProgress?.(i + 1, needsFetch.length);
    if (i < needsFetch.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  return results;
}

