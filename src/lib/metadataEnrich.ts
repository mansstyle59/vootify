import { supabase } from "@/integrations/supabase/client";
import { deezerApi } from "@/lib/deezerApi";

/**
 * Normalize text: trim, collapse whitespace, capitalize properly.
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, " - "); // normalize dashes
}

/**
 * Capitalize first letter of each significant word.
 * Keeps short words (feat., ft., de, the, a, etc.) lowercase unless first.
 */
export function normalizeTitle(title: string): string {
  const cleaned = normalizeText(title);
  // Don't change case if it contains intentional mixed case (all-caps titles, etc.)
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    // ALL CAPS → Title Case
    return cleaned
      .toLowerCase()
      .replace(/(^|\s)(\S)/g, (_, space, char) => space + char.toUpperCase());
  }
  return cleaned;
}

/**
 * Normalize artist name: trim, collapse whitespace.
 * Keep original casing (artist names are intentional).
 */
export function normalizeArtist(artist: string): string {
  return normalizeText(artist);
}

interface EnrichableFields {
  title: string;
  artist: string;
  album?: string | null;
  coverUrl?: string | null;
  duration?: number;
}

interface EnrichResult {
  album?: string;
  coverUrl?: string;
  duration?: number;
  enriched: boolean;
}

/**
 * Try to enrich missing metadata (album, cover, duration) using Deezer search.
 * Only searches if at least one field is missing.
 */
export async function enrichMetadata(fields: EnrichableFields): Promise<EnrichResult> {
  const needsAlbum = !fields.album;
  const needsCover = !fields.coverUrl;
  const needsDuration = !fields.duration;

  if (!needsAlbum && !needsCover && !needsDuration) {
    return { enriched: false };
  }

  if (!fields.title || !fields.artist) {
    return { enriched: false };
  }

  try {
    const query = `${fields.artist} ${fields.title}`;
    const results = await deezerApi.searchTracks(query, 3);

    if (results.length === 0) return { enriched: false };

    // Find best match (exact title match preferred)
    const titleLower = fields.title.toLowerCase().trim();
    const artistLower = fields.artist.toLowerCase().trim();

    const bestMatch = results.find(
      (r) =>
        r.title.toLowerCase().trim() === titleLower &&
        r.artist.toLowerCase().trim().includes(artistLower.split(/\s*(feat|ft)/i)[0].trim())
    ) || results[0];

    const result: EnrichResult = { enriched: false };

    if (needsAlbum && bestMatch.album) {
      result.album = bestMatch.album;
      result.enriched = true;
    }
    if (needsCover && bestMatch.coverUrl) {
      result.coverUrl = bestMatch.coverUrl;
      result.enriched = true;
    }
    if (needsDuration && bestMatch.duration && bestMatch.duration > 0) {
      result.duration = bestMatch.duration;
      result.enriched = true;
    }

    return result;
  } catch {
    return { enriched: false };
  }
}

/**
 * Auto-enrich a batch of custom songs in the DB.
 * Returns the number of songs updated.
 */
export async function autoEnrichCustomSongs(
  songs: Array<{ dbId: string; title: string; artist: string; album?: string | null; coverUrl?: string | null; duration?: number }>
): Promise<number> {
  const toEnrich = songs.filter(
    (s) => !s.album || !s.coverUrl || !s.duration
  );

  if (toEnrich.length === 0) return 0;

  // Limit to 10 at a time to avoid rate limiting
  const batch = toEnrich.slice(0, 10);
  let updated = 0;

  await Promise.all(
    batch.map(async (song) => {
      const result = await enrichMetadata({
        title: song.title,
        artist: song.artist,
        album: song.album,
        coverUrl: song.coverUrl,
        duration: song.duration,
      });

      if (!result.enriched) return;

      const updateFields: Record<string, unknown> = {};
      if (result.album && !song.album) updateFields.album = result.album;
      if (result.coverUrl && !song.coverUrl) updateFields.cover_url = result.coverUrl;
      if (result.duration && !song.duration) updateFields.duration = result.duration;

      if (Object.keys(updateFields).length > 0) {
        const { error } = await supabase
          .from("custom_songs")
          .update(updateFields)
          .eq("id", song.dbId);

        if (!error) updated++;
      }
    })
  );

  return updated;
}
