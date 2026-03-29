import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { useAuth } from "@/hooks/useAuth";
import { Song, formatDuration } from "@/data/mockData";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowLeft, Play, Shuffle, Music, Clock, ListMusic } from "lucide-react";
import { useOfflineCoverUrl } from "@/hooks/useOfflineCoverUrl";

/* ── Song Row ── */
function SharedSongRow({ song, index, isActive, isPlaying, onClick }: {
  song: Song; index: number; isActive: boolean; isPlaying: boolean; onClick: () => void;
}) {
  const coverUrl = useOfflineCoverUrl(song.id, song.coverUrl);
  return (
    <button
      onClick={onClick}
      className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer transition-all duration-150 active:scale-[0.98]"
      style={{
        background: isActive ? "hsl(var(--primary) / 0.05)" : "transparent",
        boxShadow: isActive ? "inset 0 0 0 1px hsl(var(--primary) / 0.12)" : "none",
      }}
    >
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

      <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0"
        style={{ boxShadow: isActive ? "0 4px 16px hsl(var(--primary) / 0.15)" : "0 2px 8px hsl(0 0% 0% / 0.08)" }}
      >
        {coverUrl ? (
          <img src={coverUrl} alt={song.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(var(--secondary)), hsl(var(--secondary) / 0.5))" }}>
            <Music className="w-4 h-4 text-muted-foreground/25" />
          </div>
        )}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${
          isActive ? "bg-black/20 opacity-100" : "bg-black/25 opacity-0 group-hover:opacity-100"
        }`}>
          {isActive && isPlaying ? (
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          ) : (
            <Play className="w-3.5 h-3.5 text-white ml-0.5 fill-current" />
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-[12px] font-bold leading-tight truncate ${isActive ? "text-primary" : "text-foreground"}`}>
          {song.title}
        </p>
        <p className="text-[10px] text-muted-foreground/45 leading-tight truncate font-medium mt-0.5">
          {song.artist}{song.album ? ` · ${song.album}` : ""}
        </p>
      </div>

      <span className="text-[10px] text-muted-foreground/35 tabular-nums flex-shrink-0 font-medium">
        {formatDuration(song.duration)}
      </span>
    </button>
  );
}

const SharedPlaylistDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { play, setQueue, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 400], [0, 120]);
  const coverScale = useTransform(scrollY, [0, 300], [1, 0.75]);
  const coverOpacity = useTransform(scrollY, [0, 250], [1, 0.5]);
  const headerOpacity = useTransform(scrollY, [200, 350], [0, 1]);

  // Fetch playlist info
  const { data: playlist } = useQuery({
    queryKey: ["shared-playlist-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shared_playlists")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch songs
  const { data: songs = [] } = useQuery({
    queryKey: ["shared-playlist-songs-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shared_playlist_songs")
        .select("*")
        .eq("shared_playlist_id", id!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []).map((row): Song => ({
        id: row.song_id,
        title: row.title,
        artist: row.artist,
        album: row.album || "",
        duration: row.duration || 0,
        coverUrl: row.cover_url || "",
        streamUrl: row.stream_url || "",
        liked: false,
      }));
    },
    enabled: !!id,
  });

  const coverImg = playlist?.cover_url || songs[0]?.coverUrl || "";
  const totalDuration = songs.reduce((s, t) => s + t.duration, 0);
  const totalMin = Math.floor(totalDuration / 60);

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

  const handlePlaySong = (song: Song, idx: number) => {
    const isActive = currentSong?.id === song.id;
    if (isActive) { togglePlay(); return; }
    setQueue(songs);
    play(song);
  };

  return (
    <div className="min-h-screen pb-32 relative">
      {/* Sticky header */}
      <motion.div
        style={{ opacity: headerOpacity }}
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3"
        {...{
          style: {
            opacity: headerOpacity as any,
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
            background: "hsl(var(--background) / 0.85)",
            backdropFilter: "blur(30px)",
            WebkitBackdropFilter: "blur(30px)",
            borderBottom: "1px solid hsl(var(--border) / 0.06)",
          },
        }}
      >
        <button onClick={() => navigate(-1)} className="active:scale-90 transition-transform">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <p className="text-sm font-bold text-foreground truncate flex-1">{playlist?.playlist_name || ""}</p>
      </motion.div>

      {/* Back button (visible before sticky header) */}
      <div className="absolute top-0 left-0 z-30 px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <button onClick={() => navigate(-1)} className="active:scale-90 transition-transform p-1 rounded-full"
          style={{ background: "hsl(0 0% 0% / 0.3)", backdropFilter: "blur(20px)" }}
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Hero section */}
      <div className="relative overflow-hidden">
        <motion.div style={{ y: bgY }} className="absolute inset-0 -top-20">
          {coverImg ? (
            <img src={coverImg} alt="" className="w-full h-full object-cover scale-110" />
          ) : (
            <div className="w-full h-full" style={{ background: "linear-gradient(180deg, hsl(var(--primary) / 0.15), hsl(var(--background)))" }} />
          )}
          <div className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, hsl(var(--background) / 0.3) 0%, hsl(var(--background) / 0.7) 50%, hsl(var(--background)) 100%)" }}
          />
        </motion.div>

        <div className="relative pt-24 pb-6 px-6 flex flex-col items-center text-center">
          <motion.div style={{ scale: coverScale, opacity: coverOpacity }}>
            <div className="w-48 h-48 rounded-3xl overflow-hidden shadow-2xl mx-auto"
              style={{ boxShadow: "0 16px 60px hsl(0 0% 0% / 0.4), 0 0 0 1px hsl(0 0% 100% / 0.06)" }}
            >
              {coverImg ? (
                <img src={coverImg} alt={playlist?.playlist_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.05))" }}
                >
                  <ListMusic className="w-16 h-16 text-primary/25" />
                </div>
              )}
            </div>
          </motion.div>

          <h1 className="mt-5 text-xl font-extrabold text-foreground">{playlist?.playlist_name || "Playlist"}</h1>
          <p className="text-[11px] text-muted-foreground/60 mt-1 font-medium">
            {songs.length} titre{songs.length !== 1 ? "s" : ""} · {totalMin} min · Partagée par l'admin
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-2 px-7 py-3 rounded-full bg-primary text-primary-foreground text-sm font-bold active:scale-[0.96] transition-transform"
              style={{ boxShadow: "0 8px 24px hsl(var(--primary) / 0.3)" }}
            >
              <Play className="w-4 h-4 fill-current" />
              Tout lire
            </button>
            <button
              onClick={handleShuffle}
              className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold text-foreground active:scale-[0.96] transition-transform"
              style={{ background: "hsl(var(--foreground) / 0.06)" }}
            >
              <Shuffle className="w-4 h-4" />
              Aléatoire
            </button>
          </div>
        </div>
      </div>

      {/* Song list */}
      <div className="px-3">
        <div className="flex items-center gap-2 px-3 mb-2">
          <Clock className="w-3 h-3 text-muted-foreground/30" />
          <span className="text-[10px] text-muted-foreground/40 font-medium uppercase tracking-wider">
            {songs.length} titre{songs.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="space-y-0.5">
          {songs.map((song, idx) => (
            <SharedSongRow
              key={`${song.id}-${idx}`}
              song={song}
              index={idx}
              isActive={currentSong?.id === song.id}
              isPlaying={currentSong?.id === song.id && isPlaying}
              onClick={() => handlePlaySong(song, idx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SharedPlaylistDetailPage;
