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
import { Music } from "lucide-react";
import { useDominantColor } from "@/hooks/useDominantColor";

/* ── Shared glass styles — uses CSS custom properties for theme ── */
const glassStyle = {
  background: "hsl(var(--card) / 0.92)",
  backdropFilter: "blur(60px) saturate(1.8)",
  WebkitBackdropFilter: "blur(60px) saturate(1.8)",
  border: "1px solid hsl(var(--border) / 0.4)",
  boxShadow: "0 -2px 20px hsl(0 0% 0% / 0.15), 0 8px 32px hsl(0 0% 0% / 0.25)",
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
    currentSong, isPlaying, progress, volume, shuffle, repeat, fullScreen,
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
  const audioDuration = usePlayerStore((s) => s.audioDuration);
  const nextPreloaded = usePlayerStore((s) => s.nextPreloaded);

  const CROSSFADE_MS = crossfadeDuration * 1000;
  const FADE_STEP = 50;

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
    audioRef.current.muted = false;
  }, [volume]);

  // ── Web Lock API — prevent iOS/browser from suspending the tab ──
  useEffect(() => {
    if (!isPlaying || !currentSong) return;
    if (!("locks" in navigator)) return;

    let released = false;
    (navigator as any).locks.request(
      "vootify-audio-bg",
      { mode: "exclusive" },
      () => new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (released) { clearInterval(check); resolve(); }
        }, 2000);
      })
    );
    return () => { released = true; };
  }, [isPlaying, currentSong?.id]);

  // ── Visibility change — resume playback + re-sync media session ──
  // Handles: returning from background, phone call interruption, app switching
  useEffect(() => {
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const audio = audioRef.current;
      const state = usePlayerStore.getState();
      if (!audio || !state.isPlaying || !state.currentSong) return;

      // Small delay to let iOS audio session re-activate
      resumeTimer = setTimeout(() => {
        if (audio.paused && audio.src) {
          const isRadio = state.currentSong && state.currentSong.duration === 0;
          console.log("[bg-resume] Resuming", isRadio ? "radio stream" : "track");

          if (isRadio) {
            // Radio: reload stream to get fresh data (stale buffer = silence)
            const src = audio.src;
            audio.src = "";
            audio.src = src;
            audio.load();
          }

          audio.volume = volume;
          audio.muted = false;
          audio.play().catch((e) => {
            console.warn("[bg-resume] Play failed, retrying:", e);
            setTimeout(() => audio.play().catch(console.error), 500);
          });
        }
        // Re-sync media session state
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "playing";
        }
      }, 300);
    };

    // Handle audio interruptions (phone calls, Siri, etc.)
    const handleInterrupt = () => {
      const audio = audioRef.current;
      if (!audio) return;
      const state = usePlayerStore.getState();
      // If we were playing but got paused externally → mark for resume
      if (state.isPlaying && audio.paused) {
        console.log("[interrupt] Audio paused externally — will resume on focus");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    // 'pause' event on audio catches OS-level interruptions
    audioRef.current?.addEventListener("pause", handleInterrupt);

    return () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [volume]);

  // ── Watchdog — detect stuck audio, throttled in background ──
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTimeCheckRef = useRef<{ time: number; ts: number } | null>(null);

  useEffect(() => {
    if (watchdogRef.current) clearInterval(watchdogRef.current);
    if (!isPlaying || !currentSong) return;

    lastTimeCheckRef.current = null;

    const runWatchdog = () => {
      if (watchdogRef.current) clearInterval(watchdogRef.current);
      // Longer interval = less CPU
      const interval = document.visibilityState === "visible" ? 5000 : 10000;
      watchdogRef.current = setInterval(() => {
        const audio = audioRef.current;
        if (!audio || audio.paused || !audio.src || !isFinite(audio.duration)) return;

        const now = Date.now();
        const ct = audio.currentTime;
        const prev = lastTimeCheckRef.current;

        if (prev) {
          const wall = now - prev.ts;
          const audioD = (ct - prev.time) * 1000;
          // Stuck detection: wall advanced but audio didn't
          if (wall > 5000 && audioD < 500 && !audio.paused) {
            console.warn("[watchdog] Audio stuck — reloading");
            const src = audio.src;
            const pos = ct;
            audio.src = "";
            setTimeout(() => {
              audio.src = src;
              audio.currentTime = Math.max(0, pos - 0.3);
              audio.volume = volume;
              audio.muted = false;
              audio.play().catch(console.error);
            }, 80);
          }
        }
        lastTimeCheckRef.current = { time: ct, ts: now };
      }, interval);
    };

    runWatchdog();
    const onVis = () => runWatchdog();
    document.addEventListener("visibilitychange", onVis);

    // ── Network recovery: auto-reconnect when connection returns ──
    const handleOnline = () => {
      const audio = audioRef.current;
      const state = usePlayerStore.getState();
      if (!audio || !state.isPlaying || !state.currentSong) return;
      if (audio.paused || audio.readyState < 2) {
        console.log("[network] Back online — reconnecting audio");
        const isRadio = state.currentSong.duration === 0;
        const src = audio.src;
        if (isRadio) {
          // Radio: full reload for fresh stream
          audio.src = "";
          audio.src = src;
          audio.load();
        }
        audio.volume = volume;
        audio.muted = false;
        audio.play().catch(console.error);
      }
    };
    window.addEventListener("online", handleOnline);

    return () => {
      if (watchdogRef.current) clearInterval(watchdogRef.current);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", handleOnline);
    };
  }, [isPlaying, currentSong?.id, volume]);

  // ── Separate play/pause control from track loading ──
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong || !audio.src) return;
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

    if (!isNewTrack) return;
    lastSongIdRef.current = currentSong.id;
    usePlayerStore.setState({ nextPreloaded: false, audioDuration: 0 });

    // Abort any in-flight load
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;

    audio.pause();
    if (navigator.vibrate) navigator.vibrate(8);

    const loadAndPlay = async () => {
      let songToPlay = currentSong;

      const cachedUrl = await offlineCache.getCachedUrl(songToPlay.id);
      if (ac.signal.aborted) return;

      if (cachedUrl) {
        const cachedCover = await offlineCache.getCachedCoverUrl(songToPlay.id);
        if (cachedCover) {
          songToPlay = { ...songToPlay, coverUrl: cachedCover };
          usePlayerStore.setState({ currentSong: songToPlay });
        }
      } else {
        // If no stream URL, skip to next
        if (!songToPlay.streamUrl) {
          console.warn("[player] No playable source for:", songToPlay.title);
          usePlayerStore.getState().next();
          return;
        }
      }

      if (ac.signal.aborted) return;

      setPlayingFromCache(!!cachedUrl);
      const srcToUse = cachedUrl || songToPlay.streamUrl;
      if (!srcToUse) return;

      // ── Use preloaded audio element for gapless transition ──
      if (
        preloadedSongIdRef.current === currentSong.id &&
        preloadRef.current?.src &&
        !crossfadeEnabled
      ) {
        // Swap: preloaded → main, old main → preload slot
        const preloaded = preloadRef.current;
        const oldMain = audio;
        // Transfer event listeners by swapping refs
        preloadRef.current = oldMain;
        audioRef.current = preloaded;
        // Set up events on new main
        preloaded.onended = handleEnded;
        preloaded.onerror = handleAudioError;
        preloaded.ontimeupdate = handleTimeUpdate;
        preloaded.volume = volume;
        preloaded.muted = false;
        preloaded.play().catch((e) => {
          console.error("[player] Gapless play failed:", e);
          setTimeout(() => preloaded.play().catch(() => {}), 200);
        });
        // Clean old main
        oldMain.onended = null;
        oldMain.onerror = null;
        oldMain.ontimeupdate = null;
        oldMain.pause();
        oldMain.removeAttribute("src");
        preloadedSongIdRef.current = null;
        return;
      }

      preloadedSongIdRef.current = null;

      if (crossfadeEnabled && prevSongId && audio.src && !audio.paused) {
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        const oldAudio = crossfadeRef.current!;
        oldAudio.src = audio.src;
        oldAudio.currentTime = audio.currentTime;
        oldAudio.volume = volume;
        oldAudio.play().catch(() => {});

        // Exponential fade curves for smooth Apple Music-style transitions
        const steps = CROSSFADE_MS / FADE_STEP;
        let step = 0;
        fadeIntervalRef.current = setInterval(() => {
          step++;
          const t = step / steps; // 0→1
          // Equal-power crossfade: energy-preserving curves
          const fadeOut = Math.cos(t * Math.PI * 0.5); // cos curve: smooth deceleration
          const fadeIn = Math.sin(t * Math.PI * 0.5);  // sin curve: smooth acceleration
          oldAudio.volume = Math.max(0, volume * fadeOut);
          audio.volume = Math.min(volume, volume * fadeIn);
          if (step >= steps) {
            oldAudio.pause();
            oldAudio.removeAttribute("src");
            audio.volume = volume;
            if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
          }
        }, FADE_STEP);

        audio.src = srcToUse;
        audio.volume = 0;
        audio.muted = false;
        audio.play().catch((e) => {
          console.error("[player] Crossfade play failed:", e);
          setTimeout(() => audio.play().catch(() => {}), 200);
        });
      } else {
        // Direct load — instant play
        audio.src = srcToUse;
        audio.volume = volume;
        audio.muted = false;
        audio.play().catch((e) => {
          console.warn("[player] Immediate play failed, waiting canplay:", e);
          const onCanPlay = () => {
            audio.removeEventListener("canplay", onCanPlay);
            audio.volume = volume;
            audio.muted = false;
            audio.play().catch(console.error);
          };
          audio.addEventListener("canplay", onCanPlay, { once: true });
        });

        // Safety timeout — shorter for streaming-grade responsiveness
        setTimeout(() => {
          if (audio.paused && usePlayerStore.getState().isPlaying) {
            audio.volume = volume;
            audio.muted = false;
            audio.play().catch(console.error);
          }
        }, 300);
      }
    };

    loadAndPlay();
  }, [currentSong?.id]);

  // ── Batch preload next 3 tracks for zero-latency transitions ──
  const preloadedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentSong) return;
    const { queue } = usePlayerStore.getState();
    if (queue.length <= 1) return;

    const idx = queue.findIndex((s) => s.id === currentSong.id);
    if (idx < 0) return;

    // Get the next 3 songs in queue
    const upcoming: { song: typeof queue[0]; qIdx: number }[] = [];
    for (let i = 1; i <= 3; i++) {
      const ni = (idx + i) % queue.length;
      if (ni !== idx && queue[ni]) {
        upcoming.push({ song: queue[ni], qIdx: ni });
      }
    }

    if (upcoming.length === 0) return;

    let cancelled = false;

    const resolveUpcoming = async () => {
      for (const { song: nextSong } of upcoming) {
        if (cancelled) return;
        // Skip if already resolved or already preloaded
        if (preloadedIdsRef.current.has(nextSong.id)) continue;

        let src: string | null = null;

        // Check offline cache first
        const cachedUrl = await offlineCache.getCachedUrl(nextSong.id);
        if (cancelled) return;

        if (cachedUrl) {
          src = cachedUrl;
        } else if (nextSong.streamUrl) {
          src = nextSong.streamUrl;
        }

        if (cancelled) return;

        if (src) {
          preloadedIdsRef.current.add(nextSong.id);
        }

        // For the immediate next song, also buffer the audio element
        if (src && preloadRef.current && !preloadedSongIdRef.current) {
          preloadRef.current.src = src;
          preloadRef.current.load();
          preloadedSongIdRef.current = nextSong.id;
          usePlayerStore.setState({ nextPreloaded: true });
        }
      }
    };

    const timer = setTimeout(resolveUpcoming, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentSong?.id]);

  // Clear preloaded set on queue change
  useEffect(() => {
    preloadedIdsRef.current.clear();
  }, [usePlayerStore.getState().queue.length]);

  const preemptiveTriggeredRef = useRef(false);
  const lastProgressUpdateRef = useRef(0);

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const t = audio.currentTime;

    // Sync real audio duration to store (once it's known)
    if (isFinite(audio.duration) && audio.duration > 0) {
      const stored = usePlayerStore.getState().audioDuration;
      if (Math.abs(stored - audio.duration) > 0.5) {
        usePlayerStore.setState({ audioDuration: audio.duration });
      }
    }

    // ── Throttle UI progress updates to save CPU ──
    const now = Date.now();
    const isVisible = document.visibilityState === "visible";
    const throttleMs = isVisible ? 250 : 3000;
    if (now - lastProgressUpdateRef.current >= throttleMs) {
      setProgress(t);
      lastProgressUpdateRef.current = now;
    }

    // Preemptive crossfade: start next track before current ends
    const { crossfadeEnabled, crossfadeDuration, repeat } = usePlayerStore.getState();
    if (
      crossfadeEnabled &&
      !preemptiveTriggeredRef.current &&
      audio.duration > 0 &&
      audio.duration - t <= crossfadeDuration &&
      audio.duration - t > 0.5 &&
      repeat !== "one"
    ) {
      preemptiveTriggeredRef.current = true;

      // Equal-power fade-out curve for preemptive crossfade
      const steps = (crossfadeDuration * 1000) / FADE_STEP;
      let step = 0;
      const fadeOutInterval = setInterval(() => {
        step++;
        const t = step / steps;
        if (audioRef.current) {
          audioRef.current.volume = Math.max(0, volume * Math.cos(t * Math.PI * 0.5));
        }
        if (step >= steps) clearInterval(fadeOutInterval);
      }, FADE_STEP);

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
  const miniDominantColor: string | null = null; // Skip expensive canvas op on mini player

  // ── Media Session API: lock screen metadata ──
  // IMPORTANT: Don't remove action handlers on cleanup — iOS loses the Now Playing session
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    // Set action handlers once (idempotent)
    navigator.mediaSession.setActionHandler("play", () => {
      const store = usePlayerStore.getState();
      if (!store.isPlaying) store.togglePlay();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      const store = usePlayerStore.getState();
      if (store.isPlaying) store.togglePlay();
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      usePlayerStore.getState().previous();
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => {
      usePlayerStore.getState().next();
    });
    // Explicitly disable 10s skip buttons on iOS lock screen — show prev/next track instead
    navigator.mediaSession.setActionHandler("seekbackward", null);
    navigator.mediaSession.setActionHandler("seekforward", null);

    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime != null && audioRef.current) {
        audioRef.current.currentTime = details.seekTime;
        usePlayerStore.getState().setProgress(details.seekTime);
        // Immediately sync position to lock screen
        if ("setPositionState" in navigator.mediaSession && audioRef.current.duration > 0) {
          try {
            navigator.mediaSession.setPositionState({
              duration: audioRef.current.duration,
              playbackRate: 1,
              position: details.seekTime,
            });
          } catch { /* ignore */ }
        }
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

  // Update position state for lock screen scrubber — use actual audio duration
  const lastPositionSyncRef = useRef(0);
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentSong || isLive) return;
    const now = Date.now();
    // Throttle: every 1s when visible, every 5s in background
    const interval = document.visibilityState === "visible" ? 1000 : 5000;
    if (now - lastPositionSyncRef.current < interval) return;
    lastPositionSyncRef.current = now;

    // Use the ACTUAL audio duration (not Deezer metadata which can be wrong)
    const audio = audioRef.current;
    const realDuration = audio && isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : currentSong.duration;

    if ("setPositionState" in navigator.mediaSession && realDuration > 0) {
      try {
        const pos = Math.max(0, Math.min(progress, realDuration));
        navigator.mediaSession.setPositionState({
          duration: realDuration,
          playbackRate: 1,
          position: pos,
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

  const errorRetryCountRef = useRef(0);

  const handleAudioError = useCallback(async () => {
    if (!audioRef.current || !currentSong) return;
    const audio = audioRef.current;
    const isRadio = currentSong.duration === 0;

    console.error("[player] Audio error for:", currentSong.title,
      "readyState:", audio.readyState, "networkState:", audio.networkState,
      isRadio ? "(radio)" : "(track)");

    // Radio streams: progressive retry with backoff (don't skip)
    if (isRadio) {
      const retries = errorRetryCountRef.current;
      if (retries >= 5) {
        console.error("[player] Radio: max retries reached");
        errorRetryCountRef.current = 0;
        return;
      }
      const delay = Math.min(1000 * Math.pow(2, retries), 10000); // 1s, 2s, 4s, 8s, 10s
      errorRetryCountRef.current = retries + 1;
      console.warn(`[player] Radio: retry ${retries + 1}/5 in ${delay}ms`);
      setTimeout(() => {
        if (!audio || !usePlayerStore.getState().isPlaying) return;
        const src = currentSong.streamUrl;
        if (!src) return;
        audio.src = "";
        audio.src = src;
        audio.load();
        audio.volume = volume;
        audio.muted = false;
        audio.play().catch(console.error);
      }, delay);
      return;
    }

    // Music tracks: try cache → retry URL → skip
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

    if (currentSong.streamUrl) {
      console.warn("[player] Retrying stream URL");
      audio.src = currentSong.streamUrl;
      audio.load();
      audio.volume = volume;
      audio.muted = false;
      setTimeout(() => {
        audio.play().catch((e) => {
          console.error("[player] Retry failed — skipping:", e);
          next();
        });
      }, 500);
    } else {
      next();
    }
  }, [currentSong, volume, next]);

  // Reset error retry counter on track change
  useEffect(() => {
    errorRetryCountRef.current = 0;
  }, [currentSong?.id]);

  if (!currentSong) return null;

  const effectiveDuration = audioDuration > 0 ? audioDuration : currentSong.duration;
  const progressPct = !isLive && effectiveDuration > 0 ? (progress / effectiveDuration) * 100 : 0;

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
          playsInline
          // @ts-ignore — webkit attribute for iOS background playback
          webkit-playsinline=""
        />
        <audio ref={crossfadeRef} preload="metadata" playsInline />
        <audio ref={preloadRef} preload="metadata" playsInline style={{ display: "none" }} />
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
        playsInline
        // @ts-ignore — webkit attribute for iOS background playback
        webkit-playsinline=""
      />
      <audio ref={crossfadeRef} preload="metadata" playsInline />
      <audio ref={preloadRef} preload="metadata" playsInline style={{ display: "none" }} />
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: fullScreen ? 60 : 0, opacity: fullScreen ? 0 : 1, scale: fullScreen ? 0.92 : 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="fixed left-0 right-0 z-50 md:bottom-0 px-3 pb-1.5"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))", pointerEvents: fullScreen ? "none" : "auto" }}
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
          <div className="h-[2.5px] w-full" style={{ background: "hsl(var(--foreground) / 0.08)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%`, background: "hsl(var(--primary))" }}
            />
          </div>

          <div className="flex items-center gap-3 px-3 py-2.5">
            <div
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
              onClick={toggleFullScreen}
            >
              <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
                {currentSong.coverUrl ? (
                  <img
                    src={currentSong.coverUrl}
                    alt={currentSong.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                    <Music className="w-5 h-5 text-primary/40" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate text-foreground leading-tight">
                  {currentSong.title}
                </p>
                <div className="text-[11px] truncate text-muted-foreground leading-tight mt-0.5 inline-flex items-center">
                  {currentSong.artist}
                  {playingFromCache && (
                    <span className="ml-1.5 inline-flex items-center gap-1 text-primary">
                      <WifiOff className="w-2.5 h-2.5" />
                      <span className="font-semibold text-[10px]">OFFLINE</span>
                    </span>
                  )}
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
                className="w-9 h-9 rounded-full flex items-center justify-center bg-foreground active:scale-90 transition-transform"
              >
                {isPlaying ? <Pause className="w-4 h-4 text-background fill-current" /> : <Play className="w-4 h-4 text-background fill-current ml-0.5" />}
              </button>
              <button
                onClick={next}
                className="relative p-2 text-foreground active:scale-90 transition-transform"
              >
                <SkipForward className="w-5 h-5 fill-current" />
                {nextPreloaded && (
                  <span className="absolute top-1.5 right-1.5 w-[6px] h-[6px] rounded-full bg-primary animate-pulse" />
                )}
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
      transition={{ type: "spring", damping: 28, stiffness: 200, mass: 0.8 }}
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
          <ChevronDown className="w-7 h-7 text-foreground/70" />
        </button>
        <div className="flex-1 text-center px-4">
          <div className="flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] font-bold text-primary tracking-widest uppercase">EN DIRECT</span>
          </div>
          <p className="text-[12px] font-bold text-foreground/80 truncate">{stationName}</p>
        </div>
        <button onClick={() => {}} className="p-1 active:scale-90 transition-transform">
          <MoreHorizontal className="w-6 h-6 text-foreground/70" />
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
            onClick={() => {
              if (!currentSong) return;
              toggleLike(currentSong);
              if (navigator.vibrate) navigator.vibrate(10);
            }}
            className="p-1 active:scale-90 transition-transform"
          >
            <Heart className={`w-7 h-7 ${liked ? "fill-primary text-primary" : "text-foreground/40"}`} />
          </button>
        </div>


        {/* Transport — large play/pause centered, matching music player */}
        <div className="flex items-center justify-center w-full mb-6">
          <button
            onClick={togglePlay}
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{
              background: "hsl(var(--foreground) / 0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid hsl(var(--foreground) / 0.15)",
            }}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 text-foreground fill-current" />
            ) : (
              <Play className="w-8 h-8 text-foreground fill-current ml-1" />
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
  const nextPreloaded = usePlayerStore((s) => s.nextPreloaded);
  const audioDuration = usePlayerStore((s) => s.audioDuration);
  const dominantColor = useDominantColor(currentSong?.coverUrl);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const { isCached, isDownloading, progress: dlProgress, download, remove } = useOfflineCache(currentSong?.id);

  if (!currentSong) return null;

  const liked = isLiked(currentSong.id);
  const effectiveDuration = audioDuration > 0 ? audioDuration : currentSong.duration;
  const progressPct = effectiveDuration > 0 ? (progress / effectiveDuration) * 100 : 0;
  const bgColor = dominantColor || "hsl(0 0% 4%)";


  const seekFromX = (clientX: number) => {
    const bar = progressBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = Math.floor(pct * effectiveDuration);
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
      transition={{ type: "spring", damping: 28, stiffness: 200, mass: 0.8 }}
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
            key={currentSong.id}
            src={currentSong.coverUrl}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
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
                  {currentSong.coverUrl ? (
                    <img src={currentSong.coverUrl} alt="" className="w-14 h-14 rounded-xl object-cover shadow-lg" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg">
                      <Music className="w-6 h-6 text-primary/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-background/30">
                    {isPlaying && <AudioVisualizer isPlaying={isPlaying} />}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-primary truncate">{currentSong.title}</p>
                  <p className="text-xs text-foreground/50 truncate">{currentSong.artist}</p>
                </div>
                <span className="text-xs text-foreground/40 tabular-nums">{formatDuration(effectiveDuration)}</span>
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
                              {song.coverUrl ? (
                                <img src={song.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover shadow" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 shadow">
                                  <Music className="w-4 h-4 text-primary/40" />
                                </div>
                              )}
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
                            {song.coverUrl ? (
                              <img src={song.coverUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
                            ) : (
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                                <Music className="w-4 h-4 text-primary/40" />
                              </div>
                            )}
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
            {/* Cover art - cinematic transitions */}
            <div className="flex-1 flex items-center justify-center py-4 perspective-[1200px]">
              <AnimatePresence mode="wait">
                {currentSong.coverUrl ? (
                  <motion.img
                    key={currentSong.id}
                    src={currentSong.coverUrl}
                    alt={currentSong.title}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="w-full max-w-[340px] aspect-square rounded-2xl object-cover"
                    style={{ boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 8px 20px rgba(0,0,0,0.3)` }}
                  />
                ) : (
                  <motion.div
                    key={currentSong.id + "-placeholder"}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="w-full max-w-[340px] aspect-square rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5"
                    style={{ boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 8px 20px rgba(0,0,0,0.3)` }}
                  >
                    <Music className="w-20 h-20 text-primary/30" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Title + Artist + Like — slide in from bottom */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSong.id + "-info"}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
                className="flex items-center justify-between gap-3 mb-6"
              >
              <div className="min-w-0 flex-1">
                <h2 className="text-[22px] font-extrabold text-foreground truncate leading-tight">
                  {currentSong.title}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[15px] text-foreground/60 truncate">
                    {currentSong.artist}
                  </p>
                  {isCached && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                      <WifiOff className="w-2.5 h-2.5" />
                      OFFLINE
                    </span>
                  )}
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
                  <Heart className={`w-7 h-7 ${liked ? "fill-primary text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.4)]" : "text-foreground/40"}`} />
                </motion.div>
              </motion.button>
              </motion.div>
            </AnimatePresence>

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
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[4px] rounded-full" style={{ background: "hsl(var(--foreground) / 0.1)" }}>
                  <div
                    className="h-full rounded-full relative"
                    style={{
                      width: `${progressPct}%`,
                      background: "hsl(var(--foreground) / 0.85)",
                      transition: isSeeking ? "none" : "width 0.3s linear",
                    }}
                  >
                    {/* Thumb with glow */}
                    <motion.div
                      animate={{ scale: isSeeking ? 1 : 0.6 }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-[16px] h-[16px] rounded-full bg-foreground"
                      style={{
                        boxShadow: isSeeking
                          ? "0 0 12px hsl(var(--primary) / 0.5), 0 2px 8px rgba(0,0,0,0.3)"
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
                <span>-{formatDuration(Math.max(0, Math.floor(effectiveDuration) - Math.floor(progress)))}</span>
              </div>
            </div>

            {/* Transport controls — ultra premium */}
            <div className="flex items-center justify-between w-full mb-6">
              <motion.button whileTap={{ scale: 0.85 }} onClick={toggleShuffle} className="transition-all">
                <Shuffle className={`w-6 h-6 ${shuffle ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]" : "text-foreground/50"}`} />
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
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all"
                style={{
                  background: "hsl(var(--foreground) / 0.12)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: "1px solid hsl(var(--foreground) / 0.15)",
                  boxShadow: isPlaying
                    ? "0 0 24px hsl(var(--primary) / 0.2), 0 8px 24px hsl(0 0% 0% / 0.25)"
                    : "0 8px 24px hsl(0 0% 0% / 0.25)",
                }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isPlaying ? (
                    <motion.div key="pause" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <Pause className="w-8 h-8 text-foreground fill-current" />
                    </motion.div>
                  ) : (
                    <motion.div key="play" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
                      <Play className="w-8 h-8 text-foreground fill-current ml-1" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
              <motion.button whileTap={{ scale: 0.8 }} onClick={next} className="relative transition-all">
                <SkipForward className="w-9 h-9 text-foreground fill-current" />
                {nextPreloaded && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </motion.button>
              <motion.button whileTap={{ scale: 0.85 }} onClick={cycleRepeat} className="transition-all">
                {repeat === "one" ? (
                  <Repeat1 className="w-6 h-6 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
                ) : (
                  <Repeat className={`w-6 h-6 ${repeat === "all" ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]" : "text-foreground/50"}`} />
                )}
              </motion.button>
            </div>

            {/* Bottom actions — clean, no duplicates */}
            <div className="flex items-center justify-between">
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
