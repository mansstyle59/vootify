import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { genreGroups, genreDefs, defaultGenreColor, buildTagToGroupMap } from "@/lib/genreGroups";
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
import {
  Search as SearchIcon,
  X,
  Clock,
  TrendingUp,
  User,
  Music,
  Disc3,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Song } from "@/data/mockData";
import { searchArtistImage } from "@/lib/coverArtSearch";

const SearchPage = () => {
  const navigate = useNavigate();
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

  // Deezer new releases
  interface DeezerNewRelease {
    id: number;
    title: string;
    artist: string;
    coverUrl: string;
    albumId: number;
  }
  const [newReleases, setNewReleases] = useState<DeezerNewRelease[]>([]);
  useEffect(() => {
    let cancelled = false;
    const fetchNew = async () => {
      try {
        // Fetch new releases from France (genre 85) and Belgium (genre 129) editorial
        const [frRes, beRes] = await Promise.allSettled([
          supabase.functions.invoke("deezer-proxy", { body: { path: "/editorial/85/releases?limit=15" } }),
          supabase.functions.invoke("deezer-proxy", { body: { path: "/editorial/129/releases?limit=10" } }),
        ]);
        if (cancelled) return;
        const seen = new Set<number>();
        const releases: DeezerNewRelease[] = [];
        for (const r of [frRes, beRes]) {
          if (r.status !== "fulfilled" || r.value.error || !r.value.data?.data) continue;
          for (const a of r.value.data.data) {
            if (seen.has(a.id)) continue;
            seen.add(a.id);
            releases.push({
              id: a.id,
              title: a.title || "",
              artist: a.artist?.name || "",
              coverUrl: a.cover_xl || a.cover_big || a.cover_medium || "",
              albumId: a.id,
            });
          }
        }
        if (releases.length === 0) {
          // Fallback to global chart
          const { data, error } = await supabase.functions.invoke("deezer-proxy", {
            body: { path: "/chart/0/albums?limit=20" },
          });
          if (!error && data?.data) {
            setNewReleases(data.data.map((a: any) => ({
              id: a.id, title: a.title || "", artist: a.artist?.name || "",
              coverUrl: a.cover_xl || a.cover_big || a.cover_medium || "", albumId: a.id,
            })));
          }
        } else {
          setNewReleases(releases.slice(0, 20));
        }
      } catch { /* silent */ }
    };
    fetchNew();
    return () => { cancelled = true; };
  }, []);

  const { data: allSongs, isLoading } = useAllLocalSongs();

  const recentIds = useMemo(
    () => new Set(recentlyPlayed.map((s) => s.id)),
    [recentlyPlayed]
  );

  useEffect(() => {
    if (userId) {
      musicDb.getSearchHistory(userId).then(setRecentSearches).catch(console.error);
    }
  }, [userId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const autocompleteSuggestions = useMemo(() => {
    if (!allSongs || query.length < 1) return [];
    return getSuggestions(allSongs, query, 6);
  }, [allSongs, query]);

  const searchResults = useMemo(() => {
    if (!allSongs || debouncedQuery.length < 1) return [];
    return searchLocalSongs(allSongs, debouncedQuery, recentIds).map((r) => r.song);
  }, [allSongs, debouncedQuery, recentIds]);

  const uniqueArtists = useMemo(() => {
    if (searchResults.length === 0) return [];
    return extractArtists(searchResults).slice(0, 8);
  }, [searchResults]);

  // Extract artists with cover photos for display cards
  const artistCards = useMemo(() => {
    if (searchResults.length === 0) return [];
    const map = new Map<string, { name: string; coverUrl: string; songCount: number }>();
    for (const s of searchResults) {
      s.artist.split(",").forEach((a) => {
        const name = a.trim();
        if (!name) return;
        if (!map.has(name)) {
          map.set(name, { name, coverUrl: s.coverUrl, songCount: 1 });
        } else {
          map.get(name)!.songCount++;
        }
      });
    }
    return Array.from(map.values()).sort((a, b) => b.songCount - a.songCount).slice(0, 10);
  }, [searchResults]);

  // Extract albums with cover photos for display cards
  const albumCards = useMemo(() => {
    if (searchResults.length === 0) return [];
    const map = new Map<string, { title: string; artist: string; coverUrl: string; songCount: number }>();
    for (const s of searchResults) {
      if (!s.album) continue;
      if (!map.has(s.album)) {
        map.set(s.album, { title: s.album, artist: s.artist.split(",")[0].trim(), coverUrl: s.coverUrl, songCount: 1 });
      } else {
        map.get(s.album)!.songCount++;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.songCount - a.songCount).slice(0, 10);
  }, [searchResults]);

  const filteredResults = useMemo(() => {
    if (!artistFilter) return searchResults;
    return searchResults.filter((s) => s.artist.includes(artistFilter));
  }, [searchResults, artistFilter]);

  useEffect(() => {
    if (debouncedQuery.length >= 2 && searchResults.length > 0 && userId) {
      musicDb.saveSearchQuery(userId, debouncedQuery).then(() => {
        musicDb.getSearchHistory(userId).then(setRecentSearches);
      });
    }
  }, [debouncedQuery, searchResults.length, userId]);

  const alternativeSuggestions = useMemo(() => {
    if (!allSongs || searchResults.length > 0 || debouncedQuery.length < 2) return [];
    const artists = extractArtists(allSongs);
    return artists.slice(0, 6);
  }, [allSongs, searchResults, debouncedQuery]);

  // Trending artists with cover photo from their songs
  const trendingArtists = useMemo(() => {
    if (!allSongs) return [];
    const map = new Map<string, { name: string; cover: string; count: number }>();
    for (const s of allSongs) {
      s.artist.split(",").forEach((a) => {
        const name = a.trim();
        if (!name) return;
        if (!map.has(name)) {
          map.set(name, { name, cover: s.coverUrl, count: 1 });
        } else {
          map.get(name)!.count++;
        }
      });
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [allSongs]);

  // Fetch real Deezer artist photos
  const [artistPhotos, setArtistPhotos] = useState<Record<string, string>>({});
  useEffect(() => {
    if (trendingArtists.length === 0) return;
    let cancelled = false;
    const fetchPhotos = async () => {
      const photos: Record<string, string> = {};
      // Fetch in parallel batches of 5
      for (let i = 0; i < trendingArtists.length; i += 5) {
        const batch = trendingArtists.slice(i, i + 5);
        const results = await Promise.allSettled(
          batch.map(async (a) => {
            const url = await searchArtistImage(a.name);
            return { name: a.name, url };
          })
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value.url) {
            photos[r.value.name] = r.value.url;
          }
        }
      }
      if (!cancelled) setArtistPhotos(photos);
    };
    fetchPhotos();
    return () => { cancelled = true; };
  }, [trendingArtists]);

  // Build a lowercase→groupName lookup (from shared module)
  const tagToGroup = useMemo(() => buildTagToGroupMap(), []);

  const genreCards = useMemo(() => {
    const map = new Map<string, { genre: string; count: number; coverUrl: string }>();

    if (allSongs) {
      for (const s of allSongs) {
        const genre = (s as any).genre;
        if (!genre) continue;
        genre.split(/[,/|]/).forEach((g: string) => {
          const raw = g.trim().toLowerCase();
          if (!raw || raw.length < 2) return;
          // Map to group or use capitalized raw
          const groupName = tagToGroup.get(raw);
          const key = groupName || (raw.charAt(0).toUpperCase() + raw.slice(1));
          if (!map.has(key)) {
            map.set(key, { genre: key, count: 1, coverUrl: s.coverUrl });
          } else {
            map.get(key)!.count++;
          }
        });
      }
    }

    const fromLib = Array.from(map.values()).sort((a, b) => b.count - a.count);

    // Always show default genre groups
    const defaults = Object.keys(genreGroups);
    const seen = new Set(fromLib.map((g) => g.genre));
    for (const dg of defaults) {
      if (!seen.has(dg)) {
        fromLib.push({ genre: dg, count: 0, coverUrl: "" });
      }
    }

    return fromLib.slice(0, 12);
  }, [allSongs, tagToGroup]);

  const handlePlayTrack = (song: Song, allSongs: Song[]) => {
    if (currentSong?.id === song.id) {
      togglePlay();
      return;
    }
    setQueue(allSongs);
    play(song);
  };

  const handleAlbumClick = async (albumTitle: string) => {
    const { data } = await supabase
      .from("custom_albums")
      .select("id")
      .eq("title", albumTitle)
      .limit(1)
      .single();
    if (data) navigate(`/album/${data.id}`);
  };

  const handleArtistClick = (artistName: string) => {
    navigate(`/artist/${encodeURIComponent(artistName)}`);
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
                  Bibliothèque locale
                </p>
              </div>
            </div>
          </div>
        </div>
      </ScrollBlurHeader>

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
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
            >
              <X className="w-4 h-4" />
            </button>
          )}

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
          <motion.div
            key="explore"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 md:px-8 space-y-6"
          >
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

            {trendingArtists.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Artistes populaires
                  </h2>
                </div>
                <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
                  {trendingArtists.map((artist, i) => (
                    <motion.button
                      key={artist.name}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
                      className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16"
                    >
                      <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                        {(artistPhotos[artist.name] || artist.cover) ? (
                          <img src={artistPhotos[artist.name] || artist.cover} alt={artist.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-secondary flex items-center justify-center">
                            <User className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-foreground font-medium truncate w-full text-center leading-tight">
                        {artist.name}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Nouveautés Deezer - France & Belgique */}
            {newReleases.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Nouveautés 🇫🇷 🇧🇪
                  </h2>
                </div>
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                  {newReleases.map((release, i) => (
                    <motion.button
                      key={release.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex-shrink-0 w-[110px] group text-left snap-start"
                    >
                      <div className="w-[110px] h-[110px] rounded-xl overflow-hidden mb-1.5 shadow-md">
                        {release.coverUrl ? (
                          <img
                            src={release.coverUrl}
                            alt={release.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-secondary flex items-center justify-center">
                            <Music className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <p className="text-[12px] font-semibold text-foreground truncate leading-tight">
                        {release.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 truncate">
                        {release.artist}
                      </p>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {genreCards.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Disc3 className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Parcourir par genre
                  </h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {genreCards.map((g, i) => {
                    const def = genreDefs[g.genre] || defaultGenreColor;
                    return (
                      <motion.button
                        key={g.genre}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03, duration: 0.3 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(`/genre/${encodeURIComponent(g.genre)}`)}
                        className="relative h-[100px] rounded-2xl overflow-hidden text-left group"
                        style={{
                          background: `linear-gradient(145deg, ${def.from}, ${def.to})`,
                        }}
                      >
                        {/* Cover art tilted */}
                        {g.coverUrl ? (
                          <img
                            src={g.coverUrl}
                            alt=""
                            className="absolute -right-2 -bottom-2 w-[72px] h-[72px] rounded-xl object-cover rotate-[25deg] opacity-50 group-active:opacity-70 transition-opacity shadow-2xl"
                          />
                        ) : (
                          <span className="absolute -right-1 -bottom-1 text-[52px] rotate-[20deg] opacity-20 select-none">
                            {def.emoji}
                          </span>
                        )}
                        {/* Content */}
                        <div className="relative z-10 p-3.5 h-full flex flex-col justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-lg">{def.emoji}</span>
                            <h3 className="text-[15px] font-bold text-white drop-shadow-md leading-tight">
                              {g.genre}
                            </h3>
                          </div>
                          {g.count > 0 && (
                            <p className="text-[11px] text-white/50 font-medium">{g.count} titres</p>
                          )}
                        </div>
                        {/* Shine overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity" />
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {allSongs && allSongs.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <Music className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Votre bibliothèque
                  </h2>
                </div>
                <div className="flex justify-around">
                  {[
                    { icon: <Music className="w-4 h-4" />, value: allSongs.length, label: "Morceaux", color: "text-primary border-primary/30 bg-primary/10" },
                    { icon: <User className="w-4 h-4" />, value: new Set(allSongs.map((s) => s.artist.split(",")[0].trim())).size, label: "Artistes", color: "text-primary border-primary/30 bg-primary/10" },
                    { icon: <Disc3 className="w-4 h-4" />, value: new Set(allSongs.filter((s) => s.album).map((s) => s.album)).size, label: "Albums", color: "text-primary border-primary/30 bg-primary/10" },
                  ].map((stat) => (
                    <div key={stat.label} className="flex flex-col items-center gap-1">
                      <div className={`w-16 h-16 rounded-full flex flex-col items-center justify-center border-2 ${stat.color}`}>
                        {stat.icon}
                        <span className="text-sm font-bold leading-tight mt-0.5">{stat.value}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">{stat.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-4 md:px-8"
          >
            {isLoading ? (
              <div className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SongSkeleton key={i} />
                ))}
              </div>
            ) : (
              <>
                {/* Artist cards with photos */}
                {artistCards.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4 text-primary" />
                      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Artistes
                      </h2>
                    </div>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                      {artistCards.map((artist, i) => (
                        <motion.button
                          key={artist.name}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => handleArtistClick(artist.name)}
                          className="flex-shrink-0 w-28 group text-center"
                        >
                          <div className="w-28 h-28 rounded-full overflow-hidden bg-secondary mb-2 shadow-lg mx-auto ring-2 ring-transparent group-hover:ring-primary/40 transition-all">
                            {artist.coverUrl ? (
                              <img src={artist.coverUrl} alt={artist.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                                <User className="w-8 h-8 text-primary/30" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs font-bold text-foreground truncate">{artist.name}</p>
                          <p className="text-[10px] text-muted-foreground">{artist.songCount} titre{artist.songCount > 1 ? "s" : ""}</p>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Album cards with photos */}
                {albumCards.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Music className="w-4 h-4 text-primary" />
                      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Albums
                      </h2>
                    </div>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                      {albumCards.map((album, i) => (
                        <motion.button
                          key={album.title}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => handleAlbumClick(album.title)}
                          className="flex-shrink-0 w-32 group text-left"
                        >
                          <div className="w-32 h-32 rounded-xl overflow-hidden bg-secondary mb-2 shadow-lg group-hover:shadow-xl transition-all">
                            {album.coverUrl ? (
                              <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                                <Music className="w-8 h-8 text-primary/30" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs font-bold text-foreground truncate">{album.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{album.artist}</p>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Artist filter chips */}
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
                      Aucun résultat pour «{" "}
                      <span className="text-primary">{debouncedQuery}</span> »
                    </p>
                    <p className="text-sm text-muted-foreground/60 mb-4">
                      Essayez un autre terme de recherche
                    </p>
                    {alternativeSuggestions.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground mb-2">Artistes suggérés :</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {alternativeSuggestions.map((artist) => (
                            <button
                              key={artist}
                              onClick={() => commitSearch(artist)}
                              className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                            >
                              {artist}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
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
