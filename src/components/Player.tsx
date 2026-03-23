import { usePlayerStore } from "@/stores/playerStore";
import { formatDuration } from "@/data/mockData";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, Heart, Maximize2, X, Radio
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useCallback } from "react";
import { AudioVisualizer } from "./AudioVisualizer";

export function MiniPlayer() {
  const {
    currentSong, isPlaying, progress, volume, shuffle, repeat,
    togglePlay, next, previous, setProgress, setVolume,
    toggleShuffle, cycleRepeat, toggleFullScreen, toggleLike, isLiked, closePlayer
  } = usePlayerStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync audio element with state
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current || !currentSong) return;
    const audio = audioRef.current;

    if (audio.src !== currentSong.streamUrl && currentSong.streamUrl) {
      audio.src = currentSong.streamUrl;
      audio.load();
    }

    if (isPlaying) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying, currentSong]);

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;
    const t = Math.floor(audioRef.current.currentTime);
    if (t !== progress) setProgress(t);
  }, [progress, setProgress]);

  const handleEnded = useCallback(() => {
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

  const seekTo = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentSong) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const isLive = currentSong.duration === 0;
    if (isLive) return;
    const time = Math.floor(pct * currentSong.duration);
    setProgress(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  }, [currentSong, setProgress]);

  if (!currentSong) return null;

  const liked = isLiked(currentSong.id);
  const isLive = currentSong.duration === 0;
  const progressPct = !isLive && currentSong.duration > 0 ? (progress / currentSong.duration) * 100 : 0;

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="auto"
      />
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="fixed bottom-0 md:bottom-0 left-0 right-0 z-50 md:mb-0 mb-[4.5rem]"
      >
        <div className="glass-panel border-t border-border/50 px-4 py-3">
          {/* Progress bar */}
          {!isLive && (
            <div className="absolute top-0 left-0 right-0 h-1 cursor-pointer group" onClick={seekTo}>
              <div className="h-full bg-secondary rounded-full">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-200 relative"
                  style={{ width: `${progressPct}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            {/* Song info */}
            <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={toggleFullScreen}>
              <img
                src={currentSong.coverUrl}
                alt={currentSong.title}
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate text-foreground">{currentSong.title}</p>
                <p className="text-xs truncate text-muted-foreground">
                  {currentSong.artist}
                  {isLive && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="text-primary font-medium">LIVE</span>
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => toggleLike(currentSong)}
                className="hidden sm:block ml-2 transition-colors"
              >
                <Heart
                  className={`w-4 h-4 ${liked ? "fill-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
                />
              </button>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {!isLive && (
                <button onClick={toggleShuffle} className="hidden sm:block p-1.5 transition-colors">
                  <Shuffle className={`w-4 h-4 ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`} />
                </button>
              )}
              {!isLive && (
                <button onClick={previous} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <SkipBack className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={togglePlay}
                className="p-2 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-transform glow-primary"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              {!isLive && (
                <button onClick={next} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <SkipForward className="w-5 h-5" />
                </button>
              )}
              {!isLive && (
                <button onClick={cycleRepeat} className="hidden sm:block p-1.5 transition-colors">
                  {repeat === "one" ? (
                    <Repeat1 className="w-4 h-4 text-primary" />
                  ) : (
                    <Repeat className={`w-4 h-4 ${repeat === "all" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`} />
                  )}
                </button>
              )}
            </div>

            {/* Time + volume */}
            <div className="hidden md:flex items-center gap-3 flex-1 justify-end">
              {!isLive ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDuration(progress)} / {formatDuration(currentSong.duration)}
                </span>
              ) : (
                <span className="text-xs text-primary font-medium flex items-center gap-1">
                  <Radio className="w-3 h-3" /> EN DIRECT
                </span>
              )}
              <div className="flex items-center gap-2">
                <button onClick={() => setVolume(volume > 0 ? 0 : 0.8)} className="text-muted-foreground hover:text-foreground">
                  {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 accent-primary"
                />
              </div>
              <button onClick={toggleFullScreen} className="p-1.5 text-muted-foreground hover:text-foreground">
                <Maximize2 className="w-4 h-4" />
              </button>
              <button onClick={closePlayer} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors" title="Fermer le lecteur">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

export function FullScreenPlayer() {
  const {
    currentSong, isPlaying, progress, shuffle, repeat,
    togglePlay, next, previous, setProgress,
    toggleShuffle, cycleRepeat, toggleFullScreen, toggleLike, isLiked, closePlayer
  } = usePlayerStore();

  if (!currentSong) return null;

  const liked = isLiked(currentSong.id);
  const isLive = currentSong.duration === 0;
  const progressPct = !isLive && currentSong.duration > 0 ? (progress / currentSong.duration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[100] player-gradient flex flex-col items-center justify-center p-8"
    >
      <div className="absolute top-6 right-6 flex items-center gap-2">
        <button
          onClick={toggleFullScreen}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          title="Réduire"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <motion.img
        src={currentSong.coverUrl}
        alt={currentSong.title}
        className="w-64 h-64 md:w-80 md:h-80 rounded-2xl object-cover shadow-2xl mb-8"
        animate={{ rotate: isPlaying ? 360 : 0 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />

      <AudioVisualizer isPlaying={isPlaying} />

      <div className="text-center mb-6 mt-4">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">{currentSong.title}</h2>
        <p className="text-lg text-muted-foreground mt-1">{currentSong.artist}</p>
        {isLive && (
          <span className="inline-flex items-center gap-1.5 mt-2 text-primary font-medium text-sm">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            EN DIRECT
          </span>
        )}
      </div>

      {/* Progress */}
      {!isLive && (
        <div className="w-full max-w-md mb-6">
          <div
            className="h-1.5 bg-secondary rounded-full cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              const time = Math.floor(pct * currentSong.duration);
              setProgress(time);
            }}
          >
            <div
              className="h-full bg-primary rounded-full relative"
              style={{ width: `${progressPct}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full glow-primary" />
            </div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground tabular-nums">
            <span>{formatDuration(progress)}</span>
            <span>{formatDuration(currentSong.duration)}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-6">
        {!isLive && (
          <button onClick={toggleShuffle}>
            <Shuffle className={`w-5 h-5 ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"}`} />
          </button>
        )}
        {!isLive && (
          <button onClick={previous} className="text-foreground hover:scale-110 transition-transform">
            <SkipBack className="w-7 h-7" />
          </button>
        )}
        <button
          onClick={togglePlay}
          className="p-4 rounded-full bg-primary text-primary-foreground hover:scale-110 transition-transform glow-primary"
        >
          {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
        </button>
        {!isLive && (
          <button onClick={next} className="text-foreground hover:scale-110 transition-transform">
            <SkipForward className="w-7 h-7" />
          </button>
        )}
        {!isLive && (
          <button onClick={cycleRepeat}>
            {repeat === "one" ? (
              <Repeat1 className="w-5 h-5 text-primary" />
            ) : (
              <Repeat className={`w-5 h-5 ${repeat === "all" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`} />
            )}
          </button>
        )}
      </div>

      <button onClick={() => toggleLike(currentSong)} className="mt-6">
        <Heart className={`w-7 h-7 transition-colors ${liked ? "fill-primary text-primary" : "text-muted-foreground hover:text-foreground"}`} />
      </button>
    </motion.div>
  );
}
