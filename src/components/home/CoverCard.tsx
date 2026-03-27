import { memo } from "react";
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
}

export const CoverCard = memo(function CoverCard({
  title, subtitle, imageUrl, index = 0, isActive = false, onClick, rounded = false, preserveRatio = false,
}: CoverCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, type: "spring", stiffness: 260, damping: 24 }}
      whileTap={{ scale: 0.95 }}
      className="flex-shrink-0 w-40 cursor-pointer group"
      onClick={onClick}
    >
      <div className={`relative w-40 h-40 overflow-hidden mb-2.5 bg-secondary shadow-lg ${
        rounded ? "rounded-full" : "rounded-2xl"
      } ${isActive ? "ring-2 ring-primary/50 ring-offset-2 ring-offset-background" : ""}`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            className={`w-full h-full transition-all duration-500 group-hover:scale-110 ${
              preserveRatio ? "object-contain p-2" : "object-cover"
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <Music className="w-10 h-10 text-primary/30" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={false}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
              isActive
                ? "opacity-100 scale-100 bg-primary glow-primary"
                : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 liquid-glass"
            }`}
          >
            {isActive ? (
              <Pause className="w-5 h-5 text-primary-foreground" />
            ) : (
              <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
            )}
          </motion.div>
        </div>
      </div>
      <h3 className={`text-sm font-bold truncate leading-tight ${rounded ? "text-center" : ""} ${isActive ? "text-primary" : "text-foreground"}`}>
        {title}
      </h3>
      <p className={`text-xs text-muted-foreground truncate mt-0.5 ${rounded ? "text-center" : ""}`}>
        {subtitle}
      </p>
    </motion.div>
  );
});
