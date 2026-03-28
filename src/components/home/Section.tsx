import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { Play, ListPlus, ListMusic, Plus, ChevronRight } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { usePlayerStore } from "@/stores/playerStore";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Song } from "@/data/mockData";

export interface SectionProps {
  title: string;
  children: ReactNode;
  songs?: Song[];
  onPlayAll?: () => void;
  viewAllLink?: string;
  action?: ReactNode;
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
      className="absolute right-0 top-full mt-1 z-50 w-56 rounded-2xl border border-border/40 shadow-2xl overflow-hidden"
      style={{
        background: "hsl(var(--card) / 0.92)",
        backdropFilter: "blur(32px) saturate(1.6)",
        WebkitBackdropFilter: "blur(32px) saturate(1.6)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-2 border-b border-border/20">
        <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2 py-1">
          Ajouter {songs.length} titres à
        </p>
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        {playlists.length === 0 ? (
          <p className="text-xs text-muted-foreground/40 text-center py-4">Aucune playlist</p>
        ) : (
          playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => handleAdd(p.id, p.name)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-xl hover:bg-accent/50 transition-colors"
            >
              <ListMusic className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
              <span className="flex-1 truncate text-foreground text-[12px]">{p.name}</span>
            </button>
          ))
        )}
      </div>
      <div className="p-1 border-t border-border/20">
        {showCreate ? (
          <div className="flex gap-1 p-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Nom..."
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-secondary/60 text-foreground placeholder:text-muted-foreground/40 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
              autoFocus
            />
            <button onClick={handleCreate} className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold">OK</button>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] rounded-xl hover:bg-accent/50 transition-colors text-foreground"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle playlist</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function Section({ title, children, songs, onPlayAll, viewAllLink, action }: SectionProps) {
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const navigate = useNavigate();
  const hasSongs = songs && songs.length > 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12px" }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="mb-6 md:mb-7"
    >
      {/* Header */}
      <div className="flex items-center justify-between pl-5 pr-4 md:pl-9 md:pr-8 mb-3">
        <div className="flex items-center gap-2 mr-2 min-w-0">
          <h2 className="text-[15px] md:text-[16px] font-extrabold text-foreground leading-tight line-clamp-1 tracking-tight">
            {title}
          </h2>
          {viewAllLink && (
            <button
              onClick={() => navigate(viewAllLink)}
              className="flex items-center px-1.5 py-0.5 rounded-full text-xs text-primary/70 hover:text-primary hover:bg-primary/8 transition-colors flex-shrink-0"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 relative flex-shrink-0">
          {action}
          {hasSongs && onPlayAll && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onPlayAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span className="hidden sm:inline">Tout lire</span>
            </motion.button>
          )}
          {hasSongs && (
            <>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowPlaylistPicker(!showPlaylistPicker)}
                className="flex items-center px-1.5 py-1.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 text-muted-foreground/60 text-[10px] transition-colors"
              >
                <ListPlus className="w-3.5 h-3.5" />
              </motion.button>
              <AnimatePresence>
                {showPlaylistPicker && songs && (
                  <AddAllToPlaylistMenu songs={songs} onClose={() => setShowPlaylistPicker(false)} />
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
      {children}
    </motion.section>
  );
}
