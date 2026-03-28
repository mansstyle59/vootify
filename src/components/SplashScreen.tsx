import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const letters = "VOOTIFY".split("");

interface Props {
  onFinish: () => void;
  holdForCache?: boolean;
}

export function SplashScreen({ onFinish, holdForCache }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (holdForCache) return;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onFinish, 500);
    }, 2000);
    return () => clearTimeout(timer);
  }, [onFinish, holdForCache]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.06, filter: "blur(8px)" }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden will-change-transform"
          style={{ background: "hsl(var(--background))" }}
        >
          {/* Deep layered ambient glows */}
          <motion.div
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 0.2, scale: 1.8 }}
            transition={{ duration: 2.5, ease: "easeOut" }}
            className="absolute w-[600px] h-[600px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(142 71% 45% / 0.5) 0%, hsl(142 71% 45% / 0.1) 40%, transparent 65%)",
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.2, rotate: -30 }}
            animate={{ opacity: 0.12, scale: 2.2, rotate: 0 }}
            transition={{ duration: 3, ease: "easeOut", delay: 0.15 }}
            className="absolute w-[700px] h-[500px] rounded-full"
            style={{
              background: "radial-gradient(ellipse, hsl(var(--primary) / 0.35) 0%, transparent 60%)",
            }}
          />
          {/* Subtle particle dots */}
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 + i * 10, x: (i - 3) * 30, scale: 0 }}
              animate={{ opacity: [0, 0.4, 0], y: -60 - i * 20, scale: [0, 1, 0.5] }}
              transition={{
                duration: 2.2,
                delay: 0.6 + i * 0.12,
                ease: "easeOut",
              }}
              className="absolute rounded-full"
              style={{
                width: 3 + (i % 3) * 2,
                height: 3 + (i % 3) * 2,
                background: `hsl(142 71% ${55 + i * 5}% / 0.6)`,
                filter: "blur(0.5px)",
              }}
            />
          ))}

          {/* Logo — cinematic 3D entrance */}
          <motion.div
            initial={{ scale: 0, opacity: 0, rotateY: -40, rotateX: 15 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0, rotateX: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.08 }}
            className="relative mb-7"
            style={{ perspective: "800px" }}
          >
            {/* Outer glow pulse */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 0.6, 0.3], scale: [0.6, 1.3, 1.15] }}
              transition={{ delay: 0.3, duration: 1.5, ease: "easeOut" }}
              className="absolute -inset-5 rounded-[36px]"
              style={{
                background: "radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, transparent 70%)",
                filter: "blur(16px)",
              }}
            />
            {/* Inner ring */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="absolute -inset-[3px] rounded-[30px]"
              style={{
                background: "linear-gradient(135deg, hsl(var(--primary) / 0.4), hsl(142 71% 45% / 0.15), hsl(var(--primary) / 0.3))",
                filter: "blur(1px)",
              }}
            />
            <div
              className="relative rounded-[28px] overflow-hidden"
              style={{
                boxShadow:
                  "0 0 80px hsl(var(--primary) / 0.25), 0 20px 50px hsl(0 0% 0% / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.1)",
              }}
            >
              <motion.img
                src="/pwa-icon-192.png"
                alt="Vootify"
                width={112}
                height={112}
                className="w-[112px] h-[112px] rounded-[28px]"
                initial={{ filter: "brightness(0.5) saturate(0)" }}
                animate={{ filter: "brightness(1) saturate(1)" }}
                transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </motion.div>

          {/* Brand name — staggered letter reveal with glow wave */}
          <div className="flex items-center gap-[3px] mb-3">
            {letters.map((letter, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 24, scale: 0.3, rotateX: 90 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 280,
                  damping: 18,
                  delay: 0.25 + i * 0.065,
                }}
                className="text-[34px] font-display font-black tracking-[0.18em]"
                style={{
                  color: "hsl(var(--primary))",
                  textShadow:
                    "0 0 30px hsl(var(--primary) / 0.5), 0 0 60px hsl(var(--primary) / 0.2)",
                }}
              >
                {letter}
              </motion.span>
            ))}
          </div>

          {/* Tagline — elegant fade */}
          <motion.p
            initial={{ opacity: 0, y: 10, letterSpacing: "0.5em" }}
            animate={{ opacity: 0.55, y: 0, letterSpacing: "0.35em" }}
            transition={{ delay: 0.85, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-[11px] font-semibold uppercase text-muted-foreground mb-1"
          >
            Ta musique, sans limites
          </motion.p>

          {/* Elegant loading indicator — pulsing dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="absolute bottom-28 flex items-center gap-1.5"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 0.8, 0.3],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "hsl(var(--primary) / 0.7)" }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
