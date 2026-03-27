import { usePlayerStore } from "@/stores/playerStore";
import { formatDuration } from "@/data/mockData";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Heart, ChevronDown, ListMusic, X, MoreHorizontal, PlusCircle, Disc3,
  Download, Check, Loader2, WifiOff, GripVertical, Trash2
} from "lucide-react";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { useEffect, useRef, useCallback, useState } from "react";
import { AudioVisualizer } from "./AudioVisualizer";
import { useRadioMetadata } from "@/hooks/useRadioMetadata";
import { offlineCache } from "@/lib/offlineCache";
import { deezerApi } from "@/lib/deezerApi";
import { jiosaavnApi } from "@/lib/jiosaavnApi";
import { useDominantColor } from "@/hooks/useDominantColor";

/* ── Shared glass styles — uses CSS custom properties for theme ── */
const glassStyle = {
  background: "hsl(var(--card) / 0.85)",
  backdropFilter: "blur(60px) saturate(1.6)",
  WebkitBackdropFilter: "blur(60px) saturate(1.6)",
  border: "1px solid hsl(var(--border) / 0.5)",
  boxShadow: "0 8px 32px hsl(0 0% 0% / 0.25), inset 0 1px 0 hsl(var(--foreground) / 0.05)",
};

const glassButtonStyle = {
  background: "hsl(var(--muted) / 0.5)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid hsl(var(--border) / 0.3)",
};

/* ─────────────────────────────────────────────
   Mini Player — Liquid Glass
   ───────────────────────────────────────────── */
export function MiniPlayer() {
  const {
    currentSong, isPlaying, progress, volume, shuffle, repeat,
    togglePlay, next, previous, setProgress, setVolume,
    toggleShuffle, cycleRepeat, toggleFullScreen, toggleLike, isLiked, closePlayer,
    _seekTime, crossfadeEnabled, crossfadeDuration
  } = usePlayerStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const crossfadeRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const preloadedSongIdRef = useRef<string | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSongIdRef = useRef<string | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const [playingFromCache, setPlayingFromCache] = useState(false);
  const resolveStep = usePlayerStore((s) => s.resolveStep);
  const setResolveStep = useCallback((step: string | null) => usePlayerStore.setState({ resolveStep: step }), []);

  const CROSSFADE_MS = crossfadeDuration * 1000;
  const FADE_STEP = 50;

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    audioRef.current.muted = false;
  }, [volume]);

  // ── Silent playback watchdog (iOS bug detector) ──
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTimeCheckRef = useRef<{ time: number; ts: number } | null>(null);

  useEffect(() => {
    if (watchdogRef.current) clearInterval(watchdogRef.current);
    if (!isPlaying || !currentSong) return;

    lastTimeCheckRef.current = null;

    watchdogRef.current = setInterval(() => {
      const audio = audioRef.current;
      if (!audio || audio.paused || !audio.src || audio.duration === 0) return;

      const now = Date.now();
      const currentTime = audio.currentTime;
      const prev = lastTimeCheckRef.current;

      if (prev) {
        const wallElapsed = now - prev.ts;
        const audioElapsed = (currentTime - prev.time) * 1000;

        // If wall clock advanced >3s but audio didn't move → stuck/silent
        if (wallElapsed > 3000 && audioElapsed < 500 && !audio.paused) {
          console.warn("[watchdog] Audio stuck — attempting reload");
          const src = audio.src;
          const time = audio.currentTime;
          audio.src = "";
          audio.load();
          // Small delay then reload
          setTimeout(() => {
            audio.src = src;
            audio.load();
            audio.currentTime = Math.max(0, time - 0.5);
            audio.volume = volume;
            audio.muted = false;
            audio.play().catch((e) => console.error("[watchdog] Reload play failed:", e));
          }, 100);
        }
      }

      lastTimeCheckRef.current = { time: currentTime, ts: now };
    }, 2500);

    return () => {
      if (watchdogRef.current) clearInterval(watchdogRef.current);
    };
  }, [isPlaying, currentSong?.id, volume]);

  // ── Separate play/pause control from track loading ──
  // Play/pause toggle for SAME track — no reload needed
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong || !audio.src) return;
    // Only handle play/pause for current track (not new loads)
    if (lastSongIdRef.current === currentSong.id) {
      if (isPlaying) {
        audio.play().catch(console.error);
      } else {
        audio.pause();
      }
    }
  }, [isPlaying]);

  // ── Main track loading logic — only fires on song change ──
  useEffect(() => {
    if (!audioRef.current || !currentSong) return;
    const audio = audioRef.current;
    const prevSongId = lastSongIdRef.current;
    const isNewTrack = prevSongId !== currentSong.id;

    if (!isNewTrack) return; // Same track — handled by play/pause effect above
    lastSongIdRef.current = currentSong.id;

    // Abort any in-flight load for a previous track
    loadAbortRef.current?.abort();
    const abortController = new AbortController();
    loadAbortRef.current = abortController;

    // Immediately stop current audio
    audio.pause();
    if (navigator.vibrate) navigator.vibrate(8);

    const loadAndPlay = async () => {
      let songToPlay = currentSong;

      // PRIORITY: check offline cache first
      const cachedUrl = await offlineCache.getCachedUrl(songToPlay.id);
      if (abortController.signal.aborted) return;

      if (cachedUrl) {
        const cachedCover = await offlineCache.getCachedCoverUrl(songToPlay.id);
        if (cachedCover) {
          songToPlay = { ...songToPlay, coverUrl: cachedCover };
          usePlayerStore.setState({ currentSong: songToPlay });
        }
      } else {
        // Resolve stream if needed
        const needsResolution =
          !songToPlay.streamUrl ||
          (songToPlay.id.startsWith("dz-") && songToPlay.streamUrl && (songToPlay.streamUrl.includes("cdn-preview") || songToPlay.streamUrl.includes("dzcdn.net")));

        if (needsResolution) {
          setResolveStep("Recherche Custom…");
          try {
            const resolved = await deezerApi.resolveFullStream(songToPlay, (step) => setResolveStep(step));
            if (abortController.signal.aborted) return;
            if (resolved.streamUrl && resolved.streamUrl !== songToPlay.streamUrl) {
              songToPlay = resolved;
              usePlayerStore.setState({ currentSong: resolved });
            }
          } catch (e) {
            console.error("[player] Stream resolution failed:", e);
          }
          setResolveStep(null);

          if (!songToPlay.streamUrl || songToPlay.streamUrl.includes("cdn-preview") || songToPlay.streamUrl.includes("dzcdn.net")) {
            console.warn("[player] No playable source for:", songToPlay.title);
            usePlayerStore.getState().next();
            return;
          }
        }
      }

      if (abortController.signal.aborted) return;

      setPlayingFromCache(!!cachedUrl);
      const srcToUse = cachedUrl || songToPlay.streamUrl;
      if (!srcToUse) return;

      if (crossfadeEnabled && prevSongId && audio.src && !audio.paused) {
        // Crossfade
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        const oldAudio = crossfadeRef.current!;
        oldAudio.src = audio.src;
        oldAudio.currentTime = audio.currentTime;
        oldAudio.volume = volume;
        oldAudio.play().catch(() => {});

        const steps = CROSSFADE_MS / FADE_STEP;
        let step = 0;
        fadeIntervalRef.current = setInterval(() => {
          step++;
          oldAudio.volume = Math.max(0, volume * (1 - step / steps));
          if (step >= steps) {
            oldAudio.pause();
            oldAudio.src = "";
            if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
          }
        }, FADE_STEP);

        // Load new track with fade in
        audio.src = srcToUse;
        audio.volume = 0;
        audio.muted = false;
        audio.play().catch((e) => {
          console.error("[player] Crossfade play failed:", e);
          setTimeout(() => audio.play().catch(() => {}), 200);
        });
        let fadeInStep = 0;
        const fadeInInterval = setInterval(() => {
          fadeInStep++;
          audio.volume = Math.min(volume, volume * (fadeInStep / steps));
          if (fadeInStep >= steps) {
            audio.volume = volume;
            clearInterval(fadeInInterval);
          }
        }, FADE_STEP);
      } else {
        // Direct load — minimal latency
        audio.src = srcToUse;
        audio.volume = volume;
        audio.muted = false;

        const onCanPlay = () => {
          audio.removeEventListener("canplay", onCanPlay);
          audio.volume = volume;
          audio.muted = false;
          audio.play().catch((e) => {
            console.error("[player] Play failed:", e);
            setTimeout(() => audio.play().catch(() => {}), 200);
          });
        };
        audio.addEventListener("canplay", onCanPlay, { once: true });

        // Safety timeout reduced to 2s
        setTimeout(() => {
          audio.removeEventListener("canplay", onCanPlay);
          if (audio.paused && usePlayerStore.getState().isPlaying) {
            audio.volume = volume;
            audio.muted = false;
            audio.play().catch(console.error);
          }
        }, 2000);
      }
    };

    loadAndPlay();
  }, [currentSong?.id]); // Only re-run when the track ID changes

  // ── Preload next track for instant transitions ──
  useEffect(() => {
    if (!currentSong) return;
    const { queue, shuffle } = usePlayerStore.getState();
    if (queue.length <= 1) return;

    const idx = queue.findIndex((s) => s.id === currentSong.id);
    const nextIdx = shuffle
      ? (idx + 1) % queue.length // For preload, just pick next sequential even in shuffle
      : (idx + 1) % queue.length;
    const nextSong = queue[nextIdx];
    if (!nextSong || nextSong.id === preloadedSongIdRef.current) return;

    // Preload in background
    const preloadNext = async () => {
      let src: string | null = null;

      // Check offline cache first
      const cachedUrl = await offlineCache.getCachedUrl(nextSong.id);
      if (cachedUrl) {
        src = cachedUrl;
      } else if (nextSong.id.startsWith("dz-") && (!nextSong.streamUrl || nextSong.streamUrl.includes("cdn-preview") || nextSong.streamUrl.includes("dzcdn.net"))) {
        try {
          const resolved = await deezerApi.resolveFullStream(nextSong);
          if (resolved.streamUrl && !resolved.streamUrl.includes("cdn-preview") && !resolved.streamUrl.includes("dzcdn.net")) {
            src = resolved.streamUrl;
            // Update the song in the queue with the resolved URL
            const currentQueue = usePlayerStore.getState().queue;
            const updatedQueue = currentQueue.map((s) => s.id === nextSong.id ? resolved : s);
            usePlayerStore.setState({ queue: updatedQueue });
          }
        } catch { /* silent */ }
      } else if (nextSong.streamUrl) {
        src = nextSong.streamUrl;
      }

      if (src && preloadRef.current) {
        preloadRef.current.src = src;
        preloadRef.current.load();
        preloadedSongIdRef.current = nextSong.id;
        console.log("[preload] Buffering next:", nextSong.title);
      }
    };

    // Delay preload slightly so it doesn't compete with current track loading
    const timer = setTimeout(preloadNext, 1500);
    return () => clearTimeout(timer);
  }, [currentSong?.id]);

  const preemptiveTriggeredRef = useRef(false);

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const t = audio.currentTime;
    // Use fractional time for smooth progress
    setProgress(t);

    // Preemptive crossfade: start next track before current ends
    const { crossfadeEnabled, crossfadeDuration, repeat } = usePlayerStore.getState();
    if (
      crossfadeEnabled &&
      !preemptiveTriggeredRef.current &&
      audio.duration > 0 &&
      audio.duration - audio.currentTime <= crossfadeDuration &&
      audio.duration - audio.currentTime > 0.5 &&
      repeat !== "one"
    ) {
      preemptiveTriggeredRef.current = true;

      // Start fading out current track
      const steps = (crossfadeDuration * 1000) / FADE_STEP;
      let step = 0;
      const fadeOutInterval = setInterval(() => {
        step++;
        if (audioRef.current) {
          audioRef.current.volume = Math.max(0, volume * (1 - step / steps));
        }
        if (step >= steps) {
          clearInterval(fadeOutInterval);
        }
      }, FADE_STEP);

      // Trigger next song (crossfade logic in the main effect will handle fade-in)
      next();
    }
  }, [setProgress, volume, next]);

  // Reset preemptive trigger when song changes
  useEffect(() => {
    preemptiveTriggeredRef.current = false;
  }, [currentSong?.id]);

  useEffect(() => {
    if (_seekTime !== null && audioRef.current) {
      audioRef.current.currentTime = _seekTime;
      usePlayerStore.setState({ _seekTime: null });
    }
  }, [_seekTime]);

  const isLive = currentSong ? currentSong.duration === 0 : false;
  const radioMeta = useRadioMetadata(currentSong?.streamUrl, isLive, isPlaying, currentSong?.title, currentSong?.coverUrl);
  const coverForColor = isLive ? (radioMeta?.coverUrl || currentSong?.coverUrl) : currentSong?.coverUrl;
  const miniDominantColor = useDominantColor(coverForColor);

  // ── Media Session API: lock screen metadata ──
  // IMPORTANT: Don't remove action handlers on cleanup — iOS loses the Now Playing session
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    // Set action handlers once (idempotent)
    navigator.mediaSession.setActionHandler("play", () => {
      usePlayerStore.getState().togglePlay();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      usePlayerStore.getState().togglePlay();
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      usePlayerStore.getState().previous();
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => {
      usePlayerStore.getState().next();
    });
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime != null && audioRef.current) {
        audioRef.current.currentTime = details.seekTime;
        usePlayerStore.getState().setProgress(details.seekTime);
      }
    });
  }, []); // Only once

  // Update metadata whenever song/radio changes
  useEffect(() => {
    if (!currentSong || !("mediaSession" in navigator)) return;

    const title = isLive && radioMeta?.title ? radioMeta.title : currentSong.title;
    const artist = isLive && radioMeta?.artist ? radioMeta.artist : currentSong.artist;
    const artwork = radioMeta?.coverUrl || currentSong.coverUrl;

    console.log(`[mediaSession] Updating: "${title}" — ${artist}`);

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: currentSong.album || "",
      artwork: artwork
        ? [
            { src: artwork, sizes: "96x96", type: "image/png" },
            { src: artwork, sizes: "128x128", type: "image/png" },
            { src: artwork, sizes: "192x192", type: "image/png" },
            { src: artwork, sizes: "256x256", type: "image/png" },
            { src: artwork, sizes: "384x384", type: "image/png" },
            { src: artwork, sizes: "512x512", type: "image/png" },
          ]
        : [],
    });

    // Keep playback state in sync
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [currentSong, isLive, radioMeta, isPlaying]);

  // Update position state for lock screen scrubber
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentSong || isLive) return;
    if ("setPositionState" in navigator.mediaSession && currentSong.duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: currentSong.duration,
          playbackRate: 1,
          position: Math.min(progress, currentSong.duration),
        });
      } catch { /* ignore */ }
    }
  }, [progress, currentSong, isLive]);

  const handleEnded = useCallback(() => {
    // If preemptive crossfade already triggered next, don't double-skip
    if (preemptiveTriggeredRef.current) return;
    const { repeat } = usePlayerStore.getState();
    if (repeat === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.volume = volume;
        audioRef.current.muted = false;
        audioRef.current.play().catch(console.error);
      }
    } else {
      console.log("[player] Track ended — advancing to next");
      next();
    }
  }, [next, volume]);

  const handleAudioError = useCallback(async () => {
    if (!audioRef.current || !currentSong) return;
    const audio = audioRef.current;
    console.error("[player] Audio error for:", currentSong.title, "readyState:", audio.readyState, "networkState:", audio.networkState);

    // Try local cache fallback
    const cachedUrl = await offlineCache.getCachedUrl(currentSong.id);
    if (cachedUrl && !audio.src.includes("blob:")) {
      console.warn("[player] Falling back to local cache");
      audio.src = cachedUrl;
      audio.load();
      audio.volume = volume;
      audio.muted = false;
      audio.play().catch(console.error);
      return;
    }

    // If we have a stream URL, retry once
    if (currentSong.streamUrl) {
      console.warn("[player] Retrying stream URL");
      audio.src = currentSong.streamUrl;
      audio.load();
      audio.volume = volume;
      audio.muted = false;
      setTimeout(() => {
        audio.play().catch((e) => {
          console.error("[player] Retry also failed:", e);
          // Skip to next track as last resort
          next();
        });
      }, 500);
    }
  }, [currentSong, volume, next]);

  if (!currentSong) return null;

  const progressPct = !isLive && currentSong.duration > 0 ? (progress / currentSong.duration) * 100 : 0;

  // ── Radio bubble mini-player ──
  if (isLive) {
    const bubbleCover = radioMeta?.coverUrl || currentSong.coverUrl;
    return (
      <>
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onError={handleAudioError}
          preload="auto"
        />
        <audio ref={crossfadeRef} preload="auto" />
        <audio ref={preloadRef} preload="auto" style={{ display: "none" }} />
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="fixed right-3 z-50"
          style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div
            className="relative w-14 h-14 rounded-full overflow-hidden cursor-pointer shadow-xl active:scale-90 transition-transform"
            onClick={toggleFullScreen}
            style={{
              boxShadow: miniDominantColor
                ? `0 4px 20px ${miniDominantColor}80, 0 0 0 2px hsl(0 0% 100% / 0.15)`
                : "0 4px 20px rgba(0,0,0,0.5), 0 0 0 2px hsl(0 0% 100% / 0.15)",
            }}
          >
            <img
              src={bubbleCover}
              alt={currentSong.title}
              className="w-full h-full object-cover"
            />
            {/* Play/Pause overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="text-white"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>
            </div>
            {/* Live pulse ring */}
            {isPlaying && (
              <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-30 pointer-events-none" />
            )}
          </div>
          {/* Close button */}
          <button
            onClick={closePlayer}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-secondary flex items-center justify-center border border-border shadow-md"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </motion.div>
      </>
    );
  }

  // ── Standard music mini-player ──
  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleAudioError}
        preload="auto"
      />
      <audio ref={crossfadeRef} preload="auto" />
      <audio ref={preloadRef} preload="auto" style={{ display: "none" }} />
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="fixed left-0 right-0 z-50 md:bottom-0 px-2 pb-1"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            ...glassStyle,
            ...(miniDominantColor ? {
              background: `linear-gradient(135deg, ${miniDominantColor}, hsl(var(--card) / 0.9))`,
              transition: "background 0.8s ease-in-out",
            } : {}),
          }}
        >
          {/* Progress line */}
          <div className="h-[3px] w-full" style={{ background: "hsl(var(--muted))" }}>
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex items-center gap-3 px-3 py-2.5">
            <div
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
              onClick={toggleFullScreen}
            >
              <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
                <img
                  src={currentSong.coverUrl}
                  alt={currentSong.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate text-foreground leading-tight">
                  {currentSong.title}
                </p>
                <div className="text-[11px] truncate text-muted-foreground leading-tight mt-0.5 relative overflow-hidden h-4">
                  <AnimatePresence mode="wait">
                    {resolveStep ? (
                      <motion.span
                        key={resolveStep}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute inset-0 inline-flex items-center gap-1 text-primary"
                      >
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        <span className="font-semibold text-[10px]">{resolveStep}</span>
                      </motion.span>
                    ) : (
                      <motion.span
                        key="artist"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute inset-0 inline-flex items-center truncate"
                      >
                        {currentSong.artist}
                        {playingFromCache && (
                          <span className="ml-1.5 inline-flex items-center gap-1 text-emerald-400">
                            <WifiOff className="w-2.5 h-2.5" />
                            <span className="font-semibold text-[10px]">OFFLINE</span>
                          </span>
                        )}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                onClick={() => toggleLike(currentSong)}
                className="p-2 active:scale-90 transition-transform"
              >
                <Heart className={`w-4 h-4 ${isLiked(currentSong.id) ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
              <button
                onClick={togglePlay}
                className="p-2 text-foreground active:scale-90 transition-transform"
              >
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
              </button>
              <button
                onClick={next}
                className="p-2 text-foreground active:scale-90 transition-transform"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
              <button
                onClick={closePlayer}
                className="p-2 text-muted-foreground active:scale-90 transition-transform"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ─────────────────────────────────────────────
   Radio Fullscreen Player — Liquid Glass
   ───────────────────────────────────────────── */
function RadioFullScreen({ onClose }: { onClose: () => void }) {
  const {
    currentSong, isPlaying, togglePlay, toggleLike, isLiked
  } = usePlayerStore();
  const [addingToLib, setAddingToLib] = useState(false);
  const [addedToLib, setAddedToLib] = useState(false);
  const radioMeta = useRadioMetadata(currentSong?.streamUrl, true, isPlaying, currentSong?.title, currentSong?.coverUrl);
  const coverUrl = radioMeta?.coverUrl || currentSong?.coverUrl;
  const dominantColor = useDominantColor(coverUrl);

  if (!currentSong) return null;
  const liked = isLiked(currentSong.id);
  const stationName = currentSong.title;
  const genre = currentSong.artist || "Radio";
  const bgColor = dominantColor || "hsl(0 0% 4%)";

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 220 }}
      drag="y"
      dragDirectionLock
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.05, bottom: 0.8 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 80 || info.velocity.y > 300) onClose();
      }}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
      style={{ background: bgColor, transition: "background 1s ease-in-out", touchAction: "pan-x" }}
    >
      {/* Dynamic blurred BG */}
      <div className="absolute inset-0 overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={coverUrl}
            src={coverUrl}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full object-cover scale-[2] blur-[120px]"
          />
        </AnimatePresence>
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 0%, hsl(0 0% 0% / 0.3) 60%, hsl(0 0% 0% / 0.6) 100%)" }} />
      </div>

      {/* Drag handle */}
      <div className="relative z-10 flex justify-center pb-1" style={{ paddingTop: "calc(env(safe-area-inset-top, 12px) + 8px)" }}>
        <div className="w-10 h-1 rounded-full bg-foreground/20" />
      </div>

      {/* Top bar — matches music player style */}
      <div className="relative z-10 flex items-center justify-between px-5 pb-2">
        <button onClick={onClose} className="p-1 active:scale-90 transition-transform">
          <ChevronDown className="w-7 h-7 text-foreground" />
        </button>
        <div className="flex-1 text-center px-4">
          <div className="flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] font-bold text-primary tracking-widest uppercase">EN DIRECT</span>
          </div>
          <p className="text-[12px] font-bold text-foreground truncate">{stationName}</p>
        </div>
        <button onClick={() => {}} className="p-1 active:scale-90 transition-transform">
          <MoreHorizontal className="w-6 h-6 text-foreground" />
        </button>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col px-7 pb-8">
        {/* Cover art — large, matching music player */}
        <div className="flex-1 flex items-center justify-center py-4">
          <AnimatePresence mode="wait">
            <motion.img
              key={coverUrl}
              src={coverUrl}
              alt={stationName}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full max-w-[340px] aspect-square rounded-xl object-cover"
              style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
            />
          </AnimatePresence>
        </div>

        {/* Title + Artist + Like */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-extrabold text-foreground truncate leading-tight">
              {radioMeta?.title || stationName}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[15px] text-foreground/60 truncate">
                {radioMeta?.artist || genre}
              </p>
              <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                LIVE
              </span>
            </div>
          </div>
          <button
            onClick={async () => {
              if (addingToLib || addedToLib) return;
              const artist = radioMeta?.artist;
              const title = radioMeta?.title;
              if (!artist || !title) return;
              setAddingToLib(true);
              try {
                // Search Deezer for the track
                const results = await deezerApi.searchTracks(`${artist} ${title}`, 1);
                if (results.length > 0) {
                  const track = results[0];
                  // Resolve HD stream via JioSaavn
                  const hdResults = await jiosaavnApi.search(`${track.title} ${track.artist}`, 1);
                  const song = {
                    id: track.id,
                    title: track.title,
                    artist: track.artist,
                    album: track.album || "",
                    duration: track.duration,
                    coverUrl: track.coverUrl,
                    streamUrl: hdResults.length > 0 ? hdResults[0].streamUrl : "",
                    liked: true,
                  };
                  toggleLike(song);
                  setAddedToLib(true);
                  setTimeout(() => setAddedToLib(false), 3000);
                }
              } catch {
                // silent
              } finally {
                setAddingToLib(false);
              }
            }}
            className="p-1 active:scale-90 transition-transform"
          >
            {addingToLib ? (
              <Loader2 className="w-7 h-7 text-foreground/40 animate-spin" />
            ) : addedToLib ? (
              <Check className="w-7 h-7 text-primary" />
            ) : (
              <PlusCircle className="w-7 h-7 text-foreground/40" />
            )}
          </button>
        </div>


        {/* Transport — large play/pause centered, matching music player */}
        <div className="flex items-center justify-center w-full mb-6">
          <button
            onClick={togglePlay}
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center active:scale-90 transition-transform bg-foreground"
          >
            {isPlaying ? (
              <Pause className="w-9 h-9 text-background fill-current" />
            ) : (
              <Play className="w-9 h-9 text-background fill-current ml-1" />
            )}
          </button>
        </div>

        {/* Bottom actions */}
        <div className="flex items-center justify-between">
          <button className="p-1 active:scale-90 transition-transform">
            <Heart className={`w-5 h-5 ${liked ? "fill-primary text-primary" : "text-foreground/40"}`}
              onClick={() => toggleLike(currentSong)}
            />
          </button>
          <div />
          <div />
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Music Fullscreen Player — Liquid Glass
   ───────────────────────────────────────────── */
function MusicFullScreen({ onClose }: { onClose: () => void }) {
  const {
    currentSong, isPlaying, progress, shuffle, repeat, queue,
    togglePlay, next, previous, seekTo: storeSeekTo,
    toggleShuffle, cycleRepeat, toggleLike, isLiked, play, setQueue,
    crossfadeEnabled, setCrossfadeEnabled, crossfadeDuration, setCrossfadeDuration,
  } = usePlayerStore();

  const [showQueue, setShowQueue] = useState(false);
  const resolveStep = usePlayerStore((s) => s.resolveStep);
  const dominantColor = useDominantColor(currentSong?.coverUrl);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const { isCached, isDownloading, progress: dlProgress, download, remove } = useOfflineCache(currentSong?.id);

  if (!currentSong) return null;

  const liked = isLiked(currentSong.id);
  const progressPct = currentSong.duration > 0 ? (progress / currentSong.duration) * 100 : 0;
  const bgColor = dominantColor || "hsl(0 0% 4%)";


  const seekFromX = (clientX: number) => {
    const bar = progressBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = Math.floor(pct * currentSong.duration);
    storeSeekTo(time);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => seekFromX(e.clientX);

  const handleTouchSeek = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsSeeking(true);
    seekFromX(e.touches[0].clientX);
  };

  const handleTouchMoveSeek = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    seekFromX(e.touches[0].clientX);
  };

  const handleTouchEndSeek = () => {
    setIsSeeking(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 220 }}
      drag="y"
      dragDirectionLock
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.05, bottom: 0.8 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 80 || info.velocity.y > 300) onClose();
      }}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
      style={{ background: bgColor, transition: "background 1s ease-in-out", touchAction: "pan-x" }}
    >
      {/* Dynamic blurred BG */}
      <div className="absolute inset-0 overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={currentSong.coverUrl}
            src={currentSong.coverUrl}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full object-cover scale-[2] blur-[120px]"
          />
        </AnimatePresence>
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 0%, hsl(var(--background) / 0.4) 60%, hsl(var(--background) / 0.7) 100%)" }} />
      </div>

      {/* Drag handle indicator */}
      <div className="relative z-10 flex justify-center pb-1" style={{ paddingTop: "calc(env(safe-area-inset-top, 12px) + 8px)" }}>
        <div className="w-10 h-1 rounded-full bg-foreground/20" />
      </div>

      {/* Top bar - Spotify style */}
      <div className="relative z-10 flex items-center justify-between px-5 pb-2">
        <button onClick={onClose} className="p-1 active:scale-90 transition-transform">
          <ChevronDown className="w-7 h-7 text-foreground" />
        </button>
        <div className="flex-1 text-center px-4">
          <p className="text-[11px] font-medium text-foreground/60 tracking-wider uppercase">
            En lecture depuis
          </p>
          <p className="text-[12px] font-bold text-foreground truncate">
            {currentSong.album || "Ma bibliothèque"}
          </p>
        </div>
        <button onClick={() => setShowQueue(!showQueue)} className="p-1 active:scale-90 transition-transform">
          {showQueue ? <X className="w-6 h-6 text-foreground" /> : <ListMusic className="w-6 h-6 text-foreground" />}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showQueue ? (
          <motion.div
            key="queue"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 flex-1 overflow-y-auto px-5 pb-4 scrollbar-hide"
          >
            {/* Now Playing */}
            <div className="sticky top-0 z-10 pt-2 pb-3" style={{ background: `${bgColor}ee` }}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/40 mb-2">En cours de lecture</h3>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-foreground/10 border border-foreground/10">
                <div className="relative">
                  <img src={currentSong.coverUrl} alt="" className="w-14 h-14 rounded-xl object-cover shadow-lg" />
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-background/30">
                    {isPlaying && <AudioVisualizer isPlaying={isPlaying} />}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-primary truncate">{currentSong.title}</p>
                  <p className="text-xs text-foreground/50 truncate">{currentSong.artist}</p>
                </div>
                <span className="text-xs text-foreground/40 tabular-nums">{formatDuration(currentSong.duration)}</span>
              </div>
            </div>

            {/* Upcoming */}
            {(() => {
              const currentIdx = queue.findIndex((s) => s.id === currentSong.id);
              const upcoming = currentIdx >= 0 ? queue.slice(currentIdx + 1) : [];
              const played = currentIdx > 0 ? queue.slice(0, currentIdx) : [];

              return (
                <>
                  {upcoming.length > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/40">
                          À suivre · {upcoming.length} titre{upcoming.length > 1 ? "s" : ""}
                        </h3>
                        <div className="flex items-center gap-1.5">
                          {upcoming.length > 0 && (
                            <button
                              onClick={() => {
                                setQueue(currentSong ? [currentSong] : []);
                              }}
                              className="text-[10px] font-semibold text-destructive/70 hover:text-destructive px-2 py-1 rounded-full bg-destructive/10 active:scale-95 transition-all flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              Vider
                            </button>
                          )}
                          {queue.length > 1 && (
                            <button
                              onClick={() => {
                                const shuffled = [...upcoming].sort(() => Math.random() - 0.5);
                                const newQueue = [...played, currentSong, ...shuffled];
                                setQueue(newQueue);
                              }}
                              className="text-[10px] font-semibold text-primary/70 hover:text-primary px-2 py-1 rounded-full bg-primary/10 active:scale-95 transition-all flex items-center gap-1"
                            >
                              <Shuffle className="w-3 h-3" />
                              Mélanger
                            </button>
                          )}
                        </div>
                      </div>
                      <Reorder.Group
                        axis="y"
                        values={upcoming}
                        onReorder={(newUpcoming) => {
                          const newQueue = [...played, currentSong, ...newUpcoming];
                          setQueue(newQueue);
                        }}
                        className="space-y-0.5"
                      >
                        {upcoming.map((song, i) => (
                          <Reorder.Item
                            key={song.id}
                            value={song}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.02 }}
                            whileDrag={{ scale: 1.03, backgroundColor: "hsl(var(--foreground) / 0.08)", borderRadius: 12, boxShadow: "0 8px 30px hsl(0 0% 0% / 0.2)" }}
                            className="group cursor-grab active:cursor-grabbing"
                            style={{ touchAction: "pan-x" }}
                          >
                            <div
                              onClick={() => { play(song); setQueue(queue); }}
                              className="w-full flex items-center gap-2 p-2.5 rounded-xl text-left hover:bg-foreground/5 active:bg-foreground/10 transition-colors"
                            >
                              <GripVertical className="w-4 h-4 text-foreground/20 shrink-0 touch-none" />
                              <span className="w-4 text-center text-[11px] text-foreground/30 tabular-nums font-medium">{i + 1}</span>
                              <img src={song.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover shadow" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] text-foreground truncate font-medium">{song.title}</p>
                                <p className="text-[11px] text-foreground/40 truncate">{song.artist}</p>
                              </div>
                              <span className="text-[11px] text-foreground/30 tabular-nums">{formatDuration(song.duration)}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newQueue = queue.filter((s) => s.id !== song.id);
                                  setQueue(newQueue);
                                }}
                                className="p-1 rounded-full opacity-0 group-hover:opacity-100 text-foreground/30 hover:text-destructive transition-all active:scale-90"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
                    </div>
                  )}

                  {played.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/20 mb-2">
                        Déjà joué · {played.length}
                      </h3>
                      <div className="space-y-0.5">
                        {played.map((song) => (
                          <button
                            key={song.id}
                            onClick={() => { play(song); setQueue(queue); }}
                            className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-foreground/5 transition-colors opacity-40 hover:opacity-70"
                          >
                            <img src={song.coverUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] text-foreground truncate">{song.title}</p>
                              <p className="text-[10px] text-foreground/40 truncate">{song.artist}</p>
                            </div>
                            <span className="text-[10px] text-foreground/30 tabular-nums">{formatDuration(song.duration)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {upcoming.length === 0 && played.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-foreground/30">
                      <ListMusic className="w-10 h-10 mb-3 opacity-50" />
                      <p className="text-sm font-medium">File d'attente vide</p>
                      <p className="text-xs mt-1 opacity-60">Ajoutez des morceaux depuis la recherche</p>
                    </div>
                  )}
                </>
              );
            })()}
          </motion.div>
        ) : (
          <motion.div
            key="player"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 flex-1 flex flex-col px-7 pb-8"
          >
            {/* Cover art - large, Spotify style */}
            <div className="flex-1 flex items-center justify-center py-4">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentSong.coverUrl}
                  src={currentSong.coverUrl}
                  alt={currentSong.title}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="w-full max-w-[340px] aspect-square rounded-xl object-cover"
                  style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
                />
              </AnimatePresence>
            </div>

            {/* Title + Artist + Like */}
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="min-w-0 flex-1">
                <h2 className="text-[22px] font-extrabold text-foreground truncate leading-tight">
                  {currentSong.title}
                </h2>
                <div className="flex items-center gap-2 mt-0.5 relative overflow-hidden h-6">
                  <AnimatePresence mode="wait">
                    {resolveStep ? (
                      <motion.span
                        key={resolveStep}
                        initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="absolute inset-0 inline-flex items-center gap-1.5 text-primary"
                      >
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="font-semibold text-[13px]">{resolveStep}</span>
                      </motion.span>
                    ) : (
                      <motion.span
                        key="artist-badge"
                        initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="absolute inset-0 inline-flex items-center gap-2"
                      >
                        <p className="text-[15px] text-foreground/60 truncate">
                          {currentSong.artist}
                        </p>
                        {isCached ? (
                          <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <WifiOff className="w-2.5 h-2.5" />
                            OFFLINE
                          </span>
                        ) : currentSong.resolvedViaCustom ? (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-secondary/80 text-secondary-foreground border border-secondary">
                            Custom
                          </span>
                        ) : currentSong.streamUrl && !currentSong.streamUrl.includes("dzcdn.net") && currentSong.id.startsWith("dz-") ? (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                            HD
                          </span>
                        ) : currentSong.id.startsWith("dz-") ? (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive border border-destructive/30">
                            No HD
                          </span>
                        ) : null}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 1.3 }}
                onClick={() => {
                  toggleLike(currentSong);
                  if (navigator.vibrate) navigator.vibrate(10);
                }}
                className="p-1 transition-transform"
              >
                <motion.div
                  animate={liked ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  <Heart className={`w-7 h-7 ${liked ? "fill-primary text-primary drop-shadow-[0_0_10px_hsl(141_73%_42%/0.4)]" : "text-foreground/40"}`} />
                </motion.div>
              </motion.button>
            </div>

            {/* Progress bar - ultra premium with time preview */}
            <div className="mb-5">
              <div
                ref={progressBarRef}
                className="h-[5px] rounded-full cursor-pointer relative group py-3 -my-3"
                style={{ touchAction: "none" }}
                onClick={handleSeek}
                onTouchStart={handleTouchSeek}
                onTouchMove={handleTouchMoveSeek}
                onTouchEnd={handleTouchEndSeek}
                onMouseDown={() => setIsSeeking(true)}
                onMouseUp={() => setIsSeeking(false)}
                onMouseLeave={() => setIsSeeking(false)}
              >
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[5px] rounded-full" style={{ background: "hsl(var(--muted))" }}>
                  <div
                    className="h-full rounded-full relative"
                    style={{
                      width: `${progressPct}%`,
                      background: "linear-gradient(90deg, hsl(141 73% 42% / 0.8), hsl(0 0% 100% / 0.85))",
                      transition: isSeeking ? "none" : "width 0.3s linear",
                    }}
                  >
                    {/* Thumb with glow */}
                    <motion.div
                      animate={{ scale: isSeeking ? 1 : 0.6 }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-[16px] h-[16px] rounded-full bg-foreground"
                      style={{
                        boxShadow: isSeeking
                          ? "0 0 12px hsl(141 73% 42% / 0.5), 0 2px 8px rgba(0,0,0,0.3)"
                          : "0 2px 6px rgba(0,0,0,0.3)",
                        transition: "box-shadow 0.2s",
                      }}
                    />
                    {/* Time preview bubble */}
                    <AnimatePresence>
                      {isSeeking && (
                        <motion.div
                          initial={{ opacity: 0, y: 5, scale: 0.8 }}
                          animate={{ opacity: 1, y: -8, scale: 1 }}
                          exit={{ opacity: 0, y: 5, scale: 0.8 }}
                          className="absolute -right-5 -top-10 px-2 py-1 rounded-lg text-[11px] font-bold text-foreground tabular-nums"
                          style={{
                            background: "hsl(var(--card) / 0.9)",
                            backdropFilter: "blur(12px)",
                            WebkitBackdropFilter: "blur(12px)",
                            border: "1px solid hsl(var(--border))",
                          }}
                        >
                          {formatDuration(Math.floor(progress))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              <div className="flex justify-between mt-1.5 text-[11px] text-foreground/50 tabular-nums font-medium">
                <span>{formatDuration(Math.floor(progress))}</span>
                <span>-{formatDuration(Math.max(0, currentSong.duration - Math.floor(progress)))}</span>
              </div>
            </div>

            {/* Transport controls — ultra premium */}
            <div className="flex items-center justify-between w-full mb-6">
              <motion.button whileTap={{ scale: 0.85 }} onClick={toggleShuffle} className="transition-all">
                <Shuffle className={`w-6 h-6 ${shuffle ? "text-primary drop-shadow-[0_0_8px_hsl(141_73%_42%/0.5)]" : "text-foreground/50"}`} />
              </motion.button>
              <motion.button whileTap={{ scale: 0.8 }} onClick={previous} className="transition-all">
                <SkipBack className="w-9 h-9 text-foreground fill-current" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => {
                  togglePlay();
                  if (navigator.vibrate) navigator.vibrate(8);
                }}
                className="w-[76px] h-[76px] rounded-full flex items-center justify-center transition-all bg-foreground"
                style={{
                  boxShadow: isPlaying
                    ? "0 0 30px hsl(var(--primary) / 0.25), 0 8px 30px hsl(0 0% 0% / 0.3)"
                    : "0 8px 30px hsl(0 0% 0% / 0.3)",
                }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isPlaying ? (
                    <motion.div key="pause" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <Pause className="w-9 h-9 text-background fill-current" />
                    </motion.div>
                  ) : (
                    <motion.div key="play" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <Play className="w-9 h-9 text-background fill-current ml-1" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
              <motion.button whileTap={{ scale: 0.8 }} onClick={next} className="transition-all">
                <SkipForward className="w-9 h-9 text-foreground fill-current" />
              </motion.button>
              <motion.button whileTap={{ scale: 0.85 }} onClick={cycleRepeat} className="transition-all">
                {repeat === "one" ? (
                  <Repeat1 className="w-6 h-6 text-primary drop-shadow-[0_0_8px_hsl(141_73%_42%/0.5)]" />
                ) : (
                  <Repeat className={`w-6 h-6 ${repeat === "all" ? "text-primary drop-shadow-[0_0_8px_hsl(141_73%_42%/0.5)]" : "text-foreground/50"}`} />
                )}
              </motion.button>
            </div>

            {/* Bottom actions */}
            <div className="flex items-center justify-between">
              <motion.button whileTap={{ scale: 1.2 }} className="p-1.5 transition-transform">
                <motion.div animate={liked ? { scale: [1, 1.25, 1] } : {}} transition={{ duration: 0.3 }}>
                  <Heart className={`w-6 h-6 ${liked ? "fill-primary text-primary" : "text-foreground/40"}`}
                    onClick={() => { toggleLike(currentSong); if (navigator.vibrate) navigator.vibrate(10); }}
                  />
                </motion.div>
              </motion.button>


              {/* Download button */}
              <button
                onClick={() => {
                  if (isCached) {
                    remove(currentSong.id);
                  } else if (!isDownloading) {
                    download(currentSong);
                  }
                }}
                className={`relative p-1.5 active:scale-90 transition-transform ${
                  isCached ? "text-primary" : isDownloading ? "text-primary/60" : "text-foreground/40"
                }`}
              >
                {isDownloading ? (
                  <div className="relative">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-bold text-primary tabular-nums">
                      {dlProgress}%
                    </span>
                  </div>
                ) : isCached ? (
                  <Check className="w-6 h-6" />
                ) : (
                  <Download className="w-6 h-6" />
                )}
              </button>

              {/* Auto mix toggle */}
              {(
                <button
                  onClick={() => setCrossfadeEnabled(!crossfadeEnabled)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide uppercase transition-all active:scale-95 ${
                    crossfadeEnabled
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "text-foreground/40 border border-foreground/10"
                  }`}
                >
                  <Disc3 className={`w-4 h-4 ${crossfadeEnabled ? "animate-spin" : ""}`} style={crossfadeEnabled ? { animationDuration: "3s" } : {}} />
                  Auto mix
                </button>
              )}

              <button onClick={() => setShowQueue(true)} className="p-1.5 active:scale-90 transition-transform">
                <ListMusic className="w-6 h-6 text-foreground/50" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Fullscreen Router ─── */
export function FullScreenPlayer() {
  const { currentSong, fullScreen, toggleFullScreen } = usePlayerStore();

  if (!currentSong || !fullScreen) return null;

  const isLive = currentSong.duration === 0;

  return isLive ? (
    <RadioFullScreen onClose={toggleFullScreen} />
  ) : (
    <MusicFullScreen onClose={toggleFullScreen} />
  );
}
