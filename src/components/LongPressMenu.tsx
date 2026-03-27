import { useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { Song } from "@/data/mockData";
import { usePlayerStore } from "@/stores/playerStore";
import { Play, ListEnd, ListPlus, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { AddToPlaylistMenu } from "./AddToPlaylistMenu";

interface LongPressMenuProps {
  song: Song;
  children: ReactNode;
}

export function LongPressMenu({ song, children }: LongPressMenuProps) {
  const [open, setOpen] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [showPlaylistSub, setShowPlaylistSub] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const didLongPressRef = useRef(false);
  const { play, queue, setQueue, toggleLike, isLiked } = usePlayerStore();
  const liked = isLiked(song.id);

  const startPress = useCallback(() => {
    didLongPressRef.current = false;
    setPressing(true);
    timerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      setPressing(false);
      setOpen(true);
      if (navigator.vibrate) navigator.vibrate(15);
    }, 500);
  }, []);

  const cancelPress = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPressing(false);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowPlaylistSub(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler as any);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler as any);
    };
  }, [open]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const actions = [
    {
      icon: Play,
      label: "Lire maintenant",
      action: () => {
        play(song);
        setQueue([song, ...queue.filter((s) => s.id !== song.id)]);
        setOpen(false);
      },
    },
    {
      icon: ListEnd,
      label: "Ajouter à la file",
      action: () => {
        setQueue([...queue.filter((s) => s.id !== song.id), song]);
        toast.success(`"${song.title}" ajouté à la file`);
        setOpen(false);
      },
    },
    {
      icon: ListPlus,
      label: "Ajouter à une playlist",
      action: () => setShowPlaylistSub(true),
    },
    {
      icon: Heart,
      label: liked ? "Retirer des favoris" : "Ajouter aux favoris",
      active: liked,
      action: () => {
        toggleLike(song);
        if (navigator.vibrate) navigator.vibrate(10);
        setOpen(false);
      },
    },
  ];

  return (
    <div className="relative">
      <div
        onTouchStart={startPress}
        onTouchEnd={(e) => {
          cancelPress();
          if (didLongPressRef.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onTouchCancel={cancelPress}
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        onClick={(e) => {
          if (didLongPressRef.current) {
            e.preventDefault();
            e.stopPropagation();
            didLongPressRef.current = false;
          }
        }}
        className={`rounded-xl ${pressing ? "bg-primary/[0.06]" : ""}`}
        style={{
          transform: pressing ? "scale(0.96)" : "scale(1)",
          transition: pressing
            ? "transform 0.5s cubic-bezier(0.2, 0, 0.2, 1), background-color 0.3s ease"
            : "transform 0.15s ease-out, background-color 0.15s ease-out",
        }}
      >
        {children}
      </div>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-black/50"
              style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
              onClick={() => { setOpen(false); setShowPlaylistSub(false); }}
            />

            {/* Menu */}
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="fixed left-4 right-4 z-[201] rounded-2xl overflow-hidden"
              style={{
                bottom: "calc(env(safe-area-inset-bottom, 20px) + 80px)",
                background: "hsl(240 8% 14% / 0.7)",
                backdropFilter: "blur(60px) saturate(1.6)",
                WebkitBackdropFilter: "blur(60px) saturate(1.6)",
                border: "1px solid hsl(0 0% 100% / 0.1)",
                boxShadow: "0 25px 80px rgba(0,0,0,0.6), inset 0 1px 0 hsl(0 0% 100% / 0.08)",
              }}
            >
              {/* Header with cover */}
              <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
                {song.coverUrl ? (
                  <img
                    src={song.coverUrl}
                    alt={song.title}
                    loading="lazy"
                    decoding="async"
                    className="w-12 h-12 rounded-xl object-cover shadow-lg"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg">
                    <Music className="w-5 h-5 text-primary/40" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground truncate">{song.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="p-1.5">
                {showPlaylistSub ? (
                  <div className="relative">
                    <AddToPlaylistMenu
                      song={song}
                      onClose={() => { setShowPlaylistSub(false); setOpen(false); }}
                    />
                  </div>
                ) : (
                  actions.map((item, i) => (
                    <motion.button
                      key={item.label}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={item.action}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors active:scale-[0.98] active:bg-white/10 hover:bg-white/[0.06]"
                    >
                      <item.icon
                        className={`w-5 h-5 ${
                          item.active ? "fill-primary text-primary" : "text-foreground/70"
                        }`}
                      />
                      <span className="text-[14px] font-medium text-foreground">{item.label}</span>
                    </motion.button>
                  ))
                )}
              </div>

              {/* Cancel */}
              <div className="p-1.5 pt-0">
                <button
                  onClick={() => { setOpen(false); setShowPlaylistSub(false); }}
                  className="w-full py-3 rounded-xl text-center text-sm font-semibold text-muted-foreground hover:bg-white/[0.06] active:scale-[0.98] transition-all"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
