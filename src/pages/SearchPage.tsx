import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { jiosaavnApi } from "@/lib/jiosaavnApi";
import { usePlayerStore } from "@/stores/playerStore";
import { SongCard, SongSkeleton } from "@/components/MusicCards";
import { Search as SearchIcon, X } from "lucide-react";
import { motion } from "framer-motion";
import type { Song } from "@/data/mockData";

const SearchPage = () => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { play, setQueue } = usePlayerStore();

  const handleChange = (value: string) => {
    setQuery(value);
    clearTimeout((window as any).__searchTimeout);
    (window as any).__searchTimeout = setTimeout(() => {
      setDebouncedQuery(value);
    }, 600);
  };

  const { data: results, isLoading } = useQuery({
    queryKey: ["deezer-search", debouncedQuery],
    queryFn: () => jiosaavnApi.search(debouncedQuery, 20),
    enabled: debouncedQuery.length >= 2,
    staleTime: 2 * 60 * 1000,
  });

  const handlePlayTrack = (song: Song, allSongs: Song[]) => {
    setQueue(allSongs);
    play(song);
  };

  const genres = ["Pop", "Rock", "Hip Hop", "Electronic", "Jazz", "R&B", "Reggaeton", "Français"];

  return (
    <div className="p-4 md:p-8 pb-32 max-w-7xl mx-auto">
      <div className="relative mb-8">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Rechercher des chansons, artistes..."
          className="w-full pl-12 pr-10 py-3.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
        />
        {query && (
          <button onClick={() => { setQuery(""); setDebouncedQuery(""); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {!debouncedQuery ? (
        <div>
          <h2 className="text-xl font-display font-semibold text-foreground mb-4">Parcourir les genres</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {genres.map((genre, i) => (
              <motion.button
                key={genre}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handleChange(genre)}
                className="glass-panel-light rounded-xl p-6 text-left hover-glass"
              >
                <span className="font-display font-semibold text-foreground">{genre}</span>
              </motion.button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          {isLoading ? (
            <div className="glass-panel-light rounded-xl p-2">
              {Array.from({ length: 6 }).map((_, i) => <SongSkeleton key={i} />)}
            </div>
          ) : results && results.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                {results.length} résultats
              </p>
              <div className="glass-panel-light rounded-xl p-2">
                {results.map((song, i) => (
                  <div key={song.id} onClick={() => handlePlayTrack(song, results)}>
                    <SongCard song={song} index={i} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center text-muted-foreground py-12">Aucun résultat trouvé pour « {debouncedQuery} »</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPage;
