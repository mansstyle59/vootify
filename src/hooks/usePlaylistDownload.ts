import { useState, useRef, useCallback } from "react";
import { offlineCache } from "@/lib/offlineCache";
import { deezerApi } from "@/lib/deezerApi";
import { Song } from "@/data/mockData";

export type DownloadStatus = "pending" | "resolving" | "downloading" | "done" | "error" | "skipped";

export interface SongDownloadState {
  songId: string;
  title: string;
  status: DownloadStatus;
  progress: number; // 0-100 for individual song
}

export interface PlaylistDownloadState {
  isDownloading: boolean;
  songs: SongDownloadState[];
  completed: number;
  failed: number;
  skipped: number;
  total: number;
}

const CONCURRENCY = 3;

export function usePlaylistDownload() {
  const [state, setState] = useState<PlaylistDownloadState>({
    isDownloading: false,
    songs: [],
    completed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
  });
  const abortRef = useRef<AbortController | null>(null);

  const updateSong = (songId: string, update: Partial<SongDownloadState>) => {
    setState((prev) => ({
      ...prev,
      songs: prev.songs.map((s) => (s.songId === songId ? { ...s, ...update } : s)),
    }));
  };

  const downloadPlaylist = useCallback(async (songs: Song[]) => {
    if (state.isDownloading) return;

    const controller = new AbortController();
    abortRef.current = controller;

    // Check which are already cached
    const cacheChecks = await Promise.all(
      songs.map(async (s) => ({ song: s, cached: await offlineCache.isCached(s.id) }))
    );

    const toDownload = cacheChecks.filter((c) => !c.cached).map((c) => c.song);
    const skipped = cacheChecks.filter((c) => c.cached).length;

    const songStates: SongDownloadState[] = songs.map((s) => ({
      songId: s.id,
      title: s.title,
      status: cacheChecks.find((c) => c.song.id === s.id)?.cached ? "skipped" : "pending",
      progress: cacheChecks.find((c) => c.song.id === s.id)?.cached ? 100 : 0,
    }));

    setState({
      isDownloading: true,
      songs: songStates,
      completed: 0,
      failed: 0,
      skipped,
      total: songs.length,
    });

    let completed = 0;
    let failed = 0;

    // Process in parallel batches
    const queue = [...toDownload];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        if (controller.signal.aborted) return;
        const song = queue.shift()!;

        try {
          // Use the song's streamUrl directly
          let resolved = song;

          if (!resolved.streamUrl) {
            updateSong(song.id, { status: "error" });
            failed++;
            setState((prev) => ({ ...prev, failed }));
            continue;
          }

          // 2. Download audio + cover
          updateSong(song.id, { status: "downloading", progress: 0 });
          await offlineCache.cacheSong(
            { ...song, streamUrl: resolved.streamUrl, coverUrl: resolved.coverUrl || song.coverUrl },
            (pct) => updateSong(song.id, { progress: pct })
          );

          updateSong(song.id, { status: "done", progress: 100 });
          completed++;
          setState((prev) => ({ ...prev, completed }));
        } catch (e) {
          console.error(`[playlist-dl] Failed: ${song.title}`, e);
          updateSong(song.id, { status: "error" });
          failed++;
          setState((prev) => ({ ...prev, failed }));
        }
      }
    });

    await Promise.all(workers);

    if (!controller.signal.aborted) {
      setState((prev) => ({ ...prev, isDownloading: false }));
    }
  }, [state.isDownloading]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isDownloading: false }));
  }, []);

  const overallProgress = state.total > 0
    ? Math.round(((state.completed + state.skipped) / state.total) * 100)
    : 0;

  return {
    ...state,
    overallProgress,
    downloadPlaylist,
    cancel,
  };
}
