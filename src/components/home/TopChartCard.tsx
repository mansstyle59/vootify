import { Song, formatDuration } from "@/data/mockData";
import { usePlayerStore } from "@/stores/playerStore";
import { Play, Pause } from "lucide-react";
import { motion } from "framer-motion";

interface TopChartCardProps {
  song: Song;
  rank: number;
  onClick: () => void;
}

export function TopChartCard({ song, rank, onClick }: TopChartCardProps) {
  const { currentSong, isPlaying } = usePlayerStore();
  const isActive = currentSong?.id === song.id;

  const rankColors = [
    "from-primary to-primary/60",      // #1
    "from-primary/80 to-primary/40",    // #2
    "from-primary/60 to-primary/30",    // #3
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.04 }}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer group transition-colors rounded-lg ${
        isActive ? "bg-primary/10" : "hover:bg-secondary/50"
      }`}
    >
      {/* Rank number */}
      <div className="w-9 flex-shrink-0 text-center">
        {rank <= 3 ? (
          <span
            className={`text-2xl font-black bg-gradient-to-b ${rankColors[rank - 1]} bg-clip-text text-transparent`}
          >
            {rank}
          </span>
        ) : (
          <span className="text-lg font-bold text-muted-foreground/60">
            {rank}
          </span>
        )}
      </div>

      {/* Cover */}
      <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden shadow-md">
        <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity">
          {isActive && isPlaying ? (
            <Pause className="w-4 h-4 text-primary" />
          ) : (
            <Play className="w-4 h-4 text-primary ml-0.5" />
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${isActive ? "text-primary" : "text-foreground"}`}>
          {song.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
      </div>

      {/* Duration */}
      <span className="text-xs text-muted-foreground tabular-nums hidden sm:block">
        {formatDuration(song.duration)}
      </span>

      {/* Active indicator */}
      {isActive && isPlaying && (
        <div className="flex items-end gap-[2px] h-3">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-[3px] rounded-full bg-primary"
              animate={{ height: ["4px", "12px", "4px"] }}
              transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
