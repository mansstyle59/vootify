import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { VirtualSongList } from "@/components/VirtualSongList";
import { SongSkeleton } from "@/components/MusicCards";
import { ArrowLeft, Play, Shuffle, Music, User } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import type { Song } from "@/data/mockData";

const ArtistPage = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { play, setQueue, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 400], [0, 120]);
  const headerOpacity = useTransform(scrollY, [200, 350], [0, 1]);

  const artistName = decodeURIComponent(name || "");

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

  const coverUrl = songs.find((s) => s.coverUrl)?.coverUrl || "";

  const albums = useMemo(() => {
    const map = new Map<string, { title: string; coverUrl: string; count: number; id?: string }>();
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

  // Find album id from supabase for navigation
  const handleAlbumClick = async (albumTitle: string) => {
    const { data } = await supabase
      .from("custom_albums")
      .select("id")
      .eq("title", albumTitle)
      .limit(1)
      .single();
    if (data) navigate(`/album/${data.id}`);
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
      <motion.div style={{ y: bgY }} className="relative h-72 overflow-hidden">
        {coverUrl ? (
          <img src={coverUrl} alt={artistName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center">
            <User className="w-20 h-20 text-primary/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <button onClick={() => navigate(-1)} className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 p-2 rounded-full liquid-glass z-10">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-background shadow-xl mb-3">
            {coverUrl ? (
              <img src={coverUrl} alt={artistName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                <User className="w-8 h-8 text-primary/50" />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">{artistName}</h1>
          <p className="text-sm text-muted-foreground">
            {songs.length} morceau{songs.length > 1 ? "x" : ""} · {albums.length} album{albums.length > 1 ? "s" : ""}
          </p>
        </div>
      </motion.div>

      {/* Actions */}
      <div className="px-4 flex gap-3 my-4">
        <button onClick={handlePlayAll} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-medium text-sm shadow-lg">
          <Play className="w-4 h-4" /> Lecture
        </button>
        <button onClick={handleShuffle} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-secondary-foreground font-medium text-sm border border-border">
          <Shuffle className="w-4 h-4" /> Aléatoire
        </button>
      </div>

      {/* Albums */}
      {albums.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Albums</h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {albums.map((album) => (
              <button
                key={album.title}
                onClick={() => handleAlbumClick(album.title)}
                className="flex-shrink-0 w-32 group cursor-pointer text-left"
              >
                <div className="w-32 h-32 rounded-xl overflow-hidden bg-secondary mb-2 shadow-md">
                  {album.coverUrl ? (
                    <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <Music className="w-8 h-8 text-primary/30" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold text-foreground truncate">{album.title}</p>
                <p className="text-xs text-muted-foreground">{album.count} titre{album.count > 1 ? "s" : ""}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Songs */}
      <div className="px-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tous les titres</h2>
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
