import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, Check, Plus, Disc3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { toast } from "sonner";
import type { RadioMetadata } from "@/hooks/useRadioMetadata";

/* ── Pulsing ring animation ── */
function PulseRings({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-primary/30"
          initial={{ width: 60, height: 60, opacity: 0.6 }}
          animate={{
            width: [60, 160 + i * 40],
            height: [60, 160 + i * 40],
            opacity: [0.5, 0],
          }}
          transition={{
            duration: 2.2,
            delay: i * 0.5,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

/* ── Recognition status badge ── */
function RecognitionBadge({
  state,
}: {
  state: "listening" | "identified" | "idle";
}) {
  return (
    <AnimatePresence mode="wait">
      {state === "listening" && (
        <motion.div
          key="listening"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: "hsl(var(--primary) / 0.12)",
            border: "1px solid hsl(var(--primary) / 0.25)",
          }}
        >
          <Disc3 className="w-3.5 h-3.5 text-primary animate-spin" style={{ animationDuration: "3s" }} />
          <span className="text-[11px] font-bold text-primary tracking-wide">
            ÉCOUTE EN COURS…
          </span>
        </motion.div>
      )}
      {state === "identified" && (
        <motion.div
          key="identified"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: "hsl(142 70% 45% / 0.15)",
            border: "1px solid hsl(142 70% 45% / 0.3)",
          }}
        >
          <Check className="w-3.5 h-3.5 text-green-400" />
          <span className="text-[11px] font-bold text-green-400 tracking-wide">
            IDENTIFIÉ
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface Props {
  radioMeta: RadioMetadata | null;
  isPlaying: boolean;
  stationName: string;
  coverUrl?: string;
}

export function RadioRecognitionOverlay({ radioMeta, isPlaying, stationName, coverUrl }: Props) {
  const [recognitionState, setRecognitionState] = useState<"idle" | "listening" | "identified">("idle");
  const [savedSong, setSavedSong] = useState<string | null>(null);
  const prevTrackRef = useRef<string>("");
  const identifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect new song → trigger recognition animation
  useEffect(() => {
    const trackKey = `${radioMeta?.artist || ""}|||${radioMeta?.title || ""}`;
    if (!radioMeta?.title || !radioMeta?.artist || !isPlaying) {
      setRecognitionState("idle");
      return;
    }

    if (trackKey !== prevTrackRef.current && radioMeta.title && radioMeta.artist) {
      prevTrackRef.current = trackKey;
      setSavedSong(null);

      // Start "listening" animation
      setRecognitionState("listening");
      if (identifyTimerRef.current) clearTimeout(identifyTimerRef.current);

      identifyTimerRef.current = setTimeout(() => {
        setRecognitionState("identified");
        // Auto-hide after 5s
        identifyTimerRef.current = setTimeout(() => setRecognitionState("idle"), 5000);
      }, 1500);
    }

    return () => {
      if (identifyTimerRef.current) clearTimeout(identifyTimerRef.current);
    };
  }, [radioMeta?.title, radioMeta?.artist, isPlaying]);

  const handleSaveToLibrary = async () => {
    if (!radioMeta?.title || !radioMeta?.artist) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Connexion requise"); return; }

      // Check if already exists
      const { data: existing } = await supabase
        .from("custom_songs")
        .select("id")
        .eq("title", radioMeta.title)
        .eq("artist", radioMeta.artist)
        .maybeSingle();

      if (existing) {
        toast.info("Ce morceau est déjà dans ta bibliothèque");
        setSavedSong(existing.id);
        return;
      }

      const { data, error } = await supabase.from("custom_songs").insert({
        title: radioMeta.title,
        artist: radioMeta.artist,
        album: radioMeta.album || stationName,
        cover_url: radioMeta.coverUrl || coverUrl || "",
        duration: 0,
        user_id: user.id,
        genre: "Radio",
      }).select("id").single();

      if (error) throw error;
      setSavedSong(data.id);
      toast.success("Morceau ajouté à la bibliothèque");
      if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
    } catch (err) {
      console.error("Save to library error:", err);
      toast.error("Impossible d'ajouter le morceau");
    }
  };

  if (!radioMeta?.title || !radioMeta?.artist || !isPlaying) return null;

  const isIdentified = recognitionState === "identified" || recognitionState === "idle";

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Recognition badge */}
      <RecognitionBadge state={recognitionState} />

      {/* Save to library action (visible when identified) */}
      <AnimatePresence>
        {isIdentified && radioMeta.title && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.1 }}
            className="w-full"
          >
            <button
              onClick={handleSaveToLibrary}
              disabled={!!savedSong}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl active:scale-[0.97] transition-all disabled:opacity-60"
              style={{
                background: savedSong
                  ? "hsl(142 70% 45% / 0.12)"
                  : "hsl(var(--primary) / 0.12)",
                border: savedSong
                  ? "1px solid hsl(142 70% 45% / 0.25)"
                  : "1px solid hsl(var(--primary) / 0.25)",
              }}
            >
              {savedSong ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-[12px] font-bold text-green-400">Ajouté à la bibliothèque</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 text-primary" />
                  <span className="text-[12px] font-bold text-primary">Ajouter à ma bibliothèque</span>
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { PulseRings };
