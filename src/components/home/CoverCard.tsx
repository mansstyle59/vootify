import { memo, useState, useEffect } from "react";
import { Play, Pause, Music } from "lucide-react";
import { useOfflineCoverUrl } from "@/hooks/useOfflineCoverUrl";
import { getCachedCover, setCachedCover, isCoverLoaded, markCoverLoaded } from "@/lib/coverMemoryCache";
import { SafeImage } from "@/components/SafeImage";

interface CoverCardProps {
  title: string;
  subtitle: string;
  imageUrl: string;
  songId?: string;
  index?: number;
  isActive?: boolean;
  onClick?: () => void;
  rounded?: boolean;
  preserveRatio?: boolean;
  showPlay?: boolean;
}

export const CoverCard = memo(function CoverCard({
  title, subtitle, imageUrl, songId, index = 0, isActive = false, onClick, rounded = false, preserveRatio = false, showPlay = false,
}: CoverCardProps) {
  const cacheKey = songId || imageUrl || "";
  const memHit = cacheKey ? getCachedCover(cacheKey) : null;
  const alreadyLoaded = cacheKey ? isCoverLoaded(cacheKey) : false;

  const [imgLoaded, setImgLoaded] = useState(alreadyLoaded);
  const resolvedUrl = useOfflineCoverUrl(songId, memHit || imageUrl);

  // Store in memory cache when resolved
  useEffect(() => {
    if (resolvedUrl && cacheKey) setCachedCover(cacheKey, resolvedUrl);
  }, [resolvedUrl, cacheKey]);

  const handleLoad = () => {
    setImgLoaded(true);
    if (cacheKey) markCoverLoaded(cacheKey);
  };

  return (
    <div
      className="flex-shrink-0 w-[140px] md:w-[160px] cursor-pointer group snap-start active:scale-[0.97] transition-transform duration-150 overflow-visible"
      onClick={onClick}
    >
      <div
        className={`relative w-[140px] h-[140px] md:w-[160px] md:h-[160px] overflow-hidden mb-2.5 ${
          rounded ? "rounded-full" : "rounded-2xl"
        }`}
        style={{
          boxShadow: isActive
            ? "0 8px 28px hsl(var(--primary) / 0.3), 0 0 0 2px hsl(var(--primary) / 0.35)"
            : "0 4px 16px hsl(0 0% 0% / 0.2), 0 1px 3px hsl(0 0% 0% / 0.1)",
        }}
      >
        {resolvedUrl ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 overflow-hidden" style={{ background: "hsl(var(--foreground) / 0.04)" }}>
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
              </div>
            )}
            <SafeImage
              src={resolvedUrl}
              alt={title}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onLoad={handleLoad}
              className={`w-full h-full transition-opacity duration-200 ease-out ${
                imgLoaded ? "opacity-100" : "opacity-0"
              } ${
                preserveRatio ? "object-contain p-2" : "object-cover"
              }`}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "hsl(var(--foreground) / 0.04)" }}>
            <Music className="w-8 h-8 text-muted-foreground/15" />
          </div>
        )}

        {/* Play button overlay — glass style */}
        {(showPlay || isActive) && (
          <div className={`absolute inset-0 flex items-end justify-end p-2 transition-opacity duration-200 ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{
                background: "linear-gradient(145deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))",
                backdropFilter: "blur(12px)",
                boxShadow: "0 4px 16px hsl(var(--primary) / 0.4), inset 0 0.5px 0 hsl(0 0% 100% / 0.15)",
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
        <p className={`text-[11px] truncate mt-0.5 ${rounded ? "text-center" : ""}`} style={{ color: "hsl(var(--muted-foreground) / 0.45)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
});
