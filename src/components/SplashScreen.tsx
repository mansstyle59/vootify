import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onFinish, 250);
    }, 600);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background overflow-hidden will-change-transform"
        >
          {/* Ambient glow — subtle and refined */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 0.12, scale: 1.3 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute w-[450px] h-[450px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--primary) / 0.5) 0%, transparent 65%)",
            }}
          />

          {/* Logo with spring animation */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 20, delay: 0.05 }}
            className="relative mb-5"
          >
            <div className="rounded-[28px] overflow-hidden glow-primary">
              <img
                src="/pwa-icon-192.png"
                alt="Vootify"
                width={96}
                height={96}
                className="w-24 h-24 rounded-[28px]"
              />
            </div>
          </motion.div>

          {/* Brand name — smooth fade in */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="text-3xl font-display font-black tracking-[0.25em] text-primary"
          >
            VOOTIFY
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 0.45, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="mt-2 text-[11px] font-semibold tracking-[0.3em] uppercase text-muted-foreground"
          >
            Ta musique, sans limites
          </motion.p>

          {/* Minimal loading indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="absolute bottom-28 w-8 h-8"
          >
            <motion.div
              className="w-full h-full rounded-full border-2 border-transparent border-t-primary/50"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
