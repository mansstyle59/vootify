import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { VirtualSongList } from "@/components/VirtualSongList";
import { SongSkeleton } from "@/components/MusicCards";
import { ArrowLeft, Play, Shuffle, Music, User, Headphones, Clock, Disc3, TrendingUp, BarChart3, Calendar, RefreshCw, Loader2, ImagePlus } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { formatDuration } from "@/data/mockData";
import type { Song } from "@/data/mockData";
import { searchArtistImage, searchCoverArt } from "@/lib/coverArtSearch";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "sonner";

const ArtistPage = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { play, setQueue, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const userId = usePlayerStore((s) => s.userId);
  const { isAdmin } = useAdminAuth();
  const [enriching, setEnriching] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 400], [0, 120]);
  const headerOpacity = useTransform(scrollY, [200, 350], [0, 1]);

  const artistName = decodeURIComponent(name || "");

  // Fetch artist songs
  const { data: songs = [], isLoading } = useQuery({
    queryKey: ["artist-songs", artistName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_songs")
        .select("*")
        .not("stream_url", "is", null)
        .ilike("artist", `%${artistName}%`)
        .order("album", { ascending: true });
      if (error) throw error;
      return (data || []).map((s: any): Song => ({
        id: `custom-${s.id}`,
        title: s.title,
        artist: s.artist,
        album: s.album || "",
        duration: s.duration || 0,
        coverUrl: s.cover_url || "",
        streamUrl: s.stream_url || "",
        liked: false,
        year: s.year || undefined,
        genre: s.genre || undefined,
      }));
    },
    enabled: !!artistName,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch listening stats from recently_played
  const { data: listeningStats } = useQuery({
    queryKey: ["artist-stats", artistName, userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("recently_played")
        .select("*")
        .eq("user_id", userId)
        .ilike("artist", `%${artistName}%`)
        .order("played_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return null;

      const totalPlays = data.length;
      const totalDuration = data.reduce((sum, r) => sum + (r.duration || 0), 0);
      const firstPlayed = data[data.length - 1]?.played_at;
      const lastPlayed = data[0]?.played_at;

      // Most played song
      const songCounts = new Map<string, { count: number; title: string }>();
      for (const r of data) {
        const existing = songCounts.get(r.song_id);
        if (existing) existing.count++;
        else songCounts.set(r.song_id, { count: 1, title: r.title });
      }
      const topSong = Array.from(songCounts.values()).sort((a, b) => b.count - a.count)[0];

      return { totalPlays, totalDuration, firstPlayed, lastPlayed, topSong };
    },
    enabled: !!artistName && !!userId,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch custom artist image (manual override — highest priority)
  const { data: customArtistImage } = useQuery({
    queryKey: ["custom-artist-image", artistName],
    queryFn: async () => {
      const { data } = await supabase
        .from("artist_images")
        .select("image_url")
        .eq("artist_name", artistName)
        .maybeSingle();
      return data?.image_url || null;
    },
    enabled: !!artistName,
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Fetch real artist photo from Deezer (fallback)
  const { data: artistImageUrl } = useQuery({
    queryKey: ["artist-image", artistName],
    queryFn: () => searchArtistImage(artistName),
    enabled: !!artistName && !customArtistImage,
    staleTime: 24 * 60 * 60 * 1000, // 24h cache
  });

  const coverUrl = customArtistImage || artistImageUrl || songs.find((s) => s.coverUrl)?.coverUrl || "";

  const albums = useMemo(() => {
    const map = new Map<string, { title: string; coverUrl: string; count: number }>();
    for (const s of songs) {
      if (!s.album) continue;
      if (!map.has(s.album)) {
        map.set(s.album, { title: s.album, coverUrl: s.coverUrl, count: 1 });
      } else {
        map.get(s.album)!.count++;
      }
    }
    return Array.from(map.values());
  }, [songs]);

  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const s of songs) {
      if (s.genre) s.genre.split(",").forEach((g) => set.add(g.trim()));
    }
    return Array.from(set).slice(0, 5);
  }, [songs]);

  const totalDuration = useMemo(() => songs.reduce((sum, s) => sum + s.duration, 0), [songs]);

  const handlePlay = (song: Song) => {
    if (currentSong?.id === song.id) { togglePlay(); return; }
    setQueue(songs);
    play(song);
  };

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    setQueue(songs);
    play(songs[0]);
  };

  const handleShuffle = () => {
    if (songs.length === 0) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    play(shuffled[0]);
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatListenTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}min`;
    return `${mins} min`;
  };

  return (
    <div className="pb-40 animate-fade-in">
      {/* Fixed header */}
      <motion.div
        style={{ opacity: headerOpacity }}
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border h-14 flex items-center px-4 gap-3"
      >
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-secondary">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold truncate">{artistName}</h1>
      </motion.div>

      {/* Hero */}
      <motion.div style={{ y: bgY }} className="relative h-80 overflow-hidden">
        {coverUrl ? (
          <img src={coverUrl} alt={artistName} className="w-full h-full object-cover scale-110 blur-sm" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <button onClick={() => navigate(-1)} className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 p-2 rounded-full liquid-glass z-10">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="absolute bottom-6 left-4 right-4 flex items-end gap-4">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-background shadow-2xl flex-shrink-0">
            {coverUrl ? (
              <img src={coverUrl} alt={artistName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                <User className="w-10 h-10 text-primary/40" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary uppercase tracking-widest mb-1">Artiste</p>
            <h1 className="text-2xl font-display font-bold text-foreground leading-tight truncate">{artistName}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span>{songs.length} titre{songs.length > 1 ? "s" : ""}</span>
              <span>·</span>
              <span>{albums.length} album{albums.length > 1 ? "s" : ""}</span>
              {totalDuration > 0 && (
                <>
                  <span>·</span>
                  <span>{formatListenTime(totalDuration)}</span>
                </>
              )}
            </div>
            {genres.length > 0 && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {genres.map((g) => (
                  <span key={g} className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Actions */}
      <div className="px-4 flex gap-3 my-4 flex-wrap">
        <button onClick={handlePlayAll} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-medium text-sm shadow-lg hover:shadow-xl transition-shadow">
          <Play className="w-4 h-4" /> Lecture
        </button>
        <button onClick={handleShuffle} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-secondary-foreground font-medium text-sm border border-border hover:bg-secondary/80 transition-colors">
          <Shuffle className="w-4 h-4" /> Aléatoire
        </button>
        {isAdmin && (
          <button
            onClick={async () => {
              if (enriching || songs.length === 0) return;
              setEnriching(true);
              let updated = 0;
              for (const song of songs) {
                try {
                  const rawId = song.id.replace(/^custom-/, "");
                  const meta = await searchCoverArt({ artist: song.artist, title: song.title, album: song.album });
                  if (!meta) continue;
                  const updates: Record<string, any> = {};
                  if (meta.coverUrl) updates.cover_url = meta.coverUrl;
                  if (meta.album) updates.album = meta.album;
                  if (meta.genre) updates.genre = meta.genre;
                  if (meta.year) updates.year = meta.year;
                  if (Object.keys(updates).length > 0) {
                    await supabase.from("custom_songs").update(updates).eq("id", rawId);
                    updated++;
                  }
                } catch { /* skip */ }
                await new Promise((r) => setTimeout(r, 350));
              }
              // Refresh artist image
              queryClient.invalidateQueries({ queryKey: ["artist-image", artistName] });
              queryClient.invalidateQueries({ queryKey: ["artist-songs", artistName] });
              setEnriching(false);
              toast.success(`${updated} titre${updated > 1 ? "s" : ""} enrichi${updated > 1 ? "s" : ""} via Deezer`);
            }}
            disabled={enriching}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-secondary-foreground font-medium text-sm border border-border hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {enriching ? "Enrichissement…" : "Enrichir Deezer"}
          </button>
          <button
            onClick={() => { setShowImageInput(!showImageInput); setImageUrlInput(coverUrl); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-secondary-foreground font-medium text-sm border border-border hover:bg-secondary/80 transition-colors"
          >
            <ImagePlus className="w-4 h-4" /> Photo
          </button>
        )}
      </div>

      {/* Manual artist image URL input */}
      {isAdmin && showImageInput && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="px-4 mb-4"
        >
          <div className="flex gap-2">
            <input
              type="url"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              placeholder="URL de la photo (https://...)"
              className="flex-1 px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={async () => {
                const url = imageUrlInput.trim();
                if (!url || !userId) return;
                const { error } = await supabase
                  .from("artist_images")
                  .upsert({ artist_name: artistName, image_url: url, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "artist_name" });
                if (error) { toast.error("Erreur de sauvegarde"); return; }
                queryClient.invalidateQueries({ queryKey: ["custom-artist-image", artistName] });
                queryClient.invalidateQueries({ queryKey: ["artist-image", artistName] });
                setShowImageInput(false);
                toast.success("Photo de l'artiste mise à jour");
              }}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
            >
              OK
            </button>
          </div>
        </motion.div>
      )}

      {/* Listening Stats */}
      {listeningStats && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 mb-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Vos statistiques
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4 bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
              <div className="flex items-center gap-2 mb-1">
                <Headphones className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground">Écoutes</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{listeningStats.totalPlays}</p>
            </div>
            <div className="rounded-2xl p-4 bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/10">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-accent-foreground" />
                <p className="text-xs text-muted-foreground">Temps d'écoute</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatListenTime(listeningStats.totalDuration)}</p>
            </div>
            {listeningStats.topSong && (
              <div className="rounded-2xl p-4 bg-gradient-to-br from-secondary to-secondary/60 border border-border col-span-2">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <p className="text-xs text-muted-foreground">Titre le plus écouté</p>
                </div>
                <p className="text-sm font-bold text-foreground truncate">{listeningStats.topSong.title}</p>
                <p className="text-xs text-muted-foreground">{listeningStats.topSong.count} écoute{listeningStats.topSong.count > 1 ? "s" : ""}</p>
              </div>
            )}
            {listeningStats.firstPlayed && (
              <div className="rounded-2xl p-3 bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground">Première écoute</p>
                </div>
                <p className="text-xs font-semibold text-foreground">{formatDate(listeningStats.firstPlayed)}</p>
              </div>
            )}
            {listeningStats.lastPlayed && (
              <div className="rounded-2xl p-3 bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground">Dernière écoute</p>
                </div>
                <p className="text-xs font-semibold text-foreground">{formatDate(listeningStats.lastPlayed)}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Albums */}
      {albums.length > 0 && (
        <div className="px-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Disc3 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Discographie</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {albums.map((album, i) => (
              <motion.button
                key={album.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handleAlbumClick(album.title)}
                className="flex-shrink-0 w-36 group cursor-pointer text-left"
              >
                <div className="w-36 h-36 rounded-xl overflow-hidden bg-secondary mb-2 shadow-lg group-hover:shadow-xl transition-shadow">
                  {album.coverUrl ? (
                    <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <Music className="w-10 h-10 text-primary/30" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold text-foreground truncate">{album.title}</p>
                <p className="text-[10px] text-muted-foreground">{album.count} titre{album.count > 1 ? "s" : ""}</p>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Songs */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-3">
          <Music className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tous les titres</h2>
        </div>
        {isLoading ? (
          <div className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => <SongSkeleton key={i} />)}
          </div>
        ) : (
          <VirtualSongList
            songs={songs}
            onClickSong={(song) => handlePlay(song)}
            className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] overflow-hidden"
          />
        )}
      </div>
    </div>
  );
};

export default ArtistPage;
