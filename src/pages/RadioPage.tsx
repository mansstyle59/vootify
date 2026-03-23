import { useQuery } from "@tanstack/react-query";
import { radioFrApi } from "@/lib/radioFrApi";
import { deezerApi } from "@/lib/deezerApi";
import { usePlayerStore } from "@/stores/playerStore";
import { Radio, MapPin, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

const RadioPage = () => {
  const { play, setQueue } = usePlayerStore();

  const { data: stations, isLoading, error } = useQuery({
    queryKey: ["radio-fr-stations"],
    queryFn: () => radioFrApi.getStations(),
    staleTime: 15 * 60 * 1000,
  });

  // Fallback to Deezer radio if radio.fr fails
  const { data: deezerStations } = useQuery({
    queryKey: ["deezer-radio-fallback"],
    queryFn: () => deezerApi.getRadioStations(),
    enabled: !!error,
    staleTime: 10 * 60 * 1000,
  });

  const displayStations = stations || deezerStations || [];

  return (
    <div className="p-4 md:p-8 pb-32 max-w-7xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">Radio</h1>
      <p className="text-muted-foreground mb-8">
        {stations ? "Stations live depuis radio.fr" : error ? "Stations Deezer (fallback)" : "Chargement des stations..."}
      </p>

      {error && !deezerStations && (
        <div className="glass-panel-light rounded-xl p-4 mb-6 flex items-center gap-3 text-destructive">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Impossible de charger radio.fr. Tentative de fallback Deezer...</p>
        </div>
      )}

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
      ) : displayStations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayStations.map((station, i) => (
            <motion.div
              key={station.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass-panel rounded-xl p-4 hover-glass cursor-pointer group"
              onClick={() => {
                // Open station page in new tab as we can't stream directly
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
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Radio className="w-16 h-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-display font-semibold text-foreground mb-2">Aucune station disponible</h2>
          <p className="text-muted-foreground">Réessayez plus tard.</p>
        </div>
      )}
    </div>
  );
};

export default RadioPage;
