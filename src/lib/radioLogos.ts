/**
 * Maps known radio station name patterns to local logo files.
 * Falls back to Deezer radio search for cover art when no local logo matches.
 */

import { supabase } from "@/integrations/supabase/client";

const STATION_LOGO_MAP: { pattern: RegExp; logo: string }[] = [
  { pattern: /france\s*inter/i, logo: "/radio-logos/france-inter.png" },
  { pattern: /franceinfo|france\s*info/i, logo: "/radio-logos/franceinfo.png" },
  { pattern: /\bfip\b/i, logo: "/radio-logos/fip.png" },
  { pattern: /france\s*musique/i, logo: "/radio-logos/france-musique.png" },
  { pattern: /france\s*culture/i, logo: "/radio-logos/france-culture.png" },
  { pattern: /\bmouv/i, logo: "/radio-logos/mouv.png" },
];

// In-memory cache to avoid repeated Deezer lookups
const deezerLogoCache = new Map<string, string>();

export function getStationLogo(stationName: string, fallbackUrl: string): string {
  // 1. If we have a user-uploaded cover (not empty, not a generic placeholder), always use it
  if (fallbackUrl && fallbackUrl.length > 10 && !fallbackUrl.includes("unsplash.com")) {
    return fallbackUrl;
  }
  // 2. Try known station patterns
  for (const { pattern, logo } of STATION_LOGO_MAP) {
    if (pattern.test(stationName)) return logo;
  }
  return fallbackUrl;
}

/**
 * Async version: tries local logos first, then searches Deezer for a radio cover.
 * Returns the best cover URL found, or the fallback.
 */
export async function getStationLogoAsync(stationName: string, fallbackUrl: string): Promise<string> {
  // 1. If user uploaded a cover, always respect it — no external lookup
  if (fallbackUrl && fallbackUrl.length > 10 && !fallbackUrl.includes("unsplash.com")) {
    return fallbackUrl;
  }

  // 2. Local logos
  for (const { pattern, logo } of STATION_LOGO_MAP) {
    if (pattern.test(stationName)) return logo;
  }

  // 3. Check in-memory cache
  const cacheKey = stationName.toLowerCase().trim();
  if (deezerLogoCache.has(cacheKey)) {
    return deezerLogoCache.get(cacheKey)!;
  }

  // 4. Search Deezer for the station
  try {
    const { data, error } = await supabase.functions.invoke("deezer-proxy", {
      body: { action: "search_radio", query: stationName, limit: 3 },
    });

    if (!error && data?.data?.length > 0) {
      // Find best match by name similarity
      const nameNorm = cacheKey;
      const best = data.data.find((r: any) =>
        r.title?.toLowerCase().includes(nameNorm) || nameNorm.includes(r.title?.toLowerCase())
      ) || data.data[0];

      const coverUrl = best.picture_big || best.picture_medium || best.picture || "";
      if (coverUrl) {
        deezerLogoCache.set(cacheKey, coverUrl);
        return coverUrl;
      }
    }
  } catch {
    // silent fail — use fallback
  }

  return fallbackUrl;
}
