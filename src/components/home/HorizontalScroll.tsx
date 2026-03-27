import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";

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
    <div className="relative group/scroll">
      {/* Fade edges */}
      <div
        className="absolute left-0 top-0 bottom-0 w-6 z-10 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: canScrollLeft ? 1 : 0,
          background: "linear-gradient(to right, hsl(var(--background)), transparent)",
        }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-6 z-10 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: canScrollRight ? 1 : 0,
          background: "linear-gradient(to left, hsl(var(--background)), transparent)",
        }}
      />

      <div
        ref={scrollRef}
        className="flex gap-2.5 md:gap-3 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-3"
        style={{
          scrollSnapType: "x proximity",
          WebkitOverflowScrolling: "touch",
          scrollBehavior: "smooth",
          /* Hide scrollbar for all browsers */
          msOverflowStyle: "none",
          scrollbarWidth: "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function CoverSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[105px] md:w-[130px] snap-start">
          <div className="w-[105px] h-[105px] md:w-[130px] md:h-[130px] rounded-xl bg-secondary/60 mb-1.5 animate-pulse" />
          <div className="h-3 w-20 md:w-24 bg-secondary/60 rounded-md mb-1 animate-pulse" />
          <div className="h-2.5 w-14 md:w-16 bg-secondary/40 rounded-md animate-pulse" />
        </div>
      ))}
    </>
  );
}
