/**
 * Transparent skeleton placeholder shown while lazy route chunks load.
 * Keeps the current background visible — no black/blank flash.
 */
export function PageLoader() {
  return (
    <div className="min-h-screen bg-background">
      {/* Subtle shimmer skeleton — keeps layout stable, no blank screen */}
      <div className="animate-pulse px-4 pt-14 pb-4 space-y-4">
        {/* Header area */}
        <div className="h-7 w-36 rounded-lg bg-muted/30" />
        <div className="h-4 w-48 rounded bg-muted/20" />
        {/* Content cards row */}
        <div className="flex gap-3 mt-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 space-y-2">
              <div className="w-[130px] h-[130px] rounded-2xl bg-muted/25" />
              <div className="h-3 w-20 rounded bg-muted/20" />
              <div className="h-2.5 w-14 rounded bg-muted/15" />
            </div>
          ))}
        </div>
        {/* Second section */}
        <div className="mt-6 space-y-3">
          <div className="h-5 w-32 rounded bg-muted/25" />
          <div className="flex gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="w-[130px] h-[130px] rounded-2xl bg-muted/20" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
