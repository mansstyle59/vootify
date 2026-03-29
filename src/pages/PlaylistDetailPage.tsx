import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlayerStore } from "@/stores/playerStore";
import { SongCard } from "@/components/MusicCards";
import { VirtualSongList } from "@/components/VirtualSongList";
import { Song } from "@/data/mockData";
import { musicDb } from "@/lib/musicDb";
import { ArrowLeft, Play, Shuffle, Trash2, GripVertical, Image as ImageIcon, Download, CheckCircle, Loader2, MoreHorizontal, Clock, Music, Share2, ListPlus, Heart, RotateCcw, X, AlertCircle, Link, Send, Users } from "lucide-react";
import { notifyUser } from "@/lib/notifyUser";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { offlineCache } from "@/lib/offlineCache";
import { usePlaylistDownload } from "@/hooks/usePlaylistDownload";
import { useAdminAuth } from "@/hooks/useAdminAuth";

import { motion, useScroll, useTransform } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDuration } from "@/data/mockData";

const PlaylistDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playlistSongs, loadPlaylistSongs, play, setQueue, removeSongFromPlaylist, playlists } = usePlayerStore();
  const heroRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isAdmin } = useAdminAuth();


  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 400], [0, 120]);
  const coverScale = useTransform(scrollY, [0, 300], [1, 0.75]);
  const coverOpacity = useTransform(scrollY, [0, 250], [1, 0.5]);
  const headerOpacity = useTransform(scrollY, [200, 350], [0, 1]);

  const userPlaylist = playlists.find((p) => p.id === id);

  const playlist = userPlaylist;
  const songs: Song[] = id ? playlistSongs[id] || [] : [];

  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [resolvedSongs, setResolvedSongs] = useState<Map<string, Song>>(new Map());
  const [resolveProgress, setResolveProgress] = useState<{ done: number; total: number } | null>(null);
  const [resolveKey, setResolveKey] = useState(0);
  const [resolving, setResolving] = useState(false);
  const resolveAbortRef = useRef<AbortController | null>(null);

  // Share to user state
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUsers, setShareUsers] = useState<Array<{ user_id: string; display_name: string | null }>>([]);
  const [shareTargetId, setShareTargetId] = useState("");
  const [shareSending, setShareSending] = useState(false);

  const loadShareUsers = async () => {
    const { data } = await supabase.from("profiles").select("user_id, display_name").order("display_name");
    setShareUsers(data || []);
  };

  const handleShareToUser = async () => {
    if (!shareTargetId || !id || !playlist) return;
    setShareSending(true);
    try {
      const adminId = (await supabase.auth.getUser()).data.user?.id;
      const coverUrl = playlist.cover_url || displaySongs.find(s => s.coverUrl)?.coverUrl || null;

      const { data: shared, error: plErr } = await supabase
        .from("shared_playlists")
        .insert({
          playlist_name: playlist.name,
          cover_url: coverUrl,
          shared_by: adminId,
          shared_to: shareTargetId,
        })
        .select("id")
        .single();
      if (plErr) throw plErr;

      if (displaySongs.length > 0) {
        const songRows = displaySongs.map((s, i) => ({
          shared_playlist_id: shared.id,
          song_id: s.id,
          title: s.title,
          artist: s.artist,
          album: s.album || null,
          cover_url: s.coverUrl || null,
          stream_url: s.streamUrl || null,
          duration: s.duration,
          position: i,
        }));
        const { error: songsErr } = await supabase.from("shared_playlist_songs").insert(songRows);
        if (songsErr) throw songsErr;
      }

      const targetUser = shareUsers.find(u => u.user_id === shareTargetId);
      toast.success(`Playlist envoyée à ${targetUser?.display_name || "l'utilisateur"}`);

      // Push notification (fire-and-forget)
      notifyUser({
        targetUserId: shareTargetId,
        title: "🎵 Nouvelle playlist partagée",
        body: `« ${playlist.name} » — ${displaySongs.length} titre${displaySongs.length > 1 ? "s" : ""}`,
        actionUrl: "/library",
      });
      setShowShareDialog(false);
      setShareTargetId("");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi");
    } finally {
      setShareSending(false);
    }
  };

  useEffect(() => {
    if (songs.length === 0) return;
    Promise.all(songs.map((s) => offlineCache.isCached(s.id).then((c) => (c ? s.id : null)))).then(
      (ids) => setCachedIds(new Set(ids.filter(Boolean) as string[]))
    );
  }, [songs]);

  useEffect(() => { if (id) loadPlaylistSongs(id); }, [id]);

  // No resolution needed — songs play directly

  const displaySongs = songs;
  const totalDuration = displaySongs.reduce((sum, t) => sum + t.duration, 0);

  const handlePlayAll = () => { if (displaySongs.length > 0) { setQueue(displaySongs); play(displaySongs[0]); } };
  const handleShufflePlay = () => { if (displaySongs.length > 0) { const s = [...displaySongs].sort(() => Math.random() - 0.5); setQueue(s); play(s[0]); } };

  const { isDownloading: downloading, songs: dlSongs, completed: dlCompleted, failed: dlFailed, skipped: dlSkipped, total: dlTotal, overallProgress, downloadPlaylist, cancel: cancelDownload } = usePlaylistDownload();

  const handleDownloadAll = () => {
    if (displaySongs.length === 0 || downloading) return;
    downloadPlaylist(displaySongs).then(() => {
      // Refresh cached IDs after download
      Promise.all(displaySongs.map((s) => offlineCache.isCached(s.id).then((c) => (c ? s.id : null)))).then(
        (ids) => setCachedIds(new Set(ids.filter(Boolean) as string[]))
      );
      toast.success("Téléchargement terminé !");
    });
  };

  const handleRemove = async (songId: string) => { if (!id) return; await removeSongFromPlaylist(id, songId); toast.success("Morceau retiré"); };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setOverIdx(idx); };
  const handleDrop = useCallback(async (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx || !id) return;
    const reordered = [...songs]; const [moved] = reordered.splice(dragIdx, 1); reordered.splice(targetIdx, 0, moved);
    await Promise.all(reordered.map((song, i) => supabase.from("playlist_songs").update({ position: i }).eq("playlist_id", id).eq("song_id", song.id)));
    await loadPlaylistSongs(id); setDragIdx(null); setOverIdx(null);
  }, [dragIdx, songs, id, loadPlaylistSongs]);

  const [showCoverUrlInput, setShowCoverUrlInput] = useState(false);
  const [coverUrlInput, setCoverUrlInput] = useState("");

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !id) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image trop lourde (max 5 Mo)"); return; }
    const ext = file.name.split(".").pop();
    const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("covers").upload(path, file);
    if (upErr) { toast.error("Erreur upload"); return; }
    const { data: urlData } = supabase.storage.from("covers").getPublicUrl(path);
    const { error } = await supabase.from("playlists").update({ cover_url: urlData.publicUrl }).eq("id", id);
    if (error) toast.error("Erreur couverture"); else { toast.success("Couverture mise à jour"); const uid = usePlayerStore.getState().userId; if (uid) usePlayerStore.getState().loadUserData(uid); }
  };

  const handleCoverUrlSubmit = async () => {
    if (!coverUrlInput.trim() || !id) return;
    const { error } = await supabase.from("playlists").update({ cover_url: coverUrlInput.trim() }).eq("id", id);
    if (error) toast.error("Erreur couverture");
    else { toast.success("Couverture mise à jour"); setCoverUrlInput(""); setShowCoverUrlInput(false); const uid = usePlayerStore.getState().userId; if (uid) usePlayerStore.getState().loadUserData(uid); }
  };


  const handleDeletePlaylist = async () => {
    if (!id) return;
    const confirmed = window.confirm("Supprimer cette playlist et tous ses morceaux ?");
    if (!confirmed) return;
    await supabase.from("playlist_songs").delete().eq("playlist_id", id);
    const { error } = await supabase.from("playlists").delete().eq("id", id);
    if (error) { toast.error("Erreur suppression"); return; }
    toast.success("Playlist supprimée");
    const uid = usePlayerStore.getState().userId;
    if (uid) usePlayerStore.getState().loadUserData(uid);
    navigate("/library");
  };

  if (!playlist) {
    return (
      <div className="p-4 pb-20 flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Playlist introuvable</p>
        <button onClick={() => navigate("/library")} className="mt-4 text-primary text-sm">Retour</button>
      </div>
    );
  }

  const coverUrl = playlist.cover_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop";

  // Build mosaic if no cover and we have songs
  const hasCover = !!playlist.cover_url;
  const mosaicCovers = !hasCover && displaySongs.length >= 4
    ? displaySongs.slice(0, 4).map(s => s.coverUrl).filter(Boolean)
    : [];

  return (
    <div className="pb-20 max-w-4xl mx-auto animate-fade-in">
      {/* ─── ULTRA PREMIUM HERO ─── */}
      <div ref={heroRef} className="relative overflow-hidden">
        {/* Parallax blurred background */}
        <motion.div className="absolute inset-0 -top-20 -bottom-20" style={{ y: bgY }}>
          <img src={coverUrl} alt="" className="w-full h-full object-cover blur-[60px] scale-[1.8] opacity-40" />
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
            {playlist.name}
          </motion.div>
          <div className="flex items-center gap-2">
            {true && (
              <label className="p-2.5 rounded-full text-foreground transition-all cursor-pointer" style={{ background: "linear-gradient(145deg, hsl(var(--card) / 0.5), hsl(var(--card) / 0.25))", backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)", border: "0.5px solid hsl(var(--foreground) / 0.08)", boxShadow: "0 4px 16px hsl(0 0% 0% / 0.2), inset 0 0.5px 0 hsl(var(--foreground) / 0.06)" }}>
                <ImageIcon className="w-5 h-5" />
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
              </label>
            )}
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
                        onClick={() => { handlePlayAll(); setMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-foreground hover:bg-white/[0.08] transition-colors"
                      >
                        <Play className="w-4 h-4 text-primary" />
                        Tout lire
                      </button>
                      <button
                        onClick={() => { handleShufflePlay(); setMenuOpen(false); }}
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
                            navigator.share({ title: playlist?.name, url: window.location.href }).catch(() => {});
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
                      <div className="h-px bg-white/[0.06] mx-2 my-1" />
                      <label className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-foreground hover:bg-white/[0.08] transition-colors cursor-pointer">
                        <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        Changer la couverture (fichier)
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { handleCoverChange(e); setMenuOpen(false); }} />
                      </label>
                      <button
                        onClick={() => { setShowCoverUrlInput(true); setMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-foreground hover:bg-white/[0.08] transition-colors"
                      >
                        <Link className="w-4 h-4 text-muted-foreground" />
                        Changer la couverture (URL)
                      </button>
                      {isAdmin && (
                        <>
                          <div className="h-px bg-white/[0.06] mx-2 my-1" />
                          <button
                            onClick={() => { loadShareUsers(); setShowShareDialog(true); setMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-foreground hover:bg-white/[0.08] transition-colors"
                          >
                            <Send className="w-4 h-4 text-primary" />
                            Envoyer à un utilisateur
                          </button>
                          <button
                            onClick={() => { handleDeletePlaylist(); setMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Supprimer la playlist
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Cover + Info */}
        <div className="relative z-10 flex flex-col items-center px-6 pt-6 pb-8">
          {/* Cover with reflection */}
          <motion.div style={{ scale: coverScale, opacity: coverOpacity }} className="relative mb-6">
            {mosaicCovers.length === 4 ? (
              <div className="w-52 h-52 sm:w-64 sm:h-64 rounded-[20px] overflow-hidden shadow-[0_20px_80px_-15px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.08] grid grid-cols-2 grid-rows-2">
                {mosaicCovers.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-full h-full object-cover" />
                ))}
              </div>
            ) : (
              <div className="w-52 h-52 sm:w-64 sm:h-64 rounded-[20px] overflow-hidden shadow-[0_20px_80px_-15px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.08]">
                <img src={coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
              </div>
            )}
            {/* Reflection */}
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-[85%] h-12 overflow-hidden opacity-20 blur-sm pointer-events-none">
              <img src={coverUrl} alt="" className="w-full h-full object-cover object-bottom scale-y-[-1]" />
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
              {playlist.name}
            </h1>
            <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground/60 uppercase tracking-widest font-medium">
              <span>Playlist</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <span>{displaySongs.length} titre{displaySongs.length !== 1 ? "s" : ""}</span>
              {totalDuration > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                  <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{formatDuration(totalDuration)}</span>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Cover URL input */}
      {showCoverUrlInput && (
        <div className="px-4 md:px-8 mb-3">
          <div className="flex gap-2">
            <input
              type="url"
              value={coverUrlInput}
              onChange={(e) => setCoverUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCoverUrlSubmit())}
              placeholder="https://... URL de l'image"
              className="flex-1 px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
            <button onClick={handleCoverUrlSubmit} className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">OK</button>
            <button onClick={() => setShowCoverUrlInput(false)} className="p-2.5 rounded-xl bg-secondary text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="px-4 md:px-8 flex items-center gap-3 mb-4 -mt-1"
      >
        <button
          onClick={handlePlayAll}
          disabled={displaySongs.length === 0}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-40"
          style={{ background: "linear-gradient(145deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))", color: "hsl(var(--primary-foreground))", boxShadow: "0 4px 16px hsl(var(--primary) / 0.3), inset 0 0.5px 0 hsl(0 0% 100% / 0.15)" }}
        >
          <Play className="w-5 h-5 fill-current" />
          Lecture
        </button>
        <button
          onClick={handleShufflePlay}
          disabled={displaySongs.length === 0}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-40"
          style={{ background: "linear-gradient(145deg, hsl(var(--card) / 0.5), hsl(var(--card) / 0.25))", backdropFilter: "blur(24px) saturate(1.6)", WebkitBackdropFilter: "blur(24px) saturate(1.6)", color: "hsl(var(--foreground))", border: "0.5px solid hsl(var(--foreground) / 0.06)", boxShadow: "0 2px 8px hsl(0 0% 0% / 0.1), inset 0 0.5px 0 hsl(var(--foreground) / 0.04)" }}
        >
          <Shuffle className="w-4 h-4" />
          Aléatoire
        </button>
      </motion.div>

      {/* HD resolve progress */}
      {resolveProgress && (
        <div className="px-4 md:px-8 pb-3">
          <div className="flex items-center gap-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${resolveProgress.total > 0 ? (resolveProgress.done / resolveProgress.total) * 100 : 0}%` }} transition={{ duration: 0.3 }} />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">{resolveProgress.done}/{resolveProgress.total} HD</span>
          </div>
        </div>
      )}

      {/* Download progress — enhanced */}
      {downloading && (
        <div className="px-4 md:px-8 pb-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
              {dlCompleted + dlSkipped}/{dlTotal}
            </span>
            <button
              onClick={cancelDownload}
              className="p-1 rounded-full text-muted-foreground hover:text-destructive transition-colors active:scale-90"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Per-song status — show active downloads */}
          <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-hide">
            {dlSongs
              .filter((s) => s.status === "resolving" || s.status === "downloading" || s.status === "error")
              .slice(0, 5)
              .map((s) => (
                <div key={s.songId} className="flex items-center gap-2 text-[10px]">
                  {s.status === "resolving" && <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />}
                  {s.status === "downloading" && <Download className="w-3 h-3 text-primary animate-bounce shrink-0" />}
                  {s.status === "error" && <AlertCircle className="w-3 h-3 text-destructive shrink-0" />}
                  <span className="truncate text-foreground/60">{s.title}</span>
                  {s.status === "downloading" && (
                    <span className="text-primary tabular-nums ml-auto">{s.progress}%</span>
                  )}
                  {s.status === "resolving" && (
                    <span className="text-muted-foreground ml-auto">HD…</span>
                  )}
                  {s.status === "error" && (
                    <span className="text-destructive ml-auto">Échec</span>
                  )}
                </div>
              ))}
          </div>
          {dlFailed > 0 && !downloading && (
            <p className="text-[10px] text-destructive/70">{dlFailed} échec{dlFailed > 1 ? "s" : ""}</p>
          )}
        </div>
      )}

      {/* ─── TRACK LIST ─── */}
      <div className="px-4 md:px-8">
        {displaySongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full mb-4" style={{ background: "linear-gradient(145deg, hsl(var(--card) / 0.5), hsl(var(--card) / 0.2))", backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)", border: "0.5px solid hsl(var(--foreground) / 0.06)" }}><Music className="w-8 h-8 text-muted-foreground/30" /></div>
            <p className="text-muted-foreground text-sm mb-1">Playlist vide</p>
            <p className="text-muted-foreground/50 text-xs">Ajoutez des morceaux depuis la recherche</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(145deg, hsl(var(--card) / 0.35), hsl(var(--card) / 0.15))", backdropFilter: "blur(24px) saturate(1.6)", WebkitBackdropFilter: "blur(24px) saturate(1.6)", border: "0.5px solid hsl(var(--foreground) / 0.05)", boxShadow: "0 4px 20px hsl(0 0% 0% / 0.1), inset 0 0.5px 0 hsl(var(--foreground) / 0.03)" }}>
          <VirtualSongList
            songs={displaySongs}
            showIndex
            className=""
            renderRow={(song, i, songCard) => (
              <div
                draggable={true}
                onDragStart={true ? () => handleDragStart(i) : undefined}
                onDragOver={true ? (e) => handleDragOver(e, i) : undefined}
                onDrop={true ? () => handleDrop(i) : undefined}
                onDragEnd={true ? () => { setDragIdx(null); setOverIdx(null); } : undefined}
                className={`flex items-center gap-1 group ${overIdx === i ? "border-t-2 !border-t-primary" : ""} ${dragIdx === i ? "opacity-40" : ""}`}
              >
                {true && (
                  <div className="cursor-grab active:cursor-grabbing p-1 pl-2 text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                    <GripVertical className="w-4 h-4" />
                  </div>
                )}
                <div className="flex-1 min-w-0">{songCard}</div>
                {cachedIds.has(song.id) && <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0 mr-1" />}
                {true && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(song.id); }}
                    className="p-1.5 mr-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          />
          </div>
        )}
      </div>
      {/* Share to user dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Envoyer la playlist
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Envoyer « {playlist?.name} » ({displaySongs.length} titre{displaySongs.length !== 1 ? "s" : ""}) à un utilisateur
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Destinataire</label>
              <select
                value={shareTargetId}
                onChange={(e) => setShareTargetId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Choisir un utilisateur...</option>
                {shareUsers.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.display_name || u.user_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleShareToUser}
              disabled={shareSending || !shareTargetId}
              className="gap-1.5"
            >
              {shareSending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Send className="w-4 h-4" />
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlaylistDetailPage;
