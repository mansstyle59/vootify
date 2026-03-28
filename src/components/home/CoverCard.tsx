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
        }`}
        style={{
          boxShadow: isActive
            ? "0 8px 28px hsl(var(--primary) / 0.35), 0 0 0 2px hsl(var(--primary) / 0.4)"
            : "0 4px 16px hsl(0 0% 0% / 0.12)",
        }}
      >
        {imageUrl ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 overflow-hidden" style={{ background: "hsl(var(--secondary) / 0.5)" }}>
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
              </div>
            )}
            <img
              src={imageUrl}
              alt={title}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              className={`w-full h-full transition-all duration-500 ease-out group-hover:scale-[1.08] ${
                preserveRatio ? "object-contain p-2" : "object-cover"
              } ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--accent) / 0.05))" }}>
            <Music className="w-8 h-8 text-primary/15" />
          </div>
        )}

        {/* Bottom gradient overlay */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: "linear-gradient(to top, hsl(0 0% 0% / 0.5), transparent)" }}
        />

        {/* Play button */}
        {(showPlay || isActive) && (
          <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-250 ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}>
            <motion.div
              whileTap={{ scale: 0.85 }}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: "hsl(var(--primary))",
                boxShadow: "0 4px 20px hsl(var(--primary) / 0.45), inset 0 1px 0 hsl(0 0% 100% / 0.15)",
              }}
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
        <p className={`text-[10px] text-muted-foreground/40 truncate mt-0.5 font-medium ${rounded ? "text-center" : ""}`}>
          {subtitle}
        </p>
      )}
    </motion.div>
  );
});
