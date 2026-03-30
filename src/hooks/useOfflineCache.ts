import { useState, useEffect, useCallback } from "react";
import { offlineCache } from "@/lib/offlineCache";
import { Song } from "@/data/mockData";
import { toast } from "sonner";

const WARN_SONGS = 280;
const WARN_BYTES = 900 * 1024 * 1024; // 900 MB (90% of 1 GB)

export function useOfflineCache(songId: string | undefined) {
  const [isCached, setIsCached] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!songId) return;
    offlineCache.isCached(songId).then(setIsCached);
  }, [songId]);

  const download = useCallback(async (song: Song) => {
    if (isDownloading || !song.streamUrl) return;
    setIsDownloading(true);
    setProgress(0);
    try {
      await offlineCache.cacheSong(song, setProgress);
      setIsCached(true);

      // Check limits after successful download
      const [count, size] = await Promise.all([
        offlineCache.getAllCachedCount(),
        offlineCache.getCacheSize(),
      ]);
      if (count >= WARN_SONGS) {
        toast.warning(`⚠️ ${count}/300 titres hors-ligne — limite bientôt atteinte`);
      } else if (size >= WARN_BYTES) {
        const mb = Math.round(size / (1024 * 1024));
        toast.warning(`⚠️ ${mb} Mo / 1 Go utilisés — espace limité`);
      }
    } catch (e: any) {
      if (e.message?.includes("Limite")) {
        toast.error(e.message);
      } else {
        console.error("Download failed:", e);
      }
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading]);

  const remove = useCallback(async (songId: string) => {
    await offlineCache.removeCached(songId);
    setIsCached(false);
  }, []);

  return { isCached, isDownloading, progress, download, remove };
}
