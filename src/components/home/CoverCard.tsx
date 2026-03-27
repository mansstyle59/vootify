import { memo, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
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
  const [tapped, setTapped] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleTap = useCallback(() => {
    if (tapped) return;
    setTapped(true);
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTapped(false), 2500);
  }, [tapped]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: Math.min(index * 0.04, 0.3),
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileTap={{ scale: 0.96 }}
      className="flex-shrink-0 w-[120px] cursor-pointer group snap-start"
      onClick={onClick}
      onTouchStart={showPlay && !isActive ? handleTap : undefined}
    >
      <div className={`relative w-[120px] h-[120px] overflow-hidden mb-1.5 ${
        rounded ? "rounded-full" : "rounded-xl"
      } ${isActive ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
        style={{
          boxShadow: isActive
            ? "0 6px 24px hsl(var(--primary) / 0.3)"
            : "0 3px 12px hsl(0 0% 0% / 0.18), 0 1px 3px hsl(0 0% 0% / 0.1)",
        }}
      >
        {imageUrl ? (
          <>
            {/* Blur placeholder */}
            {!imgLoaded && (
              <div className="absolute inset-0 bg-secondary animate-pulse" />
            )}
            <img
              src={imageUrl}
              alt={title}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              className={`w-full h-full transition-transform duration-500 ease-out will-change-transform group-hover:scale-[1.08] group-active:scale-[1.03] ${
                preserveRatio ? "object-contain p-2" : "object-cover"
              } ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
            <Music className="w-9 h-9 text-primary/25" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent transition-opacity duration-200 ${
          tapped || isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`} />

        {/* Play button */}
        {(showPlay || isActive) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={false}
              animate={{
                scale: isActive || tapped ? 1 : 0.7,
                opacity: isActive || tapped ? 1 : 0,
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-primary shadow-lg group-hover:opacity-100 group-hover:scale-100"
              style={{
                boxShadow: "0 4px 20px hsl(var(--primary) / 0.45)",
              }}
            >
              {isActive ? (
                <Pause className="w-4.5 h-4.5 text-primary-foreground fill-current" />
              ) : (
                <Play className="w-4.5 h-4.5 text-primary-foreground fill-current ml-0.5" />
              )}
            </motion.div>
          </div>
        )}
      </div>

      <h3 className={`text-[13px] font-semibold truncate leading-tight ${rounded ? "text-center" : ""} ${isActive ? "text-primary" : "text-foreground"}`}>
        {title}
      </h3>
      <p className={`text-[11px] text-muted-foreground/70 truncate mt-0.5 ${rounded ? "text-center" : ""}`}>
        {subtitle}
      </p>
    </motion.div>
  );
});
