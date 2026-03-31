import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Pause, Play, SkipBack, SkipForward, Disc3 } from "lucide-react";

function LiveEqualizer() {
  return (
    <div className="flex items-end gap-[3px] h-5">
      {[0, 0.15, 0.3].map((delay, i) => (
        <motion.div
          key={i}
          className="w-[4px] rounded-full bg-primary"
          animate={{ height: ["8px", "20px", "10px", "18px", "8px"] }}
          transition={{ duration: 1.2, repeat: Infinity, delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

interface Props {
  coverUrl: string;
  title: string;
  artist: string;
  isPlaying: boolean;
  isLiveRadio: boolean;
  source?: string;
  onClose: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

const SOURCE_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  official: { label: "Officielle", bg: "hsl(142 70% 45%/0.15)", color: "hsl(142 70% 65%)" },
  stream: { label: "Flux", bg: "hsl(210 70% 50%/0.15)", color: "hsl(210 70% 70%)" },
  radio_fr: { label: "radio.fr", bg: "hsl(38 90% 50%/0.15)", color: "hsl(38 90% 65%)" },
  tunein: { label: "TuneIn", bg: "hsl(38 90% 50%/0.15)", color: "hsl(38 90% 65%)" },
};

const GLASS_CONTROL = {
  background: "hsl(0 0% 100%/0.08)",
  backdropFilter: "blur(40px) saturate(1.8)",
  WebkitBackdropFilter: "blur(40px) saturate(1.8)",
  border: "0.5px solid hsl(0 0% 100%/0.1)",
  boxShadow: "inset 0 0.5px 0 hsl(0 0% 100%/0.1)",
};

export function CarPlayNowPlaying({
  coverUrl, title, artist, isPlaying, isLiveRadio, source,
  onClose, onTogglePlay, onNext, onPrevious,
}: Props) {
  const srcCfg = source ? SOURCE_LABELS[source] : null;

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
    >
      {/* Blurred bg — Liquid Glass multi-layer */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.3, opacity: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-0 bg-black" />
        {coverUrl && (
          <>
            <img
              src={coverUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: "blur(100px) brightness(0.25) saturate(2.5)", transform: "scale(1.5)" }}
            />
            {/* Secondary warm glow layer */}
            <img
              src={coverUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: "blur(60px) brightness(0.15) saturate(3) hue-rotate(15deg)", transform: "scale(1.3)", opacity: 0.4 }}
            />
          </>
        )}
        {/* Gradient overlays for depth */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(160deg, hsl(0 0% 0%/0.1) 0%, hsl(0 0% 0%/0.6) 50%, hsl(0 0% 0%/0.85) 100%)"
        }} />
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse at 50% 30%, transparent 0%, hsl(0 0% 0%/0.4) 70%)"
        }} />
      </motion.div>

      {/* Header with glass controls */}
      <motion.div
        className="relative z-10 flex items-center px-5 pt-[max(1rem,env(safe-area-inset-top))]"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
      >
        <button
          onClick={onClose}
          className="p-3.5 rounded-2xl active:scale-90 transition-transform"
          style={{ ...GLASS_CONTROL, minWidth: 52, minHeight: 52 }}
        >
          <ChevronDown className="w-6 h-6 text-white" />
        </button>
        <div className="ml-auto flex items-center gap-2">
          {isLiveRadio && (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{
                background: "hsl(0 70% 50%/0.12)",
                border: "0.5px solid hsl(0 70% 50%/0.2)",
                boxShadow: "inset 0 0.5px 0 hsl(0 70% 80%/0.1)",
              }}
            >
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] font-bold text-red-400/90 uppercase tracking-wider">En direct</span>
            </div>
          )}
          {srcCfg && (
            <span
              className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: srcCfg.bg,
                color: srcCfg.color,
                border: `0.5px solid ${srcCfg.color}33`,
                boxShadow: `inset 0 0.5px 0 ${srcCfg.color}22`,
              }}
            >
              {srcCfg.label}
            </span>
          )}
        </div>
      </motion.div>

      {/* Giant artwork — Liquid Glass frame */}
      <motion.div
        className="relative z-10 flex-1 flex items-center justify-center px-8 py-4"
        initial={{ scale: 0.6, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 22, delay: 0.1 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={coverUrl}
            initial={{ opacity: 0, scale: 0.8, rotateY: -15 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotateY: 15 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[82vw] max-h-[44vh] overflow-hidden"
            style={{
              borderRadius: "1.5rem",
              boxShadow: "0 40px 100px hsl(0 0% 0%/0.65), 0 15px 40px hsl(0 0% 0%/0.4), inset 0 0.5px 0 hsl(0 0% 100%/0.08)",
              border: "0.5px solid hsl(0 0% 100%/0.08)",
              aspectRatio: "1/1",
            }}
          >
            {coverUrl ? (
              <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: "hsl(0 0% 100%/0.04)" }}>
                <Disc3 className="w-24 h-24 text-white/15" />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Track info + Liquid Glass controls panel */}
      <motion.div
        className="relative z-10 w-full px-5 pb-[max(2rem,env(safe-area-inset-bottom))]"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Glass control panel */}
        <div
          className="rounded-3xl p-5 mb-2"
          style={{
            background: "hsl(0 0% 100%/0.05)",
            backdropFilter: "blur(80px) saturate(2.2)",
            WebkitBackdropFilter: "blur(80px) saturate(2.2)",
            border: "0.5px solid hsl(0 0% 100%/0.1)",
            boxShadow: "inset 0 0.5px 0 hsl(0 0% 100%/0.12), inset 0 -0.5px 0 hsl(0 0% 0%/0.1), 0 16px 48px hsl(0 0% 0%/0.3)",
          }}
        >
          {/* Title + Artist */}
          <div className="text-center mb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
                transition={{ duration: 0.4 }}
              >
                <p className="text-2xl font-black text-white truncate mb-1">{title}</p>
                <p className="text-base text-white/45 truncate">{artist}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Transport controls */}
          <div className="flex items-center justify-center gap-6">
            {!isLiveRadio && (
              <motion.button
                onClick={onPrevious}
                className="rounded-2xl active:scale-85 transition-transform"
                style={{ ...GLASS_CONTROL, padding: "1.1rem", minWidth: 60, minHeight: 60 }}
                whileTap={{ scale: 0.82 }}
              >
                <SkipBack className="w-7 h-7 text-white" />
              </motion.button>
            )}
            <motion.button
              onClick={onTogglePlay}
              className="rounded-full active:scale-85 transition-transform"
              style={{
                background: "hsl(var(--primary))",
                boxShadow: "0 10px 36px hsl(var(--primary)/0.45), inset 0 1px 0 hsl(0 0% 100%/0.15)",
                padding: isLiveRadio ? "1.75rem" : "1.5rem",
                minWidth: 76,
                minHeight: 76,
              }}
              whileTap={{ scale: 0.85 }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isPlaying ? "pause" : "play"}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {isPlaying
                    ? <Pause className="w-9 h-9 text-primary-foreground" />
                    : <Play className="w-9 h-9 text-primary-foreground ml-0.5" />
                  }
                </motion.div>
              </AnimatePresence>
            </motion.button>
            {!isLiveRadio && (
              <motion.button
                onClick={onNext}
                className="rounded-2xl active:scale-85 transition-transform"
                style={{ ...GLASS_CONTROL, padding: "1.1rem", minWidth: 60, minHeight: 60 }}
                whileTap={{ scale: 0.82 }}
              >
                <SkipForward className="w-7 h-7 text-white" />
              </motion.button>
            )}
          </div>

          {/* Live indicator */}
          {isLiveRadio && isPlaying && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-4 mt-5"
            >
              <LiveEqualizer />
              <span className="text-xs font-bold text-primary uppercase tracking-widest">En direct</span>
              <LiveEqualizer />
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
