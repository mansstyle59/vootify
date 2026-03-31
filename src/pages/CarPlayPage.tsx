import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { useAuth } from "@/hooks/useAuth";
import { getStationLogo } from "@/lib/radioLogos";
import { useRadioMetadata, useRadioHistory } from "@/hooks/useRadioMetadata";
import { getGreeting, getSmartMixLabel, buildSmartMix, getTimeContext } from "@/lib/smartMix";
import {
  Music, Radio, Search, X, ChevronLeft, Volume2, History, Clock, Disc3, Heart, Star, User, Play,
  Sparkles, Shuffle, Zap, Sun, Moon, Sunset,
} from "lucide-react";
import { LazyImage } from "@/components/LazyImage";
import { motion, AnimatePresence } from "framer-motion";
import { CarPlayNowPlaying } from "@/components/carplay/CarPlayNowPlaying";
import { CarPlayMiniBar } from "@/components/carplay/CarPlayMiniBar";
import { CarPlayRadioHistory } from "@/components/carplay/CarPlayRadioHistory";
import { SafeImage } from "@/components/SafeImage";

type CarPlayTab = "music" | "radio" | "recent";

/* ── Liquid Glass shared styles ── */
const GLASS_BG = {
  background: "hsl(0 0% 100%/0.06)",
  backdropFilter: "blur(80px) saturate(2.2)",
  WebkitBackdropFilter: "blur(80px) saturate(2.2)",
  border: "0.5px solid hsl(0 0% 100%/0.1)",
  boxShadow: "inset 0 0.5px 0 hsl(0 0% 100%/0.12), 0 8px 32px hsl(0 0% 0%/0.3)",
};

const GLASS_BUTTON = {
  background: "hsl(0 0% 100%/0.08)",
  backdropFilter: "blur(40px) saturate(1.8)",
  WebkitBackdropFilter: "blur(40px) saturate(1.8)",
  border: "0.5px solid hsl(0 0% 100%/0.1)",
  boxShadow: "inset 0 0.5px 0 hsl(0 0% 100%/0.1)",
};

const GLASS_ACTIVE = {
  background: "hsl(var(--primary)/0.15)",
  backdropFilter: "blur(40px) saturate(1.8)",
  WebkitBackdropFilter: "blur(40px) saturate(1.8)",
  border: "0.5px solid hsl(var(--primary)/0.25)",
  boxShadow: "inset 0 0.5px 0 hsl(var(--primary)/0.2), 0 4px 20px hsl(var(--primary)/0.15)",
};

const CarPlayPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { play, currentSong, isPlaying, togglePlay, next, previous, setQueue } = usePlayerStore();
  const [tab, setTab] = useState<CarPlayTab>("music");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [artistFilter, setArtistFilter] = useState<string | null>(null);

  // Profile for greeting
  const { data: profile } = useQuery({
    queryKey: ["carplay-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const timeCtx = getTimeContext();
  const greeting = getGreeting(profile?.display_name);
  const TimeIcon = timeCtx === "morning" ? Sun : timeCtx === "night" ? Moon : Sunset;

  const isLiveRadio = currentSong?.album === "Radio en direct";
  const radioMetadata = useRadioMetadata(
    isLiveRadio ? currentSong?.streamUrl : undefined,
    isLiveRadio, isPlaying, currentSong?.title, currentSong?.coverUrl
  );
  const radioHistory = useRadioHistory(isLiveRadio ? currentSong?.streamUrl : undefined);

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

  // Recently played
  const { data: recentlyPlayed = [] } = useQuery({
    queryKey: ["carplay-recent", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("recently_played").select("*").eq("user_id", user.id).order("played_at", { ascending: false }).limit(20);
      return (data || []).map(s => ({
        id: s.song_id, title: s.title, artist: s.artist, album: s.album || "",
        duration: s.duration, coverUrl: s.cover_url || "", streamUrl: s.stream_url || "", liked: false,
      }));
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Liked songs
  const { data: likedSongs = [] } = useQuery({
    queryKey: ["carplay-liked", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("liked_songs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
      return (data || []).map(s => ({
        id: s.song_id, title: s.title, artist: s.artist, album: s.album || "",
        duration: s.duration, coverUrl: s.cover_url || "", streamUrl: s.stream_url || "", liked: true,
      }));
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Extract popular artists from songs
  const topArtists = useMemo(() => {
    const map = new Map<string, { count: number; coverUrl: string }>();
    for (const s of songs) {
      s.artist.split(",").forEach(a => {
        const name = a.trim();
        if (!name) return;
        const existing = map.get(name);
        if (existing) existing.count++;
        else map.set(name, { count: 1, coverUrl: s.coverUrl });
      });
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([name, { coverUrl }]) => ({ name, coverUrl }));
  }, [songs]);

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
    const q = searchQuery.toLowerCase().trim();
    if (tab === "music") {
      let list = songs;
      if (artistFilter) list = list.filter(s => s.artist.toLowerCase().includes(artistFilter.toLowerCase()));
      if (q) list = list.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
      return list;
    }
    if (q) return stations.filter(s => s.name.toLowerCase().includes(q));
    return stations as any[];
  }, [searchQuery, tab, songs, stations, artistFilter]);

  const playSong = useCallback((song: typeof songs[0]) => {
    if (currentSong?.id === song.id) { togglePlay(); return; }
    setQueue(filtered.length > 0 ? filtered : songs);
    play(song);
  }, [currentSong, togglePlay, play, setQueue, songs, filtered]);

  const coverUrl = isLiveRadio && radioMetadata?.coverUrl ? radioMetadata.coverUrl : currentSong?.coverUrl;
  const displayTitle = isLiveRadio && radioMetadata?.title ? radioMetadata.title : currentSong?.title;
  const displayArtist = isLiveRadio && radioMetadata?.artist ? radioMetadata.artist : currentSong?.artist;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black">
      {/* Ambient background glow from current cover */}
      {currentSong?.coverUrl && (
        <div className="absolute inset-0 pointer-events-none">
          <SafeImage
            src={currentSong.coverUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "blur(120px) brightness(0.15) saturate(2.5)", transform: "scale(1.5)", opacity: 0.6 }}
          />
        </div>
      )}

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

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2"
      >
        <button
          onClick={() => navigate(-1)}
          className="p-3 rounded-2xl active:scale-90 transition-transform"
          style={{ ...GLASS_BUTTON, minWidth: 48, minHeight: 48 }}
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-white tracking-tight truncate">{greeting}</h1>
          <div className="flex items-center gap-1.5">
            <TimeIcon className="w-3 h-3 text-white/30" />
            <p className="text-[10px] text-white/30 font-medium">Mode conduite</p>
          </div>
        </div>

        {/* History button */}
        {isLiveRadio && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={() => setShowHistory(true)}
            className="p-3 rounded-2xl active:scale-90 transition-transform relative"
            style={{ ...GLASS_BUTTON, minWidth: 48, minHeight: 48 }}
          >
            <Clock className="w-5 h-5 text-white" />
            {radioHistory.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {radioHistory.length}
              </span>
            )}
          </motion.button>
        )}
        <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
      </motion.div>

      {/* ── Tab selector — Liquid Glass pills ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mx-4 mb-3 p-1 rounded-2xl"
        style={{
          background: "hsl(0 0% 100%/0.04)",
          border: "0.5px solid hsl(0 0% 100%/0.08)",
          boxShadow: "inset 0 0.5px 0 hsl(0 0% 100%/0.06)",
        }}
      >
        <div className="flex gap-1 relative">
          {/* Sliding glass indicator */}
          <motion.div
            className="absolute top-0 bottom-0 rounded-xl"
            style={{
              width: "calc(33.333% - 3px)",
              background: "hsl(var(--primary)/0.2)",
              backdropFilter: "blur(20px)",
              border: "0.5px solid hsl(var(--primary)/0.3)",
              boxShadow: "inset 0 0.5px 0 hsl(var(--primary)/0.15), 0 4px 16px hsl(var(--primary)/0.1)",
            }}
            animate={{ x: tab === "music" ? 0 : tab === "recent" ? "calc(100% + 4px)" : "calc(200% + 8px)" }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          />
          {([
            { key: "music" as CarPlayTab, icon: Music, label: "Musique" },
            { key: "recent" as CarPlayTab, icon: Clock, label: "Récents" },
            { key: "radio" as CarPlayTab, icon: Radio, label: "Radio" },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setSearchQuery(""); setArtistFilter(null); }}
              className="relative z-10 flex-1 flex items-center justify-center gap-2 rounded-xl text-[14px] font-bold transition-colors active:scale-[0.96]"
              style={{
                color: tab === key ? "hsl(var(--primary))" : "hsl(0 0% 100%/0.5)",
                minHeight: 50,
                padding: "10px 0",
              }}
            >
              <Icon className="w-4.5 h-4.5" />
              {label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Search bar — Glass ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 px-4 pb-3"
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={tab === "music" ? "Rechercher un morceau..." : "Rechercher une station..."}
            className="w-full pl-12 pr-11 py-3.5 rounded-2xl text-base text-white placeholder:text-white/20 focus:outline-none transition-shadow"
            style={{
              ...GLASS_BG,
              minHeight: 50,
            }}
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full"
                style={GLASS_BUTTON}
              >
                <X className="w-4 h-4 text-white/60" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Quick Access: Artists + Favorites (music tab only, no search) ── */}
      {tab === "music" && !searchQuery && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="relative z-10 px-3 mb-2"
        >
          {/* Artist filter bubbles */}
          {topArtists.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-2 px-1">Artistes</p>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {artistFilter && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={() => setArtistFilter(null)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full flex-shrink-0 active:scale-90 transition-transform"
                    style={{ background: "hsl(0 0% 100%/0.1)", border: "0.5px solid hsl(0 0% 100%/0.15)" }}
                  >
                    <X className="w-3.5 h-3.5 text-white/60" />
                    <span className="text-[12px] text-white/60 font-medium">Tous</span>
                  </motion.button>
                )}
                {topArtists.map((artist, i) => {
                  const isActive = artistFilter === artist.name;
                  return (
                    <motion.button
                      key={artist.name}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setArtistFilter(isActive ? null : artist.name)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full flex-shrink-0 active:scale-90 transition-transform"
                      style={isActive ? GLASS_ACTIVE : GLASS_BUTTON}
                    >
                      <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0" style={{ background: "hsl(0 0% 100%/0.08)" }}>
                        {artist.coverUrl ? (
                          <LazyImage src={artist.coverUrl} alt="" className="w-full h-full object-cover" fallback wrapperClassName="w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><User className="w-3.5 h-3.5 text-white/30" /></div>
                        )}
                      </div>
                      <span className={`text-[12px] font-semibold truncate max-w-[80px] ${isActive ? "text-primary" : "text-white/70"}`}>{artist.name}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Smart Mix + Quick access */}
          <div className="flex gap-2 mb-2">
            {/* Smart Mix button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const mix = buildSmartMix(songs, likedSongs, recentlyPlayed);
                if (mix.length > 0) { setQueue(mix); play(mix[0]); }
              }}
              className="flex-1 flex items-center gap-2.5 px-3 py-3 rounded-2xl active:scale-95 transition-transform"
              style={{
                background: "linear-gradient(135deg, hsl(var(--primary)/0.15), hsl(var(--primary)/0.05))",
                border: "0.5px solid hsl(var(--primary)/0.2)",
                boxShadow: "0 4px 20px hsl(var(--primary)/0.1)",
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--primary)/0.2)" }}>
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 text-left">
                <p className="text-[12px] font-bold text-white">{getSmartMixLabel()}</p>
                <p className="text-[9px] text-white/30">Pour toi</p>
              </div>
            </motion.button>

            {/* Shuffle all */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const shuffled = [...songs].sort(() => Math.random() - 0.5);
                if (shuffled.length > 0) { setQueue(shuffled); play(shuffled[0]); }
              }}
              className="flex items-center gap-2 px-3 py-3 rounded-2xl active:scale-95 transition-transform"
              style={GLASS_BG}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "hsl(0 0% 100%/0.08)" }}>
                <Shuffle className="w-5 h-5 text-white/60" />
              </div>
            </motion.button>
          </div>

          {/* Liked + Recent row */}
          <div className="flex gap-2 mb-2">
            {likedSongs.length > 0 && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { setQueue(likedSongs); play(likedSongs[0]); }}
                className="flex-1 flex items-center gap-2.5 px-3 py-3 rounded-2xl active:scale-95 transition-transform"
                style={GLASS_BG}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "hsl(0 80% 55%/0.15)" }}>
                  <Heart className="w-5 h-5 text-red-400 fill-red-400" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-[12px] font-bold text-white">Favoris</p>
                  <p className="text-[9px] text-white/30">{likedSongs.length} titres</p>
                </div>
              </motion.button>
            )}
            {recentlyPlayed.length > 0 && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { setQueue(recentlyPlayed); play(recentlyPlayed[0]); }}
                className="flex-1 flex items-center gap-2.5 px-3 py-3 rounded-2xl active:scale-95 transition-transform"
                style={GLASS_BG}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--primary)/0.15)" }}>
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-[12px] font-bold text-white">Récents</p>
                  <p className="text-[9px] text-white/30">{recentlyPlayed.length} titres</p>
                </div>
              </motion.button>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Content list ── */}
      <div className="relative z-10 flex-1 overflow-y-auto px-3 pb-36 scrollbar-hide">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${tab}-${artistFilter || ''}`}
            initial={{ opacity: 0, x: tab === "radio" ? 40 : -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: tab === "radio" ? -40 : 40 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === "music" ? (
              <div className="space-y-1.5">
                {(searchQuery || artistFilter ? filtered : songs).map((song: any, i: number) => {
                  const isActive = currentSong?.id === song.id;
                  return (
                    <motion.button
                      key={song.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.025, 0.3) }}
                      onClick={() => playSong(song)}
                      className="w-full flex items-center gap-3.5 rounded-2xl text-left transition-all active:scale-[0.97]"
                      style={{
                        ...(isActive ? GLASS_ACTIVE : { background: "transparent" }),
                        minHeight: 72,
                        padding: "10px 12px",
                      }}
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
                      {song.duration > 0 && (
                        <span className="text-[11px] text-white/20 flex-shrink-0 tabular-nums">
                          {Math.floor(song.duration / 60)}:{String(Math.floor(song.duration % 60)).padStart(2, "0")}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
                {songs.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-48 text-white/25">
                    <Disc3 className="w-12 h-12 mb-3" />
                    <p className="text-base font-medium">Aucun morceau</p>
                  </div>
                )}
              </div>
            ) : tab === "recent" ? (
              <div className="space-y-1.5">
                {recentlyPlayed.length > 0 && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setQueue(recentlyPlayed); play(recentlyPlayed[0]); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl mb-3 active:scale-95 transition-transform"
                    style={{
                      background: "hsl(var(--primary)/0.1)",
                      border: "0.5px solid hsl(var(--primary)/0.2)",
                      boxShadow: "0 4px 16px hsl(var(--primary)/0.1)",
                    }}
                  >
                    <Play className="w-5 h-5 text-primary" />
                    <span className="text-[14px] font-bold text-primary">Tout lire</span>
                    <span className="ml-auto text-[11px] text-white/30">{recentlyPlayed.length} titres</span>
                  </motion.button>
                )}
                {recentlyPlayed.map((song: any, i: number) => {
                  const isActive = currentSong?.id === song.id;
                  return (
                    <motion.button
                      key={`${song.id}-${i}`}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.025, 0.3) }}
                      onClick={() => { setQueue(recentlyPlayed); play(song); }}
                      className="w-full flex items-center gap-3.5 rounded-2xl text-left transition-all active:scale-[0.97]"
                      style={{
                        ...(isActive ? GLASS_ACTIVE : { background: "transparent" }),
                        minHeight: 72,
                        padding: "10px 12px",
                      }}
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
                      {song.duration > 0 && (
                        <span className="text-[11px] text-white/20 flex-shrink-0 tabular-nums">
                          {Math.floor(song.duration / 60)}:{String(Math.floor(song.duration % 60)).padStart(2, "0")}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
                {recentlyPlayed.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-48 text-white/25">
                    <Clock className="w-12 h-12 mb-3" />
                    <p className="text-base font-medium">Aucun titre récent</p>
                    <p className="text-[12px] text-white/15 mt-1">Les morceaux écoutés apparaîtront ici</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
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
                      style={{
                        ...(isActive ? GLASS_ACTIVE : GLASS_BG),
                        minHeight: 120,
                        padding: "14px 10px",
                      }}
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
                      <p className="text-[10px] text-white/25 truncate w-full -mt-1">{station.genre}</p>
                    </motion.button>
                  );
                })}
                {stations.length === 0 && (
                  <div className="col-span-2 flex flex-col items-center justify-center h-48 text-white/25">
                    <Radio className="w-12 h-12 mb-3" />
                    <p className="text-base font-medium">Aucune station</p>
                  </div>
                )}
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
