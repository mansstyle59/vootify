import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { useAuth } from "@/hooks/useAuth";
import { getEffectiveUserId } from "@/lib/deviceId";
import { getStationLogo } from "@/lib/radioLogos";
import { useRadioMetadata } from "@/hooks/useRadioMetadata";
import { Music, Radio, Search, X, Play, Pause, SkipBack, SkipForward, ChevronLeft, Volume2 } from "lucide-react";
import { LazyImage } from "@/components/LazyImage";
import { motion, AnimatePresence } from "framer-motion";

type CarPlayTab = "music" | "radio" | "search";

const CarPlayPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { play, currentSong, isPlaying, togglePlay, next, previous, setQueue } = usePlayerStore();
  const [tab, setTab] = useState<CarPlayTab>("music");
  const [searchQuery, setSearchQuery] = useState("");

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

  const playSong = useCallback((song: typeof songs[0], idx: number) => {
    if (currentSong?.id === song.id) { togglePlay(); return; }
    setQueue(filtered.length > 0 ? filtered : songs);
    play(song);
  }, [currentSong, togglePlay, play, setQueue, songs]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return tab === "music" ? songs : stations as any[];
    const q = searchQuery.toLowerCase();
    if (tab === "music") return songs.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
    return stations.filter(s => s.name.toLowerCase().includes(q));
  }, [searchQuery, tab, songs, stations]);

  const coverUrl = isLiveRadio && radioMetadata?.coverUrl ? radioMetadata.coverUrl : currentSong?.coverUrl;
  const displayTitle = isLiveRadio && radioMetadata?.title ? radioMetadata.title : currentSong?.title;
  const displayArtist = isLiveRadio && radioMetadata?.artist ? radioMetadata.artist : currentSong?.artist;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(0 0% 4%)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full" style={{ background: "hsl(0 0% 100% / 0.08)" }}>
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white flex-1">CarPlay</h1>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-2 px-4 pb-3">
        {[
          { key: "music" as CarPlayTab, icon: Music, label: "Musique" },
          { key: "radio" as CarPlayTab, icon: Radio, label: "Radio" },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setSearchQuery(""); }}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all active:scale-[0.96]"
            style={{
              background: tab === key ? "hsl(var(--primary))" : "hsl(0 0% 100% / 0.08)",
              color: tab === key ? "hsl(var(--primary-foreground))" : "hsl(0 0% 100% / 0.7)",
            }}
          >
            <Icon className="w-6 h-6" />
            {label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={tab === "music" ? "Rechercher un morceau..." : "Rechercher une station..."}
            className="w-full pl-11 pr-10 py-3.5 rounded-2xl text-base text-white placeholder:text-white/25 focus:outline-none"
            style={{ background: "hsl(0 0% 100% / 0.07)", border: "1px solid hsl(0 0% 100% / 0.06)" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full" style={{ background: "hsl(0 0% 100% / 0.12)" }}>
              <X className="w-4 h-4 text-white/60" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-32">
        {tab === "music" ? (
          <div className="space-y-1">
            {(searchQuery ? filtered : songs).map((song: any, i: number) => {
              const isActive = currentSong?.id === song.id;
              return (
                <button
                  key={song.id}
                  onClick={() => playSong(song, i)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-colors active:scale-[0.98]"
                  style={{ background: isActive ? "hsl(var(--primary) / 0.15)" : "transparent" }}
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0" style={{ background: "hsl(0 0% 100% / 0.06)" }}>
                    <LazyImage src={song.coverUrl} alt="" className="w-full h-full object-cover" fallback wrapperClassName="w-full h-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[15px] font-semibold truncate ${isActive ? "text-primary" : "text-white"}`}>{song.title}</p>
                    <p className="text-[13px] text-white/40 truncate">{song.artist}</p>
                  </div>
                  {isActive && isPlaying && <Volume2 className="w-5 h-5 text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {(searchQuery ? filtered : stations).map((station: any) => {
              const isActive = currentSong?.id === station.id;
              const isActivePlaying = isActive && isPlaying;
              return (
                <button
                  key={station.id}
                  onClick={() => playStation(station)}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl text-center transition-all active:scale-[0.95]"
                  style={{ background: isActive ? "hsl(var(--primary) / 0.15)" : "hsl(0 0% 100% / 0.05)" }}
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden" style={{ background: "hsl(0 0% 100% / 0.06)" }}>
                    <LazyImage src={station.coverUrl} alt="" className="w-full h-full object-contain p-1.5" fallback wrapperClassName="w-full h-full" />
                  </div>
                  <p className={`text-[13px] font-semibold truncate w-full ${isActive ? "text-primary" : "text-white"}`}>{station.name}</p>
                  {isActivePlaying && (
                    <span className="text-[10px] font-bold text-primary animate-pulse">● EN DIRECT</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Now Playing Bar — large touch targets for driving */}
      {currentSong && (
        <div
          className="fixed bottom-0 left-0 right-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
          style={{
            background: "linear-gradient(180deg, transparent 0%, hsl(0 0% 4%) 30%)",
          }}
        >
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              background: "hsl(0 0% 100% / 0.08)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              border: "1px solid hsl(0 0% 100% / 0.06)",
            }}
          >
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0" style={{ background: "hsl(0 0% 100% / 0.06)" }}>
              <LazyImage src={coverUrl || ""} alt="" className="w-full h-full object-cover" fallback wrapperClassName="w-full h-full" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-white truncate">{displayTitle || "—"}</p>
              <p className="text-[12px] text-white/40 truncate">{displayArtist || "—"}</p>
            </div>
            <div className="flex items-center gap-1">
              {!isLiveRadio && (
                <button onClick={previous} className="p-3 rounded-full active:scale-90" style={{ background: "hsl(0 0% 100% / 0.08)" }}>
                  <SkipBack className="w-5 h-5 text-white" />
                </button>
              )}
              <button onClick={togglePlay} className="p-3.5 rounded-full active:scale-90" style={{ background: "hsl(var(--primary))" }}>
                {isPlaying ? <Pause className="w-6 h-6 text-primary-foreground" /> : <Play className="w-6 h-6 text-primary-foreground ml-0.5" />}
              </button>
              {!isLiveRadio && (
                <button onClick={next} className="p-3 rounded-full active:scale-90" style={{ background: "hsl(0 0% 100% / 0.08)" }}>
                  <SkipForward className="w-5 h-5 text-white" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarPlayPage;
