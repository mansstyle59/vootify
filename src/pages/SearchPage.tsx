import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { jiosaavnApi } from "@/lib/jiosaavnApi";
import { deezerApi } from "@/lib/deezerApi";
import { usePlayerStore } from "@/stores/playerStore";
import { musicDb } from "@/lib/musicDb";
import { SongCard, SongSkeleton } from "@/components/MusicCards";
import { Search as SearchIcon, X, Clock, TrendingUp, User, Music, Mic2, Disc3, Zap, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Song, Album } from "@/data/mockData";

const trendingSuggestions = [
  "Ninho", "Aya Nakamura", "Jul", "Damso", "Rihanna",
  "Drake", "Tayc", "Gims", "Dua Lipa", "SDM",
  "Werenoi", "PLK", "Gazo", "Tiakola", "Burna Boy",
];

const GENRE_CARDS: { name: string; gradient: string; icon: React.ElementType }[] = [
  { name: "Pop", gradient: "from-pink-500 to-rose-400", icon: Music },
  { name: "Hip Hop", gradient: "from-amber-500 to-orange-500", icon: Mic2 },
  { name: "Rock", gradient: "from-red-600 to-red-400", icon: Zap },
  { name: "R&B", gradient: "from-purple-600 to-violet-400", icon: Disc3 },
  { name: "Electronic", gradient: "from-cyan-500 to-blue-500", icon: Zap },
  { name: "Jazz", gradient: "from-yellow-600 to-amber-400", icon: Music },
  { name: "Reggaeton", gradient: "from-green-500 to-emerald-400", icon: Mic2 },
  { name: "Français", gradient: "from-blue-600 to-indigo-400", icon: Disc3 },
];

function AlbumCard({ album, onClick }: { album: Album; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex-shrink-0 w-40 group text-left">
      <div className="relative w-40 h-40 rounded-2xl overflow-hidden mb-2.5 shadow-lg ring-1 ring-border/10">
        <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <Disc3 className="w-4 h-4 text-primary-foreground" />
          </div>
        </div>
      </div>
      <p className="text-sm font-semibold text-foreground truncate">{album.title}</p>
      <p className="text-xs text-muted-foreground truncate">{album.artist} · {album.year}</p>
    </button>
  );
}

type SearchSource = "all" | "jiosaavn" | "deezer";

const SearchPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [suggestQuery, setSuggestQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const userId = usePlayerStore((s) => s.userId);

  // Load search history from DB
  useEffect(() => {
    if (userId) {
      musicDb.getSearchHistory(userId).then(setRecentSearches).catch(console.error);
    }
  }, [userId]);
  const [artistFilter, setArtistFilter] = useState<string | null>(null);
  const [source, setSource] = useState<SearchSource>("all");
  const [jsPage, setJsPage] = useState(1);
  const [dzPage, setDzPage] = useState(1);
  const [allJsResults, setAllJsResults] = useState<Song[]>([]);
  const [allDzResults, setAllDzResults] = useState<Song[]>([]);
  const [hasMoreJs, setHasMoreJs] = useState(true);
  const [hasMoreDz, setHasMoreDz] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { play, setQueue, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close suggestions on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fast autocomplete query (200ms debounce, lightweight)
  const { data: suggestions } = useQuery({
    queryKey: ["autocomplete", suggestQuery],
    queryFn: () => jiosaavnApi.search(suggestQuery, 5),
    enabled: suggestQuery.length >= 2 && showSuggestions,
    staleTime: 60 * 1000,
  });

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    setArtistFilter(null);
    setShowSuggestions(true);

    // Fast debounce for suggestions
    clearTimeout((window as any).__suggestTimeout);
    (window as any).__suggestTimeout = setTimeout(() => {
      setSuggestQuery(value.trim());
    }, 200);

    // Normal debounce for full search
    clearTimeout((window as any).__searchTimeout);
    (window as any).__searchTimeout = setTimeout(() => {
      setDebouncedQuery(value.trim());
      setJsPage(1); setDzPage(1);
      setAllJsResults([]); setAllDzResults([]);
      setHasMoreJs(true); setHasMoreDz(true);
    }, 400);
  }, []);

  const commitSearch = useCallback((term: string) => {
    setQuery(term);
    setDebouncedQuery(term);
    setSuggestQuery("");
    setShowSuggestions(false);
    setArtistFilter(null);
    setJsPage(1); setDzPage(1);
    setAllJsResults([]); setAllDzResults([]);
    setHasMoreJs(true); setHasMoreDz(true);
    inputRef.current?.blur();
  }, []);

  const handleBubbleClick = (term: string) => {
    commitSearch(term);
  };

  // Unique suggestion artists + titles for autocomplete
  const autocompleteSuggestions = useMemo(() => {
    if (!suggestions || suggestions.length === 0) return [];
    const items: { type: "song" | "artist"; label: string; sub?: string; coverUrl?: string; song?: Song }[] = [];

    // Extract unique artists
    const seenArtists = new Set<string>();
    suggestions.forEach((song) => {
      const artist = song.artist.split(",")[0].trim();
      if (artist && !seenArtists.has(artist.toLowerCase())) {
        seenArtists.add(artist.toLowerCase());
        items.push({ type: "artist", label: artist, coverUrl: song.coverUrl });
      }
    });

    // Add songs
    suggestions.slice(0, 4).forEach((song) => {
      items.push({ type: "song", label: song.title, sub: song.artist, coverUrl: song.coverUrl, song });
    });

    return items.slice(0, 6);
  }, [suggestions]);

  const PAGE_SIZE = 50;

  const isFullStream = (s: Song) => !!s.streamUrl && !s.streamUrl.includes("dzcdn.net") && !s.streamUrl.includes("cdn-preview");

  // JioSaavn results (page 1)
  const { data: jsResults, isLoading: jsLoading } = useQuery({
    queryKey: ["jiosaavn-search", debouncedQuery],
    queryFn: () => jiosaavnApi.search(debouncedQuery, PAGE_SIZE),
    enabled: debouncedQuery.length >= 2 && (source === "all" || source === "jiosaavn"),
    staleTime: 2 * 60 * 1000,
  });

  // Deezer results (page 1) — resolve to full streams
  const { data: dzResults, isLoading: dzLoading } = useQuery({
    queryKey: ["deezer-search", debouncedQuery],
    queryFn: async () => {
      const raw = await deezerApi.searchTracks(debouncedQuery, PAGE_SIZE);
      // Resolve full streams in parallel (batch of 6 to avoid overwhelming)
      const resolved: Song[] = [];
      for (let i = 0; i < raw.length; i += 6) {
        const batch = raw.slice(i, i + 6);
        const results = await Promise.all(batch.map((s) => deezerApi.resolveFullStream(s)));
        resolved.push(...results);
      }
      // Only keep songs with full streams
      return resolved.filter(isFullStream);
    },
    enabled: debouncedQuery.length >= 2 && (source === "all" || source === "deezer"),
    staleTime: 2 * 60 * 1000,
  });

  // Accumulate results from initial + extra pages
  useEffect(() => {
    if (jsResults) {
      setAllJsResults(jsResults.filter(isFullStream));
      setHasMoreJs(jsResults.length >= PAGE_SIZE);
    }
  }, [jsResults]);

  useEffect(() => {
    if (dzResults) {
      setAllDzResults(dzResults);
      setHasMoreDz(dzResults.length >= PAGE_SIZE / 2);
    }
  }, [dzResults]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !debouncedQuery) return;
    const canLoadJs = (source === "all" || source === "jiosaavn") && hasMoreJs;
    const canLoadDz = (source === "all" || source === "deezer") && hasMoreDz;
    if (!canLoadJs && !canLoadDz) return;

    setLoadingMore(true);
    try {
      const promises: Promise<void>[] = [];
      if (canLoadJs) {
        const nextPage = jsPage + 1;
        promises.push(
          jiosaavnApi.search(debouncedQuery, PAGE_SIZE, nextPage).then((res) => {
            setAllJsResults((prev) => [...prev, ...res]);
            setHasMoreJs(res.length >= PAGE_SIZE);
            setJsPage(nextPage);
          })
        );
      }
      if (canLoadDz) {
        const nextPage = dzPage + 1;
        const offset = dzPage * PAGE_SIZE;
        promises.push(
          deezerApi.searchTracks(debouncedQuery, PAGE_SIZE, offset).then((res) => {
            setAllDzResults((prev) => [...prev, ...res]);
            setHasMoreDz(res.length >= PAGE_SIZE);
            setDzPage(nextPage);
          })
        );
      }
      await Promise.all(promises);
    } catch (e) {
      console.error("Failed to load more results:", e);
    }
    setLoadingMore(false);
  }, [loadingMore, debouncedQuery, source, hasMoreJs, hasMoreDz, jsPage, dzPage]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && debouncedQuery.length >= 2) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, debouncedQuery]);

  /** Normalize a string for dedup: lowercase, strip feat/ft, remove parens, trim */
  const normalize = useCallback((s: string) =>
    s.toLowerCase()
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/\bfeat\.?\s*/gi, "")
      .replace(/\bft\.?\s*/gi, "")
      .replace(/[''`]/g, "'")
      .replace(/[^a-z0-9\s']/g, "")
      .replace(/\s+/g, " ")
      .trim()
  , []);

  // Album results (JioSaavn)
  const { data: jsAlbumResults } = useQuery({
    queryKey: ["album-search-js", debouncedQuery],
    queryFn: () => jiosaavnApi.searchAlbums(debouncedQuery, 15),
    enabled: debouncedQuery.length >= 2 && (source === "all" || source === "jiosaavn"),
    staleTime: 2 * 60 * 1000,
  });

  // Album results (Deezer)
  const { data: dzAlbumResults } = useQuery({
    queryKey: ["album-search-dz", debouncedQuery],
    queryFn: () => deezerApi.searchAlbums(debouncedQuery, 15),
    enabled: debouncedQuery.length >= 2 && (source === "all" || source === "deezer"),
    staleTime: 2 * 60 * 1000,
  });

  // Merge albums, deduplicated by normalized title+artist
  const albumResults = useMemo(() => {
    if (source === "jiosaavn") return jsAlbumResults || [];
    if (source === "deezer") return dzAlbumResults || [];
    const js = jsAlbumResults || [];
    const dz = dzAlbumResults || [];
    const seen = new Set<string>();
    const merged: Album[] = [];
    for (const album of [...js, ...dz]) {
      const key = `${normalize(album.title)}::${normalize(album.artist)}`;
      if (!seen.has(key)) { seen.add(key); merged.push(album); }
    }
    return merged;
  }, [jsAlbumResults, dzAlbumResults, source, normalize]);

  const isLoading = jsLoading || dzLoading;

  const mergedResults = useMemo(() => {
    const filterFullStreams = (songs: Song[]) =>
      songs.filter((s) => s.streamUrl && !s.streamUrl.includes("dzcdn.net"));

    if (source === "jiosaavn") return allJsResults;
    if (source === "deezer") return filterFullStreams(allDzResults);
    const js = allJsResults;
    const dz = filterFullStreams(allDzResults);
    const seen = new Set<string>();
    const merged: Song[] = [];

    for (const song of [...js, ...dz]) {
      const key = `${normalize(song.title)}::${normalize(song.artist.split(",")[0])}`;
      if (!seen.has(key)) { seen.add(key); merged.push(song); }
    }

    // Rank by relevance to query
    const q = normalize(debouncedQuery);
    const qWords = q.split(" ").filter(Boolean);

    merged.sort((a, b) => {
      const scoreRelevance = (song: Song) => {
        const t = normalize(song.title);
        const ar = normalize(song.artist);
        let score = 0;
        if (t === q) score += 100;
        else if (t.startsWith(q)) score += 80;
        else if (t.includes(q)) score += 60;
        if (ar === q) score += 90;
        else if (ar.startsWith(q)) score += 70;
        else if (ar.includes(q)) score += 50;
        for (const w of qWords) {
          if (t.includes(w)) score += 10;
          if (ar.includes(w)) score += 8;
        }
        if (song.streamUrl) score += 5;
        return score;
      };
      return scoreRelevance(b) - scoreRelevance(a);
    });

    return merged;
  }, [allJsResults, allDzResults, source, normalize, debouncedQuery]);

  useEffect(() => {
    if (debouncedQuery.length >= 2 && mergedResults.length > 0 && userId) {
      musicDb.saveSearchQuery(userId, debouncedQuery).then(() => {
        musicDb.getSearchHistory(userId).then(setRecentSearches);
      });
    }
  }, [debouncedQuery, mergedResults, userId]);

  const uniqueArtists = useMemo(() => {
    if (!mergedResults || mergedResults.length === 0) return [];
    const artistCount = new Map<string, number>();
    mergedResults.forEach((song) => {
      song.artist.split(", ").forEach((a) => {
        const name = a.trim();
        if (name && name !== "Artiste inconnu") artistCount.set(name, (artistCount.get(name) || 0) + 1);
      });
    });
    return Array.from(artistCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name]) => name);
  }, [mergedResults]);

  const filteredResults = useMemo(() => {
    if (!mergedResults) return [];
    if (!artistFilter) return mergedResults;
    return mergedResults.filter((song) => song.artist.includes(artistFilter));
  }, [mergedResults, artistFilter]);

  const handlePlayTrack = async (song: Song, allSongs: Song[]) => {
    if (currentSong?.id === song.id) { togglePlay(); return; }
    const resolved = song.id.startsWith("dz-") ? await deezerApi.resolveFullStream(song) : song;
    setQueue(allSongs);
    play(resolved);
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

  return (
    <div className="pb-40 max-w-7xl mx-auto">
      {/* Header */}
      <div className="px-4 md:px-8 pt-[max(1.5rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-1">Rechercher</h1>
        <p className="text-sm text-muted-foreground mb-5">Trouvez vos artistes et morceaux préférés</p>
      </div>

      {/* Search bar with autocomplete */}
      <div className="px-4 md:px-8 mb-4" ref={searchRef}>
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => query.length >= 2 && setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitSearch(query.trim());
              }
              if (e.key === "Escape") {
                setShowSuggestions(false);
              }
            }}
            placeholder="Titres, artistes, albums..."
            className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all"
          />
          {query && (
            <button onClick={() => { setQuery(""); setDebouncedQuery(""); setSuggestQuery(""); setArtistFilter(null); setShowSuggestions(false); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10">
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Autocomplete dropdown */}
          <AnimatePresence>
            {showSuggestions && query.length >= 2 && autocompleteSuggestions.length > 0 && (
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
                    onClick={() => {
                      if (item.type === "artist") {
                        commitSearch(item.label);
                      } else if (item.song) {
                        commitSearch(item.label);
                      }
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-secondary/60 transition-colors"
                  >
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt=""
                        className={`w-9 h-9 object-cover flex-shrink-0 ${item.type === "artist" ? "rounded-full" : "rounded-md"}`}
                      />
                    ) : (
                      <div className={`w-9 h-9 bg-muted flex items-center justify-center flex-shrink-0 ${item.type === "artist" ? "rounded-full" : "rounded-md"}`}>
                        {item.type === "artist" ? <User className="w-4 h-4 text-muted-foreground" /> : <Music className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
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

      {/* Source filter (visible when searching) */}
      {debouncedQuery && (
        <div className="px-4 md:px-8 mb-4">
          <div className="flex gap-2">
            {(["all", "jiosaavn", "deezer"] as SearchSource[]).map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  source === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {s === "all" ? "Toutes sources" : s === "jiosaavn" ? "JioSaavn" : "Deezer"}
              </button>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!debouncedQuery ? (
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
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recherches récentes</h2>
                  </div>
                  <button onClick={clearAllRecent} className="text-xs text-muted-foreground hover:text-primary transition-colors">
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
                        onClick={() => handleBubbleClick(term)}
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

            {/* Trending */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tendances</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {trendingSuggestions.map((term, i) => (
                  <motion.button
                    key={term}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => handleBubbleClick(term)}
                    className="px-3.5 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-foreground hover:bg-primary/20 hover:border-primary/40 transition-all"
                  >
                    {term}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Genre cards with gradients */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Parcourir les genres</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {GENRE_CARDS.map((genre, i) => {
                  const Icon = genre.icon;
                  return (
                    <motion.button
                      key={genre.name}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => handleBubbleClick(genre.name)}
                      className={`relative rounded-2xl p-5 text-left overflow-hidden bg-gradient-to-br ${genre.gradient} hover:scale-[1.03] active:scale-[0.98] transition-transform`}
                    >
                      <Icon className="absolute -bottom-2 -right-2 w-16 h-16 text-white/15 rotate-12" />
                      <span className="relative font-display font-bold text-white text-sm">{genre.name}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-4 md:px-8"
          >
            {isLoading && (!albumResults || albumResults.length === 0) ? (
              <div className="rounded-xl bg-secondary/30 overflow-hidden">
                {Array.from({ length: 8 }).map((_, i) => <SongSkeleton key={i} />)}
              </div>
            ) : (
              <>
                {/* Albums section */}
                {albumResults && albumResults.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Disc3 className="w-4 h-4 text-primary" />
                      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Albums</h2>
                    </div>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                      {albumResults.map((album) => (
                        <AlbumCard key={album.id} album={album} onClick={() => navigate(`/album/${album.id}`)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Artist filter bubbles */}
                {uniqueArtists.length > 1 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtrer par artiste</span>
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
                          onClick={() => setArtistFilter(artistFilter === artist ? null : artist)}
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
                      {filteredResults.length} résultat{filteredResults.length > 1 ? "s" : ""}
                      {artistFilter && <> de <span className="text-primary font-medium">{artistFilter}</span></>}
                    </p>
                    <div className="rounded-xl bg-secondary/30 overflow-hidden">
                      {filteredResults.map((song, i) => (
                        <div key={`${song.id}-${i}`} onClick={() => handlePlayTrack(song, filteredResults)}>
                          <SongCard song={song} index={i} />
                        </div>
                      ))}
                    </div>

                    {/* Infinite scroll sentinel */}
                    {(hasMoreJs || hasMoreDz) && !artistFilter && (
                      <div ref={sentinelRef} className="flex items-center justify-center py-6">
                        {loadingMore && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            Chargement...
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : !albumResults?.length && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16"
                  >
                    <SearchIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucun résultat pour « <span className="text-foreground font-medium">{debouncedQuery}</span> »</p>
                    <p className="text-sm text-muted-foreground/60 mt-1">Essayez un autre terme ou vérifiez l'orthographe</p>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchPage;
