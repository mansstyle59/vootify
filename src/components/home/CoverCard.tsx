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
        delay: Math.min(index * 0.04, 0.3),
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileTap={{ scale: 0.96 }}
      className="flex-shrink-0 w-[128px] md:w-[148px] cursor-pointer group snap-start"
      onClick={onClick}
    >
      <div className={`relative w-[128px] h-[128px] md:w-[148px] md:h-[148px] overflow-hidden mb-2.5 ${
        rounded ? "rounded-full" : "rounded-2xl"
      } ${isActive ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
        style={{
          boxShadow: isActive
            ? "0 8px 30px hsl(var(--primary) / 0.35), 0 0 0 1px hsl(var(--primary) / 0.15)"
            : "0 6px 24px hsl(0 0% 0% / 0.25), 0 2px 8px hsl(0 0% 0% / 0.15), inset 0 1px 0 hsl(0 0% 100% / 0.05)",
        }}
      >
        {imageUrl ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 bg-secondary overflow-hidden">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              </div>
            )}
            <img
              src={imageUrl}
              alt={title}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              className={`w-full h-full transition-all duration-500 ease-out will-change-transform group-hover:scale-[1.08] group-active:scale-[1.03] ${
                preserveRatio ? "object-contain p-2" : "object-cover"
              } ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 via-primary/8 to-accent/10">
            <Music className="w-10 h-10 text-primary/25" />
          </div>
        )}

        {/* Gradient overlay for hover depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Play button — visible on hover/active */}
        {(showPlay || isActive) && (
          <div className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}>
            <motion.div
              whileTap={{ scale: 0.85 }}
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: "hsl(var(--primary) / 0.9)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 4px 24px hsl(var(--primary) / 0.5), 0 0 40px hsl(var(--primary) / 0.2)",
              }}
            >
              {isActive ? (
                <Pause className="w-5 h-5 text-primary-foreground fill-current" />
              ) : (
                <Play className="w-5 h-5 text-primary-foreground fill-current ml-0.5" />
              )}
            </motion.div>
          </div>
        )}
      </div>

      <h3 className={`text-[12px] md:text-[13px] font-semibold leading-tight line-clamp-2 ${rounded ? "text-center" : ""} ${isActive ? "text-primary" : "text-foreground"}`}>
        {title}
      </h3>
      <p className={`text-[10px] md:text-[11px] text-muted-foreground/60 truncate mt-0.5 ${rounded ? "text-center" : ""}`}>
        {subtitle}
      </p>
    </motion.div>
  );
});
