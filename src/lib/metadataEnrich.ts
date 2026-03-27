/**
 * Local-only metadata normalization and enrichment utilities.
 * No external API calls — operates purely on text analysis.
 */

// Words that should stay lowercase in titles (unless first word)
const MINOR_WORDS = new Set([
  "a", "an", "the", "and", "but", "or", "nor", "for", "yet", "so",
  "in", "on", "at", "to", "by", "of", "up", "as", "is", "it",
  "de", "du", "des", "le", "la", "les", "un", "une", "et", "ou",
  "en", "au", "aux", "par", "pour", "sur", "avec", "dans",
]);

/**
 * Normalize text: trim, collapse whitespace, normalize dashes.
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*[-–—]\s*/g, " - ");
}

/**
 * Smart Title Case: capitalize words properly, respecting minor words
 * and preserving intentional formatting (acronyms, etc.).
 */
export function normalizeTitle(title: string): string {
  const cleaned = normalizeText(title);

  // Only convert if ALL CAPS or all lowercase
  const isAllCaps = cleaned === cleaned.toUpperCase() && cleaned.length > 3;
  const isAllLower = cleaned === cleaned.toLowerCase() && cleaned.length > 3;

  if (!isAllCaps && !isAllLower) return cleaned;

  return cleaned
    .toLowerCase()
    .split(/(\s+|-)/g)
    .map((word, i) => {
      if (/^\s+$/.test(word) || word === "-") return word;
      // Always capitalize first word
      if (i === 0) return word.charAt(0).toUpperCase() + word.slice(1);
      // Keep minor words lowercase
      if (MINOR_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join("");
}

/**
 * Normalize artist name: trim, collapse whitespace, fix common patterns.
 */
export function normalizeArtist(artist: string): string {
  let normalized = normalizeText(artist);
  // Normalize "feat." variants
  normalized = normalized.replace(/\s*(ft\.?|feat\.?|featuring)\s*/gi, " feat. ");
  // Normalize separator patterns
  normalized = normalized.replace(/\s*[&+]\s*/g, " & ");
  return normalized;
}

/**
 * Clean up album name: remove common noise like "(Deluxe)", "[Bonus Track]", etc.
 */
export function normalizeAlbum(album: string): string {
  let cleaned = normalizeText(album);
  // Remove common edition suffixes for cleaner grouping
  // But keep them in display — only strip for matching
  return cleaned;
}

/**
 * Strip common noise from a raw title to get a clean version:
 * - Remove "(feat. ...)" suffixes
 * - Remove "[Official Video]", "(Lyrics)", etc.
 * - Remove file extension artifacts
 */
export function cleanSongTitle(title: string): string {
  let cleaned = title;
  // Remove common video/audio markers
  cleaned = cleaned.replace(/\s*[\[(](?:official\s*(?:video|audio|music\s*video|lyric\s*video)|lyrics?|audio|hd|hq|4k|1080p|720p|clip\s*officiel|version\s*originale)[\])]/gi, "");
  // Remove trailing whitespace and dashes
  cleaned = cleaned.replace(/[\s\-_]+$/, "");
  return normalizeTitle(cleaned);
}

/**
 * Try to detect if a filename follows "Artist - Title" pattern
 * and split accordingly. Returns null if no pattern detected.
 */
export function splitArtistTitle(text: string): { artist: string; title: string } | null {
  // Try "Artist - Title" with various dash types
  const match = text.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (match && match[1].trim().length > 1 && match[2].trim().length > 1) {
    return {
      artist: normalizeArtist(match[1].trim()),
      title: normalizeTitle(match[2].trim()),
    };
  }
  return null;
}

/**
 * Extract "feat." artists from a title and return clean title + featured artists.
 */
export function extractFeaturedArtists(title: string): { cleanTitle: string; featured: string[] } {
  const featMatch = title.match(/\s*[\[(](?:ft\.?|feat\.?|featuring)\s+(.+?)[\])]/i);
  if (featMatch) {
    const cleanTitle = title.replace(featMatch[0], "").trim();
    const featured = featMatch[1].split(/\s*[,&]\s*/).map((a) => a.trim()).filter(Boolean);
    return { cleanTitle, featured };
  }

  const inlineMatch = title.match(/\s+(?:ft\.?|feat\.?|featuring)\s+(.+)$/i);
  if (inlineMatch) {
    const cleanTitle = title.replace(inlineMatch[0], "").trim();
    const featured = inlineMatch[1].split(/\s*[,&]\s*/).map((a) => a.trim()).filter(Boolean);
    return { cleanTitle, featured };
  }

  return { cleanTitle: title, featured: [] };
}
