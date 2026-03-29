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
          exit={{ opacity: 0, scale: 1.06, filter: "blur(12px)" }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden will-change-transform"
          style={{ background: "hsl(var(--background))" }}
        >
          {/* ── Liquid Glass ambient layer ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 0.35, scale: 1.6 }}
            transition={{ duration: 2.5, ease: "easeOut" }}
            className="absolute w-[500px] h-[500px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, hsl(var(--primary) / 0.08) 45%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.3, rotate: -20 }}
            animate={{ opacity: 0.15, scale: 2, rotate: 10 }}
            transition={{ duration: 3, ease: "easeOut", delay: 0.2 }}
            className="absolute w-[600px] h-[400px] rounded-full"
            style={{
              background: "radial-gradient(ellipse, hsl(168 60% 35% / 0.3) 0%, transparent 65%)",
              filter: "blur(80px)",
            }}
          />

          {/* ── Glass orb particles ── */}
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30, x: (i - 2) * 50, scale: 0 }}
              animate={{ opacity: [0, 0.5, 0], y: -80 - i * 15, scale: [0, 1.2, 0.3] }}
              transition={{ duration: 2.5, delay: 0.7 + i * 0.15, ease: "easeOut" }}
              className="absolute rounded-full"
              style={{
                width: 6 + (i % 3) * 4,
                height: 6 + (i % 3) * 4,
                background: `radial-gradient(circle, hsl(var(--primary) / 0.6) 0%, hsl(var(--primary) / 0.1) 70%)`,
                backdropFilter: "blur(4px)",
                border: "0.5px solid hsl(var(--primary) / 0.2)",
              }}
            />
          ))}

          {/* ── Logo — liquid glass container ── */}
          <motion.div
            initial={{ scale: 0, opacity: 0, rotateY: -30 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.08 }}
            className="relative mb-8"
            style={{ perspective: "800px" }}
          >
            {/* Glass glow halo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.5, 0.3], scale: [0.5, 1.4, 1.2] }}
              transition={{ delay: 0.3, duration: 1.8, ease: "easeOut" }}
              className="absolute -inset-8 rounded-[40px]"
              style={{
                background: "radial-gradient(circle, hsl(var(--primary) / 0.2) 0%, transparent 65%)",
                filter: "blur(20px)",
              }}
            />
            {/* Glass border ring */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.8 }}
              className="absolute -inset-[3px] rounded-[30px]"
              style={{
                background: "linear-gradient(145deg, hsl(var(--primary) / 0.35), hsl(var(--foreground) / 0.05), hsl(var(--primary) / 0.2))",
                filter: "blur(0.5px)",
              }}
            />
            {/* Glass container */}
            <div
              className="relative rounded-[28px] overflow-hidden"
              style={{
                backdropFilter: "blur(40px) saturate(2)",
                WebkitBackdropFilter: "blur(40px) saturate(2)",
                boxShadow:
                  "0 0 60px hsl(var(--primary) / 0.2), 0 20px 50px hsl(0 0% 0% / 0.4), inset 0 1px 0 hsl(0 0% 100% / 0.12), inset 0 -0.5px 0 hsl(0 0% 0% / 0.2)",
              }}
            >
              <motion.img
                src="/pwa-icon-192.png"
                alt="Vootify"
                width={112}
                height={112}
                className="w-[112px] h-[112px] rounded-[28px]"
                initial={{ filter: "brightness(0.4) saturate(0)" }}
                animate={{ filter: "brightness(1) saturate(1.1)" }}
                transition={{ delay: 0.3, duration: 0.9, ease: "easeOut" }}
              />
              {/* Glass glare overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.15 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="absolute inset-0 rounded-[28px] pointer-events-none"
                style={{
                  background: "linear-gradient(135deg, hsl(0 0% 100% / 0.2) 0%, transparent 50%, hsl(0 0% 100% / 0.05) 100%)",
                }}
              />
            </div>
          </motion.div>

          {/* ── Brand name — glass letter reveal ── */}
          <div className="flex items-center gap-[3px] mb-3">
            {letters.map((letter, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 20, scale: 0.4, rotateX: 60 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  delay: 0.25 + i * 0.06,
                }}
                className="text-[32px] font-display font-black tracking-[0.16em]"
                style={{
                  color: "hsl(var(--primary))",
                  textShadow:
                    "0 0 24px hsl(var(--primary) / 0.4), 0 0 50px hsl(var(--primary) / 0.15)",
                }}
              >
                {letter}
              </motion.span>
            ))}
          </div>

          {/* ── Tagline ── */}
          <motion.p
            initial={{ opacity: 0, y: 8, letterSpacing: "0.5em" }}
            animate={{ opacity: 0.5, y: 0, letterSpacing: "0.3em" }}
            transition={{ delay: 0.85, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-[10px] font-semibold uppercase text-muted-foreground mb-1"
          >
            Ta musique, sans limites
          </motion.p>

          {/* ── Glass loading bar ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="absolute bottom-28"
          >
            <div
              className="w-[100px] h-[3px] rounded-full overflow-hidden"
              style={{
                background: "hsl(var(--foreground) / 0.06)",
                border: "0.5px solid hsl(var(--foreground) / 0.04)",
              }}
            >
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="h-full w-[40%] rounded-full"
                style={{
                  background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.6), transparent)",
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
