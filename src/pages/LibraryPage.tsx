import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { SongCard, ContentCard } from "@/components/MusicCards";
import { Heart, ListMusic, Clock, Plus, Trash2, Radio, Play, Pause, Download, HardDrive, Trash } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { offlineCache } from "@/lib/offlineCache";
import { Song } from "@/data/mockData";

type Tab = "liked" | "playlists" | "recent" | "radios" | "downloads";

const LibraryPage = () => {
  const [tab, setTab] = useState<Tab>("liked");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const navigate = useNavigate();
  const { likedSongs, playlists, recentlyPlayed, playlistSongs, createPlaylist, deletePlaylist, play, setQueue, loadPlaylistSongs, currentSong, isPlaying, togglePlay } = usePlayerStore();

  useEffect(() => {
    if (tab === "playlists") {
      playlists.forEach((p) => {
        if (!playlistSongs[p.id]) loadPlaylistSongs(p.id);
      });
    }
  }, [tab, playlists]);

  // Saved radio stations
  const { data: savedRadios = [] } = useQuery({
    queryKey: ["custom-radio-stations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_radio_stations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: tab === "radios",
  });

  const playStation = (station: typeof savedRadios[0]) => {
    if (currentSong?.id === station.id) {
      togglePlay();
      return;
    }
    play({
      id: station.id,
      title: station.name,
      artist: station.genre || "Radio",
      album: "Radio en direct",
      duration: 0,
      coverUrl: station.cover_url || "",
      streamUrl: station.stream_url || "",
      liked: false,
    });
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "liked", label: "Aimés", icon: Heart },
    { key: "playlists", label: "Playlists", icon: ListMusic },
    { key: "radios", label: "Radios", icon: Radio },
    { key: "recent", label: "Récents", icon: Clock },
  ];

  const handleCreate = () => {
    if (newName.trim()) {
      createPlaylist(newName.trim());
      setNewName("");
      setShowCreate(false);
    }
  };

  return (
    <div className="p-4 md:p-8 pb-32 max-w-7xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-6">Votre Bibliothèque</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              tab === key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            <Icon className="w-4 h-4" />
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
            <div className="glass-panel-light rounded-xl p-2">
              {likedSongs.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">Pas encore de titres aimés. Likez des chansons en naviguant !</p>
              ) : (
                likedSongs.map((s, i) => <SongCard key={s.id} song={s} index={i} showIndex />)
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
                        subtitle={`${(playlistSongs[p.id] || []).length} titres`}
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

          {tab === "radios" && (
            <div>
              {savedRadios.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Radio className="w-14 h-14 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">Aucune station sauvegardée. Ajoutez-en depuis la page Radio avec le ❤️.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {savedRadios.map((station, i) => (
                    <motion.div
                      key={station.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="glass-panel rounded-xl p-4 hover-glass cursor-pointer group"
                      onClick={() => playStation(station)}
                    >
                      <div className="flex gap-4 items-center">
                        <div className="relative flex-shrink-0">
                          <img
                            src={station.cover_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop"}
                            alt={station.name}
                            className="w-14 h-14 rounded-xl object-cover bg-secondary"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop'; }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-background/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                            {currentSong?.id === station.id && isPlaying ? (
                              <Pause className="w-5 h-5 text-primary" />
                            ) : (
                              <Play className="w-5 h-5 text-primary" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-semibold text-foreground truncate text-sm">{station.name}</h3>
                          <p className="text-xs text-muted-foreground truncate capitalize">{station.genre || "Radio"}</p>
                          <div className="mt-1 flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${currentSong?.id === station.id && isPlaying ? "bg-primary animate-pulse-glow" : "bg-muted-foreground/50"}`} />
                            <span className={`text-[10px] font-medium ${currentSong?.id === station.id && isPlaying ? "text-primary" : "text-muted-foreground"}`}>
                              {currentSong?.id === station.id && isPlaying ? "EN LECTURE" : "LIVE"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "recent" && (
            <div className="glass-panel-light rounded-xl p-2">
              {recentlyPlayed.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">Écoutez quelque chose pour le voir ici</p>
              ) : (
                recentlyPlayed.map((s, i) => <SongCard key={s.id} song={s} index={i} />)
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default LibraryPage;
