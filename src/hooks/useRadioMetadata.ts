import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RadioMeta {
  title: string;
  artist: string;
  cover: string | null;
}

const POLL_INTERVAL = 8000; // 8 seconds
const INITIAL_DELAY = 5000; // wait 5s after stream starts

/**
 * Checks if a station name matches Mouv' variants
 */
function isMouvStation(name: string): boolean {
  return /mouv/i.test(name);
}

/**
 * Hook that polls radio metadata for supported stations (Mouv').
 * Returns current title/artist/cover or null when unavailable.
 */
export function useRadioMetadata(
  stationName: string | null,
  isPlaying: boolean
): RadioMeta | null {
  const [meta, setMeta] = useState<RadioMeta | null>(null);
  const lastTitleRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMeta = useCallback(async () => {
    if (!stationName || !isMouvStation(stationName)) return;

    try {
      const { data, error } = await supabase.functions.invoke(
        "radio-metadata",
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          body: undefined,
        }
      );

      // supabase.functions.invoke with GET doesn't support query params easily,
      // so we use POST with body instead
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/radio-metadata?station=${encodeURIComponent(stationName)}`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!resp.ok) return;
      const json = await resp.json();

      if (json.success && json.data) {
        const { title, artist, cover } = json.data;
        // Only update if changed (ignore duplicates)
        if (title && title !== lastTitleRef.current) {
          lastTitleRef.current = title;
          setMeta({ title, artist, cover });
        }
      }
    } catch (e) {
      console.warn("[useRadioMetadata] fetch error:", e);
    }
  }, [stationName]);

  useEffect(() => {
    if (!stationName || !isPlaying || !isMouvStation(stationName)) {
      setMeta(null);
      lastTitleRef.current = "";
      return;
    }

    // Initial delay before first fetch
    initialDelayRef.current = setTimeout(() => {
      fetchMeta();
      timerRef.current = setInterval(fetchMeta, POLL_INTERVAL);
    }, INITIAL_DELAY);

    return () => {
      if (initialDelayRef.current) clearTimeout(initialDelayRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      setMeta(null);
      lastTitleRef.current = "";
    };
  }, [stationName, isPlaying, fetchMeta]);

  return meta;
}
