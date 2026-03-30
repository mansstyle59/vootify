import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { radioCoverCache } from "@/lib/radioCoverCache";

export interface RadioMetadata {
  nowPlaying: string;
  title: string;
  artist: string;
  coverUrl: string;
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

            return {
              nowPlaying: data.nowPlaying,
              title: data.title,
              artist: data.artist,
              coverUrl,
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
