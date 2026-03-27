import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { hdCache } from "@/lib/hdCache";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { deezerApi } from "@/lib/deezerApi";
import { usePlayerStore } from "@/stores/playerStore";
import { musicDb } from "@/lib/musicDb";
import { SongCard, SongSkeleton } from "@/components/MusicCards";
import { Search as SearchIcon, X, Clock, TrendingUp, User, Music, Mic2, Disc3, Zap, Loader2, Trash2, ListMusic } from "lucide-react";
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

const SearchPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [suggestQuery, setSuggestQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const userId = usePlayerStore((s) => s.userId);

  useEffect(() => {
    if (userId) {
      musicDb.getSearchHistory(userId).then(setRecentSearches).catch(console.error);
    }
  }, [userId]);

  const [artistFilter, setArtistFilter] = useState<string | null>(null);
  const [hdOnly, setHdOnly] = useState(false);
  const [customOnly, setCustomOnly] = useState(false);
  const [resolveProgress, setResolveProgress] = useState<{ resolved: number; total: number } | null>(null);
  const [dzPage, setDzPage] = useState(1);
  const [allDzResults, setAllDzResults] = useState<Song[]>([]);
  const [hasMoreDz, setHasMoreDz] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { play, setQueue, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Autocomplete via Deezer
  const { data: suggestions } = useQuery({
    queryKey: ["autocomplete-dz", suggestQuery],
    queryFn: () => deezerApi.searchTracks(suggestQuery, 5),
    enabled: suggestQuery.length >= 2 && showSuggestions,
    staleTime: 60 * 1000,
  });

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    setArtistFilter(null);
    setShowSuggestions(true);

    clearTimeout((window as any).__suggestTimeout);
    (window as any).__suggestTimeout = setTimeout(() => {
      setSuggestQuery(value.trim());
    }, 200);

    clearTimeout((window as any).__searchTimeout);
    (window as any).__searchTimeout = setTimeout(() => {
      setDebouncedQuery(value.trim());
      setDzPage(1);
      setHasMoreDz(true);
    }, 400);
  }, []);

  const commitSearch = useCallback((term: string) => {
    setQuery(term);
    setDebouncedQuery(term);
    setSuggestQuery("");
    setShowSuggestions(false);
    setArtistFilter(null);
    setDzPage(1);
    setHasMoreDz(true);
    inputRef.current?.blur();
  }, []);

  const handleBubbleClick = (term: string) => {
    commitSearch(term);
  };

  const autocompleteSuggestions = useMemo(() => {
    if (!suggestions || suggestions.length === 0) return [];
    const items: { type: "song" | "artist"; label: string; sub?: string; coverUrl?: string; song?: Song }[] = [];

    const seenArtists = new Set<string>();
    suggestions.forEach((song) => {
      const artist = song.artist.split(",")[0].trim();
      if (artist && !seenArtists.has(artist.toLowerCase())) {
        seenArtists.add(artist.toLowerCase());
        items.push({ type: "artist", label: artist, coverUrl: song.coverUrl });
      }
    });

    suggestions.slice(0, 4).forEach((song) => {
      items.push({ type: "song", label: song.title, sub: song.artist, coverUrl: song.coverUrl, song });
    });

    return items.slice(0, 6);
  }, [suggestions]);

  const PAGE_SIZE = 50;

  const isFullStream = (s: Song) => !!s.streamUrl && !s.streamUrl.includes("dzcdn.net") && !s.streamUrl.includes("cdn-preview");

  // Deezer search (page 1)
  const { data: dzResults, isLoading: dzLoading } = useQuery({
    queryKey: ["deezer-search", debouncedQuery],
    queryFn: () => deezerApi.searchTracks(debouncedQuery, PAGE_SIZE),
    enabled: debouncedQuery.length >= 2,
    staleTime: 2 * 60 * 1000,
  });

  const [extraDzResults, setExtraDzResults] = useState<Song[]>([]);

  useEffect(() => {
    setExtraDzResults([]);
  }, [debouncedQuery]);

  useEffect(() => {
    const dz = [...(dzResults || []), ...extraDzResults];
    setAllDzResults(dz);
    setHasMoreDz((dzResults?.length || 0) >= PAGE_SIZE || extraDzResults.length > 0);
  }, [dzResults, extraDzResults]);

  // Background HD resolution — triggered only when dzResults change, NOT allDzResults
  const resolveAbortRef = useRef<AbortController | null>(null);
  const resolvedIdsRef = useRef<Set<string>>(new Set());

  // Reset resolved tracking when query changes
  useEffect(() => {
    resolvedIdsRef.current.clear();
  }, [debouncedQuery]);

  useEffect(() => {
    resolveAbortRef.current?.abort();

    if (!dzResults || dzResults.length === 0) {
      setResolveProgress(null);
      return;
    }

    const previewTracks = dzResults.filter(
      (s) => s.id.startsWith("dz-") && !resolvedIdsRef.current.has(s.id) && s.streamUrl && (s.streamUrl.includes("dzcdn.net") || s.streamUrl.includes("cdn-preview"))
    ).slice(0, 40);

    if (previewTracks.length === 0) {
      setResolveProgress(null);
      return;
    }

    const controller = new AbortController();
    resolveAbortRef.current = controller;
    let resolvedCount = 0;
    const total = previewTracks.length;
    setResolveProgress({ resolved: 0, total });

    const resolveInBackground = async () => {
      let upgradedCount = 0;
      for (let i = 0; i < previewTracks.length; i += 6) {
        if (controller.signal.aborted) return;
        const batch = previewTracks.slice(i, i + 6);
        const resolved = await Promise.all(
          batch.map((s) => deezerApi.resolveFullStream(s).catch(() => s))
        );
        if (controller.signal.aborted) return;

        // Mark as resolved so we don't re-process
        batch.forEach((s) => resolvedIdsRef.current.add(s.id));
        resolvedCount += batch.length;
        setResolveProgress({ resolved: resolvedCount, total });

        const resolvedMap = new Map(resolved.filter((r, idx) => r.streamUrl !== batch[idx].streamUrl).map((r) => [r.id, r]));
        upgradedCount += resolvedMap.size;
        if (resolvedMap.size > 0) {
          setAllDzResults((prev) =>
            prev.map((s) => resolvedMap.get(s.id) || s)
          );
        }
      }
      if (!controller.signal.aborted) {
        if (upgradedCount > 0) {
          toast.success(`${upgradedCount}/${total} morceaux upgradés en HD`);
        }
        setTimeout(() => setResolveProgress(null), 1500);
      }
    };

    resolveInBackground();
    return () => { controller.abort(); setResolveProgress(null); };
  }, [dzResults, debouncedQuery]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !debouncedQuery || !hasMoreDz) return;

    setLoadingMore(true);
    try {
      const nextPage = dzPage + 1;
      const offset = dzPage * PAGE_SIZE;
      const res = await deezerApi.searchTracks(debouncedQuery, PAGE_SIZE, offset);
      setExtraDzResults((prev) => [...prev, ...res]);
      setHasMoreDz(res.length >= PAGE_SIZE);
      setDzPage(nextPage);
    } catch (e) {
      console.error("Failed to load more results:", e);
    }
    setLoadingMore(false);
  }, [loadingMore, debouncedQuery, hasMoreDz, dzPage]);

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

  // Album results (Deezer only)
  const { data: dzAlbumResults } = useQuery({
    queryKey: ["album-search-dz", debouncedQuery],
    queryFn: () => deezerApi.searchAlbums(debouncedQuery, 15),
    enabled: debouncedQuery.length >= 2,
    staleTime: 2 * 60 * 1000,
  });

  const albumResults = dzAlbumResults || [];

  // Deezer playlist search
  const { data: dzPlaylistResults } = useQuery({
    queryKey: ["playlist-search-dz", debouncedQuery],
    queryFn: () => deezerApi.searchPlaylists(debouncedQuery, 12),
    enabled: debouncedQuery.length >= 2,
    staleTime: 2 * 60 * 1000,
  });

  const playlistResults = dzPlaylistResults || [];

  const mergedResults = useMemo(() => {
    const results = [...allDzResults];

    // French/Belgian/African francophone popular artists for priority boost
    const frenchArtists = new Set([
      "ninho", "aya nakamura", "jul", "damso", "gims", "maitre gims",
      "tayc", "sdm", "werenoi", "plk", "gazo", "tiakola", "angele",
      "stromae", "nekfeu", "orelsan", "booba", "pnl", "lacrim",
      "soprano", "dadju", "vegedream", "lomepal", "vald", "hamza",
      "romeo elvis", "sch", "koba lad", "niska", "mhd", "freeze corleone",
      "amir", "slimane", "vitaa", "kendji girac", "louane", "zaho",
      "lartiste", "heuss lenfoire", "rim k", "soolking", "rohff", "la fouine",
      "josman", "zola", "rk", "larry", "yanns", "alonzo", "kekra",
      "dinos", "alpha wann", "georgio", "dosseh", "kalash", "kalash criminel",
      "maes", "zkr", "guy2bezbar", "le juiice", "mister v", "bigflo et oli",
      "47ter", "lefa", "keblack", "imen es", "wejdene", "eva",
      "franglish", "gambi", "landy", "hornet la frappe", "gradur",
      "bosh", "da uzi", "green montana", "bolemvn", "benjamin epps",
      "lesram", "moha k", "dystinct", "timal", "so la lune",
      "fally ipupa", "gael faye", "pierre de maere", "clara luciani",
      "pomme", "juliette armanet", "keen v", "black m",
      "mika", "calogero", "christophe mae", "m pokora",
      "patrick bruel", "jean jacques goldman", "francis cabrel",
      "edith piaf", "jacques brel", "charles aznavour", "serge gainsbourg",
      "renaud", "mc solaar", "iam", "ntm", "oxmo puccino",
      "youssoupha", "kery james", "medine", "sniper",
      "innoss b", "naza", "djadja & dinaz", "bramsito",
    ]);

    const frenchWords = new Set([
      "le", "la", "les", "de", "du", "des", "un", "une", "et", "en",
      "je", "tu", "il", "elle", "nous", "vous", "mon", "ma", "mes",
      "ton", "ta", "tes", "son", "sa", "ses", "ce", "cette", "avec",
      "pour", "dans", "sur", "par", "pas", "plus", "tout", "tous",
      "comme", "qui", "que", "ou", "mais", "est", "sont", "fait",
      "vie", "coeur", "amour", "nuit", "jour", "temps", "monde",
      "femme", "homme", "dieu", "rue", "feu", "eau", "ciel",
    ]);

    const q = normalize(debouncedQuery);
    const qWords = q.split(" ").filter(Boolean);

    results.sort((a, b) => {
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

        const mainArtist = ar.split(",")[0].trim();
        if (frenchArtists.has(mainArtist)) score += 40;

        for (const fa of frenchArtists) {
          if (fa.length > 3 && ar.includes(fa)) { score += 30; break; }
        }

        const titleWords = t.split(/[\s\-']+/).filter(Boolean);
        const frenchWordCount = titleWords.filter((w) => frenchWords.has(w)).length;
        if (frenchWordCount >= 2) score += 25;
        else if (frenchWordCount === 1 && titleWords.length <= 4) score += 10;

        if (isFullStream(song)) score += 20;
        else if (song.streamUrl) score += 5;

        return score;
      };
      return scoreRelevance(b) - scoreRelevance(a);
    });

    return results;
  }, [allDzResults, normalize, debouncedQuery]);

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
    let results = mergedResults;
    if (customOnly) results = results.filter((s) => s.id.startsWith("custom-") || s.resolvedViaCustom);
    if (hdOnly) results = results.filter(isFullStream);
    if (artistFilter) results = results.filter((song) => song.artist.includes(artistFilter));
    return results;
  }, [mergedResults, artistFilter, hdOnly, customOnly]);

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
    <div className="pb-40 max-w-7xl mx-auto animate-fade-in">
      {/* Hero header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-accent/5" />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary/5 blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="relative px-4 md:px-8 pt-[max(2rem,env(safe-area-inset-top))] pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <SearchIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Rechercher</h1>
              <p className="text-sm text-muted-foreground">Trouvez vos artistes et morceaux préférés</p>
            </div>
          </div>
        </div>
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
              if (e.key === "Enter") commitSearch(query.trim());
              if (e.key === "Escape") setShowSuggestions(false);
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
                    onClick={() => commitSearch(item.label)}
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

      {/* Filter bar (visible when searching) */}
      {debouncedQuery && (
        <div className="px-4 md:px-8 mb-4">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setHdOnly(!hdOnly)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                hdOnly
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              HD uniquement
            </button>
            <button
              onClick={() => setCustomOnly(!customOnly)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                customOnly
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Custom uniquement
            </button>
            <button
              onClick={() => {
                hdCache.clear();
                toast.success("Cache HD vidé");
              }}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground hover:bg-destructive/20 hover:text-destructive transition-all flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Vider cache HD
            </button>
            {resolveProgress && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-muted text-muted-foreground flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                {resolveProgress.resolved}/{resolveProgress.total} HD
              </span>
            )}
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

            {/* Genre cards */}
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
            {dzLoading && (!albumResults || albumResults.length === 0) ? (
              <div className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] overflow-hidden">
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

                {/* Playlists Deezer section */}
                {playlistResults.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <ListMusic className="w-4 h-4 text-accent" />
                      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Playlists</h2>
                    </div>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                      {playlistResults.map((pl) => (
                        <button
                          key={pl.id}
                          onClick={() => navigate(`/playlist/dz-${pl.id}`)}
                          className="flex-shrink-0 w-40 group text-left"
                        >
                          <div className="relative w-40 h-40 rounded-2xl overflow-hidden mb-2.5 shadow-lg ring-1 ring-border/10">
                            <img src={pl.picture} alt={pl.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            <div className="absolute inset-0 bg-background/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                              <div className="w-11 h-11 rounded-full liquid-glass flex items-center justify-center shadow-xl" style={{ boxShadow: "0 0 20px hsl(280 60% 60% / 0.3)" }}>
                                <ListMusic className="w-5 h-5 text-primary-foreground" />
                              </div>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-foreground truncate">{pl.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{pl.nb_tracks} titres · {pl.user}</p>
                        </button>
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
                    <div className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] overflow-hidden">
                      {filteredResults.map((song, i) => (
                        <div key={`${song.id}-${i}`} onClick={() => handlePlayTrack(song, filteredResults)} className="border-b border-white/[0.04] last:border-b-0">
                          <SongCard song={song} index={i} />
                        </div>
                      ))}
                    </div>

                    {/* Infinite scroll sentinel */}
                    {hasMoreDz && !artistFilter && (
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
