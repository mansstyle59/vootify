import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { radioCoverCache } from "@/lib/radioCoverCache";
import { audioManager } from "@/lib/audioManager";

export type RadioSource = "official" | "stream" | "radio_fr" | "tunein" | "none";

export interface RadioMetadata {
  nowPlaying: string;
  title: string;
  artist: string;
  coverUrl: string;
  album?: string;
  source: RadioSource;
  showName?: string;
  showCover?: string;
  isShow?: boolean;
  adFiltered?: boolean;
  lastUpdated?: number; // timestamp ms
}

export interface RadioHistoryEntry {
  title: string;
  artist: string;
  coverUrl: string;
  playedAt: Date;
}

// Global history store keyed by streamUrl
const radioHistoryMap = new Map<string, RadioHistoryEntry[]>();
const MAX_HISTORY = 20;

export function useRadioHistory(streamUrl?: string): RadioHistoryEntry[] {
  const [history, setHistory] = useState<RadioHistoryEntry[]>([]);

  useEffect(() => {
    if (!streamUrl) { setHistory([]); return; }
    setHistory(radioHistoryMap.get(streamUrl) || []);
  }, [streamUrl]);

  useEffect(() => {
    if (!streamUrl) return;
    const interval = setInterval(() => {
      const current = radioHistoryMap.get(streamUrl) || [];
      setHistory(prev => prev.length !== current.length ? [...current] : prev);
    }, 2000);
    return () => clearInterval(interval);
  }, [streamUrl]);

  return history;
}

function addToHistory(streamUrl: string, entry: Omit<RadioHistoryEntry, "playedAt">) {
  const list = radioHistoryMap.get(streamUrl) || [];
  if (list.length > 0 && list[0].title === entry.title && list[0].artist === entry.artist) return;
  const newEntry = { ...entry, playedAt: new Date() };
  const updated = [newEntry, ...list].slice(0, MAX_HISTORY);
  radioHistoryMap.set(streamUrl, updated);
}

// ─── Adaptive polling intervals ───
const POLL_FAST = 5_000;     // 5s right after a song change
const POLL_NORMAL = 8_000;   // 8s steady state
const POLL_SLOW = 15_000;    // 15s when nothing changes for a while
const FAST_WINDOW = 60_000;  // Stay fast for 60s after a change
const INITIAL_DELAY = 5_000; // Wait 5s after stream starts before first fetch

export function useRadioMetadata(
  streamUrl?: string,
  isLive?: boolean,
  isPlaying?: boolean,
  stationName?: string,
  stationCover?: string,
) {
  const [metadata, setMetadata] = useState<RadioMetadata | null>(null);

  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStreamRef = useRef<string | undefined>();
  const isFetchingRef = useRef(false);
  const lastChangeRef = useRef<number>(0);
  const stableCountRef = useRef(0);

  useEffect(() => {
    if (!streamUrl || !isLive || !isPlaying) return;

    let isMounted = true;

    const getInterval = () => {
      const sinceLastChange = Date.now() - lastChangeRef.current;
      if (sinceLastChange < FAST_WINDOW) return POLL_FAST;
      if (stableCountRef.current > 4) return POLL_SLOW;
      return POLL_NORMAL;
    };

    const scheduleNext = () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
      intervalRef.current = setTimeout(fetchMeta, getInterval());
    };

    const fetchMeta = async () => {
      if (isFetchingRef.current || !isMounted) return;
      isFetchingRef.current = true;

      try {
        const { data, error } = await supabase.functions.invoke("radio-metadata", {
          body: { streamUrl, stationName, stationCover },
        });

        if (!isMounted) return;

        if (!error && data?.success && data.nowPlaying) {
          let coverUrl = data.coverUrl || stationCover || "";

          if (data.artist && data.title) {
            const cached = radioCoverCache.get(data.artist, data.title);
            if (cached) {
              coverUrl = cached;
            } else if (coverUrl) {
              radioCoverCache.set(data.artist, data.title, coverUrl);
            }
          }

          setMetadata((prev) => {
            const changed = prev?.nowPlaying !== data.nowPlaying || prev?.coverUrl !== coverUrl;

            if (!changed) {
              stableCountRef.current++;
              return prev;
            }

            // Song changed — reset adaptive timers
            stableCountRef.current = 0;
            lastChangeRef.current = Date.now();

            // Track history
            if (data.title && data.artist && streamUrl) {
              addToHistory(streamUrl, {
                title: data.title,
                artist: data.artist,
                coverUrl,
              });
            }

            // ── Sync MediaSession immediately ──
            if (data.title || data.artist) {
              audioManager.updateMetadata({
                title: data.title || stationName || "Radio",
                artist: data.artist || stationName || "",
                cover: coverUrl || stationCover || "",
                album: data.album || (data.isShow ? data.showName : "Radio") || "Radio",
              });
            }

            return {
              nowPlaying: data.nowPlaying,
              title: data.title,
              artist: data.artist,
              coverUrl,
              album: data.album || undefined,
              source: data.source || "none",
              showName: data.showName || undefined,
              showCover: data.showCover || undefined,
              isShow: data.isShow || false,
              adFiltered: data.adFiltered || false,
              lastUpdated: Date.now(),
            };
          });
        }
      } catch (err) {
        console.warn("Radio metadata error:", err);
      } finally {
        isFetchingRef.current = false;
        if (isMounted) scheduleNext();
      }
    };

    // Initial fetch with delay to let stream start
    const initialTimer = setTimeout(fetchMeta, INITIAL_DELAY);

    return () => {
      isMounted = false;
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [streamUrl, isLive, isPlaying, stationName, stationCover]);

  useEffect(() => {
    if (prevStreamRef.current && streamUrl !== prevStreamRef.current) {
      setMetadata(null);
      lastChangeRef.current = Date.now();
      stableCountRef.current = 0;
    }
    prevStreamRef.current = streamUrl;
  }, [streamUrl]);

  return metadata;
}
