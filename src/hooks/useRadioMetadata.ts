import { useEffect, useRef, useState, useCallback } from "react";

export interface RadioMeta {
  title: string;
  artist: string;
  cover: string | null;
}

const POLL_INTERVAL = 8000;
const INITIAL_DELAY = 5000;

function isSupportedStation(name: string): boolean {
  return /mouv|skyrock/i.test(name);
}

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
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/radio-metadata?station=${encodeURIComponent(stationName)}`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!resp.ok) return;
      const json = await resp.json();

      if (json.success && json.data) {
        const { title, artist, cover } = json.data;
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
