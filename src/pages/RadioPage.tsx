import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ANONYMOUS_USER_ID } from "@/lib/constants";
import { radioBrowserApi, type RadioBrowserStation } from "@/lib/radioBrowserApi";
import { usePlayerStore } from "@/stores/playerStore";
import { Radio, Play, Pause, Search, Star, TrendingUp, Heart, Pencil, Trash2, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type TabKey = "france" | "top" | "custom" | "search";

const GENRE_TAGS = ["pop", "rock", "jazz", "classical", "hip hop", "electronic", "news", "talk"];

const RadioPage = () => {
  const { play, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const [activeTab, setActiveTab] = useState<TabKey>("france");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", genre: "", streamUrl: "", coverUrl: "" });
  const queryClient = useQueryClient();

  const playStation = (station: { id: string; name: string; genre: string; coverUrl: string; streamUrl: string }) => {
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
      coverUrl: station.coverUrl,
      streamUrl: station.streamUrl,
      liked: false,
    });
  };

  // Save station to library
  const saveStation = async (station: RadioBrowserStation) => {
    const { error } = await supabase.from("custom_radio_stations").upsert({
      id: station.id,
      user_id: ANONYMOUS_USER_ID,
      name: station.name,
      genre: station.genre,
      cover_url: station.coverUrl,
      stream_url: station.streamUrl,
    }, { onConflict: "id" });
    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      console.error(error);
    } else {
      toast.success(`${station.name} ajoutée à votre bibliothèque`);
      queryClient.invalidateQueries({ queryKey: ["custom-radio-stations"] });
      queryClient.invalidateQueries({ queryKey: ["saved-station-ids"] });
    }
  };

  const removeStation = async (id: string) => {
    const { error } = await supabase.from("custom_radio_stations").delete().eq("id", id);
    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Station supprimée");
      queryClient.invalidateQueries({ queryKey: ["custom-radio-stations"] });
      queryClient.invalidateQueries({ queryKey: ["saved-station-ids"] });
    }
  };

  const startEdit = (station: RadioBrowserStation) => {
    setEditingId(station.id);
    setEditForm({ name: station.name, genre: station.genre, streamUrl: station.streamUrl, coverUrl: station.coverUrl });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase.from("custom_radio_stations").update({
      name: editForm.name,
      genre: editForm.genre,
      stream_url: editForm.streamUrl,
      cover_url: editForm.coverUrl,
    }).eq("id", editingId);
    if (error) {
      toast.error("Erreur lors de la modification");
    } else {
      toast.success("Station modifiée");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["custom-radio-stations"] });
    }
  };

  // Track saved station IDs
  const { data: savedIds = new Set<string>() } = useQuery({
    queryKey: ["saved-station-ids"],
    queryFn: async () => {
      const { data } = await supabase.from("custom_radio_stations").select("id").eq("user_id", ANONYMOUS_USER_ID);
      return new Set((data || []).map((r) => r.id));
    },
    staleTime: 2 * 60 * 1000,
  });

  // French stations
  const { data: frenchStations = [], isLoading: loadingFr } = useQuery({
    queryKey: ["radio-browser-france"],
    queryFn: () => radioBrowserApi.getTopFrench(40),
    staleTime: 10 * 60 * 1000,
    enabled: activeTab === "france",
  });

  const { data: topStations = [], isLoading: loadingTop } = useQuery({
    queryKey: ["radio-browser-top"],
    queryFn: () => radioBrowserApi.getTop(40),
    staleTime: 10 * 60 * 1000,
    enabled: activeTab === "top",
  });

  const { data: genreStations = [], isLoading: loadingGenre } = useQuery({
    queryKey: ["radio-browser-genre", selectedGenre],
    queryFn: () => radioBrowserApi.getByTag(selectedGenre!, 40),
    staleTime: 10 * 60 * 1000,
    enabled: !!selectedGenre,
  });

  const { data: searchResults = [], isLoading: loadingSearch } = useQuery({
    queryKey: ["radio-browser-search", searchQuery],
    queryFn: () => radioBrowserApi.search(searchQuery, 30),
    staleTime: 5 * 60 * 1000,
    enabled: activeTab === "search" && searchQuery.length >= 2,
  });

  const { data: customStations = [], isLoading: loadingCustom } = useQuery({
    queryKey: ["custom-radio-stations"],
    queryFn: async (): Promise<RadioBrowserStation[]> => {
      const { data, error } = await supabase
        .from("custom_radio_stations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((s) => ({
        id: s.id,
        name: s.name,
        genre: s.genre || "Radio",
        coverUrl: s.cover_url || "",
        streamUrl: s.stream_url || "",
        country: "", countryCode: "", votes: 0, clicks: 0, codec: "", bitrate: 0,
      }));
    },
    staleTime: 5 * 60 * 1000,
    enabled: activeTab === "custom",
  });

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "france", label: "France", icon: <span className="text-sm">🇫🇷</span> },
    { key: "top", label: "Top mondial", icon: <TrendingUp className="w-4 h-4" /> },
    { key: "custom", label: "Mes stations", icon: <Star className="w-4 h-4" /> },
    { key: "search", label: "Rechercher", icon: <Search className="w-4 h-4" /> },
  ];

  const getStations = (): RadioBrowserStation[] => {
    if (selectedGenre) return genreStations;
    switch (activeTab) {
      case "france": return frenchStations;
      case "top": return topStations;
      case "custom": return customStations;
      case "search": return searchResults;
      default: return [];
    }
  };

  const isLoading = selectedGenre ? loadingGenre : (
    activeTab === "france" ? loadingFr :
    activeTab === "top" ? loadingTop :
    activeTab === "custom" ? loadingCustom :
    loadingSearch
  );

  const stations = getStations();
  const isCustomTab = activeTab === "custom";

  const StationCard = ({ station, index }: { station: RadioBrowserStation; index: number }) => {
    const isSaved = savedIds.has(station.id);
    const isEditing = editingId === station.id;

    if (isEditing) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-xl p-4"
        >
          <div className="space-y-2">
            <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nom" className="text-sm" />
            <Input value={editForm.genre} onChange={(e) => setEditForm((f) => ({ ...f, genre: e.target.value }))} placeholder="Genre" className="text-sm" />
            <Input value={editForm.streamUrl} onChange={(e) => setEditForm((f) => ({ ...f, streamUrl: e.target.value }))} placeholder="URL du flux" className="text-sm" />
            <Input value={editForm.coverUrl} onChange={(e) => setEditForm((f) => ({ ...f, coverUrl: e.target.value }))} placeholder="URL du logo" className="text-sm" />
            <div className="flex gap-2 pt-1">
              <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
                <Check className="w-3 h-3" /> Enregistrer
              </button>
              <button onClick={() => setEditingId(null)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium">
                <X className="w-3 h-3" /> Annuler
              </button>
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.015 }}
        className="glass-panel rounded-xl p-4 hover-glass cursor-pointer group"
        onClick={() => playStation(station)}
      >
        <div className="flex gap-4 items-center">
          <div className="relative flex-shrink-0">
            <img
              src={station.coverUrl || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop"}
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
            <p className="text-xs text-muted-foreground truncate capitalize">{station.genre}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${currentSong?.id === station.id && isPlaying ? "bg-primary animate-pulse-glow" : "bg-muted-foreground/50"}`} />
              <span className={`text-[10px] font-medium ${currentSong?.id === station.id && isPlaying ? "text-primary" : "text-muted-foreground"}`}>
                {currentSong?.id === station.id && isPlaying ? "EN LECTURE" : "LIVE"}
              </span>
              {station.bitrate > 0 && (
                <span className="text-[10px] text-muted-foreground">{station.bitrate}kbps</span>
              )}
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isCustomTab ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(station); }}
                  className="p-2 rounded-full hover:bg-secondary transition-colors"
                  title="Modifier"
                >
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeStation(station.id); }}
                  className="p-2 rounded-full hover:bg-destructive/20 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); isSaved ? removeStation(station.id) : saveStation(station); }}
                className="p-2 rounded-full hover:bg-secondary transition-colors"
                title={isSaved ? "Retirer de ma bibliothèque" : "Ajouter à ma bibliothèque"}
              >
                <Heart className={`w-4 h-4 ${isSaved ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="p-4 md:p-8 pb-32 max-w-7xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-1">Radio</h1>
      <p className="text-muted-foreground mb-5 text-sm">
        Des milliers de stations radio du monde entier
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelectedGenre(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === tab.key && !selectedGenre
                ? "bg-primary text-primary-foreground"
                : "glass-panel text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      {activeTab === "search" && (
        <div className="mb-5 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 glass-panel border-border/50"
            />
          </div>
        </div>
      )}

      {/* Genre chips */}
      {(activeTab === "france" || activeTab === "top") && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {GENRE_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedGenre(selectedGenre === tag ? null : tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
                selectedGenre === tag
                  ? "bg-accent text-accent-foreground"
                  : "glass-panel-light text-muted-foreground hover:text-foreground"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Stations grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="glass-panel rounded-xl p-4 animate-pulse">
              <div className="flex gap-4 items-center">
                <div className="w-14 h-14 rounded-xl bg-secondary" />
                <div className="flex-1">
                  <div className="h-4 w-28 bg-secondary rounded mb-2" />
                  <div className="h-3 w-20 bg-secondary rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : stations.length > 0 ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeTab}-${selectedGenre}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {stations.map((station, i) => (
              <StationCard key={station.id} station={station} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Radio className="w-16 h-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-display font-semibold text-foreground mb-2">
            {activeTab === "search" && searchQuery.length < 2 ? "Tapez pour rechercher" : "Aucune station trouvée"}
          </h2>
          <p className="text-muted-foreground">
            {activeTab === "custom" ? "Ajoutez des stations avec le ❤️ depuis les autres onglets." : "Essayez un autre filtre ou une autre recherche."}
          </p>
        </div>
      )}
    </div>
  );
};

export default RadioPage;
