/**
 * Resolution log — persists to Supabase resolve_logs table
 * with in-memory cache for current session.
 */
import { supabase } from "@/integrations/supabase/client";

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

/** Write entry to DB (fire-and-forget) */
function persistToDB(entry: ResolveLogEntry) {
  supabase
    .from("resolve_logs" as any)
    .insert({
      song_id: entry.songId,
      original_title: entry.originalTitle,
      original_artist: entry.originalArtist,
      resolved_title: entry.resolvedTitle || null,
      resolved_artist: entry.resolvedArtist || null,
      source: entry.source,
      stream_url: entry.streamUrl,
      title_corrected: entry.titleCorrected,
      artist_corrected: entry.artistCorrected,
    } as any)
    .then(({ error }) => {
      if (error) console.warn("[resolve-log] DB insert error:", error.message);
    });
}

export const resolveLog = {
  add(entry: ResolveLogEntry) {
    log.push(entry);
    if (log.length > MAX_LOG) log = log.slice(-MAX_LOG);
    // Persist to session + DB
    try {
      sessionStorage.setItem("resolve-log", JSON.stringify(log));
    } catch {}
    persistToDB(entry);
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

  /** Fetch all logs from the database (admin only) — paginates past 1000-row limit */
  async fetchFromDB(limit = 5000): Promise<ResolveLogEntry[]> {
    let all: any[] = [];
    let from = 0;
    const PAGE = 1000;
    while (all.length < limit) {
      const batchSize = Math.min(PAGE, limit - all.length);
      const { data, error } = await supabase
        .from("resolve_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + batchSize - 1);
      if (error) {
        console.warn("[resolve-log] DB fetch error:", error.message);
        break;
      }
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    return all.map((r: any) => ({
      songId: r.song_id,
      originalTitle: r.original_title,
      originalArtist: r.original_artist,
      resolvedTitle: r.resolved_title,
      resolvedArtist: r.resolved_artist,
      source: r.source as "custom" | "hd" | "none",
      streamUrl: r.stream_url,
      titleCorrected: r.title_corrected,
      artistCorrected: r.artist_corrected,
      ts: new Date(r.created_at).getTime(),
    }));
  },

  /** Clear all DB logs (admin only) */
  async clearDB(): Promise<boolean> {
    const { error } = await supabase
      .from("resolve_logs" as any)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      console.warn("[resolve-log] DB clear error:", error.message);
      return false;
    }
    return true;
  },

  /** DB-level stats */
  statsFromEntries(entries: ResolveLogEntry[]) {
    const custom = entries.filter(e => e.source === "custom").length;
    const hd = entries.filter(e => e.source === "hd").length;
    const none = entries.filter(e => e.source === "none").length;
    const corrected = entries.filter(e => e.titleCorrected || e.artistCorrected).length;
    return { total: entries.length, custom, hd, none, corrected };
  },
};
