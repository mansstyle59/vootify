import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, Check, Plus, Disc3, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { toast } from "sonner";
import type { RadioMetadata } from "@/hooks/useRadioMetadata";
import { LazyImage } from "@/components/LazyImage";

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

/* ── Shazam-like detection toast ── */
function ShazamToast({
  visible,
  title,
  artist,
  coverUrl,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  artist: string;
  coverUrl?: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="shazam-toast"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 70%)" }}
        >
          {/* Ripple rings */}
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={`ring-${i}`}
              className="absolute rounded-full"
              style={{ border: "1.5px solid hsl(var(--primary) / 0.25)" }}
              initial={{ width: 40, height: 40, opacity: 0.7 }}
              animate={{
                width: [40, 280 + i * 60],
                height: [40, 280 + i * 60],
                opacity: [0.6, 0],
              }}
              transition={{
                duration: 2,
                delay: i * 0.3,
                ease: "easeOut",
              }}
            />
          ))}

          {/* Center content */}
          <motion.div
            className="relative flex flex-col items-center gap-4 pointer-events-auto"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.15 }}
            onClick={onDismiss}
          >
            {/* Glowing cover */}
            <motion.div
              className="relative w-28 h-28 rounded-2xl overflow-hidden"
              style={{
                boxShadow: "0 0 50px hsl(var(--primary) / 0.4), 0 20px 40px hsl(0 0% 0% / 0.5)",
              }}
              initial={{ rotateY: 90 }}
              animate={{ rotateY: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.3 }}
            >
              {coverUrl ? (
                <LazyImage src={coverUrl} alt={title} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--primary) / 0.1))" }}
                >
                  <Music className="w-10 h-10 text-primary/40" />
                </div>
              )}
              {/* Shine sweep */}
              <motion.div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(105deg, transparent 40%, hsl(0 0% 100% / 0.25) 50%, transparent 60%)",
                }}
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{ duration: 0.8, delay: 0.5, ease: "easeInOut" }}
              />
            </motion.div>

            {/* Identified badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{
                background: "hsl(142 70% 45% / 0.15)",
                border: "1px solid hsl(142 70% 45% / 0.3)",
                backdropFilter: "blur(20px)",
              }}
            >
              <Check className="w-3 h-3 text-green-400" />
              <span className="text-[10px] font-bold text-green-400 tracking-widest uppercase">Identifié</span>
            </motion.div>

            {/* Title & Artist */}
            <motion.div
              className="text-center max-w-[260px]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <p className="text-[18px] font-extrabold text-foreground truncate leading-tight">{title}</p>
              <p className="text-[14px] text-foreground/60 truncate mt-0.5">{artist}</p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Recognition status badge (inline) ── */
function RecognitionBadge({ state }: { state: "listening" | "identified" | "idle" }) {
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
          <span className="text-[11px] font-bold text-primary tracking-wide">ÉCOUTE EN COURS…</span>
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
  const [showShazam, setShowShazam] = useState(false);
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
        setShowShazam(true);
        if (navigator.vibrate) navigator.vibrate([15, 80, 15]);
        // Return to idle after shazam toast
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
    <>
      {/* Shazam-like full overlay */}
      <ShazamToast
        visible={showShazam}
        title={radioMeta.title}
        artist={radioMeta.artist}
        coverUrl={radioMeta.coverUrl || coverUrl}
        onDismiss={() => setShowShazam(false)}
      />

      <div className="flex flex-col items-center gap-3 w-full">
        {/* Inline recognition badge */}
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
    </>
  );
}

export { PulseRings };
