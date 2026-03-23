import { radioStations } from "@/data/mockData";
import { Radio, Users } from "lucide-react";
import { motion } from "framer-motion";

const RadioPage = () => {
  return (
    <div className="p-4 md:p-8 pb-32 max-w-7xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">Radio</h1>
      <p className="text-muted-foreground mb-8">Live stations curated for every mood.</p>

      {radioStations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Radio className="w-16 h-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-display font-semibold text-foreground mb-2">No stations yet</h2>
          <p className="text-muted-foreground max-w-sm">
            Connect a data source to browse live radio stations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {radioStations.map((station, i) => (
            <motion.div
              key={station.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel rounded-xl p-5 hover-glass cursor-pointer group"
            >
              <div className="flex gap-4 items-center">
                <div className="relative">
                  <img src={station.coverUrl} alt={station.name} className="w-20 h-20 rounded-xl object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                    <Radio className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-foreground text-lg">{station.name}</h3>
                  <p className="text-sm text-muted-foreground">{station.genre}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {station.listeners.toLocaleString()} listening
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
                    <span className="text-xs text-primary font-medium">LIVE</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RadioPage;
