import { memo, useState } from "react";
import { Play, Pause, Music } from "lucide-react";

interface CoverCardProps {
  title: string;
  subtitle: string;
  imageUrl: string;
  index?: number;
  isActive?: boolean;
  onClick?: () => void;
  rounded?: boolean;
  preserveRatio?: boolean;
  showPlay?: boolean;
}

export const CoverCard = memo(function CoverCard({
  title, subtitle, imageUrl, index = 0, isActive = false, onClick, rounded = false, preserveRatio = false, showPlay = false,
}: CoverCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div
      className="flex-shrink-0 w-[140px] md:w-[160px] cursor-pointer group snap-start active:scale-[0.97] transition-transform duration-150"
      onClick={onClick}
    >
      <div
        className={`relative w-[140px] h-[140px] md:w-[160px] md:h-[160px] overflow-hidden mb-2 ${
          rounded ? "rounded-full" : "rounded-xl"
        }`}
        style={{
          boxShadow: isActive
            ? "0 4px 24px hsl(var(--primary) / 0.3), 0 0 0 2px hsl(var(--primary) / 0.35)"
            : "0 2px 8px hsl(0 0% 0% / 0.08)",
        }}
      >
        {imageUrl ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 overflow-hidden" style={{ background: "hsl(var(--foreground) / 0.04)" }}>
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
              </div>
            )}
            <img
              src={imageUrl}
              alt={title}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              className={`w-full h-full transition-transform duration-300 ease-out group-hover:scale-105 ${
                preserveRatio ? "object-contain p-2" : "object-cover"
              } ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "hsl(var(--foreground) / 0.04)" }}>
            <Music className="w-8 h-8 text-muted-foreground/15" />
          </div>
        )}

        {/* Play button */}
        {(showPlay || isActive) && (
          <div className={`absolute inset-0 flex items-end justify-end p-2 transition-opacity duration-200 ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{
                background: "hsl(var(--primary))",
                boxShadow: "0 4px 16px hsl(var(--primary) / 0.4)",
              }}
            >
              {isActive ? (
                <Pause className="w-3.5 h-3.5 text-primary-foreground fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 text-primary-foreground fill-current ml-0.5" />
              )}
            </div>
          </div>
        )}
      </div>

      <h3 className={`text-[13px] font-semibold leading-tight line-clamp-1 ${rounded ? "text-center" : ""} ${isActive ? "text-primary" : "text-foreground"}`}>
        {title}
      </h3>
      {subtitle && (
        <p className={`text-[11px] text-muted-foreground/50 truncate mt-0.5 ${rounded ? "text-center" : ""}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
});
