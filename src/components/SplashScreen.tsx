import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const letters = "VOOTIFY".split("");

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onFinish, 600);
    }, 2200);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background overflow-hidden"
        >
          {/* Ambient glow rings */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.15, scale: 1.2 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
            className="absolute w-[500px] h-[500px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, transparent 70%)",
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 0.08, scale: 1.5 }}
            transition={{ duration: 2.2, ease: "easeOut", delay: 0.2 }}
            className="absolute w-[700px] h-[700px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, transparent 65%)",
            }}
          />

          {/* Logo */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 18, delay: 0.1 }}
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
                  delay: 0.5 + i * 0.08,
                  type: "spring",
                  stiffness: 300,
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
            transition={{ delay: 1.2, duration: 0.5 }}
            className="mt-3 text-xs font-medium tracking-[0.25em] uppercase text-muted-foreground"
          >
            Your music, elevated
          </motion.p>

          {/* Animated loading bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="absolute bottom-24 w-32 h-[3px] rounded-full bg-muted overflow-hidden"
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
              className="h-full w-1/2 rounded-full bg-primary/60"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
