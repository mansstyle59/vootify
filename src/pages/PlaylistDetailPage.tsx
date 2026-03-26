import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlayerStore } from "@/stores/playerStore";
import { SongCard } from "@/components/MusicCards";
import { Song } from "@/data/mockData";
import { musicDb } from "@/lib/musicDb";
import { ArrowLeft, Play, Shuffle, Trash2, GripVertical, Image as ImageIcon, Download, CheckCircle, Loader2 } from "lucide-react";
import { offlineCache } from "@/lib/offlineCache";
import { deezerApi } from "@/lib/deezerApi";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const PlaylistDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playlistSongs, loadPlaylistSongs, play, setQueue, removeSongFromPlaylist, playlists } = usePlayerStore();

  const isDeezerPlaylist = id?.startsWith("dz-");
  const deezerRawId = isDeezerPlaylist ? id!.replace("dz-", "") : null;

  // Local user playlist lookup
  const userPlaylist = playlists.find((p) => p.id === id);

  // Deezer playlist state
  const [dzInfo, setDzInfo] = useState<{ title: string; picture: string } | null>(null);
  const [dzSongs, setDzSongs] = useState<Song[]>([]);
  const [dzLoading, setDzLoading] = useState(false);
  const [dzError, setDzError] = useState(false);

  // Fetch Deezer playlist
  useEffect(() => {
    if (!isDeezerPlaylist || !deezerRawId) return;
    let cancelled = false;
    const fetchDz = async (retry = false) => {
      setDzLoading(true);
      setDzError(false);
      try {
        console.log("[playlist] Fetching Deezer playlist:", deezerRawId);
        const [info, tracks] = await Promise.all([
          deezerApi.getPlaylistInfo(deezerRawId),
          deezerApi.getPlaylistTracks(deezerRawId, 50),
        ]);
        if (cancelled) return;
        console.log("[playlist] Deezer response:", { info, trackCount: tracks.length });
        setDzInfo({ title: info.title, picture: info.picture });
        setDzSongs(tracks);
      } catch (e) {
        console.error("[playlist] Deezer fetch error:", e);
        if (!retry && !cancelled) {
          console.log("[playlist] Retrying...");
          await fetchDz(true);
          return;
        }
        if (!cancelled) setDzError(true);
      } finally {
        if (!cancelled) setDzLoading(false);
      }
    };
    fetchDz();
    return () => { cancelled = true; };
  }, [isDeezerPlaylist, deezerRawId]);

  // Determine playlist data source
  const playlist = isDeezerPlaylist
    ? dzInfo ? { id: id!, name: dzInfo.title, cover_url: dzInfo.picture, created_at: "" } : null
    : userPlaylist;
  const songs: Song[] = isDeezerPlaylist ? dzSongs : (id ? playlistSongs[id] || [] : []);

  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [resolvedSongs, setResolvedSongs] = useState<Map<string, Song>>(new Map());
  const [resolveProgress, setResolveProgress] = useState<{ done: number; total: number } | null>(null);
  const resolveAbortRef = useRef<AbortController | null>(null);

  // Check which songs are cached offline
  useEffect(() => {
    if (songs.length === 0) return;
    Promise.all(songs.map((s) => offlineCache.isCached(s.id).then((c) => (c ? s.id : null)))).then(
      (ids) => setCachedIds(new Set(ids.filter(Boolean) as string[]))
    );
  }, [songs]);

  // Load user playlist songs
  useEffect(() => {
    if (id && !isDeezerPlaylist) loadPlaylistSongs(id);
  }, [id, isDeezerPlaylist]);

  // Background HD resolution for playlist tracks
  useEffect(() => {
    resolveAbortRef.current?.abort();
    if (songs.length === 0) return;

    const needsResolve = songs.filter(
      (s) => s.id.startsWith("dz-") && s.streamUrl &&
        (s.streamUrl.includes("dzcdn.net") || s.streamUrl.includes("cdn-preview"))
    );
    if (needsResolve.length === 0) return;

    const controller = new AbortController();
    resolveAbortRef.current = controller;
    setResolveProgress({ done: 0, total: needsResolve.length });

    const resolve = async () => {
      let done = 0;
      let upgraded = 0;
      for (let i = 0; i < needsResolve.length; i += 4) {
        if (controller.signal.aborted) return;
        const batch = needsResolve.slice(i, i + 4);
        const results = await Promise.all(
          batch.map((s) => deezerApi.resolveFullStream(s).catch(() => s))
        );
        if (controller.signal.aborted) return;
        done += batch.length;
        setResolveProgress({ done, total: needsResolve.length });

        const newResolved = new Map(resolvedSongs);
        results.forEach((r, idx) => {
          if (r.streamUrl && r.streamUrl !== batch[idx].streamUrl) {
            newResolved.set(r.id, r);
            upgraded++;
          }
        });
        if (newResolved.size > resolvedSongs.size) {
          setResolvedSongs(new Map(newResolved));
        }
      }
      if (!controller.signal.aborted) {
        if (upgraded > 0) toast.success(`${upgraded} morceau${upgraded > 1 ? "x" : ""} upgradé${upgraded > 1 ? "s" : ""} en HD`);
        setTimeout(() => setResolveProgress(null), 1500);
      }
    };
    resolve();
    return () => controller.abort();
  }, [songs.length, id]);

  // Merge resolved songs with original
  const displaySongs = songs.map((s) => resolvedSongs.get(s.id) || s);

  const handlePlayAll = () => {
    if (displaySongs.length === 0) return;
    setQueue(displaySongs);
    play(displaySongs[0]);
  };

  const handleShufflePlay = () => {
    if (displaySongs.length === 0) return;
    const shuffled = [...displaySongs].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    play(shuffled[0]);
  };

  const [downloading, setDownloading] = useState(false);
  const [dlProgress, setDlProgress] = useState({ done: 0, total: 0 });

  const handleDownloadAll = async () => {
    if (displaySongs.length === 0) return;
    setDownloading(true);
    const total = displaySongs.length;
    setDlProgress({ done: 0, total });
    let done = 0;
    for (const song of displaySongs) {
      try {
        const cached = await offlineCache.isCached(song.id);
        if (!cached && song.streamUrl) {
          await offlineCache.cacheSong(song);
        }
        done++;
        setDlProgress({ done, total });
      } catch {
        done++;
        setDlProgress({ done, total });
        toast.error(`Échec : ${song.title}`);
      }
    }
    setDownloading(false);
    setCachedIds(new Set(displaySongs.map((s) => s.id)));
    toast.success("Tous les morceaux ont été téléchargés !");
  };

  const handleRemove = async (songId: string) => {
    if (!id) return;
    await removeSongFromPlaylist(id, songId);
    toast.success("Morceau retiré");
  };

  // Drag & drop reorder
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  };
  const handleDrop = useCallback(async (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx || !id) return;
    const reordered = [...songs];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    const updates = reordered.map((song, i) =>
      supabase
        .from("playlist_songs")
        .update({ position: i })
        .eq("playlist_id", id)
        .eq("song_id", song.id)
    );
    await Promise.all(updates);
    await loadPlaylistSongs(id);
    setDragIdx(null);
    setOverIdx(null);
  }, [dragIdx, songs, id, loadPlaylistSongs]);

  // Cover update
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const { error } = await supabase
        .from("playlists")
        .update({ cover_url: dataUrl })
        .eq("id", id);
      if (error) {
        toast.error("Erreur lors de la mise à jour de la couverture");
      } else {
        toast.success("Couverture mise à jour");
        const uid = usePlayerStore.getState().userId;
        if (uid) usePlayerStore.getState().loadUserData(uid);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!playlist) {
    return (
      <div className="p-4 pb-40 flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Playlist introuvable</p>
        <button onClick={() => navigate("/library")} className="mt-4 text-primary text-sm">Retour</button>
      </div>
    );
  }

  const coverUrl = playlist.cover_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop";

  return (
    <div className="pb-40 max-w-3xl mx-auto">
      {/* Header */}
      <div className="relative">
        <div className="h-56 md:h-72 overflow-hidden relative">
          <img src={coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background" />
        </div>

        <button
          onClick={() => navigate("/library")}
          className="absolute left-4 p-2 rounded-full bg-background/50 backdrop-blur-md text-foreground"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <label className="absolute right-4 p-2 rounded-full bg-background/50 backdrop-blur-md text-foreground cursor-pointer hover:bg-background/70 transition-colors" style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
          <ImageIcon className="w-5 h-5" />
          <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
        </label>

        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{playlist.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{songs.length} titre{songs.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 px-4 py-4 flex-wrap">
        <button
          onClick={handlePlayAll}
          disabled={songs.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50"
        >
          <Play className="w-4 h-4 ml-0.5" /> Lecture
        </button>
        <button
          onClick={handleShufflePlay}
          disabled={songs.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-secondary-foreground font-medium text-sm disabled:opacity-50"
        >
          <Shuffle className="w-4 h-4" /> Aléatoire
        </button>
        <button
          onClick={handleDownloadAll}
          disabled={songs.length === 0 || downloading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-secondary-foreground font-medium text-sm disabled:opacity-50"
        >
          <Download className={`w-4 h-4 ${downloading ? "animate-bounce" : ""}`} /> {downloading ? "..." : "Télécharger"}
        </button>
      </div>

      {/* HD resolve progress */}
      {resolveProgress && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${resolveProgress.total > 0 ? (resolveProgress.done / resolveProgress.total) * 100 : 0}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
              {resolveProgress.done}/{resolveProgress.total} HD
            </span>
          </div>
        </div>
      )}

      {/* Download progress bar */}
      {downloading && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${dlProgress.total > 0 ? (dlProgress.done / dlProgress.total) * 100 : 0}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              {dlProgress.done}/{dlProgress.total}
            </span>
          </div>
        </div>
      )}

      {/* Song list */}
      <div className="px-4">
        {songs.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            Cette playlist est vide. Ajoutez des morceaux depuis la recherche !
          </p>
        ) : (
          <div className="glass-panel-light rounded-xl p-1">
            {displaySongs.map((song, i) => (
              <div
                key={song.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                className={`flex items-center gap-1 group ${
                  overIdx === i ? "border-t-2 border-primary" : ""
                } ${dragIdx === i ? "opacity-40" : ""}`}
              >
                <div className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                  <GripVertical className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <SongCard song={song} index={i} showIndex />
                </div>
                {cachedIds.has(song.id) && (
                  <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(song.id); }}
                  className="p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaylistDetailPage;
