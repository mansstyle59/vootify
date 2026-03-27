import { supabase } from "@/integrations/supabase/client";

/**
 * Normalize text: trim, collapse whitespace, capitalize properly.
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, " - ");
}

/**
 * Capitalize first letter of each significant word.
 */
export function normalizeTitle(title: string): string {
  const cleaned = normalizeText(title);
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    return cleaned
      .toLowerCase()
      .replace(/(^|\s)(\S)/g, (_, space, char) => space + char.toUpperCase());
  }
  return cleaned;
}

/**
 * Normalize artist name: trim, collapse whitespace.
 */
export function normalizeArtist(artist: string): string {
  return normalizeText(artist);
}
