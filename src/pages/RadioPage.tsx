import { useQuery } from "@tanstack/react-query";
import { deezerApi } from "@/lib/deezerApi";
import { ContentCard, CardSkeleton } from "@/components/MusicCards";
import { usePlayerStore } from "@/stores/playerStore";
import { Radio, Users } from "lucide-react";
import { motion } from "framer-motion";

const RadioPage = () => {
  const { play, setQueue } = usePlayerStore();

  const { data: stations, isLoading } = useQuery({
    queryKey: ["deezer-radio-all"],
    queryFn: () => deezerApi.getRadioStations(),
    staleTime: 10 * 60 * 1000,
  });

  const handlePlayRadio = async (stationId: string) => {
    try {
      const tracks = await deezerApi.getRadioTracks(stationId, 20);
      if (tracks.length > 0) {
        setQueue(tracks);
        play(tracks[0]);
      }
    } catch (e) {
      console.error("Failed to load radio tracks", e);
    }
  };

  return (
    <div className="p-4 md:p-8 pb-32 max-w-7xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">Radio</h1>
      <p className="text-muted-foreground mb-8">Live stations powered by Deezer.</p>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-panel rounded-xl p-5 animate-pulse">
              <div className="flex gap-4 items-center">
                <div className="w-20 h-20 rounded-xl bg-secondary" />
                <div className="flex-1">
                  <div className="h-4 w-28 bg-secondary rounded mb-2" />
                  <div className="h-3 w-20 bg-secondary rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : stations && stations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stations.map((station, i) => (
            <motion.div
              key={station.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-panel rounded-xl p-5 hover-glass cursor-pointer group"
              onClick={() => handlePlayRadio(station.id)}
            >
              <div className="flex gap-4 items-center">
                <div className="relative">
                  <img src={station.coverUrl} alt={station.name} className="w-20 h-20 rounded-xl object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                    <Radio className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-foreground text-lg truncate">{station.name}</h3>
                  <p className="text-sm text-muted-foreground">{station.genre}</p>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
                    <span className="text-xs text-primary font-medium">LIVE</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Radio className="w-16 h-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-display font-semibold text-foreground mb-2">No stations available</h2>
          <p className="text-muted-foreground">Please try again later.</p>
        </div>
      )}
    </div>
  );
};

export default RadioPage;
