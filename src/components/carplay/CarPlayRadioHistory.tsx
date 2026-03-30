import { motion, AnimatePresence } from "framer-motion";
import { Clock, X } from "lucide-react";
import { RadioHistoryEntry } from "@/hooks/useRadioMetadata";
import { LazyImage } from "@/components/LazyImage";

interface Props {
  history: RadioHistoryEntry[];
  isOpen: boolean;
  onClose: () => void;
}

const LIQUID_GLASS = {
  background: "hsl(0 0% 100%/0.05)",
  backdropFilter: "blur(80px) saturate(2.2)",
  WebkitBackdropFilter: "blur(80px) saturate(2.2)",
  border: "0.5px solid hsl(0 0% 100%/0.1)",
  boxShadow: "inset 0 0.5px 0 hsl(0 0% 100%/0.12), 0 8px 32px hsl(0 0% 0%/0.3)",
};

const GLASS_BUTTON = {
  background: "hsl(0 0% 100%/0.08)",
  backdropFilter: "blur(40px) saturate(1.8)",
  WebkitBackdropFilter: "blur(40px) saturate(1.8)",
  border: "0.5px solid hsl(0 0% 100%/0.1)",
  boxShadow: "inset 0 0.5px 0 hsl(0 0% 100%/0.1)",
};

export function CarPlayRadioHistory({ history, isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[55] flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Frosted backdrop */}
        <div
          className="absolute inset-0"
          onClick={onClose}
          style={{
            background: "hsl(0 0% 0%/0.7)",
            backdropFilter: "blur(40px) saturate(1.5)",
            WebkitBackdropFilter: "blur(40px) saturate(1.5)",
          }}
        />

        <motion.div
          className="relative z-10 flex flex-col h-full"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
            <Clock className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-black text-white flex-1">Historique en direct</h2>
            <button
              onClick={onClose}
              className="p-3 rounded-2xl active:scale-90 transition-transform"
              style={{ ...GLASS_BUTTON, minWidth: 48, minHeight: 48 }}
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-4 pb-8 scrollbar-hide">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-white/25">
                <Clock className="w-10 h-10 mb-3" />
                <p className="text-base font-medium">Aucun historique</p>
                <p className="text-sm mt-1 text-white/15">Les morceaux passés apparaîtront ici</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((entry, i) => (
                  <motion.div
                    key={`${entry.title}-${i}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.05, 0.4), duration: 0.3 }}
                    className="flex items-center gap-3.5 px-3.5 py-3 rounded-2xl"
                    style={LIQUID_GLASS}
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ background: "hsl(0 0% 100%/0.06)" }}>
                      <LazyImage src={entry.coverUrl} alt="" className="w-full h-full object-cover" fallback wrapperClassName="w-full h-full" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-white truncate">{entry.title}</p>
                      <p className="text-[12px] text-white/35 truncate">{entry.artist}</p>
                    </div>
                    <span className="text-[11px] text-white/20 flex-shrink-0 tabular-nums">
                      {entry.playedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
