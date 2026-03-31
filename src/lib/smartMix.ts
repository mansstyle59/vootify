/**
 * Smart Mix Engine for CarPlay — generates intelligent playlists
 * based on time of day, listening history, and favorites.
 */

import { Song } from "@/data/mockData";

/** Time-of-day context */
export type TimeContext = "morning" | "afternoon" | "evening" | "night";

export function getTimeContext(): TimeContext {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export function getGreeting(name?: string | null): string {
  const ctx = getTimeContext();
  const base = ctx === "morning" ? "Bonjour" : ctx === "afternoon" ? "Bon après-midi" : ctx === "evening" ? "Bonsoir" : "Bonne nuit";
  return name ? `${base}, ${name}` : base;
}

export function getSmartMixLabel(): string {
  const ctx = getTimeContext();
  switch (ctx) {
    case "morning": return "Mix du matin ☀️";
    case "afternoon": return "Mix de l'après-midi 🎶";
    case "evening": return "Mix du soir 🌆";
    case "night": return "Mix nocturne 🌙";
  }
}

/**
 * Build a smart mix from available songs, liked songs, and recently played.
 * Algorithm:
 * - Prioritize liked songs (weight x3)
 * - Boost recently played (weight x2)
 * - Add variety from catalog
 * - Shuffle with weighted randomness
 */
export function buildSmartMix(
  catalog: Song[],
  liked: Song[],
  recent: Song[],
  maxSize = 30,
): Song[] {
  if (catalog.length === 0 && liked.length === 0) return [];

  // Score each song
  const scores = new Map<string, { song: Song; score: number }>();
  const likedIds = new Set(liked.map(s => s.id));
  const recentIds = new Set(recent.map(s => s.id));

  // Add all songs with base score
  for (const song of catalog) {
    let score = 1 + Math.random() * 0.5; // Base + random variety
    if (likedIds.has(song.id)) score += 3;
    if (recentIds.has(song.id)) score += 2;
    scores.set(song.id, { song, score });
  }

  // Add liked songs not in catalog
  for (const song of liked) {
    if (!scores.has(song.id)) {
      scores.set(song.id, { song, score: 3 + Math.random() * 0.5 });
    }
  }

  // Sort by score descending, then take top N
  const sorted = Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSize * 2);

  // Shuffle the top candidates for variety
  for (let i = sorted.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  }

  return sorted.slice(0, maxSize).map(s => s.song);
}
