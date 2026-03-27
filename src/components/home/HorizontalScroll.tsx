import type { ReactNode } from "react";

export function HorizontalScroll({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-3 snap-x snap-mandatory scroll-smooth">
      {children}
    </div>
  );
}

export function CoverSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-40 snap-start">
          <div className="w-40 h-40 rounded-2xl bg-secondary mb-2.5 animate-pulse" />
          <div className="h-3.5 w-28 bg-secondary rounded-md mb-1 animate-pulse" />
          <div className="h-3 w-20 bg-secondary rounded-md animate-pulse" />
        </div>
      ))}
    </>
  );
}
