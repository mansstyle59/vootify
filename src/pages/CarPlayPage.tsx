import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { useAuth } from "@/hooks/useAuth";
import { getStationLogo } from "@/lib/radioLogos";
import { useRadioMetadata, useRadioHistory } from "@/hooks/useRadioMetadata";
import {
  Music, Radio, Search, X, ChevronLeft, Volume2, History,
} from "lucide-react";
import { LazyImage } from "@/components/LazyImage";
import { motion, AnimatePresence } from "framer-motion";
import { CarPlayNowPlaying } from "@/components/carplay/CarPlayNowPlaying";
import { CarPlayMiniBar } from "@/components/carplay/CarPlayMiniBar";
import { CarPlayRadioHistory } from "@/components/carplay/CarPlayRadioHistory";

type CarPlayTab = "music" | "radio";

const DARK_BG = "hsl(0 0% 4%)";

const CarPlayPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { play, currentSong, isPlaying, togglePlay, next, previous, setQueue } = usePlayerStore();
  const [tab, setTab] = useState<CarPlayTab>("music");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const isLiveRadio = currentSong?.album === "Radio en direct";
  const radioMetadata = useRadioMetadata(
    isLiveRadio ? currentSong?.streamUrl : undefined,
    isLiveRadio, isPlaying, currentSong?.title, currentSong?.coverUrl
  );
  const radioHistory = useRadioHistory(isLiveRadio ? currentSong?.streamUrl : undefined);

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

  const playSong = useCallback((song: typeof songs[0]) => {
    if (currentSong?.id === song.id) { togglePlay(); return; }
    setQueue(filtered.length > 0 ? filtered : songs);
    play(song);
  }, [currentSong, togglePlay, play, setQueue, songs, filtered]);

  const coverUrl = isLiveRadio && radioMetadata?.coverUrl ? radioMetadata.coverUrl : currentSong?.coverUrl;
  const displayTitle = isLiveRadio && radioMetadata?.title ? radioMetadata.title : currentSong?.title;
  const displayArtist = isLiveRadio && radioMetadata?.artist ? radioMetadata.artist : currentSong?.artist;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: DARK_BG }}>

      {/* Full-screen Now Playing */}
      <AnimatePresence>
        {showNowPlaying && currentSong && (
          <CarPlayNowPlaying
            coverUrl={coverUrl || ""}
            title={displayTitle || "—"}
            artist={displayArtist || "—"}
            isPlaying={isPlaying}
            isLiveRadio={!!isLiveRadio}
            source={radioMetadata?.source}
            onClose={() => setShowNowPlaying(false)}
            onTogglePlay={togglePlay}
            onNext={next}
            onPrevious={previous}
          />
        )}
      </AnimatePresence>

      {/* Radio History overlay */}
      <CarPlayRadioHistory
        history={radioHistory}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-3 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2"
      >
        <button
          onClick={() => navigate(-1)}
          className="p-3 rounded-full active:scale-90 transition-transform"
          style={{ background: "hsl(0 0% 100%/0.08)", minWidth: 48, minHeight: 48 }}
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-xl font-black text-white flex-1 tracking-tight">CarPlay</h1>
        {/* History button — only when radio is playing */}
        {isLiveRadio && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={() => setShowHistory(true)}
            className="p-3 rounded-full active:scale-90 transition-transform relative"
            style={{ background: "hsl(0 0% 100%/0.08)", minWidth: 48, minHeight: 48 }}
          >
            <History className="w-5 h-5 text-white" />
            {radioHistory.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {radioHistory.length}
              </span>
            )}
          </motion.button>
        )}
        <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
      </motion.div>

      {/* Tab buttons — extra tall */}
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
            className="flex-1 flex items-center justify-center gap-2.5 rounded-2xl text-base font-bold transition-colors active:scale-[0.96]"
            style={{
              background: tab === key ? "hsl(var(--primary))" : "hsl(0 0% 100%/0.08)",
              color: tab === key ? "hsl(var(--primary-foreground))" : "hsl(0 0% 100%/0.6)",
              minHeight: 56,
              padding: "14px 0",
            }}
            whileTap={{ scale: 0.96 }}
          >
            <Icon className="w-6 h-6" />
            {label}
          </motion.button>
        ))}
      </motion.div>

      {/* Search bar — taller */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="px-4 pb-3"
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/25" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={tab === "music" ? "Rechercher un morceau..." : "Rechercher une station..."}
            className="w-full pl-12 pr-11 py-4 rounded-2xl text-base text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-shadow"
            style={{ background: "hsl(0 0% 100%/0.06)", border: "1px solid hsl(0 0% 100%/0.05)", minHeight: 52 }}
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full"
                style={{ background: "hsl(0 0% 100%/0.12)" }}
              >
                <X className="w-4 h-4 text-white/60" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Content list */}
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
              <div className="space-y-1.5">
                {(searchQuery ? filtered : songs).map((song: any, i: number) => {
                  const isActive = currentSong?.id === song.id;
                  return (
                    <motion.button
                      key={song.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                      onClick={() => playSong(song)}
                      className="w-full flex items-center gap-3.5 px-3 rounded-2xl text-left transition-colors active:scale-[0.97]"
                      style={{ background: isActive ? "hsl(var(--primary)/0.15)" : "transparent", minHeight: 72, padding: "10px 12px" }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 relative" style={{ background: "hsl(0 0% 100%/0.06)" }}>
                        <LazyImage src={song.coverUrl} alt="" className="w-full h-full object-cover" fallback wrapperClassName="w-full h-full" />
                        {isActive && isPlaying && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "hsl(0 0% 0%/0.5)" }}>
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
              <div className="grid grid-cols-2 gap-3">
                {(searchQuery ? filtered : stations).map((station: any, i: number) => {
                  const isActive = currentSong?.id === station.id;
                  const isActivePlaying = isActive && isPlaying;
                  return (
                    <motion.button
                      key={station.id}
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4) }}
                      onClick={() => playStation(station)}
                      className="flex flex-col items-center gap-2.5 rounded-2xl text-center transition-all active:scale-[0.94]"
                      style={{ background: isActive ? "hsl(var(--primary)/0.15)" : "hsl(0 0% 100%/0.05)", minHeight: 120, padding: "16px 12px" }}
                      whileTap={{ scale: 0.94 }}
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden relative" style={{ background: "hsl(0 0% 100%/0.06)" }}>
                        <LazyImage src={station.coverUrl} alt="" className="w-full h-full object-contain p-1.5" fallback wrapperClassName="w-full h-full" />
                        {isActivePlaying && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "hsl(0 0% 0%/0.5)" }}>
                            <div className="flex items-end gap-[2px] h-4">
                              {[0, 0.15, 0.3].map((d, j) => (
                                <motion.div key={j} className="w-[3px] rounded-full bg-primary" animate={{ height: ["6px", "16px", "8px", "14px", "6px"] }} transition={{ duration: 1.2, repeat: Infinity, delay: d, ease: "easeInOut" }} />
                              ))}
                            </div>
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

      {/* Mini bar */}
      <AnimatePresence>
        {currentSong && !showNowPlaying && (
          <CarPlayMiniBar
            coverUrl={coverUrl || ""}
            title={displayTitle || "—"}
            artist={displayArtist || "—"}
            isPlaying={isPlaying}
            isLiveRadio={!!isLiveRadio}
            onExpand={() => setShowNowPlaying(true)}
            onTogglePlay={togglePlay}
            onNext={next}
            onPrevious={previous}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CarPlayPage;
