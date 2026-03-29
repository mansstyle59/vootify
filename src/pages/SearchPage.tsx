import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { genreGroups, genreDefs, defaultGenreColor, buildTagToGroupMap } from "@/lib/genreGroups";
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
  Play,
  PlusCircle,
  ListMusic,
  Plus,
  Check,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Song } from "@/data/mockData";
import { searchArtistImage } from "@/lib/coverArtSearch";
import { LazyImage } from "@/components/LazyImage";
import { isFridayDataStale, markFridayRefreshed, getFridayCoverUrl } from "@/lib/appCache";

/* ── Minimal style helpers ── */
const glassCard = {
  background: "hsl(var(--foreground) / 0.03)",
} as const;

const glassCardStrong = {
  background: "hsl(var(--card) / 0.8)",
  backdropFilter: "blur(24px)",
  border: "1px solid hsl(var(--border) / 0.1)",
} as const;

const SearchPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.get("q") || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const userId = usePlayerStore((s) => s.userId);
  const recentlyPlayed = usePlayerStore((s) => s.recentlyPlayed);
  const { play, setQueue, currentSong, isPlaying, togglePlay, playlists, playlistSongs, addSongToPlaylist, createPlaylist } = usePlayerStore();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [artistFilter, setArtistFilter] = useState<string | null>(null);

  interface DeezerNewRelease {
    id: number;
    title: string;
    artist: string;
    coverUrl: string;
    albumId: number;
  }
  const [addToPlaylistRelease, setAddToPlaylistRelease] = useState<DeezerNewRelease | null>(null);
  const [addToPlaylistTracks, setAddToPlaylistTracks] = useState<Song[]>([]);
  const [loadingPlaylistAdd, setLoadingPlaylistAdd] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newReleases, setNewReleases] = useState<DeezerNewRelease[]>([]);

  // ── Data fetching (unchanged logic) ──
  useEffect(() => {
    let cancelled = false;
    const fetchNew = async () => {
      try {
        const { data: cached } = await (supabase
          .from("friday_releases" as any)
          .select("album_id, title, artist, cover_url")
          .order("position", { ascending: true })
          .limit(25) as any);

        if (!cancelled && cached && cached.length > 0) {
          // Resolve covers from offline cache for each release
          const releasesWithCovers = await Promise.all(
            cached.map(async (r: any) => {
              let coverUrl = r.cover_url;
              try {
                const cachedCover = await getFridayCoverUrl(r.album_id);
                if (cachedCover) coverUrl = cachedCover;
              } catch {}
              return {
                id: r.album_id, title: r.title, artist: r.artist,
                coverUrl, albumId: r.album_id,
              };
            })
          );
          if (!cancelled) setNewReleases(releasesWithCovers);

          // If data is stale (past this week's Friday), trigger background refresh
          if (isFridayDataStale()) {
            supabase.functions.invoke("refresh-friday-releases", { body: {} })
              .then(() => {
                markFridayRefreshed();
                // Re-fetch after refresh
                supabase
                  .from("friday_releases" as any)
                  .select("album_id, title, artist, cover_url")
                  .order("position", { ascending: true })
                  .limit(25)
                  .then(({ data: fresh }: any) => {
                    if (!cancelled && fresh && fresh.length > 0) {
                      setNewReleases(fresh.map((r: any) => ({
                        id: r.album_id, title: r.title, artist: r.artist,
                        coverUrl: r.cover_url, albumId: r.album_id,
                      })));
                    }
                  });
              })
              .catch(() => {});
          } else {
            markFridayRefreshed();
          }
          return;
        }

        // Fallback: fetch directly from Deezer
        const playlistIds = ["1071669561", "1478649355"];
        const results = await Promise.allSettled(
          playlistIds.map((pid) =>
            supabase.functions.invoke("deezer-proxy", {
              body: { path: `/playlist/${pid}/tracks?limit=25` },
            })
          )
        );
        if (cancelled) return;
        const seen = new Set<number>();
        const releases: DeezerNewRelease[] = [];
        for (const r of results) {
          if (r.status !== "fulfilled" || r.value.error || !r.value.data?.data) continue;
          for (const t of r.value.data.data) {
            const albumId = t.album?.id;
            if (!albumId || seen.has(albumId)) continue;
            seen.add(albumId);
            releases.push({
              id: albumId, title: t.album?.title || t.title || "",
              artist: t.artist?.name || "",
              coverUrl: t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || "",
              albumId,
            });
          }
        }
        setNewReleases(releases.slice(0, 20));
      } catch { /* silent */ }
    };
    fetchNew();
    return () => { cancelled = true; };
  }, []);

  const { data: allSongs, isLoading, refetch: refetchSongs } = useAllLocalSongs();

  const playFridayRelease = useCallback(async (release: DeezerNewRelease) => {
    try {
      const { data } = await supabase.functions.invoke("deezer-proxy", {
        body: { path: `/album/${release.albumId}/tracks?limit=50` },
      });
      const deezerTracks = data?.data || [];
      if (deezerTracks.length === 0) { toast.error("Aucun morceau trouvé"); return; }
      const library = allSongs || [];
      const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const fullTracks: Song[] = [];
      for (const t of deezerTracks) {
        const dTitle = normalize(t.title || "");
        const dArtist = normalize(t.artist?.name || release.artist);
        const match = library.find((s) => {
          const sTitle = normalize(s.title);
          const sArtist = normalize(s.artist);
          return (sTitle.includes(dTitle) || dTitle.includes(sTitle)) &&
                 (sArtist.includes(dArtist) || dArtist.includes(sArtist));
        });
        if (match && match.streamUrl) {
          fullTracks.push({ ...match, album: release.title, coverUrl: release.coverUrl || match.coverUrl });
        }
      }
      if (fullTracks.length > 0) { setQueue(fullTracks); play(fullTracks[0]); }
      else { toast.info("Morceaux non disponibles en version complète dans votre bibliothèque"); }
    } catch { toast.error("Impossible de charger cet album"); }
  }, [play, setQueue, allSongs]);

  const openAddToPlaylist = useCallback(async (release: DeezerNewRelease) => {
    setLoadingPlaylistAdd(true);
    setAddToPlaylistRelease(release);
    try {
      const { data } = await supabase.functions.invoke("deezer-proxy", {
        body: { path: `/album/${release.albumId}/tracks?limit=50` },
      });
      const deezerTracks = data?.data || [];
      const library = allSongs || [];
      const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const tracks: Song[] = [];
      for (const t of deezerTracks) {
        const dTitle = normalize(t.title || "");
        const dArtist = normalize(t.artist?.name || release.artist);
        const match = library.find((s) => {
          const sTitle = normalize(s.title);
          const sArtist = normalize(s.artist);
          return (sTitle.includes(dTitle) || dTitle.includes(sTitle)) &&
                 (sArtist.includes(dArtist) || dArtist.includes(sArtist));
        });
        if (match && match.streamUrl) {
          tracks.push({ ...match, album: release.title, coverUrl: release.coverUrl || match.coverUrl });
        }
      }
      if (tracks.length === 0) { toast.info("Aucun morceau disponible"); setAddToPlaylistRelease(null); }
      setAddToPlaylistTracks(tracks);
    } catch { toast.error("Impossible de charger les morceaux"); setAddToPlaylistRelease(null); }
    setLoadingPlaylistAdd(false);
  }, [allSongs]);

  const handleAddAlbumToPlaylist = async (playlistId: string, playlistName: string) => {
    const existing = playlistSongs[playlistId] || [];
    let added = 0;
    for (const song of addToPlaylistTracks) {
      if (!existing.some((s) => s.id === song.id)) { await addSongToPlaylist(playlistId, song); added++; }
    }
    toast.success(`${added} morceau${added > 1 ? "x" : ""} ajouté${added > 1 ? "s" : ""} à "${playlistName}"`);
    setAddToPlaylistRelease(null);
    setAddToPlaylistTracks([]);
  };

  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) return;
    await createPlaylist(newPlaylistName.trim());
    toast.success(`Playlist "${newPlaylistName.trim()}" créée`);
    setNewPlaylistName(""); setShowCreatePlaylist(false); setAddToPlaylistRelease(null);
  };

  const availableReleases = useMemo(() => {
    if (!allSongs || !newReleases.length) return new Set<number>();
    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const available = new Set<number>();
    for (const release of newReleases) {
      const rArtist = normalize(release.artist);
      const rTitle = normalize(release.title);
      const hasMatch = allSongs.some((s) => {
        const sArtist = normalize(s.artist);
        const sAlbum = normalize(s.album || "");
        return (sArtist.includes(rArtist) || rArtist.includes(sArtist)) &&
               (sAlbum.includes(rTitle) || rTitle.includes(sAlbum));
      });
      if (hasMatch) available.add(release.albumId);
    }
    return available;
  }, [allSongs, newReleases]);

  const recentIds = useMemo(() => new Set(recentlyPlayed.map((s) => s.id)), [recentlyPlayed]);

  useEffect(() => {
    if (userId) musicDb.getSearchHistory(userId).then(setRecentSearches).catch(console.error);
  }, [userId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = useCallback((value: string) => {
    setQuery(value); setArtistFilter(null); setShowSuggestions(true);
    clearTimeout((window as any).__searchTimeout);
    (window as any).__searchTimeout = setTimeout(() => setDebouncedQuery(value.trim()), 200);
  }, []);

  const commitSearch = useCallback((term: string) => {
    setQuery(term); setDebouncedQuery(term); setShowSuggestions(false); setArtistFilter(null);
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

  const artistCards = useMemo(() => {
    if (searchResults.length === 0) return [];
    const map = new Map<string, { name: string; coverUrl: string; songCount: number }>();
    for (const s of searchResults) {
      s.artist.split(",").forEach((a) => {
        const name = a.trim();
        if (!name) return;
        if (!map.has(name)) map.set(name, { name, coverUrl: s.coverUrl, songCount: 1 });
        else map.get(name)!.songCount++;
      });
    }
    return Array.from(map.values()).sort((a, b) => b.songCount - a.songCount).slice(0, 10);
  }, [searchResults]);

  const albumCards = useMemo(() => {
    if (searchResults.length === 0) return [];
    const map = new Map<string, { title: string; artist: string; coverUrl: string; songCount: number }>();
    for (const s of searchResults) {
      if (!s.album) continue;
      if (!map.has(s.album)) map.set(s.album, { title: s.album, artist: s.artist.split(",")[0].trim(), coverUrl: s.coverUrl, songCount: 1 });
      else map.get(s.album)!.songCount++;
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
    return extractArtists(allSongs).slice(0, 6);
  }, [allSongs, searchResults, debouncedQuery]);

  const trendingArtists = useMemo(() => {
    if (!allSongs) return [];
    const map = new Map<string, { name: string; cover: string; count: number }>();
    for (const s of allSongs) {
      s.artist.split(",").forEach((a) => {
        const name = a.trim();
        if (!name) return;
        if (!map.has(name)) map.set(name, { name, cover: s.coverUrl, count: 1 });
        else map.get(name)!.count++;
      });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 15);
  }, [allSongs]);

  const [artistPhotos, setArtistPhotos] = useState<Record<string, string>>({});
  useEffect(() => {
    if (trendingArtists.length === 0) return;
    let cancelled = false;
    const fetchPhotos = async () => {
      const photos: Record<string, string> = {};
      for (let i = 0; i < trendingArtists.length; i += 5) {
        const batch = trendingArtists.slice(i, i + 5);
        const results = await Promise.allSettled(
          batch.map(async (a) => ({ name: a.name, url: await searchArtistImage(a.name) }))
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value.url) photos[r.value.name] = r.value.url;
        }
      }
      if (!cancelled) setArtistPhotos(photos);
    };
    fetchPhotos();
    return () => { cancelled = true; };
  }, [trendingArtists]);

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
          const groupName = tagToGroup.get(raw);
          const key = groupName || (raw.charAt(0).toUpperCase() + raw.slice(1));
          if (!map.has(key)) map.set(key, { genre: key, count: 1, coverUrl: s.coverUrl });
          else map.get(key)!.count++;
        });
      }
    }
    const fromLib = Array.from(map.values()).sort((a, b) => b.count - a.count);
    const seen = new Set(fromLib.map((g) => g.genre));
    for (const dg of Object.keys(genreGroups)) {
      if (!seen.has(dg)) fromLib.push({ genre: dg, count: 0, coverUrl: "" });
    }
    return fromLib.slice(0, 12);
  }, [allSongs, tagToGroup]);

  const handlePlayTrack = (song: Song, allSongs: Song[]) => {
    if (currentSong?.id === song.id) { togglePlay(); return; }
    setQueue(allSongs); play(song);
  };

  const handleAlbumClick = async (albumTitle: string) => {
    const { data } = await supabase.from("custom_albums").select("id").eq("title", albumTitle).limit(1).single();
    if (data) navigate(`/album/${data.id}`);
  };

  const handleArtistClick = (artistName: string) => navigate(`/artist/${encodeURIComponent(artistName)}`);

  const handleRemoveRecent = (term: string) => {
    if (userId) musicDb.removeSearchQuery(userId, term).then(() => musicDb.getSearchHistory(userId).then(setRecentSearches));
  };

  const clearAllRecent = () => {
    if (userId) musicDb.clearSearchHistory(userId).then(() => setRecentSearches([]));
  };

  /* ═══════════════════════════ RENDER ═══════════════════════════ */

  return (
    <div className="pb-20 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="px-5 md:px-8 pt-[max(2rem,env(safe-area-inset-top))] pb-2">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[28px] md:text-[32px] font-black text-foreground tracking-tight">Rechercher</h1>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="px-5 md:px-8 mb-5" ref={searchRef}>
        <div className="relative">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 z-10" />
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
            className="w-full pl-10 pr-10 py-3 rounded-xl text-foreground placeholder:text-muted-foreground/35 focus:outline-none text-[14px] transition-all"
            style={{
              background: "hsl(var(--foreground) / 0.05)",
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setDebouncedQuery(""); setArtistFilter(null); setShowSuggestions(false); }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* ── Autocomplete Dropdown ── */}
          <AnimatePresence>
            {showSuggestions && query.length >= 1 && autocompleteSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full mt-2 rounded-2xl overflow-hidden z-50 shadow-xl"
                style={{ ...glassCardStrong }}
              >
                {autocompleteSuggestions.map((item, i) => (
                  <button
                    key={`${item.type}-${item.label}-${i}`}
                    onClick={() => commitSearch(item.label)}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-primary/5 transition-colors"
                  >
                    {item.coverUrl ? (
                      <img src={item.coverUrl} alt="" className={`w-9 h-9 object-cover flex-shrink-0 ${item.type === "artist" ? "rounded-full" : "rounded-lg"}`} />
                    ) : (
                      <div className={`w-9 h-9 bg-secondary/60 flex items-center justify-center flex-shrink-0 ${item.type === "artist" ? "rounded-full" : "rounded-lg"}`}>
                        {item.type === "artist" ? <User className="w-4 h-4 text-muted-foreground" /> : <Music className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground/60 truncate">{item.type === "artist" ? "Artiste" : item.sub}</p>
                    </div>
                    <SearchIcon className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0" />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Content ── */}
      <AnimatePresence mode="wait">
        {!debouncedQuery ? (
          /* ══════════════ EXPLORE MODE ══════════════ */
          <motion.div key="explore" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-5 md:px-8 space-y-8">

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[18px] font-bold text-foreground">Récentes</h2>
                  <button onClick={clearAllRecent} className="text-[12px] text-primary font-medium active:opacity-70 transition-opacity">Tout effacer</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <div key={term} className="group flex items-center">
                      <button
                        onClick={() => commitSearch(term)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium text-foreground active:scale-95 transition-transform"
                        style={{ background: "hsl(var(--foreground) / 0.05)" }}
                      >
                        <Clock className="w-3 h-3 text-muted-foreground/40" />
                        {term}
                      </button>
                      <button onClick={() => handleRemoveRecent(term)} className="ml-0.5 p-1 rounded-full text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Trending Artists */}
            {trendingArtists.length > 0 && (
              <section>
                <h2 className="text-[18px] font-bold text-foreground mb-3">Artistes populaires</h2>
                <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
                  {trendingArtists.map((artist) => (
                    <button
                      key={artist.name}
                      onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
                      className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[72px] group active:scale-95 transition-transform"
                    >
                      <div
                        className="w-16 h-16 rounded-full overflow-hidden"
                        style={{ boxShadow: "0 2px 8px hsl(0 0% 0% / 0.08)" }}
                      >
                        {(artistPhotos[artist.name] || artist.cover) ? (
                          <img src={artistPhotos[artist.name] || artist.cover} alt={artist.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center" style={{ background: "hsl(var(--foreground) / 0.04)" }}>
                            <User className="w-5 h-5 text-muted-foreground/20" />
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-foreground font-semibold truncate w-full text-center leading-tight">{artist.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Friday Releases */}
            {newReleases.length > 0 && (
              <section>
                <h2 className="text-[18px] font-bold text-foreground mb-3">Nouveautés du vendredi 🇫🇷</h2>
                <div className="flex gap-3.5 overflow-x-auto scrollbar-hide pb-2">
                  {newReleases.map((release) => (
                    <div key={release.id} className="flex-shrink-0 w-[140px] snap-start group">
                      <div
                        className="relative w-[140px] h-[140px] rounded-xl overflow-hidden mb-2"
                        style={{ boxShadow: "0 2px 8px hsl(0 0% 0% / 0.08)" }}
                      >
                        <button onClick={() => playFridayRelease(release)} className="w-full h-full">
                          {release.coverUrl ? (
                            <LazyImage src={release.coverUrl} alt={release.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" fallback wrapperClassName="w-full h-full" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center" style={{ background: "hsl(var(--foreground) / 0.04)" }}>
                              <Music className="w-6 h-6 text-muted-foreground/15" />
                            </div>
                          )}
                        </button>
                        {/* Play button */}
                        <div className="absolute inset-0 flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => playFridayRelease(release)}
                            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                            style={{ background: "hsl(var(--primary))", boxShadow: "0 4px 16px hsl(var(--primary) / 0.4)" }}
                          >
                            <Play className="w-3.5 h-3.5 text-primary-foreground fill-current ml-0.5" />
                          </button>
                        </div>
                        {availableReleases.has(release.albumId) && (
                          <div
                            className="absolute top-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
                            style={{ background: "hsl(var(--primary) / 0.85)" }}
                          >
                            <Check className="w-2 h-2 text-primary-foreground" />
                            <span className="text-[8px] font-bold text-primary-foreground">DISPO</span>
                          </div>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); openAddToPlaylist(release); }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                          style={{ background: "hsl(0 0% 0% / 0.5)" }}
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-white" />
                        </button>
                      </div>
                      <button onClick={() => playFridayRelease(release)} className="text-left w-full">
                        <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{release.title}</p>
                        <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5">{release.artist}</p>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Genre Cards */}
            {genreCards.length > 0 && (
              <section>
                <h2 className="text-[18px] font-bold text-foreground mb-3">Parcourir par genre</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {genreCards.map((g) => {
                    const def = genreDefs[g.genre] || defaultGenreColor;
                    return (
                      <button
                        key={g.genre}
                        onClick={() => navigate(`/genre/${encodeURIComponent(g.genre)}`)}
                        className="relative h-[100px] rounded-xl overflow-hidden text-left group active:scale-[0.97] transition-transform"
                        style={{
                          background: `linear-gradient(145deg, ${def.from}, ${def.to})`,
                          boxShadow: `0 4px 16px ${def.from}20`,
                        }}
                      >
                        {g.coverUrl ? (
                          <img src={g.coverUrl} alt="" className="absolute -right-2 -bottom-2 w-[70px] h-[70px] rounded-lg object-cover rotate-[20deg] opacity-30 transition-opacity duration-300 group-hover:opacity-45" />
                        ) : (
                          <span className="absolute -right-1 -bottom-1 text-[48px] rotate-[18deg] opacity-15 select-none">{def.emoji}</span>
                        )}
                        <div className="relative z-10 p-3 h-full flex flex-col justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{def.emoji}</span>
                            <h3 className="text-[14px] font-bold text-white leading-tight">{g.genre}</h3>
                          </div>
                          {g.count > 0 && (
                            <p className="text-[10px] text-white/55 font-medium">{g.count} titres</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Library Stats */}
            {allSongs && allSongs.length > 0 && (
              <section>
                <h2 className="text-[18px] font-bold text-foreground mb-3">Votre bibliothèque</h2>
                <div className="flex justify-around">
                  {[
                    { icon: <Music className="w-4 h-4" />, value: allSongs.length, label: "Morceaux" },
                    { icon: <User className="w-4 h-4" />, value: new Set(allSongs.map((s) => s.artist.split(",")[0].trim())).size, label: "Artistes" },
                    { icon: <Disc3 className="w-4 h-4" />, value: new Set(allSongs.filter((s) => s.album).map((s) => s.album)).size, label: "Albums" },
                  ].map((stat) => (
                    <div key={stat.label} className="flex flex-col items-center gap-1.5">
                      <div
                        className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center text-primary"
                        style={{ background: "hsl(var(--primary) / 0.08)" }}
                      >
                        {stat.icon}
                        <span className="text-base font-black leading-tight mt-1 tabular-nums">{stat.value}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/50 font-semibold">{stat.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </motion.div>
        ) : (
          /* ══════════════ RESULTS MODE ══════════════ */
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-5 md:px-8">
            {isLoading ? (
              <div className="rounded-xl overflow-hidden" style={{ background: "hsl(var(--foreground) / 0.02)" }}>
                {Array.from({ length: 6 }).map((_, i) => <SongSkeleton key={i} />)}
              </div>
            ) : (
              <>
                {/* Artist Results */}
                {artistCards.length > 0 && (
                  <section className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4 text-primary" />
                      <h2 className="text-xs font-bold text-muted-foreground/70 uppercase tracking-wider">Artistes</h2>
                    </div>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
                      {artistCards.map((artist, i) => (
                        <motion.button
                          key={artist.name}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 25 }}
                          onClick={() => handleArtistClick(artist.name)}
                          className="flex-shrink-0 w-[100px] group text-center"
                        >
                          <div className="w-[100px] h-[100px] rounded-full overflow-hidden mb-2 mx-auto ring-2 ring-border/10 group-hover:ring-primary/30 transition-all"
                            style={{ boxShadow: "0 4px 20px hsl(0 0% 0% / 0.1)" }}
                          >
                            {artist.coverUrl ? (
                              <img src={artist.coverUrl} alt={artist.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))" }}>
                                <User className="w-8 h-8 text-primary/25" />
                              </div>
                            )}
                          </div>
                          <p className="text-[11px] font-bold text-foreground truncate">{artist.name}</p>
                          <p className="text-[10px] text-muted-foreground/50">{artist.songCount} titre{artist.songCount > 1 ? "s" : ""}</p>
                        </motion.button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Album Results */}
                {albumCards.length > 0 && (
                  <section className="mb-6">
                    <h2 className="text-[18px] font-bold text-foreground mb-3">Albums</h2>
                    <div className="flex gap-3.5 overflow-x-auto scrollbar-hide pb-2">
                      {albumCards.map((album) => (
                        <button
                          key={album.title}
                          onClick={() => handleAlbumClick(album.title)}
                          className="flex-shrink-0 w-[140px] group text-left active:scale-[0.97] transition-transform"
                        >
                          <div
                            className="w-[140px] h-[140px] rounded-xl overflow-hidden mb-2"
                            style={{ boxShadow: "0 2px 8px hsl(0 0% 0% / 0.08)" }}
                          >
                            {album.coverUrl ? (
                              <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center" style={{ background: "hsl(var(--foreground) / 0.04)" }}>
                                <Music className="w-7 h-7 text-muted-foreground/15" />
                              </div>
                            )}
                          </div>
                          <p className="text-[13px] font-semibold text-foreground truncate">{album.title}</p>
                          <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5">{album.artist}</p>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Artist Filter Pills */}
                {uniqueArtists.length > 1 && (
                  <div className="mb-4">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                      {[null, ...uniqueArtists].map((artist) => {
                        const isActive = artist === null ? !artistFilter : artistFilter === artist;
                        return (
                          <button
                            key={artist || "all"}
                            onClick={() => setArtistFilter(artist === artistFilter ? null : artist)}
                            className="relative flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold active:scale-95 transition-transform"
                            style={{
                              background: isActive ? "hsl(var(--primary))" : "hsl(var(--foreground) / 0.05)",
                              color: isActive ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                            }}
                          >
                            {artist || "Tous"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Song Results */}
                {filteredResults.length > 0 ? (
                  <>
                    <p className="text-[12px] text-muted-foreground/50 font-medium mb-3">
                      {filteredResults.length} résultat{filteredResults.length > 1 ? "s" : ""}
                      {artistFilter && <> de <span className="text-primary font-semibold">{artistFilter}</span></>}
                    </p>
                    <div className="rounded-xl overflow-hidden" style={{ background: "hsl(var(--foreground) / 0.02)" }}>
                      <VirtualSongList
                        songs={filteredResults}
                        onClickSong={(song) => handlePlayTrack(song, filteredResults)}
                        className=""
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-20">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ background: "hsl(var(--foreground) / 0.04)" }}
                    >
                      <Music className="w-7 h-7 text-muted-foreground/20" />
                    </div>
                    <p className="text-foreground font-semibold mb-1">Aucun résultat pour « <span className="text-primary">{debouncedQuery}</span> »</p>
                    <p className="text-[13px] text-muted-foreground/50 mb-4">Essayez un autre terme de recherche</p>
                    {alternativeSuggestions.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[11px] text-muted-foreground/40 mb-2 font-medium">Artistes suggérés :</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {alternativeSuggestions.map((artist) => (
                            <button key={artist} onClick={() => commitSearch(artist)}
                              className="px-3.5 py-1.5 rounded-full text-[12px] font-semibold active:scale-95 transition-transform"
                              style={{ background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}
                            >
                              {artist}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add to Playlist Modal ── */}
      <AnimatePresence>
        {addToPlaylistRelease && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end justify-center"
            style={{ background: "hsl(0 0% 0% / 0.5)", backdropFilter: "blur(8px)" }}
            onClick={() => { setAddToPlaylistRelease(null); setAddToPlaylistTracks([]); setShowCreatePlaylist(false); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl overflow-hidden shadow-2xl"
              style={{ ...glassCardStrong, maxHeight: "70vh" }}
            >
              <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: "hsl(var(--border) / 0.15)" }}>
                {addToPlaylistRelease.coverUrl && (
                  <img src={addToPlaylistRelease.coverUrl} alt="" className="w-12 h-12 rounded-xl object-cover" style={{ boxShadow: "0 2px 12px hsl(0 0% 0% / 0.15)" }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{addToPlaylistRelease.title}</p>
                  <p className="text-xs text-muted-foreground/60 truncate">{addToPlaylistRelease.artist}</p>
                  {!loadingPlaylistAdd && (
                    <p className="text-[10px] text-primary mt-0.5 font-medium">{addToPlaylistTracks.length} morceau{addToPlaylistTracks.length !== 1 ? "x" : ""} disponible{addToPlaylistTracks.length !== 1 ? "s" : ""}</p>
                  )}
                </div>
                <button onClick={() => { setAddToPlaylistRelease(null); setAddToPlaylistTracks([]); }} className="p-1.5 rounded-xl hover:bg-secondary/60 transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {loadingPlaylistAdd ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : addToPlaylistTracks.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground/50">Aucun morceau disponible</div>
              ) : (
                <>
                  <div className="max-h-[40vh] overflow-y-auto p-2">
                    {playlists.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50 text-center py-8">Aucune playlist</p>
                    ) : (
                      playlists.map((p) => (
                        <button key={p.id} onClick={() => handleAddAlbumToPlaylist(p.id, p.name)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left rounded-xl hover:bg-primary/5 transition-colors"
                        >
                          <ListMusic className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" />
                          <span className="flex-1 truncate text-foreground font-medium">{p.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t" style={{ borderColor: "hsl(var(--border) / 0.15)" }}>
                    {showCreatePlaylist ? (
                      <div className="flex gap-2 p-1">
                        <input
                          value={newPlaylistName}
                          onChange={(e) => setNewPlaylistName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleCreateAndAdd()}
                          placeholder="Nom de la playlist..."
                          className="flex-1 px-3 py-2 rounded-xl text-foreground placeholder:text-muted-foreground/40 text-sm focus:outline-none"
                          style={{ ...glassCard }}
                          autoFocus
                        />
                        <button onClick={handleCreateAndAdd} className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                          style={{ boxShadow: "0 2px 10px hsl(var(--primary) / 0.3)" }}
                        >Créer</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowCreatePlaylist(true)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl hover:bg-primary/5 transition-colors text-foreground"
                      >
                        <Plus className="w-5 h-5" />
                        <span>Nouvelle playlist</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchPage;
