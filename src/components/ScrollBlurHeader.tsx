import { useState, useEffect, useRef, type ReactNode } from "react";

interface ScrollBlurHeaderProps {
  children: ReactNode;
  className?: string;
  /** Scroll distance (px) at which blur reaches max */
  scrollThreshold?: number;
}

/**
 * Apple Music-style header that gains backdrop blur + border as user scrolls.
 * Sticks to top of its scroll container (PullToRefresh wrapper).
 */
export function ScrollBlurHeader({
  children,
  className = "",
  scrollThreshold = 80,
}: ScrollBlurHeaderProps) {
  const [progress, setProgress] = useState(0);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Find the scrollable ancestor (PullToRefresh wrapper)
    const scrollEl =
      headerRef.current?.closest(".scrollbar-hide") ||
      headerRef.current?.closest("[data-scroll]") ||
      window;

    const handleScroll = () => {
      const y =
        scrollEl === window
          ? window.scrollY
          : (scrollEl as HTMLElement).scrollTop;
      setProgress(Math.min(y / scrollThreshold, 1));
    };

    const target = scrollEl === window ? window : scrollEl;
    target.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => target.removeEventListener("scroll", handleScroll);
  }, [scrollThreshold]);

  return (
    <div
      ref={headerRef}
      className={`sticky top-0 z-30 transition-[border-color] duration-200 ${className}`}
      style={{
        backdropFilter: `blur(${progress * 20}px) saturate(${100 + progress * 80}%)`,
        WebkitBackdropFilter: `blur(${progress * 20}px) saturate(${100 + progress * 80}%)`,
        backgroundColor: `hsl(var(--background) / ${progress * 0.75})`,
        borderBottom: `1px solid hsl(var(--border) / ${progress * 0.5})`,
      }}
    >
      {children}
    </div>
  );
}
