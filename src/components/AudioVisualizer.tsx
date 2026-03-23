import { motion } from "framer-motion";

interface AudioVisualizerProps {
  isPlaying: boolean;
}

export function AudioVisualizer({ isPlaying }: AudioVisualizerProps) {
  const bars = 32;

  return (
    <div className="flex items-end justify-center gap-[2px] h-12 w-full max-w-md">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className="w-1.5 rounded-full bg-primary/60"
          animate={
            isPlaying
              ? {
                  height: [
                    `${8 + Math.random() * 12}px`,
                    `${20 + Math.random() * 28}px`,
                    `${6 + Math.random() * 16}px`,
                    `${15 + Math.random() * 30}px`,
                  ],
                  opacity: [0.4, 0.9, 0.5, 0.8],
                }
              : { height: "4px", opacity: 0.3 }
          }
          transition={
            isPlaying
              ? {
                  duration: 0.8 + Math.random() * 0.6,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                  delay: i * 0.03,
                }
              : { duration: 0.4 }
          }
        />
      ))}
    </div>
  );
}
