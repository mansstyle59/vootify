import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { useAuth } from "@/hooks/useAuth";
import { SongCard, ContentCard } from "@/components/MusicCards";
import { Heart, ListMusic, Clock, Plus, Trash2, Play, Pause, Download, HardDrive, Trash, Music, Shuffle, LogIn } from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import { offlineCache } from "@/lib/offlineCache";
import { Song } from "@/data/mockData";

type Tab = "liked" | "playlists" | "recent" | "downloads" | "custom";

const filterFullStreams = (songs: Song[]) =>
  songs.filter((s) => !s.streamUrl?.includes("dzcdn.net"));

const LibraryPage = () => {
  const [tab, setTab] = useState<Tab>("recent");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { likedSongs, playlists, recentlyPlayed, playlistSongs, createPlaylist, deletePlaylist, play, setQueue, loadPlaylistSongs, currentSong, isPlaying, togglePlay } = usePlayerStore();

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
      return (data || []).map((s: any): Song => ({
        id: `custom-${s.id}`,
        title: s.title,
        artist: s.artist,
        album: s.album || "",
        duration: s.duration,
        coverUrl: s.cover_url || "",
        streamUrl: s.stream_url || "",
        liked: false,
      }));
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

  // Auth gate — all hooks are above
  if (!authLoading && !user) {
    return (
      <div className="p-4 md:p-8 pb-40 max-w-7xl mx-auto" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-1">Votre Bibliothèque</h1>
        <p className="text-sm text-muted-foreground mb-8">Connectez-vous pour accéder à votre bibliothèque privée</p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <LogIn className="w-9 h-9 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Connexion requise</h2>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            Vos morceaux aimés, playlists et historique sont sauvegardés sur votre compte.
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium shadow-md shadow-primary/25 hover:brightness-110 transition-all"
          >
            <LogIn className="w-4 h-4" />
            Se connecter
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-40 max-w-7xl mx-auto" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
      <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-1">Votre Bibliothèque</h1>
      <p className="text-sm text-muted-foreground mb-5">Vos morceaux, playlists et stations sauvegardés</p>

      <div className="flex gap-1.5 mb-5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
        {tabs.map(({ key, label, icon: Icon }) => (
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
              {likedSongs.length === 0 ? (
                <div className="glass-panel-light rounded-xl p-2">
                  <p className="text-center text-muted-foreground py-12">Pas encore de titres aimés. Likez des chansons en naviguant !</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => { setQueue(likedSongs); play(likedSongs[0]); }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-md shadow-primary/25 hover:brightness-110 transition-all"
                    >
                      <Play className="w-4 h-4" />
                      Tout lire
                    </button>
                    <button
                      onClick={() => {
                        const shuffled = [...likedSongs].sort(() => Math.random() - 0.5);
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
                    {likedSongs.map((s, i) => <SongCard key={s.id} song={s} index={i} showIndex />)}
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
                customSongs.map((s, i) => (
                  <div key={s.id} onClick={() => { setQueue(customSongs); play(s); }}>
                    <SongCard song={s} index={i} showIndex />
                  </div>
                ))
              )}
            </div>
          )}




          {tab === "downloads" && (
            <div>
              {cacheSize > 0 && (
                <div className="flex items-center gap-2 mb-4 px-1">
                  <HardDrive className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {cachedSongs.length} titre{cachedSongs.length > 1 ? "s" : ""} · {formatSize(cacheSize)}
                  </span>
                </div>
              )}
              {cachedSongs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Download className="w-14 h-14 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">Aucun morceau téléchargé.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Téléchargez des morceaux pour les écouter hors-ligne</p>
                </div>
              ) : (
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
              )}
            </div>
          )}

          {tab === "recent" && (
            <div>
              {recentlyPlayed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Clock className="w-14 h-14 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">Rien d'écouté récemment.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Vos morceaux écoutés apparaîtront ici</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => { setQueue(recentlyPlayed); play(recentlyPlayed[0]); }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-md shadow-primary/25 hover:brightness-110 transition-all"
                    >
                      <Play className="w-4 h-4" />
                      Tout lire
                    </button>
                    <button
                      onClick={() => {
                        const shuffled = [...recentlyPlayed].sort(() => Math.random() - 0.5);
                        setQueue(shuffled);
                        play(shuffled[0]);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-all"
                    >
                      <Shuffle className="w-4 h-4" />
                      Aléatoire
                    </button>
                    <span className="ml-auto flex items-center text-xs text-muted-foreground">
                      {recentlyPlayed.length} titre{recentlyPlayed.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="glass-panel-light rounded-xl p-2">
                    {recentlyPlayed
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
