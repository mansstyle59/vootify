/**
 * Audio Profiles — saved EQ configurations for different listening contexts.
 * Stored in localStorage for instant access without network dependency.
 */

export interface AudioProfile {
  id: string;
  name: string;
  emoji: string;
  bass: number;
  treble: number;
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
  normalization: boolean;
}

const PROFILES_KEY = "vootify-audio-profiles";
const ACTIVE_PROFILE_KEY = "vootify-active-audio-profile";
const NORMALIZATION_KEY = "vootify-volume-normalization";
const AUTO_EQ_KEY = "vootify-auto-eq";

const DEFAULT_PROFILES: AudioProfile[] = [
  { id: "headphones", name: "Casque", emoji: "🎧", bass: 2, treble: 3, crossfadeEnabled: true, crossfadeDuration: 3, normalization: true },
  { id: "speaker", name: "Enceinte", emoji: "🔊", bass: 5, treble: 1, crossfadeEnabled: true, crossfadeDuration: 4, normalization: true },
  { id: "car", name: "Voiture", emoji: "🚗", bass: 6, treble: 2, crossfadeEnabled: true, crossfadeDuration: 2, normalization: true },
  { id: "night", name: "Nuit", emoji: "🌙", bass: -2, treble: -3, crossfadeEnabled: true, crossfadeDuration: 6, normalization: true },
];

export function getProfiles(): AudioProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [...DEFAULT_PROFILES];
}

export function saveProfiles(profiles: AudioProfile[]) {
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); } catch {}
}

export function getActiveProfileId(): string | null {
  try { return localStorage.getItem(ACTIVE_PROFILE_KEY); } catch { return null; }
}

export function setActiveProfileId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    else localStorage.removeItem(ACTIVE_PROFILE_KEY);
  } catch {}
}

export function isNormalizationEnabled(): boolean {
  try { return localStorage.getItem(NORMALIZATION_KEY) === "true"; } catch { return false; }
}

export function setNormalizationEnabled(enabled: boolean) {
  try { localStorage.setItem(NORMALIZATION_KEY, String(enabled)); } catch {}
}

export function isAutoEqEnabled(): boolean {
  try { return localStorage.getItem(AUTO_EQ_KEY) !== "false"; } catch { return true; }
}

export function setAutoEqEnabled(enabled: boolean) {
  try { localStorage.setItem(AUTO_EQ_KEY, String(enabled)); } catch {}
}

/** Map genre to best EQ preset values */
export function getGenreEq(genre: string | undefined): { bass: number; treble: number; label: string } | null {
  if (!genre) return null;
  const g = genre.toLowerCase();

  if (g.includes("hip") || g.includes("rap") || g.includes("trap") || g.includes("drill"))
    return { bass: 8, treble: 2, label: "Hip-Hop / Rap" };
  if (g.includes("electro") || g.includes("edm") || g.includes("house") || g.includes("techno") || g.includes("dance"))
    return { bass: 8, treble: 5, label: "Électro" };
  if (g.includes("pop"))
    return { bass: 2, treble: 4, label: "Pop" };
  if (g.includes("rock") || g.includes("metal") || g.includes("punk"))
    return { bass: 5, treble: 3, label: "Rock" };
  if (g.includes("jazz") || g.includes("blues"))
    return { bass: 4, treble: -3, label: "Jazz" };
  if (g.includes("class"))
    return { bass: -2, treble: 6, label: "Classique" };
  if (g.includes("r&b") || g.includes("rnb") || g.includes("soul"))
    return { bass: 4, treble: 2, label: "R&B / Soul" };
  if (g.includes("reggae") || g.includes("dub"))
    return { bass: 7, treble: -2, label: "Reggae" };
  if (g.includes("country") || g.includes("folk"))
    return { bass: 1, treble: 3, label: "Country / Folk" };
  if (g.includes("latin") || g.includes("salsa") || g.includes("reggaeton"))
    return { bass: 6, treble: 3, label: "Latin" };

  return null;
}
