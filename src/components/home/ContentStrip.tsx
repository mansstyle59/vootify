import { useRef, useState, useCallback, useEffect, type ReactNode, Children } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ContentStripProps {
  children: ReactNode;
  /** Number of items visible per page on mobile / desktop */
  itemsPerPageMobile?: number;
  itemsPerPageDesktop?: number;
}

export function ContentStrip({
  children,
  itemsPerPageMobile = 3,
  itemsPerPageDesktop = 5,
}: ContentStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const childCount = Children.count(children);

  const updateState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollLeft = el.scrollLeft;
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;

    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);

    // Calculate current page based on scroll position
    if (clientWidth > 0 && scrollWidth > clientWidth) {
      const pages = Math.ceil(scrollWidth / clientWidth);
      setTotalPages(pages);
      const page = Math.round(scrollLeft / clientWidth);
      setCurrentPage(Math.min(page, pages - 1));
    } else {
      setTotalPages(1);
      setCurrentPage(0);
    }
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

  const scrollToPage = useCallback((page: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const target = page * el.clientWidth;
    el.scrollTo({ left: target, behavior: "smooth" });
  }, []);

  const scrollBy = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }, []);

  const showDots = totalPages > 1;

  return (
    <div
      className="relative group/strip"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Fade edges */}
      <div
        className="absolute left-0 top-0 bottom-8 w-8 z-10 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: canScrollLeft ? 1 : 0,
          background: "linear-gradient(to right, hsl(var(--background)), transparent)",
        }}
      />
      <div
        className="absolute right-0 top-0 bottom-8 w-8 z-10 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: canScrollRight ? 1 : 0,
          background: "linear-gradient(to left, hsl(var(--background)), transparent)",
        }}
      />

      {/* Desktop navigation arrows */}
      <AnimatePresence>
        {isHovered && canScrollLeft && (
          <motion.button
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.2 }}
            onClick={() => scrollBy(-1)}
            className="hidden md:flex absolute left-1 top-1/2 -translate-y-[60%] z-20 w-9 h-9 rounded-full items-center justify-center bg-card/90 backdrop-blur-md border border-border/50 text-foreground shadow-lg hover:bg-card transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isHovered && canScrollRight && (
          <motion.button
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.2 }}
            onClick={() => scrollBy(1)}
            className="hidden md:flex absolute right-1 top-1/2 -translate-y-[60%] z-20 w-9 h-9 rounded-full items-center justify-center bg-card/90 backdrop-blur-md border border-border/50 text-foreground shadow-lg hover:bg-card transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex gap-2.5 md:gap-3 overflow-x-auto pl-5 pr-4 md:pl-9 md:pr-8 pb-1"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollBehavior: "smooth",
          msOverflowStyle: "none",
          scrollbarWidth: "none",
        }}
      >
        {children}
      </div>

      {/* Pagination dots */}
      {showDots && (
        <div className="flex items-center justify-center gap-1.5 pt-3 pb-1">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToPage(i)}
              className="transition-all duration-300 rounded-full"
              style={{
                width: currentPage === i ? 16 : 5,
                height: 5,
                background:
                  currentPage === i
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted-foreground) / 0.2)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function StripSkeleton({ count = 6 }: { count?: number }) {
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
