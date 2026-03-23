import { useState } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import { Song } from "@/data/mockData";
import { ListMusic, Plus, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface AddToPlaylistMenuProps {
  song: Song;
  onClose: () => void;
}

export function AddToPlaylistMenu({ song, onClose }: AddToPlaylistMenuProps) {
  const { playlists, playlistSongs, addSongToPlaylist, createPlaylist, loadPlaylistSongs } = usePlayerStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const handleAdd = async (playlistId: string, playlistName: string) => {
    const existing = playlistSongs[playlistId] || [];
    if (existing.some((s) => s.id === song.id)) {
      toast.info("Déjà dans cette playlist");
      return;
    }
    await addSongToPlaylist(playlistId, song);
    toast.success(`Ajouté à "${playlistName}"`);
    onClose();
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createPlaylist(newName.trim());
    setNewName("");
    setShowCreate(false);
    toast.success(`Playlist "${newName.trim()}" créée`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 4 }}
      className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-2 border-b border-border">
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Ajouter à une playlist</p>
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        {playlists.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Aucune playlist</p>
        ) : (
          playlists.map((p) => {
            const isInPlaylist = (playlistSongs[p.id] || []).some((s) => s.id === song.id);
            return (
              <button
                key={p.id}
                onClick={() => handleAdd(p.id, p.name)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-accent transition-colors"
              >
                <ListMusic className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 truncate text-foreground">{p.name}</span>
                {isInPlaylist && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>
            );
          })
        )}
      </div>
      <div className="p-1 border-t border-border">
        {showCreate ? (
          <div className="flex gap-1 p-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Nom..."
              className="flex-1 px-2 py-1.5 rounded-md bg-secondary text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
              autoFocus
            />
            <button onClick={handleCreate} className="px-2 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium">OK</button>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors text-foreground"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle playlist</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
