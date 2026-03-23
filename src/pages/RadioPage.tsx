import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { radioBrowserApi } from "@/lib/radioBrowserApi";
import { radioEnLigneApi } from "@/lib/radioEnLigneApi";
import { usePlayerStore } from "@/stores/playerStore";
import { Radio, Play, Pause, Music, Search, TrendingUp, Globe } from "lucide-react";
import type { RadioStation } from "@/data/mockData";
import { motion, AnimatePresence } from "framer-motion";

type FilterMode = "top" | "rel" | "tag" | "search";

const RadioPage = () => {
  const [filterMode, setFilterMode] = useState<FilterMode>("top");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const { play, currentSong, isPlaying, togglePlay } = usePlayerStore();

  const playStation = (station: RadioStation) => {
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

  // Top stations (default)
  const { data: topStations = [], isLoading: loadingTop } = useQuery({
    queryKey: ["radio-browser-top"],
    queryFn: () => radioBrowserApi.getStations({ limit: 50 }),
    staleTime: 10 * 60 * 1000,
    enabled: filterMode === "top",
  });

  // By tag
  const { data: tagStations = [], isLoading: loadingTag } = useQuery({
    queryKey: ["radio-browser-tag", selectedTag],
    queryFn: () => radioBrowserApi.getStations({ tag: selectedTag! }),
    staleTime: 10 * 60 * 1000,
    enabled: filterMode === "tag" && !!selectedTag,
  });

  // Search
  const { data: searchStations = [], isLoading: loadingSearch } = useQuery({
    queryKey: ["radio-browser-search", searchQuery],
    queryFn: () => radioBrowserApi.getStations({ name: searchQuery }),
    staleTime: 5 * 60 * 1000,
    enabled: filterMode === "search" && searchQuery.length > 1,
  });

  // Tags list
  const { data: tags = [] } = useQuery({
    queryKey: ["radio-browser-tags"],
    queryFn: () => radioBrowserApi.getTags(),
    staleTime: 30 * 60 * 1000,
  });

  const stations = filterMode === "top"
    ? topStations
    : filterMode === "tag"
    ? tagStations
    : searchStations;

  const isLoading = filterMode === "top" ? loadingTop : filterMode === "tag" ? loadingTag : loadingSearch;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchQuery(searchInput.trim());
      setFilterMode("search");
    }
  };

  return (
    <div className="p-4 md:p-8 pb-32 max-w-7xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">Radio</h1>
      <p className="text-muted-foreground mb-6">
        Stations radio françaises avec flux audio en direct
      </p>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher une station..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Rechercher
          </button>
        </div>
      </form>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {[
          { key: "top" as FilterMode, label: "Top France", icon: TrendingUp },
          { key: "tag" as FilterMode, label: "Par genre", icon: Music },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setFilterMode(key); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              filterMode === key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
        {filterMode === "search" && searchQuery && (
          <span className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-primary text-primary-foreground">
            <Search className="w-4 h-4" />
            "{searchQuery}"
          </span>
        )}
      </div>

      {/* Tag chips */}
      {filterMode === "tag" && tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {tags
            .filter((t) => t.stationcount > 5)
            .slice(0, 25)
            .map((t) => (
              <button
                key={t.name}
                onClick={() => setSelectedTag(t.name)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
                  selectedTag === t.name
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/60 text-secondary-foreground hover:bg-secondary"
                }`}
              >
                {t.name} ({t.stationcount})
              </button>
            ))}
        </div>
      )}

      {/* Station grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="glass-panel rounded-xl p-4 animate-pulse">
              <div className="flex gap-4 items-center">
                <div className="w-16 h-16 rounded-xl bg-secondary" />
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
            key={`${filterMode}-${selectedTag}-${searchQuery}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {stations.map((station, i) => (
              <motion.div
                key={station.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="glass-panel rounded-xl p-4 hover-glass cursor-pointer group"
                onClick={() => playStation(station)}
              >
                <div className="flex gap-4 items-center">
                  <div className="relative flex-shrink-0">
                    <img
                      src={station.coverUrl || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop"}
                      alt={station.name}
                      className="w-16 h-16 rounded-xl object-cover bg-secondary"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop';
                      }}
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
                    <h3 className="font-display font-semibold text-foreground truncate">{station.name}</h3>
                    <p className="text-xs text-muted-foreground truncate capitalize">{station.genre}</p>
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${currentSong?.id === station.id && isPlaying ? "bg-primary animate-pulse-glow" : "bg-muted-foreground/50"}`} />
                      <span className={`text-[10px] font-medium ${currentSong?.id === station.id && isPlaying ? "text-primary" : "text-muted-foreground"}`}>
                        {currentSong?.id === station.id && isPlaying ? "EN LECTURE" : "LIVE"}
                      </span>
                      {station.listeners > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-2">
                          {station.listeners} clics
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Radio className="w-16 h-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-display font-semibold text-foreground mb-2">Aucune station trouvée</h2>
          <p className="text-muted-foreground">
            {filterMode === "search" ? "Essayez un autre terme de recherche." : "Sélectionnez un genre pour filtrer."}
          </p>
        </div>
      )}
    </div>
  );
};

export default RadioPage;
