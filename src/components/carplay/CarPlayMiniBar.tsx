import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
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

const LIQUID_GLASS = {
  background: "hsl(0 0% 100%/0.07)",
  backdropFilter: "blur(80px) saturate(2.2)",
  WebkitBackdropFilter: "blur(80px) saturate(2.2)",
  border: "0.5px solid hsl(0 0% 100%/0.12)",
  boxShadow: "inset 0 0.5px 0 hsl(0 0% 100%/0.15), inset 0 -0.5px 0 hsl(0 0% 0%/0.1), 0 12px 40px hsl(0 0% 0%/0.4)",
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
      className="fixed bottom-0 left-0 right-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 z-[51]"
      style={{ background: "linear-gradient(180deg, transparent 0%, hsl(0 0% 0%/0.6) 40%)" }}
    >
      <motion.div
        className="flex items-center gap-3 px-4 py-3 rounded-[20px] cursor-pointer"
        style={LIQUID_GLASS}
        onClick={onExpand}
        whileTap={{ scale: 0.97 }}
      >
        {/* Cover */}
        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 relative" style={{ background: "hsl(0 0% 100%/0.06)" }}>
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
              <p className="text-[14px] font-bold text-white truncate">{title || "—"}</p>
              <p className="text-[11px] text-white/40 truncate">{artist || "—"}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {!isLiveRadio && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrevious(); }}
              className="p-2.5 rounded-full active:scale-90 transition-transform"
              style={{ background: "hsl(0 0% 100%/0.08)", minWidth: 44, minHeight: 44 }}
            >
              <SkipBack className="w-4.5 h-4.5 text-white" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
            className="p-3 rounded-full active:scale-90 transition-transform"
            style={{
              background: "hsl(var(--primary))",
              boxShadow: "0 4px 20px hsl(var(--primary)/0.3)",
              minWidth: 48, minHeight: 48,
            }}
          >
            {isPlaying ? <Pause className="w-5 h-5 text-primary-foreground" /> : <Play className="w-5 h-5 text-primary-foreground ml-0.5" />}
          </button>
          {!isLiveRadio && (
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              className="p-2.5 rounded-full active:scale-90 transition-transform"
              style={{ background: "hsl(0 0% 100%/0.08)", minWidth: 44, minHeight: 44 }}
            >
              <SkipForward className="w-4.5 h-4.5 text-white" />
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
