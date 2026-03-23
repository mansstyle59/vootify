import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RadioMetadata {
  nowPlaying: string;
  title: string;
  artist: string;
}

export function useRadioMetadata(streamUrl: string | undefined, isLive: boolean, isPlaying: boolean) {
  const [metadata, setMetadata] = useState<RadioMetadata | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!streamUrl || !isLive || !isPlaying) {
      return;
    }

    const fetchMeta = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("radio-metadata", {
          body: { streamUrl },
        });
        if (!error && data?.success && data.nowPlaying) {
          setMetadata({ nowPlaying: data.nowPlaying, title: data.title, artist: data.artist });
        }
      } catch {
        // silent fail
      }
    };

    fetchMeta();
    intervalRef.current = setInterval(fetchMeta, 30000); // poll every 30s

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [streamUrl, isLive, isPlaying]);

  // Reset when stream changes
  useEffect(() => {
    setMetadata(null);
  }, [streamUrl]);

  return metadata;
}
