import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { Play, ListPlus, ListMusic, Plus, Check, ChevronRight } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { usePlayerStore } from "@/stores/playerStore";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Song } from "@/data/mockData";

interface SectionProps {
  title: string;
  children: ReactNode;
  songs?: Song[];
  onPlayAll?: () => void;
  viewAllLink?: string;
}

function AddAllToPlaylistMenu({ songs, onClose }: { songs: Song[]; onClose: () => void }) {
  const { playlists, playlistSongs, addSongToPlaylist, createPlaylist } = usePlayerStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const handleAdd = async (playlistId: string, playlistName: string) => {
    let added = 0;
    const existing = playlistSongs[playlistId] || [];
    for (const song of songs) {
      if (!existing.some((s) => s.id === song.id)) {
        await addSongToPlaylist(playlistId, song);
        added++;
      }
    }
    toast.success(`${added} titre${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""} à "${playlistName}"`);
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
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Ajouter {songs.length} titres à</p>
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        {playlists.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Aucune playlist</p>
        ) : (
          playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => handleAdd(p.id, p.name)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-accent transition-colors"
            >
              <ListMusic className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 truncate text-foreground">{p.name}</span>
            </button>
          ))
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

export function Section({ title, children, songs, onPlayAll }: SectionProps) {
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const hasSongs = songs && songs.length > 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="mb-8"
    >
      <motion.div
        initial={{ opacity: 0, x: -16 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        className="flex items-center justify-between px-4 md:px-8 mb-3"
      >
        <h2 className="text-lg md:text-xl font-display font-bold text-foreground truncate mr-2">{title}</h2>
        {hasSongs && (
          <div className="flex items-center gap-1.5 relative flex-shrink-0">
            {onPlayAll && (
              <button
                onClick={onPlayAll}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
              >
                <Play className="w-3 h-3" />
                <span className="hidden sm:inline">Tout lire</span>
              </button>
            )}
            <button
              onClick={() => setShowPlaylistPicker(!showPlaylistPicker)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium transition-colors"
            >
              <ListPlus className="w-3 h-3" />
            </button>
            <AnimatePresence>
              {showPlaylistPicker && songs && (
                <AddAllToPlaylistMenu
                  songs={songs}
                  onClose={() => setShowPlaylistPicker(false)}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        {children}
      </motion.div>
    </motion.section>
  );
}
