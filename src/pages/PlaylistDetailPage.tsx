import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlayerStore } from "@/stores/playerStore";
import { SongCard } from "@/components/MusicCards";
import { Song } from "@/data/mockData";
import { musicDb } from "@/lib/musicDb";
import { ArrowLeft, Play, Shuffle, Trash2, GripVertical, Image as ImageIcon, Download, CheckCircle, Loader2, MoreHorizontal, Clock, Music, Share2, ListPlus, Heart, RotateCcw, X, AlertCircle } from "lucide-react";
import { offlineCache } from "@/lib/offlineCache";
import { usePlaylistDownload } from "@/hooks/usePlaylistDownload";
import { deezerApi } from "@/lib/deezerApi";
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


  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 400], [0, 120]);
  const coverScale = useTransform(scrollY, [0, 300], [1, 0.75]);
  const coverOpacity = useTransform(scrollY, [0, 250], [1, 0.5]);
  const headerOpacity = useTransform(scrollY, [200, 350], [0, 1]);

  const isDeezerPlaylist = id?.startsWith("dz-");
  const deezerRawId = isDeezerPlaylist ? id!.replace("dz-", "") : null;

  const userPlaylist = playlists.find((p) => p.id === id);

  const [dzInfo, setDzInfo] = useState<{ title: string; picture: string } | null>(null);
  const [dzSongs, setDzSongs] = useState<Song[]>([]);
  const [dzLoading, setDzLoading] = useState(false);
  const [dzError, setDzError] = useState(false);

  useEffect(() => {
    if (!isDeezerPlaylist || !deezerRawId) return;
    let cancelled = false;
    const fetchDz = async (retry = false) => {
      setDzLoading(true); setDzError(false);
      try {
        const [info, tracks] = await Promise.all([deezerApi.getPlaylistInfo(deezerRawId), deezerApi.getPlaylistTracks(deezerRawId, 50)]);
        if (cancelled) return;
        setDzInfo({ title: info.title, picture: info.picture }); setDzSongs(tracks);
      } catch (e) {
        if (!retry && !cancelled) { await fetchDz(true); return; }
        if (!cancelled) setDzError(true);
      } finally { if (!cancelled) setDzLoading(false); }
    };
    fetchDz();
    return () => { cancelled = true; };
  }, [isDeezerPlaylist, deezerRawId]);

  const playlist = isDeezerPlaylist
    ? dzInfo ? { id: id!, name: dzInfo.title, cover_url: dzInfo.picture, created_at: "" } : null
    : userPlaylist;
  const songs: Song[] = isDeezerPlaylist ? dzSongs : (id ? playlistSongs[id] || [] : []);

  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [resolvedSongs, setResolvedSongs] = useState<Map<string, Song>>(new Map());
  const [resolveProgress, setResolveProgress] = useState<{ done: number; total: number } | null>(null);
  const [resolveKey, setResolveKey] = useState(0);
  const [resolving, setResolving] = useState(false);
  const resolveAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (songs.length === 0) return;
    Promise.all(songs.map((s) => offlineCache.isCached(s.id).then((c) => (c ? s.id : null)))).then(
      (ids) => setCachedIds(new Set(ids.filter(Boolean) as string[]))
    );
  }, [songs]);

  useEffect(() => { if (id && !isDeezerPlaylist) loadPlaylistSongs(id); }, [id, isDeezerPlaylist]);

  useEffect(() => {
    resolveAbortRef.current?.abort();
    setResolvedSongs(new Map());
    setResolving(false);

    if (songs.length === 0) {
      setResolveProgress(null);
      return;
    }

    const needsResolve = songs.filter(
      (s) =>
        s.id.startsWith("dz-") &&
        (!s.streamUrl || s.streamUrl.includes("dzcdn.net") || s.streamUrl.includes("cdn-preview"))
    );

    if (needsResolve.length === 0) {
      setResolveProgress(null);
      return;
    }

    const controller = new AbortController();
    resolveAbortRef.current = controller;
    setResolveProgress({ done: 0, total: needsResolve.length });
    setResolving(true);

    const resolve = async () => {
      let done = 0;

      for (let i = 0; i < needsResolve.length; i += 4) {
        if (controller.signal.aborted) return;

        const batch = needsResolve.slice(i, i + 4);
        const results = await Promise.all(batch.map((s) => deezerApi.resolveFullStream(s).catch(() => s)));

        if (controller.signal.aborted) return;

        done += batch.length;
        setResolveProgress({ done, total: needsResolve.length });

        setResolvedSongs((prev) => {
          const next = new Map(prev);
          results.forEach((r, idx) => {
            const isHd =
              !!r.streamUrl &&
              !r.streamUrl.includes("dzcdn.net") &&
              !r.streamUrl.includes("cdn-preview");

            if (isHd && r.streamUrl !== batch[idx].streamUrl) {
              next.set(r.id, r);
            }
          });
          return next;
        });
      }

      if (!controller.signal.aborted) {
        setResolving(false);
        setTimeout(() => setResolveProgress(null), 800);
      }
    };

    resolve();
    return () => controller.abort();
  }, [songs, id, resolveKey]);

  const displaySongs = songs.map((s) => resolvedSongs.get(s.id) || s);
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

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !id) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const { error } = await supabase.from("playlists").update({ cover_url: reader.result as string }).eq("id", id);
      if (error) toast.error("Erreur couverture"); else { toast.success("Couverture mise à jour"); const uid = usePlayerStore.getState().userId; if (uid) usePlayerStore.getState().loadUserData(uid); }
    };
    reader.readAsDataURL(file);
  };

  if (isDeezerPlaylist && dzLoading) {
    return (
      <div className="p-4 pb-40 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Chargement de la playlist…</p>
      </div>
    );
  }

  if (isDeezerPlaylist && dzError) {
    return (
      <div className="p-4 pb-40 flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground mb-2">Playlist indisponible</p>
        <div className="flex gap-3">
          <button onClick={() => navigate(-1)} className="px-4 py-2 text-sm rounded-full bg-secondary text-secondary-foreground">Retour</button>
          <button onClick={() => window.location.reload()} className="px-4 py-2 text-sm rounded-full bg-primary text-primary-foreground">Réessayer</button>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="p-4 pb-40 flex flex-col items-center justify-center min-h-[60vh]">
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
    <div className="pb-40 max-w-4xl mx-auto animate-fade-in">
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
          <button onClick={() => navigate("/")} className="p-2.5 rounded-full bg-background/30 backdrop-blur-xl border border-white/[0.08] text-foreground hover:bg-background/50 transition-all active:scale-90">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <motion.div style={{ opacity: headerOpacity }} className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-foreground truncate max-w-[200px]">
            {playlist.name}
          </motion.div>
          <div className="flex items-center gap-2">
            {!isDeezerPlaylist && (
              <label className="p-2.5 rounded-full bg-background/30 backdrop-blur-xl border border-white/[0.08] text-foreground hover:bg-background/50 transition-all cursor-pointer">
                <ImageIcon className="w-5 h-5" />
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
              </label>
            )}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="p-2.5 rounded-full bg-background/30 backdrop-blur-xl border border-white/[0.08] text-foreground hover:bg-background/50 transition-all active:scale-90"
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
                    className="absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl bg-card/80 backdrop-blur-2xl border border-white/[0.1] shadow-2xl shadow-black/40 overflow-hidden"
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
                      {!isDeezerPlaylist && (
                        <>
                          <div className="h-px bg-white/[0.06] mx-2 my-1" />
                          <label className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-foreground hover:bg-white/[0.08] transition-colors cursor-pointer">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            Changer la couverture
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { handleCoverChange(e); setMenuOpen(false); }} />
                          </label>
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

      {/* ─── ACTION BAR ─── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="px-4 md:px-8 flex items-center gap-3 mb-4 -mt-1"
      >
        <button
          onClick={handlePlayAll}
          disabled={displaySongs.length === 0}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/30 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          <Play className="w-5 h-5 fill-current" />
          Lecture
        </button>
        <button
          onClick={handleShufflePlay}
          disabled={displaySongs.length === 0}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/[0.07] backdrop-blur-xl border border-white/[0.08] text-foreground font-semibold text-sm hover:bg-white/[0.12] active:scale-[0.98] transition-all disabled:opacity-40"
        >
          <Shuffle className="w-4 h-4" />
          Aléatoire
        </button>
        <button
          onClick={handleDownloadAll}
          disabled={displaySongs.length === 0 || downloading}
          className="p-3.5 rounded-2xl bg-white/[0.07] backdrop-blur-xl border border-white/[0.08] text-muted-foreground hover:text-foreground hover:bg-white/[0.12] active:scale-[0.95] transition-all disabled:opacity-40"
        >
          <Download className={`w-5 h-5 ${downloading ? "animate-bounce" : ""}`} />
        </button>
        <button
          onClick={() => { setResolveKey((k) => k + 1); toast("Relance de la résolution HD…"); }}
          disabled={resolving || displaySongs.length === 0}
          className="p-3.5 rounded-2xl bg-white/[0.07] backdrop-blur-xl border border-white/[0.08] text-muted-foreground hover:text-foreground hover:bg-white/[0.12] active:scale-[0.95] transition-all disabled:opacity-40"
          title="Relancer la résolution HD"
        >
          <RotateCcw className={`w-5 h-5 ${resolving ? "animate-spin" : ""}`} />
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
            <div className="p-4 rounded-full bg-white/[0.04] mb-4"><Music className="w-8 h-8 text-muted-foreground/30" /></div>
            <p className="text-muted-foreground text-sm mb-1">Playlist vide</p>
            <p className="text-muted-foreground/50 text-xs">Ajoutez des morceaux depuis la recherche</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] overflow-hidden">
            {displaySongs.map((song, i) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.03 * Math.min(i, 15), duration: 0.3 }}
                draggable={!isDeezerPlaylist}
                onDragStart={!isDeezerPlaylist ? () => handleDragStart(i) : undefined}
                onDragOver={!isDeezerPlaylist ? (e) => handleDragOver(e, i) : undefined}
                onDrop={!isDeezerPlaylist ? () => handleDrop(i) : undefined}
                onDragEnd={!isDeezerPlaylist ? () => { setDragIdx(null); setOverIdx(null); } : undefined}
                className={`flex items-center gap-1 group border-b border-white/[0.04] last:border-b-0 ${overIdx === i ? "border-t-2 !border-t-primary" : ""} ${dragIdx === i ? "opacity-40" : ""}`}
              >
                {!isDeezerPlaylist && (
                  <div className="cursor-grab active:cursor-grabbing p-1 pl-2 text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                    <GripVertical className="w-4 h-4" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <SongCard song={song} index={i} showIndex />
                </div>
                {cachedIds.has(song.id) && <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0 mr-1" />}
                {!isDeezerPlaylist && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(song.id); }}
                    className="p-1.5 mr-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaylistDetailPage;
