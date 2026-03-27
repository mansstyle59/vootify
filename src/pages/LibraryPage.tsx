import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { useAuth } from "@/hooks/useAuth";
import { useDominantColor } from "@/hooks/useDominantColor";
import { formatDuration } from "@/data/mockData";
import {
  Heart, ListMusic, Clock, Plus, Trash2, Play, Pause, Download,
  HardDrive, Trash, Music, Shuffle, LogIn, WifiOff, ArrowUpDown,
  RefreshCw, Loader2, MoreHorizontal, ChevronRight, CheckSquare, X, ListPlus, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { offlineCache } from "@/lib/offlineCache";
import { Song } from "@/data/mockData";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { normalizeTitle, normalizeArtist, normalizeText } from "@/lib/metadataEnrich";
import { batchSearchCovers } from "@/lib/coverArtSearch";

type Tab = "liked" | "playlists" | "recent" | "downloads" | "custom";
type SortOption = "recent" | "alpha" | "artist" | "duration";

const filterFullStreams = (songs: Song[]) =>
  songs.filter((s) => s.streamUrl);

/** Filter out radio stations (duration === 0) from recently played */
const filterMusicOnly = (songs: Song[]) =>
  songs.filter((s) => s.duration > 0);

/* ── Premium Song Row ── */
function PremiumSongRow({
  song, index, showIndex, isActive, isPlaying, onClick, onSwipeLeft, onSwipeRight,
  selectable, selected, onSelect, cached,
}: {
  song: Song; index: number; showIndex?: boolean;
  isActive: boolean; isPlaying: boolean;
  onClick: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  cached?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const [swiped, setSwiped] = useState<"left" | "right" | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    setSwiped(null);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - startXRef.current;
    if (diff < -80 && onSwipeLeft) { setSwiped("left"); setTimeout(() => { onSwipeLeft(); setSwiped(null); }, 300); }
    else if (diff > 80 && onSwipeRight) { setSwiped("right"); setTimeout(() => { onSwipeRight(); setSwiped(null); }, 300); }
  };

  // Format artist with feat styling
  const formatArtist = (artist: string) => {
    const parts = artist.split(/\s*(feat\.?|ft\.?|featuring)\s*/i);
    if (parts.length <= 1) return <span>{artist}</span>;
    return (
      <>
        <span>{parts[0].trim()}</span>
        <span className="text-muted-foreground/50 font-normal"> feat. </span>
        <span className="text-muted-foreground/70">{parts.slice(2).join(", ").trim()}</span>
      </>
    );
  };

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, x: 20 }}
      animate={{
        opacity: 1,
        x: swiped === "left" ? -80 : swiped === "right" ? 80 : 0,
      }}
      transition={{ duration: 0.2 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={selectable ? onSelect : onClick}
      className={`group flex items-center gap-3.5 px-3 py-3 rounded-2xl cursor-pointer transition-all duration-200 active:scale-[0.98] ${
        selected ? "bg-primary/12 ring-1 ring-primary/25" : isActive ? "bg-primary/8 ring-1 ring-primary/15" : "hover:bg-secondary/50"
      }`}
    >
      {/* Selection checkbox or index */}
      {selectable ? (
        <div className="w-7 flex-shrink-0 flex items-center justify-center">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            selected ? "bg-primary border-primary" : "border-muted-foreground/30"
          }`}>
            {selected && (
              <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        </div>
      ) : showIndex ? (
        <div className="w-7 flex-shrink-0 flex items-center justify-center">
          {isActive && isPlaying ? (
            <div className="flex items-end gap-[2px] h-4">
              <div className="w-[2.5px] rounded-full bg-primary animate-equalizer-1" />
              <div className="w-[2.5px] rounded-full bg-primary animate-equalizer-2" />
              <div className="w-[2.5px] rounded-full bg-primary animate-equalizer-3" />
            </div>
          ) : (
            <span className={`text-xs tabular-nums font-medium ${isActive ? "text-primary" : "text-muted-foreground/60"}`}>
              {index + 1}
            </span>
          )}
        </div>
      ) : null}

      {/* Cover */}
      <div className={`relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-md transition-shadow ${
        isActive ? "shadow-primary/20 ring-1 ring-primary/30" : "shadow-black/20"
      }`}>
        {song.coverUrl ? (
          <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <Music className="w-5 h-5 text-muted-foreground/40" />
          </div>
        )}
        {!selectable && (
          <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
            isActive ? "bg-black/25 opacity-100" : "bg-black/30 opacity-0 group-hover:opacity-100"
          }`}>
            {isActive && isPlaying ? (
              <Pause className="w-4 h-4 text-white" />
            ) : (
              <Play className="w-4 h-4 text-white ml-0.5" />
            )}
          </div>
        )}
      </div>

      {/* Title & Artist */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-[13px] font-semibold leading-tight truncate ${
            isActive ? "text-primary" : "text-foreground"
          }`}>
            {song.title}
          </p>
          {cached && (
            <span className="shrink-0 inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
              <Download className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-[11px] text-muted-foreground/70 leading-tight truncate">
            {formatArtist(song.artist)}
          </p>
          {song.genre && (
            <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
              {song.genre}
            </span>
          )}
          {song.year && (
            <span className="shrink-0 text-[9px] text-muted-foreground/40">{song.year}</span>
          )}
        </div>
      </div>

      <span className="text-[11px] text-muted-foreground/50 tabular-nums flex-shrink-0 font-medium">
        {formatDuration(song.duration)}
      </span>
    </motion.div>
  );
}

/* ── Animated Tab Pill ── */
function TabPill({ tab, activeTab, label, icon: Icon, onClick }: {
  tab: Tab; activeTab: Tab; label: string; icon: React.ElementType; onClick: () => void;
}) {
  const isActive = tab === activeTab;
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
        isActive ? "text-primary-foreground" : "text-secondary-foreground hover:bg-secondary/80"
      }`}
    >
      {isActive && (
        <motion.div
          layoutId="libraryTab"
          className="absolute inset-0 bg-primary rounded-full shadow-lg shadow-primary/25"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </span>
    </button>
  );
}

/* ── Action Buttons Row ── */
function ActionButtons({ onPlayAll, onShuffle, extra }: {
  onPlayAll: () => void; onShuffle: () => void; extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onPlayAll}
        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/30 hover:brightness-110 transition-all"
      >
        <Play className="w-4 h-4" />
        Tout lire
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onShuffle}
        className="flex items-center gap-2 px-5 py-2.5 rounded-full liquid-glass text-foreground text-sm font-medium transition-all"
      >
        <Shuffle className="w-4 h-4" />
        Aléatoire
      </motion.button>
      {extra}
    </div>
  );
}

/* ── Empty State ── */
function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="p-5 rounded-3xl liquid-glass mb-4">
        <Icon className="w-10 h-10 text-muted-foreground/40" />
      </div>
      <p className="text-foreground font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground/60 mt-1 max-w-[220px]">{subtitle}</p>
    </motion.div>
  );
}

const LibraryPage = () => {
  const [tab, setTab] = useState<Tab>("recent");
  const [customSort, setCustomSort] = useState<SortOption>("recent");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin } = useAdminAuth();
  const {
    likedSongs, playlists, recentlyPlayed, playlistSongs,
    createPlaylist, deletePlaylist, play, setQueue, loadPlaylistSongs,
    currentSong, isPlaying, togglePlay, clearRecentlyPlayed, loadUserData, userId,
    toggleLike, addSongToPlaylist
  } = usePlayerStore();
  const queryClient = useQueryClient();

  // Shared playlists from admin
  const { data: sharedPlaylists = [] } = useQuery({
    queryKey: ["shared-playlists", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("shared_playlists")
        .select("*")
        .eq("shared_to", userId)
        .eq("status", "accepted")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: sharedPlaylistSongsMap = {} } = useQuery({
    queryKey: ["shared-playlist-songs", sharedPlaylists.map((p: any) => p.id).join(",")],
    queryFn: async () => {
      if (sharedPlaylists.length === 0) return {};
      const ids = sharedPlaylists.map((p: any) => p.id);
      const { data, error } = await supabase
        .from("shared_playlist_songs")
        .select("*")
        .in("shared_playlist_id", ids)
        .order("position", { ascending: true });
      if (error) throw error;
      const map: Record<string, Song[]> = {};
      for (const row of data || []) {
        if (!map[row.shared_playlist_id]) map[row.shared_playlist_id] = [];
        map[row.shared_playlist_id].push({
          id: row.song_id,
          title: row.title,
          artist: row.artist,
          album: row.album || "",
          duration: row.duration || 0,
          coverUrl: row.cover_url || "",
          streamUrl: row.stream_url || "",
          liked: false,
        });
      }
      return map;
    },
    enabled: sharedPlaylists.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  // Online/offline tracking
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries();
        if (userId) loadUserData(userId);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [queryClient, userId, loadUserData]);

  const [libraryCachedIds, setLibraryCachedIds] = useState<Set<string>>(new Set());
  const [playlistCachedCounts, setPlaylistCachedCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (tab === "playlists") {
      playlists.forEach((p) => { if (!playlistSongs[p.id]) loadPlaylistSongs(p.id); });
    }
  }, [tab, playlists]);

  useEffect(() => {
    if (tab !== "playlists") return;
    const countCached = async () => {
      const counts: Record<string, number> = {};
      for (const p of playlists) {
        const songs = playlistSongs[p.id] || [];
        let count = 0;
        for (const s of songs) { if (await offlineCache.isCached(s.id)) count++; }
        counts[p.id] = count;
      }
      setPlaylistCachedCounts(counts);
    };
    countCached();
  }, [tab, playlists, playlistSongs]);

  // (cache check moved after customSongs declaration)

  const { data: customSongs = [] } = useQuery({
    queryKey: ["custom-songs"],
    queryFn: async () => {
      // Paginate past 1000-row Supabase default limit
      let allData: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("custom_songs")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      const songs = (allData).map((s: any): Song & { _dbId: string } => ({
        _dbId: s.id, id: `custom-${s.id}`,
        title: normalizeTitle(s.title),
        artist: normalizeArtist(s.artist),
        album: s.album ? normalizeText(s.album) : "",
        duration: s.duration, coverUrl: s.cover_url || "",
        streamUrl: s.stream_url || "", liked: false,
      }));

      // Auto-fix missing durations via Audio element
      const toFixDuration = songs.filter((s) => !s.duration && s.streamUrl);
      if (toFixDuration.length > 0) {
        Promise.all(toFixDuration.map((s) => new Promise<void>((resolve) => {
          const audio = new Audio();
          audio.preload = "metadata";
          audio.src = s.streamUrl;
          audio.addEventListener("loadedmetadata", () => {
            const dur = audio.duration && isFinite(audio.duration) ? Math.round(audio.duration) : 0;
            if (dur > 0) { s.duration = dur; supabase.from("custom_songs").update({ duration: dur }).eq("id", s._dbId).then(() => {}); }
            resolve();
          }, { once: true });
          audio.addEventListener("error", () => resolve(), { once: true });
          setTimeout(() => resolve(), 5000);
        }))).then(() => queryClient.invalidateQueries({ queryKey: ["custom-songs"] }));
      }


      return songs as Song[];
    },
    staleTime: 60 * 1000,
    enabled: tab === "custom",
  });

  // Check which songs in current view are cached offline
  useEffect(() => {
    const allSongs = [
      ...(tab === "recent" ? recentlyPlayed : []),
      ...(tab === "liked" ? likedSongs : []),
      ...(tab === "custom" ? customSongs : []),
    ];
    if (allSongs.length === 0) { setLibraryCachedIds(new Set()); return; }
    Promise.all(
      allSongs.map((s) => offlineCache.isCached(s.id).then((c) => (c ? s.id : null)))
    ).then((ids) => setLibraryCachedIds(new Set(ids.filter(Boolean) as string[])));
  }, [tab, recentlyPlayed, likedSongs, customSongs]);

  const [cachedSongs, setCachedSongs] = useState<(Song & { cachedAt: number })[]>([]);
  const [cacheSize, setCacheSize] = useState(0);
  const [isRedownloading, setIsRedownloading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    if (tab !== "downloads" && !isOffline) return;
    const load = async () => {
      const [songs, size] = await Promise.all([offlineCache.getAllCached(), offlineCache.getCacheSize()]);
      setCachedSongs(songs);
      setCacheSize(size);
    };
    load();
  }, [tab, isOffline]);

  const sortedCustomSongs = useMemo(() => {
    const arr = [...customSongs];
    switch (customSort) {
      case "alpha": return arr.sort((a, b) => a.title.localeCompare(b.title, "fr"));
      case "artist": return arr.sort((a, b) => a.artist.localeCompare(b.artist, "fr"));
      case "duration": return arr.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      default: return arr;
    }
  }, [customSongs, customSort]);

  const removeCached = async (songId: string) => {
    await offlineCache.removeCached(songId);
    setCachedSongs((prev) => prev.filter((s) => s.id !== songId));
    const size = await offlineCache.getCacheSize();
    setCacheSize(size);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const handleCreate = () => {
    if (newName.trim()) { createPlaylist(newName.trim()); setNewName(""); setShowCreate(false); }
  };

  // Filtered recent: music only (no radios)
  const recentMusic = useMemo(() => {
    const music = filterMusicOnly(filterFullStreams(recentlyPlayed));
    // Deduplicate
    const seen = new Set<string>();
    return music.filter((s) => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
  }, [recentlyPlayed]);

  // Dynamic header color from first song
  const headerSong = tab === "recent" ? recentMusic[0] : tab === "liked" ? likedSongs[0] : tab === "custom" ? customSongs[0] : null;
  const headerColor = useDominantColor(headerSong?.coverUrl);

  const allTabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "recent", label: "Récents", icon: Clock },
    { key: "liked", label: "Aimés", icon: Heart },
    { key: "playlists", label: "Playlists", icon: ListMusic },
    { key: "custom", label: "Mes titres", icon: Music },
    { key: "downloads", label: "Hors-ligne", icon: Download },
  ];

  const tabs = isAdmin ? allTabs : allTabs.filter((t) => t.key !== "custom");
  const isGuest = !authLoading && !user;

  useEffect(() => {
    if (!isAdmin && tab === "custom") {
      setTab(isOffline ? "downloads" : "recent");
      return;
    }
    if (isGuest && !isOffline && tab !== "downloads") setTab("downloads");
    if (isOffline && tab !== "downloads") setTab("downloads");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, isOffline, isAdmin]);

  const visibleTabs = isOffline
    ? tabs.filter((t) => t.key === "downloads")
    : isGuest
      ? tabs.filter((t) => t.key === "downloads")
      : tabs;

  return (
    <div className="pb-40 max-w-7xl mx-auto relative animate-fade-in">
      {/* Dynamic gradient header */}
      <div
        className="sticky top-0 z-20 transition-colors duration-700"
        style={{
          background: headerColor
            ? `linear-gradient(180deg, ${headerColor}40 0%, hsl(240 10% 6%) 100%)`
            : undefined,
        }}
      >
        <div className="px-4 md:px-8 pt-[max(1.5rem,env(safe-area-inset-top))] pb-3" style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
          {isOffline && (
            <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-400 font-medium">Mode hors-ligne — seuls les morceaux téléchargés sont disponibles</p>
            </div>
          )}

          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-0.5">
            {isOffline ? "Mode Hors-ligne" : "Bibliothèque"}
          </h1>
          <p className="text-xs text-muted-foreground/70 mb-4">
            {isOffline ? "Écoutez vos morceaux sans connexion" : "Vos morceaux, playlists et favoris"}
          </p>

          {/* Tab pills */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
            {visibleTabs.map(({ key, label, icon }) => (
              <TabPill key={key} tab={key} activeTab={tab} label={label} icon={icon} onClick={() => setTab(key)} />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* ── RECENT ── */}
            {tab === "recent" && (
              <div>
                {recentMusic.length === 0 ? (
                  <EmptyState icon={Clock} title="Rien d'écouté récemment" subtitle="Vos morceaux écoutés apparaîtront ici" />
                ) : (
                  <>
                    <ActionButtons
                      onPlayAll={() => { setQueue(recentMusic); play(recentMusic[0]); }}
                      onShuffle={() => { const s = [...recentMusic].sort(() => Math.random() - 0.5); setQueue(s); play(s[0]); }}
                      extra={
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => clearRecentlyPlayed()}
                          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-full bg-destructive/10 text-destructive text-xs font-medium"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>
                      }
                    />
                    <p className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wider mb-2 px-1">
                      {recentMusic.length} morceau{recentMusic.length > 1 ? "x" : ""}
                    </p>
                    <div className="rounded-2xl liquid-glass overflow-hidden">
                      {recentMusic.map((s, i) => (
                        <PremiumSongRow
                          key={`${s.id}-${i}`}
                          song={s}
                          index={i}
                          showIndex
                          cached={libraryCachedIds.has(s.id)}
                          isActive={currentSong?.id === s.id}
                          isPlaying={currentSong?.id === s.id && isPlaying}
                          onClick={() => { if (currentSong?.id === s.id) togglePlay(); else { setQueue(recentMusic); play(s); } }}
                          onSwipeRight={() => toggleLike(s)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── LIKED ── */}
            {tab === "liked" && (
              <div>
                {filterFullStreams(likedSongs).length === 0 ? (
                  <EmptyState icon={Heart} title="Pas encore de favoris" subtitle="Likez des morceaux pour les retrouver ici" />
                ) : (
                  <>
                    <ActionButtons
                      onPlayAll={() => { const full = filterFullStreams(likedSongs); setQueue(full); play(full[0]); }}
                      onShuffle={() => { const s = filterFullStreams([...likedSongs]).sort(() => Math.random() - 0.5); setQueue(s); play(s[0]); }}
                    />
                    <p className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wider mb-2 px-1">
                      {filterFullStreams(likedSongs).length} titre{filterFullStreams(likedSongs).length > 1 ? "s" : ""}
                    </p>
                    <div className="rounded-2xl liquid-glass overflow-hidden">
                      {filterFullStreams(likedSongs).map((s, i) => (
                        <PremiumSongRow
                          key={s.id}
                          song={s}
                          index={i}
                          showIndex
                          cached={libraryCachedIds.has(s.id)}
                          isActive={currentSong?.id === s.id}
                          isPlaying={currentSong?.id === s.id && isPlaying}
                          onClick={() => { if (currentSong?.id === s.id) togglePlay(); else { setQueue(filterFullStreams(likedSongs)); play(s); } }}
                          onSwipeLeft={() => toggleLike(s)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── PLAYLISTS ── */}
            {tab === "playlists" && (
              <div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowCreate(!showCreate)}
                  className="flex items-center gap-2.5 mb-4 px-4 py-3 rounded-2xl liquid-glass text-foreground text-sm font-medium transition-all w-full"
                >
                  <div className="p-1.5 rounded-xl bg-primary/15">
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                  Nouvelle Playlist
                </motion.button>

                <AnimatePresence>
                  {showCreate && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex gap-2 mb-4 overflow-hidden"
                    >
                      <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                        placeholder="Nom de la playlist..."
                        className="flex-1 px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        autoFocus
                      />
                      <button onClick={handleCreate} className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold">Créer</button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {playlists.length === 0 ? (
                  <EmptyState icon={ListMusic} title="Pas encore de playlists" subtitle="Créez votre première playlist ci-dessus" />
                ) : (
                  <div className="space-y-2.5">
                    {playlists.map((p, idx) => {
                      const pSongs = playlistSongs[p.id] || [];
                      const cachedCount = playlistCachedCounts[p.id] || 0;
                      const coverImg = p.cover_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop";
                      const songCovers = !p.cover_url && pSongs.length >= 4
                        ? pSongs.slice(0, 4).map((s) => s.coverUrl).filter(Boolean)
                        : null;

                      return (
                        <motion.div
                          key={p.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="group relative"
                        >
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate(`/playlist/${p.id}`)}
                            className="w-full flex items-center gap-4 p-3.5 rounded-2xl liquid-glass transition-all"
                          >
                            {/* Cover */}
                            <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-lg shrink-0">
                              {songCovers && songCovers.length >= 4 ? (
                                <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                                  {songCovers.map((url, ci) => (
                                    <img key={ci} src={url} alt="" className="w-full h-full object-cover" />
                                  ))}
                                </div>
                              ) : (
                                <img src={coverImg} alt={p.name} className="w-full h-full object-cover" />
                              )}
                              {cachedCount > 0 && (
                                <div className={`absolute bottom-0.5 right-0.5 flex items-center justify-center rounded-full shadow-md ${
                                  cachedCount === pSongs.length && pSongs.length > 0
                                    ? "w-5 h-5 bg-primary"
                                    : "w-5 h-5 bg-primary/80"
                                }`}>
                                  <Download className="w-2.5 h-2.5 text-primary-foreground" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1 text-left">
                              <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                                {pSongs.length} titre{pSongs.length !== 1 ? "s" : ""}
                                {cachedCount > 0 && <span className="text-primary"> · {cachedCount} hors-ligne</span>}
                              </p>
                            </div>

                            <ChevronRight className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
                          </motion.button>

                          <button
                            onClick={() => deletePlaylist(p.id)}
                            className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Shared playlists from admin */}
                {sharedPlaylists.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <ListMusic className="w-4 h-4 text-primary" />
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Playlists partagées
                      </h3>
                    </div>
                    <div className="space-y-2.5">
                      {sharedPlaylists.map((sp: any, idx: number) => {
                        const spSongs = sharedPlaylistSongsMap[sp.id] || [];
                        const coverImg = sp.cover_url || (spSongs[0]?.coverUrl) || "";
                        return (
                          <motion.div
                            key={sp.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.04 }}
                          >
                            <motion.button
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                if (spSongs.length > 0) {
                                  setQueue(spSongs);
                                  play(spSongs[0]);
                                }
                              }}
                              className="w-full flex items-center gap-4 p-3.5 rounded-2xl liquid-glass transition-all"
                            >
                              <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-lg shrink-0">
                                {coverImg ? (
                                  <img src={coverImg} alt={sp.playlist_name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                    <ListMusic className="w-6 h-6 text-primary/30" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 text-left">
                                <p className="text-sm font-semibold text-foreground truncate">{sp.playlist_name}</p>
                                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                                  {spSongs.length} titre{spSongs.length !== 1 ? "s" : ""} · Partagée par l'admin
                                </p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
                            </motion.button>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── CUSTOM ── */}
            {tab === "custom" && (
              <div>
                {customSongs.length === 0 ? (
                  <EmptyState icon={Music} title="Aucun titre ajouté" subtitle="Les titres ajoutés par l'admin apparaissent ici" />
                ) : (
                  <>
                    {/* Sort + Select toggle */}
                    <div className="relative flex items-center justify-between px-1 mb-3">
                      <p className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wider">
                        {selectMode ? `${selectedIds.size} sélectionné${selectedIds.size > 1 ? "s" : ""}` : `${customSongs.length} titre${customSongs.length > 1 ? "s" : ""}`}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            selectMode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground liquid-glass"
                          }`}
                        >
                          {selectMode ? <X className="w-3 h-3" /> : <CheckSquare className="w-3 h-3" />}
                          {selectMode ? "Annuler" : "Sélectionner"}
                        </button>
                        {!selectMode && (
                          <button
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground liquid-glass transition-colors"
                          >
                            <ArrowUpDown className="w-3 h-3" />
                            {customSort === "recent" ? "Récent" : customSort === "alpha" ? "A→Z" : customSort === "artist" ? "Artiste" : "Durée"}
                          </button>
                        )}
                      </div>
                      <AnimatePresence>
                        {showSortMenu && !selectMode && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            className="absolute right-0 top-8 z-20 bg-card border border-border rounded-2xl shadow-xl py-1.5 min-w-[150px] overflow-hidden"
                          >
                            {([
                              { key: "recent" as SortOption, label: "Plus récent" },
                              { key: "alpha" as SortOption, label: "Titre A→Z" },
                              { key: "artist" as SortOption, label: "Artiste A→Z" },
                              { key: "duration" as SortOption, label: "Durée" },
                            ]).map((opt) => (
                              <button
                                key={opt.key}
                                onClick={() => { setCustomSort(opt.key); setShowSortMenu(false); }}
                                className={`w-full text-left px-4 py-2.5 text-xs transition-colors ${
                                  customSort === opt.key ? "text-primary font-semibold bg-primary/5" : "text-foreground hover:bg-secondary"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Select all / actions bar */}
                    <AnimatePresence>
                      {selectMode && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mb-3"
                        >
                          <div className="flex items-center gap-2 px-1">
                            <button
                              onClick={() => {
                                if (selectedIds.size === sortedCustomSongs.length) setSelectedIds(new Set());
                                else setSelectedIds(new Set(sortedCustomSongs.map((s) => s.id)));
                              }}
                              className="px-3 py-1.5 rounded-full text-xs font-medium liquid-glass text-foreground"
                            >
                              {selectedIds.size === sortedCustomSongs.length ? "Tout désélectionner" : "Tout sélectionner"}
                            </button>
                            {selectedIds.size > 0 && (
                              <>
                                <button
                                  onClick={() => {
                                    const sel = sortedCustomSongs.filter((s) => selectedIds.has(s.id));
                                    setQueue(sel); play(sel[0]);
                                    setSelectMode(false); setSelectedIds(new Set());
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/25"
                                >
                                  <Play className="w-3 h-3" /> Lire
                                </button>
                                <button
                                  onClick={() => {
                                    const sel = sortedCustomSongs.filter((s) => selectedIds.has(s.id));
                                    sel.forEach((s) => toggleLike(s));
                                    toast.success(`${sel.length} titre${sel.length > 1 ? "s" : ""} ajouté${sel.length > 1 ? "s" : ""} aux favoris`);
                                    setSelectMode(false); setSelectedIds(new Set());
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full liquid-glass text-foreground text-xs font-medium"
                                >
                                  <Heart className="w-3 h-3" /> Favoris
                                </button>
                                <button
                                  onClick={() => {
                                    const sel = sortedCustomSongs.filter((s) => selectedIds.has(s.id));
                                    const current = usePlayerStore.getState().queue;
                                    setQueue([...current, ...sel]);
                                    toast.success(`${sel.length} titre${sel.length > 1 ? "s" : ""} ajouté${sel.length > 1 ? "s" : ""} à la file`);
                                    setSelectMode(false); setSelectedIds(new Set());
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full liquid-glass text-foreground text-xs font-medium"
                                >
                                  <ListPlus className="w-3 h-3" /> File
                                </button>
                                <div className="relative">
                                  <button
                                    onClick={() => setShowPlaylistPicker(!showPlaylistPicker)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-full liquid-glass text-foreground text-xs font-medium"
                                  >
                                    <ListMusic className="w-3 h-3" /> Playlist
                                  </button>
                                  <AnimatePresence>
                                    {showPlaylistPicker && (
                                      <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 4 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 4 }}
                                        className="absolute left-0 bottom-full mb-1 z-50 w-56 rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="p-2 border-b border-border">
                                          <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Ajouter {selectedIds.size} titre{selectedIds.size > 1 ? "s" : ""} à</p>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto p-1">
                                          {playlists.length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-4">Aucune playlist</p>
                                          ) : (
                                            playlists.map((p) => (
                                              <button
                                                key={p.id}
                                                onClick={async () => {
                                                  const sel = sortedCustomSongs.filter((s) => selectedIds.has(s.id));
                                                  const existing = playlistSongs[p.id] || [];
                                                  let added = 0;
                                                  for (const s of sel) {
                                                    if (!existing.some((e) => e.id === s.id)) {
                                                      await addSongToPlaylist(p.id, s);
                                                      added++;
                                                    }
                                                  }
                                                  toast.success(`${added} titre${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""} à "${p.name}"`);
                                                  setShowPlaylistPicker(false);
                                                  setSelectMode(false); setSelectedIds(new Set());
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-accent transition-colors"
                                              >
                                                <ListMusic className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                                <span className="flex-1 truncate text-foreground">{p.name}</span>
                                              </button>
                                            ))
                                          )}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="rounded-2xl liquid-glass overflow-hidden">
                      {sortedCustomSongs.map((s, i) => (
                        <PremiumSongRow
                          key={s.id}
                          song={s}
                          index={i}
                          cached={libraryCachedIds.has(s.id)}
                          showIndex={!selectMode}
                          selectable={selectMode}
                          selected={selectedIds.has(s.id)}
                          onSelect={() => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                              return next;
                            });
                          }}
                          isActive={currentSong?.id === s.id}
                          isPlaying={currentSong?.id === s.id && isPlaying}
                          onClick={() => { setQueue(sortedCustomSongs); play(s); }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── DOWNLOADS ── */}
            {tab === "downloads" && (
              <div>
                {cacheSize > 0 && (
                  <div className="rounded-2xl liquid-glass p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10">
                          <HardDrive className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {cachedSongs.length} titre{cachedSongs.length > 1 ? "s" : ""} hors-ligne
                          </p>
                          <p className="text-[11px] text-muted-foreground/60">
                            {formatSize(cacheSize)} utilisé{cachedSongs.length > 0 ? ` · ~${formatSize(Math.round(cacheSize / cachedSongs.length))}/titre` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={isRedownloading}
                          onClick={async () => {
                            setIsRedownloading(true);
                            setRedownloadProgress({ current: 0, total: cachedSongs.length });
                            try {
                              for (let i = 0; i < cachedSongs.length; i++) {
                                setRedownloadProgress({ current: i + 1, total: cachedSongs.length });
                                try { await offlineCache.cacheSong(cachedSongs[i]); } catch (e) { console.error("Re-download failed:", e); }
                              }
                              const [songs, size] = await Promise.all([offlineCache.getAllCached(), offlineCache.getCacheSize()]);
                              setCachedSongs(songs);
                              setCacheSize(size);
                            } finally { setIsRedownloading(false); }
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium disabled:opacity-50"
                        >
                          {isRedownloading ? (
                            <><Loader2 className="w-3 h-3 animate-spin" />{redownloadProgress.current}/{redownloadProgress.total}</>
                          ) : (
                            <><RefreshCw className="w-3 h-3" />Rafraîchir</>
                          )}
                        </button>
                        <button
                          onClick={async () => {
                            for (const s of cachedSongs) await offlineCache.removeCached(s.id);
                            setCachedSongs([]);
                            setCacheSize(0);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-destructive/10 text-destructive text-[11px] font-medium"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        className="bg-primary rounded-full h-1.5"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((cacheSize / (500 * 1024 * 1024)) * 100, 100)}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground/40 mt-1.5 text-right">{formatSize(cacheSize)} / 500 Mo</p>
                  </div>
                )}

                {cachedSongs.length === 0 ? (
                  <EmptyState icon={Download} title="Aucun morceau téléchargé" subtitle="Téléchargez des morceaux pour les écouter hors-ligne" />
                ) : (
                  <>
                    <ActionButtons
                      onPlayAll={() => { setQueue(cachedSongs); play(cachedSongs[0]); }}
                      onShuffle={() => { const s = [...cachedSongs].sort(() => Math.random() - 0.5); setQueue(s); play(s[0]); }}
                    />
                    <div className="rounded-2xl liquid-glass overflow-hidden">
                      {cachedSongs.map((s, i) => (
                        <PremiumSongRow
                          key={s.id}
                          song={s}
                          index={i}
                          cached
                          isActive={currentSong?.id === s.id}
                          isPlaying={currentSong?.id === s.id && isPlaying}
                          onClick={() => { setQueue(cachedSongs); play(s); }}
                          onSwipeLeft={() => removeCached(s.id)}
                        />
                      ))}
                    </div>
                  </>
                )}

                {isGuest && (
                  <div className="mt-8 p-5 rounded-2xl liquid-glass text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      Connectez-vous pour accéder à vos playlists et favoris
                    </p>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate("/auth")}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/30"
                    >
                      <LogIn className="w-4 h-4" />
                      Se connecter
                    </motion.button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default LibraryPage;
