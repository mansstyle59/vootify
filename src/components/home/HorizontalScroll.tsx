import type { ReactNode } from "react";

export function HorizontalScroll({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-2">
      {children}
    </div>
  );
}

export function CoverSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-40 animate-pulse">
          <div className="w-40 h-40 rounded-xl bg-secondary mb-2" />
          <div className="h-3.5 w-28 bg-secondary rounded mb-1" />
          <div className="h-3 w-20 bg-secondary rounded" />
        </div>
      ))}
    </>
  );
}
