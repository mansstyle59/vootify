import { useState, type ReactNode } from "react";
import { Play, ListPlus, ListMusic, Plus, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
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
      className="absolute right-0 top-full mt-1 z-50 w-56 rounded-2xl overflow-hidden"
      style={{
        background: "hsl(var(--card) / 0.92)",
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        border: "1px solid hsl(var(--border) / 0.12)",
        boxShadow: "0 12px 40px hsl(0 0% 0% / 0.3)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-2 border-b" style={{ borderColor: "hsl(var(--border) / 0.08)" }}>
        <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-[0.08em] px-2 py-1">
          Ajouter {songs.length} titres à
        </p>
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        {playlists.length === 0 ? (
          <p className="text-xs text-muted-foreground/30 text-center py-4">Aucune playlist</p>
        ) : (
          playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => handleAdd(p.id, p.name)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-xl transition-colors active:scale-[0.98]"
              style={{ background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--foreground) / 0.04)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <ListMusic className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
              <span className="flex-1 truncate text-foreground text-[12px]">{p.name}</span>
            </button>
          ))
        )}
      </div>
      <div className="p-1" style={{ borderTop: "1px solid hsl(var(--border) / 0.08)" }}>
        {showCreate ? (
          <div className="flex gap-1 p-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Nom..."
              className="flex-1 px-2.5 py-1.5 rounded-xl text-foreground placeholder:text-muted-foreground/30 text-xs focus:outline-none"
              style={{ background: "hsl(var(--foreground) / 0.04)" }}
              autoFocus
            />
            <button onClick={handleCreate} className="px-2.5 py-1.5 rounded-xl text-xs font-bold" style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>OK</button>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] rounded-xl transition-colors text-foreground active:scale-[0.98]"
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
    <section className="mb-7 md:mb-9">
      {/* Separator line — Apple Music style */}
      <div className="px-5 md:px-9 mb-3">
        <div className="h-px" style={{ background: "hsl(var(--foreground) / 0.06)" }} />
      </div>

      {/* Header */}
      <div className="flex items-end justify-between px-5 md:px-9 mb-3">
        <h2 className="text-[22px] md:text-[24px] font-extrabold text-foreground leading-none tracking-tight line-clamp-1 break-words">
          {title}
        </h2>
        <div className="flex items-center gap-1.5 relative flex-shrink-0 ml-3">
          {action}
          {hasSongs && onPlayAll && (
            <button
              onClick={onPlayAll}
              className="flex items-center gap-1 p-1.5 rounded-full text-[11px] font-semibold active:scale-95 transition-transform"
              style={{ background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}
            >
              <Play className="w-3 h-3 fill-current" />
            </button>
          )}
          {hasSongs && (
            <>
              <button
                onClick={() => setShowPlaylistPicker(!showPlaylistPicker)}
                className="flex items-center p-1.5 rounded-full text-muted-foreground/40 active:scale-95 transition-transform"
              >
                <ListPlus className="w-3.5 h-3.5" />
              </button>
              <AnimatePresence>
                {showPlaylistPicker && songs && (
                  <AddAllToPlaylistMenu songs={songs} onClose={() => setShowPlaylistPicker(false)} />
                )}
              </AnimatePresence>
            </>
          )}
          {viewAllLink && (
            <button
              onClick={() => navigate(viewAllLink)}
              className="flex items-center gap-0.5 text-[13px] font-semibold active:opacity-70 transition-opacity"
              style={{ color: "hsl(var(--primary))" }}
            >
              Voir tout
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {children}
    </section>
  );
}
