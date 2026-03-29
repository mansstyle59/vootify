import { useRef, useState, useCallback, useEffect, type ReactNode, Children } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ContentStripProps {
  children: ReactNode;
}

export function ContentStrip({ children }: ContentStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const childCount = Children.count(children);

  const updateState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const left = el.scrollLeft;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(left > 4);
    setCanScrollRight(left < maxScroll - 4);
    setScrollProgress(maxScroll > 0 ? left / maxScroll : 0);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateState();
    el.addEventListener("scroll", updateState, { passive: true });
    const ro = new ResizeObserver(updateState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateState);
      ro.disconnect();
    };
  }, [updateState, childCount]);

  const scrollBy = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: "smooth" });
  }, []);

  const showIndicator = canScrollLeft || canScrollRight;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Fade edges */}
      <div
        className="absolute left-0 top-0 bottom-0 w-10 z-10 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: canScrollLeft ? 1 : 0,
          background: "linear-gradient(to right, hsl(var(--background)), hsl(var(--background) / 0.6), transparent)",
        }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-10 z-10 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: canScrollRight ? 1 : 0,
          background: "linear-gradient(to left, hsl(var(--background)), hsl(var(--background) / 0.6), transparent)",
        }}
      />

      {/* Desktop arrows */}
      {isHovered && canScrollLeft && (
        <button
          onClick={() => scrollBy(-1)}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full items-center justify-center text-foreground active:scale-90 transition-all"
          style={{
            background: "hsl(var(--card) / 0.85)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 2px 12px hsl(0 0% 0% / 0.2)",
            border: "1px solid hsl(var(--foreground) / 0.06)",
          }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      {isHovered && canScrollRight && (
        <button
          onClick={() => scrollBy(1)}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full items-center justify-center text-foreground active:scale-90 transition-all"
          style={{
            background: "hsl(var(--card) / 0.85)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 2px 12px hsl(0 0% 0% / 0.2)",
            border: "1px solid hsl(var(--foreground) / 0.06)",
          }}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex gap-3.5 overflow-x-auto pl-5 pr-5 md:pl-9 md:pr-9 pb-3 scrollbar-hide"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {children}
        <div className="flex-shrink-0 w-1" aria-hidden />
      </div>

      {/* Scroll progress indicator (mobile) */}
      {showIndicator && (
        <div className="flex justify-center md:hidden pb-1">
          <div
            className="h-[2px] rounded-full overflow-hidden"
            style={{
              width: 40,
              background: "hsl(var(--foreground) / 0.06)",
            }}
          >
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{
                width: "40%",
                transform: `translateX(${scrollProgress * 150}%)`,
                background: "hsl(var(--primary) / 0.4)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function StripSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[140px] md:w-[160px] snap-start">
          <div
            className="w-[140px] h-[140px] md:w-[160px] md:h-[160px] rounded-2xl mb-2 overflow-hidden relative"
            style={{ background: "hsl(var(--foreground) / 0.04)" }}
          >
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
          </div>
          <div className="h-2.5 w-20 rounded mb-1" style={{ background: "hsl(var(--foreground) / 0.04)" }} />
          <div className="h-2 w-14 rounded" style={{ background: "hsl(var(--foreground) / 0.03)" }} />
        </div>
      ))}
    </>
  );
}
