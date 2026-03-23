import { usePlayerStore } from "@/stores/playerStore";
import { formatDuration } from "@/data/mockData";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, Heart, X, Radio, ChevronDown, ListMusic,
  Ellipsis
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useCallback, useState } from "react";
import { AudioVisualizer } from "./AudioVisualizer";

/* ─────────────────────────────────────────────
   Mini Player — Apple Music style
   ───────────────────────────────────────────── */
export function MiniPlayer() {
  const {
    currentSong, isPlaying, progress, volume, shuffle, repeat,
    togglePlay, next, previous, setProgress, setVolume,
    toggleShuffle, cycleRepeat, toggleFullScreen, toggleLike, isLiked, closePlayer,
    _seekTime
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

  // React to seek requests from fullscreen player
  useEffect(() => {
    if (_seekTime !== null && audioRef.current) {
      audioRef.current.currentTime = _seekTime;
      usePlayerStore.setState({ _seekTime: null });
    }
  }, [_seekTime]);

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
        className="fixed bottom-0 left-0 right-0 z-50 mb-[4.5rem] md:mb-0 px-2"
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "hsl(240 8% 14% / 0.85)",
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
            boxShadow: "0 -2px 20px rgba(0,0,0,0.3), inset 0 1px 0 hsl(0 0% 100% / 0.06)",
          }}
        >
          {/* Thin progress line at top — Apple style */}
          {!isLive && (
            <div className="h-[3px] w-full bg-secondary/40">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}

          <div className="flex items-center gap-3 px-3 py-2.5">
            {/* Cover + Info — tappable */}
            <div
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
              onClick={toggleFullScreen}
            >
              <img
                src={currentSong.coverUrl}
                alt={currentSong.title}
                className="w-11 h-11 rounded-xl object-cover shadow-lg"
              />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate text-foreground leading-tight">
                  {currentSong.title}
                </p>
                <p className="text-[11px] truncate text-muted-foreground leading-tight mt-0.5">
                  {currentSong.artist}
                  {isLive && (
                    <span className="ml-1.5 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                      <span className="text-destructive font-semibold text-[10px]">LIVE</span>
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Compact controls */}
            <div className="flex items-center gap-0.5">
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
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ─────────────────────────────────────────────
   Radio Fullscreen Player — Apple Music Radio
   ───────────────────────────────────────────── */
function RadioFullScreen({ onClose }: { onClose: () => void }) {
  const {
    currentSong, isPlaying, volume, togglePlay, setVolume, toggleLike, isLiked
  } = usePlayerStore();

  if (!currentSong) return null;
  const liked = isLiked(currentSong.id);
  const stationName = currentSong.title;
  const genre = currentSong.album || "Radio";
  const now = new Date();
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 220 }}
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: "hsl(240, 10%, 5%)" }}
    >
      {/* BG glow from cover */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={currentSong.coverUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-[2] blur-[100px] opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/90" />
      </div>

      {/* Drag handle */}
      <div className="relative z-10 flex justify-center pt-3 pb-1">
        <div className="w-9 h-1 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 py-2">
        <button onClick={onClose} className="p-1 -ml-1">
          <ChevronDown className="w-7 h-7 text-foreground/80" />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-[11px] font-bold text-destructive tracking-widest uppercase">
            EN DIRECT
          </span>
        </div>
        <button onClick={() => toggleLike(currentSong)} className="p-1 -mr-1">
          <Heart className={`w-6 h-6 ${liked ? "fill-primary text-primary" : "text-foreground/60"}`} />
        </button>
      </div>

      {/* Main */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 gap-5">
        {/* Station artwork */}
        <motion.div
          animate={isPlaying ? { scale: [1, 1.03, 1] } : { scale: 0.95 }}
          transition={isPlaying ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.5 }}
        >
          <div className="w-56 h-56 md:w-72 md:h-72 rounded-2xl overflow-hidden shadow-2xl">
            <img
              src={currentSong.coverUrl}
              alt={stationName}
              className="w-full h-full object-cover"
            />
          </div>
        </motion.div>

        {/* Station info */}
        <div className="text-center w-full max-w-xs space-y-2">
          <h2 className="text-xl font-display font-bold text-foreground truncate">{stationName}</h2>
          <p className="text-sm text-muted-foreground">{currentSong.artist}</p>
          <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
            <span className="px-2.5 py-1 rounded-full bg-secondary/40">{genre}</span>
            <span className="px-2.5 py-1 rounded-full bg-secondary/40">{timeStr}</span>
          </div>
        </div>

        {/* Visualizer */}
        <AudioVisualizer isPlaying={isPlaying} />
      </div>

      {/* Bottom */}
      <div className="relative z-10 px-8 pb-10">
        {/* Play button */}
        <div className="flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="p-4 rounded-full bg-foreground text-background active:scale-95 transition-transform"
          >
            {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-0.5" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Music Fullscreen Player — Apple Music style
   ───────────────────────────────────────────── */
function MusicFullScreen({ onClose }: { onClose: () => void }) {
  const {
    currentSong, isPlaying, progress, shuffle, repeat, queue, volume,
    togglePlay, next, previous, seekTo: storeSeekTo, setVolume,
    toggleShuffle, cycleRepeat, toggleLike, isLiked, play, setQueue
  } = usePlayerStore();

  const [showQueue, setShowQueue] = useState(false);

  if (!currentSong) return null;

  const liked = isLiked(currentSong.id);
  const progressPct = currentSong.duration > 0 ? (progress / currentSong.duration) * 100 : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(Math.floor(pct * currentSong.duration), currentSong.duration));
    storeSeekTo(time);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 220 }}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
      style={{ background: "hsl(240, 10%, 5%)" }}
    >
      {/* Dynamic blurred BG from cover */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.img
          key={currentSong.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 1 }}
          src={currentSong.coverUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-[2] blur-[100px]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/30 to-background/80" />
      </div>

      {/* Drag handle */}
      <div className="relative z-10 flex justify-center pt-3 pb-1">
        <div className="w-9 h-1 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 py-2">
        <button onClick={onClose} className="p-1 -ml-1">
          <ChevronDown className="w-7 h-7 text-foreground/80" />
        </button>
        <motion.p
          key={currentSong.album || "album"}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[11px] font-semibold text-foreground/50 tracking-widest uppercase truncate max-w-[50%] text-center"
        >
          {currentSong.album || "En lecture"}
        </motion.p>
        <button onClick={() => setShowQueue(!showQueue)} className="p-1 -mr-1">
          <ListMusic className={`w-6 h-6 ${showQueue ? "text-primary" : "text-foreground/60"}`} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {showQueue ? (
          /* Queue view */
          <motion.div
            key="queue"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 flex-1 overflow-y-auto px-5 pb-4 scrollbar-hide"
          >
            <h3 className="text-base font-display font-semibold text-foreground mb-3 sticky top-0 pt-2 pb-2"
                style={{ background: "linear-gradient(to bottom, hsl(240 10% 5% / 0.9) 80%, transparent)" }}
            >
              File d'attente
            </h3>
            <div className="space-y-0.5">
              {queue.map((song, i) => {
                const isCurrent = song.id === currentSong.id;
                return (
                  <button
                    key={song.id}
                    onClick={() => { play(song); setQueue(queue); }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors ${
                      isCurrent ? "bg-primary/10" : "active:bg-secondary/30"
                    }`}
                  >
                    <img src={song.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] truncate ${isCurrent ? "text-primary font-semibold" : "text-foreground"}`}>
                        {song.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{song.artist}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{formatDuration(song.duration)}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          /* Now playing view */
          <motion.div
            key="player"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 flex-1 flex flex-col items-center justify-center px-8"
          >
            {/* Cover — Apple's large rounded square with shadow */}
            <motion.div
              animate={isPlaying ? { scale: 1 } : { scale: 0.88 }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              className="w-full max-w-[280px] md:max-w-[340px] aspect-square mb-8"
            >
              <motion.img
                key={currentSong.id}
                initial={{ opacity: 0.5, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                src={currentSong.coverUrl}
                alt={currentSong.title}
                className="w-full h-full rounded-2xl object-cover"
                style={{
                  boxShadow: "0 20px 60px -10px rgba(0,0,0,0.6), 0 8px 20px -5px rgba(0,0,0,0.3)",
                }}
              />
            </motion.div>

            {/* Title + Artist + Like — Apple layout */}
            <div className="w-full max-w-[280px] md:max-w-[340px] flex items-start justify-between gap-3 mb-6">
              <div className="min-w-0 flex-1">
                <motion.h2
                  key={currentSong.id + "-t"}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xl font-bold text-foreground truncate leading-tight"
                >
                  {currentSong.title}
                </motion.h2>
                <motion.p
                  key={currentSong.id + "-a"}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 }}
                  className="text-base text-primary truncate mt-0.5"
                >
                  {currentSong.artist}
                </motion.p>
              </div>
              <button
                onClick={() => toggleLike(currentSong)}
                className="mt-1 active:scale-90 transition-transform"
              >
                <Heart className={`w-6 h-6 ${liked ? "fill-primary text-primary" : "text-foreground/40"}`} />
              </button>
            </div>

            {/* Progress bar — Apple thin style */}
            <div className="w-full max-w-[280px] md:max-w-[340px] mb-4">
              <div
                className="h-[4px] bg-foreground/10 rounded-full cursor-pointer relative group"
                onClick={handleSeek}
              >
                <div
                  className="h-full bg-foreground/80 rounded-full relative transition-all duration-150"
                  style={{ width: `${progressPct}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[14px] h-[14px] rounded-full bg-foreground opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity shadow-md" />
                </div>
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground tabular-nums">
                <span>{formatDuration(progress)}</span>
                <span>-{formatDuration(Math.max(0, currentSong.duration - progress))}</span>
              </div>
            </div>

            {/* Transport controls */}
            <div className="flex items-center justify-between w-full max-w-[260px] md:max-w-[300px] mb-6">
              <button onClick={toggleShuffle} className="active:scale-90 transition-transform">
                <Shuffle className={`w-[18px] h-[18px] ${shuffle ? "text-primary" : "text-foreground/40"}`} />
              </button>
              <button onClick={previous} className="active:scale-90 transition-transform">
                <SkipBack className="w-8 h-8 text-foreground fill-current" />
              </button>
              <button
                onClick={togglePlay}
                className="active:scale-90 transition-transform"
              >
                {isPlaying ? (
                  <Pause className="w-12 h-12 text-foreground fill-current" />
                ) : (
                  <Play className="w-12 h-12 text-foreground fill-current ml-1" />
                )}
              </button>
              <button onClick={next} className="active:scale-90 transition-transform">
                <SkipForward className="w-8 h-8 text-foreground fill-current" />
              </button>
              <button onClick={cycleRepeat} className="active:scale-90 transition-transform">
                {repeat === "one" ? (
                  <Repeat1 className="w-[18px] h-[18px] text-primary" />
                ) : (
                  <Repeat className={`w-[18px] h-[18px] ${repeat === "all" ? "text-primary" : "text-foreground/40"}`} />
                )}
              </button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Safe area bottom padding */}
      <div className="relative z-10 h-8" />
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