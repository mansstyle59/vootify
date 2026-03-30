import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { offlineCache } from "@/lib/offlineCache";

/**
 * Small green badge indicating a song is available offline.
 * Resolves cache status asynchronously and renders nothing if not cached.
 */
export function OfflineBadge({ songId, className = "" }: { songId: string; className?: string }) {
  const [cached, setCached] = useState(false);

  useEffect(() => {
    if (!songId) return;
    const rawId = songId.startsWith("custom-") ? songId.slice(7) : songId;
    offlineCache.isCached(rawId).then(setCached).catch(() => {});
  }, [songId]);

  if (!cached) return null;

  return (
    <div
      className={`inline-flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0 ${className}`}
      style={{ background: "hsl(142 71% 45% / 0.15)" }}
      title="Disponible hors-ligne"
    >
      <Download className="w-2.5 h-2.5" style={{ color: "hsl(142 71% 45%)" }} />
    </div>
  );
}

/**
 * Hook to check if a list of songs has any cached items.
 * Returns a Set of cached song IDs for efficient lookup.
 */
export function useOfflineSongIds(songIds: string[]): Set<string> {
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (songIds.length === 0) return;
    let cancelled = false;

    (async () => {
      const ids = new Set<string>();
      for (const id of songIds) {
        const rawId = id.startsWith("custom-") ? id.slice(7) : id;
        const cached = await offlineCache.isCached(rawId);
        if (cached) ids.add(id);
      }
      if (!cancelled) setCachedIds(ids);
    })();

    return () => { cancelled = true; };
  }, [songIds.join(",")]);

  return cachedIds;
}
