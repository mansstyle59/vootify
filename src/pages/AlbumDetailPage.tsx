import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { jiosaavnApi } from "@/lib/jiosaavnApi";
import { deezerApi } from "@/lib/deezerApi";
import { usePlayerStore } from "@/stores/playerStore";
import { SongCard, SongSkeleton } from "@/components/MusicCards";
import { ArrowLeft, Play, Shuffle, Loader2, Clock } from "lucide-react";
import { motion } from "framer-motion";
import type { Song } from "@/data/mockData";
import { formatDuration } from "@/data/mockData";

const AlbumDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { play, setQueue, currentSong, isPlaying, togglePlay } = usePlayerStore();

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
  const tracks = data?.tracks || [];

  const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0);

  const handlePlay = async (song: Song) => {
    if (currentSong?.id === song.id) {
      togglePlay();
      return;
    }
    const resolved = song.id.startsWith("dz-") ? await deezerApi.resolveFullStream(song) : song;
    setQueue(tracks);
    play(resolved);
  };

  const playAll = () => {
    if (tracks.length > 0) {
      setQueue(tracks);
      handlePlay(tracks[0]);
    }
  };

  const playShuffle = () => {
    if (tracks.length > 0) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      setQueue(shuffled);
      handlePlay(shuffled[0]);
    }
  };

  if (isLoading) {
    return (
      <div className="pb-32">
        <div className="px-4 md:px-8 pt-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="pb-32 px-4 md:px-8 pt-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <p className="text-center text-muted-foreground py-20">Album introuvable</p>
      </div>
    );
  }

  return (
    <div className="pb-32 max-w-4xl mx-auto">
      {/* Header with cover */}
      <div className="relative overflow-hidden">
        {/* Blurred background */}
        <div className="absolute inset-0">
          <img src={album.coverUrl} alt="" className="w-full h-full object-cover blur-3xl scale-125 opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>

        <div className="relative px-4 md:px-8 pt-6 pb-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 flex-shrink-0"
            >
              <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center sm:text-left"
            >
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Album</p>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-1">{album.title}</h1>
              <p className="text-base text-muted-foreground mb-2">{album.artist}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground justify-center sm:justify-start">
                <span>{album.year}</span>
                <span>·</span>
                <span>{tracks.length} titre{tracks.length > 1 ? "s" : ""}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(totalDuration)}
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 md:px-8 flex gap-2 mb-5 mt-2">
        <button
          onClick={playAll}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-md shadow-primary/25 hover:brightness-110 transition-all"
        >
          <Play className="w-4 h-4" />
          Tout lire
        </button>
        <button
          onClick={playShuffle}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-all"
        >
          <Shuffle className="w-4 h-4" />
          Aléatoire
        </button>
      </div>

      {/* Track list */}
      <div className="px-4 md:px-8">
        <div className="rounded-xl bg-secondary/20 border border-border/50 overflow-hidden">
          {tracks.map((song, i) => (
            <div key={song.id} onClick={() => handlePlay(song)}>
              <SongCard song={song} index={i} showIndex />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AlbumDetailPage;
