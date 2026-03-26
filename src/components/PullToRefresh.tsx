import { useState, useRef, useCallback, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Loader2, ArrowDown } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
}

const THRESHOLD = 80;
const MAX_PULL = 120;

export function PullToRefresh({ onRefresh, children, className = "" }: PullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const pulling = useRef(false);
  const pullY = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const indicatorOpacity = useTransform(pullY, [0, 40, THRESHOLD], [0, 0.5, 1]);
  const indicatorScale = useTransform(pullY, [0, THRESHOLD], [0.5, 1]);
  const rotate = useTransform(pullY, [0, THRESHOLD], [0, 180]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 5) return;
    touchStartY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta < 0) {
      pullY.set(0);
      return;
    }
    // Dampen pull
    const dampened = Math.min(delta * 0.5, MAX_PULL);
    pullY.set(dampened);
  }, [refreshing, pullY]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    const currentPull = pullY.get();

    if (currentPull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      animate(pullY, 60, { type: "spring", stiffness: 300, damping: 30 });
      try {
        await onRefresh();
      } catch {}
      setRefreshing(false);
    }
    animate(pullY, 0, { type: "spring", stiffness: 400, damping: 35 });
  }, [onRefresh, pullY, refreshing]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-y-auto ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Indicator */}
      <motion.div
        style={{ opacity: indicatorOpacity, scale: indicatorScale, y: useTransform(pullY, (v) => v - 50) }}
        className="absolute left-1/2 -translate-x-1/2 z-50 flex items-center justify-center"
      >
        <div className="w-10 h-10 rounded-full bg-primary/20 backdrop-blur-md border border-primary/30 flex items-center justify-center shadow-lg">
          {refreshing ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <motion.div style={{ rotate }}>
              <ArrowDown className="w-5 h-5 text-primary" />
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Content with pull offset */}
      <motion.div style={{ y: useTransform(pullY, (v) => v * 0.3) }}>
        {children}
      </motion.div>
    </div>
  );
}
