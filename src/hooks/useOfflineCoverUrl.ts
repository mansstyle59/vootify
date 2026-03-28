import { useState, useEffect } from "react";
import { offlineCache } from "@/lib/offlineCache";

/**
 * Resolves a cover image URL from IndexedDB offline cache.
 * Returns the cached blob URL if available, otherwise the original URL.
 * This ensures covers display correctly even without network.
 */
export function useOfflineCoverUrl(songId: string | undefined, networkUrl: string | undefined): string {
  const [resolvedUrl, setResolvedUrl] = useState(networkUrl || "");

  useEffect(() => {
    if (!songId) {
      setResolvedUrl(networkUrl || "");
      return;
    }

    let revoked = false;
    let blobUrl: string | null = null;

    offlineCache.getCachedCoverUrl(songId).then((cached) => {
      if (revoked) {
        if (cached) URL.revokeObjectURL(cached);
        return;
      }
      if (cached) {
        blobUrl = cached;
        setResolvedUrl(cached);
      } else {
        setResolvedUrl(networkUrl || "");
      }
    }).catch(() => {
      if (!revoked) setResolvedUrl(networkUrl || "");
    });

    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [songId, networkUrl]);

  return resolvedUrl;
}
