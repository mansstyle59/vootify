import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";

/**
 * Tracks listening time per user session.
 * Creates a usage_sessions row when playback starts,
 * and periodically updates duration_seconds while playing.
 */
export function useUsageTracking() {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const userId = usePlayerStore((s) => s.userId);
  const sessionIdRef = useRef<string | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!userId) return;

    if (isPlaying) {
      // Start session
      startRef.current = Date.now();
      supabase
        .from("usage_sessions")
        .insert({ user_id: userId, started_at: new Date().toISOString(), duration_seconds: 0, session_date: new Date().toISOString().slice(0, 10) })
        .select("id")
        .single()
        .then(({ data }) => {
          if (data) sessionIdRef.current = data.id;
        });

      // Update every 30 seconds
      const interval = setInterval(() => {
        if (sessionIdRef.current) {
          const elapsed = Math.round((Date.now() - startRef.current) / 1000);
          supabase
            .from("usage_sessions")
            .update({ duration_seconds: elapsed, ended_at: new Date().toISOString() })
            .eq("id", sessionIdRef.current)
            .then(() => {});
        }
      }, 30000);

      return () => {
        clearInterval(interval);
        // Final update on stop
        if (sessionIdRef.current) {
          const elapsed = Math.round((Date.now() - startRef.current) / 1000);
          supabase
            .from("usage_sessions")
            .update({ duration_seconds: elapsed, ended_at: new Date().toISOString() })
            .eq("id", sessionIdRef.current)
            .then(() => {});
          sessionIdRef.current = null;
        }
      };
    } else {
      // Playback stopped - finalize session
      if (sessionIdRef.current) {
        const elapsed = Math.round((Date.now() - startRef.current) / 1000);
        supabase
          .from("usage_sessions")
          .update({ duration_seconds: elapsed, ended_at: new Date().toISOString() })
          .eq("id", sessionIdRef.current)
          .then(() => {});
        sessionIdRef.current = null;
      }
    }
  }, [isPlaying, userId]);
}
