import { motion } from "framer-motion";
import { Play, Pause } from "lucide-react";

interface CoverCardProps {
  title: string;
  subtitle: string;
  imageUrl: string;
  index?: number;
  isActive?: boolean;
  onClick?: () => void;
  rounded?: boolean;
  /** Keep original aspect ratio for logos (no forced crop) */
  preserveRatio?: boolean;
}

export function CoverCard({
  title, subtitle, imageUrl, index = 0, isActive = false, onClick, rounded = false, preserveRatio = false,
}: CoverCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex-shrink-0 w-40 cursor-pointer group"
      onClick={onClick}
    >
      <div className={`relative w-40 h-40 overflow-hidden mb-2 bg-secondary ${rounded ? "rounded-full" : "rounded-xl"}`}>
        <img
          src={imageUrl}
          alt={title}
          className={`w-full h-full transition-transform duration-300 group-hover:scale-105 ${
            preserveRatio ? "object-contain p-2" : "object-cover"
          }`}
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-background/0 group-hover:bg-background/30 transition-colors duration-300" />
        {/* Centered liquid glass play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={false}
            whileTap={{ scale: 0.9 }}
            className={`w-11 h-11 rounded-full liquid-glass flex items-center justify-center shadow-xl transition-all duration-300 ${
              isActive
                ? "opacity-100 scale-100"
                : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
            }`}
            style={{ boxShadow: isActive ? "0 0 20px hsl(var(--primary) / 0.4)" : undefined }}
          >
            {isActive ? (
              <Pause className="w-5 h-5 text-primary-foreground" />
            ) : (
              <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
            )}
          </motion.div>
        </div>
      </div>
      <h3 className={`text-sm font-semibold truncate ${rounded ? "text-center" : ""} ${isActive ? "text-primary" : "text-foreground"}`}>{title}</h3>
      <p className={`text-xs text-muted-foreground truncate ${rounded ? "text-center" : ""}`}>{subtitle}</p>
    </motion.div>
  );
}
