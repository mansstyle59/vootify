import { useQuery } from "@tanstack/react-query";
import { deezerApi } from "@/lib/deezerApi";
import { usePlayerStore } from "@/stores/playerStore";
import { Radio, Play, Pause } from "lucide-react";
import type { RadioStation } from "@/data/mockData";
import { motion, AnimatePresence } from "framer-motion";

const RadioPage = () => {
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

  const { data: stations = [], isLoading } = useQuery({
    queryKey: ["deezer-radio"],
    queryFn: () => deezerApi.getRadioStations(),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="p-4 md:p-8 pb-32 max-w-7xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">Radio</h1>
      <p className="text-muted-foreground mb-6">Stations radio Deezer</p>

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
                      src={station.coverUrl}
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
                    <p className="text-xs text-muted-foreground truncate">{station.genre}</p>
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${currentSong?.id === station.id && isPlaying ? "bg-primary animate-pulse-glow" : "bg-muted-foreground/50"}`} />
                      <span className={`text-[10px] font-medium ${currentSong?.id === station.id && isPlaying ? "text-primary" : "text-muted-foreground"}`}>
                        {currentSong?.id === station.id && isPlaying ? "EN LECTURE" : "LIVE"}
                      </span>
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
          <p className="text-muted-foreground">Impossible de charger les stations radio.</p>
        </div>
      )}
    </div>
  );
};

export default RadioPage;
