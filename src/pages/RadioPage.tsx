import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { radioEnLigneApi, tvRadioZapApi } from "@/lib/radioFrApi";
import { deezerApi } from "@/lib/deezerApi";
import { Radio, MapPin, AlertCircle, Music, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type FilterMode = "all" | "genre" | "region" | "tvradiozap";
type TVRZType = "trztop" | "ra" | "trzinfo";

const RadioPage = () => {
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [tvrzType, setTvrzType] = useState<TVRZType>("trztop");

  const queryOptions = filterMode === "genre" && selectedGenre
    ? { genre: selectedGenre }
    : filterMode === "region" && selectedRegion
    ? { region: selectedRegion }
    : undefined;

  const { data, isLoading: loadingEnLigne, error: errorEnLigne } = useQuery({
    queryKey: ["radio-en-ligne", filterMode, selectedGenre, selectedRegion],
    queryFn: () => radioEnLigneApi.getStations(queryOptions),
    staleTime: 10 * 60 * 1000,
    enabled: filterMode !== "tvradiozap",
  });

  const { data: tvrzStations, isLoading: loadingTvrz, error: errorTvrz } = useQuery({
    queryKey: ["tvradiozap", tvrzType],
    queryFn: () => tvRadioZapApi.getStations(tvrzType),
    staleTime: 10 * 60 * 1000,
    enabled: filterMode === "tvradiozap",
  });

  // Fallback Deezer
  const { data: deezerStations } = useQuery({
    queryKey: ["deezer-radio-fallback"],
    queryFn: () => deezerApi.getRadioStations(),
    enabled: !!error,
    staleTime: 10 * 60 * 1000,
  });

  const stations = data?.stations || (error ? deezerStations : undefined) || [];
  const genres = data?.genres || [];
  const regions = data?.regions || [];

  return (
    <div className="p-4 md:p-8 pb-32 max-w-7xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">Radio</h1>
      <p className="text-muted-foreground mb-6">
        {data ? "Stations live depuis radio-en-ligne.fr" : error ? "Stations Deezer (fallback)" : "Chargement..."}
      </p>

      {error && !deezerStations && (
        <div className="glass-panel-light rounded-xl p-4 mb-6 flex items-center gap-3 text-destructive">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Impossible de charger radio-en-ligne.fr. Tentative de fallback Deezer...</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {[
          { key: "all" as FilterMode, label: "Toutes", icon: Radio },
          { key: "genre" as FilterMode, label: "Par genre", icon: Music },
          { key: "region" as FilterMode, label: "Par région", icon: MapPin },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setFilterMode(key); setSelectedGenre(null); setSelectedRegion(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              filterMode === key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Genre/region chips */}
      {filterMode === "genre" && genres.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {genres.map((g) => (
            <button
              key={g.slug}
              onClick={() => setSelectedGenre(g.slug)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedGenre === g.slug
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-secondary-foreground hover:bg-secondary"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {filterMode === "region" && regions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {regions.map((r) => (
            <button
              key={r.slug}
              onClick={() => setSelectedRegion(r.slug)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedRegion === r.slug
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-secondary-foreground hover:bg-secondary"
              }`}
            >
              {r.name}
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
            key={`${filterMode}-${selectedGenre}-${selectedRegion}`}
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
                onClick={() => {
                  if (station.streamUrl) {
                    window.open(station.streamUrl, '_blank');
                  }
                }}
              >
                <div className="flex gap-4 items-center">
                  <div className="relative flex-shrink-0">
                    <img
                      src={station.coverUrl}
                      alt={station.name}
                      className="w-16 h-16 rounded-xl object-cover bg-secondary"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop';
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-background/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                      <Radio className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-semibold text-foreground truncate">{station.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{station.genre}</p>
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
                      <span className="text-[10px] text-primary font-medium">LIVE</span>
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
          <h2 className="text-xl font-display font-semibold text-foreground mb-2">Aucune station disponible</h2>
          <p className="text-muted-foreground">Sélectionnez un genre ou une région pour filtrer.</p>
        </div>
      )}
    </div>
  );
};

export default RadioPage;
