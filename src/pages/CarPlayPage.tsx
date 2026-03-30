import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { useAuth } from "@/hooks/useAuth";
import { getStationLogo } from "@/lib/radioLogos";
import { useRadioMetadata } from "@/hooks/useRadioMetadata";
import {
  Music, Radio, Search, X, Play, Pause, SkipBack, SkipForward,
  ChevronLeft, ChevronDown, Volume2, Disc3,
} from "lucide-react";
import { LazyImage } from "@/components/LazyImage";
import { motion, AnimatePresence } from "framer-motion";

type CarPlayTab = "music" | "radio";

/* ── Shared styles ── */
const DARK_BG = "hsl(0 0% 4%)";
const GLASS = {
  background: "hsl(0 0% 100% / 0.08)",
  backdropFilter: "blur(40px)",
  WebkitBackdropFilter: "blur(40px)",
  border: "1px solid hsl(0 0% 100% / 0.06)",
};

/* ── Animated equalizer bars for live radio ── */
function LiveEqualizer() {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {[0, 0.15, 0.3].map((delay, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-primary"
          animate={{ height: ["6px", "16px", "8px", "14px", "6px"] }}
          transition={{ duration: 1.2, repeat: Infinity, delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

const CarPlayPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { play, currentSong, isPlaying, togglePlay, next, previous, setQueue } = usePlayerStore();
  const [tab, setTab] = useState<CarPlayTab>("music");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNowPlaying, setShowNowPlaying] = useState(false);

  const isLiveRadio = currentSong?.album === "Radio en direct";
  const radioMetadata = useRadioMetadata(
    isLiveRadio ? currentSong?.streamUrl : undefined,
    isLiveRadio, isPlaying, currentSong?.title, currentSong?.coverUrl
  );

  // Songs
  const { data: songs = [] } = useQuery({
    queryKey: ["carplay-songs"],
    queryFn: async () => {
      const { data } = await supabase.from("custom_songs").select("*").not("stream_url", "is", null).order("title").limit(200);
      return (data || []).map(s => ({
        id: `custom-${s.id}`, title: s.title, artist: s.artist, album: s.album || "",
        duration: s.duration, coverUrl: s.cover_url || "", streamUrl: s.stream_url || "", liked: false,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Radio stations
  const { data: stations = [] } = useQuery({
    queryKey: ["carplay-radios"],
    queryFn: async () => {
      const { data } = await supabase.from("custom_radio_stations").select("*").order("name");
      return (data || []).map(s => ({
        id: s.id, name: s.name, genre: s.genre || "Radio",
        coverUrl: getStationLogo(s.name, s.cover_url || ""),
        streamUrl: s.stream_url || "",
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const playStation = useCallback((s: { id: string; name: string; genre: string; coverUrl: string; streamUrl: string }) => {
    if (currentSong?.id === s.id) { togglePlay(); return; }
    play({
      id: s.id, title: s.name, artist: s.genre, album: "Radio en direct",
      duration: 0, coverUrl: s.coverUrl, streamUrl: s.streamUrl, liked: false,
    });
  }, [currentSong, togglePlay, play]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return tab === "music" ? songs : stations as any[];
    const q = searchQuery.toLowerCase();
    if (tab === "music") return songs.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
    return stations.filter(s => s.name.toLowerCase().includes(q));
  }, [searchQuery, tab, songs, stations]);

  const playSong = useCallback((song: typeof songs[0], idx: number) => {
    if (currentSong?.id === song.id) { togglePlay(); return; }
    setQueue(filtered.length > 0 ? filtered : songs);
    play(song);
  }, [currentSong, togglePlay, play, setQueue, songs, filtered]);

  const coverUrl = isLiveRadio && radioMetadata?.coverUrl ? radioMetadata.coverUrl : currentSong?.coverUrl;
  const displayTitle = isLiveRadio && radioMetadata?.title ? radioMetadata.title : currentSong?.title;
  const displayArtist = isLiveRadio && radioMetadata?.artist ? radioMetadata.artist : currentSong?.artist;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: DARK_BG }}>

      {/* ── Full-screen Now Playing overlay ── */}
      <AnimatePresence>
        {showNowPlaying && currentSong && (
          <NowPlayingFullScreen
            coverUrl={coverUrl || ""}
            title={displayTitle || "—"}
            artist={displayArtist || "—"}
            isPlaying={isPlaying}
            isLiveRadio={isLiveRadio}
            onClose={() => setShowNowPlaying(false)}
            onTogglePlay={togglePlay}
            onNext={next}
            onPrevious={previous}
          />
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-3 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2"
      >
        <button
          onClick={() => navigate(-1)}
          className="p-2.5 rounded-full active:scale-90 transition-transform"
          style={{ background: "hsl(0 0% 100% / 0.08)" }}
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-xl font-black text-white flex-1 tracking-tight">CarPlay</h1>
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      </motion.div>

      {/* ── Tab buttons ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="flex gap-2.5 px-4 pb-3"
      >
        {([
          { key: "music" as CarPlayTab, icon: Music, label: "Musique" },
          { key: "radio" as CarPlayTab, icon: Radio, label: "Radio" },
        ]).map(({ key, icon: Icon, label }) => (
          <motion.button
            key={key}
            onClick={() => { setTab(key); setSearchQuery(""); }}
            className="flex-1 flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-bold transition-colors active:scale-[0.96]"
            style={{
              background: tab === key ? "hsl(var(--primary))" : "hsl(0 0% 100% / 0.08)",
              color: tab === key ? "hsl(var(--primary-foreground))" : "hsl(0 0% 100% / 0.6)",
            }}
            whileTap={{ scale: 0.96 }}
          >
            <Icon className="w-6 h-6" />
            {label}
          </motion.button>
        ))}
      </motion.div>

      {/* ── Search bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="px-4 pb-3"
      >
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/25" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={tab === "music" ? "Rechercher un morceau..." : "Rechercher une station..."}
            className="w-full pl-11 pr-10 py-3.5 rounded-2xl text-base text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-shadow"
            style={{ background: "hsl(0 0% 100% / 0.06)", border: "1px solid hsl(0 0% 100% / 0.05)" }}
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full"
                style={{ background: "hsl(0 0% 100% / 0.12)" }}
              >
                <X className="w-3.5 h-3.5 text-white/60" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Content list ── */}
      <div className="flex-1 overflow-y-auto px-2 pb-36 scrollbar-hide">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: tab === "radio" ? 30 : -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: tab === "radio" ? -30 : 30 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === "music" ? (
              <div className="space-y-1">
                {(searchQuery ? filtered : songs).map((song: any, i: number) => {
                  const isActive = currentSong?.id === song.id;
                  return (
                    <motion.button
                      key={song.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                      onClick={() => playSong(song, i)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-colors active:scale-[0.98]"
                      style={{ background: isActive ? "hsl(var(--primary) / 0.15)" : "transparent" }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 relative" style={{ background: "hsl(0 0% 100% / 0.06)" }}>
                        <LazyImage src={song.coverUrl} alt="" className="w-full h-full object-cover" fallback wrapperClassName="w-full h-full" />
                        {isActive && isPlaying && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "hsl(0 0% 0% / 0.5)" }}>
                            <Volume2 className="w-5 h-5 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[15px] font-semibold truncate ${isActive ? "text-primary" : "text-white"}`}>{song.title}</p>
                        <p className="text-[13px] text-white/35 truncate">{song.artist}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {(searchQuery ? filtered : stations).map((station: any, i: number) => {
                  const isActive = currentSong?.id === station.id;
                  const isActivePlaying = isActive && isPlaying;
                  return (
                    <motion.button
                      key={station.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4) }}
                      onClick={() => playStation(station)}
                      className="flex flex-col items-center gap-2 p-3.5 rounded-2xl text-center transition-all active:scale-[0.95]"
                      style={{ background: isActive ? "hsl(var(--primary) / 0.15)" : "hsl(0 0% 100% / 0.05)" }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden relative" style={{ background: "hsl(0 0% 100% / 0.06)" }}>
                        <LazyImage src={station.coverUrl} alt="" className="w-full h-full object-contain p-1.5" fallback wrapperClassName="w-full h-full" />
                        {isActivePlaying && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "hsl(0 0% 0% / 0.5)" }}>
                            <LiveEqualizer />
                          </div>
                        )}
                      </div>
                      <p className={`text-[13px] font-semibold truncate w-full ${isActive ? "text-primary" : "text-white"}`}>{station.name}</p>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Now Playing mini bar — tap to expand ── */}
      <AnimatePresence>
        {currentSong && !showNowPlaying && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
            style={{ background: "linear-gradient(180deg, transparent 0%, hsl(0 0% 4%) 30%)" }}
          >
            <motion.div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer"
              style={GLASS}
              onClick={() => setShowNowPlaying(true)}
              whileTap={{ scale: 0.98 }}
            >
              {/* Cover with animated rotation for radio */}
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 relative" style={{ background: "hsl(0 0% 100% / 0.06)" }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={coverUrl}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                    className="w-full h-full"
                  >
                    <LazyImage src={coverUrl || ""} alt="" className="w-full h-full object-cover" fallback wrapperClassName="w-full h-full" />
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="min-w-0 flex-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={displayTitle}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p className="text-[14px] font-bold text-white truncate">{displayTitle || "—"}</p>
                    <p className="text-[12px] text-white/40 truncate">{displayArtist || "—"}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-1">
                {!isLiveRadio && (
                  <button onClick={(e) => { e.stopPropagation(); previous(); }} className="p-3 rounded-full active:scale-90 transition-transform" style={{ background: "hsl(0 0% 100% / 0.08)" }}>
                    <SkipBack className="w-5 h-5 text-white" />
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="p-3.5 rounded-full active:scale-90 transition-transform" style={{ background: "hsl(var(--primary))" }}>
                  {isPlaying ? <Pause className="w-6 h-6 text-primary-foreground" /> : <Play className="w-6 h-6 text-primary-foreground ml-0.5" />}
                </button>
                {!isLiveRadio && (
                  <button onClick={(e) => { e.stopPropagation(); next(); }} className="p-3 rounded-full active:scale-90 transition-transform" style={{ background: "hsl(0 0% 100% / 0.08)" }}>
                    <SkipForward className="w-5 h-5 text-white" />
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   Full-screen Now Playing — cinematic artwork view
   ═══════════════════════════════════════════════════ */
function NowPlayingFullScreen({
  coverUrl, title, artist, isPlaying, isLiveRadio,
  onClose, onTogglePlay, onNext, onPrevious,
}: {
  coverUrl: string; title: string; artist: string;
  isPlaying: boolean; isLiveRadio: boolean;
  onClose: () => void; onTogglePlay: () => void;
  onNext: () => void; onPrevious: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-between overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Blurred background artwork */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.2, opacity: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-0" style={{ background: DARK_BG }} />
        {coverUrl && (
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "blur(80px) brightness(0.4) saturate(1.8)", transform: "scale(1.3)" }}
          />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(0 0% 0% / 0.3) 0%, hsl(0 0% 0% / 0.7) 100%)" }} />
      </motion.div>

      {/* Close button */}
      <motion.div
        className="relative z-10 w-full flex items-center px-5 pt-[max(1rem,env(safe-area-inset-top))]"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <button
          onClick={onClose}
          className="p-3 rounded-full active:scale-90 transition-transform"
          style={{ background: "hsl(0 0% 100% / 0.1)" }}
        >
          <ChevronDown className="w-6 h-6 text-white" />
        </button>
        {isLiveRadio && (
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "hsl(0 0% 100% / 0.1)" }}>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">En direct</span>
          </div>
        )}
      </motion.div>

      {/* Giant artwork */}
      <motion.div
        className="relative z-10 flex-1 flex items-center justify-center px-8 py-6"
        initial={{ scale: 0.7, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.7, opacity: 0, y: 40 }}
        transition={{ type: "spring", stiffness: 200, damping: 25, delay: 0.1 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={coverUrl}
            initial={{ opacity: 0, scale: 0.85, rotateY: -15 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.85, rotateY: 15 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full aspect-square max-w-[85vw] max-h-[45vh] rounded-3xl overflow-hidden"
            style={{
              boxShadow: "0 30px 80px hsl(0 0% 0% / 0.6), 0 10px 30px hsl(0 0% 0% / 0.4)",
            }}
          >
            {coverUrl ? (
              <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: "hsl(0 0% 100% / 0.06)" }}>
                <Disc3 className="w-20 h-20 text-white/20" />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Track info + controls */}
      <motion.div
        className="relative z-10 w-full px-6 pb-[max(2rem,env(safe-area-inset-bottom))]"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Title + Artist */}
        <div className="text-center mb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-2xl font-black text-white truncate mb-1">{title}</p>
              <p className="text-base text-white/50 truncate">{artist}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Large transport controls */}
        <div className="flex items-center justify-center gap-6">
          {!isLiveRadio && (
            <motion.button
              onClick={onPrevious}
              className="p-4 rounded-full active:scale-90"
              style={{ background: "hsl(0 0% 100% / 0.1)" }}
              whileTap={{ scale: 0.85 }}
            >
              <SkipBack className="w-7 h-7 text-white" />
            </motion.button>
          )}
          <motion.button
            onClick={onTogglePlay}
            className="p-6 rounded-full active:scale-90"
            style={{
              background: "hsl(var(--primary))",
              boxShadow: "0 8px 30px hsl(var(--primary) / 0.4)",
            }}
            whileTap={{ scale: 0.88 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={isPlaying ? "pause" : "play"}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {isPlaying
                  ? <Pause className="w-9 h-9 text-primary-foreground" />
                  : <Play className="w-9 h-9 text-primary-foreground ml-1" />
                }
              </motion.div>
            </AnimatePresence>
          </motion.button>
          {!isLiveRadio && (
            <motion.button
              onClick={onNext}
              className="p-4 rounded-full active:scale-90"
              style={{ background: "hsl(0 0% 100% / 0.1)" }}
              whileTap={{ scale: 0.85 }}
            >
              <SkipForward className="w-7 h-7 text-white" />
            </motion.button>
          )}
        </div>

        {/* Live indicator for radio */}
        {isLiveRadio && isPlaying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-3 mt-6"
          >
            <LiveEqualizer />
            <span className="text-xs font-bold text-primary uppercase tracking-widest">En direct</span>
            <LiveEqualizer />
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default CarPlayPage;
