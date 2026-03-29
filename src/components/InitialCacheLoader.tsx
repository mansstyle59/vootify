import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isCacheReady, performInitialCache, type CacheProgress } from "@/lib/appCache";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  children: React.ReactNode;
}

/**
 * Seamless flow: Splash → Cache download (if needed) → App
 * On first open: splash morphs into cache loader with progress bar
 * On subsequent opens: splash plays normally, app loads instantly
 */
export function InitialCacheLoader({ children }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [cacheReady, setCacheReady] = useState(() => isCacheReady());
  const [progress, setProgress] = useState<CacheProgress | null>(null);
  const [showLoader, setShowLoader] = useState(!cacheReady);
  const [fadeOut, setFadeOut] = useState(false);

  const handleProgress = useCallback((p: CacheProgress) => {
    setProgress(p);
  }, []);

  const userId = user?.id ?? null;

  useEffect(() => {
    if (authLoading) return;
    if (cacheReady) {
      setShowLoader(false);
      return;
    }
    if (!userId) {
      // No user — skip cache, let them see auth
      setCacheReady(true);
      setShowLoader(false);
      return;
    }

    let cancelled = false;
    performInitialCache(userId, handleProgress).then(() => {
      if (cancelled) return;
      setFadeOut(true);
      setTimeout(() => {
        setCacheReady(true);
        setShowLoader(false);
      }, 700);
    });

    return () => { cancelled = true; };
  }, [userId, authLoading, cacheReady, handleProgress]);

  if (cacheReady && !showLoader) return <>{children}</>;

  return (
    <>
      {/* Render children underneath so they start mounting */}
      <div style={{ visibility: cacheReady ? "visible" : "hidden", position: cacheReady ? "relative" : "fixed", inset: 0 }}>
        {children}
      </div>

      {/* Cache loader overlay — seamless transition from splash */}
      <AnimatePresence>
        {showLoader && !fadeOut && (
          <motion.div
            key="cache-loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -30, scale: 1.06 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[190] flex flex-col items-center justify-center bg-background overflow-hidden"
          >
            {/* Ambient glow — matches splash screen */}
            <motion.div
              animate={{ opacity: [0.08, 0.15, 0.08], scale: [1.3, 1.6, 1.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-[500px] h-[500px] rounded-full"
              style={{
                background: "radial-gradient(circle, hsl(var(--primary) / 0.5) 0%, transparent 60%)",
              }}
            />

            {/* Logo — already visible from splash, smooth layout transition */}
            <motion.div
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 0.85, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              className="relative mb-6"
            >
              <div className="rounded-[28px] overflow-hidden shadow-2xl" style={{
                boxShadow: "0 0 50px hsl(var(--primary) / 0.25), 0 16px 32px hsl(0 0% 0% / 0.35)",
              }}>
                <img
                  src="/pwa-icon-192.png"
                  alt="Vootify"
                  width={80}
                  height={80}
                  className="w-[80px] h-[80px] rounded-[28px]"
                />
              </div>
            </motion.div>

            {/* Status text with smooth step transitions */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center gap-2.5 mb-6 px-8"
            >
              <p className="text-sm font-semibold text-foreground">
                Préparation de votre bibliothèque…
              </p>
              <AnimatePresence mode="wait">
                {progress && (
                  <motion.p
                    key={progress.step}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 0.55, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="text-xs text-muted-foreground text-center"
                  >
                    {progress.step}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Progress bar — smooth fill */}
            <div className="w-52 h-1.5 rounded-full bg-muted/20 overflow-hidden backdrop-blur-sm"
              style={{ border: "1px solid hsl(var(--border) / 0.15)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.7) 100%)",
                  boxShadow: "0 0 12px hsl(var(--primary) / 0.4)",
                }}
                initial={{ width: "0%" }}
                animate={{ width: `${progress?.percent ?? 0}%` }}
                transition={{ duration: 0.4, ease: [0.25, 0.8, 0.25, 1] }}
              />
            </div>

            {progress && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.35 }}
                className="mt-2.5 text-[10px] font-mono tracking-wider text-muted-foreground"
              >
                {progress.percent}%
              </motion.p>
            )}

            {/* Bottom subtle branding */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              transition={{ delay: 1 }}
              className="absolute bottom-8 text-[9px] tracking-[0.3em] uppercase text-muted-foreground font-medium"
            >
              Première installation
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
