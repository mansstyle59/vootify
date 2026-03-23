import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { jiosaavnApi } from "@/lib/jiosaavnApi";
import { usePlayerStore } from "@/stores/playerStore";
import { SongCard, SongSkeleton } from "@/components/MusicCards";
import { Search as SearchIcon, X, Clock, TrendingUp, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Song } from "@/data/mockData";

const RECENT_SEARCHES_KEY = "voo-recent-searches";
const MAX_RECENT = 8;

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
  } catch { return []; }
}

function saveRecentSearch(q: string) {
  const recent = getRecentSearches().filter((r) => r !== q);
  recent.unshift(q);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function removeRecentSearch(q: string) {
  const recent = getRecentSearches().filter((r) => r !== q);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent));
}

const trendingSuggestions = [
  "Ninho", "Aya Nakamura", "Jul", "Damso", "Rihanna",
  "Drake", "Tayc", "Gims", "Dua Lipa", "SDM",
  "Werenoi", "PLK", "Gazo", "Tiakola", "Burna Boy",
];

const SearchPage = () => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches());
  const [artistFilter, setArtistFilter] = useState<string | null>(null);
  const { play, setQueue } = usePlayerStore();

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    setArtistFilter(null);
    clearTimeout((window as any).__searchTimeout);
    (window as any).__searchTimeout = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 400);
  }, []);

  const handleBubbleClick = (term: string) => {
    setQuery(term);
    setDebouncedQuery(term);
    setArtistFilter(null);
  };

  const { data: results, isLoading } = useQuery({
    queryKey: ["deezer-search", debouncedQuery],
    queryFn: () => jiosaavnApi.search(debouncedQuery, 20),
    enabled: debouncedQuery.length >= 2,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (debouncedQuery.length >= 2 && results && results.length > 0) {
      saveRecentSearch(debouncedQuery);
      setRecentSearches(getRecentSearches());
    }
  }, [debouncedQuery, results]);

  // Extract unique artists from results
  const uniqueArtists = useMemo(() => {
    if (!results || results.length === 0) return [];
    const artistCount = new Map<string, number>();
    results.forEach((song) => {
      // Split combined artists and count each
      const artists = song.artist.split(", ");
      artists.forEach((a) => {
        const name = a.trim();
        if (name && name !== "Artiste inconnu") {
          artistCount.set(name, (artistCount.get(name) || 0) + 1);
        }
      });
    });
    // Sort by frequency, return top artists
    return Array.from(artistCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  }, [results]);

  // Filter results by selected artist
  const filteredResults = useMemo(() => {
    if (!results) return [];
    if (!artistFilter) return results;
    return results.filter((song) => song.artist.includes(artistFilter));
  }, [results, artistFilter]);

  const handlePlayTrack = (song: Song, allSongs: Song[]) => {
    setQueue(allSongs);
    play(song);
  };

  const handleRemoveRecent = (term: string) => {
    removeRecentSearch(term);
    setRecentSearches(getRecentSearches());
  };

  const genres = ["Pop", "Rock", "Hip Hop", "Electronic", "Jazz", "R&B", "Reggaeton", "Français"];

  return (
    <div className="p-4 md:p-8 pb-32 max-w-7xl mx-auto">
      {/* Search bar */}
      <div className="relative mb-5">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Rechercher des chansons, artistes..."
          className="w-full pl-12 pr-10 py-3.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
        />
        {query && (
          <button onClick={() => { setQuery(""); setDebouncedQuery(""); setArtistFilter(null); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {!debouncedQuery ? (
        <div className="space-y-6">
          {/* Recent searches bubbles */}
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recherches récentes</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term, i) => (
                  <motion.div
                    key={term}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="group flex items-center"
                  >
                    <button
                      onClick={() => handleBubbleClick(term)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-secondary/80 border border-border text-sm text-foreground hover:bg-primary/15 hover:border-primary/30 transition-all"
                    >
                      {term}
                    </button>
                    <button
                      onClick={() => handleRemoveRecent(term)}
                      className="ml-0.5 p-1 rounded-full text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Trending bubbles */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tendances</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {trendingSuggestions.map((term, i) => (
                <motion.button
                  key={term}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => handleBubbleClick(term)}
                  className="px-3.5 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-foreground hover:bg-primary/20 hover:border-primary/40 transition-all"
                >
                  {term}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Genre grid */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Parcourir les genres</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {genres.map((genre, i) => (
                <motion.button
                  key={genre}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleBubbleClick(genre)}
                  className="glass-panel-light rounded-xl p-6 text-left hover-glass"
                >
                  <span className="font-display font-semibold text-foreground">{genre}</span>
                </motion.button>
              ))}
            </div>
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
              {/* Artist filter bubbles */}
              {uniqueArtists.length > 1 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Artistes</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    <button
                      onClick={() => setArtistFilter(null)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        !artistFilter
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/80 border border-border text-foreground hover:bg-primary/15"
                      }`}
                    >
                      Tous
                    </button>
                    {uniqueArtists.map((artist) => (
                      <button
                        key={artist}
                        onClick={() => setArtistFilter(artistFilter === artist ? null : artist)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          artistFilter === artist
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary/80 border border-border text-foreground hover:bg-primary/15"
                        }`}
                      >
                        {artist}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground mb-3">
                {filteredResults.length} résultat{filteredResults.length > 1 ? "s" : ""}
                {artistFilter && <> de <span className="text-primary font-medium">{artistFilter}</span></>}
              </p>
              <div className="glass-panel-light rounded-xl p-2">
                {filteredResults.map((song, i) => (
                  <div key={song.id} onClick={() => handlePlayTrack(song, filteredResults)}>
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
