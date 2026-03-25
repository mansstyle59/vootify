import { useState, useRef, useEffect } from "react";
import { Song, formatDuration } from "@/data/mockData";
import { usePlayerStore } from "@/stores/playerStore";
import { Play, Pause, Heart, Download, CheckCircle, Loader2, ListPlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { AddToPlaylistMenu } from "./AddToPlaylistMenu";

/** Returns true if the song has a full-length stream (JioSaavn or custom) vs a 30s Deezer preview */
function isFullStream(song: Song): boolean {
  if (!song.streamUrl) return false;
  // Deezer previews come from cdn-preview-X.dzcdn.net
  if (song.streamUrl.includes("dzcdn.net")) return false;
  // JioSaavn or other full streams
  if (song.streamUrl.includes("saavn") || song.streamUrl.includes("jiosaavn")) return true;
  // If it's a js- prefixed song, it's full
  if (song.id.startsWith("js-")) return true;
  // Custom songs with stream URLs are full
  if (song.id.startsWith("custom-")) return true;
  // dz- prefix but non-deezer stream = resolved via JioSaavn
  if (song.id.startsWith("dz-") && !song.streamUrl.includes("dzcdn.net")) return true;
  return false;
}

interface SongCardProps {
  song: Song;
  index?: number;
  showIndex?: boolean;
}

export function SongCard({ song, index, showIndex }: SongCardProps) {
  const { currentSong, isPlaying, play, togglePlay, toggleLike, isLiked } = usePlayerStore();
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

  const handleClick = () => {
    if (isCurrentSong) {
      togglePlay();
    } else {
      play(song);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index || 0) * 0.05 }}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg hover-glass cursor-pointer ${
        isCurrentSong ? "bg-primary/5" : ""
      }`}
      onClick={handleClick}
    >
      {showIndex && (
        <span className="w-6 text-center text-sm text-muted-foreground tabular-nums group-hover:hidden">
          {(index || 0) + 1}
        </span>
      )}
      {showIndex && (
        <span className="w-6 text-center hidden group-hover:block">
          {isCurrentSong && isPlaying ? (
            <Pause className="w-4 h-4 text-primary mx-auto" />
          ) : (
            <Play className="w-4 h-4 text-primary mx-auto" />
          )}
        </span>
      )}

      <div className="relative w-10 h-10 flex-shrink-0">
        <img src={song.coverUrl} alt={song.title} className="w-full h-full rounded object-cover" />
        {!showIndex && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded opacity-0 group-hover:opacity-100 transition-opacity">
            {isCurrentSong && isPlaying ? (
              <Pause className="w-4 h-4 text-primary" />
            ) : (
              <Play className="w-4 h-4 text-primary" />
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isCurrentSong ? "text-primary" : "text-foreground"}`}>
          {song.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleLike(song);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Heart className={`w-4 h-4 ${liked ? "fill-primary text-primary" : "text-muted-foreground"}`} />
      </button>

      {/* Add to playlist */}
      {song.duration > 0 && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPlaylistMenu(!showPlaylistMenu);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            title="Ajouter à une playlist"
          >
            <ListPlus className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
          </button>
          <AnimatePresence>
            {showPlaylistMenu && (
              <AddToPlaylistMenu song={song} onClose={() => setShowPlaylistMenu(false)} />
            )}
          </AnimatePresence>
        </div>
      )}
      {/* Download / cached indicator */}
      {song.streamUrl && song.duration > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isCached && !isDownloading) download(song);
          }}
          className={isCached || isDownloading ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"}
          title={isCached ? "Disponible hors-ligne" : isDownloading ? `${progress}%` : "Télécharger hors-ligne"}
        >
          {isCached ? (
            <CheckCircle className="w-4 h-4 text-primary" />
          ) : isDownloading ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <Download className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
          )}
        </button>
      )}
      {isCached ? (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent/15 text-accent-foreground border border-accent/20" title="Disponible hors-ligne">
          Local
        </span>
      ) : song.resolvedViaCustom ? (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-secondary/80 text-secondary-foreground border border-secondary" title="Résolu via morceau custom admin">
          Custom
        </span>
      ) : isFullStream(song) ? (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20" title="Flux complet haute qualité">
          HD
        </span>
      ) : song.id.startsWith("dz-") ? (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/20" title="Aucun flux HD disponible">
          No HD
        </span>
      ) : null}

      <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(song.duration)}</span>
    </motion.div>
  );
}

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
        <div className="absolute inset-0 bg-background/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="p-3 rounded-full bg-primary text-primary-foreground glow-primary">
            <Play className="w-5 h-5 ml-0.5" />
          </div>
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
