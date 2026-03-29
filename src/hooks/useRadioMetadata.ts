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
  streamUrl: string | undefined,
  isLive: boolean,
  isPlaying: boolean,
  stationName?: string,
  stationCover?: string
) {
  const [metadata, setMetadata] = useState<RadioMetadata | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStreamRef = useRef<string | undefined>();

  useEffect(() => {
    if (!streamUrl || !isLive || !isPlaying) {
      return;
    }

    const fetchMeta = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("radio-metadata", {
          body: { streamUrl, stationName, stationCover },
        });
        if (!error && data?.success && data.nowPlaying) {
          let coverUrl = data.coverUrl || "";

          // Check local cache first for cover
          if (data.artist && data.title) {
            const cached = radioCoverCache.get(data.artist, data.title);
            if (cached) {
              coverUrl = cached;
            } else if (coverUrl) {
              radioCoverCache.set(data.artist, data.title, coverUrl);
            }
          }

          setMetadata({
            nowPlaying: data.nowPlaying,
            title: data.title,
            artist: data.artist,
            coverUrl,
          });
        }
      } catch {
        // silent fail
      }
    };

    fetchMeta();
    intervalRef.current = setInterval(fetchMeta, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [streamUrl, isLive, isPlaying, stationName, stationCover]);

  // Only reset metadata when switching to a different stream
  useEffect(() => {
    if (prevStreamRef.current && streamUrl !== prevStreamRef.current) {
      setMetadata(null);
    }
    prevStreamRef.current = streamUrl;
  }, [streamUrl]);

  return metadata;
}
