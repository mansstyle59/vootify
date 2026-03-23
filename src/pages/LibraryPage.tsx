import { useState, useEffect } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import { SongCard, ContentCard } from "@/components/MusicCards";
import { Heart, ListMusic, Clock, Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "liked" | "playlists" | "recent";

const LibraryPage = () => {
  const [tab, setTab] = useState<Tab>("liked");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const { likedSongs, playlists, recentlyPlayed, playlistSongs, createPlaylist, deletePlaylist, play, setQueue, loadPlaylistSongs } = usePlayerStore();

  useEffect(() => {
    if (tab === "playlists") {
      playlists.forEach((p) => {
        if (!playlistSongs[p.id]) loadPlaylistSongs(p.id);
      });
    }
  }, [tab, playlists]);

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "liked", label: "Aimés", icon: Heart },
    { key: "playlists", label: "Playlists", icon: ListMusic },
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
                    placeholder="Playlist name..."
                    className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                  <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Create</button>
                </div>
              )}
              {playlists.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No playlists yet</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {playlists.map((p) => (
                    <div key={p.id} className="relative group">
                      <ContentCard
                        title={p.name}
                        subtitle={`${(playlistSongs[p.id] || []).length} songs`}
                        imageUrl={p.cover_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop"}
                        onClick={() => {
                          const pSongs = playlistSongs[p.id] || [];
                          if (pSongs.length) { setQueue(pSongs); play(pSongs[0]); }
                        }}
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

          {tab === "recent" && (
            <div className="glass-panel-light rounded-xl p-2">
              {recentlyPlayed.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">Play something to see it here</p>
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
