import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jiosaavnApi } from "@/lib/jiosaavnApi";
import { deezerApi } from "@/lib/deezerApi";
import { usePlayerStore } from "@/stores/playerStore";
import { useAuth } from "@/hooks/useAuth";
import { getEffectiveUserId } from "@/lib/deviceId";
import { supabase } from "@/integrations/supabase/client";
import { SongCard, SongSkeleton } from "@/components/MusicCards";
import { ArrowLeft, Play, Shuffle, Loader2, Clock, Bookmark, BookmarkCheck, MoreHorizontal, Share2, ListPlus } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { toast } from "sonner";
import type { Song } from "@/data/mockData";
import { formatDuration } from "@/data/mockData";

const AlbumDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { play, setQueue, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 400], [0, 120]);
  const coverScale = useTransform(scrollY, [0, 300], [1, 0.75]);
  const coverOpacity = useTransform(scrollY, [0, 250], [1, 0.5]);
  const headerOpacity = useTransform(scrollY, [200, 350], [0, 1]);

  const isJioSaavn = id?.startsWith("js-album-");
  const isDeezer = id?.startsWith("dz-album-");

  const { data, isLoading } = useQuery({
    queryKey: ["album-detail", id],
    queryFn: async () => {
      if (isJioSaavn) return jiosaavnApi.getAlbum(id!);
      if (isDeezer) return deezerApi.getAlbumTracks(id!);
      throw new Error("Unknown album source");
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const album = data?.album;
  const rawTracks = data?.tracks || [];
  const [resolvedTracks, setResolvedTracks] = useState<Song[]>([]);
  const resolvingRef = useRef(false);

  useEffect(() => {
    if (rawTracks.length === 0 || resolvingRef.current) return;
    const dzTracks = rawTracks.filter((t) => t.id.startsWith("dz-"));
    if (dzTracks.length === 0) { setResolvedTracks(rawTracks); return; }

    resolvingRef.current = true;
    setResolvedTracks(rawTracks);

    const controller = new AbortController();
    (async () => {
      let upgraded = 0;
      const updated = [...rawTracks];
      for (let i = 0; i < updated.length; i += 4) {
        if (controller.signal.aborted) return;
        const batch = updated.slice(i, i + 4);
        const resolved = await Promise.all(
          batch.map((s) => s.id.startsWith("dz-") ? deezerApi.resolveFullStream(s).catch(() => s) : Promise.resolve(s))
        );
        if (controller.signal.aborted) return;
        for (let j = 0; j < resolved.length; j++) {
          const idx = i + j;
          if (resolved[j].streamUrl && resolved[j].streamUrl !== updated[idx].streamUrl) { updated[idx] = resolved[j]; upgraded++; }
        }
        setResolvedTracks([...updated]);
      }
      if (upgraded > 0) toast.success(`${upgraded} titre${upgraded > 1 ? "s" : ""} résolu${upgraded > 1 ? "s" : ""} en HD`);
    })();
    return () => { controller.abort(); };
  }, [rawTracks]);

  const tracks = resolvedTracks.length > 0 ? resolvedTracks : rawTracks;
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
    const resolved = song.id.startsWith("dz-") ? await deezerApi.resolveFullStream(song) : song;
    setQueue(tracks);
    play(resolved);
  };

  const playAll = () => { if (tracks.length > 0) { setQueue(tracks); handlePlay(tracks[0]); } };
  const playShuffle = () => { if (tracks.length > 0) { const s = [...tracks].sort(() => Math.random() - 0.5); setQueue(s); handlePlay(s[0]); } };

  if (isLoading) {
    return (
      <div className="pb-40">
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
      <div className="pb-40 px-4 md:px-8" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}>
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <p className="text-center text-muted-foreground py-20">Album introuvable</p>
      </div>
    );
  }

  return (
    <div className="pb-40 max-w-4xl mx-auto">
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
          <button onClick={() => navigate(-1)} className="p-2.5 rounded-full bg-background/30 backdrop-blur-xl border border-white/[0.08] text-foreground hover:bg-background/50 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <motion.div style={{ opacity: headerOpacity }} className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-foreground truncate max-w-[200px]">
            {album.title}
          </motion.div>
          <button className="p-2.5 rounded-full bg-background/30 backdrop-blur-xl border border-white/[0.08] text-foreground hover:bg-background/50 transition-all">
            <MoreHorizontal className="w-5 h-5" />
          </button>
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
            <p className="text-base text-primary font-medium mb-3">{album.artist}</p>
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
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/30 hover:brightness-110 active:scale-[0.98] transition-all"
        >
          <Play className="w-5 h-5 fill-current" />
          Lecture
        </button>
        <button
          onClick={playShuffle}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/[0.07] backdrop-blur-xl border border-white/[0.08] text-foreground font-semibold text-sm hover:bg-white/[0.12] active:scale-[0.98] transition-all"
        >
          <Shuffle className="w-4 h-4" />
          Aléatoire
        </button>
        {user && (
          <button
            onClick={() => toggleSave.mutate()}
            disabled={toggleSave.isPending}
            className={`p-3.5 rounded-2xl border transition-all active:scale-[0.95] ${
              isSaved
                ? "bg-primary/15 border-primary/30 text-primary"
                : "bg-white/[0.07] backdrop-blur-xl border-white/[0.08] text-muted-foreground hover:text-foreground hover:bg-white/[0.12]"
            }`}
          >
            {isSaved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
          </button>
        )}
      </motion.div>

      {/* ─── TRACK LIST ─── */}
      <div className="px-4 md:px-8">
        <div className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] overflow-hidden">
          {tracks.map((song, i) => (
            <motion.div
              key={song.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * Math.min(i, 10), duration: 0.3 }}
              onClick={() => handlePlay(song)}
              className="border-b border-white/[0.04] last:border-b-0"
            >
              <SongCard song={song} index={i} showIndex />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AlbumDetailPage;
