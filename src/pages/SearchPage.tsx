import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ScrollBlurHeader } from "@/components/ScrollBlurHeader";
import { usePlayerStore } from "@/stores/playerStore";
import { musicDb } from "@/lib/musicDb";
import { SongCard, SongSkeleton } from "@/components/MusicCards";
import { VirtualSongList } from "@/components/VirtualSongList";
import {
  useAllLocalSongs,
  searchLocalSongs,
  getSuggestions,
  extractArtists,
} from "@/hooks/useLocalSearch";
import { deezerApi } from "@/lib/deezerApi";
import {
  Search as SearchIcon,
  X,
  Clock,
  TrendingUp,
  User,
  Music,
  Mic2,
  Disc3,
  Zap,
  Globe,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Song } from "@/data/mockData";

const SearchPage = () => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const userId = usePlayerStore((s) => s.userId);
  const recentlyPlayed = usePlayerStore((s) => s.recentlyPlayed);
  const { play, setQueue, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [artistFilter, setArtistFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"local" | "deezer">("local");

  // Deezer search state
  const [deezerResults, setDeezerResults] = useState<Song[]>([]);
  const [deezerLoading, setDeezerLoading] = useState(false);

  // Load all local songs once (cached)
  const { data: allSongs, isLoading } = useAllLocalSongs();

  // Recently played IDs for popularity boost
  const recentIds = useMemo(
    () => new Set(recentlyPlayed.map((s) => s.id)),
    [recentlyPlayed]
  );

  // Load search history
  useEffect(() => {
    if (userId) {
      musicDb.getSearchHistory(userId).then(setRecentSearches).catch(console.error);
    }
  }, [userId]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounce search
  const handleChange = useCallback((value: string) => {
    setQuery(value);
    setArtistFilter(null);
    setShowSuggestions(true);

    clearTimeout((window as any).__searchTimeout);
    (window as any).__searchTimeout = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 200);
  }, []);

  const commitSearch = useCallback((term: string) => {
    setQuery(term);
    setDebouncedQuery(term);
    setShowSuggestions(false);
    setArtistFilter(null);
    inputRef.current?.blur();
  }, []);

  // Deezer search when query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setDeezerResults([]);
      return;
    }
    let cancelled = false;
    setDeezerLoading(true);
    deezerApi
      .searchTracks(debouncedQuery, 30)
      .then((results) => {
        if (!cancelled) setDeezerResults(results);
      })
      .catch(() => {
        if (!cancelled) setDeezerResults([]);
      })
      .finally(() => {
        if (!cancelled) setDeezerLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Autocomplete suggestions (instant, from memory)
  const autocompleteSuggestions = useMemo(() => {
    if (!allSongs || query.length < 1) return [];
    return getSuggestions(allSongs, query, 6);
  }, [allSongs, query]);

  // Search results (fuzzy, scored)
  const searchResults = useMemo(() => {
    if (!allSongs || debouncedQuery.length < 1) return [];
    return searchLocalSongs(allSongs, debouncedQuery, recentIds).map((r) => r.song);
  }, [allSongs, debouncedQuery, recentIds]);

  // Filter Deezer results: remove songs that exist locally (by matching title+artist)
  const filteredDeezerResults = useMemo(() => {
    if (!allSongs || allSongs.length === 0) return deezerResults;
    const localSet = new Set(
      allSongs.map((s) => `${s.title.toLowerCase()}::${s.artist.toLowerCase()}`)
    );
    return deezerResults.filter(
      (s) => !localSet.has(`${s.title.toLowerCase()}::${s.artist.toLowerCase()}`)
    );
  }, [deezerResults, allSongs]);

  // Artist filter
  const uniqueArtists = useMemo(() => {
    if (searchResults.length === 0) return [];
    return extractArtists(searchResults).slice(0, 8);
  }, [searchResults]);

  const filteredResults = useMemo(() => {
    if (!artistFilter) return searchResults;
    return searchResults.filter((s) => s.artist.includes(artistFilter));
  }, [searchResults, artistFilter]);

  // Save search to history
  useEffect(() => {
    if (debouncedQuery.length >= 2 && (searchResults.length > 0 || deezerResults.length > 0) && userId) {
      musicDb.saveSearchQuery(userId, debouncedQuery).then(() => {
        musicDb.getSearchHistory(userId).then(setRecentSearches);
      });
    }
  }, [debouncedQuery, searchResults.length, deezerResults.length, userId]);

  // Alternative suggestions when no results
  const alternativeSuggestions = useMemo(() => {
    if (!allSongs || searchResults.length > 0 || debouncedQuery.length < 2) return [];
    const artists = extractArtists(allSongs);
    return artists.slice(0, 6);
  }, [allSongs, searchResults, debouncedQuery]);

  // Popular artists for explore view
  const trendingArtists = useMemo(() => {
    if (!allSongs) return [];
    return extractArtists(allSongs).slice(0, 15);
  }, [allSongs]);

  const handlePlayTrack = (song: Song, allSongs: Song[]) => {
    if (currentSong?.id === song.id) {
      togglePlay();
      return;
    }
    setQueue(allSongs);
    play(song);
  };

  const handleRemoveRecent = (term: string) => {
    if (userId) {
      musicDb.removeSearchQuery(userId, term).then(() => {
        musicDb.getSearchHistory(userId).then(setRecentSearches);
      });
    }
  };

  const clearAllRecent = () => {
    if (userId) {
      musicDb.clearSearchHistory(userId).then(() => setRecentSearches([]));
    }
  };

  // Auto-switch to deezer tab if no local results but deezer has results
  useEffect(() => {
    if (debouncedQuery.length >= 2 && searchResults.length === 0 && filteredDeezerResults.length > 0) {
      setActiveTab("deezer");
    } else if (debouncedQuery.length >= 2 && searchResults.length > 0) {
      setActiveTab("local");
    }
  }, [debouncedQuery, searchResults.length, filteredDeezerResults.length]);

  return (
    <div className="pb-40 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <ScrollBlurHeader>
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/5 pointer-events-none" />
          <div className="relative px-4 md:px-8 pt-[max(2rem,env(safe-area-inset-top))] pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <SearchIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
                  Rechercher
                </h1>
                <p className="text-sm text-muted-foreground">
                  Bibliothèque locale & Deezer
                </p>
              </div>
            </div>
          </div>
        </div>
      </ScrollBlurHeader>

      {/* Search bar */}
      <div className="px-4 md:px-8 mb-4" ref={searchRef}>
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => query.length >= 1 && setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitSearch(query.trim());
              if (e.key === "Escape") setShowSuggestions(false);
            }}
            placeholder="Titres, artistes, albums..."
            className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setDebouncedQuery("");
                setArtistFilter(null);
                setShowSuggestions(false);
                setDeezerResults([]);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Autocomplete dropdown */}
          <AnimatePresence>
            {showSuggestions && query.length >= 1 && autocompleteSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full mt-1.5 rounded-xl bg-card border border-border shadow-xl overflow-hidden z-50"
              >
                {autocompleteSuggestions.map((item, i) => (
                  <button
                    key={`${item.type}-${item.label}-${i}`}
                    onClick={() => commitSearch(item.label)}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-secondary/60 transition-colors"
                  >
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt=""
                        className={`w-9 h-9 object-cover flex-shrink-0 ${
                          item.type === "artist" ? "rounded-full" : "rounded-md"
                        }`}
                      />
                    ) : (
                      <div
                        className={`w-9 h-9 bg-muted flex items-center justify-center flex-shrink-0 ${
                          item.type === "artist" ? "rounded-full" : "rounded-md"
                        }`}
                      >
                        {item.type === "artist" ? (
                          <User className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Music className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.type === "artist" ? "Artiste" : item.sub}
                      </p>
                    </div>
                    <SearchIcon className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!debouncedQuery ? (
          /* ─── Explore view ─── */
          <motion.div
            key="explore"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 md:px-8 space-y-6"
          >
            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Recherches récentes
                    </h2>
                  </div>
                  <button
                    onClick={clearAllRecent}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    Tout effacer
                  </button>
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
                        onClick={() => commitSearch(term)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-secondary/80 border border-border text-sm text-foreground hover:bg-primary/15 hover:border-primary/30 transition-all"
                      >
                        <Clock className="w-3 h-3 text-muted-foreground" />
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

            {/* Popular artists from catalog */}
            {trendingArtists.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Artistes populaires
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {trendingArtists.map((artist, i) => (
                    <motion.button
                      key={artist}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => commitSearch(artist)}
                      className="px-3.5 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-foreground hover:bg-primary/20 hover:border-primary/40 transition-all"
                    >
                      {artist}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            {allSongs && allSongs.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <Music className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Votre bibliothèque
                  </h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                    <p className="text-2xl font-bold text-foreground">{allSongs.length}</p>
                    <p className="text-xs text-muted-foreground">Morceaux</p>
                  </div>
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/10">
                    <p className="text-2xl font-bold text-foreground">
                      {new Set(allSongs.map((s) => s.artist.split(",")[0].trim())).size}
                    </p>
                    <p className="text-xs text-muted-foreground">Artistes</p>
                  </div>
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-secondary to-secondary/60 border border-border">
                    <p className="text-2xl font-bold text-foreground">
                      {new Set(allSongs.filter((s) => s.album).map((s) => s.album)).size}
                    </p>
                    <p className="text-xs text-muted-foreground">Albums</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* ─── Results view ─── */
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-4 md:px-8"
          >
            {/* Tab switcher */}
            <div className="flex gap-1 mb-4 p-1 rounded-xl bg-secondary/60 border border-border">
              <button
                onClick={() => setActiveTab("local")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "local"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Music className="w-4 h-4" />
                Bibliothèque
                {searchResults.length > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === "local" ? "bg-primary-foreground/20" : "bg-muted"
                  }`}>
                    {searchResults.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("deezer")}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "deezer"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Globe className="w-4 h-4" />
                Deezer
                {deezerLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : filteredDeezerResults.length > 0 ? (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === "deezer" ? "bg-primary-foreground/20" : "bg-muted"
                  }`}>
                    {filteredDeezerResults.length}
                  </span>
                ) : null}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "local" ? (
                <motion.div
                  key="local-results"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  {isLoading ? (
                    <div className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] overflow-hidden">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <SongSkeleton key={i} />
                      ))}
                    </div>
                  ) : (
                    <>
                      {/* Artist filter */}
                      {uniqueArtists.length > 1 && (
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Filtrer par artiste
                            </span>
                          </div>
                          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                            <button
                              onClick={() => setArtistFilter(null)}
                              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                !artistFilter
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                              }`}
                            >
                              Tous
                            </button>
                            {uniqueArtists.map((artist) => (
                              <button
                                key={artist}
                                onClick={() =>
                                  setArtistFilter(artistFilter === artist ? null : artist)
                                }
                                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                  artistFilter === artist
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                }`}
                              >
                                {artist}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {filteredResults.length > 0 ? (
                        <>
                          <p className="text-sm text-muted-foreground mb-3">
                            {filteredResults.length} résultat
                            {filteredResults.length > 1 ? "s" : ""}
                            {artistFilter && (
                              <>
                                {" "}de{" "}
                                <span className="text-primary font-medium">{artistFilter}</span>
                              </>
                            )}
                          </p>
                          <VirtualSongList
                            songs={filteredResults}
                            onClickSong={(song) => handlePlayTrack(song, filteredResults)}
                            className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] overflow-hidden"
                          />
                        </>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-center py-12"
                        >
                          <Music className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                          <p className="text-foreground font-medium mb-1">
                            Aucun résultat local
                          </p>
                          <p className="text-sm text-muted-foreground/60 mb-4">
                            Essayez l'onglet Deezer pour écouter un extrait 30s
                          </p>
                          <button
                            onClick={() => setActiveTab("deezer")}
                            className="px-4 py-2 rounded-full bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25 transition-colors"
                          >
                            <Globe className="w-4 h-4 inline mr-1.5" />
                            Chercher sur Deezer
                          </button>
                        </motion.div>
                      )}
                    </>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="deezer-results"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                >
                  {deezerLoading ? (
                    <div className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] overflow-hidden">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <SongSkeleton key={i} />
                      ))}
                    </div>
                  ) : filteredDeezerResults.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-sm text-muted-foreground">
                          {filteredDeezerResults.length} résultat{filteredDeezerResults.length > 1 ? "s" : ""} Deezer
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                          EXTRAIT 30s
                        </span>
                      </div>
                      <VirtualSongList
                        songs={filteredDeezerResults}
                        onClickSong={(song) => handlePlayTrack(song, filteredDeezerResults)}
                        className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] overflow-hidden"
                      />
                    </>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-16"
                    >
                      <Globe className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-foreground font-medium mb-1">
                        Aucun résultat Deezer pour «{" "}
                        <span className="text-primary">{debouncedQuery}</span> »
                      </p>
                      <p className="text-sm text-muted-foreground/60 mt-1">
                        Essayez un autre terme
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchPage;
