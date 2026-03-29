import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Song, formatDuration } from "@/data/mockData";
import { usePlayerStore } from "@/stores/playerStore";
import { Play, Pause, Heart, Download, CheckCircle, Loader2, ListEnd, Music } from "lucide-react";
import { LazyImage } from "./LazyImage";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { useOfflineCoverUrl } from "@/hooks/useOfflineCoverUrl";
import { toast } from "sonner";

interface SongCardProps {
  song: Song;
  index?: number;
  showIndex?: boolean;
}

export const SongCard = memo(function SongCard({ song, index, showIndex }: SongCardProps) {
  const navigate = useNavigate();
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
  const resolvedCover = useOfflineCoverUrl(song.id, song.coverUrl);

  const handleClick = () => {
    if (isCurrentSong) {
      togglePlay();
    } else {
      play(song);
    }
  };

  return (
    <div
      className="group flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all duration-150 active:scale-[0.98]"
      style={{
        background: isCurrentSong ? "hsl(var(--primary) / 0.05)" : "transparent",
        boxShadow: isCurrentSong ? "inset 0 0 0 1px hsl(var(--primary) / 0.12)" : "none",
      }}
      onClick={handleClick}
    >
      {showIndex && (
        <div className="w-6 flex-shrink-0 flex items-center justify-center">
          {isCurrentSong && isPlaying ? (
            <div className="flex items-end gap-[2px] h-3.5">
              <div className="w-[2px] rounded-full bg-primary animate-equalizer-1" />
              <div className="w-[2px] rounded-full bg-primary animate-equalizer-2" />
              <div className="w-[2px] rounded-full bg-primary animate-equalizer-3" />
            </div>
          ) : (
            <span className={`text-[11px] tabular-nums font-medium ${isCurrentSong ? "text-primary" : "text-muted-foreground/40"}`}>
              {(index || 0) + 1}
            </span>
          )}
        </div>
      )}

      {/* Cover */}
      <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0"
        style={{
          boxShadow: isCurrentSong
            ? "0 4px 16px hsl(var(--primary) / 0.15), 0 0 0 1px hsl(var(--primary) / 0.15)"
            : "0 2px 8px hsl(0 0% 0% / 0.08)",
        }}
      >
        <LazyImage
          src={resolvedCover}
          alt={song.title}
          className="w-full h-full object-cover"
          wrapperClassName="w-full h-full"
        />
        {!showIndex && (
          <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${
            isCurrentSong ? "bg-black/20 opacity-100" : "bg-black/25 opacity-0 group-hover:opacity-100"
          }`}>
            {isCurrentSong && isPlaying ? (
              <Pause className="w-3.5 h-3.5 text-white" />
            ) : (
              <Play className="w-3.5 h-3.5 text-white ml-0.5" />
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-[12px] font-bold leading-tight truncate ${isCurrentSong ? "text-primary" : "text-foreground"}`}>
          {song.title}
        </p>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5 truncate font-medium">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/artist/${encodeURIComponent(song.artist.split(",")[0].trim())}`); }}
            className="hover:text-primary hover:underline transition-colors"
          >
            {song.artist}
          </button>
          {song.album && (
            <>
              {" · "}
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/album/by-name?artist=${encodeURIComponent(song.artist.split(",")[0].trim())}&album=${encodeURIComponent(song.album)}`); }}
                className="hover:text-primary hover:underline transition-colors"
              >
                {song.album}
              </button>
            </>
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleLike(song);
            if (navigator.vibrate) navigator.vibrate(8);
          }}
          className="p-1.5 rounded-full transition-transform active:scale-90"
        >
          <Heart className={`w-3.5 h-3.5 transition-all ${liked ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
        </button>

        {song.duration > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const newQueue = [...queue.filter((s) => s.id !== song.id), song];
              setQueue(newQueue);
              toast.success(`"${song.title}" ajouté à la file`);
              if (navigator.vibrate) navigator.vibrate(8);
            }}
            className="p-1.5 rounded-full transition-transform active:scale-90"
          >
            <ListEnd className="w-3.5 h-3.5 text-muted-foreground/30" />
          </button>
        )}

        {song.streamUrl && song.duration > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isCached && !isDownloading) {
                download(song);
                if (navigator.vibrate) navigator.vibrate(8);
              }
            }}
            className="p-1.5 rounded-full transition-transform active:scale-90"
          >
            {isCached ? (
              <CheckCircle className="w-3.5 h-3.5 text-primary" />
            ) : isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 text-muted-foreground/30" />
            )}
          </button>
        )}
      </div>

      <span className="text-[10px] text-muted-foreground/35 tabular-nums flex-shrink-0 font-medium">
        {formatDuration(song.duration)}
      </span>
    </div>
  );
});

interface ContentCardProps {
  title: string;
  subtitle: string;
  imageUrl: string;
  onClick?: () => void;
}

export function ContentCard({ title, subtitle, imageUrl, onClick }: ContentCardProps) {
  return (
    <div
      className="rounded-2xl p-3 cursor-pointer group transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background: "hsl(var(--card) / 0.35)",
        backdropFilter: "blur(20px) saturate(1.6)",
        border: "1px solid hsl(var(--border) / 0.08)",
        boxShadow: "0 2px 12px hsl(0 0% 0% / 0.06), inset 0 1px 0 hsl(0 0% 100% / 0.02)",
      }}
      onClick={onClick}
    >
      <div className="relative overflow-hidden rounded-xl mb-2.5">
        <LazyImage src={imageUrl} alt={title} className="w-full aspect-square object-cover transition-transform duration-300 group-hover:scale-[1.06]" />
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ background: "linear-gradient(to top, hsl(0 0% 0% / 0.4), transparent)" }}
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              background: "hsl(var(--primary))",
              boxShadow: "0 4px 20px hsl(var(--primary) / 0.4)",
            }}
          >
            <Play className="w-4 h-4 text-primary-foreground fill-current ml-0.5" />
          </div>
        </div>
      </div>
      <h3 className="text-[12px] font-bold truncate text-foreground">{title}</h3>
      <p className="text-[10px] text-muted-foreground/40 truncate mt-0.5 font-medium">{subtitle}</p>
    </div>
  );
}

export function SongSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
      <div className="w-11 h-11 rounded-xl" style={{ background: "hsl(var(--secondary) / 0.3)" }} />
      <div className="flex-1">
        <div className="h-3 w-28 rounded mb-1.5" style={{ background: "hsl(var(--secondary) / 0.3)" }} />
        <div className="h-2.5 w-20 rounded" style={{ background: "hsl(var(--secondary) / 0.2)" }} />
      </div>
      <div className="h-2.5 w-8 rounded" style={{ background: "hsl(var(--secondary) / 0.2)" }} />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl p-3 animate-pulse" style={{ background: "hsl(var(--card) / 0.25)", border: "1px solid hsl(var(--border) / 0.06)" }}>
      <div className="w-full aspect-square rounded-xl mb-2.5" style={{ background: "hsl(var(--secondary) / 0.3)" }} />
      <div className="h-3 w-20 rounded mb-1.5" style={{ background: "hsl(var(--secondary) / 0.3)" }} />
      <div className="h-2.5 w-14 rounded" style={{ background: "hsl(var(--secondary) / 0.2)" }} />
    </div>
  );
}
