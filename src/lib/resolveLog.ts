/**
 * In-memory log of resolution modifications.
 * Tracks what was resolved, changed, or corrected per session.
 */

export interface ResolveLogEntry {
  songId: string;
  originalTitle: string;
  originalArtist: string;
  resolvedTitle?: string;
  resolvedArtist?: string;
  source: "custom" | "hd" | "none";
  streamUrl: string;
  titleCorrected: boolean;
  artistCorrected: boolean;
  ts: number;
}

const MAX_LOG = 200;
let log: ResolveLogEntry[] = [];

export const resolveLog = {
  add(entry: ResolveLogEntry) {
    log.push(entry);
    if (log.length > MAX_LOG) log = log.slice(-MAX_LOG);
    // Persist to sessionStorage for debugging
    try {
      sessionStorage.setItem("resolve-log", JSON.stringify(log));
    } catch {}
  },

  getAll(): ResolveLogEntry[] {
    return [...log];
  },

  getRecent(n = 20): ResolveLogEntry[] {
    return log.slice(-n);
  },

  clear() {
    log = [];
    try { sessionStorage.removeItem("resolve-log"); } catch {}
  },

  stats() {
    const custom = log.filter(e => e.source === "custom").length;
    const hd = log.filter(e => e.source === "hd").length;
    const none = log.filter(e => e.source === "none").length;
    const corrected = log.filter(e => e.titleCorrected || e.artistCorrected).length;
    return { total: log.length, custom, hd, none, corrected };
  },
};
