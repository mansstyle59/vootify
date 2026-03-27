import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const letters = "VOOTIFY".split("");

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Shorter splash — 1.6s instead of 2.2s
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onFinish, 400); // Faster exit
    }, 1600);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background overflow-hidden will-change-transform"
        >
          {/* Ambient glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.15, scale: 1.2 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute w-[500px] h-[500px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, transparent 70%)",
            }}
          />

          {/* Logo */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.05 }}
            className="relative mb-6"
          >
            <motion.div
              animate={{ boxShadow: [
                "0 0 30px hsl(var(--primary) / 0.3)",
                "0 0 60px hsl(var(--primary) / 0.5)",
                "0 0 30px hsl(var(--primary) / 0.3)",
              ]}}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="rounded-[26px] overflow-hidden"
            >
              <img
                src="/pwa-icon-512.png"
                alt="Vootify"
                className="w-28 h-28 rounded-[26px]"
                fetchPriority="high"
              />
            </motion.div>
          </motion.div>

          {/* Letter-by-letter title */}
          <div className="flex items-center gap-[2px]">
            {letters.map((letter, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 20, scale: 0.5 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: 0.3 + i * 0.06,
                  type: "spring",
                  stiffness: 350,
                  damping: 20,
                }}
                className="text-4xl font-display font-black tracking-[0.3em] text-primary"
              >
                {letter}
              </motion.span>
            ))}
          </div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 0.5, y: 0 }}
            transition={{ delay: 0.8, duration: 0.4 }}
            className="mt-3 text-xs font-medium tracking-[0.25em] uppercase text-muted-foreground"
          >
            Ta musique, sans limites
          </motion.p>

          {/* Loading bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="absolute bottom-24 w-32 h-[3px] rounded-full bg-muted overflow-hidden"
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="h-full w-1/2 rounded-full bg-primary/60"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
