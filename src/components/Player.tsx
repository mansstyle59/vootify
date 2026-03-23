import { usePlayerStore } from "@/stores/playerStore";
import { formatDuration } from "@/data/mockData";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Heart, ChevronDown, ListMusic, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useCallback, useState } from "react";
import { AudioVisualizer } from "./AudioVisualizer";
import { useRadioMetadata } from "@/hooks/useRadioMetadata";

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
          style={glassStyle}
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
              <img
                src={currentSong.coverUrl}
                alt={currentSong.title}
                className="w-11 h-11 rounded-xl object-cover"
                style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}
              />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate text-foreground leading-tight">
                  {currentSong.title}
                </p>
                <p className="text-[11px] truncate text-muted-foreground leading-tight mt-0.5">
                  {currentSong.artist}
                  {isLive && (
                    <span className="ml-1.5 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="text-primary font-semibold text-[10px]">LIVE</span>
                    </span>
                  )}
                </p>
              </div>
            </div>

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

  if (!currentSong) return null;
  const liked = isLiked(currentSong.id);
  const stationName = currentSong.title;
  const genre = currentSong.album || "Radio";

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 220 }}
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: "hsl(0 0% 4%)" }}
    >
      {/* BG glow */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={currentSong.coverUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-[2] blur-[120px] opacity-30"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, hsl(0 0% 4% / 0.5), hsl(0 0% 4% / 0.3), hsl(0 0% 4% / 0.85))" }} />
      </div>

      {/* Drag handle */}
      <div className="relative z-10 flex justify-center pt-3 pb-1">
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
          className="p-3 rounded-3xl"
          style={glassStyle}
        >
          <div className="w-52 h-52 md:w-64 md:h-64 rounded-2xl overflow-hidden">
            <img
              src={currentSong.coverUrl}
              alt={stationName}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Station info in glass card */}
        <div
          className="text-center w-full max-w-xs px-5 py-4 rounded-2xl space-y-2"
          style={glassStyle}
        >
          <h2 className="text-lg font-bold text-foreground truncate">{stationName}</h2>
          <p className="text-sm text-muted-foreground">{currentSong.artist}</p>
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <span className="px-2.5 py-1 rounded-full" style={{ background: "hsl(0 0% 100% / 0.08)" }}>{genre}</span>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 px-8 pb-10">
        <div className="flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="p-5 rounded-full active:scale-95 transition-transform"
            style={{
              ...glassStyle,
              background: "linear-gradient(135deg, hsl(0 0% 100% / 0.15), hsl(0 0% 100% / 0.05))",
            }}
          >
            {isPlaying ? <Pause className="w-8 h-8 text-foreground" /> : <Play className="w-8 h-8 text-foreground ml-0.5" />}
          </button>
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
      style={{ background: "hsl(0 0% 4%)" }}
    >
      {/* Dynamic blurred BG */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={currentSong.coverUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-[2] blur-[120px] opacity-35"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, hsl(0 0% 4% / 0.4), hsl(0 0% 4% / 0.2), hsl(0 0% 4% / 0.75))" }} />
      </div>

      {/* Drag handle */}
      <div className="relative z-10 flex justify-center pt-3 pb-1">
        <div className="w-9 h-1 rounded-full" style={{ background: "hsl(0 0% 100% / 0.2)" }} />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 py-2">
        <button onClick={onClose} className="p-2 rounded-full active:scale-90 transition-transform" style={glassButtonStyle}>
          <ChevronDown className="w-5 h-5 text-foreground/80" />
        </button>
        <div className="px-3 py-1.5 rounded-full" style={glassButtonStyle}>
          <p className="text-[10px] font-semibold text-foreground/60 tracking-widest uppercase truncate max-w-[40vw] text-center">
            {currentSong.album || "En lecture"}
          </p>
        </div>
        <button onClick={() => setShowQueue(!showQueue)} className="p-2 rounded-full active:scale-90 transition-transform" style={glassButtonStyle}>
          <ListMusic className={`w-5 h-5 ${showQueue ? "text-primary" : "text-foreground/60"}`} />
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
                style={{ background: "linear-gradient(to bottom, hsl(0 0% 4% / 0.9) 80%, transparent)" }}
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
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors"
                    style={isCurrent ? { ...glassButtonStyle, background: "hsl(var(--primary) / 0.12)" } : {}}
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
          <motion.div
            key="player"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 flex-1 flex flex-col items-center justify-center px-8"
          >
            {/* Cover in glass frame */}
            <div
              className="p-2.5 rounded-3xl mb-8 w-full max-w-[290px] md:max-w-[350px]"
              style={glassStyle}
            >
              <img
                src={currentSong.coverUrl}
                alt={currentSong.title}
                className="w-full aspect-square rounded-2xl object-cover"
              />
            </div>

            {/* Title + Artist + Like */}
            <div className="w-full max-w-[280px] md:max-w-[340px] flex items-start justify-between gap-3 mb-5">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-foreground truncate leading-tight">
                  {currentSong.title}
                </h2>
                <p className="text-base text-primary truncate mt-0.5">
                  {currentSong.artist}
                </p>
              </div>
              <button
                onClick={() => toggleLike(currentSong)}
                className="mt-1 p-2 rounded-full active:scale-90 transition-transform"
                style={glassButtonStyle}
              >
                <Heart className={`w-5 h-5 ${liked ? "fill-primary text-primary" : "text-foreground/40"}`} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="w-full max-w-[280px] md:max-w-[340px] mb-5">
              <div
                className="h-[5px] rounded-full cursor-pointer relative group"
                style={{ background: "hsl(0 0% 100% / 0.1)" }}
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

            {/* Transport controls in glass pill */}
            <div
              className="flex items-center justify-between w-full max-w-[280px] md:max-w-[320px] px-5 py-3 rounded-2xl"
              style={glassStyle}
            >
              <button onClick={toggleShuffle} className="active:scale-90 transition-transform">
                <Shuffle className={`w-[18px] h-[18px] ${shuffle ? "text-primary" : "text-foreground/40"}`} />
              </button>
              <button onClick={previous} className="active:scale-90 transition-transform">
                <SkipBack className="w-7 h-7 text-foreground fill-current" />
              </button>
              <button
                onClick={togglePlay}
                className="p-3 rounded-full active:scale-90 transition-transform"
                style={{
                  background: "hsl(0 0% 100% / 0.12)",
                  border: "1px solid hsl(0 0% 100% / 0.15)",
                }}
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 text-foreground fill-current" />
                ) : (
                  <Play className="w-8 h-8 text-foreground fill-current ml-0.5" />
                )}
              </button>
              <button onClick={next} className="active:scale-90 transition-transform">
                <SkipForward className="w-7 h-7 text-foreground fill-current" />
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
