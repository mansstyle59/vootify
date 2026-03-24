/**
 * Maps known radio station name patterns to local logo files.
 * Returns the local logo path if matched, otherwise returns the original URL.
 */

const STATION_LOGO_MAP: { pattern: RegExp; logo: string }[] = [
  { pattern: /france\s*inter/i, logo: "/radio-logos/france-inter.png" },
  { pattern: /franceinfo|france\s*info/i, logo: "/radio-logos/franceinfo.png" },
  { pattern: /\bfip\b/i, logo: "/radio-logos/fip.png" },
  { pattern: /france\s*musique/i, logo: "/radio-logos/france-musique.png" },
  { pattern: /france\s*culture/i, logo: "/radio-logos/france-culture.png" },
  { pattern: /\bmouv/i, logo: "/radio-logos/mouv.png" },
];

export function getStationLogo(stationName: string, fallbackUrl: string): string {
  for (const { pattern, logo } of STATION_LOGO_MAP) {
    if (pattern.test(stationName)) return logo;
  }
  return fallbackUrl;
}
