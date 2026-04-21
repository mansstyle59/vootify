export function getRadioLogo(_name: string): string | null { return null; }

/**
 * Returns the best available logo URL for a radio station.
 * Prefers the provided coverUrl (e.g. from RadioBrowser favicon or custom DB entry).
 */
export function getStationLogo(_name: string, coverUrl?: string | null): string | null {
  return coverUrl || null;
}
