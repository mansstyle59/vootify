import { useState, useRef, useCallback, forwardRef, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const THRESHOLD = 64;
const MAX_PULL = 120;

export const PullToRefresh = forwardRef<HTMLDivElement, PullToRefreshProps>(
  function PullToRefresh({ onRefresh, children, className = "", style }, _ref) {
    const [refreshing, setRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const touchStartY = useRef(0);
    const pulling = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = useCallback(
      (e: React.TouchEvent) => {
        if (refreshing) return;
        const el = containerRef.current;
        if (!el || el.scrollTop > 5) return;
        touchStartY.current = e.touches[0].clientY;
        pulling.current = true;
      },
      [refreshing]
    );

    const handleTouchMove = useCallback(
      (e: React.TouchEvent) => {
        if (!pulling.current || refreshing) return;
        const delta = e.touches[0].clientY - touchStartY.current;
        if (delta < 0) {
          setPullDistance(0);
          return;
        }
        // Dampen the pull for a rubber-band feel
        const dampened = Math.min(delta * 0.4 * (1 - delta / 900), MAX_PULL);
        setPullDistance(Math.max(0, dampened));
      },
      [refreshing]
    );

    const handleTouchEnd = useCallback(async () => {
      if (!pulling.current) return;
      pulling.current = false;

      if (pullDistance >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        setPullDistance(40); // hold at spinner position
        if (navigator.vibrate) navigator.vibrate(8);
        try {
          await onRefresh();
        } catch {}
        setRefreshing(false);
      }
      setPullDistance(0);
    }, [onRefresh, pullDistance, refreshing]);

    const progress = Math.min(pullDistance / THRESHOLD, 1);
    const showIndicator = pullDistance > 8 || refreshing;

    return (
      <div
        ref={containerRef}
        className={`relative overflow-y-auto ${className}`}
        style={style}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Minimal pull indicator */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center justify-center"
          style={{
            top: Math.max(pullDistance * 0.35 - 32, -32),
            opacity: showIndicator ? Math.min(progress * 1.5, 1) : 0,
            transform: `translateX(-50%) scale(${0.5 + progress * 0.5})`,
            transition: pulling.current ? "none" : "all 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div className="w-8 h-8 rounded-full bg-background/90 border border-border/40 flex items-center justify-center shadow-sm">
            {refreshing ? (
              <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
            ) : (
              <svg className="w-5 h-5 -rotate-90" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="8"
                  fill="none"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="50.3"
                  strokeDashoffset={50.3 * (1 - progress)}
                  style={{ transition: pulling.current ? "none" : "stroke-dashoffset 0.3s ease" }}
                />
              </svg>
            )}
          </div>
        </div>

        {/* Content with subtle shift */}
        <div
          style={{
            transform: `translateY(${pullDistance * 0.25}px)`,
            transition: pulling.current ? "none" : "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {children}
        </div>
      </div>
    );
  }
);
