import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ANONYMOUS_USER_ID } from "@/lib/constants";
import { radioBrowserApi, type RadioBrowserStation } from "@/lib/radioBrowserApi";
import { usePlayerStore } from "@/stores/playerStore";
import { Radio, Play, Pause, Search, Star, TrendingUp, Heart, Pencil, Trash2, X, Check, Globe, Waves } from "lucide-react";
import { getStationLogo } from "@/lib/radioLogos";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { useRadioMetadata } from "@/hooks/useRadioMetadata";
import CoverImagePicker from "@/components/CoverImagePicker";
import { toast } from "sonner";

type TabKey = "france" | "top" | "custom" | "search";

const GENRE_TAGS = ["pop", "rock", "jazz", "classical", "hip hop", "electronic", "news", "talk"];

// Equalizer animation for active station
const EqBar = ({ delay }: { delay: number }) => (
  <motion.div
    className="w-[3px] rounded-full bg-primary"
    animate={{ height: ["40%", "100%", "60%", "90%", "40%"] }}
    transition={{ duration: 1.2, repeat: Infinity, delay, ease: "easeInOut" }}
  />
);

const LiveEqualizer = () => (
  <div className="flex items-end gap-[2px] h-4">
    <EqBar delay={0} />
    <EqBar delay={0.2} />
    <EqBar delay={0.4} />
    <EqBar delay={0.1} />
  </div>
);

const RadioPage = () => {
  const { play, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const [activeTab, setActiveTab] = useState<TabKey>("custom");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", genre: "", streamUrl: "", coverUrl: "" });
  const queryClient = useQueryClient();

  // Live metadata: dynamically fetch cover art from Deezer for the active station
  const isLiveRadio = currentSong?.album === "Radio en direct";
  const radioMetadata = useRadioMetadata(
    isLiveRadio ? currentSong?.streamUrl : undefined,
    isLiveRadio,
    isPlaying,
    currentSong?.title,
    currentSong?.coverUrl
  );

  const playStation = (station: { id: string; name: string; genre: string; coverUrl: string; streamUrl: string }) => {
    if (currentSong?.id === station.id) { togglePlay(); return; }
    play({
      id: station.id, title: station.name, artist: station.genre || "Radio",
      album: "Radio en direct", duration: 0,
      coverUrl: getStationLogo(station.name, station.coverUrl),
      streamUrl: station.streamUrl, liked: false,
    });
  };

  const saveStation = async (station: RadioBrowserStation) => {
    const { error } = await supabase.from("custom_radio_stations").upsert({
      id: station.id, user_id: ANONYMOUS_USER_ID, name: station.name,
      genre: station.genre, cover_url: station.coverUrl, stream_url: station.streamUrl,
    }, { onConflict: "id" });
    if (error) { toast.error("Erreur lors de la sauvegarde"); }
    else { toast.success(`${station.name} ajoutée`); queryClient.invalidateQueries({ queryKey: ["custom-radio-stations"] }); queryClient.invalidateQueries({ queryKey: ["saved-station-ids"] }); }
  };

  const removeStation = async (id: string) => {
    const { error } = await supabase.from("custom_radio_stations").delete().eq("id", id);
    if (error) { toast.error("Erreur lors de la suppression"); }
    else { toast.success("Station supprimée"); queryClient.invalidateQueries({ queryKey: ["custom-radio-stations"] }); queryClient.invalidateQueries({ queryKey: ["saved-station-ids"] }); }
  };

  const startEdit = (station: RadioBrowserStation) => {
    setEditingId(station.id);
    setEditForm({ name: station.name, genre: station.genre, streamUrl: station.streamUrl, coverUrl: station.coverUrl });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase.from("custom_radio_stations").update({
      name: editForm.name, genre: editForm.genre, stream_url: editForm.streamUrl, cover_url: editForm.coverUrl,
    }).eq("id", editingId);
    if (error) { toast.error("Erreur lors de la modification"); }
    else { toast.success("Station modifiée"); setEditingId(null); queryClient.invalidateQueries({ queryKey: ["custom-radio-stations"] }); }
  };

  const { data: savedIds = new Set<string>() } = useQuery({
    queryKey: ["saved-station-ids"],
    queryFn: async () => {
      const { data } = await supabase.from("custom_radio_stations").select("id").eq("user_id", ANONYMOUS_USER_ID);
      return new Set((data || []).map((r) => r.id));
    },
    staleTime: 2 * 60 * 1000,
  });

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
      const { data, error } = await supabase.from("custom_radio_stations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((s) => ({
        id: s.id, name: s.name, genre: s.genre || "Radio", coverUrl: s.cover_url || "",
        streamUrl: s.stream_url || "", country: "", countryCode: "", votes: 0, clicks: 0, codec: "", bitrate: 0,
      }));
    },
    staleTime: 5 * 60 * 1000,
    enabled: activeTab === "custom",
  });

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "custom", label: "Mes stations", icon: <Star className="w-4 h-4" /> },
    { key: "france", label: "France", icon: <span className="text-sm">🇫🇷</span> },
    { key: "top", label: "Top mondial", icon: <Globe className="w-4 h-4" /> },
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
    activeTab === "france" ? loadingFr : activeTab === "top" ? loadingTop : activeTab === "custom" ? loadingCustom : loadingSearch
  );

  const stations = getStations();
  const isCustomTab = activeTab === "custom";

  const StationCard = ({ station, index }: { station: RadioBrowserStation; index: number }) => {
    const isSaved = savedIds.has(station.id);
    const isEditing = editingId === station.id;
    const isActive = currentSong?.id === station.id;
    const isActivePlaying = isActive && isPlaying;

    if (isEditing) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-border bg-card p-4 space-y-2.5"
        >
          <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nom" className="text-sm bg-secondary border-border/50" />
          <Input value={editForm.genre} onChange={(e) => setEditForm((f) => ({ ...f, genre: e.target.value }))} placeholder="Genre" className="text-sm bg-secondary border-border/50" />
          <Input value={editForm.streamUrl} onChange={(e) => setEditForm((f) => ({ ...f, streamUrl: e.target.value }))} placeholder="URL du flux" className="text-sm bg-secondary border-border/50" />
          <CoverImagePicker value={editForm.coverUrl} onChange={(v) => setEditForm((f) => ({ ...f, coverUrl: v }))} />
          <div className="flex gap-2 pt-1">
            <button onClick={saveEdit} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 transition-all">
              <Check className="w-3.5 h-3.5" /> Enregistrer
            </button>
            <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-all">
              <X className="w-3.5 h-3.5" /> Annuler
            </button>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        className="group cursor-pointer"
        onClick={() => playStation(station)}
      >
        <div className={`relative aspect-square rounded-2xl overflow-hidden mb-2.5 ring-2 transition-all duration-300 ${
          isActive ? "ring-primary shadow-lg shadow-primary/20" : "ring-transparent"
        }`}>
          <img
            src={getStationLogo(station.name, station.coverUrl) || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop"}
            alt={station.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop'; }}
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`w-12 h-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-xl transition-all duration-300 ${
              isActivePlaying ? "opacity-100 scale-100" : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
            }`}>
              {isActivePlaying ? <Pause className="w-5 h-5 text-primary-foreground" /> : <Play className="w-5 h-5 text-primary-foreground ml-0.5" />}
            </div>
          </div>

          {/* Live badge with equalizer */}
          {isActivePlaying && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/90 backdrop-blur-md"
            >
              <LiveEqualizer />
              <span className="text-[10px] font-bold text-white tracking-widest uppercase">Live</span>
            </motion.div>
          )}

          {/* Action buttons */}
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {isCustomTab ? (
              <>
                <button onClick={(e) => { e.stopPropagation(); startEdit(station); }} className="p-2 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/70 transition-colors">
                  <Pencil className="w-3.5 h-3.5 text-white" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); removeStation(station.id); }} className="p-2 rounded-full bg-black/50 backdrop-blur-md hover:bg-destructive/80 transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </button>
              </>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); isSaved ? removeStation(station.id) : saveStation(station); }} className="p-2 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/70 transition-colors">
                <Heart className={`w-3.5 h-3.5 transition-colors ${isSaved ? "fill-primary text-primary" : "text-white"}`} />
              </button>
            )}
          </div>

          {/* Bitrate & country badges */}
          <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
            {station.countryCode && (
              <span className="px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-sm text-[10px] font-medium text-white/80 uppercase">
                {station.countryCode}
              </span>
            )}
            {station.bitrate > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-sm text-[10px] font-semibold text-white/80 ml-auto">
                {station.bitrate}kbps
              </span>
            )}
          </div>
        </div>

        {/* Text */}
        <div className="px-0.5">
          <div className="flex items-center gap-1.5">
            {isActive && !isActivePlaying && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
            )}
            {isActivePlaying && <LiveEqualizer />}
            <h3 className={`font-semibold text-sm truncate ${isActive ? "text-primary" : "text-foreground"}`}>{station.name}</h3>
          </div>
          <p className="text-xs text-muted-foreground truncate capitalize mt-0.5">{station.genre || "Radio"}</p>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="pb-32 max-w-7xl mx-auto">
      {/* Hero header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-accent/5" />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary/5 blur-3xl -translate-y-1/2 translate-x-1/3" />
        
        <div className="relative px-4 md:px-8 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Waves className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Radio</h1>
              <p className="text-sm text-muted-foreground">Des milliers de stations en direct du monde entier</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setActiveTab(t.key); setSelectedGenre(null); }}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                activeTab === t.key && !selectedGenre
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
              {t.key === "custom" && customStations.length > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === "custom" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary"
                }`}>
                  {customStations.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search input */}
        {activeTab === "search" && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 max-w-lg">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une station..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 rounded-xl bg-secondary/60 border-border/50 focus:bg-secondary text-sm"
                autoFocus
              />
            </div>
          </motion.div>
        )}

        {/* Genre chips */}
        {(activeTab === "france" || activeTab === "top") && (
          <div className="flex gap-2 mb-5 flex-wrap">
            {GENRE_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedGenre(selectedGenre === tag ? null : tag)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                  selectedGenre === tag
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square rounded-2xl bg-secondary/60 mb-2.5" />
                <div className="h-4 w-3/4 bg-secondary/60 rounded-lg mb-1.5" />
                <div className="h-3 w-1/2 bg-secondary/40 rounded-lg" />
              </div>
            ))}
          </div>
        ) : stations.length > 0 ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-${selectedGenre}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5"
            >
              {stations.map((station, i) => (
                <StationCard key={station.id} station={station} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-secondary/60 flex items-center justify-center mb-5">
              <Radio className="w-9 h-9 text-muted-foreground/50" />
            </div>
            <h2 className="text-lg font-display font-semibold text-foreground mb-2">
              {activeTab === "search" && searchQuery.length < 2 ? "Tapez pour rechercher" : "Aucune station trouvée"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              {activeTab === "custom"
                ? "Explorez les onglets France ou Top mondial et ajoutez vos stations favorites avec le ❤️"
                : "Essayez un autre filtre ou une autre recherche."}
            </p>
            {activeTab === "custom" && (
              <button
                onClick={() => setActiveTab("france")}
                className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-md shadow-primary/25 hover:brightness-110 transition-all"
              >
                <Globe className="w-4 h-4" />
                Explorer les stations
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default RadioPage;
