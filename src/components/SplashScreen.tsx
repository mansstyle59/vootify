import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const letters = "VOOTIFY".split("");

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onFinish, 400);
    }, 1400);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.08 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background overflow-hidden will-change-transform"
        >
          {/* Layered ambient glows */}
          <motion.div
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 0.15, scale: 1.5 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
            className="absolute w-[500px] h-[500px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--primary) / 0.6) 0%, transparent 60%)",
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 0.08, scale: 2 }}
            transition={{ duration: 2, ease: "easeOut", delay: 0.2 }}
            className="absolute w-[600px] h-[600px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(142 71% 45% / 0.4) 0%, transparent 55%)",
            }}
          />

          {/* Logo — cinematic entrance */}
          <motion.div
            initial={{ scale: 0, opacity: 0, rotateY: -30 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.05 }}
            className="relative mb-6"
          >
            {/* Glow ring behind icon */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="absolute -inset-3 rounded-[34px]"
              style={{
                background: "radial-gradient(circle, hsl(var(--primary) / 0.2) 0%, transparent 70%)",
                filter: "blur(12px)",
              }}
            />
            <div className="relative rounded-[28px] overflow-hidden shadow-2xl" style={{
              boxShadow: "0 0 60px hsl(var(--primary) / 0.3), 0 20px 40px hsl(0 0% 0% / 0.4)",
            }}>
              <img
                src="/pwa-icon-192.png"
                alt="Vootify"
                width={104}
                height={104}
                className="w-[104px] h-[104px] rounded-[28px]"
              />
            </div>
          </motion.div>

          {/* Brand name — letter by letter reveal */}
          <div className="flex items-center gap-[2px] mb-2">
            {letters.map((letter, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 20, scale: 0.5 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  delay: 0.2 + i * 0.06,
                }}
                className="text-[32px] font-display font-black tracking-[0.2em] text-primary"
                style={{
                  textShadow: "0 0 24px hsl(var(--primary) / 0.4)",
                }}
              >
                {letter}
              </motion.span>
            ))}
          </div>

          {/* Tagline — smooth fade */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 0.5, y: 0 }}
            transition={{ delay: 0.75, duration: 0.5, ease: "easeOut" }}
            className="text-[11px] font-semibold tracking-[0.35em] uppercase text-muted-foreground"
          >
            Ta musique, sans limites
          </motion.p>

          {/* Animated progress bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="absolute bottom-28 w-16 h-[2px] rounded-full bg-white/10 overflow-hidden"
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
              className="w-full h-full rounded-full bg-primary/60"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
