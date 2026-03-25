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
}

export function CoverCard({
  title, subtitle, imageUrl, index = 0, isActive = false, onClick, rounded = false,
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
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-colors" />
        <div className={`absolute bottom-2 right-2 w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-xl transition-all ${
          isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0"
        }`}>
          {isActive ? (
            <Pause className="w-4 h-4 text-primary-foreground" />
          ) : (
            <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
          )}
        </div>
      </div>
      <h3 className={`text-sm font-semibold truncate ${rounded ? "text-center" : ""} ${isActive ? "text-primary" : "text-foreground"}`}>{title}</h3>
      <p className={`text-xs text-muted-foreground truncate ${rounded ? "text-center" : ""}`}>{subtitle}</p>
    </motion.div>
  );
}
