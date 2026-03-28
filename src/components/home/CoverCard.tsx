import { memo, useState } from "react";
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
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: Math.min(index * 0.03, 0.2),
        duration: 0.3,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileTap={{ scale: 0.96 }}
      className="flex-shrink-0 w-[120px] md:w-[140px] cursor-pointer group snap-start"
      onClick={onClick}
    >
      <div
        className={`relative w-[120px] h-[120px] md:w-[140px] md:h-[140px] overflow-hidden mb-2 ${
          rounded ? "rounded-full" : "rounded-2xl"
        } ${isActive ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
        style={{
          boxShadow: isActive
            ? "0 8px 28px hsl(var(--primary) / 0.35)"
            : "0 4px 20px hsl(0 0% 0% / 0.15)",
        }}
      >
        {imageUrl ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 bg-secondary/60 overflow-hidden">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
              </div>
            )}
            <img
              src={imageUrl}
              alt={title}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              className={`w-full h-full transition-all duration-300 ease-out group-hover:scale-[1.06] ${
                preserveRatio ? "object-contain p-2" : "object-cover"
              } ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/8 to-accent/5">
            <Music className="w-8 h-8 text-primary/15" />
          </div>
        )}

        {/* Hover gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        {/* Play button */}
        {(showPlay || isActive) && (
          <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}>
            <motion.div
              whileTap={{ scale: 0.85 }}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-primary"
              style={{ boxShadow: "0 4px 24px hsl(var(--primary) / 0.45)" }}
            >
              {isActive ? (
                <Pause className="w-4 h-4 text-primary-foreground fill-current" />
              ) : (
                <Play className="w-4 h-4 text-primary-foreground fill-current ml-0.5" />
              )}
            </motion.div>
          </div>
        )}
      </div>

      <h3 className={`text-[11px] md:text-[12px] font-bold leading-tight line-clamp-1 ${rounded ? "text-center" : ""} ${isActive ? "text-primary" : "text-foreground"}`}>
        {title}
      </h3>
      {subtitle && (
        <p className={`text-[10px] text-muted-foreground/45 truncate mt-0.5 font-medium ${rounded ? "text-center" : ""}`}>
          {subtitle}
        </p>
      )}
    </motion.div>
  );
});
