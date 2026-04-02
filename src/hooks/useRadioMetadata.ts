import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { radioCoverCache } from "@/lib/radioCoverCache";

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

  // Subscribe to changes
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
  // Don't add if same as last entry
  if (list.length > 0 && list[0].title === entry.title && list[0].artist === entry.artist) return;
  const newEntry = { ...entry, playedAt: new Date() };
  const updated = [newEntry, ...list].slice(0, MAX_HISTORY);
  radioHistoryMap.set(streamUrl, updated);
}

export function useRadioMetadata(
  streamUrl?: string,
  isLive?: boolean,
  isPlaying?: boolean,
  stationName?: string,
  stationCover?: string,
) {
  const [metadata, setMetadata] = useState<RadioMetadata | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevStreamRef = useRef<string | undefined>();
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (!streamUrl || !isLive || !isPlaying) return;

    let isMounted = true;

    const fetchMeta = async () => {
      if (isFetchingRef.current) return;
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
            if (prev?.nowPlaying === data.nowPlaying && prev?.coverUrl === coverUrl) {
              return prev;
            }

            // Track history when song changes
            if (data.title && data.artist && streamUrl) {
              addToHistory(streamUrl, {
                title: data.title,
                artist: data.artist,
                coverUrl,
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
            };
          });
        }
      } catch (err) {
        console.warn("Radio metadata error:", err);
      } finally {
        isFetchingRef.current = false;
      }
    };

    fetchMeta();
    intervalRef.current = setInterval(fetchMeta, 30000);

    return () => {
      isMounted = false;

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [streamUrl, isLive, isPlaying, stationName, stationCover]);

  useEffect(() => {
    if (prevStreamRef.current && streamUrl !== prevStreamRef.current) {
      setMetadata(null);
    }
    prevStreamRef.current = streamUrl;
  }, [streamUrl]);

  return metadata;
}
