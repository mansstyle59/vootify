import { Skeleton } from "@/components/ui/skeleton";

/** Full-page skeleton for the home page initial load */
export function HomeSkeleton() {
  return (
    <div className="pb-20 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-5 md:px-8 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <Skeleton className="h-8 w-40 rounded-xl" />
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </div>

      {/* Top Artists bubbles skeleton */}
      <div className="mt-1 mb-4 px-5 md:px-9">
        <Skeleton className="h-3 w-28 rounded mb-3" />
        <div className="flex gap-5 pb-6 pt-1 px-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
              <Skeleton className="rounded-full" style={{ width: i < 3 ? 72 : 60, height: i < 3 ? 72 : 60 }} />
              <Skeleton className="h-2.5 w-12 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Section skeletons */}
      {[1, 2, 3].map((s) => (
        <div key={s} className="mb-6">
          <div className="px-5 md:px-8 mb-3">
            <Skeleton className="h-5 w-36 rounded-lg" />
          </div>
          <div className="flex gap-3 px-5 md:px-8 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[140px]">
                <Skeleton className="w-[140px] h-[140px] rounded-2xl mb-2" />
                <Skeleton className="h-3 w-24 rounded mb-1" />
                <Skeleton className="h-2.5 w-16 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
