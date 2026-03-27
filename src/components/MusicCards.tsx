import { useState, useRef, useEffect, memo } from "react";
import { Song, formatDuration } from "@/data/mockData";
import { usePlayerStore } from "@/stores/playerStore";
import { Play, Pause, Heart, Download, CheckCircle, Loader2, ListPlus, ListEnd, Music } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { AddToPlaylistMenu } from "./AddToPlaylistMenu";
import { LongPressMenu } from "./LongPressMenu";
import { toast } from "sonner";

/** Determine the source badge type for a song */
function getSongSourceType(song: Song): "custom" | null {
  if (song.id.startsWith("custom-")) return "custom";
  return null;
}

interface SongCardProps {
  song: Song;
  index?: number;
  showIndex?: boolean;
}

export const SongCard = memo(function SongCard({ song, index, showIndex }: SongCardProps) {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const play = usePlayerStore((s) => s.play);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const toggleLike = usePlayerStore((s) => s.toggleLike);
  const isLiked = usePlayerStore((s) => s.isLiked);
  const queue = usePlayerStore((s) => s.queue);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const isCurrentSong = currentSong?.id === song.id;
  const liked = isLiked(song.id);
  const { isCached, isDownloading, progress, download } = useOfflineCache(song.id);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showPlaylistMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowPlaylistMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPlaylistMenu]);

  const sourceType = getSongSourceType(song);
  const isBlocked = false;

  const handleClick = () => {
    if (isBlocked) return;
    if (isCurrentSong) {
      togglePlay();
    } else {
      play(song);
    }
  };

  const cardContent = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index || 0) * 0.05 }}
      className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover-glass ${
        isBlocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${isCurrentSong ? "bg-primary/5 ring-1 ring-primary/10" : ""}`}
      onClick={handleClick}
    >
      {showIndex && (
        <span className="w-5 text-center text-xs text-muted-foreground tabular-nums group-hover:hidden flex-shrink-0">
          {(index || 0) + 1}
        </span>
      )}
      {showIndex && (
        <span className="w-5 text-center hidden group-hover:block flex-shrink-0">
          {isCurrentSong && isPlaying ? (
            <Pause className="w-3.5 h-3.5 text-primary mx-auto" />
          ) : (
            <Play className="w-3.5 h-3.5 text-primary mx-auto" />
          )}
        </span>
      )}

      <div className="relative w-11 h-11 flex-shrink-0">
        {song.coverUrl ? (
          <img src={song.coverUrl} alt={song.title} className="w-full h-full rounded-lg object-cover ring-1 ring-white/[0.06]" />
        ) : (
          <div className="w-full h-full rounded-lg ring-1 ring-white/[0.06] flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <Music className="w-5 h-5 text-primary/40" />
          </div>
        )}
        {!showIndex && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
            {isCurrentSong && isPlaying ? (
              <Pause className="w-4 h-4 text-primary" />
            ) : (
              <Play className="w-4 h-4 text-primary" />
            )}
          </div>
        )}
      </div>

      {/* Title + Artist — takes remaining space */}
      <div className="flex-1 min-w-0 mr-1">
        <p className={`text-sm font-semibold leading-snug truncate ${isCurrentSong ? "text-primary" : "text-foreground"}`}>
          {song.title}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
          {song.artist}{song.album ? ` · ${song.album}` : ""}
        </p>
      </div>

      {/* Action buttons — hidden on mobile, visible on desktop hover */}
      <div className="hidden md:flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleLike(song);
          }}
          className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Heart className={`w-3.5 h-3.5 ${liked ? "fill-primary text-primary" : "text-muted-foreground/60"}`} />
        </button>

        {!isBlocked && song.duration > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const newQueue = [...queue.filter((s) => s.id !== song.id), song];
              setQueue(newQueue);
              toast.success(`"${song.title}" ajouté à la file`);
            }}
            className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            title="Ajouter à la file d'attente"
          >
            <ListEnd className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary transition-colors" />
          </button>
        )}

        {song.duration > 0 && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPlaylistMenu(!showPlaylistMenu);
              }}
              className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              title="Ajouter à une playlist"
            >
              <ListPlus className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary transition-colors" />
            </button>
            <AnimatePresence>
              {showPlaylistMenu && (
                <AddToPlaylistMenu song={song} onClose={() => setShowPlaylistMenu(false)} />
              )}
            </AnimatePresence>
          </div>
        )}
        {song.streamUrl && song.duration > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isCached && !isDownloading) download(song);
            }}
            className={`p-1 rounded-full ${isCached || isDownloading ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
            title={isCached ? "Disponible hors-ligne" : isDownloading ? `${progress}%` : "Télécharger hors-ligne"}
          >
            {isCached ? (
              <CheckCircle className="w-3.5 h-3.5 text-primary" />
            ) : isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary transition-colors" />
            )}
          </button>
        )}
      </div>

      {/* Mobile: only show liked heart + cached indicator inline */}
      <div className="flex md:hidden items-center gap-0.5 flex-shrink-0">
        {liked && (
          <Heart className="w-3 h-3 fill-primary text-primary flex-shrink-0" />
        )}
        {isCached && (
          <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />
        )}
      </div>

      {/* Source badge */}
      {(() => {
        if (isCached) return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent/15 text-accent-foreground border border-accent/20 flex-shrink-0">
            Local
          </span>
        );
        if (song.id.startsWith("dz-")) return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20 flex-shrink-0">
            30s
          </span>
        );
        const sourceType = getSongSourceType(song);
        if (sourceType === "custom") return (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary/80 text-secondary-foreground border border-secondary flex-shrink-0">
            Custom
          </span>
        );
        return null;
      })()}

      <span className="text-[11px] text-muted-foreground/60 tabular-nums flex-shrink-0 ml-0.5">{formatDuration(song.duration)}</span>
    </motion.div>
  );

  // Wrap with long-press menu for music tracks
  if (song.duration > 0) {
    return <LongPressMenu song={song}>{cardContent}</LongPressMenu>;
  }
  return cardContent;
});

interface ContentCardProps {
  title: string;
  subtitle: string;
  imageUrl: string;
  onClick?: () => void;
}

export function ContentCard({ title, subtitle, imageUrl, onClick }: ContentCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      transition={{ type: "spring", stiffness: 300 }}
      className="glass-panel-light rounded-xl p-3 cursor-pointer group"
      onClick={onClick}
    >
      <div className="relative overflow-hidden rounded-lg mb-3">
        <img src={imageUrl} alt={title} className="w-full aspect-square object-cover" />
        <div className="absolute inset-0 bg-background/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <motion.div
            whileTap={{ scale: 0.9 }}
            className="w-11 h-11 rounded-full liquid-glass flex items-center justify-center shadow-xl"
            style={{ boxShadow: "0 0 20px hsl(var(--primary) / 0.3)" }}
          >
            <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
          </motion.div>
        </div>
      </div>
      <h3 className="text-sm font-semibold truncate text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
    </motion.div>
  );
}

export function SongSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2 animate-pulse">
      <div className="w-10 h-10 rounded bg-secondary" />
      <div className="flex-1">
        <div className="h-3 w-32 bg-secondary rounded mb-1.5" />
        <div className="h-2.5 w-20 bg-secondary rounded" />
      </div>
      <div className="h-3 w-8 bg-secondary rounded" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-panel-light rounded-xl p-3 animate-pulse">
      <div className="w-full aspect-square rounded-lg bg-secondary mb-3" />
      <div className="h-3 w-24 bg-secondary rounded mb-1.5" />
      <div className="h-2.5 w-16 bg-secondary rounded" />
    </div>
  );
}
