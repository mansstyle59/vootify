import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { X, GripVertical, Eye, EyeOff, RotateCcw, Plus, Search, Loader2, Trash2, Music, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { deezerApi } from "@/lib/deezerApi";
import { supabase } from "@/integrations/supabase/client";

const EMOJI_PALETTE = [
  "🔥", "💫", "❤️", "💖", "⭐", "🌙", "🌍", "🏆", "🎵", "🎶",
  "🎤", "🎧", "🎸", "🥁", "🎹", "🎺", "🎷", "🎻", "🪗", "🎼",
  "✨", "💎", "👑", "🦋", "🌈", "☀️", "☁️", "🌊", "🍀", "🌸",
  "😎", "🤩", "🥳", "💃", "🕺", "🙌", "💪", "🚀", "⚡", "🪩",
];

export interface HomeSection {
  id: string;
  label: string;
  emoji: string;
  visible: boolean;
  /** For custom Deezer playlists */
  deezerPlaylistId?: string;
}

export const DEFAULT_SECTIONS: HomeSection[] = [
  { id: "pourVous", label: "Pour vous", emoji: "💫", visible: true },
  { id: "coupsDeCœur", label: "Coups de cœur", emoji: "❤️", visible: true },
  { id: "titresDuMoment", label: "Titres du moment", emoji: "🔥", visible: true },
  { id: "popHits", label: "Pop Hits", emoji: "🎤", visible: true },
  { id: "rapstars", label: "Rapstars", emoji: "⭐", visible: true },
  { id: "chillVibes", label: "Chill & Détente", emoji: "🌙", visible: true },
  { id: "afrobeats", label: "Afrobeats", emoji: "🌍", visible: true },
  { id: "top10", label: "Top 10", emoji: "🏆", visible: true },
];

const STORAGE_KEY = "home-sections-config";

/** @deprecated Use useGlobalHomeConfig instead */
export function loadSections(): HomeSection[] {
  return DEFAULT_SECTIONS;
}

/** @deprecated Config is now saved to DB via useGlobalHomeConfig */
export function saveSections(_sections: HomeSection[]) {
  // no-op: config is now DB-driven
}

function extractPlaylistId(input: string): string | null {
  // Accept raw ID, or Deezer URL like https://www.deezer.com/playlist/1234567
  const urlMatch = input.match(/deezer\.com\/(?:\w+\/)?playlist\/(\d+)/);
  if (urlMatch) return urlMatch[1];
  if (/^\d+$/.test(input.trim())) return input.trim();
  // Short links like https://link.deezer.com/... need resolution
  if (/link\.deezer\.com/i.test(input.trim())) return "short:" + input.trim();
  return null;
}

interface SearchResult {
  id: string;
  title: string;
  picture: string;
  nb_tracks: number;
  user: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (sections: HomeSection[]) => void | Promise<void>;
  current: HomeSection[];
}

export function HomeCustomizer({ open, onClose, onSave, current }: Props) {
  const [sections, setSections] = useState<HomeSection[]>(current);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingById, setAddingById] = useState(false);
  const [playlistInput, setPlaylistInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
  const editInputRef = useRef<HTMLInputElement>(null);

  const [emojiPickerId, setEmojiPickerId] = useState<string | null>(null);
  const emojiButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [emojiPickerPos, setEmojiPickerPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (open) setSections(current);
  }, [open]);

  const toggleVisibility = useCallback((id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s))
    );
  }, []);

  const removeSection = useCallback((id: string) => {
    setSections((prev) => {
      const next = prev.filter((s) => s.id !== id);
      return [...next]; // new array reference to force Reorder re-sync
    });
  }, []);

  const startEditing = useCallback((section: HomeSection) => {
    setEditingId(section.id);
    setEditingLabel(section.label);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }, []);

  const confirmEditing = useCallback(() => {
    if (editingId && editingLabel.trim()) {
      setSections((prev) =>
        prev.map((s) => (s.id === editingId ? { ...s, label: editingLabel.trim() } : s))
      );
    }
    setEditingId(null);
    setEditingLabel("");
  }, [editingId, editingLabel]);

  const handleSave = async () => {
    const finalSections = editingId && editingLabel.trim()
      ? sections.map((s) => (s.id === editingId ? { ...s, label: editingLabel.trim() } : s))
      : sections;

    await onSave(finalSections);
    onClose();
  };

  const handleReset = () => {
    setSections(DEFAULT_SECTIONS);
  };

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await deezerApi.searchPlaylists(q, 8);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  const addPlaylist = useCallback((id: string, title: string) => {
    const sectionId = `custom-dz-${id}`;
    setSections((prev) => {
      if (prev.some((s) => s.id === sectionId)) return prev;
      return [
        ...prev,
        {
          id: sectionId,
          label: title,
          emoji: "🎵",
          visible: true,
          deezerPlaylistId: id,
        },
      ];
    });
    setShowAddPanel(false);
    setSearchQuery("");
    setSearchResults([]);
    setPlaylistInput("");
  }, []);

  const handleAddById = async () => {
    let id = extractPlaylistId(playlistInput);
    if (!id) return;
    setAddingById(true);
    try {
      // Resolve short links via edge function
      if (id.startsWith("short:")) {
        const shortUrl = id.replace("short:", "");
        const { data, error } = await supabase.functions.invoke("deezer-proxy", {
          body: { action: "resolve_short_link", url: shortUrl },
        });
        if (error || !data?.playlist_id) throw new Error("Not a playlist link");
        id = data.playlist_id;
      }
      const info = await deezerApi.getPlaylistInfo(id);
      addPlaylist(info.id, info.title);
    } catch {
      toast.error("Impossible d'ajouter cette playlist. Vérifie le lien ou l'ID.");
    } finally {
      setAddingById(false);
    }
  };

  const isCustom = (s: HomeSection) => !!s.deezerPlaylistId;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex flex-col"
          style={{ background: "hsl(var(--background))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}>
            <button onClick={onClose} className="text-sm font-medium text-primary">
              Annuler
            </button>
            <h2 className="text-base font-bold text-foreground">Personnaliser</h2>
            <button onClick={handleSave} className="text-sm font-bold text-primary">
              Terminer
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide">
            <p className="text-sm text-muted-foreground mb-4">
              Réorganise ta page d'accueil et ajoute tes playlists Deezer
            </p>

            {/* Add playlist button */}
            <button
              onClick={() => setShowAddPanel(true)}
              className="w-full mb-4 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-primary/30 text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ajouter une playlist Deezer
            </button>

            {/* Reorderable list */}
            <Reorder.Group
              key={sections.map(s => s.id).join(',')}
              axis="y"
              values={sections}
              onReorder={setSections}
              className="rounded-xl bg-secondary/30 border border-border/50 overflow-hidden divide-y divide-border/30"
            >
              {sections.map((section) => (
                <Reorder.Item
                  key={section.id}
                  value={section}
                  data-section-id={section.id}
                  className="flex items-center gap-3 px-4 py-3.5 bg-background cursor-grab active:cursor-grabbing overflow-hidden"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0, x: 100 }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  whileDrag={{
                    scale: 1.03,
                    boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
                    zIndex: 50,
                    borderRadius: "12px",
                    cursor: "grabbing",
                  }}
                  layout
                >
                  <div className="relative">
                    <button
                      ref={(el) => { emojiButtonRefs.current[section.id] = el; }}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (emojiPickerId === section.id) {
                          setEmojiPickerId(null);
                          setEmojiPickerPos(null);
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setEmojiPickerPos({ top: rect.bottom + 4, left: rect.left });
                          setEmojiPickerId(section.id);
                        }
                      }}
                      className="text-base select-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary/80 transition-colors"
                      title="Changer l'emoji"
                    >
                      {section.emoji}
                    </button>
                  </div>
                  {editingId === section.id ? (
                    <div className="flex-1 flex items-center gap-1.5">
                      <input
                        ref={editInputRef}
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmEditing();
                          if (e.key === "Escape") { setEditingId(null); setEditingLabel(""); }
                        }}
                        onBlur={confirmEditing}
                        className="flex-1 h-7 px-2 rounded-md border border-primary/50 bg-secondary/50 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    <span
                      className={`flex-1 text-sm font-medium truncate transition-colors duration-200 ${
                        section.visible ? "text-foreground" : "text-muted-foreground line-through"
                      }`}
                    >
                      {section.label}
                    </span>
                  )}
                  {isCustom(section) && editingId !== section.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(section);
                      }}
                      className="p-1.5 rounded-lg transition-colors hover:bg-primary/10 active:scale-90"
                    >
                      <Pencil className="w-3.5 h-3.5 text-primary/70" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSection(section.id);
                    }}
                    className="p-1.5 rounded-lg transition-all duration-200 hover:bg-destructive/20 active:scale-90"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisibility(section.id);
                    }}
                    className="p-1.5 rounded-lg transition-all duration-200 active:scale-90"
                  >
                    {section.visible ? (
                      <Eye className="w-4 h-4 text-primary" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  <GripVertical className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                </Reorder.Item>
              ))}
            </Reorder.Group>

            {/* Reset button */}
            <button
              onClick={handleReset}
              className="w-full mt-6 flex items-center justify-center gap-2 text-sm text-primary font-medium py-3"
            >
              <RotateCcw className="w-4 h-4" />
              Réinitialiser les réglages
            </button>
          </div>

          {/* Add playlist panel (bottom sheet) */}
          <AnimatePresence>
            {showAddPanel && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[210] bg-black/50 flex items-end"
                onClick={() => setShowAddPanel(false)}
              >
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="w-full max-h-[80vh] bg-background rounded-t-2xl flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                    <h3 className="text-sm font-bold text-foreground">Ajouter une playlist</h3>
                    <button onClick={() => setShowAddPanel(false)} className="p-1">
                      <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>

                  <div className="px-4 py-3 space-y-3">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Rechercher une playlist..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        autoFocus
                      />
                    </div>

                    {/* Or by ID/URL */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="ID ou URL de playlist Deezer..."
                        value={playlistInput}
                        onChange={(e) => setPlaylistInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddById()}
                        className="flex-1 h-10 px-3 rounded-lg border border-border bg-secondary/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <button
                        onClick={handleAddById}
                        disabled={addingById || !playlistInput.trim()}
                        className="px-4 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                      >
                        {addingById ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ajouter"}
                      </button>
                    </div>
                  </div>

                  {/* Search results */}
                  <div className="flex-1 overflow-y-auto px-4 pb-6 scrollbar-hide">
                    {searching && (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    )}
                    {!searching && searchResults.length > 0 && (
                      <div className="space-y-1">
                        {searchResults.map((pl) => {
                          const alreadyAdded = sections.some((s) => s.deezerPlaylistId === pl.id);
                          return (
                            <button
                              key={pl.id}
                              disabled={alreadyAdded}
                              onClick={() => addPlaylist(pl.id, pl.title)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/60 transition-colors disabled:opacity-40"
                            >
                              {pl.picture ? (
                                <img src={pl.picture} alt="" className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                                  <Music className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 text-left min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{pl.title}</p>
                                <p className="text-xs text-muted-foreground">{pl.nb_tracks} titres · {pl.user}</p>
                              </div>
                              {alreadyAdded ? (
                                <span className="text-xs text-muted-foreground">Ajoutée</span>
                              ) : (
                                <Plus className="w-4 h-4 text-primary flex-shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-8">Aucun résultat</p>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
