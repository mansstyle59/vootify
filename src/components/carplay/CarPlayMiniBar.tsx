import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { LazyImage } from "@/components/LazyImage";

interface Props {
  coverUrl: string;
  title: string;
  artist: string;
  isPlaying: boolean;
  isLiveRadio: boolean;
  onExpand: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

function MiniEqualizer() {
  return (
    <div className="flex items-end gap-[2px] h-3">
      {[0, 0.12, 0.24].map((d, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-primary"
          animate={{ height: ["4px", "12px", "6px", "10px", "4px"] }}
          transition={{ duration: 1, repeat: Infinity, delay: d, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

const GLASS = {
  background: "hsl(0 0% 100%/0.08)",
  backdropFilter: "blur(40px)",
  WebkitBackdropFilter: "blur(40px)",
  border: "1px solid hsl(0 0% 100%/0.06)",
};

export function CarPlayMiniBar({
  coverUrl, title, artist, isPlaying, isLiveRadio,
  onExpand, onTogglePlay, onNext, onPrevious,
}: Props) {
  return (
    <motion.div
      initial={{ y: 120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 120, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="fixed bottom-0 left-0 right-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
      style={{ background: "linear-gradient(180deg, transparent 0%, hsl(0 0% 4%) 30%)" }}
    >
      <motion.div
        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer"
        style={GLASS}
        onClick={onExpand}
        whileTap={{ scale: 0.97 }}
      >
        {/* Cover */}
        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 relative" style={{ background: "hsl(0 0% 100%/0.06)" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={coverUrl}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full"
            >
              <LazyImage src={coverUrl} alt="" className="w-full h-full object-cover" fallback wrapperClassName="w-full h-full" />
            </motion.div>
          </AnimatePresence>
          {isLiveRadio && isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "hsl(0 0% 0%/0.5)" }}>
              <MiniEqualizer />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <p className="text-[15px] font-bold text-white truncate">{title || "—"}</p>
              <p className="text-[12px] text-white/40 truncate">{artist || "—"}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Controls — large touch targets */}
        <div className="flex items-center gap-1.5">
          {!isLiveRadio && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrevious(); }}
              className="p-3.5 rounded-full active:scale-90 transition-transform"
              style={{ background: "hsl(0 0% 100%/0.08)", minWidth: 48, minHeight: 48 }}
            >
              <SkipBack className="w-5 h-5 text-white" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
            className="p-4 rounded-full active:scale-90 transition-transform"
            style={{ background: "hsl(var(--primary))", minWidth: 52, minHeight: 52 }}
          >
            {isPlaying ? <Pause className="w-6 h-6 text-primary-foreground" /> : <Play className="w-6 h-6 text-primary-foreground ml-0.5" />}
          </button>
          {!isLiveRadio && (
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              className="p-3.5 rounded-full active:scale-90 transition-transform"
              style={{ background: "hsl(0 0% 100%/0.08)", minWidth: 48, minHeight: 48 }}
            >
              <SkipForward className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
