import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";

export function HorizontalScroll({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll]);

  return (
    <div className="relative">
      {/* Fade edges */}
      <div
        className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none transition-opacity duration-200"
        style={{
          opacity: canScrollLeft ? 1 : 0,
          background: "linear-gradient(to right, hsl(var(--background)), transparent)",
        }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none transition-opacity duration-200"
        style={{
          opacity: canScrollRight ? 1 : 0,
          background: "linear-gradient(to left, hsl(var(--background)), transparent)",
        }}
      />

      <div
        ref={scrollRef}
        className="flex gap-3 md:gap-3.5 overflow-x-auto scrollbar-hide pl-5 pr-5 md:pl-9 md:pr-9 pb-2"
        style={{
          scrollSnapType: "x proximity",
          WebkitOverflowScrolling: "touch",
          scrollBehavior: "smooth",
          msOverflowStyle: "none",
          scrollbarWidth: "none",
        }}
      >
        {children}
        {/* Spacer to prevent last card clipping */}
        <div className="flex-shrink-0 w-1" aria-hidden />
      </div>
    </div>
  );
}

export function CoverSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[120px] md:w-[140px] snap-start">
          <div className="w-[120px] h-[120px] md:w-[140px] md:h-[140px] rounded-xl bg-secondary/40 mb-2 overflow-hidden relative">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
          </div>
          <div className="h-2.5 w-16 md:w-20 bg-secondary/40 rounded mb-1 overflow-hidden relative">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
          </div>
          <div className="h-2 w-10 md:w-12 bg-secondary/25 rounded overflow-hidden relative">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
          </div>
        </div>
      ))}
    </>
  );
}
