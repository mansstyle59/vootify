import { useState, useRef, useCallback, forwardRef, type ReactNode } from "react";
import { Loader2, Check } from "lucide-react";

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
    const [done, setDone] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const touchStartY = useRef(0);
    const pulling = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = useCallback(
      (e: React.TouchEvent) => {
        if (refreshing || done) return;
        const el = containerRef.current;
        if (!el || el.scrollTop > 5) return;
        touchStartY.current = e.touches[0].clientY;
        pulling.current = true;
      },
      [refreshing, done]
    );

    const handleTouchMove = useCallback(
      (e: React.TouchEvent) => {
        if (!pulling.current || refreshing) return;
        const delta = e.touches[0].clientY - touchStartY.current;
        if (delta < 0) {
          setPullDistance(0);
          return;
        }
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
        setPullDistance(40);
        if (navigator.vibrate) navigator.vibrate(8);
        try {
          await onRefresh();
        } catch {}
        setRefreshing(false);
        setDone(true);
        // Show checkmark briefly then dismiss
        await new Promise((r) => setTimeout(r, 600));
        setDone(false);
        setPullDistance(0);
      } else {
        setPullDistance(0);
      }
    }, [onRefresh, pullDistance, refreshing]);

    const progress = Math.min(pullDistance / THRESHOLD, 1);
    const showIndicator = pullDistance > 8 || refreshing || done;

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
          className="absolute left-1/2 z-50 pointer-events-none flex items-center justify-center"
          style={{
            top: Math.max(pullDistance * 0.35 - 32, -32),
            opacity: showIndicator ? Math.min(progress * 1.5, 1) : 0,
            transform: `translateX(-50%) scale(${done ? 1 : 0.5 + progress * 0.5})`,
            transition: pulling.current ? "none" : "all 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-colors duration-200"
            style={{
              background: done ? "hsl(var(--primary))" : "hsl(var(--background) / 0.9)",
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: done ? "hsl(var(--primary))" : "hsl(var(--border) / 0.4)",
            }}
          >
            {done ? (
              <Check
                className="w-4 h-4 text-primary-foreground"
                strokeWidth={3}
                style={{
                  animation: "ptr-check 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            ) : refreshing ? (
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

        <style>{`
          @keyframes ptr-check {
            0% { opacity: 0; transform: scale(0.3) rotate(-45deg); }
            50% { opacity: 1; transform: scale(1.15) rotate(0deg); }
            100% { transform: scale(1) rotate(0deg); }
          }
        `}</style>
      </div>
    );
  }
);
