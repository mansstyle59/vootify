import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { usePlayerStore } from "@/stores/playerStore";
import { useAuth } from "@/hooks/useAuth";
import { getEffectiveUserId } from "@/lib/deviceId";
import { supabase } from "@/integrations/supabase/client";
import { SongCard, SongSkeleton } from "@/components/MusicCards";
import { VirtualSongList } from "@/components/VirtualSongList";
import { ArrowLeft, Play, Shuffle, Loader2, Clock, Bookmark, BookmarkCheck, MoreHorizontal, Share2, Download, Trash2, X } from "lucide-react";
import { offlineCache } from "@/lib/offlineCache";
import { usePlaylistDownload } from "@/hooks/usePlaylistDownload";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { motion, useScroll, useTransform } from "framer-motion";
import { toast } from "sonner";
import type { Song } from "@/data/mockData";
import { formatDuration } from "@/data/mockData";

const AlbumDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { play, setQueue, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const heroRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isDownloading: downloading, completed: dlCompleted, skipped: dlSkipped, failed: dlFailed, total: dlTotal, overallProgress, downloadPlaylist, cancel: cancelDownload, songs: dlSongs } = usePlaylistDownload();
  const { isAdmin } = useAdminAuth();

  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 400], [0, 120]);
  const coverScale = useTransform(scrollY, [0, 300], [1, 0.75]);
  const coverOpacity = useTransform(scrollY, [0, 250], [1, 0.5]);
  const headerOpacity = useTransform(scrollY, [200, 350], [0, 1]);

  const isByName = id === "by-name";
  const paramArtist = searchParams.get("artist") || "";
  const paramAlbum = searchParams.get("album") || "";

  const { data, isLoading } = useQuery({
    queryKey: ["album-detail", isByName ? `${paramArtist}|||${paramAlbum}` : id],
    queryFn: async () => {
      if (isByName) {
        // Derived album: fetch songs by artist + album name
        const { data: songs } = await supabase
          .from("custom_songs")
          .select("*")
          .eq("album", paramAlbum)
          .eq("artist", paramArtist);
        if (!songs || songs.length === 0) throw new Error("Album not found");
        const firstSong = songs[0];
        return {
          album: { id: `derived-${paramArtist}|||${paramAlbum}`, title: paramAlbum, artist: paramArtist, coverUrl: firstSong.cover_url || "", year: firstSong.year || null, songs: [] },
          tracks: songs.map((s: any) => ({ id: `custom-${s.id}`, title: s.title, artist: s.artist, album: s.album || "", duration: s.duration || 0, coverUrl: s.cover_url || firstSong.cover_url || "", streamUrl: s.stream_url || "", liked: false, genre: s.genre || undefined, year: s.year || undefined })),
        };
      }
      // Explicit album from custom_albums
      const { data: album } = await supabase.from("custom_albums").select("*").eq("id", id).single();
      if (!album) throw new Error("Album not found");
      const { data: songs } = await supabase.from("custom_songs").select("*").eq("album", album.title).eq("artist", album.artist);
      return {
        album: { id: album.id, title: album.title, artist: album.artist, coverUrl: album.cover_url || "", year: album.year || null, songs: [] },
        tracks: (songs || []).map((s: any) => ({ id: `custom-${s.id}`, title: s.title, artist: s.artist, album: s.album || "", duration: s.duration || 0, coverUrl: s.cover_url || album.cover_url || "", streamUrl: s.stream_url || "", liked: false, genre: s.genre || undefined, year: s.year || undefined })),
      };
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const album = data?.album;
  const rawTracks = data?.tracks || [];
  const [resolvedTracks, setResolvedTracks] = useState<Song[]>([]);
  const [resolveKey, setResolveKey] = useState(0);
  const [resolving, setResolving] = useState(false);
  const tracks = rawTracks;
  const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0);

  const effectiveUserId = getEffectiveUserId(user?.id);
  const { data: isSaved = false } = useQuery({
    queryKey: ["saved-album", id, effectiveUserId],
    queryFn: async () => {
      if (!id) return false;
      const { count } = await supabase.from("custom_albums").select("id", { count: "exact", head: true }).eq("user_id", effectiveUserId).eq("id", id);
      return (count ?? 0) > 0;
    },
    enabled: !!id,
  });

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (!album || !id) return;
      if (isSaved) await supabase.from("custom_albums").delete().eq("id", id).eq("user_id", effectiveUserId);
      else await supabase.from("custom_albums").insert({ id, user_id: effectiveUserId, title: album.title, artist: album.artist, cover_url: album.coverUrl, year: album.year });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["saved-album", id] }); toast.success(isSaved ? "Album retiré" : "Album sauvegardé !"); },
    onError: () => toast.error("Erreur"),
  });

  const handlePlay = async (song: Song) => {
    if (currentSong?.id === song.id) { togglePlay(); return; }
    setQueue(tracks);
    play(song);
  };

  const playAll = () => { if (tracks.length > 0) { setQueue(tracks); handlePlay(tracks[0]); } };
  const playShuffle = () => { if (tracks.length > 0) { const s = [...tracks].sort(() => Math.random() - 0.5); setQueue(s); handlePlay(s[0]); } };

  const handleDownloadAll = () => {
    if (downloading || tracks.length === 0) return;
    downloadPlaylist(tracks);
  };

  if (isLoading) {
    return (
      <div className="pb-20">
        <div className="px-4 md:px-8" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}>
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
        </div>
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="pb-20 px-4 md:px-8" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}>
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <p className="text-center text-muted-foreground py-20">Album introuvable</p>
      </div>
    );
  }

  return (
    <div className="pb-20 max-w-4xl mx-auto animate-fade-in">
      {/* ─── ULTRA PREMIUM HERO ─── */}
      <div ref={heroRef} className="relative overflow-hidden">
        {/* Parallax blurred background */}
        <motion.div className="absolute inset-0 -top-20 -bottom-20" style={{ y: bgY }}>
          <img src={album.coverUrl} alt="" className="w-full h-full object-cover blur-[60px] scale-[1.8] opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/50 to-background" />
        </motion.div>

        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px]" />
        </div>

        {/* Navigation bar */}
        <div className="relative z-20 flex items-center justify-between px-4 md:px-8" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}>
          <button onClick={() => navigate("/")} className="p-2.5 rounded-full text-foreground transition-all active:scale-90" style={{ background: "linear-gradient(145deg, hsl(var(--card) / 0.5), hsl(var(--card) / 0.25))", backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)", border: "0.5px solid hsl(var(--foreground) / 0.08)", boxShadow: "0 4px 16px hsl(0 0% 0% / 0.2), inset 0 0.5px 0 hsl(var(--foreground) / 0.06)" }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <motion.div style={{ opacity: headerOpacity }} className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-foreground truncate max-w-[200px]">
            {album.title}
          </motion.div>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-2.5 rounded-full text-foreground transition-all active:scale-90" style={{ background: "linear-gradient(145deg, hsl(var(--card) / 0.5), hsl(var(--card) / 0.25))", backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)", border: "0.5px solid hsl(var(--foreground) / 0.08)", boxShadow: "0 4px 16px hsl(0 0% 0% / 0.2), inset 0 0.5px 0 hsl(var(--foreground) / 0.06)" }}
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl overflow-hidden"
                  style={{ background: "linear-gradient(160deg, hsl(var(--card) / 0.75), hsl(var(--card) / 0.5))", backdropFilter: "blur(60px) saturate(2)", WebkitBackdropFilter: "blur(60px) saturate(2)", border: "0.5px solid hsl(var(--foreground) / 0.08)", boxShadow: "0 12px 40px hsl(0 0% 0% / 0.3), inset 0 0.5px 0 hsl(var(--foreground) / 0.06)" }}
                >
                  <div className="p-1.5 space-y-0.5">
                    <button
                      onClick={() => { playAll(); setMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-foreground hover:bg-white/[0.08] transition-colors"
                    >
                      <Play className="w-4 h-4 text-primary" />
                      Tout lire
                    </button>
                    <button
                      onClick={() => { playShuffle(); setMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-foreground hover:bg-white/[0.08] transition-colors"
                    >
                      <Shuffle className="w-4 h-4 text-primary" />
                      Lecture aléatoire
                    </button>
                    <div className="h-px bg-white/[0.06] mx-2 my-1" />
                    <button
                      onClick={() => { handleDownloadAll(); setMenuOpen(false); }}
                      disabled={downloading}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-foreground hover:bg-white/[0.08] transition-colors disabled:opacity-40"
                    >
                      <Download className="w-4 h-4 text-muted-foreground" />
                      Télécharger tout
                    </button>
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({ title: album.title, url: window.location.href }).catch(() => {});
                        } else {
                          navigator.clipboard.writeText(window.location.href);
                          toast.success("Lien copié !");
                        }
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-foreground hover:bg-white/[0.08] transition-colors"
                    >
                      <Share2 className="w-4 h-4 text-muted-foreground" />
                      Partager
                    </button>
                      {isAdmin && (
                        <>
                          <div className="h-px bg-white/[0.06] mx-2 my-1" />
                          <button
                            onClick={async () => {
                              setMenuOpen(false);
                              if (!id) return;
                              const confirmed = window.confirm("Supprimer cet album et tous ses morceaux ?");
                              if (!confirmed) return;
                              await supabase.from("custom_songs").delete().eq("album", album.title).eq("artist", album.artist);
                              const { error } = await supabase.from("custom_albums").delete().eq("id", id);
                              if (error) { toast.error("Erreur suppression"); return; }
                              toast.success("Album supprimé");
                              navigate("/library");
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Supprimer l'album
                          </button>
                        </>
                      )}
                    </div>
                </motion.div>
              </>
            )}
          </div>
        </div>

        {/* Cover + Info */}
        <div className="relative z-10 flex flex-col items-center px-6 pt-6 pb-8">
          {/* Cover with reflection */}
          <motion.div style={{ scale: coverScale, opacity: coverOpacity }} className="relative mb-6">
            <div className="w-52 h-52 sm:w-64 sm:h-64 rounded-[20px] overflow-hidden shadow-[0_20px_80px_-15px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.08]">
              <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
            </div>
            {/* Reflection */}
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-[85%] h-12 overflow-hidden opacity-20 blur-sm pointer-events-none">
              <img src={album.coverUrl} alt="" className="w-full h-full object-cover object-bottom scale-y-[-1]" />
            </div>
          </motion.div>

          {/* Title & Meta */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="text-center max-w-sm"
          >
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight leading-tight mb-1.5">
              {album.title}
            </h1>
            <button onClick={() => navigate(`/artist/${encodeURIComponent(album.artist)}`)} className="text-base text-primary font-medium mb-3 hover:underline active:opacity-70 transition-opacity">{album.artist}</button>
            <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground/60 uppercase tracking-widest font-medium">
              <span>Album</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>{album.year}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>{tracks.length} titre{tracks.length > 1 ? "s" : ""}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{formatDuration(totalDuration)}</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ─── ACTION BAR ─── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="px-4 md:px-8 flex items-center gap-3 mb-6 -mt-1"
      >
        {/* Main play button */}
        <button
          onClick={playAll}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full font-semibold text-sm active:scale-[0.98] transition-all"
          style={{ background: "linear-gradient(145deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))", color: "hsl(var(--primary-foreground))", boxShadow: "0 4px 16px hsl(var(--primary) / 0.3), inset 0 0.5px 0 hsl(0 0% 100% / 0.15)" }}
        >
          <Play className="w-5 h-5 fill-current" />
          Lecture
        </button>
        <button
          onClick={playShuffle}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full font-semibold text-sm active:scale-[0.98] transition-all"
          style={{ background: "linear-gradient(145deg, hsl(var(--card) / 0.5), hsl(var(--card) / 0.25))", backdropFilter: "blur(24px) saturate(1.6)", WebkitBackdropFilter: "blur(24px) saturate(1.6)", color: "hsl(var(--foreground))", border: "0.5px solid hsl(var(--foreground) / 0.06)", boxShadow: "0 2px 8px hsl(0 0% 0% / 0.1), inset 0 0.5px 0 hsl(var(--foreground) / 0.04)" }}
        >
          <Shuffle className="w-4 h-4" />
          Aléatoire
        </button>
        <button
          onClick={handleDownloadAll}
          disabled={downloading || tracks.length === 0}
          className="p-3.5 rounded-full transition-all active:scale-[0.95] text-muted-foreground hover:text-primary disabled:opacity-40"
          style={{ background: "linear-gradient(145deg, hsl(var(--card) / 0.5), hsl(var(--card) / 0.25))", backdropFilter: "blur(24px) saturate(1.6)", WebkitBackdropFilter: "blur(24px) saturate(1.6)", border: "0.5px solid hsl(var(--foreground) / 0.06)" }}
        >
          {downloading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <Download className="w-5 h-5" />}
        </button>
        {user && (
          <button
            onClick={() => toggleSave.mutate()}
            disabled={toggleSave.isPending}
            className={`p-3.5 rounded-full transition-all active:scale-[0.95] ${
              isSaved
                ? "text-primary"
                : "text-muted-foreground hover:text-primary"
            }`}
            style={{ background: "linear-gradient(145deg, hsl(var(--card) / 0.5), hsl(var(--card) / 0.25))", backdropFilter: "blur(24px) saturate(1.6)", WebkitBackdropFilter: "blur(24px) saturate(1.6)", border: "0.5px solid hsl(var(--foreground) / 0.06)" }}
          >
            {isSaved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
          </button>
        )}
      </motion.div>

      {/* Download progress */}
      {downloading && (
        <div className="px-4 md:px-8 pb-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "hsl(var(--foreground) / 0.06)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))" }}
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
              {dlCompleted + dlSkipped}/{dlTotal}
            </span>
            <button onClick={cancelDownload} className="p-1 rounded-full text-muted-foreground hover:text-destructive transition-colors active:scale-90">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ─── TRACK LIST ─── */}
      <div className="px-4 md:px-8">
        <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(145deg, hsl(var(--card) / 0.35), hsl(var(--card) / 0.15))", backdropFilter: "blur(24px) saturate(1.6)", WebkitBackdropFilter: "blur(24px) saturate(1.6)", border: "0.5px solid hsl(var(--foreground) / 0.05)", boxShadow: "0 4px 20px hsl(0 0% 0% / 0.1), inset 0 0.5px 0 hsl(var(--foreground) / 0.03)" }}>
          <VirtualSongList
            songs={tracks}
            showIndex
            onClickSong={(song) => handlePlay(song)}
            className=""
          />
        </div>
      </div>
    </div>
  );
};

export default AlbumDetailPage;
