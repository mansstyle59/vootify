import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { useAuth } from "@/hooks/useAuth";
import { SongCard, ContentCard } from "@/components/MusicCards";
import { Heart, ListMusic, Clock, Plus, Trash2, Play, Pause, Download, HardDrive, Trash, Music, Shuffle, LogIn, WifiOff, ArrowUpDown, RefreshCw, Loader2 } from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import { offlineCache } from "@/lib/offlineCache";
import { Song } from "@/data/mockData";

type Tab = "liked" | "playlists" | "recent" | "downloads" | "custom";
type SortOption = "recent" | "alpha" | "artist" | "duration";

const filterFullStreams = (songs: Song[]) =>
  songs.filter((s) => s.streamUrl && !s.streamUrl.includes("dzcdn.net") && !s.streamUrl.includes("cdn-preview"));

const LibraryPage = () => {
  const [tab, setTab] = useState<Tab>("recent");
  const [customSort, setCustomSort] = useState<SortOption>("recent");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { likedSongs, playlists, recentlyPlayed, playlistSongs, createPlaylist, deletePlaylist, play, setQueue, loadPlaylistSongs, currentSong, isPlaying, togglePlay, clearRecentlyPlayed, loadUserData, userId } = usePlayerStore();
  const queryClient = useQueryClient();

  // Track online/offline status
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  // Refresh data when app returns to foreground
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

  const [playlistCachedCounts, setPlaylistCachedCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (tab === "playlists") {
      playlists.forEach((p) => {
        if (!playlistSongs[p.id]) loadPlaylistSongs(p.id);
      });
    }
  }, [tab, playlists]);

  useEffect(() => {
    if (tab !== "playlists") return;
    const countCached = async () => {
      const counts: Record<string, number> = {};
      for (const p of playlists) {
        const songs = playlistSongs[p.id] || [];
        let count = 0;
        for (const s of songs) {
          if (await offlineCache.isCached(s.id)) count++;
        }
        counts[p.id] = count;
      }
      setPlaylistCachedCounts(counts);
    };
    countCached();
  }, [tab, playlists, playlistSongs]);


  const { data: customSongs = [] } = useQuery({
    queryKey: ["custom-songs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_songs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const songs = (data || []).map((s: any): Song & { _dbId: string } => ({
        _dbId: s.id,
        id: `custom-${s.id}`,
        title: s.title,
        artist: s.artist,
        album: s.album || "",
        duration: s.duration,
        coverUrl: s.cover_url || "",
        streamUrl: s.stream_url || "",
        liked: false,
      }));

      // Auto-fix missing durations in background
      const toFix = songs.filter((s) => !s.duration && s.streamUrl);
      if (toFix.length > 0) {
        Promise.all(
          toFix.map((s) =>
            new Promise<void>((resolve) => {
              const audio = new Audio();
              audio.preload = "metadata";
              audio.src = s.streamUrl;
              audio.addEventListener("loadedmetadata", () => {
                const dur = audio.duration && isFinite(audio.duration) ? Math.round(audio.duration) : 0;
                if (dur > 0) {
                  s.duration = dur;
                  supabase.from("custom_songs").update({ duration: dur }).eq("id", s._dbId).then(() => {});
                }
                resolve();
              }, { once: true });
              audio.addEventListener("error", () => resolve(), { once: true });
              setTimeout(() => resolve(), 5000);
            })
          )
        ).then(() => {
          queryClient.invalidateQueries({ queryKey: ["custom-songs"] });
        });
      }

      return songs as Song[];
    },
    staleTime: 60 * 1000,
    enabled: tab === "custom" && !!user,
  });

  const [cachedSongs, setCachedSongs] = useState<(Song & { cachedAt: number })[]>([]);
  const [cacheSize, setCacheSize] = useState(0);

  useEffect(() => {
    if (tab !== "downloads") return;
    const load = async () => {
      const [songs, size] = await Promise.all([
        offlineCache.getAllCached(),
        offlineCache.getCacheSize(),
      ]);
      setCachedSongs(songs);
      setCacheSize(size);
    };
    load();
  }, [tab]);

  const sortedCustomSongs = useMemo(() => {
    const arr = [...customSongs];
    switch (customSort) {
      case "alpha": return arr.sort((a, b) => a.title.localeCompare(b.title, "fr"));
      case "artist": return arr.sort((a, b) => a.artist.localeCompare(b.artist, "fr"));
      case "duration": return arr.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      default: return arr; // already sorted by recent from query
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
    if (newName.trim()) {
      createPlaylist(newName.trim());
      setNewName("");
      setShowCreate(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "recent", label: "Récents", icon: Clock },
    { key: "liked", label: "Aimés", icon: Heart },
    { key: "playlists", label: "Playlists", icon: ListMusic },
    { key: "custom", label: "Mes titres", icon: Music },
    { key: "downloads", label: "Téléchargés", icon: Download },
  ];

  // Auth gate — show only downloads tab when not logged in OR offline
  const isGuest = !authLoading && !user;
  const offlineMode = isOffline || isGuest;

  // Auto-switch to downloads tab when offline or guest
  useEffect(() => {
    if (offlineMode && tab !== "downloads") {
      setTab("downloads");
    }
  }, [offlineMode]);

  // Also load cached songs immediately when going offline
  useEffect(() => {
    if (isOffline) {
      const load = async () => {
        const [songs, size] = await Promise.all([
          offlineCache.getAllCached(),
          offlineCache.getCacheSize(),
        ]);
        setCachedSongs(songs);
        setCacheSize(size);
      };
      load();
    }
  }, [isOffline]);

  const visibleTabs = offlineMode
    ? tabs.filter((t) => t.key === "downloads")
    : tabs;

  return (
    <div className="p-4 md:p-8 pb-40 max-w-7xl mx-auto" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
      {isOffline && (
        <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-400 font-medium">Mode hors-ligne — seuls les morceaux téléchargés sont disponibles</p>
        </div>
      )}
      <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-1">
        {isOffline ? "Mode Hors-ligne" : "Votre Bibliothèque"}
      </h1>
      <p className="text-sm text-muted-foreground mb-5">
        {isOffline ? "Écoutez vos morceaux téléchargés sans connexion" : offlineMode ? "Vos morceaux téléchargés sont disponibles hors-ligne" : "Vos morceaux, playlists et stations sauvegardés"}
      </p>

      <div className="flex gap-1.5 mb-5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
        {visibleTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              tab === key
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                : "bg-secondary/80 text-secondary-foreground hover:bg-secondary"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "liked" && (
            <div>
              {filterFullStreams(likedSongs).length === 0 ? (
                <div className="glass-panel-light rounded-xl p-2">
                  <p className="text-center text-muted-foreground py-12">Pas encore de titres aimés. Likez des chansons en naviguant !</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => { const full = filterFullStreams(likedSongs); setQueue(full); play(full[0]); }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-md shadow-primary/25 hover:brightness-110 transition-all"
                    >
                      <Play className="w-4 h-4" />
                      Tout lire
                    </button>
                    <button
                      onClick={() => {
                        const shuffled = filterFullStreams([...likedSongs]).sort(() => Math.random() - 0.5);
                        setQueue(shuffled);
                        play(shuffled[0]);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-all"
                    >
                      <Shuffle className="w-4 h-4" />
                      Aléatoire
                    </button>
                  </div>
                  <div className="glass-panel-light rounded-xl p-2">
                    {filterFullStreams(likedSongs).map((s, i) => <SongCard key={s.id} song={s} index={i} showIndex />)}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "playlists" && (
            <div>
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="flex items-center gap-2 mb-4 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm"
              >
                <Plus className="w-4 h-4" /> Nouvelle Playlist
              </button>
              {showCreate && (
                <div className="flex gap-2 mb-4">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    placeholder="Nom de la playlist..."
                    className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                  <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Créer</button>
                </div>
              )}
              {playlists.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">Pas encore de playlists</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {playlists.map((p) => (
                    <div key={p.id} className="relative group">
                      <ContentCard
                        title={p.name}
                        subtitle={`${(playlistSongs[p.id] || []).length} titres${playlistCachedCounts[p.id] ? ` · ${playlistCachedCounts[p.id]} ⬇` : ""}`}
                        imageUrl={p.cover_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop"}
                        onClick={() => navigate(`/playlist/${p.id}`)}
                      />
                      <button
                        onClick={() => deletePlaylist(p.id)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "custom" && (
            <div className="glass-panel-light rounded-xl p-2">
              {customSongs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Music className="w-14 h-14 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">Aucun titre ajouté.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Les titres ajoutés par l'admin apparaissent ici</p>
                </div>
              ) : (
                <>
                  {/* Sort menu */}
                  <div className="relative flex items-center justify-between px-2 py-1.5 mb-1">
                    <span className="text-xs text-muted-foreground">{customSongs.length} titre{customSongs.length > 1 ? "s" : ""}</span>
                    <button
                      onClick={() => setShowSortMenu(!showSortMenu)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                      {customSort === "recent" ? "Récent" : customSort === "alpha" ? "A→Z" : customSort === "artist" ? "Artiste" : "Durée"}
                    </button>
                    {showSortMenu && (
                      <div className="absolute right-2 top-8 z-20 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[140px]">
                        {([
                          { key: "recent" as SortOption, label: "Plus récent" },
                          { key: "alpha" as SortOption, label: "Titre A→Z" },
                          { key: "artist" as SortOption, label: "Artiste A→Z" },
                          { key: "duration" as SortOption, label: "Durée" },
                        ]).map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => { setCustomSort(opt.key); setShowSortMenu(false); }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                              customSort === opt.key ? "text-primary font-semibold bg-primary/5" : "text-foreground hover:bg-secondary"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {sortedCustomSongs.map((s, i) => (
                    <div key={s.id} onClick={() => { setQueue(sortedCustomSongs); play(s); }}>
                      <SongCard song={s} index={i} showIndex />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}




          {tab === "downloads" && (
            <div>
              {cacheSize > 0 && (
                <div className="glass-panel-light rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-primary/10">
                        <HardDrive className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {cachedSongs.length} titre{cachedSongs.length > 1 ? "s" : ""} hors-ligne
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(cacheSize)} utilisé{cachedSongs.length > 0 ? ` · ~${formatSize(Math.round(cacheSize / cachedSongs.length))}/titre` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        for (const s of cachedSongs) await offlineCache.removeCached(s.id);
                        setCachedSongs([]);
                        setCacheSize(0);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Tout supprimer
                    </button>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5">
                    <div
                      className="bg-primary rounded-full h-1.5 transition-all"
                      style={{ width: `${Math.min((cacheSize / (500 * 1024 * 1024)) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 mt-1 text-right">{formatSize(cacheSize)} / 500 Mo</p>
                </div>
              )}
              {cachedSongs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Download className="w-14 h-14 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">Aucun morceau téléchargé.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Téléchargez des morceaux pour les écouter hors-ligne</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => { setQueue(cachedSongs); play(cachedSongs[0]); }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-md shadow-primary/25 hover:brightness-110 transition-all"
                    >
                      <Play className="w-4 h-4" />
                      Tout lire
                    </button>
                    <button
                      onClick={() => {
                        const shuffled = [...cachedSongs].sort(() => Math.random() - 0.5);
                        setQueue(shuffled);
                        play(shuffled[0]);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-all"
                    >
                      <Shuffle className="w-4 h-4" />
                      Aléatoire
                    </button>
                  </div>
                  <div className="glass-panel-light rounded-xl p-2">
                    {cachedSongs.map((s, i) => (
                      <div key={s.id} className="flex items-center group">
                        <div className="flex-1 min-w-0" onClick={() => { setQueue(cachedSongs); play(s); }}>
                          <SongCard song={s} index={i} />
                        </div>
                        <button
                          onClick={() => removeCached(s.id)}
                          className="p-2 mr-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          title="Supprimer du cache"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {isGuest && (
                <div className="mt-6 p-4 rounded-xl bg-secondary/50 text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    Connectez-vous pour accéder à vos playlists, morceaux aimés et historique
                  </p>
                  <button
                    onClick={() => navigate("/auth")}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-medium text-sm shadow-md shadow-primary/25 hover:brightness-110 transition-all"
                  >
                    <LogIn className="w-4 h-4" />
                    Se connecter
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "recent" && (
            <div>
              {filterFullStreams(recentlyPlayed).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Clock className="w-14 h-14 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">Rien d'écouté récemment.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Vos morceaux écoutés apparaîtront ici</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => { const full = filterFullStreams(recentlyPlayed); setQueue(full); play(full[0]); }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-md shadow-primary/25 hover:brightness-110 transition-all"
                    >
                      <Play className="w-4 h-4" />
                      Tout lire
                    </button>
                    <button
                      onClick={() => {
                        const shuffled = filterFullStreams([...recentlyPlayed]).sort(() => Math.random() - 0.5);
                        setQueue(shuffled);
                        play(shuffled[0]);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-all"
                    >
                      <Shuffle className="w-4 h-4" />
                      Aléatoire
                    </button>
                    <button
                      onClick={() => clearRecentlyPlayed()}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Vider
                    </button>
                    <span className="ml-auto flex items-center text-xs text-muted-foreground">
                      {filterFullStreams(recentlyPlayed).length} titre{filterFullStreams(recentlyPlayed).length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="glass-panel-light rounded-xl p-2">
                    {filterFullStreams(recentlyPlayed)
                      .filter((song, i, arr) => arr.findIndex((s) => s.id === song.id) === i)
                      .map((s, i) => <SongCard key={`${s.id}-${i}`} song={s} index={i} showIndex />)}
                  </div>
                </>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default LibraryPage;
