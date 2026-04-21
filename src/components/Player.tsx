import { usePlayerStore } from "@/stores/playerStore";
import { formatDuration } from "@/data/mockData";
import { toast } from "sonner";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  ChevronDown, ListMusic, X, Download, Check, Loader2, WifiOff,
  GripVertical, Trash2, Search, Music, Plus
} from "lucide-react";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { offlineCache } from "@/lib/offlineCache";
import { audioManager } from "@/lib/audioManager";
import type { Song } from "@/data/mockData";
import { SafeImage } from "@/components/SafeImage";
import { useRadioMetadata, type RadioMeta } from "@/hooks/useRadioMetadata";
import { useDominantColor } from "@/hooks/useDominantColor";

/* ── Add to Library Button ── */
function AddToLibraryButton({ song }: { song: Song }) {
  const { toggleLike, isLiked } = usePlayerStore();
  const inLibrary = isLiked(song.id);
  return (
    <motion.button whileTap={{ scale: 1.3 }} onClick={() => { toggleLike(song); if (navigator.vibrate) navigator.vibrate(10); }} className="p-1.5 mt-1 transition-transform">
      <motion.div animate={inLibrary ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.3 }}>
        {inLibrary ? <Check className="w-6 h-6 text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.5)]" /> : <Plus className="w-6 h-6 text-white/30" />}
      </motion.div>
    </motion.button>
  );
}

/* ── Glass style ── */
const glassStyle = {
  background: "linear-gradient(135deg, hsl(var(--card) / 0.45), hsl(var(--card) / 0.25))",
  backdropFilter: "blur(80px) saturate(2.2) brightness(1.1)",
  WebkitBackdropFilter: "blur(80px) saturate(2.2) brightness(1.1)",
  border: "0.5px solid hsl(var(--foreground) / 0.08)",
  boxShadow: "0 4px 30px hsl(0 0% 0% / 0.3), inset 0 0.5px 0 hsl(var(--foreground) / 0.1), inset 0 -0.5px 0 hsl(0 0% 0% / 0.15)",
};

/* ── Progress bar ── */
function MiniPlayerProgress({ percent, isLive }: { percent: number; isLive: boolean }) {
  if (isLive) return null;
  return (
    <div className="h-[3px] w-full" style={{ background: "hsl(var(--foreground) / 0.06)" }}>
      <motion.div className="h-full relative" style={{ width: `${percent}%`, background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))", boxShadow: "0 0 8px hsl(var(--primary) / 0.5)" }} layout transition={{ duration: 0.3, ease: "linear" }} />
    </div>
  );
}

/* ── Resume Banner ── */
function ResumeBanner({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="fixed left-1/2 -translate-x-1/2 z-[60] pointer-events-none" style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full shadow-lg" style={{ background: "hsl(var(--primary) / 0.15)", backdropFilter: "blur(20px)", border: "1px solid hsl(var(--primary) / 0.3)" }}>
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-semibold text-primary whitespace-nowrap">{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────────
   Mini Player
   ───────────────────────────────────────────── */
export function MiniPlayer() {
  const {
    currentSong, isPlaying, progress, volume, fullScreen,
    togglePlay, next, previous, setProgress, toggleFullScreen, toggleLike, isLiked, closePlayer,
    _seekTime,
  } = usePlayerStore();

  const lastSongIdRef = useRef<string | null>(null);
  const [resumeBanner, setResumeBanner] = useState<string | null>(null);
  const resumeBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closing, setClosing] = useState(false);
  const [playingFromCache, setPlayingFromCache] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const audioDuration = usePlayerStore((s) => s.audioDuration);
  const errorRetryCountRef = useRef(0);
  const audio = audioManager.audio;

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => { closePlayer(); setClosing(false); }, 50);
  }, [closePlayer]);

  const showResumeBanner = useCallback((msg: string) => {
    if (resumeBannerTimer.current) clearTimeout(resumeBannerTimer.current);
    setResumeBanner(msg);
    resumeBannerTimer.current = setTimeout(() => setResumeBanner(null), 2500);
  }, []);

  // Volume sync
  useEffect(() => { audio.volume = volume; audio.muted = false; }, [volume]);

  // Web Lock to prevent tab suspension
  useEffect(() => {
    if (!isPlaying || !currentSong) return;
    if (!("locks" in navigator)) return;
    let released = false;
    (navigator as any).locks.request("vootify-audio-bg", { mode: "exclusive" }, () => new Promise<void>((resolve) => {
      const check = setInterval(() => { if (released) { clearInterval(check); resolve(); } }, 2000);
    }));
    return () => { released = true; };
  }, [isPlaying, currentSong?.id]);

  // Visibility change — resume playback
  useEffect(() => {
    let wasPlayingBeforeHidden = false;
    const handleVisibility = () => {
      const state = usePlayerStore.getState();
      if (document.visibilityState === "hidden") { wasPlayingBeforeHidden = state.isPlaying; return; }
      if (!state.currentSong) return;
      if (!state.isPlaying && wasPlayingBeforeHidden) usePlayerStore.setState({ isPlaying: true });
      if (audio.paused && audio.src) {
        audio.play().then(() => {
          if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
          showResumeBanner("Lecture reprise ▶");
        }).catch(console.error);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [showResumeBanner]);

  // Play/Pause sync
  useEffect(() => {
    if (!currentSong || !audio.src) return;
    if (lastSongIdRef.current !== currentSong.id) return;
    if (isPlaying) {
      if (audio.paused) {
        audio.volume = volume;
        audio.play().then(() => {
          audioManager['_explicitPause'] = false;
          if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
        }).catch(() => usePlayerStore.setState({ isPlaying: false }));
      }
    } else {
      if (!audio.paused) { audioManager['_explicitPause'] = true; audio.pause(); }
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
    }
  }, [isPlaying]);

  // TimeUpdate
  const lastProgressUpdateRef = useRef(0);
  const handleTimeUpdate = useCallback(() => {
    const t = audio.currentTime;
    if (isFinite(audio.duration) && audio.duration > 0) {
      const stored = usePlayerStore.getState().audioDuration;
      if (Math.abs(stored - audio.duration) > 0.5) usePlayerStore.setState({ audioDuration: audio.duration });
    }
    const now = Date.now();
    const throttleMs = document.visibilityState === "visible" ? 250 : 3000;
    if (now - lastProgressUpdateRef.current >= throttleMs) {
      setProgress(t);
      lastProgressUpdateRef.current = now;
    }
  }, [setProgress]);

  // Ended handler
  const handleEnded = useCallback(() => {
    const { repeat } = usePlayerStore.getState();
    if (repeat === "one") { audio.currentTime = 0; audio.volume = volume; audio.play().catch(console.error); }
    else next();
  }, [next, volume]);

  // Error handler
  const handleAudioError = useCallback(async () => {
    if (!currentSong) return;
    const isRadio = currentSong.duration === 0;
    if (isRadio) {
      const retries = errorRetryCountRef.current;
      if (retries >= 5) { errorRetryCountRef.current = 0; return; }
      errorRetryCountRef.current = retries + 1;
      setTimeout(() => {
        if (!usePlayerStore.getState().isPlaying) return;
        if (currentSong.streamUrl) { audio.src = currentSong.streamUrl; audio.play().catch(console.error); }
      }, Math.min(1000 * Math.pow(2, retries), 10000));
      return;
    }
    const cachedUrl = await offlineCache.getCachedUrl(currentSong.id);
    if (cachedUrl && !audio.src.includes("blob:")) { setPlayingFromCache(true); audio.src = cachedUrl; audio.play().catch(console.error); return; }
    if (currentSong.streamUrl) { audio.src = currentSong.streamUrl; setTimeout(() => audio.play().catch(() => next()), 500); }
    else next();
  }, [currentSong, next]);

  // Event listeners
  useEffect(() => {
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleAudioError);

    const handlePlay = () => {
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
      if (!usePlayerStore.getState().isPlaying) usePlayerStore.setState({ isPlaying: true });
      setIsBuffering(false);
    };
    const handlePause = () => {
      if (audioManager.wasExplicitlyPaused) {
        if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
        if (usePlayerStore.getState().isPlaying) usePlayerStore.setState({ isPlaying: false });
      } else {
        setTimeout(() => {
          if (audio.paused && !audioManager.wasExplicitlyPaused && usePlayerStore.getState().isPlaying) {
            usePlayerStore.setState({ isPlaying: false });
          }
        }, 12000);
      }
    };
    const handlePlaying = () => {
      if (!usePlayerStore.getState().isPlaying) usePlayerStore.setState({ isPlaying: true });
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("playing", handlePlaying);

    const reconcileInterval = setInterval(() => {
      const state = usePlayerStore.getState();
      if (!state.currentSong) return;
      if (state.isPlaying && audio.paused && !audio.ended && audio.readyState >= 2) audio.play().catch(() => usePlayerStore.setState({ isPlaying: false }));
      if (!state.isPlaying && !audio.paused && audioManager.wasExplicitlyPaused) audio.pause();
    }, 3000);

    const onBuffering = () => setIsBuffering(true);
    const onReady = () => setIsBuffering(false);
    window.addEventListener("audio-buffering", onBuffering);
    window.addEventListener("audio-ready", onReady);

    const onAudioNext = () => usePlayerStore.getState().next();
    const onAudioPrev = () => usePlayerStore.getState().previous();
    window.addEventListener("audio-next", onAudioNext);
    window.addEventListener("audio-prev", onAudioPrev);

    const onAudioSeeked = (e: Event) => {
      const seekTime = (e as CustomEvent).detail;
      if (typeof seekTime === "number" && isFinite(seekTime)) {
        const duration = audio.duration || usePlayerStore.getState().audioDuration;
        if (duration > 0) usePlayerStore.setState({ progress: (seekTime / duration) * 100 });
      }
    };
    window.addEventListener("audio-seeked", onAudioSeeked);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleAudioError);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("playing", handlePlaying);
      window.removeEventListener("audio-buffering", onBuffering);
      window.removeEventListener("audio-ready", onReady);
      window.removeEventListener("audio-next", onAudioNext);
      window.removeEventListener("audio-prev", onAudioPrev);
      window.removeEventListener("audio-seeked", onAudioSeeked);
      clearInterval(reconcileInterval);
    };
  }, [handleTimeUpdate, handleEnded, handleAudioError]);

  // Track loading
  useEffect(() => {
    if (!currentSong) return;
    const isNewTrack = lastSongIdRef.current !== currentSong.id;
    if (!isNewTrack) return;
    lastSongIdRef.current = currentSong.id;
    usePlayerStore.setState({ audioDuration: 0 });
    errorRetryCountRef.current = 0;
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
    if (navigator.vibrate) navigator.vibrate(8);

    const loadAndPlay = async () => {
      let songToPlay = currentSong;
      const cachedUrl = await offlineCache.getCachedUrl(songToPlay.id);
      if (cachedUrl) {
        const cachedCover = await offlineCache.getCachedCoverUrl(songToPlay.id);
        if (cachedCover) { songToPlay = { ...songToPlay, coverUrl: cachedCover }; usePlayerStore.setState({ currentSong: songToPlay }); }
      } else if (!songToPlay.streamUrl) {
        toast.error(`"${songToPlay.title}" n'est pas disponible`);
        setTimeout(() => usePlayerStore.getState().next(), 300);
        return;
      }
      const srcToUse = cachedUrl || songToPlay.streamUrl;
      setPlayingFromCache(!!cachedUrl);
      if (!srcToUse) return;
      const isLiveTrack = songToPlay.duration === 0;
      audioManager.play({ url: srcToUse, title: songToPlay.title, artist: songToPlay.artist, cover: songToPlay.coverUrl, album: songToPlay.album || undefined, isLive: isLiveTrack });
      audio.volume = volume;
    };
    loadAndPlay();
  }, [currentSong?.id]);

  // Seek
  useEffect(() => {
    if (_seekTime !== null) { audio.currentTime = _seekTime; usePlayerStore.setState({ _seekTime: null }); }
  }, [_seekTime]);

  const isLive = currentSong ? currentSong.duration === 0 : false;

  // Radio metadata
  const radioMeta = useRadioMetadata(isLive ? currentSong?.title ?? null : null, isPlaying);
  useEffect(() => {
    if (!radioMeta || !currentSong || !isLive) return;
    audioManager.updateMetadata({ title: radioMeta.title, artist: radioMeta.artist, cover: radioMeta.cover || currentSong.coverUrl, album: currentSong.title, isLive: true });
  }, [radioMeta?.title, radioMeta?.artist]);

  // Media Session controls
  const queueLen = usePlayerStore((s) => s.queue.length);
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentSong) return;
    const ms = navigator.mediaSession;
    const liveStream = currentSong.duration === 0;
    const hasMultiple = queueLen > 1;
    const safeSet = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => { try { ms.setActionHandler(action, handler); } catch {} };
    safeSet("play", () => { usePlayerStore.setState({ isPlaying: true }); audioManager['_explicitPause'] = false; if (audio.paused && audio.src) audio.play().catch(() => usePlayerStore.setState({ isPlaying: false })); ms.playbackState = "playing"; });
    safeSet("pause", () => { usePlayerStore.setState({ isPlaying: false }); audioManager['_explicitPause'] = true; audioManager['_cancelInterruptRecovery'](); audio.pause(); ms.playbackState = "paused"; });
    safeSet("stop", () => { usePlayerStore.getState().closePlayer(); ms.playbackState = "none"; });
    if (liveStream) {
      if (hasMultiple) { safeSet("previoustrack", () => { usePlayerStore.getState().previous(); ms.playbackState = "playing"; }); safeSet("nexttrack", () => { usePlayerStore.getState().next(); ms.playbackState = "playing"; }); }
      else { safeSet("previoustrack", null); safeSet("nexttrack", null); }
      safeSet("seekbackward", null); safeSet("seekforward", null); safeSet("seekto", null);
    } else {
      safeSet("previoustrack", () => { usePlayerStore.getState().previous(); ms.playbackState = "playing"; });
      safeSet("nexttrack", () => { usePlayerStore.getState().next(); ms.playbackState = "playing"; });
      safeSet("seekbackward", null); safeSet("seekforward", null); safeSet("seekto", null);
    }
  }, [currentSong?.id, queueLen]);

  // Media Session metadata
  useEffect(() => {
    if (!currentSong) return;
    audioManager.updateMetadata({ title: currentSong.title, artist: currentSong.artist, cover: currentSong.coverUrl, album: currentSong.album || (isLive ? "Radio" : undefined), isLive });
  }, [currentSong?.id, currentSong?.title, isLive]);

  // Playback state sync
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentSong) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying, currentSong]);

  // Position sync for lock screen
  const syncPositionState = useCallback(() => {
    if (!("mediaSession" in navigator) || !currentSong || isLive) return;
    const realDuration = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : currentSong.duration;
    if (realDuration <= 0) return;
    try { navigator.mediaSession.setPositionState({ duration: realDuration, playbackRate: 1, position: Math.max(0, Math.min(audio.currentTime ?? progress, realDuration)) }); } catch {}
  }, [currentSong, isLive, progress]);

  const positionSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (positionSyncRef.current) clearInterval(positionSyncRef.current);
    if (!currentSong || isLive || !isPlaying) return;
    syncPositionState();
    positionSyncRef.current = setInterval(syncPositionState, 1000);
    return () => { if (positionSyncRef.current) clearInterval(positionSyncRef.current); };
  }, [currentSong?.id, isPlaying, isLive, syncPositionState]);

  useEffect(() => { return () => { if ("mediaSession" in navigator) { navigator.mediaSession.playbackState = "none"; navigator.mediaSession.metadata = null; } }; }, []);

  if (!currentSong) return null;

  const effectiveDuration = audioDuration > 0 ? audioDuration : currentSong.duration;
  const progressPct = !isLive && effectiveDuration > 0 ? (progress / effectiveDuration) * 100 : 0;

  // Radio mini-player
  if (isLive) {
    const displayTitle = radioMeta?.title || currentSong.title;
    const displayArtist = radioMeta?.artist || currentSong.artist || "Radio";
    const displayCover = radioMeta?.cover || currentSong.coverUrl;
    const hasMultipleStations = usePlayerStore.getState().queue.length > 1;

    return (
      <>
        {!closing && (
          <div className="fixed left-0 right-0 z-50 md:bottom-0 px-3 pb-1.5" style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))", pointerEvents: fullScreen ? "none" : "auto", opacity: fullScreen ? 0 : 1, transform: fullScreen ? "scale(0.92) translateY(60px)" : "none", transition: "opacity 0.2s, transform 0.2s" }}>
            <div className="rounded-2xl overflow-hidden" style={glassStyle}>
              <MiniPlayerProgress percent={0} isLive />
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={toggleFullScreen}>
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
                    {displayCover ? <SafeImage src={displayCover} alt={currentSong.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5"><Music className="w-5 h-5 text-primary/40" /></div>}
                    {isPlaying && <div className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold truncate text-foreground leading-tight">{displayTitle}</p>
                    <div className="text-[11px] truncate text-muted-foreground leading-tight mt-0.5 inline-flex items-center gap-1.5">
                      <span>{displayArtist}</span>
                      <span className="shrink-0 inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary" style={{ boxShadow: "0 0 6px hsl(var(--primary) / 0.3)" }}>LIVE</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {hasMultipleStations && <button onClick={previous} className="p-2 active:scale-90 transition-transform"><SkipBack className="w-4 h-4 text-foreground fill-current" /></button>}
                  <button onClick={togglePlay} className="w-10 h-10 rounded-full flex items-center justify-center bg-foreground active:scale-90 transition-transform" style={{ boxShadow: "0 2px 12px hsl(0 0% 0% / 0.3)" }}>
                    {isBuffering ? <Loader2 className="w-4 h-4 text-background animate-spin" /> : isPlaying ? <Pause className="w-4 h-4 text-background fill-current" /> : <Play className="w-4 h-4 text-background fill-current ml-0.5" />}
                  </button>
                  {hasMultipleStations && <button onClick={next} className="p-2 active:scale-90 transition-transform"><SkipForward className="w-4 h-4 text-foreground fill-current" /></button>}
                  <button onClick={handleClose} className="p-2 text-muted-foreground active:scale-90 transition-transform"><X className="w-5 h-5" /></button>
                </div>
              </div>
            </div>
          </div>
        )}
        <ResumeBanner message={resumeBanner} />
      </>
    );
  }

  // Standard music mini-player
  return (
    <>
      {!closing && (
        <div className="fixed left-0 right-0 z-50 md:bottom-0 px-3 pb-1.5" style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))", pointerEvents: fullScreen ? "none" : "auto", opacity: fullScreen ? 0 : 1, transform: fullScreen ? "scale(0.92) translateY(60px)" : "none", transition: "opacity 0.2s, transform 0.2s" }}>
          <div className="rounded-2xl overflow-hidden" style={glassStyle}>
            <MiniPlayerProgress percent={progressPct} isLive={false} />
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={toggleFullScreen}>
                <motion.div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }} whileTap={{ scale: 0.92 }}>
                  {currentSong.coverUrl ? (
                    <motion.img key={currentSong.coverUrl} src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full object-cover" initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5"><Music className="w-5 h-5 text-primary/40" /></div>
                  )}
                  {isPlaying && <div className="absolute inset-0 rounded-xl" style={{ boxShadow: "inset 0 0 12px hsl(var(--primary) / 0.15)" }} />}
                </motion.div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold truncate text-foreground leading-tight">{currentSong.title}</p>
                  <div className="text-[11px] truncate text-muted-foreground leading-tight mt-0.5 inline-flex items-center">
                    {currentSong.artist}
                    {playingFromCache && (
                      <span className="ml-1.5 inline-flex items-center gap-1 text-primary"><WifiOff className="w-2.5 h-2.5" /><span className="font-semibold text-[10px]">OFFLINE</span></span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={(e) => { e.stopPropagation(); toggleLike(currentSong); }} className="p-2 active:scale-90 transition-transform">
                  {isLiked(currentSong.id) ? <Check className="w-4 h-4 text-primary" /> : <Plus className="w-4 h-4 text-muted-foreground" />}
                </button>
                <button onClick={togglePlay} className="w-10 h-10 rounded-full flex items-center justify-center bg-foreground active:scale-90 transition-transform" style={{ boxShadow: "0 2px 12px hsl(0 0% 0% / 0.3)" }}>
                  {isBuffering ? <Loader2 className="w-4 h-4 text-background animate-spin" /> : isPlaying ? <Pause className="w-4 h-4 text-background fill-current" /> : <Play className="w-4 h-4 text-background fill-current ml-0.5" />}
                </button>
                <button onClick={next} className="relative p-2 text-foreground active:scale-90 transition-transform"><SkipForward className="w-5 h-5 fill-current" /></button>
                <button onClick={handleClose} className="p-2 text-muted-foreground active:scale-90 transition-transform"><X className="w-5 h-5" /></button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ResumeBanner message={resumeBanner} />
    </>
  );
}

/* ─────────────────────────────────────────────
   Radio Fullscreen Player
   ───────────────────────────────────────────── */
function RadioFullScreen({ onClose, radioMeta }: { onClose: () => void; radioMeta: RadioMeta | null }) {
  const { currentSong, isPlaying, togglePlay, next, previous, queue } = usePlayerStore();
  const displayTitle = radioMeta?.title || currentSong?.title || "";
  const displayArtist = radioMeta?.artist || currentSong?.artist || "Radio";
  const displayCover = radioMeta?.cover || currentSong?.coverUrl;
  const dominantColor = useDominantColor(displayCover);

  if (!currentSong) return null;
  const stationName = currentSong.title;
  const bgColor = dominantColor || "hsl(0 0% 4%)";

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 200, mass: 0.8 }}
      drag="y" dragDirectionLock dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.05, bottom: 0.8 }}
      onDragEnd={(_, info) => { if (info.offset.y > 80 || info.velocity.y > 300) onClose(); }}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
      style={{ background: bgColor, transition: "background 1s ease-in-out", touchAction: "pan-x" }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.img key={displayCover} src={displayCover} alt="" initial={{ opacity: 0 }} animate={{ opacity: 0.25 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }} className="absolute inset-0 w-full h-full object-cover scale-[2] blur-[120px]" />
        </AnimatePresence>
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 0%, hsl(0 0% 0% / 0.3) 60%, hsl(0 0% 0% / 0.6) 100%)" }} />
      </div>

      <div className="relative z-10 flex justify-center pb-1" style={{ paddingTop: "calc(env(safe-area-inset-top, 12px) + 8px)" }}>
        <div className="w-10 h-1 rounded-full bg-foreground/20" />
      </div>

      <div className="relative z-10 flex items-center justify-between px-5 pb-2">
        <button onClick={onClose} className="p-1 active:scale-90 transition-transform"><ChevronDown className="w-7 h-7 text-foreground/70" /></button>
        <div className="flex-1 text-center px-4">
          <div className="flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] font-bold text-primary tracking-widest uppercase">EN DIRECT</span>
          </div>
          <p className="text-[12px] font-bold text-foreground/80 truncate">{stationName}</p>
        </div>
        <div className="w-7" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col px-7 pb-8 overflow-hidden">
        <div className="flex-1 flex items-center justify-center py-4">
          <AnimatePresence mode="wait">
            <motion.img key={displayCover} src={displayCover} alt={displayTitle} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} className="w-full max-w-[340px] aspect-square rounded-xl object-cover relative z-10" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} />
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-extrabold text-foreground truncate leading-tight">{displayTitle}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[15px] text-foreground/60 truncate">{displayArtist}</p>
              <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">LIVE</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-8 w-full mb-6">
          {queue.length > 1 && <motion.button whileTap={{ scale: 0.75 }} onClick={previous} className="p-1"><SkipBack className="w-8 h-8 text-foreground/70 fill-current" /></motion.button>}
          <button onClick={togglePlay} className="w-[72px] h-[72px] rounded-full flex items-center justify-center active:scale-90 transition-transform" style={{ background: "hsl(var(--primary))", boxShadow: "0 0 40px hsl(var(--primary) / 0.4)" }}>
            {isPlaying ? <Pause className="w-9 h-9 text-primary-foreground fill-current" /> : <Play className="w-9 h-9 text-primary-foreground fill-current ml-1" />}
          </button>
          {queue.length > 1 && <motion.button whileTap={{ scale: 0.75 }} onClick={next} className="p-1"><SkipForward className="w-8 h-8 text-foreground/70 fill-current" /></motion.button>}
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Music Fullscreen Player
   ───────────────────────────────────────────── */
function MusicFullScreen({ onClose }: { onClose: () => void }) {
  const {
    currentSong, isPlaying, progress, shuffle, repeat,
    togglePlay, next, previous, toggleShuffle, cycleRepeat,
    seekTo: storeSeekTo, setQueue, play, queue, isLiked,
  } = usePlayerStore();

  const navigate = useNavigate();
  const [showQueue, setShowQueue] = useState(false);
  const audioDuration = usePlayerStore((s) => s.audioDuration);
  const dominantColor = useDominantColor(currentSong?.coverUrl);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const { isCached, isDownloading, progress: dlProgress, download, remove } = useOfflineCache(currentSong?.id);

  if (!currentSong) return null;

  const effectiveDuration = audioDuration > 0 ? audioDuration : currentSong.duration;
  const progressPct = effectiveDuration > 0 ? (progress / effectiveDuration) * 100 : 0;
  const bgColor = dominantColor || "hsl(220 16% 5%)";

  const seekFromX = (clientX: number) => {
    const bar = progressBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    storeSeekTo(Math.floor(pct * effectiveDuration));
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => seekFromX(e.clientX);
  const handleTouchSeek = (e: React.TouchEvent<HTMLDivElement>) => { e.stopPropagation(); setIsSeeking(true); seekFromX(e.touches[0].clientX); };
  const handleTouchMoveSeek = (e: React.TouchEvent<HTMLDivElement>) => { e.stopPropagation(); seekFromX(e.touches[0].clientX); };
  const handleTouchEndSeek = () => setIsSeeking(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 32, stiffness: 280, mass: 0.9 }}
      drag="y" dragDirectionLock dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.03, bottom: 0.6 }}
      onDragEnd={(_, info) => { if (info.offset.y > 80 || info.velocity.y > 300) onClose(); }}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden" style={{ touchAction: "pan-x" }}
    >
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 transition-colors" style={{ background: bgColor, transitionDuration: '1.5s' }} />
        <AnimatePresence mode="popLayout">
          {currentSong.coverUrl && <motion.img key={currentSong.id + "-bg"} src={currentSong.coverUrl} alt="" initial={{ opacity: 0 }} animate={{ opacity: 0.35 }} exit={{ opacity: 0 }} transition={{ duration: 1.5 }} className="absolute inset-0 w-full h-full object-cover scale-[1.8] blur-[100px] saturate-150" />}
        </AnimatePresence>
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, transparent 0%, hsl(220 16% 5% / 0.4) 100%), linear-gradient(to bottom, hsl(220 16% 5% / 0.1) 0%, hsl(220 16% 5% / 0.3) 40%, hsl(220 16% 5% / 0.7) 80%, hsl(220 16% 5% / 0.9) 100%)" }} />
      </div>

      {/* Drag handle */}
      <div className="relative z-10 flex justify-center pb-1" style={{ paddingTop: "calc(env(safe-area-inset-top, 12px) + 8px)" }}>
        <div className="w-9 h-[5px] rounded-full bg-white/20" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center px-6 pb-3">
        <div className="w-[72px] flex items-center justify-start">
          <motion.button whileTap={{ scale: 0.85 }} onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(0 0% 100% / 0.12), hsl(0 0% 100% / 0.04))", border: "0.5px solid hsl(0 0% 100% / 0.1)" }}>
            <ChevronDown className="w-5 h-5 text-white/80" />
          </motion.button>
        </div>
        <div className="flex-1 text-center">
          <p className="text-[10px] font-semibold text-white/40 tracking-[0.15em] uppercase">En lecture</p>
          <p className="text-[12px] font-bold text-white/70 truncate mt-0.5">{currentSong.album || "Ma bibliothèque"}</p>
        </div>
        <div className="flex items-center justify-end gap-1">
          {[
            { icon: <Search className="w-[18px] h-[18px]" />, onClick: () => { const q = encodeURIComponent(`${currentSong.title} ${currentSong.artist}`.trim()); onClose(); setTimeout(() => navigate(`/search?q=${q}`), 150); }, active: false },
            { icon: showQueue ? <X className="w-[18px] h-[18px]" /> : <ListMusic className="w-[18px] h-[18px]" />, onClick: () => setShowQueue(!showQueue), active: showQueue },
          ].map((btn, i) => (
            <motion.button key={i} whileTap={{ scale: 0.88 }} onClick={btn.onClick} className={`w-10 h-10 rounded-2xl flex items-center justify-center ${btn.active ? "text-primary" : "text-white/70"}`}
              style={{ background: btn.active ? "linear-gradient(145deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.08))" : "linear-gradient(145deg, hsl(0 0% 100% / 0.12), hsl(0 0% 100% / 0.04))", border: btn.active ? "0.5px solid hsl(var(--primary) / 0.3)" : "0.5px solid hsl(0 0% 100% / 0.08)" }}>
              {btn.icon}
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showQueue ? (
          <motion.div key="queue" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="relative z-10 flex-1 overflow-y-auto px-5 pb-4 scrollbar-hide">
            <div className="sticky top-0 z-10 pt-2 pb-3" style={{ background: `${bgColor}ee` }}>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-2">En cours de lecture</h3>
              <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-white/8" style={{ background: "linear-gradient(135deg, hsl(0 0% 100% / 0.1), hsl(0 0% 100% / 0.03))" }}>
                {currentSong.coverUrl ? <SafeImage src={currentSong.coverUrl} alt="" className="w-14 h-14 rounded-xl object-cover shadow-2xl" /> : <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5"><Music className="w-6 h-6 text-primary/40" /></div>}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-primary truncate">{currentSong.title}</p>
                  <p className="text-xs text-white/40 truncate">{currentSong.artist}</p>
                </div>
                <span className="text-xs text-white/30 tabular-nums">{formatDuration(effectiveDuration)}</span>
              </div>
            </div>

            {(() => {
              const currentIdx = queue.findIndex((s) => s.id === currentSong.id);
              const upcoming = currentIdx >= 0 ? queue.slice(currentIdx + 1) : [];
              const played = currentIdx > 0 ? queue.slice(0, currentIdx) : [];
              return (
                <>
                  {upcoming.length > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">À suivre · {upcoming.length}</h3>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setQueue(currentSong ? [currentSong] : [])} className="text-[10px] font-semibold text-destructive/70 px-2 py-1 rounded-full bg-destructive/10 active:scale-95 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Vider</button>
                          <button onClick={() => { const shuffled = [...upcoming].sort(() => Math.random() - 0.5); setQueue([...played, currentSong, ...shuffled]); }} className="text-[10px] font-semibold text-primary/70 px-2 py-1 rounded-full bg-primary/10 active:scale-95 flex items-center gap-1"><Shuffle className="w-3 h-3" /> Mélanger</button>
                        </div>
                      </div>
                      <Reorder.Group axis="y" values={upcoming} onReorder={(newUpcoming) => setQueue([...played, currentSong, ...newUpcoming])} className="space-y-0.5">
                        {upcoming.map((song, i) => (
                          <Reorder.Item key={song.id} value={song} className="group cursor-grab active:cursor-grabbing" style={{ touchAction: "pan-x" }}>
                            <div onClick={() => { play(song); setQueue(queue); }} className="w-full flex items-center gap-2 p-2.5 rounded-xl text-left hover:bg-white/5 transition-colors">
                              <GripVertical className="w-4 h-4 text-white/15 shrink-0 touch-none" />
                              <span className="w-4 text-center text-[11px] text-white/25 tabular-nums">{i + 1}</span>
                              {song.coverUrl ? <SafeImage src={song.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover shadow" /> : <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5"><Music className="w-4 h-4 text-primary/40" /></div>}
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] text-white truncate font-medium">{song.title}</p>
                                <p className="text-[11px] text-white/35 truncate">{song.artist}</p>
                              </div>
                              <span className="text-[11px] text-white/25 tabular-nums">{formatDuration(song.duration)}</span>
                              <button onClick={(e) => { e.stopPropagation(); setQueue(queue.filter((s) => s.id !== song.id)); }} className="p-1 rounded-full opacity-0 group-hover:opacity-100 text-white/25 hover:text-destructive transition-all"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>
                    </div>
                  )}
                  {played.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/15 mb-2">Déjà joué · {played.length}</h3>
                      <div className="space-y-0.5">
                        {played.map((song) => (
                          <button key={song.id} onClick={() => { play(song); setQueue(queue); }} className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-white/5 transition-colors opacity-35 hover:opacity-60">
                            {song.coverUrl ? <SafeImage src={song.coverUrl} alt="" className="w-9 h-9 rounded-lg object-cover" /> : <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5"><Music className="w-4 h-4 text-primary/40" /></div>}
                            <div className="min-w-0 flex-1"><p className="text-[12px] text-white truncate">{song.title}</p><p className="text-[10px] text-white/35 truncate">{song.artist}</p></div>
                            <span className="text-[10px] text-white/25 tabular-nums">{formatDuration(song.duration)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {upcoming.length === 0 && played.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-white/25"><ListMusic className="w-10 h-10 mb-3 opacity-50" /><p className="text-sm font-medium">File d'attente vide</p></div>
                  )}
                </>
              );
            })()}
          </motion.div>
        ) : (
          <motion.div key="player" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="relative z-10 flex-1 flex flex-col px-8 pb-10">
            {/* Cover art */}
            <div className="flex-1 flex items-center justify-center py-2">
              <div className="relative w-full max-w-[360px]">
                {currentSong.coverUrl && <div className="absolute inset-0 scale-90 blur-[60px] opacity-40 rounded-3xl overflow-hidden"><SafeImage src={currentSong.coverUrl} alt="" className="w-full h-full object-cover" /></div>}
                <AnimatePresence mode="popLayout">
                  {currentSong.coverUrl ? (
                    <motion.img key={currentSong.id} src={currentSong.coverUrl} alt={currentSong.title} initial={{ opacity: 0, scale: 0.82, filter: "blur(12px)", y: 20 }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)", y: 0 }} exit={{ opacity: 0, scale: 0.88, filter: "blur(8px)", y: -15 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} className="relative w-full aspect-square rounded-3xl object-cover" style={{ boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)" }} />
                  ) : (
                    <motion.div key={currentSong.id + "-ph"} initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full aspect-square rounded-3xl flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5">
                      <Music className="w-24 h-24 text-white/15" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Title + Artist */}
            <AnimatePresence mode="popLayout">
              <motion.div key={currentSong.id + "-info"} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex items-start justify-between gap-4 mb-7">
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-extrabold text-white truncate leading-tight tracking-tight">{currentSong.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => { onClose(); setTimeout(() => navigate(`/artist/${encodeURIComponent(currentSong.artist)}`), 150); }} className="text-base text-white/50 truncate font-medium hover:text-white/80 text-left">{currentSong.artist}</button>
                    {isCached && <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30"><WifiOff className="w-2.5 h-2.5" /> OFFLINE</span>}
                  </div>
                  {(currentSong.album || currentSong.genre || currentSong.year) && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {currentSong.album && <button onClick={() => { onClose(); setTimeout(() => navigate(`/album/by-name/${encodeURIComponent(currentSong.album!)}`), 150); }} className="text-[11px] text-white/30 truncate max-w-[150px] hover:text-white/60 text-left">{currentSong.album}</button>}
                      {currentSong.album && (currentSong.genre || currentSong.year) && <span className="text-white/15">·</span>}
                      {currentSong.year && <span className="text-[11px] text-white/30">{currentSong.year}</span>}
                      {currentSong.genre && <span className="inline-flex px-2 py-0.5 rounded-full bg-white/8 text-white/50 text-[10px] font-semibold">{currentSong.genre}</span>}
                    </div>
                  )}
                </div>
                <AddToLibraryButton song={currentSong} />
              </motion.div>
            </AnimatePresence>

            {/* Progress bar */}
            <div className="mb-4">
              <div ref={progressBarRef} className="relative cursor-pointer py-3 -my-3" style={{ touchAction: "none" }} onClick={handleSeek} onTouchStart={handleTouchSeek} onTouchMove={handleTouchMoveSeek} onTouchEnd={handleTouchEndSeek} onMouseDown={() => setIsSeeking(true)} onMouseUp={() => setIsSeeking(false)} onMouseLeave={() => setIsSeeking(false)}>
                <div className="h-[3px] rounded-full bg-white/10 relative">
                  <motion.div className="h-full rounded-full bg-white/90 relative" style={{ width: `${progressPct}%` }} animate={{ height: isSeeking ? 6 : 3 }} transition={{ duration: 0.15 }}>
                    <motion.div animate={{ scale: isSeeking ? 1.2 : 0, opacity: isSeeking ? 1 : 0 }} className="absolute right-0 top-1/2 -translate-y-1/2 w-[14px] h-[14px] rounded-full bg-white" style={{ boxShadow: "0 0 10px rgba(255,255,255,0.4)" }} />
                    <AnimatePresence>
                      {isSeeking && <motion.div initial={{ opacity: 0, y: 5, scale: 0.8 }} animate={{ opacity: 1, y: -10, scale: 1 }} exit={{ opacity: 0, y: 5, scale: 0.8 }} className="absolute -right-5 -top-10 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white tabular-nums" style={{ background: "linear-gradient(135deg, hsl(0 0% 100% / 0.18), hsl(0 0% 100% / 0.06))", backdropFilter: "blur(80px)" }}>{formatDuration(Math.floor(progress))}</motion.div>}
                    </AnimatePresence>
                  </motion.div>
                </div>
              </div>
              <div className="flex justify-between mt-2 text-[11px] text-white/35 tabular-nums font-medium">
                <span>{formatDuration(Math.floor(progress))}</span>
                <span>-{formatDuration(Math.max(0, Math.floor(effectiveDuration) - Math.floor(progress)))}</span>
              </div>
            </div>

            {/* Transport controls */}
            <div className="flex items-center justify-between w-full mb-7">
              <motion.button whileTap={{ scale: 0.8 }} onClick={toggleShuffle} className="p-2"><Shuffle className={`w-5 h-5 ${shuffle ? "text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]" : "text-white/35"}`} /></motion.button>
              <motion.button whileTap={{ scale: 0.75 }} onClick={previous} className="p-1"><SkipBack className="w-10 h-10 text-white fill-current" /></motion.button>
              <motion.button whileTap={{ scale: 0.85 }} onClick={() => { togglePlay(); if (navigator.vibrate) navigator.vibrate(8); }} className="w-[76px] h-[76px] rounded-full flex items-center justify-center" style={{ background: "hsl(var(--primary))", boxShadow: isPlaying ? "0 0 40px hsl(var(--primary) / 0.4), 0 10px 30px hsl(0 0% 0% / 0.3)" : "0 8px 30px hsl(0 0% 0% / 0.35)" }}>
                <AnimatePresence mode="wait" initial={false}>
                  {isPlaying ? <motion.div key="pause" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.12 }}><Pause className="w-8 h-8 text-primary-foreground fill-current" /></motion.div> : <motion.div key="play" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.12 }}><Play className="w-8 h-8 text-primary-foreground fill-current ml-1" /></motion.div>}
                </AnimatePresence>
              </motion.button>
              <motion.button whileTap={{ scale: 0.75 }} onClick={next} className="p-1"><SkipForward className="w-10 h-10 text-white fill-current" /></motion.button>
              <motion.button whileTap={{ scale: 0.8 }} onClick={cycleRepeat} className="p-2">
                {repeat === "one" ? <Repeat1 className="w-5 h-5 text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]" /> : <Repeat className={`w-5 h-5 ${repeat === "all" ? "text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]" : "text-white/35"}`} />}
              </motion.button>
            </div>

            {/* Bottom actions */}
            <div className="flex items-center justify-center">
              <button onClick={() => { if (isCached) remove(currentSong.id); else if (!isDownloading) download(currentSong); }} className={`relative p-2 active:scale-90 transition-transform ${isCached ? "text-primary" : isDownloading ? "text-primary/60" : "text-white/30"}`}>
                {isDownloading ? <div className="relative"><Loader2 className="w-5 h-5 animate-spin" /><span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-bold text-primary tabular-nums">{dlProgress}%</span></div> : isCached ? <Check className="w-5 h-5" /> : <Download className="w-5 h-5" />}
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
  const { currentSong, fullScreen, toggleFullScreen, isPlaying } = usePlayerStore();
  const isLive = currentSong ? currentSong.duration === 0 : false;
  const radioMeta = useRadioMetadata(isLive ? currentSong?.title ?? null : null, isPlaying);
  if (!currentSong || !fullScreen) return null;
  return isLive ? <RadioFullScreen onClose={toggleFullScreen} radioMeta={radioMeta} /> : <MusicFullScreen onClose={toggleFullScreen} />;
}
