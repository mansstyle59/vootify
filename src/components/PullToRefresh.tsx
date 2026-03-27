import { useState, useRef, useCallback, forwardRef, type ReactNode } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { RotateCw } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
}

const THRESHOLD = 72;
const MAX_PULL = 130;

export const PullToRefresh = forwardRef<HTMLDivElement, PullToRefreshProps>(function PullToRefresh({ onRefresh, children, className = "" }, ref) {
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const pulling = useRef(false);
  const pullY = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const indicatorOpacity = useTransform(pullY, [0, 30, THRESHOLD], [0, 0.6, 1]);
  const indicatorScale = useTransform(pullY, [0, THRESHOLD * 0.5, THRESHOLD], [0.3, 0.8, 1]);
  const indicatorY = useTransform(pullY, (v) => Math.max(v - 44, -44));
  const rotate = useTransform(pullY, [0, THRESHOLD, MAX_PULL], [0, 360, 720]);
  const progress = useTransform(pullY, [0, THRESHOLD], [0, 1]);
  const contentY = useTransform(pullY, (v) => v * 0.35);
  const strokeDashoffset = useTransform(progress, [0, 1], [88, 0]);

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
    const dampened = Math.min(delta * 0.45 * (1 - delta / 800), MAX_PULL);
    pullY.set(Math.max(0, dampened));
  }, [refreshing, pullY]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    const currentPull = pullY.get();

    if (currentPull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      animate(pullY, 56, { type: "spring", stiffness: 350, damping: 28 });
      try {
        await onRefresh();
      } catch {}
      setRefreshing(false);
    }
    animate(pullY, 0, { type: "spring", stiffness: 500, damping: 35, mass: 0.8 });
  }, [onRefresh, pullY, refreshing]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-y-auto ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <motion.div
        style={{ opacity: indicatorOpacity, scale: indicatorScale, y: indicatorY }}
        className="absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      >
        <div className="w-11 h-11 rounded-full bg-background/80 backdrop-blur-xl border border-primary/20 flex items-center justify-center shadow-[0_4px_24px_-4px_hsl(var(--primary)/0.3)]">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 44 44">
            <motion.circle
              cx="22"
              cy="22"
              r="14"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="88"
              style={{ strokeDashoffset: refreshing ? 0 : strokeDashoffset }}
              className={refreshing ? "animate-spin origin-center" : ""}
            />
          </svg>
          <motion.div style={{ rotate: refreshing ? undefined : rotate }} className={refreshing ? "animate-spin" : ""}>
            <RotateCw className="w-4.5 h-4.5 text-primary" strokeWidth={2.5} />
          </motion.div>
        </div>
      </motion.div>

      <motion.div style={{ y: contentY }}>
        {children}
      </motion.div>
    </div>
  );
});
