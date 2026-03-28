import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isCacheReady, performInitialCache, type CacheProgress } from "@/lib/appCache";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  children: React.ReactNode;
}

export function InitialCacheLoader({ children }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [cacheReady, setCacheReady] = useState(() => isCacheReady());
  const [progress, setProgress] = useState<CacheProgress | null>(null);
  const [fadeOut, setFadeOut] = useState(false);

  const handleProgress = useCallback((p: CacheProgress) => {
    setProgress(p);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (cacheReady) return;
    if (!user?.id) {
      // No user — skip cache, let them see auth
      setCacheReady(true);
      return;
    }

    let cancelled = false;
    performInitialCache(user.id, handleProgress).then(() => {
      if (cancelled) return;
      setFadeOut(true);
      setTimeout(() => setCacheReady(true), 600);
    });

    return () => { cancelled = true; };
  }, [user, authLoading, cacheReady, handleProgress]);

  if (cacheReady) return <>{children}</>;

  return (
    <AnimatePresence>
      {!fadeOut ? (
        <motion.div
          key="cache-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[250] flex flex-col items-center justify-center bg-background overflow-hidden"
        >
          {/* Ambient glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.12, scale: 1.5 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute w-[500px] h-[500px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--primary) / 0.5) 0%, transparent 60%)",
            }}
          />

          {/* Logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative mb-8"
          >
            <div className="rounded-[28px] overflow-hidden shadow-2xl" style={{
              boxShadow: "0 0 60px hsl(var(--primary) / 0.3), 0 20px 40px hsl(0 0% 0% / 0.4)",
            }}>
              <img
                src="/pwa-icon-192.png"
                alt="Vootify"
                width={88}
                height={88}
                className="w-[88px] h-[88px] rounded-[28px]"
              />
            </div>
          </motion.div>

          {/* Status text */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center gap-3 mb-8 px-8"
          >
            <p className="text-sm font-semibold text-foreground">
              Préparation de votre bibliothèque…
            </p>
            {progress && (
              <motion.p
                key={progress.step}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 0.6, y: 0 }}
                className="text-xs text-muted-foreground text-center"
              >
                {progress.step}
              </motion.p>
            )}
          </motion.div>

          {/* Progress bar */}
          <div className="w-48 h-1 rounded-full bg-muted/30 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: `${progress?.percent ?? 0}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>

          {progress && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              className="mt-2 text-[10px] font-mono text-muted-foreground"
            >
              {progress.percent}%
            </motion.p>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
