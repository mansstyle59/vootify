import { memo, useState, useRef, useCallback } from "react";
import { Pencil, Trash2, Play, Pause, Radio } from "lucide-react";
import { LazyImage } from "@/components/LazyImage";

interface RadioCardStation {
  id: string;
  name: string;
  genre?: string;
  image: string;
  streamUrl?: string;
}

interface RadioCardProps {
  station: RadioCardStation;
  isActive?: boolean;
  isPlaying?: boolean;
  onPlay?: (station: RadioCardStation) => void;
  onEdit?: (station: RadioCardStation) => void;
  onDelete?: (id: string) => void;
}

export const RadioCard = memo(function RadioCard({
  station,
  isActive = false,
  isPlaying = false,
  onPlay,
  onEdit,
  onDelete,
}: RadioCardProps) {
  const [showActions, setShowActions] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const revealActions = useCallback(() => {
    clearTimeout(hideTimer.current);
    setShowActions(true);
    if (navigator.vibrate) navigator.vibrate(10);
    hideTimer.current = setTimeout(() => setShowActions(false), 3000);
  }, []);

  const handleClick = useCallback(() => {
    if (showActions) {
      setShowActions(false);
      onPlay?.(station);
    } else {
      if ("ontouchstart" in window) {
        revealActions();
      } else {
        onPlay?.(station);
      }
    }
  }, [showActions, onPlay, station, revealActions]);

  const actionsVisible = showActions || isActive;

  return (
    <div
      className="group relative cursor-pointer active:scale-[0.97] transition-transform duration-150"
      onClick={handleClick}
    >
      {/* Image */}
      <div
        className="relative aspect-square rounded-xl overflow-hidden mb-2"
        style={{
          boxShadow: isActive
            ? "0 4px 24px hsl(var(--primary) / 0.3), 0 0 0 2px hsl(var(--primary) / 0.35)"
            : "0 2px 8px hsl(0 0% 0% / 0.08)",
        }}
      >
        {station.image ? (
          <LazyImage
            src={station.image}
            alt={station.name}
            className="w-full h-full object-cover"
            fallback
            wrapperClassName="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "hsl(var(--foreground) / 0.04)" }}>
            <Radio className="w-8 h-8 text-muted-foreground/15" />
          </div>
        )}

        {/* Overlay */}
        <div
          className={`absolute inset-0 transition-opacity duration-200 ${
            actionsVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          style={{ background: "hsl(0 0% 0% / 0.35)" }}
        />

        {/* Play button — Apple Music style bottom-right */}
        <div
          className={`absolute inset-0 flex items-end justify-end p-2 transition-opacity duration-200 ${
            actionsVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{
              background: "hsl(var(--primary))",
              boxShadow: "0 4px 16px hsl(var(--primary) / 0.4)",
            }}
          >
            {isActive && isPlaying ? (
              <Pause className="w-3.5 h-3.5 text-primary-foreground fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 text-primary-foreground fill-current ml-0.5" />
            )}
          </div>
        </div>

        {/* Live indicator */}
        {isActive && isPlaying && (
          <div
            className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{
              background: "hsl(var(--primary) / 0.85)",
              boxShadow: "0 2px 8px hsl(var(--primary) / 0.3)",
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
            <span className="text-[9px] font-bold text-primary-foreground uppercase tracking-wider">Live</span>
          </div>
        )}

        {/* Action buttons (edit + delete) */}
        {(onEdit || onDelete) && (
          <div
            className={`absolute top-2 right-2 flex gap-1.5 transition-all duration-200 ${
              actionsVisible
                ? "opacity-100 scale-100"
                : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
            }`}
          >
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActions(false);
                  onEdit(station);
                }}
                className="p-1.5 rounded-full text-white active:scale-90 transition-transform"
                style={{ background: "hsl(0 0% 0% / 0.6)", backdropFilter: "blur(8px)" }}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActions(false);
                  onDelete(station.id);
                }}
                className="p-1.5 rounded-full text-white active:scale-90 transition-transform"
                style={{ background: "hsl(var(--destructive) / 0.7)", backdropFilter: "blur(8px)" }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <h3 className={`text-[13px] font-semibold leading-tight line-clamp-1 ${isActive ? "text-primary" : "text-foreground"}`}>
        {station.name}
      </h3>
      <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5">
        {station.genre || "Radio"}
      </p>
    </div>
  );
});
