import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useOfflineCoverUrl } from "@/hooks/useOfflineCoverUrl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { useAuth } from "@/hooks/useAuth";
import { useDominantColor } from "@/hooks/useDominantColor";
import { formatDuration } from "@/data/mockData";
import {
  Heart, ListMusic, Clock, Plus, Trash2, Play, Pause, Download,
  HardDrive, Trash, Music, Shuffle, LogIn, WifiOff, ArrowUpDown,
  RefreshCw, Loader2, MoreHorizontal, ChevronRight, CheckSquare, X, ListPlus, Sparkles,
  Disc3, User, Search as SearchIcon
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { offlineCache } from "@/lib/offlineCache";
import { Song } from "@/data/mockData";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { normalizeTitle, normalizeArtist, normalizeText } from "@/lib/metadataEnrich";
import { batchSearchCovers, searchArtistImage } from "@/lib/coverArtSearch";

type Tab = "liked" | "playlists" | "recent" | "downloads" | "custom" | "albums" | "artists" | null;
type SortOption = "recent" | "alpha" | "artist" | "duration";

const filterFullStreams = (songs: Song[]) =>
  songs.filter((s) => s.streamUrl);

/** Filter out radio stations (duration === 0) from recently played */
const filterMusicOnly = (songs: Song[]) =>
  songs.filter((s) => s.duration > 0);

/* ── Premium Song Row ── */
function PremiumSongRow({
  song, index, showIndex, isActive, isPlaying, onClick, onSwipeLeft, onSwipeRight,
  selectable, selected, onSelect, cached,
}: {
  song: Song; index: number; showIndex?: boolean;
  isActive: boolean; isPlaying: boolean;
  onClick: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  cached?: boolean;
}) {
  const coverUrl = useOfflineCoverUrl(song.id, song.coverUrl);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const [swiped, setSwiped] = useState<"left" | "right" | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    setSwiped(null);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - startXRef.current;
    if (diff < -80 && onSwipeLeft) { setSwiped("left"); setTimeout(() => { onSwipeLeft(); setSwiped(null); }, 300); }
    else if (diff > 80 && onSwipeRight) { setSwiped("right"); setTimeout(() => { onSwipeRight(); setSwiped(null); }, 300); }
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={selectable ? onSelect : onClick}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all duration-150 active:scale-[0.98]"
      style={{
        transform: swiped === "left" ? "translateX(-80px)" : swiped === "right" ? "translateX(80px)" : "none",
        transition: "transform 0.2s ease, background 0.15s ease",
        background: selected
          ? "hsl(var(--primary) / 0.08)"
          : isActive
          ? "hsl(var(--primary) / 0.05)"
          : "transparent",
        boxShadow: selected || isActive ? "inset 0 0 0 1px hsl(var(--primary) / 0.12)" : "none",
      }}
    >
      {selectable ? (
        <div className="w-6 flex-shrink-0 flex items-center justify-center">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: selected ? "hsl(var(--primary))" : "transparent",
              border: selected ? "1.5px solid hsl(var(--primary))" : "1.5px solid hsl(var(--muted-foreground) / 0.25)",
            }}
          >
            {selected && (
              <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        </div>
      ) : showIndex ? (
        <div className="w-6 flex-shrink-0 flex items-center justify-center">
          {isActive && isPlaying ? (
            <div className="flex items-end gap-[2px] h-3.5">
              <div className="w-[2px] rounded-full bg-primary animate-equalizer-1" />
              <div className="w-[2px] rounded-full bg-primary animate-equalizer-2" />
              <div className="w-[2px] rounded-full bg-primary animate-equalizer-3" />
            </div>
          ) : (
            <span className={`text-[11px] tabular-nums font-medium ${isActive ? "text-primary" : "text-muted-foreground/40"}`}>
              {index + 1}
            </span>
          )}
        </div>
      ) : null}

      {/* Cover */}
      <div
        className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0"
        style={{
          boxShadow: isActive
            ? "0 4px 16px hsl(var(--primary) / 0.15), 0 0 0 1px hsl(var(--primary) / 0.15)"
            : "0 2px 8px hsl(0 0% 0% / 0.08)",
        }}
      >
        {coverUrl ? (
          <img src={coverUrl} alt={song.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(var(--secondary)), hsl(var(--secondary) / 0.5))" }}>
            <Music className="w-4 h-4 text-muted-foreground/25" />
          </div>
        )}
        {!selectable && (
          <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${
            isActive ? "bg-black/20 opacity-100" : "bg-black/25 opacity-0 group-hover:opacity-100"
          }`}>
            {isActive && isPlaying ? (
              <Pause className="w-3.5 h-3.5 text-white" />
            ) : (
              <Play className="w-3.5 h-3.5 text-white ml-0.5" />
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-[12px] font-bold leading-tight truncate ${isActive ? "text-primary" : "text-foreground"}`}>
            {song.title}
          </p>
          {cached && (
            <span className="shrink-0 inline-flex items-center px-1 py-0.5 rounded" style={{ background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}>
              <Download className="w-2 h-2" />
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/45 leading-tight truncate font-medium mt-0.5">
          {song.artist}{song.album ? ` · ${song.album}` : ""}
        </p>
      </div>

      <span className="text-[10px] text-muted-foreground/35 tabular-nums flex-shrink-0 font-medium">
        {formatDuration(song.duration)}
      </span>
    </div>
  );
}

/* ── Apple Music style menu row ── */
function MenuRow({ icon: Icon, label, onClick, iconColor }: {
  icon: React.ElementType; label: string; onClick: () => void; iconColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3.5 py-3.5 active:scale-[0.98] transition-transform duration-150 rounded-2xl px-3 mb-1"
      style={{
        background: "linear-gradient(145deg, hsl(var(--card) / 0.35), hsl(var(--card) / 0.15))",
        backdropFilter: "blur(24px) saturate(1.6)",
        WebkitBackdropFilter: "blur(24px) saturate(1.6)",
        border: "0.5px solid hsl(var(--foreground) / 0.05)",
        boxShadow: "0 2px 8px hsl(0 0% 0% / 0.08), inset 0 0.5px 0 hsl(var(--foreground) / 0.03)",
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${iconColor || "hsl(var(--primary))"}15`, color: iconColor || "hsl(var(--primary))" }}
      >
        <Icon className="w-[18px] h-[18px]" />
      </div>
      <span className="flex-1 text-left text-[15px] font-semibold text-foreground">{label}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground/25 flex-shrink-0" />
    </button>
  );
}

/* ── Action Buttons Row ── */
function ActionButtons({ onPlayAll, onShuffle, extra }: {
  onPlayAll: () => void; onShuffle: () => void; extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <button
        onClick={onPlayAll}
        className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[12px] font-bold active:scale-[0.96] transition-transform"
        style={{
          background: "linear-gradient(145deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))",
          color: "hsl(var(--primary-foreground))",
          boxShadow: "0 4px 16px hsl(var(--primary) / 0.3), inset 0 0.5px 0 hsl(0 0% 100% / 0.15)",
        }}
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        Tout lire
      </button>
      <button
        onClick={onShuffle}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-semibold text-foreground active:scale-[0.96] transition-transform"
        style={{
          background: "linear-gradient(145deg, hsl(var(--card) / 0.5), hsl(var(--card) / 0.25))",
          backdropFilter: "blur(24px) saturate(1.6)",
          WebkitBackdropFilter: "blur(24px) saturate(1.6)",
          border: "0.5px solid hsl(var(--foreground) / 0.06)",
          boxShadow: "0 2px 8px hsl(0 0% 0% / 0.1), inset 0 0.5px 0 hsl(var(--foreground) / 0.04)",
        }}
      >
        <Shuffle className="w-3.5 h-3.5" />
        Aléatoire
      </button>
      {extra}
    </div>
  );
}

/* ── Empty State ── */
function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div
        className="p-5 rounded-2xl mb-4"
        style={{
          background: "linear-gradient(145deg, hsl(var(--card) / 0.5), hsl(var(--card) / 0.2))",
          backdropFilter: "blur(40px) saturate(1.8)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
          border: "0.5px solid hsl(var(--foreground) / 0.06)",
          boxShadow: "0 4px 20px hsl(0 0% 0% / 0.12)",
        }}
      >
        <Icon className="w-8 h-8 text-muted-foreground/25" />
      </div>
      <p className="text-foreground font-bold text-[14px]">{title}</p>
      <p className="text-[11px] text-muted-foreground/45 mt-1 max-w-[220px] leading-relaxed">{subtitle}</p>
    </div>
  );
}

const LibraryPage = () => {
  const [tab, setTab] = useState<Tab>(null);
  const [customSort, setCustomSort] = useState<SortOption>("recent");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [artistSearch, setArtistSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [albumSearch, setAlbumSearch] = useState("");
  const [likedSearch, setLikedSearch] = useState("");
  const [customSearch, setCustomSearch] = useState("");
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [deezerUrl, setDeezerUrl] = useState("");
  const [deezerImporting, setDeezerImporting] = useState(false);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin } = useAdminAuth();
  const { checkLibraryTab } = useSubscriptionAccess();
  const {
    likedSongs, playlists, recentlyPlayed, playlistSongs,
    createPlaylist, deletePlaylist, play, setQueue, loadPlaylistSongs,
    currentSong, isPlaying, togglePlay, clearRecentlyPlayed, loadUserData, userId,
    toggleLike, addSongToPlaylist
  } = usePlayerStore();
  const queryClient = useQueryClient();

  // Shared playlists from admin
  const { data: sharedPlaylists = [] } = useQuery({
    queryKey: ["shared-playlists", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("shared_playlists")
        .select("*")
        .eq("shared_to", userId)
        .eq("status", "accepted")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: sharedPlaylistSongsMap = {} } = useQuery({
    queryKey: ["shared-playlist-songs", sharedPlaylists.map((p: any) => p.id).join(",")],
    queryFn: async () => {
      if (sharedPlaylists.length === 0) return {};
      const ids = sharedPlaylists.map((p: any) => p.id);
      const { data, error } = await supabase
        .from("shared_playlist_songs")
        .select("*")
        .in("shared_playlist_id", ids)
        .order("position", { ascending: true });
      if (error) throw error;
      const map: Record<string, Song[]> = {};
      for (const row of data || []) {
        if (!map[row.shared_playlist_id]) map[row.shared_playlist_id] = [];
        map[row.shared_playlist_id].push({
          id: row.song_id,
          title: row.title,
          artist: row.artist,
          album: row.album || "",
          duration: row.duration || 0,
          coverUrl: row.cover_url || "",
          streamUrl: row.stream_url || "",
          liked: false,
        });
      }
      return map;
    },
    enabled: sharedPlaylists.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  // Online/offline tracking
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && userId) {
        // Only refresh user-specific data, not all queries
        loadUserData(userId);
        queryClient.invalidateQueries({ queryKey: ["shared-playlists"] });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [queryClient, userId, loadUserData]);

  const [libraryCachedIds, setLibraryCachedIds] = useState<Set<string>>(new Set());
  const [playlistCachedCounts, setPlaylistCachedCounts] = useState<Record<string, number>>({});

  const playlistIds = useMemo(() => playlists.map((p) => p.id).join(","), [playlists]);

  useEffect(() => {
    if (tab === "playlists") {
      playlists.forEach((p) => { if (!playlistSongs[p.id]) loadPlaylistSongs(p.id); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, playlistIds]);

  const playlistSongsRef = useRef(playlistSongs);
  playlistSongsRef.current = playlistSongs;

  useEffect(() => {
    if (tab !== "playlists") return;
    const ps = playlistSongsRef.current;
    const countCached = async () => {
      const counts: Record<string, number> = {};
      for (const p of playlists) {
        const songs = ps[p.id] || [];
        let count = 0;
        for (const s of songs) { if (await offlineCache.isCached(s.id)) count++; }
        counts[p.id] = count;
      }
      setPlaylistCachedCounts(counts);
    };
    countCached();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, playlistIds]);

  // (cache check moved after customSongs declaration)

  const { data: customSongs = [] } = useQuery({
    queryKey: ["custom-songs"],
    queryFn: async () => {
      // Paginate past 1000-row Supabase default limit
      let allData: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("custom_songs")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      const songs = (allData).map((s: any): Song & { _dbId: string } => ({
        _dbId: s.id, id: `custom-${s.id}`,
        title: normalizeTitle(s.title),
        artist: normalizeArtist(s.artist),
        album: s.album ? normalizeText(s.album) : "",
        duration: s.duration, coverUrl: s.cover_url || "",
        streamUrl: s.stream_url || "", liked: false,
      }));

      // Auto-fix missing durations via Audio element
      const toFixDuration = songs.filter((s) => !s.duration && s.streamUrl);
      if (toFixDuration.length > 0) {
        Promise.all(toFixDuration.map((s) => new Promise<void>((resolve) => {
          const audio = new Audio();
          audio.preload = "metadata";
          audio.src = s.streamUrl;
          audio.addEventListener("loadedmetadata", () => {
            const dur = audio.duration && isFinite(audio.duration) ? Math.round(audio.duration) : 0;
            if (dur > 0) { s.duration = dur; supabase.from("custom_songs").update({ duration: dur }).eq("id", s._dbId).then(() => {}); }
            resolve();
          }, { once: true });
          audio.addEventListener("error", () => resolve(), { once: true });
          setTimeout(() => resolve(), 5000);
        }))).then(() => queryClient.invalidateQueries({ queryKey: ["custom-songs"] }));
      }


      return songs as Song[];
    },
    staleTime: 60 * 1000,
    enabled: tab === "custom",
  });

  // Albums query — derived from custom_songs + custom_albums
  const { data: libraryAlbums = [], isLoading: loadingLibAlbums } = useQuery({
    queryKey: ["library-albums"],
    queryFn: async () => {
      // Fetch albums from songs
      const { data: songs, error: songsErr } = await supabase
        .from("custom_songs")
        .select("album, artist, cover_url, year")
        .not("stream_url", "is", null)
        .not("album", "is", null);
      if (songsErr) throw songsErr;

      // Fetch explicit custom_albums
      const { data: explicit, error: expErr } = await supabase
        .from("custom_albums")
        .select("*")
        .order("created_at", { ascending: false });
      if (expErr) throw expErr;

      // Build album map from songs
      const albumMap = new Map<string, { id: string; title: string; artist: string; cover_url: string | null; year: number | null; count: number }>();
      for (const row of songs || []) {
        if (!row.album || row.album.trim() === "") continue;
        const key = `${row.artist.toLowerCase()}|||${row.album.toLowerCase()}`;
        const existing = albumMap.get(key);
        if (existing) {
          existing.count++;
          if (!existing.cover_url && row.cover_url) existing.cover_url = row.cover_url;
          if (!existing.year && row.year) existing.year = row.year;
        } else {
          albumMap.set(key, {
            id: `derived-${key}`,
            title: row.album,
            artist: row.artist,
            cover_url: row.cover_url || null,
            year: row.year || null,
            count: 1,
          });
        }
      }

      // Merge explicit custom_albums (override derived ones)
      for (const album of explicit || []) {
        const key = `${album.artist.toLowerCase()}|||${album.title.toLowerCase()}`;
        albumMap.set(key, {
          id: album.id,
          title: album.title,
          artist: album.artist,
          cover_url: album.cover_url,
          year: album.year,
          count: albumMap.get(key)?.count || 0,
        });
      }

      return Array.from(albumMap.values()).sort((a, b) => a.title.localeCompare(b.title, "fr"));
    },
    staleTime: 2 * 60 * 1000,
    enabled: tab === "albums",
  });

  // Artists query (derived from custom_songs)
  const { data: libraryArtists = [], isLoading: loadingLibArtists } = useQuery({
    queryKey: ["library-artists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_songs")
        .select("artist, cover_url")
        .not("stream_url", "is", null);
      if (error) throw error;
      const artistMap = new Map<string, { name: string; cover: string; count: number }>();
      for (const row of data || []) {
        const existing = artistMap.get(row.artist);
        if (existing) { existing.count++; if (!existing.cover && row.cover_url) existing.cover = row.cover_url; }
        else artistMap.set(row.artist, { name: row.artist, cover: row.cover_url || "", count: 1 });
      }
      return Array.from(artistMap.values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    },
    staleTime: 2 * 60 * 1000,
    enabled: tab === "artists",
  });

  // Check which songs in current view are cached offline
  useEffect(() => {
    const allSongs = [
      ...(tab === "recent" ? recentlyPlayed : []),
      ...(tab === "liked" ? likedSongs : []),
      ...(tab === "custom" ? customSongs : []),
    ];
    if (allSongs.length === 0) { setLibraryCachedIds(new Set()); return; }
    Promise.all(
      allSongs.map((s) => offlineCache.isCached(s.id).then((c) => (c ? s.id : null)))
    ).then((ids) => setLibraryCachedIds(new Set(ids.filter(Boolean) as string[])));
  }, [tab, recentlyPlayed, likedSongs, customSongs]);

  const [cachedSongs, setCachedSongs] = useState<(Song & { cachedAt: number })[]>([]);
  const [cacheSize, setCacheSize] = useState(0);
  const [isRedownloading, setIsRedownloading] = useState(false);
  const [redownloadProgress, setRedownloadProgress] = useState({ current: 0, total: 0 });
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ done: 0, total: 0 });
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadAllProgress, setDownloadAllProgress] = useState({ current: 0, total: 0 });

  const handleDownloadAllLibrary = useCallback(async () => {
    if (downloadingAll) return;
    setDownloadingAll(true);
    try {
      // Fetch all songs from database
      const { data, error } = await supabase
        .from("custom_songs")
        .select("id, title, artist, album, cover_url, stream_url, duration, genre, year")
        .not("stream_url", "is", null);
      if (error) throw error;
      const allSongs: Song[] = (data || []).map((s: any) => ({
        id: s.id, title: s.title, artist: s.artist, album: s.album || "",
        coverUrl: s.cover_url || "", streamUrl: s.stream_url || "",
        duration: s.duration || 0, liked: false, genre: s.genre, year: s.year,
      }));

      // Filter already cached
      const toDownload: Song[] = [];
      for (const s of allSongs) {
        const cached = await offlineCache.isCached(s.id);
        if (!cached) toDownload.push(s);
      }

      setDownloadAllProgress({ current: 0, total: toDownload.length });
      if (toDownload.length === 0) {
        toast.success("Tout est déjà téléchargé !");
        setDownloadingAll(false);
        return;
      }

      let done = 0;
      // Download 3 at a time
      const queue = [...toDownload];
      const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
        while (queue.length > 0) {
          const song = queue.shift()!;
          try {
            await offlineCache.cacheSong(song);
          } catch (e) {
            console.error(`[dl-all] Failed: ${song.title}`, e);
          }
          done++;
          setDownloadAllProgress({ current: done, total: toDownload.length });
        }
      });
      await Promise.all(workers);

      // Refresh cached songs list
      const [songs, size] = await Promise.all([offlineCache.getAllCached(), offlineCache.getCacheSize()]);
      setCachedSongs(songs);
      setCacheSize(size);
      toast.success(`${done} morceaux téléchargés !`);
    } catch (e) {
      console.error("[dl-all]", e);
      toast.error("Erreur lors du téléchargement");
    } finally {
      setDownloadingAll(false);
    }
  }, [downloadingAll]);

  useEffect(() => {
    if (tab !== "downloads" && !isOffline) return;
    const load = async () => {
      const [songs, size] = await Promise.all([offlineCache.getAllCached(), offlineCache.getCacheSize()]);
      setCachedSongs(songs);
      setCacheSize(size);
    };
    load();
  }, [tab, isOffline]);

  const sortedCustomSongs = useMemo(() => {
    let arr = [...customSongs];
    // Search filter
    if (customSearch.trim()) {
      const q = customSearch.toLowerCase().trim();
      arr = arr.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || (s.album && s.album.toLowerCase().includes(q)));
    }
    switch (customSort) {
      case "alpha": return arr.sort((a, b) => a.title.localeCompare(b.title, "fr"));
      case "artist": return arr.sort((a, b) => a.artist.localeCompare(b.artist, "fr"));
      case "duration": return arr.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      default: return arr;
    }
  }, [customSongs, customSort, customSearch]);

  const removeCached = async (songId: string) => {
    await offlineCache.removeCached(songId);
    setCachedSongs((prev) => prev.filter((s) => s.id !== songId));
    const size = await offlineCache.getCacheSize();
    setCacheSize(size);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    createPlaylist(newName.trim());
    setNewName("");
    setShowCreate(false);
  };

  const isDeezerPlaylistUrl = (url: string) => {
    return /deezer\.\w+\/.*playlist/i.test(url) || /link\.deezer/i.test(url);
  };

  const handleCreateFromDeezer = async () => {
    if (!deezerUrl.trim()) return;
    setDeezerImporting(true);
    try {
      let resolvedUrl = deezerUrl.trim();
      // Resolve short link
      if (/link\.deezer/i.test(resolvedUrl)) {
        const { data } = await supabase.functions.invoke("deezer-proxy", {
          body: { resolveUrl: resolvedUrl },
        });
        if (data?.resolvedUrl) resolvedUrl = data.resolvedUrl;
      }
      // Extract playlist ID
      const playlistMatch = resolvedUrl.match(/playlist\/(\d+)/i);
      if (!playlistMatch) {
        toast.error("URL de playlist Deezer invalide");
        setDeezerImporting(false);
        return;
      }
      const playlistId = playlistMatch[1];
      // Fetch playlist info
      const { data: plData } = await supabase.functions.invoke("deezer-proxy", {
        body: { path: `/playlist/${playlistId}` },
      });
      const playlistName = plData?.title || "Playlist Deezer";
      const deezerTracks = plData?.tracks?.data || [];
      if (deezerTracks.length === 0) {
        toast.error("Playlist vide ou introuvable");
        setDeezerImporting(false);
        return;
      }
      // Create playlist
      await createPlaylist(playlistName);
      // Wait for state to update
      await new Promise((r) => setTimeout(r, 300));
      const newPlaylists = usePlayerStore.getState().playlists;
      const newPl = newPlaylists.find((p) => p.name === playlistName);
      if (!newPl) {
        toast.error("Erreur lors de la création");
        setDeezerImporting(false);
        return;
      }
      // Match Deezer tracks with local library
      const { data: allSongs } = await supabase
        .from("custom_songs")
        .select("id, title, artist, album, duration, cover_url, stream_url")
        .not("stream_url", "is", null);
      const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      let matched = 0;
      for (const dt of deezerTracks) {
        const dTitle = normalize(dt.title || "");
        const dArtist = normalize(dt.artist?.name || "");
        const match = (allSongs || []).find((s: any) => {
          const sTitle = normalize(s.title);
          const sArtist = normalize(s.artist);
          return (sTitle.includes(dTitle) || dTitle.includes(sTitle)) &&
                 (sArtist.includes(dArtist) || dArtist.includes(sArtist));
        });
        if (match) {
          const song: Song = {
            id: `custom-${match.id}`,
            title: match.title,
            artist: match.artist,
            album: match.album || "",
            duration: match.duration || 0,
            coverUrl: match.cover_url || "",
            streamUrl: match.stream_url || "",
            liked: false,
          };
          await addSongToPlaylist(newPl.id, song);
          matched++;
        }
      }
      toast.success(`"${playlistName}" créée — ${matched}/${deezerTracks.length} morceaux trouvés localement`);
      setDeezerUrl("");
      setShowCreate(false);
    } catch (e) {
      console.error("[deezer-playlist]", e);
      toast.error("Erreur lors de l'import Deezer");
    } finally {
      setDeezerImporting(false);
    }
  };

  // Filtered recent: music only (no radios)
  const recentMusic = useMemo(() => {
    const music = filterMusicOnly(filterFullStreams(recentlyPlayed));
    // Deduplicate
    const seen = new Set<string>();
    return music.filter((s) => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
  }, [recentlyPlayed]);

  // Dynamic header color from first song
  const headerSong = tab === "recent" ? recentMusic[0] : tab === "liked" ? likedSongs[0] : tab === "custom" ? customSongs[0] : null;
  const headerColor = useDominantColor(headerSong?.coverUrl);

  const allTabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "recent", label: "Récents", icon: Clock },
    { key: "liked", label: "Aimés", icon: Heart },
    { key: "playlists", label: "Playlists", icon: ListMusic },
    { key: "albums", label: "Albums", icon: Disc3 },
    { key: "artists", label: "Artistes", icon: User },
    { key: "custom", label: "Mes titres", icon: Music },
    { key: "downloads", label: "Hors-ligne", icon: Download },
  ];

  const tabs = isAdmin ? allTabs : allTabs.filter((t) => t.key !== "custom");
  const isGuest = !authLoading && !user;

  useEffect(() => {
    setTab((prev) => {
      if (!isAdmin && prev === "custom") {
        return isOffline ? "downloads" : null;
      }
      if (isOffline && prev !== "downloads" && prev !== null) {
        return "downloads";
      }
      if (isGuest && !isOffline && prev !== "downloads" && prev !== null) {
        return "downloads";
      }
      if (prev && !checkLibraryTab(prev) && !isOffline && !isGuest) {
        return null;
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, isOffline, isAdmin]);

  const visibleTabs = isOffline
    ? tabs.filter((t) => t.key === "downloads")
    : isGuest
      ? tabs.filter((t) => t.key === "downloads")
      : tabs.filter((t) => checkLibraryTab(t.key));

  const activeTabLabel = tab ? visibleTabs.find((t) => t.key === tab)?.label : null;

  return (
    <div className="pb-20 max-w-7xl mx-auto relative">
      {/* Header — Liquid Glass */}
      <div
        className="sticky top-0 z-20 transition-colors duration-500"
        style={{
          background: tab && headerColor
            ? `linear-gradient(180deg, ${headerColor}12 0%, hsl(var(--background) / 0.92) 70%, hsl(var(--background) / 0) 100%)`
            : "linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background) / 0.92) 70%, hsl(var(--background) / 0) 100%)",
          backdropFilter: "blur(40px) saturate(1.8)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        }}
      >
        <div className="relative px-5 md:px-9 pt-[max(1.5rem,env(safe-area-inset-top))] pb-3">
          {isOffline && (
            <div
              className="flex items-center gap-2 px-3 py-2 mb-3 rounded-2xl"
              style={{
                background: "linear-gradient(145deg, hsl(45 100% 50% / 0.08), hsl(45 100% 50% / 0.03))",
                backdropFilter: "blur(20px)",
                border: "0.5px solid hsl(45 100% 50% / 0.15)",
              }}
            >
              <WifiOff className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <p className="text-[11px] text-amber-400 font-medium">Mode hors-ligne</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            {tab !== null && (
              <button
                onClick={() => setTab(null)}
                className="flex items-center gap-1 text-primary text-[14px] font-medium active:opacity-70 transition-opacity -ml-1"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            )}
            <div className="flex-1">
              <h1 className="text-[28px] md:text-[34px] font-black text-foreground leading-tight tracking-tight">
                {isOffline ? "Hors-ligne" : tab !== null ? (activeTabLabel || "Bibliothèque") : "Bibliothèque"}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Apple Music style menu */}
      {tab === null && (
        <div className="px-5 md:px-9 mt-1">
          {visibleTabs.map(({ key, label, icon }) => (
            <MenuRow key={key} icon={icon} label={label} onClick={() => setTab(key)} />
          ))}
        </div>
      )}

      {/* Tab Content */}
      {tab !== null && (
      <div className="px-5 md:px-9 mt-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* ── RECENT ── */}
            {tab === "recent" && (
              <div>
                {recentMusic.length === 0 ? (
                  <EmptyState icon={Clock} title="Rien d'écouté récemment" subtitle="Vos morceaux écoutés apparaîtront ici" />
                ) : (
                  <>
                    <ActionButtons
                      onPlayAll={() => { setQueue(recentMusic); play(recentMusic[0]); }}
                      onShuffle={() => { const s = [...recentMusic].sort(() => Math.random() - 0.5); setQueue(s); play(s[0]); }}
                      extra={
                        <button
                          onClick={() => clearRecentlyPlayed()}
                          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-full bg-destructive/10 text-destructive text-xs font-medium active:scale-95 transition-transform"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      }
                    />
                    <p className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wider mb-2 px-1">
                      {recentMusic.length} morceau{recentMusic.length > 1 ? "x" : ""}
                    </p>
                    <div className="rounded-2xl overflow-hidden" style={{
                      background: "linear-gradient(145deg, hsl(var(--card) / 0.35), hsl(var(--card) / 0.15))",
                      backdropFilter: "blur(24px) saturate(1.6)",
                      WebkitBackdropFilter: "blur(24px) saturate(1.6)",
                      border: "0.5px solid hsl(var(--foreground) / 0.05)",
                      boxShadow: "0 4px 20px hsl(0 0% 0% / 0.1), inset 0 0.5px 0 hsl(var(--foreground) / 0.03)",
                    }}>
                      {recentMusic.map((s, i) => (
                        <PremiumSongRow
                          key={`${s.id}-${i}`}
                          song={s}
                          index={i}
                          showIndex
                          cached={libraryCachedIds.has(s.id)}
                          isActive={currentSong?.id === s.id}
                          isPlaying={currentSong?.id === s.id && isPlaying}
                          onClick={() => { if (currentSong?.id === s.id) togglePlay(); else { setQueue(recentMusic); play(s); } }}
                          onSwipeRight={() => toggleLike(s)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── LIKED ── */}
            {tab === "liked" && (
              <div>
                {filterFullStreams(likedSongs).length === 0 ? (
                  <EmptyState icon={Heart} title="Pas encore de favoris" subtitle="Likez des morceaux pour les retrouver ici" />
                ) : (
                  <>
                    <div className="relative mb-3">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                       <input
                        type="text"
                        value={likedSearch}
                        onChange={(e) => setLikedSearch(e.target.value)}
                        placeholder="Rechercher dans mes titres..."
                        className="w-full pl-9 pr-8 py-2.5 rounded-2xl text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                        style={{
                          background: "linear-gradient(145deg, hsl(var(--card) / 0.45), hsl(var(--card) / 0.2))",
                          backdropFilter: "blur(24px) saturate(1.6)",
                          WebkitBackdropFilter: "blur(24px) saturate(1.6)",
                          border: "0.5px solid hsl(var(--foreground) / 0.06)",
                          boxShadow: "0 2px 12px hsl(0 0% 0% / 0.1), inset 0 0.5px 0 hsl(var(--foreground) / 0.04)",
                         }}
                      />
                      {likedSearch && (
                        <button onClick={() => setLikedSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <ActionButtons
                      onPlayAll={() => { const full = filterFullStreams(likedSongs); setQueue(full); play(full[0]); }}
                      onShuffle={() => { const s = filterFullStreams([...likedSongs]).sort(() => Math.random() - 0.5); setQueue(s); play(s[0]); }}
                    />
                    {(() => {
                      const fullLiked = filterFullStreams(likedSongs);
                      const filtered = likedSearch.trim()
                        ? fullLiked.filter((s) => {
                            const q = likedSearch.toLowerCase().trim();
                            return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || (s.album && s.album.toLowerCase().includes(q));
                          })
                        : fullLiked;
                      return (
                        <>
                          <p className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wider mb-2 px-1">
                            {filtered.length} titre{filtered.length > 1 ? "s" : ""}{likedSearch.trim() ? ` sur ${fullLiked.length}` : ""}
                          </p>
                          <div className="rounded-2xl overflow-hidden" style={{
                            background: "linear-gradient(145deg, hsl(var(--card) / 0.35), hsl(var(--card) / 0.15))",
                            backdropFilter: "blur(24px) saturate(1.6)",
                            WebkitBackdropFilter: "blur(24px) saturate(1.6)",
                            border: "0.5px solid hsl(var(--foreground) / 0.05)",
                            boxShadow: "0 4px 20px hsl(0 0% 0% / 0.1), inset 0 0.5px 0 hsl(var(--foreground) / 0.03)",
                          }}>
                            {filtered.map((s, i) => (
                              <PremiumSongRow
                                key={s.id}
                                song={s}
                                index={i}
                                showIndex
                                cached={libraryCachedIds.has(s.id)}
                                isActive={currentSong?.id === s.id}
                                isPlaying={currentSong?.id === s.id && isPlaying}
                                onClick={() => { if (currentSong?.id === s.id) togglePlay(); else { setQueue(filtered); play(s); } }}
                                onSwipeLeft={() => toggleLike(s)}
                              />
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* ── PLAYLISTS ── */}
            {tab === "playlists" && (
              <div>
                <button
                  onClick={() => setShowCreate(!showCreate)}
                  className="flex items-center gap-2.5 mb-4 px-4 py-3 rounded-2xl w-full text-foreground text-sm font-medium active:scale-[0.98] transition-all"
                  style={{
                    background: "linear-gradient(145deg, hsl(var(--card) / 0.35), hsl(var(--card) / 0.15))",
                    backdropFilter: "blur(24px) saturate(1.6)",
                    WebkitBackdropFilter: "blur(24px) saturate(1.6)",
                    border: "0.5px solid hsl(var(--foreground) / 0.05)",
                    boxShadow: "0 2px 8px hsl(0 0% 0% / 0.08), inset 0 0.5px 0 hsl(var(--foreground) / 0.03)",
                  }}
                >
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                  Nouvelle Playlist
                </button>

                <AnimatePresence>
                  {showCreate && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 overflow-hidden space-y-2"
                    >
                      {/* Manual name */}
                      <div className="flex gap-2">
                        <input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                          placeholder="Nom de la playlist..."
                          className="flex-1 px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          autoFocus
                        />
                        <button onClick={handleCreate} className="px-5 py-3 rounded-full text-sm font-semibold active:scale-[0.97] transition-transform" style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>Créer</button>
                      </div>

                      {/* Deezer URL import */}
                      <div className="flex gap-2">
                        <input
                          value={deezerUrl}
                          onChange={(e) => setDeezerUrl(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleCreateFromDeezer()}
                          placeholder="🔗 Coller un lien Deezer playlist..."
                          className="flex-1 px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <button
                          onClick={handleCreateFromDeezer}
                          disabled={deezerImporting || !deezerUrl.trim()}
                          className="px-4 py-3 rounded-full text-sm font-semibold active:scale-[0.97] transition-transform disabled:opacity-40"
                          style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
                        >
                          {deezerImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Import"}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {playlists.length === 0 ? (
                  <EmptyState icon={ListMusic} title="Pas encore de playlists" subtitle="Créez votre première playlist ci-dessus" />
                ) : (
                  <div className="space-y-2.5">
                    {playlists.map((p, idx) => {
                      const pSongs = playlistSongs[p.id] || [];
                      const cachedCount = playlistCachedCounts[p.id] || 0;
                      const coverImg = p.cover_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop";
                      const songCovers = !p.cover_url && pSongs.length >= 4
                        ? pSongs.slice(0, 4).map((s) => s.coverUrl).filter(Boolean)
                        : null;

                      return (
                        <motion.div
                          key={p.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="group relative"
                        >
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate(`/playlist/${p.id}`)}
                            className="w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all"
                            style={{
                              background: "linear-gradient(145deg, hsl(var(--card) / 0.35), hsl(var(--card) / 0.15))",
                              backdropFilter: "blur(24px) saturate(1.6)",
                              WebkitBackdropFilter: "blur(24px) saturate(1.6)",
                              border: "0.5px solid hsl(var(--foreground) / 0.05)",
                              boxShadow: "0 2px 8px hsl(0 0% 0% / 0.08), inset 0 0.5px 0 hsl(var(--foreground) / 0.03)",
                            }}
                          >
                            {/* Cover */}
                            <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-lg shrink-0">
                              {songCovers && songCovers.length >= 4 ? (
                                <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                                  {songCovers.map((url, ci) => (
                                    <img key={ci} src={url} alt="" className="w-full h-full object-cover" />
                                  ))}
                                </div>
                              ) : (
                                <img src={coverImg} alt={p.name} className="w-full h-full object-cover" />
                              )}
                              {cachedCount > 0 && (
                                <div className={`absolute bottom-0.5 right-0.5 flex items-center justify-center rounded-full shadow-md ${
                                  cachedCount === pSongs.length && pSongs.length > 0
                                    ? "w-5 h-5 bg-primary"
                                    : "w-5 h-5 bg-primary/80"
                                }`}>
                                  <Download className="w-2.5 h-2.5 text-primary-foreground" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1 text-left">
                              <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                                {pSongs.length} titre{pSongs.length !== 1 ? "s" : ""}
                                {cachedCount > 0 && <span className="text-primary"> · {cachedCount} hors-ligne</span>}
                              </p>
                            </div>

                            <ChevronRight className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
                          </motion.button>

                          <button
                            onClick={() => deletePlaylist(p.id)}
                            className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Shared playlists from admin */}
                {sharedPlaylists.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <ListMusic className="w-4 h-4 text-primary" />
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Playlists partagées
                      </h3>
                    </div>
                    <div className="space-y-2.5">
                      {sharedPlaylists.map((sp: any, idx: number) => {
                        const spSongs = sharedPlaylistSongsMap[sp.id] || [];
                        const coverImg = sp.cover_url || (spSongs[0]?.coverUrl) || "";
                        return (
                          <motion.div
                            key={sp.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.04 }}
                          >
                            <motion.button
                              whileTap={{ scale: 0.98 }}
                              onClick={() => navigate(`/shared-playlist/${sp.id}`)}
                              className="w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all"
                              style={{
                                background: "linear-gradient(145deg, hsl(var(--card) / 0.35), hsl(var(--card) / 0.15))",
                                backdropFilter: "blur(24px) saturate(1.6)",
                                WebkitBackdropFilter: "blur(24px) saturate(1.6)",
                                border: "0.5px solid hsl(var(--foreground) / 0.05)",
                                boxShadow: "0 2px 8px hsl(0 0% 0% / 0.08), inset 0 0.5px 0 hsl(var(--foreground) / 0.03)",
                              }}
                            >
                              <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-lg shrink-0">
                                {coverImg ? (
                                  <img src={coverImg} alt={sp.playlist_name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                    <ListMusic className="w-6 h-6 text-primary/30" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 text-left">
                                <p className="text-sm font-semibold text-foreground truncate">{sp.playlist_name}</p>
                                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                                  {spSongs.length} titre{spSongs.length !== 1 ? "s" : ""} · Partagée par l'admin
                                </p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
                            </motion.button>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ALBUMS ── */}
            {tab === "albums" && (
              <div>
                {loadingLibAlbums ? (
                  <div className="grid grid-cols-3 gap-2.5">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="aspect-square rounded-xl bg-secondary mb-1.5" />
                        <div className="h-2.5 w-16 bg-secondary rounded mb-1" />
                        <div className="h-2 w-12 bg-secondary rounded" />
                      </div>
                    ))}
                  </div>
                ) : libraryAlbums.length === 0 ? (
                  <EmptyState icon={Disc3} title="Aucun album" subtitle="Les albums apparaîtront ici" />
                ) : (
                  <>
                    <p className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wider mb-2 px-1">
                      {libraryAlbums.length} album{libraryAlbums.length > 1 ? "s" : ""}
                    </p>

                    {/* Search albums by artist */}
                    <div className="relative mb-3">
                      <input
                        type="text"
                        value={albumSearch}
                        onChange={(e) => setAlbumSearch(e.target.value)}
                        placeholder="Rechercher par artiste..."
                        className="w-full px-3 py-2.5 rounded-2xl text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                        style={{
                          background: "linear-gradient(145deg, hsl(var(--card) / 0.45), hsl(var(--card) / 0.2))",
                          backdropFilter: "blur(24px) saturate(1.6)",
                          WebkitBackdropFilter: "blur(24px) saturate(1.6)",
                          border: "0.5px solid hsl(var(--foreground) / 0.06)",
                          boxShadow: "0 2px 12px hsl(0 0% 0% / 0.1), inset 0 0.5px 0 hsl(var(--foreground) / 0.04)",
                        }}
                      />
                      {albumSearch && (
                        <button onClick={() => setAlbumSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {isAdmin && (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        disabled={enriching}
                        onClick={async () => {
                          if (libraryAlbums.length === 0) { toast.info("Aucun album à enrichir"); return; }
                          setEnriching(true);
                          setEnrichProgress({ done: 0, total: libraryAlbums.length });
                          try {
                            let offset = 0;
                            let totalUpdated = 0;
                            let done = false;
                            while (!done) {
                              const { data, error } = await supabase.functions.invoke("enrich-metadata", {
                                body: { mode: "albums", offset, only_missing: true },
                              });
                              if (error) throw error;
                              totalUpdated += data.updated || 0;
                              offset = data.nextOffset || offset + 50;
                              done = data.done;
                              setEnrichProgress({ done: Math.min(offset, libraryAlbums.length), total: libraryAlbums.length });
                            }
                            if (totalUpdated > 0) {
                              toast.success(`${totalUpdated} album${totalUpdated > 1 ? "s" : ""} enrichi${totalUpdated > 1 ? "s" : ""} via Deezer`);
                              queryClient.invalidateQueries({ queryKey: ["library-albums"] });
                              queryClient.invalidateQueries({ queryKey: ["home-albums"] });
                            } else {
                              toast.info("Aucune nouvelle métadonnée trouvée");
                            }
                          } catch (e) { toast.error("Erreur lors de l'enrichissement"); console.error(e); }
                          setEnriching(false);
                        }}
                        className="w-full mb-3 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-border/30"
                      >
                        {enriching ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Deezer... {enrichProgress.total > 0 ? `${enrichProgress.done}/${enrichProgress.total}` : ""}
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Enrichir covers albums Deezer
                          </>
                        )}
                      </motion.button>
                    )}
                    <div className="grid grid-cols-3 gap-2.5">
                      {libraryAlbums
                        .filter((album) => {
                          if (!albumSearch.trim()) return true;
                          const q = albumSearch.toLowerCase().trim();
                          return album.artist.toLowerCase().includes(q) || album.title.toLowerCase().includes(q);
                        })
                        .map((album, i) => (
                        <motion.button
                          key={album.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            if (album.id.startsWith("derived-")) {
                              navigate(`/album/by-name?artist=${encodeURIComponent(album.artist)}&album=${encodeURIComponent(album.title)}`);
                            } else {
                              navigate(`/album/${album.id}`);
                            }
                          }}
                          className="text-left group"
                        >
                          <div className="aspect-square rounded-2xl overflow-hidden mb-1.5 relative" style={{ boxShadow: "0 4px 16px hsl(0 0% 0% / 0.1)" }}>
                            {album.cover_url ? (
                              <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.04))" }}>
                                <Disc3 className="w-8 h-8 text-primary/25" />
                              </div>
                            )}
                          </div>
                          <p className="text-[11px] font-bold text-foreground truncate">{album.title}</p>
                          <p className="text-[9px] text-muted-foreground/45 truncate font-medium">{album.artist}{album.year ? ` · ${album.year}` : ""}</p>
                        </motion.button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── ARTISTS ── */}
            {tab === "artists" && (
              <div>
                {loadingLibArtists ? (
                  <div className="grid grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="animate-pulse flex flex-col items-center">
                        <div className="w-24 h-24 rounded-full bg-secondary mb-2" />
                        <div className="h-3 w-16 bg-secondary rounded" />
                      </div>
                    ))}
                  </div>
                ) : libraryArtists.length === 0 ? (
                  <EmptyState icon={User} title="Aucun artiste" subtitle="Les artistes apparaîtront ici" />
                ) : (
                  <>
                    <div className="relative mb-3">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <input
                        type="text"
                        value={artistSearch}
                        onChange={(e) => setArtistSearch(e.target.value)}
                        placeholder="Rechercher un artiste..."
                        className="w-full pl-9 pr-8 py-2.5 rounded-2xl text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                        style={{
                          background: "linear-gradient(145deg, hsl(var(--card) / 0.45), hsl(var(--card) / 0.2))",
                          backdropFilter: "blur(24px) saturate(1.6)",
                          WebkitBackdropFilter: "blur(24px) saturate(1.6)",
                          border: "0.5px solid hsl(var(--foreground) / 0.06)",
                          boxShadow: "0 2px 12px hsl(0 0% 0% / 0.1), inset 0 0.5px 0 hsl(var(--foreground) / 0.04)",
                        }}
                      />
                      {artistSearch && (
                        <button onClick={() => setArtistSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {(() => {
                      const filtered = artistSearch.trim()
                        ? libraryArtists.filter((a) => a.name.toLowerCase().includes(artistSearch.toLowerCase().trim()))
                        : libraryArtists;
                      return (
                        <>
                          <p className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wider mb-3 px-1">
                            {filtered.length} artiste{filtered.length > 1 ? "s" : ""}{artistSearch.trim() ? ` sur ${libraryArtists.length}` : ""}
                          </p>
                          <div className="grid grid-cols-3 gap-4">
                            {filtered.map((artist, i) => (
                              <ArtistLibraryCard key={artist.name} artist={artist} index={i} navigate={navigate} />
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* ── CUSTOM ── */}
            {tab === "custom" && (
              <div>
                {customSongs.length === 0 ? (
                  <EmptyState icon={Music} title="Aucun titre ajouté" subtitle="Les titres ajoutés par l'admin apparaissent ici" />
                ) : (
                  <>
                    {/* Enrich metadata button — server-side batch */}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      disabled={enriching}
                      onClick={async () => {
                        if (customSongs.length === 0) { toast.info("Aucun morceau à enrichir"); return; }
                        setEnriching(true);
                        setEnrichProgress({ done: 0, total: customSongs.length });
                        try {
                          let offset = 0;
                          let totalUpdated = 0;
                          let done = false;
                          while (!done) {
                            const { data, error } = await supabase.functions.invoke("enrich-metadata", {
                              body: { offset, only_missing: false },
                            });
                            if (error) throw error;
                            totalUpdated += data.updated || 0;
                            offset = data.nextOffset || offset + 50;
                            done = data.done;
                            setEnrichProgress({ done: Math.min(offset, customSongs.length), total: customSongs.length });
                          }
                          if (totalUpdated > 0) {
                            toast.success(`${totalUpdated} morceau${totalUpdated > 1 ? "x" : ""} enrichi${totalUpdated > 1 ? "s" : ""} via Deezer`);
                            queryClient.invalidateQueries({ queryKey: ["custom-songs"] });
                          } else {
                            toast.info("Aucune nouvelle métadonnée trouvée");
                          }
                        } catch (e) { toast.error("Erreur lors de l'enrichissement"); console.error(e); }
                        setEnriching(false);
                      }}
                      className="w-full mb-4 py-3 rounded-2xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-border/30"
                    >
                      {enriching ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Deezer... {enrichProgress.total > 0 ? `${enrichProgress.done}/${enrichProgress.total}` : ""}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Enrichir métadonnées Deezer
                        </>
                      )}
                    </motion.button>

                    {/* Search */}
                    <div className="relative mb-3">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <input
                        type="text"
                        value={customSearch}
                        onChange={(e) => setCustomSearch(e.target.value)}
                        placeholder="Rechercher un morceau..."
                        className="w-full pl-9 pr-8 py-2.5 rounded-2xl text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                        style={{
                          background: "linear-gradient(145deg, hsl(var(--card) / 0.45), hsl(var(--card) / 0.2))",
                          backdropFilter: "blur(24px) saturate(1.6)",
                          WebkitBackdropFilter: "blur(24px) saturate(1.6)",
                          border: "0.5px solid hsl(var(--foreground) / 0.06)",
                          boxShadow: "0 2px 12px hsl(0 0% 0% / 0.1), inset 0 0.5px 0 hsl(var(--foreground) / 0.04)",
                        }}
                      />
                      {customSearch && (
                        <button onClick={() => setCustomSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Sort + Select toggle */}
                    <div className="relative flex items-center justify-between px-1 mb-3">
                      <p className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wider">
                        {selectMode ? `${selectedIds.size} sélectionné${selectedIds.size > 1 ? "s" : ""}` : `${sortedCustomSongs.length} titre${sortedCustomSongs.length > 1 ? "s" : ""}${customSearch.trim() ? ` sur ${customSongs.length}` : ""}`}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            selectMode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground rounded-2xl bg-card/40 backdrop-blur-md border border-border/10"
                          }`}
                        >
                          {selectMode ? <X className="w-3 h-3" /> : <CheckSquare className="w-3 h-3" />}
                          {selectMode ? "Annuler" : "Sélectionner"}
                        </button>
                        {!selectMode && (
                          <button
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground rounded-2xl bg-card/40 backdrop-blur-md border border-border/10 transition-colors"
                          >
                            <ArrowUpDown className="w-3 h-3" />
                            {customSort === "recent" ? "Récent" : customSort === "alpha" ? "A→Z" : customSort === "artist" ? "Artiste" : "Durée"}
                          </button>
                        )}
                      </div>
                      <AnimatePresence>
                        {showSortMenu && !selectMode && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            className="absolute right-0 top-8 z-20 bg-card border border-border rounded-2xl shadow-xl py-1.5 min-w-[150px] overflow-hidden"
                          >
                            {([
                              { key: "recent" as SortOption, label: "Plus récent" },
                              { key: "alpha" as SortOption, label: "Titre A→Z" },
                              { key: "artist" as SortOption, label: "Artiste A→Z" },
                              { key: "duration" as SortOption, label: "Durée" },
                            ]).map((opt) => (
                              <button
                                key={opt.key}
                                onClick={() => { setCustomSort(opt.key); setShowSortMenu(false); }}
                                className={`w-full text-left px-4 py-2.5 text-xs transition-colors ${
                                  customSort === opt.key ? "text-primary font-semibold bg-primary/5" : "text-foreground hover:bg-secondary"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Select all / actions bar */}
                    <AnimatePresence>
                      {selectMode && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mb-3"
                        >
                          <div className="flex items-center gap-2 px-1 overflow-x-auto scrollbar-hide pb-1 -mb-1">
                            <button
                              onClick={() => {
                                if (selectedIds.size === sortedCustomSongs.length) setSelectedIds(new Set());
                                else setSelectedIds(new Set(sortedCustomSongs.map((s) => s.id)));
                              }}
                              className="px-3 py-1.5 rounded-full text-xs font-medium rounded-2xl bg-card/40 backdrop-blur-md border border-border/10 text-foreground whitespace-nowrap flex-shrink-0"
                            >
                              {selectedIds.size === sortedCustomSongs.length ? "Tout désélectionner" : "Tout sélectionner"}
                            </button>
                            {selectedIds.size > 0 && (
                              <>
                                <button
                                  onClick={() => {
                                    const sel = sortedCustomSongs.filter((s) => selectedIds.has(s.id));
                                    setQueue(sel); play(sel[0]);
                                    setSelectMode(false); setSelectedIds(new Set());
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/25 whitespace-nowrap flex-shrink-0"
                                >
                                  <Play className="w-3 h-3" /> Lire
                                </button>
                                <button
                                  onClick={() => {
                                    const sel = sortedCustomSongs.filter((s) => selectedIds.has(s.id));
                                    sel.forEach((s) => toggleLike(s));
                                    toast.success(`${sel.length} titre${sel.length > 1 ? "s" : ""} ajouté${sel.length > 1 ? "s" : ""} aux favoris`);
                                    setSelectMode(false); setSelectedIds(new Set());
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full rounded-2xl bg-card/40 backdrop-blur-md border border-border/10 text-foreground text-xs font-medium whitespace-nowrap flex-shrink-0"
                                >
                                  <Heart className="w-3 h-3" /> Favoris
                                </button>
                                <button
                                  onClick={() => {
                                    const sel = sortedCustomSongs.filter((s) => selectedIds.has(s.id));
                                    const current = usePlayerStore.getState().queue;
                                    setQueue([...current, ...sel]);
                                    toast.success(`${sel.length} titre${sel.length > 1 ? "s" : ""} ajouté${sel.length > 1 ? "s" : ""} à la file`);
                                    setSelectMode(false); setSelectedIds(new Set());
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full rounded-2xl bg-card/40 backdrop-blur-md border border-border/10 text-foreground text-xs font-medium whitespace-nowrap flex-shrink-0"
                                >
                                  <ListPlus className="w-3 h-3" /> File
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={async () => {
                                      const ids = Array.from(selectedIds);
                                      const confirmed = window.confirm(`Supprimer ${ids.length} titre${ids.length > 1 ? "s" : ""} définitivement ?`);
                                      if (!confirmed) return;
                                      const batchSize = 50;
                                      for (let i = 0; i < ids.length; i += batchSize) {
                                        const batch = ids.slice(i, i + batchSize);
                                        await supabase.from("custom_songs").delete().in("id", batch);
                                      }
                                      toast.success(`${ids.length} titre${ids.length > 1 ? "s" : ""} supprimé${ids.length > 1 ? "s" : ""}`);
                                      setSelectMode(false); setSelectedIds(new Set());
                                      queryClient.invalidateQueries({ queryKey: ["custom-songs"] });
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium whitespace-nowrap flex-shrink-0"
                                  >
                                    <Trash2 className="w-3 h-3" /> Supprimer
                                  </button>
                                )}
                                {isAdmin && selectedIds.size > 0 && (
                                  <button
                                    disabled={enriching}
                                    onClick={async () => {
                                      const ids = Array.from(selectedIds).map(id => id.replace("custom-", ""));
                                      setEnriching(true);
                                      setEnrichProgress({ done: 0, total: ids.length });
                                      try {
                                        // Process in batches of 50
                                        let totalUpdated = 0;
                                        for (let i = 0; i < ids.length; i += 50) {
                                          const batch = ids.slice(i, i + 50);
                                          const { data, error } = await supabase.functions.invoke("enrich-metadata", {
                                            body: { song_ids: batch, only_missing: false },
                                          });
                                          if (error) throw error;
                                          totalUpdated += data.updated || 0;
                                          setEnrichProgress({ done: Math.min(i + 50, ids.length), total: ids.length });
                                        }
                                        if (totalUpdated > 0) {
                                          toast.success(`${totalUpdated} morceau${totalUpdated > 1 ? "x" : ""} enrichi${totalUpdated > 1 ? "s" : ""}`);
                                          queryClient.invalidateQueries({ queryKey: ["custom-songs"] });
                                        } else {
                                          toast.info("Aucune nouvelle métadonnée trouvée");
                                        }
                                      } catch (e) { toast.error("Erreur enrichissement"); console.error(e); }
                                      setEnriching(false);
                                      setSelectMode(false); setSelectedIds(new Set());
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-medium disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                                  >
                                    {enriching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                    Enrichir
                                  </button>
                                )}
                                <div className="relative">
                                  <button
                                    onClick={() => setShowPlaylistPicker(!showPlaylistPicker)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-full rounded-2xl bg-card/40 backdrop-blur-md border border-border/10 text-foreground text-xs font-medium whitespace-nowrap flex-shrink-0"
                                  >
                                    <ListMusic className="w-3 h-3" /> Playlist
                                  </button>
                                  <AnimatePresence>
                                    {showPlaylistPicker && (
                                      <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 4 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 4 }}
                                        className="absolute left-0 bottom-full mb-1 z-50 w-56 rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="p-2 border-b border-border">
                                          <p className="text-xs font-semibold text-muted-foreground px-2 py-1">Ajouter {selectedIds.size} titre{selectedIds.size > 1 ? "s" : ""} à</p>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto p-1">
                                          {playlists.length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-4">Aucune playlist</p>
                                          ) : (
                                            playlists.map((p) => (
                                              <button
                                                key={p.id}
                                                onClick={async () => {
                                                  const sel = sortedCustomSongs.filter((s) => selectedIds.has(s.id));
                                                  const existing = playlistSongs[p.id] || [];
                                                  let added = 0;
                                                  for (const s of sel) {
                                                    if (!existing.some((e) => e.id === s.id)) {
                                                      await addSongToPlaylist(p.id, s);
                                                      added++;
                                                    }
                                                  }
                                                  toast.success(`${added} titre${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""} à "${p.name}"`);
                                                  setShowPlaylistPicker(false);
                                                  setSelectMode(false); setSelectedIds(new Set());
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg hover:bg-accent transition-colors"
                                              >
                                                <ListMusic className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                                <span className="flex-1 truncate text-foreground">{p.name}</span>
                                              </button>
                                            ))
                                          )}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="rounded-2xl overflow-hidden" style={{ background: "hsl(var(--card) / 0.3)", border: "1px solid hsl(var(--border) / 0.06)" }}>
                      {sortedCustomSongs.map((s, i) => (
                        <PremiumSongRow
                          key={s.id}
                          song={s}
                          index={i}
                          cached={libraryCachedIds.has(s.id)}
                          showIndex={!selectMode}
                          selectable={selectMode}
                          selected={selectedIds.has(s.id)}
                          onSelect={() => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                              return next;
                            });
                          }}
                          isActive={currentSong?.id === s.id}
                          isPlaying={currentSong?.id === s.id && isPlaying}
                          onClick={() => { setQueue(sortedCustomSongs); play(s); }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── DOWNLOADS ── */}
            {tab === "downloads" && (
              <div>
                {cacheSize > 0 && (
                  <div className="rounded-2xl p-4 mb-4" style={{ background: "hsl(var(--card) / 0.3)", border: "1px solid hsl(var(--border) / 0.06)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10">
                          <HardDrive className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {cachedSongs.length} titre{cachedSongs.length > 1 ? "s" : ""} hors-ligne
                          </p>
                          <p className="text-[11px] text-muted-foreground/60">
                            {formatSize(cacheSize)} utilisé · {cachedSongs.length}/300 titres
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!isOffline && (
                          <button
                            disabled={downloadingAll}
                            onClick={handleDownloadAllLibrary}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium disabled:opacity-50"
                          >
                            {downloadingAll ? (
                              <><Loader2 className="w-3 h-3 animate-spin" />{downloadAllProgress.current}/{downloadAllProgress.total}</>
                            ) : (
                              <><Download className="w-3 h-3" />Tout</>
                            )}
                          </button>
                        )}
                        <button
                          disabled={isRedownloading}
                          onClick={async () => {
                            setIsRedownloading(true);
                            setRedownloadProgress({ current: 0, total: cachedSongs.length });
                            try {
                              for (let i = 0; i < cachedSongs.length; i++) {
                                setRedownloadProgress({ current: i + 1, total: cachedSongs.length });
                                try { await offlineCache.cacheSong(cachedSongs[i]); } catch (e) { console.error("Re-download failed:", e); }
                              }
                              const [songs, size] = await Promise.all([offlineCache.getAllCached(), offlineCache.getCacheSize()]);
                              setCachedSongs(songs);
                              setCacheSize(size);
                            } finally { setIsRedownloading(false); }
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium disabled:opacity-50"
                        >
                          {isRedownloading ? (
                            <><Loader2 className="w-3 h-3 animate-spin" />{redownloadProgress.current}/{redownloadProgress.total}</>
                          ) : (
                            <><RefreshCw className="w-3 h-3" />Rafraîchir</>
                          )}
                        </button>
                        <button
                          onClick={async () => {
                            for (const s of cachedSongs) await offlineCache.removeCached(s.id);
                            setCachedSongs([]);
                            setCacheSize(0);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-destructive/10 text-destructive text-[11px] font-medium"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {/* Storage bar */}
                    <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                      <motion.div
                        className="bg-primary rounded-full h-1.5"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((cacheSize / (1024 * 1024 * 1024)) * 100, 100)}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground/40 mt-1 text-right">{formatSize(cacheSize)} / 1 Go</p>

                    {/* Song count bar */}
                    <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden mt-2">
                      <motion.div
                        className="rounded-full h-1.5"
                        style={{ background: cachedSongs.length >= 280 ? "hsl(var(--destructive))" : "hsl(var(--primary) / 0.6)" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((cachedSongs.length / 300) * 100, 100)}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground/40 mt-1 text-right">{cachedSongs.length} / 300 titres</p>
                  </div>
                )}

                {cachedSongs.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 py-12">
                    <div className="p-4 rounded-full" style={{ background: "hsl(var(--primary) / 0.1)" }}>
                      <Download className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">Aucun morceau téléchargé</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Téléchargez des morceaux pour les écouter hors-ligne</p>
                    </div>
                    {!isOffline && !isGuest && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleDownloadAllLibrary}
                        disabled={downloadingAll}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/30 disabled:opacity-50"
                      >
                        {downloadingAll ? (
                          <><Loader2 className="w-4 h-4 animate-spin" />{downloadAllProgress.current}/{downloadAllProgress.total}</>
                        ) : (
                          <><Download className="w-4 h-4" />Tout télécharger</>
                        )}
                      </motion.button>
                    )}
                  </div>
                ) : (
                  <>
                    <ActionButtons
                      onPlayAll={() => { setQueue(cachedSongs); play(cachedSongs[0]); }}
                      onShuffle={() => { const s = [...cachedSongs].sort(() => Math.random() - 0.5); setQueue(s); play(s[0]); }}
                    />
                    <div className="rounded-2xl overflow-hidden" style={{ background: "hsl(var(--card) / 0.3)", border: "1px solid hsl(var(--border) / 0.06)" }}>
                      {cachedSongs.map((s, i) => (
                        <PremiumSongRow
                          key={s.id}
                          song={s}
                          index={i}
                          cached
                          isActive={currentSong?.id === s.id}
                          isPlaying={currentSong?.id === s.id && isPlaying}
                          onClick={() => { setQueue(cachedSongs); play(s); }}
                          onSwipeLeft={() => removeCached(s.id)}
                        />
                      ))}
                    </div>
                  </>
                )}

                {isGuest && (
                  <div className="mt-8 p-5 rounded-2xl bg-card/40 backdrop-blur-md border border-border/10 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      Connectez-vous pour accéder à vos playlists et favoris
                    </p>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate("/auth")}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/30"
                    >
                      <LogIn className="w-4 h-4" />
                      Se connecter
                    </motion.button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      )}
    </div>
  );
};

/** Artist card with Deezer photo for library */
function ArtistLibraryCard({ artist, index, navigate }: {
  artist: { name: string; cover: string; count: number };
  index: number;
  navigate: ReturnType<typeof import("react-router-dom").useNavigate>;
}) {
  const { data: customImage } = useQuery({
    queryKey: ["custom-artist-image", artist.name],
    queryFn: async () => {
      const { data } = await supabase.from("artist_images").select("image_url").eq("artist_name", artist.name).maybeSingle();
      return data?.image_url || null;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
  const { data: deezerImage } = useQuery({
    queryKey: ["artist-image", artist.name],
    queryFn: () => searchArtistImage(artist.name),
    staleTime: 24 * 60 * 60 * 1000,
    enabled: !customImage,
  });

  const imageUrl = customImage || deezerImage || artist.cover;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.025, duration: 0.3 }}
      whileTap={{ scale: 0.94 }}
      onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
      className="flex flex-col items-center text-center group"
    >
      <div
        className="w-[76px] h-[76px] rounded-full overflow-hidden mb-2 transition-all duration-300 group-hover:scale-105"
        style={{
          boxShadow: "0 4px 20px hsl(0 0% 0% / 0.12), 0 0 0 1.5px hsl(var(--border) / 0.15)",
        }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={artist.name} className="w-full h-full object-cover group-hover:scale-[1.08] transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.04))" }}>
            <User className="w-6 h-6 text-primary/20" />
          </div>
        )}
      </div>
      <p className="text-[11px] font-bold text-foreground truncate max-w-[80px]">{artist.name}</p>
      <p className="text-[9px] text-muted-foreground/40 font-medium">{artist.count} titre{artist.count > 1 ? "s" : ""}</p>
    </motion.button>
  );
}

export default LibraryPage;
