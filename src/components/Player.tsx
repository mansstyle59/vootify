import { usePlayerStore } from "@/stores/playerStore";
import { formatDuration } from "@/data/mockData";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, Heart, Maximize2, X, Radio, ChevronDown, ListMusic
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useCallback, useState } from "react";
import { AudioVisualizer } from "./AudioVisualizer";

export function MiniPlayer() {
  const {
    currentSong, isPlaying, progress, volume, shuffle, repeat,
    togglePlay, next, previous, setProgress, setVolume,
    toggleShuffle, cycleRepeat, toggleFullScreen, toggleLike, isLiked, closePlayer
  } = usePlayerStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);

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
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                      <span className="text-destructive font-medium">LIVE</span>
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); toggleLike(currentSong); }}
                className="hidden sm:block ml-2 transition-colors"
              >
                <Heart className={`w-4 h-4 ${liked ? "fill-primary text-primary" : "text-muted-foreground hover:text-foreground"}`} />
              </button>
            </div>

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

            <div className="hidden md:flex items-center gap-3 flex-1 justify-end">
              {!isLive ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDuration(progress)} / {formatDuration(currentSong.duration)}
                </span>
              ) : (
                <span className="text-xs text-destructive font-medium flex items-center gap-1">
                  <Radio className="w-3 h-3" /> EN DIRECT
                </span>
              )}
              <div className="flex items-center gap-2">
                <button onClick={() => setVolume(volume > 0 ? 0 : 0.8)} className="text-muted-foreground hover:text-foreground">
                  {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range" min={0} max={1} step={0.01} value={volume}
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

/* ─── Radio Fullscreen Player ─── */
function RadioFullScreen({ onClose }: { onClose: () => void }) {
  const {
    currentSong, isPlaying, togglePlay, toggleLike, isLiked
  } = usePlayerStore();

  if (!currentSong) return null;
  const liked = isLiked(currentSong.id);

  // Simulated RDS-style data from song metadata
  const stationName = currentSong.title;
  const genre = currentSong.album || "Radio";
  const now = new Date();
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 200 }}
      className="fixed inset-0 z-[100] overflow-hidden flex flex-col"
    >
      {/* Animated background */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 30% 20%, hsl(350 80% 30% / 0.4) 0%, transparent 60%),
                         radial-gradient(ellipse at 70% 80%, hsl(240 60% 20% / 0.6) 0%, transparent 60%),
                         hsl(240, 12%, 4%)`,
          }}
          animate={{
            background: [
              `radial-gradient(ellipse at 30% 20%, hsl(350 80% 30% / 0.4) 0%, transparent 60%),
               radial-gradient(ellipse at 70% 80%, hsl(240 60% 20% / 0.6) 0%, transparent 60%),
               hsl(240, 12%, 4%)`,
              `radial-gradient(ellipse at 60% 40%, hsl(350 80% 30% / 0.3) 0%, transparent 60%),
               radial-gradient(ellipse at 30% 70%, hsl(240 60% 20% / 0.5) 0%, transparent 60%),
               hsl(240, 12%, 4%)`,
              `radial-gradient(ellipse at 30% 20%, hsl(350 80% 30% / 0.4) 0%, transparent 60%),
               radial-gradient(ellipse at 70% 80%, hsl(240 60% 20% / 0.6) 0%, transparent 60%),
               hsl(240, 12%, 4%)`,
            ],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between p-4 pt-6">
        <button onClick={onClose} className="liquid-glass rounded-full p-2">
          <ChevronDown className="w-6 h-6 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-xs font-semibold text-destructive tracking-wider uppercase">
            EN DIRECT
          </span>
        </div>
        <button onClick={() => toggleLike(currentSong)} className="liquid-glass rounded-full p-2">
          <Heart className={`w-5 h-5 ${liked ? "fill-primary text-primary" : "text-foreground"}`} />
        </button>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {/* Station cover */}
        <motion.div
          className="relative"
          animate={{ scale: isPlaying ? [1, 1.02, 1] : 1 }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-48 h-48 md:w-64 md:h-64 rounded-3xl overflow-hidden liquid-glass-strong p-1">
            <img
              src={currentSong.coverUrl}
              alt={stationName}
              className="w-full h-full rounded-[1.25rem] object-cover"
            />
          </div>
          {isPlaying && (
            <motion.div
              className="absolute -inset-2 rounded-[2rem] border border-destructive/20"
              animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </motion.div>

        {/* RDS Info panel */}
        <div className="liquid-glass rounded-2xl p-5 w-full max-w-sm text-center space-y-3">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Radio className="w-4 h-4 text-destructive" />
            <span className="text-xs text-muted-foreground font-medium tracking-widest uppercase">
              RDS
            </span>
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground">{stationName}</h2>
          <p className="text-sm text-muted-foreground">{currentSong.artist}</p>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="liquid-glass rounded-full px-3 py-1">{genre}</span>
            <span className="liquid-glass rounded-full px-3 py-1">{timeStr}</span>
          </div>
        </div>

        {/* Visualizer */}
        <AudioVisualizer isPlaying={isPlaying} />
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 p-6 pb-10">
        <div className="liquid-glass-strong rounded-2xl p-4 flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="p-5 rounded-full bg-destructive text-foreground hover:scale-110 transition-transform glow-radio"
          >
            {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Music Fullscreen Player ─── */
function MusicFullScreen({ onClose }: { onClose: () => void }) {
  const {
    currentSong, isPlaying, progress, shuffle, repeat, queue,
    togglePlay, next, previous, setProgress,
    toggleShuffle, cycleRepeat, toggleLike, isLiked
  } = usePlayerStore();

  const [showQueue, setShowQueue] = useState(false);

  if (!currentSong) return null;

  const liked = isLiked(currentSong.id);
  const progressPct = currentSong.duration > 0 ? (progress / currentSong.duration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 200 }}
      className="fixed inset-0 z-[100] overflow-hidden flex flex-col"
    >
      {/* Dynamic background from cover */}
      <div className="absolute inset-0">
        <img
          src={currentSong.coverUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-150 blur-[80px] opacity-30"
        />
        <div className="absolute inset-0 bg-background/70" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between p-4 pt-6">
        <button onClick={onClose} className="liquid-glass rounded-full p-2">
          <ChevronDown className="w-6 h-6 text-foreground" />
        </button>
        <span className="text-xs font-medium text-muted-foreground tracking-widest uppercase">
          En lecture
        </span>
        <button onClick={() => setShowQueue(!showQueue)} className="liquid-glass rounded-full p-2">
          <ListMusic className={`w-5 h-5 ${showQueue ? "text-primary" : "text-foreground"}`} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showQueue ? (
          <motion.div
            key="queue"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="relative z-10 flex-1 overflow-y-auto px-6 pb-4"
          >
            <h3 className="text-lg font-display font-semibold text-foreground mb-3">File d'attente</h3>
            <div className="space-y-1">
              {queue.map((song, i) => (
                <div
                  key={song.id}
                  className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${
                    song.id === currentSong.id
                      ? "liquid-glass"
                      : "hover:bg-secondary/30"
                  }`}
                >
                  <span className="text-xs text-muted-foreground w-5 text-right tabular-nums">{i + 1}</span>
                  <img src={song.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${song.id === currentSong.id ? "text-primary font-medium" : "text-foreground"}`}>
                      {song.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(song.duration)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="player"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 gap-4"
          >
            {/* Cover art with liquid glass frame */}
            <motion.div
              className="liquid-glass-strong rounded-3xl p-2 mb-2"
              animate={isPlaying ? { y: [0, -6, 0] } : { y: 0 }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <img
                src={currentSong.coverUrl}
                alt={currentSong.title}
                className="w-64 h-64 md:w-72 md:h-72 rounded-[1.25rem] object-cover"
              />
            </motion.div>

            {/* Song info */}
            <div className="text-center w-full max-w-sm">
              <motion.h2
                key={currentSong.id + "-title"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-display font-bold text-foreground truncate"
              >
                {currentSong.title}
              </motion.h2>
              <motion.p
                key={currentSong.id + "-artist"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="text-base text-muted-foreground mt-1"
              >
                {currentSong.artist}
              </motion.p>
              {currentSong.album && (
                <motion.p
                  key={currentSong.id + "-album"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-xs text-muted-foreground/60 mt-0.5"
                >
                  {currentSong.album}
                </motion.p>
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full max-w-sm mt-2">
              <div
                className="h-1.5 bg-secondary/50 rounded-full cursor-pointer group relative overflow-hidden"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  const time = Math.floor(pct * currentSong.duration);
                  setProgress(time);
                }}
              >
                <motion.div
                  className="h-full rounded-full relative"
                  style={{
                    width: `${progressPct}%`,
                    background: "var(--gradient-primary)",
                  }}
                  layout
                  transition={{ type: "tween", duration: 0.3 }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full glow-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.div>
              </div>
              <div className="flex justify-between mt-2 text-xs text-muted-foreground tabular-nums">
                <span>{formatDuration(progress)}</span>
                <span>{formatDuration(currentSong.duration)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom controls */}
      <div className="relative z-10 px-6 pb-8">
        <div className="liquid-glass-strong rounded-2xl p-4">
          <div className="flex items-center justify-between max-w-sm mx-auto">
            <button onClick={toggleShuffle}>
              <Shuffle className={`w-5 h-5 ${shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground"} transition-colors`} />
            </button>
            <button onClick={previous} className="text-foreground hover:scale-110 transition-transform">
              <SkipBack className="w-7 h-7" />
            </button>
            <button
              onClick={togglePlay}
              className="p-4 rounded-full bg-primary text-primary-foreground hover:scale-110 transition-transform glow-primary"
            >
              {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
            </button>
            <button onClick={next} className="text-foreground hover:scale-110 transition-transform">
              <SkipForward className="w-7 h-7" />
            </button>
            <button onClick={cycleRepeat}>
              {repeat === "one" ? (
                <Repeat1 className="w-5 h-5 text-primary" />
              ) : (
                <Repeat className={`w-5 h-5 ${repeat === "all" ? "text-primary" : "text-muted-foreground hover:text-foreground"} transition-colors`} />
              )}
            </button>
          </div>
          <div className="flex items-center justify-center mt-3">
            <button onClick={() => toggleLike(currentSong)}>
              <Heart className={`w-6 h-6 transition-colors ${liked ? "fill-primary text-primary" : "text-muted-foreground hover:text-foreground"}`} />
            </button>
          </div>
        </div>
      </div>
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
