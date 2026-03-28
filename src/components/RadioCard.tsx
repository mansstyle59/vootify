import { memo } from "react";
import { Pencil, Trash2, Play, Pause } from "lucide-react";
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
  return (
    <div
      className="group relative rounded-2xl overflow-hidden bg-secondary p-3 cursor-pointer transition-shadow duration-200 hover:shadow-lg"
      onClick={() => onPlay?.(station)}
    >
      {/* Image / Logo */}
      <div
        className={`relative aspect-square rounded-xl overflow-hidden ring-[1.5px] transition-all duration-300 ${
          isActive
            ? "ring-primary shadow-md shadow-primary/20"
            : "ring-border/20"
        }`}
      >
        <LazyImage
          src={station.image}
          alt={station.name}
          className="w-full h-full object-cover"
          fallback
          wrapperClassName="w-full h-full"
        />

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        {/* Play/Pause center button */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
            isActive
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <div
            className="w-11 h-11 rounded-full bg-primary flex items-center justify-center shadow-xl"
            style={{ boxShadow: "0 4px 20px hsl(var(--primary) / 0.45)" }}
          >
            {isActive && isPlaying ? (
              <Pause className="w-5 h-5 text-primary-foreground fill-current" />
            ) : (
              <Play className="w-5 h-5 text-primary-foreground fill-current ml-0.5" />
            )}
          </div>
        </div>

        {/* Action buttons (edit + delete) */}
        {(onEdit || onDelete) && (
          <div className="absolute top-2 right-2 flex gap-2 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(station);
                }}
                className="bg-black/70 hover:bg-black text-white p-2 rounded-full transition-colors"
              >
                <Pencil size={16} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(station.id);
                }}
                className="bg-black/70 hover:bg-destructive text-white p-2 rounded-full transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-3">
        <h3
          className={`font-semibold text-sm truncate ${
            isActive ? "text-primary" : "text-foreground"
          }`}
        >
          {station.name}
        </h3>
        <p className="text-muted-foreground text-xs truncate mt-0.5">
          {station.genre || "Radio"}
        </p>
      </div>
    </div>
  );
});
