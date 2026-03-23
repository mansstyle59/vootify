import { useState, useEffect, useCallback } from "react";
import { offlineCache } from "@/lib/offlineCache";
import { Song } from "@/data/mockData";

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
    } catch (e) {
      console.error("Download failed:", e);
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
