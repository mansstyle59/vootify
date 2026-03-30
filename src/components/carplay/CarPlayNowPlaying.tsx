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

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  official: { label: "Officielle", color: "bg-green-500/20 text-green-400" },
  stream: { label: "Flux", color: "bg-blue-500/20 text-blue-400" },
  radio_fr: { label: "radio.fr", color: "bg-amber-500/20 text-amber-400" },
  tunein: { label: "TuneIn", color: "bg-amber-500/20 text-amber-400" },
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
      transition={{ duration: 0.4 }}
    >
      {/* Blurred bg */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.3, opacity: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-0 bg-black" />
        {coverUrl && (
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "blur(90px) brightness(0.35) saturate(2)", transform: "scale(1.4)" }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, hsl(0 0% 0%/0.2) 0%, hsl(0 0% 0%/0.75) 100%)" }}
        />
      </motion.div>

      {/* Header */}
      <motion.div
        className="relative z-10 flex items-center px-5 pt-[max(1rem,env(safe-area-inset-top))]"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
      >
        <button
          onClick={onClose}
          className="p-4 rounded-full active:scale-90 transition-transform"
          style={{ background: "hsl(0 0% 100%/0.1)", minWidth: 56, minHeight: 56 }}
        >
          <ChevronDown className="w-7 h-7 text-white" />
        </button>
        <div className="ml-auto flex items-center gap-2">
          {isLiveRadio && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: "hsl(0 0% 100%/0.1)" }}>
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-white/80 uppercase tracking-wider">En direct</span>
            </div>
          )}
          {srcCfg && (
            <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${srcCfg.color}`}>
              {srcCfg.label}
            </span>
          )}
        </div>
      </motion.div>

      {/* Giant artwork with vinyl rotation for radio */}
      <motion.div
        className="relative z-10 flex-1 flex items-center justify-center px-6 py-4"
        initial={{ scale: 0.6, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 22, delay: 0.1 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={coverUrl}
            initial={{ opacity: 0, scale: 0.8, rotateY: -20 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotateY: 20 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[88vw] max-h-[48vh] overflow-hidden"
            style={{
              borderRadius: isLiveRadio ? "50%" : "1.5rem",
              boxShadow: "0 40px 100px hsl(0 0% 0%/0.7), 0 15px 40px hsl(0 0% 0%/0.5)",
              aspectRatio: "1/1",
            }}
          >
            {isLiveRadio && isPlaying ? (
              <motion.div
                className="w-full h-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                {coverUrl ? (
                  <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: "hsl(0 0% 100%/0.06)" }}>
                    <Disc3 className="w-24 h-24 text-white/20" />
                  </div>
                )}
              </motion.div>
            ) : coverUrl ? (
              <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: "hsl(0 0% 100%/0.06)" }}>
                <Disc3 className="w-24 h-24 text-white/20" />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Track info + controls */}
      <motion.div
        className="relative z-10 w-full px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Title + Artist */}
        <div className="text-center mb-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(10px)" }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-3xl font-black text-white truncate mb-2">{title}</p>
              <p className="text-lg text-white/50 truncate">{artist}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Large transport controls — extra big for driving */}
        <div className="flex items-center justify-center gap-8">
          {!isLiveRadio && (
            <motion.button
              onClick={onPrevious}
              className="rounded-full active:scale-85 transition-transform"
              style={{ background: "hsl(0 0% 100%/0.1)", padding: "1.25rem", minWidth: 64, minHeight: 64 }}
              whileTap={{ scale: 0.82 }}
            >
              <SkipBack className="w-8 h-8 text-white" />
            </motion.button>
          )}
          <motion.button
            onClick={onTogglePlay}
            className="rounded-full active:scale-85 transition-transform"
            style={{
              background: "hsl(var(--primary))",
              boxShadow: "0 12px 40px hsl(var(--primary)/0.5)",
              padding: isLiveRadio ? "2rem" : "1.75rem",
              minWidth: 80,
              minHeight: 80,
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
                  ? <Pause className="w-10 h-10 text-primary-foreground" />
                  : <Play className="w-10 h-10 text-primary-foreground ml-1" />
                }
              </motion.div>
            </AnimatePresence>
          </motion.button>
          {!isLiveRadio && (
            <motion.button
              onClick={onNext}
              className="rounded-full active:scale-85 transition-transform"
              style={{ background: "hsl(0 0% 100%/0.1)", padding: "1.25rem", minWidth: 64, minHeight: 64 }}
              whileTap={{ scale: 0.82 }}
            >
              <SkipForward className="w-8 h-8 text-white" />
            </motion.button>
          )}
        </div>

        {/* Live indicator */}
        {isLiveRadio && isPlaying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-4 mt-8"
          >
            <LiveEqualizer />
            <span className="text-sm font-bold text-primary uppercase tracking-widest">En direct</span>
            <LiveEqualizer />
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
