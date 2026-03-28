import { usePlayerStore } from "@/stores/playerStore";
import { formatDuration } from "@/data/mockData";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Heart, ChevronDown, ListMusic, X, MoreHorizontal, PlusCircle, Disc3,
  Download, Check, Loader2, WifiOff, GripVertical, Trash2, Search, SlidersHorizontal,
  Music
} from "lucide-react";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AudioVisualizer } from "./AudioVisualizer";
import { useRadioMetadata } from "@/hooks/useRadioMetadata";
import { offlineCache } from "@/lib/offlineCache";
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

/* ── Resume Banner — appears briefly when playback resumes after interruption ── */
function ResumeBanner({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="fixed left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
          style={{ bottom: "calc(8.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full shadow-lg"
            style={{
              background: "hsl(var(--primary) / 0.15)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid hsl(var(--primary) / 0.3)",
            }}
          >
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-semibold text-primary whitespace-nowrap">{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

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

  const bassBoost = usePlayerStore((s) => s.bassBoost);
  const trebleBoost = usePlayerStore((s) => s.trebleBoost);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const crossfadeRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const preloadedSongIdRef = useRef<string | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSongIdRef = useRef<string | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const [resumeBanner, setResumeBanner] = useState<string | null>(null);
  const resumeBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showResumeBanner = useCallback((msg: string) => {
    if (resumeBannerTimer.current) clearTimeout(resumeBannerTimer.current);
    setResumeBanner(msg);
    resumeBannerTimer.current = setTimeout(() => setResumeBanner(null), 2500);
  }, []);

  // Web Audio API EQ nodes
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null);
  const connectedAudioRef = useRef<HTMLAudioElement | null>(null);
  const eqFailedRef = useRef(false); // true if CORS/Web Audio failed — skip EQ
  const [playingFromCache, setPlayingFromCache] = useState(false);
  const audioDuration = usePlayerStore((s) => s.audioDuration);
  const nextPreloaded = usePlayerStore((s) => s.nextPreloaded);

  const CROSSFADE_MS = crossfadeDuration * 1000;
  const FADE_STEP = 50;

  // ── EQ: connect Web Audio API pipeline ──
  const connectEQ = useCallback((audio: HTMLAudioElement) => {
    // If EQ previously failed (CORS issue), don't retry — play without EQ
    if (eqFailedRef.current) return;

    // Skip EQ entirely if bass and treble are both 0 — avoids unnecessary CORS requirement
    const { bassBoost: b, trebleBoost: t } = usePlayerStore.getState();
    if (b === 0 && t === 0) return;
    
    if (connectedAudioRef.current === audio) {
      // Already connected — just make sure AudioContext is running
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
      return;
    }
    try {
      // Ensure crossOrigin is set before connecting to Web Audio API
      if (!audio.crossOrigin) {
        audio.crossOrigin = "anonymous";
      }
      
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;

      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      ctx.onstatechange = () => {
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
      };

      const source = ctx.createMediaElementSource(audio);
      const bass = ctx.createBiquadFilter();
      bass.type = "lowshelf";
      bass.frequency.value = 200;
      bass.gain.value = b;

      const treble = ctx.createBiquadFilter();
      treble.type = "highshelf";
      treble.frequency.value = 3000;
      treble.gain.value = t;

      source.connect(bass);
      bass.connect(treble);
      treble.connect(ctx.destination);

      sourceNodeRef.current = source;
      bassFilterRef.current = bass;
      trebleFilterRef.current = treble;
      connectedAudioRef.current = audio;
      console.log("[EQ] Web Audio pipeline connected successfully");
    } catch (e) {
      console.warn("[EQ] Web Audio API init failed, disabling EQ for this session:", e);
      eqFailedRef.current = true;
      // Remove crossOrigin so audio can play without CORS restrictions
      audio.crossOrigin = null as any;
      connectedAudioRef.current = null;
    }
  }, []);

  // ── Resume AudioContext on ANY user interaction (mobile requirement) ──
  useEffect(() => {
    const resumeCtx = () => {
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended") {
        ctx.resume().then(() => console.log("[EQ] AudioContext resumed via user gesture")).catch(() => {});
      }
    };
    document.addEventListener("touchstart", resumeCtx, { once: false, passive: true });
    document.addEventListener("click", resumeCtx, { passive: true });
    return () => {
      document.removeEventListener("touchstart", resumeCtx);
      document.removeEventListener("click", resumeCtx);
    };
  }, []);

  // Update EQ gains reactively
  useEffect(() => {
    if (bassFilterRef.current) bassFilterRef.current.gain.value = bassBoost;
  }, [bassBoost]);
  useEffect(() => {
    if (trebleFilterRef.current) trebleFilterRef.current.gain.value = trebleBoost;
  }, [trebleBoost]);

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

  // ── Silent audio keepalive — prevents iOS from killing audio in background ──
  // A real looping silent audio element keeps the page alive (not just setInterval)
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const keepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isPlaying || !currentSong) {
      // Stop keepalive
      if (silentAudioRef.current) {
        silentAudioRef.current.pause();
        silentAudioRef.current.src = "";
      }
      if (keepaliveRef.current) { clearInterval(keepaliveRef.current); keepaliveRef.current = null; }
      return;
    }

    // Create a tiny silent WAV data URI (44 bytes of silence, 1 sample)
    // This is the smallest valid WAV file — plays silence in a loop
    const silentWav = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

    if (!silentAudioRef.current) {
      silentAudioRef.current = new Audio();
      silentAudioRef.current.loop = true;
      silentAudioRef.current.volume = 0.01; // Near-silent but NOT muted (muted = OS can kill it)
      // @ts-ignore
      silentAudioRef.current.playsInline = true;
    }
    const silent = silentAudioRef.current;
    if (!silent.src || silent.paused) {
      silent.src = silentWav;
      silent.play().catch(() => {}); // May need user gesture first time
    }

    // Also periodically touch AudioContext + media session
    keepaliveRef.current = setInterval(() => {
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      if ("mediaSession" in navigator && navigator.mediaSession.playbackState !== "playing") {
        navigator.mediaSession.playbackState = "playing";
      }
      // Ensure silent audio stays playing
      if (silent.paused && isPlaying) {
        silent.play().catch(() => {});
      }
    }, 5000);

    return () => {
      if (keepaliveRef.current) { clearInterval(keepaliveRef.current); keepaliveRef.current = null; }
    };
  }, [isPlaying, currentSong?.id]);

  // ── Visibility change — resume playback + re-sync media session ──
  // Handles: returning from background, phone call interruption, app switching
  useEffect(() => {
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    let wasPlayingBeforeHidden = false;

    const handleVisibility = () => {
      const audio = audioRef.current;
      const state = usePlayerStore.getState();

      if (document.visibilityState === "hidden") {
        // Going to background — remember state for recovery
        wasPlayingBeforeHidden = state.isPlaying;
        // Force media session sync before going background
        if ("mediaSession" in navigator && state.isPlaying) {
          navigator.mediaSession.playbackState = "playing";
        }
        return;
      }

      // Coming back to foreground
      if (!audio || !state.currentSong) return;
      const shouldResume = state.isPlaying || wasPlayingBeforeHidden;
      if (!shouldResume) return;

      // Ensure store is marked as playing (might have been paused externally)
      if (!state.isPlaying && wasPlayingBeforeHidden) {
        usePlayerStore.setState({ isPlaying: true });
      }

      // Progressive resume with escalating retry strategy
      const isRadio = state.currentSong.duration === 0;
      
      const attemptResume = (attempt: number) => {
        if (!audioRef.current) return;
        const a = audioRef.current;
        
        if (a.paused && a.src) {
          console.log(`[bg-resume] Attempt ${attempt} — resuming ${isRadio ? "radio" : "track"}`);

          if (isRadio && attempt > 1) {
            // Radio: reload stream on retry to get fresh data
            const src = a.src;
            a.src = "";
            a.src = src;
            a.load();
          }

          a.volume = volume;
          a.muted = false;
          a.play().then(() => {
            if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
            console.log("[bg-resume] Resumed successfully");
            showResumeBanner("Lecture reprise ▶");
          }).catch((e) => {
            console.warn(`[bg-resume] Attempt ${attempt} failed:`, e);
            if (attempt < 3) {
              setTimeout(() => attemptResume(attempt + 1), 300 * attempt);
            }
          });
        }
        // Re-sync media session state
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "playing";
        }
      };

      // Small delay to let iOS audio session re-activate
      resumeTimer = setTimeout(() => attemptResume(1), 200);
    };

    // Handle audio interruptions (phone calls, Siri, etc.)
    const handlePause = () => {
      const audio = audioRef.current;
      if (!audio) return;
      const state = usePlayerStore.getState();
      if (state.isPlaying && audio.paused) {
        // Audio was paused externally (phone call, Siri, OS interruption)
        // Try to resume regardless of visibility (lock screen case)
        console.log("[interrupt] Audio paused externally — attempting resume");
        setTimeout(() => {
          if (audio.paused && usePlayerStore.getState().isPlaying) {
            audio.volume = volume;
            audio.muted = false;
            audio.play().then(() => {
              if (document.visibilityState === "visible") {
                showResumeBanner("Lecture reprise ▶");
              }
            }).catch(() => {
              console.warn("[interrupt] Resume failed — user gesture may be needed");
            });
          }
        }, 300);
      }
    };

    // Stall recovery — when audio buffer runs out mid-playback
    const handleStalled = () => {
      const audio = audioRef.current;
      const state = usePlayerStore.getState();
      if (!audio || !state.isPlaying || !state.currentSong) return;
      console.warn("[stall] Audio stalled — waiting for data");
      // For radio, reload stream after 3s if still stalled
      if (state.currentSong.duration === 0) {
        setTimeout(() => {
          if (audio.readyState < 2 && usePlayerStore.getState().isPlaying) {
            console.log("[stall] Reloading radio stream");
            const src = audio.src;
            audio.src = "";
            audio.src = src;
            audio.load();
            audio.play().then(() => showResumeBanner("Reconnexion réussie ▶")).catch(console.error);
          }
        }, 3000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    const audioEl = audioRef.current;
    audioEl?.addEventListener("pause", handlePause);
    audioEl?.addEventListener("stalled", handleStalled);

    return () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
      audioEl?.removeEventListener("pause", handlePause);
      audioEl?.removeEventListener("stalled", handleStalled);
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
        if (audio.paused) {
          audio.volume = volume;
          audio.muted = false;
          audio.play().then(() => {
            if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
          }).catch(console.error);
        }
      } else {
        if (!audio.paused) audio.pause();
        if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
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
    // Keep media session in "playing" state during track transition so iOS doesn't flip the button
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "playing";
    }
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
        // If no stream URL, show error and skip to next
        if (!songToPlay.streamUrl) {
          console.warn("[player] No playable source for:", songToPlay.title);
          const { toast } = await import("sonner");
          toast.error(`"${songToPlay.title}" n'est pas disponible`);
          setTimeout(() => usePlayerStore.getState().next(), 300);
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
        // Connect EQ to new main audio element
        connectEQ(preloaded);
        // Set up events on new main
        preloaded.onended = handleEnded;
        preloaded.onerror = handleAudioError;
        preloaded.ontimeupdate = handleTimeUpdate;
        preloaded.volume = volume;
        preloaded.muted = false;
        preloaded.play().then(() => {
          if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
        }).catch((e) => {
          console.error("[player] Gapless play failed:", e);
          setTimeout(() => preloaded.play().then(() => {
            if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
          }).catch(() => {}), 200);
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

        connectEQ(audio);
        audio.src = srcToUse;
        audio.volume = 0;
        audio.muted = false;
        audio.play().then(() => {
          if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
        }).catch((e) => {
          console.error("[player] Crossfade play failed:", e);
          setTimeout(() => audio.play().catch(() => {}), 200);
        });
      } else {
        // Direct load — instant play
        connectEQ(audio);
        audio.src = srcToUse;
        audio.volume = volume;
        audio.muted = false;
        audio.play().then(() => {
          if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
        }).catch((e) => {
          console.warn("[player] Immediate play failed, waiting canplay:", e);
          const onCanPlay = () => {
            audio.removeEventListener("canplay", onCanPlay);
            audio.volume = volume;
            audio.muted = false;
            audio.play().then(() => {
              if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
            }).catch(console.error);
          };
          audio.addEventListener("canplay", onCanPlay, { once: true });
        });

        // Safety timeout — reduced for snappier PWA feel
        setTimeout(() => {
          if (audio.paused && usePlayerStore.getState().isPlaying) {
            audio.volume = volume;
            audio.muted = false;
            audio.play().then(() => {
              if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
            }).catch(console.error);
          }
        }, 100);
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

    // Use requestIdleCallback for non-blocking preload, fallback to minimal timeout
    const schedule = typeof requestIdleCallback === "function"
      ? (cb: () => void) => requestIdleCallback(cb, { timeout: 500 })
      : (cb: () => void) => setTimeout(cb, 50);
    const timer = schedule(resolveUpcoming) as any;
    return () => {
      cancelled = true;
      if (typeof cancelIdleCallback === "function") {
        try { cancelIdleCallback(timer); } catch { clearTimeout(timer); }
      } else {
        clearTimeout(timer);
      }
    };
  }, [currentSong?.id]);

  // Clear preloaded set on queue change
  const queueLength = usePlayerStore((s) => s.queue.length);
  useEffect(() => {
    preloadedIdsRef.current.clear();
  }, [queueLength]);

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

  // ── Media Session API: lock screen controls ──
  // Re-register when song, queue length, or live mode changes
  const queueLen = usePlayerStore((s) => s.queue.length);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentSong) return;

    const ms = navigator.mediaSession;
    const liveStream = currentSong.duration === 0;
    const hasMultiple = queueLen > 1;

    // ── Play handler — always resume from store + audio element ──
    const safeSet = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { ms.setActionHandler(action, handler); } catch { /* unsupported */ }
    };

    safeSet("play", () => {
      const store = usePlayerStore.getState();
      if (!store.isPlaying) store.togglePlay();
      const audio = audioRef.current;
      if (audio?.paused && audio.src) {
        audio.volume = volume;
        audio.muted = false;
        audio.play().catch(console.error);
      }
      ms.playbackState = "playing";
    });

    safeSet("pause", () => {
      const store = usePlayerStore.getState();
      if (store.isPlaying) store.togglePlay();
      audioRef.current?.pause();
      ms.playbackState = "paused";
    });

    safeSet("stop", () => {
      usePlayerStore.getState().closePlayer();
      ms.playbackState = "none";
    });

    if (liveStream) {
      // ── RADIO: skip stations if multiple, otherwise no skip ──
      if (hasMultiple) {
        safeSet("previoustrack", () => {
          usePlayerStore.getState().previous();
          ms.playbackState = "playing";
        });
        safeSet("nexttrack", () => {
          usePlayerStore.getState().next();
          ms.playbackState = "playing";
        });
      } else {
        safeSet("previoustrack", null);
        safeSet("nexttrack", null);
      }
      safeSet("seekbackward", null);
      safeSet("seekforward", null);
      safeSet("seekto", null);
    } else {
      // ── MUSIC: previous/next track only (no seek on lock screen) ──
      safeSet("previoustrack", () => {
        usePlayerStore.getState().previous();
        ms.playbackState = "playing";
      });
      safeSet("nexttrack", () => {
        usePlayerStore.getState().next();
        ms.playbackState = "playing";
      });
      safeSet("seekbackward", null);
      safeSet("seekforward", null);
      safeSet("seekto", null);
    }

    // Cleanup when player closes or song changes
    return () => {
      // Don't null handlers — let next registration override
    };
  }, [currentSong?.id, queueLen, volume]);

  // ── Sync position state to lock screen scrubber ──
  const syncPositionState = useCallback(() => {
    if (!("mediaSession" in navigator) || !currentSong || isLive) return;
    const audio = audioRef.current;
    const realDuration = audio && isFinite(audio.duration) && audio.duration > 0
      ? audio.duration : currentSong.duration;
    if (realDuration <= 0) return;
    try {
      const pos = Math.max(0, Math.min(audio?.currentTime ?? progress, realDuration));
      navigator.mediaSession.setPositionState({
        duration: realDuration,
        playbackRate: 1,
        position: pos,
      });
    } catch { /* ignore */ }
  }, [currentSong, isLive, progress]);

  // Periodic position sync — interval-based, not on every progress change
  const positionSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (positionSyncRef.current) clearInterval(positionSyncRef.current);
    if (!currentSong || isLive || !isPlaying) return;

    // Sync immediately on play/song change
    syncPositionState();

    // Then every 2s (sufficient for lock screen accuracy)
    positionSyncRef.current = setInterval(syncPositionState, 2000);
    return () => {
      if (positionSyncRef.current) clearInterval(positionSyncRef.current);
    };
  }, [currentSong?.id, isPlaying, isLive, syncPositionState]);

  // Update metadata whenever song/radio meta changes (not on isPlaying changes)
  useEffect(() => {
    if (!currentSong || !("mediaSession" in navigator)) return;

    const title = isLive && radioMeta?.title ? radioMeta.title : currentSong.title;
    const artist = isLive && radioMeta?.artist ? radioMeta.artist : currentSong.artist;
    const artwork = radioMeta?.coverUrl || currentSong.coverUrl;

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: currentSong.album || (isLive ? "Radio" : ""),
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
  }, [currentSong?.id, currentSong?.title, isLive, radioMeta?.title, radioMeta?.artist, radioMeta?.coverUrl]);

  // Keep playback state in sync — separate from metadata to avoid churn
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentSong) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying, currentSong]);

  // Clean up media session when player closes
  useEffect(() => {
    return () => {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "none";
        navigator.mediaSession.metadata = null;
      }
    };
  }, []);

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
      "crossOrigin:", audio.crossOrigin, isRadio ? "(radio)" : "(track)");

    // CORS fallback: if crossOrigin is set and audio failed, try without it (disables EQ)
    if (audio.crossOrigin && !eqFailedRef.current) {
      console.warn("[player] CORS error suspected — retrying without crossOrigin (EQ disabled)");
      eqFailedRef.current = true;
      audio.crossOrigin = null as any;
      connectedAudioRef.current = null;
      const src = currentSong.streamUrl;
      if (src) {
        audio.src = src;
        audio.load();
        audio.volume = volume;
        audio.muted = false;
        audio.play().catch(console.error);
      }
      return;
    }

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

  // ── Radio mini-player — standard bar like music ──
  if (isLive) {
    const bubbleCover = radioMeta?.coverUrl || currentSong.coverUrl;
    const radioTitle = radioMeta?.title || currentSong.title;
    const radioArtist = radioMeta?.artist || currentSong.artist || "Radio";
    const hasMultipleStations = usePlayerStore.getState().queue.length > 1;

    return (
      <>
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onError={handleAudioError}
          onPlay={() => {
            if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
            // Sync store if audio started externally (e.g. Bluetooth resume)
            if (!usePlayerStore.getState().isPlaying) usePlayerStore.setState({ isPlaying: true });
          }}
          onPause={() => {
            // Debounce: only sync to store if STILL paused after 150ms
            // This prevents brief pauses (crossfade, route change, buffering) from killing playback
            const audio = audioRef.current;
            setTimeout(() => {
              if (audio?.paused && usePlayerStore.getState().isPlaying) {
                usePlayerStore.setState({ isPlaying: false });
              }
              if ("mediaSession" in navigator && audio?.paused) {
                navigator.mediaSession.playbackState = "paused";
              }
            }, 150);
          }}
          preload="auto"
          playsInline
          // @ts-ignore — webkit attributes for iOS background playback & AirPlay
          webkit-playsinline=""
          x-webkit-airplay="allow"
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
            style={glassStyle}
          >
            {/* Live indicator line */}
            <div className="h-[2.5px] w-full bg-primary/40">
              <div className="h-full w-full bg-primary animate-pulse" />
            </div>

            <div className="flex items-center gap-3 px-3 py-2.5">
              <div
                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                onClick={toggleFullScreen}
              >
                <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
                  {bubbleCover ? (
                    <img src={bubbleCover} alt={currentSong.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <Music className="w-5 h-5 text-primary/40" />
                    </div>
                  )}
                  {isPlaying && (
                    <div className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold truncate text-foreground leading-tight">
                    {radioTitle}
                  </p>
                  <div className="text-[11px] truncate text-muted-foreground leading-tight mt-0.5 inline-flex items-center gap-1.5">
                    <span>{radioArtist}</span>
                    <span className="shrink-0 inline-flex items-center gap-0.5 text-[8px] font-bold px-1 py-0.5 rounded-full bg-primary/20 text-primary">
                      LIVE
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-0.5">
                {hasMultipleStations && (
                  <button onClick={previous} className="p-2 active:scale-90 transition-transform">
                    <SkipBack className="w-4 h-4 text-foreground fill-current" />
                  </button>
                )}
                <button
                  onClick={togglePlay}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-foreground active:scale-90 transition-transform"
                >
                  {isPlaying ? <Pause className="w-4 h-4 text-background fill-current" /> : <Play className="w-4 h-4 text-background fill-current ml-0.5" />}
                </button>
                {hasMultipleStations && (
                  <button onClick={next} className="p-2 active:scale-90 transition-transform">
                    <SkipForward className="w-4 h-4 text-foreground fill-current" />
                  </button>
                )}
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
        <ResumeBanner message={resumeBanner} />
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
        onPlay={() => {
          if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
          if (!usePlayerStore.getState().isPlaying) usePlayerStore.setState({ isPlaying: true });
        }}
        onPause={() => {
          const a = audioRef.current;
          setTimeout(() => {
            if (a?.paused && usePlayerStore.getState().isPlaying) {
              usePlayerStore.setState({ isPlaying: false });
            }
            if ("mediaSession" in navigator && a?.paused) {
              navigator.mediaSession.playbackState = "paused";
            }
          }, 150);
        }}
        preload="auto"
        playsInline
        // @ts-ignore — webkit attributes for iOS background playback & AirPlay
        webkit-playsinline=""
        x-webkit-airplay="allow"
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
      <ResumeBanner message={resumeBanner} />
    </>
  );
}

/* ─────────────────────────────────────────────
   Radio Fullscreen Player — Liquid Glass
   ───────────────────────────────────────────── */
function RadioFullScreen({ onClose }: { onClose: () => void }) {
  const {
    currentSong, isPlaying, togglePlay, toggleLike, isLiked, next, previous, queue
  } = usePlayerStore();
  const navigate = useNavigate();
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
        <button
          onClick={() => {
            const meta = radioMeta;
            const q = encodeURIComponent(
              `${meta?.title || ""} ${meta?.artist || currentSong?.artist || ""}`.trim()
            );
            onClose();
            setTimeout(() => navigate(`/search?q=${q}`), 150);
          }}
          className="p-1 active:scale-90 transition-transform"
        >
          <Search className="w-6 h-6 text-foreground/70" />
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


        {/* Transport — prev / play / next */}
        <div className="flex items-center justify-center gap-8 w-full mb-6">
          {queue.length > 1 && (
            <motion.button whileTap={{ scale: 0.75 }} onClick={previous} className="p-1">
              <SkipBack className="w-8 h-8 text-foreground/70 fill-current" />
            </motion.button>
          )}
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
          {queue.length > 1 && (
            <motion.button whileTap={{ scale: 0.75 }} onClick={next} className="p-1">
              <SkipForward className="w-8 h-8 text-foreground/70 fill-current" />
            </motion.button>
          )}
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
   Music Fullscreen Player — Ultra Premium Apple Music
   ───────────────────────────────────────────── */
function MusicFullScreen({ onClose }: { onClose: () => void }) {
  const {
    currentSong, isPlaying, progress, shuffle, repeat, queue,
    togglePlay, next, previous, seekTo: storeSeekTo,
    toggleShuffle, cycleRepeat, toggleLike, isLiked, play, setQueue,
    crossfadeEnabled, setCrossfadeEnabled, crossfadeDuration, setCrossfadeDuration,
    bassBoost, trebleBoost, setBassBoost, setTrebleBoost,
  } = usePlayerStore();

  const navigate = useNavigate();
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
  const bgColor = dominantColor || "hsl(220 16% 5%)";

  const seekFromX = (clientX: number) => {
    const bar = progressBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = Math.floor(pct * effectiveDuration);
    storeSeekTo(time);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => seekFromX(e.clientX);
  const handleTouchSeek = (e: React.TouchEvent<HTMLDivElement>) => { e.stopPropagation(); setIsSeeking(true); seekFromX(e.touches[0].clientX); };
  const handleTouchMoveSeek = (e: React.TouchEvent<HTMLDivElement>) => { e.stopPropagation(); seekFromX(e.touches[0].clientX); };
  const handleTouchEndSeek = () => { setIsSeeking(false); };

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 32, stiffness: 280, mass: 0.9 }}
      drag="y"
      dragDirectionLock
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.03, bottom: 0.6 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 80 || info.velocity.y > 300) onClose();
      }}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
      style={{ touchAction: "pan-x" }}
    >
      {/* Multi-layer dynamic background — Apple Music style */}
      <div className="absolute inset-0">
        {/* Base color layer */}
        <div className="absolute inset-0 transition-colors" style={{ background: bgColor, transitionDuration: '1.5s' }} />
        
        {/* Blurred cover layer — extreme blur for ambient feel */}
        <AnimatePresence mode="popLayout">
          {currentSong.coverUrl && (
            <motion.img
              key={currentSong.id + "-bg"}
              src={currentSong.coverUrl}
              alt=""
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.35 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="absolute inset-0 w-full h-full object-cover scale-[1.8] blur-[100px] saturate-150"
            />
          )}
        </AnimatePresence>

        {/* Animated gradient overlay — depth */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% 0%, transparent 0%, hsl(220 16% 5% / 0.4) 100%),
              linear-gradient(to bottom, hsl(220 16% 5% / 0.1) 0%, hsl(220 16% 5% / 0.3) 40%, hsl(220 16% 5% / 0.7) 80%, hsl(220 16% 5% / 0.9) 100%)
            `,
          }}
        />

        {/* Subtle noise texture for depth */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} />
      </div>

      {/* Drag handle */}
      <div className="relative z-10 flex justify-center pb-1" style={{ paddingTop: "calc(env(safe-area-inset-top, 12px) + 8px)" }}>
        <div className="w-9 h-[5px] rounded-full bg-white/20" />
      </div>

      {/* Top bar — minimal, elegant */}
      <div className="relative z-10 flex items-center px-6 pb-3">
        <div className="w-[72px] flex items-center justify-start">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-xl active:bg-white/20 transition-colors"
          >
            <ChevronDown className="w-5 h-5 text-white/80" />
          </motion.button>
        </div>
        <div className="flex-1 text-center">
          <p className="text-[10px] font-semibold text-white/40 tracking-[0.15em] uppercase">
            En lecture
          </p>
          <p className="text-[12px] font-bold text-white/70 truncate mt-0.5">
            {currentSong.album || "Ma bibliothèque"}
          </p>
        </div>
        <div className="w-[72px] flex items-center justify-end gap-1.5">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => {
              onClose();
              setTimeout(() => navigate("/audio-settings"), 150);
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-xl active:bg-white/20 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4 text-white/80" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => {
              const q = encodeURIComponent(
                `${currentSong.title} ${currentSong.artist}`.trim()
              );
              onClose();
              setTimeout(() => navigate(`/search?q=${q}`), 150);
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-xl active:bg-white/20 transition-colors"
          >
            <Search className="w-4 h-4 text-white/80" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setShowQueue(!showQueue)}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-xl active:bg-white/20 transition-colors"
          >
            {showQueue ? <X className="w-4 h-4 text-white/80" /> : <ListMusic className="w-4 h-4 text-white/80" />}
          </motion.button>
        </div>
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
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-2">En cours de lecture</h3>
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/8 border border-white/8 backdrop-blur-xl">
                <div className="relative">
                  {currentSong.coverUrl ? (
                    <img src={currentSong.coverUrl} alt="" className="w-14 h-14 rounded-xl object-cover shadow-2xl" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 shadow-2xl">
                      <Music className="w-6 h-6 text-primary/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/20">
                    {isPlaying && <AudioVisualizer isPlaying={isPlaying} />}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-primary truncate">{currentSong.title}</p>
                  <p className="text-xs text-white/40 truncate">{currentSong.artist}</p>
                </div>
                <span className="text-xs text-white/30 tabular-nums">{formatDuration(effectiveDuration)}</span>
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
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                          À suivre · {upcoming.length}
                        </h3>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setQueue(currentSong ? [currentSong] : [])}
                            className="text-[10px] font-semibold text-destructive/70 hover:text-destructive px-2 py-1 rounded-full bg-destructive/10 active:scale-95 transition-all flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Vider
                          </button>
                          <button
                            onClick={() => {
                              const shuffled = [...upcoming].sort(() => Math.random() - 0.5);
                              setQueue([...played, currentSong, ...shuffled]);
                            }}
                            className="text-[10px] font-semibold text-primary/70 hover:text-primary px-2 py-1 rounded-full bg-primary/10 active:scale-95 transition-all flex items-center gap-1"
                          >
                            <Shuffle className="w-3 h-3" />
                            Mélanger
                          </button>
                        </div>
                      </div>
                      <Reorder.Group
                        axis="y"
                        values={upcoming}
                        onReorder={(newUpcoming) => setQueue([...played, currentSong, ...newUpcoming])}
                        className="space-y-0.5"
                      >
                        {upcoming.map((song, i) => (
                          <Reorder.Item
                            key={song.id}
                            value={song}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.02 }}
                            whileDrag={{ scale: 1.03, backgroundColor: "hsl(0 0% 100% / 0.06)", borderRadius: 12 }}
                            className="group cursor-grab active:cursor-grabbing"
                            style={{ touchAction: "pan-x" }}
                          >
                            <div
                              onClick={() => { play(song); setQueue(queue); }}
                              className="w-full flex items-center gap-2 p-2.5 rounded-xl text-left hover:bg-white/5 active:bg-white/8 transition-colors"
                            >
                              <GripVertical className="w-4 h-4 text-white/15 shrink-0 touch-none" />
                              <span className="w-4 text-center text-[11px] text-white/25 tabular-nums font-medium">{i + 1}</span>
                              {song.coverUrl ? (
                                <img src={song.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover shadow" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                                  <Music className="w-4 h-4 text-primary/40" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] text-white truncate font-medium">{song.title}</p>
                                <p className="text-[11px] text-white/35 truncate">{song.artist}</p>
                              </div>
                              <span className="text-[11px] text-white/25 tabular-nums">{formatDuration(song.duration)}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); setQueue(queue.filter((s) => s.id !== song.id)); }}
                                className="p-1 rounded-full opacity-0 group-hover:opacity-100 text-white/25 hover:text-destructive transition-all active:scale-90"
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
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/15 mb-2">
                        Déjà joué · {played.length}
                      </h3>
                      <div className="space-y-0.5">
                        {played.map((song) => (
                          <button
                            key={song.id}
                            onClick={() => { play(song); setQueue(queue); }}
                            className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-white/5 transition-colors opacity-35 hover:opacity-60"
                          >
                            {song.coverUrl ? (
                              <img src={song.coverUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
                            ) : (
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                                <Music className="w-4 h-4 text-primary/40" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] text-white truncate">{song.title}</p>
                              <p className="text-[10px] text-white/35 truncate">{song.artist}</p>
                            </div>
                            <span className="text-[10px] text-white/25 tabular-nums">{formatDuration(song.duration)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {upcoming.length === 0 && played.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-white/25">
                      <ListMusic className="w-10 h-10 mb-3 opacity-50" />
                      <p className="text-sm font-medium">File d'attente vide</p>
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
            className="relative z-10 flex-1 flex flex-col px-8 pb-10"
          >
            {/* Cover art — massive, cinematic with ambient glow */}
            <div className="flex-1 flex items-center justify-center py-2">
              <div className="relative w-full max-w-[360px]">
                {/* Ambient glow behind cover */}
                {currentSong.coverUrl && (
                  <div className="absolute inset-0 scale-90 blur-[60px] opacity-40 rounded-3xl overflow-hidden">
                    <img src={currentSong.coverUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <AnimatePresence mode="popLayout">
                  {currentSong.coverUrl ? (
                    <motion.img
                      key={currentSong.id}
                      src={currentSong.coverUrl}
                      alt={currentSong.title}
                      initial={{ opacity: 0, scale: 0.82, filter: "blur(12px)", y: 20 }}
                      animate={{ opacity: 1, scale: 1, filter: "blur(0px)", y: 0 }}
                      exit={{ opacity: 0, scale: 0.88, filter: "blur(8px)", y: -15 }}
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      className="relative w-full aspect-square rounded-3xl object-cover"
                      style={{
                        boxShadow: `
                          0 30px 80px -20px rgba(0,0,0,0.6),
                          0 10px 30px -10px rgba(0,0,0,0.4),
                          0 0 0 1px rgba(255,255,255,0.05)
                        `,
                      }}
                    />
                  ) : (
                    <motion.div
                      key={currentSong.id + "-ph"}
                      initial={{ opacity: 0, scale: 0.82, filter: "blur(12px)" }}
                      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, scale: 0.88, filter: "blur(8px)" }}
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      className="relative w-full aspect-square rounded-3xl flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5"
                      style={{ boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6)" }}
                    >
                      <Music className="w-24 h-24 text-white/15" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Title + Artist + Like */}
            <AnimatePresence mode="popLayout">
              <motion.div
                key={currentSong.id + "-info"}
                initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-start justify-between gap-4 mb-7"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-extrabold text-white truncate leading-tight tracking-tight">
                    {currentSong.title}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-base text-white/50 truncate font-medium">
                      {currentSong.artist}
                    </p>
                    {isCached && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                        <WifiOff className="w-2.5 h-2.5" />
                        OFFLINE
                      </span>
                    )}
                  </div>
                  {(currentSong.album || currentSong.genre || currentSong.year) && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {currentSong.album && (
                        <span className="text-[11px] text-white/30 truncate max-w-[150px]">{currentSong.album}</span>
                      )}
                      {currentSong.album && (currentSong.genre || currentSong.year) && (
                        <span className="text-white/15">·</span>
                      )}
                      {currentSong.year && (
                        <span className="text-[11px] text-white/30">{currentSong.year}</span>
                      )}
                      {currentSong.genre && (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-white/8 text-white/50 text-[10px] font-semibold">
                          {currentSong.genre}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 1.4 }}
                  onClick={() => { toggleLike(currentSong); if (navigator.vibrate) navigator.vibrate(10); }}
                  className="p-1.5 mt-1 transition-transform"
                >
                  <motion.div
                    animate={liked ? { scale: [1, 1.4, 1] } : {}}
                    transition={{ duration: 0.35 }}
                  >
                    <Heart className={`w-7 h-7 transition-colors duration-300 ${liked ? "fill-primary text-primary drop-shadow-[0_0_16px_hsl(var(--primary)/0.6)]" : "text-white/30"}`} />
                  </motion.div>
                </motion.button>
              </motion.div>
            </AnimatePresence>

            {/* Progress bar — Apple Music style: slim with expanding thumb */}
            <div className="mb-4">
              <div
                ref={progressBarRef}
                className="relative cursor-pointer py-3 -my-3"
                style={{ touchAction: "none" }}
                onClick={handleSeek}
                onTouchStart={handleTouchSeek}
                onTouchMove={handleTouchMoveSeek}
                onTouchEnd={handleTouchEndSeek}
                onMouseDown={() => setIsSeeking(true)}
                onMouseUp={() => setIsSeeking(false)}
                onMouseLeave={() => setIsSeeking(false)}
              >
                <div className="h-[3px] rounded-full bg-white/10 relative">
                  <motion.div
                    className="h-full rounded-full bg-white/90 relative"
                    style={{ width: `${progressPct}%` }}
                    animate={{ height: isSeeking ? 6 : 3 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* Glowing thumb */}
                    <motion.div
                      animate={{ scale: isSeeking ? 1.2 : 0, opacity: isSeeking ? 1 : 0 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-[14px] h-[14px] rounded-full bg-white"
                      style={{
                        boxShadow: "0 0 10px rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.3)",
                      }}
                    />
                    {/* Time preview bubble */}
                    <AnimatePresence>
                      {isSeeking && (
                        <motion.div
                          initial={{ opacity: 0, y: 5, scale: 0.8 }}
                          animate={{ opacity: 1, y: -10, scale: 1 }}
                          exit={{ opacity: 0, y: 5, scale: 0.8 }}
                          className="absolute -right-5 -top-10 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white tabular-nums bg-white/15 backdrop-blur-xl border border-white/10"
                        >
                          {formatDuration(Math.floor(progress))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>
              </div>
              <div className="flex justify-between mt-2 text-[11px] text-white/35 tabular-nums font-medium">
                <span>{formatDuration(Math.floor(progress))}</span>
                <span>-{formatDuration(Math.max(0, Math.floor(effectiveDuration) - Math.floor(progress)))}</span>
              </div>
            </div>

            {/* Transport controls — premium, weighted hierarchy */}
            <div className="flex items-center justify-between w-full mb-7">
              <motion.button whileTap={{ scale: 0.8 }} onClick={toggleShuffle} className="transition-all p-2">
                <Shuffle className={`w-5 h-5 ${shuffle ? "text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]" : "text-white/35"}`} />
              </motion.button>
              <motion.button whileTap={{ scale: 0.75 }} onClick={previous} className="transition-all p-1">
                <SkipBack className="w-10 h-10 text-white fill-current" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => { togglePlay(); if (navigator.vibrate) navigator.vibrate(8); }}
                className="w-[76px] h-[76px] rounded-full flex items-center justify-center transition-all"
                style={{
                  background: "hsl(var(--primary))",
                  boxShadow: isPlaying
                    ? "0 0 40px hsl(var(--primary) / 0.4), 0 10px 30px hsl(0 0% 0% / 0.3)"
                    : "0 8px 30px hsl(0 0% 0% / 0.35)",
                }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isPlaying ? (
                    <motion.div key="pause" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.12 }}>
                      <Pause className="w-8 h-8 text-primary-foreground fill-current" />
                    </motion.div>
                  ) : (
                    <motion.div key="play" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.12 }}>
                      <Play className="w-8 h-8 text-primary-foreground fill-current ml-1" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
              <motion.button whileTap={{ scale: 0.75 }} onClick={next} className="relative transition-all p-1">
                <SkipForward className="w-10 h-10 text-white fill-current" />
                {nextPreloaded && (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </motion.button>
              <motion.button whileTap={{ scale: 0.8 }} onClick={cycleRepeat} className="transition-all p-2">
                {repeat === "one" ? (
                  <Repeat1 className="w-5 h-5 text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]" />
                ) : (
                  <Repeat className={`w-5 h-5 ${repeat === "all" ? "text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]" : "text-white/35"}`} />
                )}
              </motion.button>
            </div>

            {/* Bottom actions — minimal row */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { if (isCached) remove(currentSong.id); else if (!isDownloading) download(currentSong); }}
                className={`relative p-2 active:scale-90 transition-transform ${isCached ? "text-primary" : isDownloading ? "text-primary/60" : "text-white/30"}`}
              >
                {isDownloading ? (
                  <div className="relative">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-bold text-primary tabular-nums">{dlProgress}%</span>
                  </div>
                ) : isCached ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
              </button>


              <button
                onClick={() => setCrossfadeEnabled(!crossfadeEnabled)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-[0.1em] uppercase transition-all active:scale-95 ${
                  crossfadeEnabled
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-white/30 border border-white/10"
                }`}
              >
                <Disc3 className={`w-3.5 h-3.5 ${crossfadeEnabled ? "animate-spin" : ""}`} style={crossfadeEnabled ? { animationDuration: "3s" } : {}} />
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
