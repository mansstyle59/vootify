import { usePlayerStore } from "@/stores/playerStore";
import { formatDuration } from "@/data/mockData";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Heart, ChevronDown, ListMusic, X, MoreHorizontal, PlusCircle, Disc3,
  Download, Check, Loader2, AlertTriangle
} from "lucide-react";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useCallback, useState } from "react";
import { AudioVisualizer } from "./AudioVisualizer";
import { useRadioMetadata } from "@/hooks/useRadioMetadata";
import { offlineCache } from "@/lib/offlineCache";
import { deezerApi } from "@/lib/deezerApi";
import { jiosaavnApi } from "@/lib/jiosaavnApi";
import { useDominantColor } from "@/hooks/useDominantColor";

/* ── Shared glass styles ── */
const glassStyle = {
  background: "linear-gradient(135deg, hsl(0 0% 100% / 0.08), hsl(0 0% 100% / 0.03))",
  backdropFilter: "blur(60px) saturate(1.6)",
  WebkitBackdropFilter: "blur(60px) saturate(1.6)",
  border: "1px solid hsl(0 0% 100% / 0.1)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 hsl(0 0% 100% / 0.1), inset 0 -1px 0 hsl(0 0% 0% / 0.1)",
};

const glassButtonStyle = {
  background: "hsl(0 0% 100% / 0.08)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid hsl(0 0% 100% / 0.1)",
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
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSongIdRef = useRef<string | null>(null);
  const [playingFromCache, setPlayingFromCache] = useState(false);

  const CROSSFADE_MS = crossfadeDuration * 1000;
  const FADE_STEP = 50;

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  // Crossfade logic
  useEffect(() => {
    if (!audioRef.current || !currentSong) return;
    const audio = audioRef.current;
    const prevSongId = lastSongIdRef.current;
    lastSongIdRef.current = currentSong.id;

    const isNewTrack = prevSongId !== null && prevSongId !== currentSong.id;

    const loadAndPlay = async () => {
      let songToPlay = currentSong;

      // PRIORITY: check offline cache first — essential for airplane mode
      const cachedUrl = await offlineCache.getCachedUrl(songToPlay.id);

      if (!cachedUrl) {
        // Only attempt network resolution if not cached
        if (songToPlay.id.startsWith("dz-") && songToPlay.streamUrl && songToPlay.streamUrl.includes("cdn-preview")) {
          try {
            const originalPreview = songToPlay.streamUrl;
            const resolved = await deezerApi.resolveFullStream(songToPlay);
            if (resolved.streamUrl !== songToPlay.streamUrl) {
              songToPlay = resolved;
              usePlayerStore.setState({ currentSong: resolved, originalStreamUrl: originalPreview });
            }
          } catch (e) {
            console.error("Failed to resolve full stream:", e);
          }
        }

        // Fallback: if song has no stream URL (e.g. custom song without file), search JioSaavn
        if (!songToPlay.streamUrl) {
          try {
            const mainArtist = songToPlay.artist.split(",")[0].trim();
            const query = `${mainArtist} ${songToPlay.title}`;
            const results = await jiosaavnApi.search(query, 5);
            const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
            const targetTitle = norm(songToPlay.title);
            const bestMatch = results.find((r) => r.streamUrl && norm(r.title).includes(targetTitle))
              || results.find((r) => !!r.streamUrl);
            if (bestMatch?.streamUrl) {
              console.log("Custom song resolved via JioSaavn:", bestMatch.title);
              songToPlay = { ...songToPlay, streamUrl: bestMatch.streamUrl, coverUrl: bestMatch.coverUrl || songToPlay.coverUrl };
              usePlayerStore.setState({ currentSong: songToPlay });
            }
          } catch (e) {
            console.error("JioSaavn fallback failed:", e);
          }
        }
      }

      const srcToUse = cachedUrl || songToPlay.streamUrl;

      if (crossfadeEnabled && isNewTrack && audio.src && !audio.paused) {
        // Crossfade: move current audio to crossfade ref and fade it out
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        const oldAudio = crossfadeRef.current!;
        oldAudio.src = audio.src;
        oldAudio.currentTime = audio.currentTime;
        oldAudio.volume = volume;
        oldAudio.play().catch(() => {});

        // Fade out old
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

        // Start new track with fade in
        if (srcToUse && audio.src !== srcToUse) {
          audio.src = srcToUse;
          audio.load();
        }
        audio.volume = 0;
        audio.play().catch(console.error);
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
        // Normal play (first track or play/pause toggle)
        if (srcToUse && audio.src !== srcToUse) {
          audio.src = srcToUse;
          audio.load();
        }
        if (isPlaying) {
          audio.play().catch(console.error);
        } else {
          audio.pause();
        }
      }
    };

    loadAndPlay();
  }, [isPlaying, currentSong]);

  const preemptiveTriggeredRef = useRef(false);

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const t = Math.floor(audio.currentTime);
    if (t !== progress) setProgress(t);

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
  }, [progress, setProgress, volume, next]);

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
  useEffect(() => {
    if (!currentSong || !("mediaSession" in navigator)) return;

    const title = isLive && radioMeta?.title ? radioMeta.title : currentSong.title;
    const artist = isLive && radioMeta?.artist ? radioMeta.artist : currentSong.artist;
    const artwork = radioMeta?.coverUrl || currentSong.coverUrl;

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

    navigator.mediaSession.setActionHandler("play", () => togglePlay());
    navigator.mediaSession.setActionHandler("pause", () => togglePlay());
    navigator.mediaSession.setActionHandler("previoustrack", () => previous());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    };
  }, [currentSong, isLive, radioMeta, togglePlay, next, previous]);

  const handleEnded = useCallback(() => {
    // If preemptive crossfade already triggered next, don't double-skip
    if (preemptiveTriggeredRef.current) return;
    const { repeat } = usePlayerStore.getState();
    if (repeat === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
      }
    } else {
      next();
    }
  }, [next]);

  const handleAudioError = useCallback(async () => {
    if (!audioRef.current || !currentSong) return;
    // Try local cache fallback
    const cachedUrl = await offlineCache.getCachedUrl(currentSong.id);
    if (cachedUrl && audioRef.current.src !== cachedUrl) {
      console.warn("Stream error, falling back to local cache for:", currentSong.title);
      audioRef.current.src = cachedUrl;
      audioRef.current.load();
      audioRef.current.play().catch(console.error);
    }
  }, [currentSong]);

  if (!currentSong) return null;

  const progressPct = !isLive && currentSong.duration > 0 ? (progress / currentSong.duration) * 100 : 0;

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
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="fixed left-0 right-0 z-50 md:bottom-0 px-2 pb-1"
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            ...glassStyle,
            ...(miniDominantColor ? {
              background: `linear-gradient(135deg, ${miniDominantColor}, hsl(0 0% 4% / 0.8))`,
              transition: "background 0.8s ease-in-out",
            } : {}),
          }}
        >
          {/* Progress line */}
          {!isLive && (
            <div className="h-[3px] w-full" style={{ background: "hsl(0 0% 100% / 0.06)" }}>
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          <div className="flex items-center gap-3 px-3 py-2.5">
            <div
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
              onClick={toggleFullScreen}
            >
              <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
                <AnimatePresence mode="wait">
                  <motion.img
                    key={isLive && radioMeta?.coverUrl ? radioMeta.coverUrl : currentSong.coverUrl}
                    src={isLive && radioMeta?.coverUrl ? radioMeta.coverUrl : currentSong.coverUrl}
                    alt={currentSong.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    initial={{ opacity: 0, scale: 1.15 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </AnimatePresence>
              </div>
              <div className="min-w-0">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={isLive && radioMeta?.title ? radioMeta.title : currentSong.title}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                    className="text-[13px] font-semibold truncate text-foreground leading-tight"
                  >
                    {isLive && radioMeta?.title ? radioMeta.title : currentSong.title}
                  </motion.p>
                </AnimatePresence>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={isLive && radioMeta?.artist ? radioMeta.artist : currentSong.artist}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25, delay: 0.05 }}
                    className="text-[11px] truncate text-muted-foreground leading-tight mt-0.5"
                  >
                    {isLive && radioMeta?.artist ? radioMeta.artist : currentSong.artist}
                    {isLive && (
                      <span className="ml-1.5 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <span className="text-primary font-semibold text-[10px]">LIVE</span>
                      </span>
                    )}
                  </motion.p>
                </AnimatePresence>
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
              {!isLive && (
                <button
                  onClick={next}
                  className="p-2 text-foreground active:scale-90 transition-transform"
                >
                  <SkipForward className="w-5 h-5 fill-current" />
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
  const genre = currentSong.album || "Radio";
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
      className="fixed inset-x-0 bottom-0 top-[12vh] z-[100] flex flex-col rounded-t-3xl overflow-hidden"
      style={{ background: bgColor, transition: "background 1s ease-in-out", touchAction: "pan-x" }}
    >
      {/* BG glow */}
      <div className="absolute inset-0 overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={radioMeta?.coverUrl || currentSong.coverUrl}
            src={radioMeta?.coverUrl || currentSong.coverUrl}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full object-cover scale-[2] blur-[120px]"
          />
        </AnimatePresence>
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, hsl(0 0% 4% / 0.5), hsl(0 0% 4% / 0.3), hsl(0 0% 4% / 0.85))" }} />
      </div>

      {/* Drag handle */}
      <div className="relative z-10 flex justify-center pb-1" style={{ paddingTop: "calc(env(safe-area-inset-top, 12px) + 8px)" }}>
        <div className="w-9 h-1 rounded-full" style={{ background: "hsl(0 0% 100% / 0.2)" }} />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 py-2">
        <button onClick={onClose} className="p-2 rounded-full active:scale-90 transition-transform" style={glassButtonStyle}>
          <ChevronDown className="w-5 h-5 text-foreground/80" />
        </button>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={glassButtonStyle}>
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-bold text-primary tracking-widest uppercase">
            EN DIRECT
          </span>
        </div>
        <button onClick={() => toggleLike(currentSong)} className="p-2 rounded-full active:scale-90 transition-transform" style={glassButtonStyle}>
          <Heart className={`w-5 h-5 ${liked ? "fill-primary text-primary" : "text-foreground/60"}`} />
        </button>
      </div>

      {/* Main */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 gap-6">
        {/* Cover in glass card */}
        <div
          className="p-3 rounded-3xl relative"
          style={glassStyle}
        >
          <div className="w-40 h-40 md:w-52 md:h-52 rounded-2xl overflow-hidden relative">
            <img
              src={radioMeta?.coverUrl || currentSong.coverUrl}
              alt={stationName}
              className="w-full h-full object-cover transition-all duration-500"
            />
            {/* Play/Pause overlay centered on cover */}
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center active:scale-95 transition-transform"
              style={{ background: "hsl(0 0% 0% / 0.3)" }}
            >
              {isPlaying ? <Pause className="w-14 h-14 text-white" /> : <Play className="w-14 h-14 text-white ml-1" />}
            </button>
          </div>
        </div>

        {/* Station info in glass card */}
        <div
          className="text-center w-full max-w-xs px-5 py-4 rounded-2xl space-y-2"
          style={glassStyle}
        >
          <h2 className="text-lg font-bold text-foreground truncate">{stationName}</h2>
          <p className="text-sm text-muted-foreground">{currentSong.artist}</p>
          {radioMeta?.nowPlaying ? (
            <div className="pt-1 space-y-0.5">
              <p className="text-sm font-semibold text-primary truncate">♪ {radioMeta.title || radioMeta.nowPlaying}</p>
              {radioMeta.artist && (
                <p className="text-xs text-muted-foreground truncate">{radioMeta.artist}</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <span className="px-2.5 py-1 rounded-full" style={{ background: "hsl(0 0% 100% / 0.08)" }}>{genre}</span>
            </div>
          )}
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
    originalStreamUrl, revertToPreview
  } = usePlayerStore();

  const [showQueue, setShowQueue] = useState(false);
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
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 0%, hsl(0 0% 0% / 0.3) 60%, hsl(0 0% 0% / 0.6) 100%)" }} />
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
          <MoreHorizontal className="w-6 h-6 text-foreground" />
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
            <h3 className="text-base font-semibold text-foreground mb-3 sticky top-0 pt-2 pb-2"
                style={{ background: `${bgColor}ee` }}
            >
              File d'attente
            </h3>
            <div className="space-y-1">
              {queue.map((song) => {
                const isCurrent = song.id === currentSong.id;
                return (
                  <button
                    key={song.id}
                    onClick={() => { play(song); setQueue(queue); }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors ${isCurrent ? "bg-white/10" : "hover:bg-white/5"}`}
                  >
                    <img src={song.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] truncate ${isCurrent ? "text-primary font-semibold" : "text-foreground"}`}>
                        {song.title}
                      </p>
                      <p className="text-[11px] text-foreground/50 truncate">{song.artist}</p>
                    </div>
                    <span className="text-[11px] text-foreground/40 tabular-nums">{formatDuration(song.duration)}</span>
                  </button>
                );
              })}
            </div>
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
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[15px] text-foreground/60 truncate">
                    {currentSong.artist}
                  </p>
                  {isCached ? (
                    <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent/20 text-accent-foreground border border-accent/30">
                      Local
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
                </div>
              </div>
              <button
                onClick={() => toggleLike(currentSong)}
                className="p-1 active:scale-90 transition-transform"
              >
                <PlusCircle className={`w-7 h-7 ${liked ? "text-primary" : "text-foreground/40"}`} />
              </button>
            </div>

            {/* Progress bar - Spotify style */}
            <div className="mb-5">
              <div
                ref={progressBarRef}
                className="h-[4px] rounded-full cursor-pointer relative group py-3 -my-3"
                style={{ touchAction: "none" }}
                onClick={handleSeek}
                onTouchStart={handleTouchSeek}
                onTouchMove={handleTouchMoveSeek}
                onTouchEnd={handleTouchEndSeek}
                onMouseDown={() => setIsSeeking(true)}
                onMouseUp={() => setIsSeeking(false)}
                onMouseLeave={() => setIsSeeking(false)}
              >
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[4px] rounded-full" style={{ background: "hsl(0 0% 100% / 0.15)" }}>
                  <div
                    className="h-full rounded-full relative transition-all duration-150"
                    style={{ width: `${progressPct}%`, background: "hsl(0 0% 100% / 0.85)" }}
                  >
                    <div
                      className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-sm shadow-black/30 transition-all duration-150"
                      style={{
                        width: isSeeking ? 14 : 7,
                        height: isSeeking ? 14 : 7,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-between mt-1.5 text-[11px] text-foreground/50 tabular-nums font-medium">
                <span>{formatDuration(progress)}</span>
                <span>-{formatDuration(Math.max(0, currentSong.duration - progress))}</span>
              </div>
            </div>

            {/* Transport controls - Spotify flat style */}
            <div className="flex items-center justify-between w-full mb-6">
              <button onClick={toggleShuffle} className="active:scale-90 transition-transform">
                <Shuffle className={`w-5 h-5 ${shuffle ? "text-primary" : "text-foreground/50"}`} />
              </button>
              <button onClick={previous} className="active:scale-90 transition-transform">
                <SkipBack className="w-8 h-8 text-foreground fill-current" />
              </button>
              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full flex items-center justify-center active:scale-90 transition-transform bg-foreground"
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 text-background fill-current" />
                ) : (
                  <Play className="w-8 h-8 text-background fill-current ml-1" />
                )}
              </button>
              <button onClick={next} className="active:scale-90 transition-transform">
                <SkipForward className="w-8 h-8 text-foreground fill-current" />
              </button>
              <button onClick={cycleRepeat} className="active:scale-90 transition-transform">
                {repeat === "one" ? (
                  <Repeat1 className="w-5 h-5 text-primary" />
                ) : (
                  <Repeat className={`w-5 h-5 ${repeat === "all" ? "text-primary" : "text-foreground/50"}`} />
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

              {/* Wrong song button — only when HD-resolved from Deezer */}
              {originalStreamUrl && currentSong.id.startsWith("dz-") && (
                <button
                  onClick={revertToPreview}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold tracking-wide transition-all active:scale-95 bg-destructive/15 text-destructive border border-destructive/25 hover:bg-destructive/25"
                  title="Ce n'est pas le bon morceau — revenir à l'extrait 30s"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Mauvais titre
                </button>
              )}

              {/* Download button */}
              <button
                onClick={() => {
                  if (isCached) {
                    remove(currentSong.id);
                  } else if (!isDownloading) {
                    download(currentSong);
                  }
                }}
                className={`relative p-1 active:scale-90 transition-transform ${
                  isCached ? "text-primary" : isDownloading ? "text-primary/60" : "text-foreground/40"
                }`}
              >
                {isDownloading ? (
                  <div className="relative">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-bold text-primary tabular-nums">
                      {dlProgress}%
                    </span>
                  </div>
                ) : isCached ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
              </button>

              {/* Auto mix toggle — hidden when wrong song button is visible to save space */}
              {!originalStreamUrl && (
                <button
                  onClick={() => setCrossfadeEnabled(!crossfadeEnabled)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide uppercase transition-all active:scale-95 ${
                    crossfadeEnabled
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "text-foreground/40 border border-foreground/10"
                  }`}
                >
                  <Disc3 className={`w-3.5 h-3.5 ${crossfadeEnabled ? "animate-spin" : ""}`} style={crossfadeEnabled ? { animationDuration: "3s" } : {}} />
                  Auto mix
                </button>
              )}

              <button onClick={() => setShowQueue(true)} className="p-1 active:scale-90 transition-transform">
                <ListMusic className="w-5 h-5 text-foreground/50" />
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
