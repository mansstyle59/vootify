import { useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ScrollBlurHeader } from "@/components/ScrollBlurHeader";
import { usePlayerStore } from "@/stores/playerStore";
import { useAllLocalSongs } from "@/hooks/useLocalSearch";
import { getGenreTags, genreDefs, defaultGenreColor } from "@/lib/genreGroups";
import { SongCard, SongSkeleton } from "@/components/MusicCards";
import { VirtualSongList } from "@/components/VirtualSongList";
import { ArrowLeft, Play, Shuffle, Search, X } from "lucide-react";
import { motion } from "framer-motion";
import type { Song } from "@/data/mockData";

const GenrePage = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const genreName = decodeURIComponent(name || "");
  const { play, setQueue, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const { data: allSongs, isLoading } = useAllLocalSongs();
  const [searchQuery, setSearchQuery] = useState("");

  const def = genreDefs[genreName] || defaultGenreColor;
  const tags = useMemo(() => getGenreTags(genreName), [genreName]);

  // Filter songs that match any tag in this genre group
  const genreSongs = useMemo(() => {
    if (!allSongs) return [];
    return allSongs.filter((s) => {
      const genre = (s as any).genre;
      if (!genre) return false;
      return genre
        .split(/[,/|]/)
        .some((g: string) => tags.has(g.trim().toLowerCase()));
    });
  }, [allSongs, tags]);

  // Apply search filter
  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return genreSongs;
    const q = searchQuery.toLowerCase();
    return genreSongs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album.toLowerCase().includes(q)
    );
  }, [genreSongs, searchQuery]);

  const handlePlay = useCallback(
    (song: Song) => {
      if (currentSong?.id === song.id) {
        togglePlay();
        return;
      }
      setQueue(filteredSongs);
      play(song);
    },
    [currentSong, filteredSongs, play, setQueue, togglePlay]
  );

  const handleShuffle = useCallback(() => {
    if (filteredSongs.length === 0) return;
    const shuffled = [...filteredSongs].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    play(shuffled[0]);
  }, [filteredSongs, play, setQueue]);

  const handlePlayAll = useCallback(() => {
    if (filteredSongs.length === 0) return;
    setQueue(filteredSongs);
    play(filteredSongs[0]);
  }, [filteredSongs, play, setQueue]);

  // Unique artists count
  const artistCount = useMemo(() => {
    const set = new Set<string>();
    genreSongs.forEach((s) =>
      s.artist.split(",").forEach((a) => set.add(a.trim()))
    );
    return set.size;
  }, [genreSongs]);

  return (
    <div className="pb-40 max-w-7xl mx-auto animate-fade-in">
      <ScrollBlurHeader>
        <div
          className="relative overflow-hidden"
          style={{
            background: `linear-gradient(160deg, ${def.from}, ${def.to})`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80" />
          <div className="relative px-4 md:px-8 pt-[max(1rem,env(safe-area-inset-top))] pb-6">
            <button
              onClick={() => navigate(-1)}
              className="mb-4 flex items-center gap-1.5 text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Retour</span>
            </button>

            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">{def.emoji}</span>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-white drop-shadow-md">
                {genreName}
              </h1>
            </div>

            <p className="text-sm text-white/60 mb-4">
              {genreSongs.length} morceaux · {artistCount} artistes
            </p>

            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handlePlayAll}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-semibold border border-white/20"
              >
                <Play className="w-4 h-4 fill-current" />
                Tout lire
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleShuffle}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 backdrop-blur-sm text-white/80 text-sm font-medium border border-white/10"
              >
                <Shuffle className="w-4 h-4" />
                Aléatoire
              </motion.button>
            </div>
          </div>
        </div>
      </ScrollBlurHeader>

      {/* Search bar */}
      <div className="px-4 md:px-8 mb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer les morceaux…"
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Song list */}
      <div className="px-4 md:px-8">
        {isLoading ? (
          <div className="rounded-2xl bg-card/50 border border-border overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <SongSkeleton key={i} />
            ))}
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-4xl mb-3 block">{def.emoji}</span>
            <p className="text-muted-foreground text-sm">
              {searchQuery
                ? "Aucun résultat pour cette recherche"
                : "Aucun morceau dans ce genre"}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-card/30 border border-border overflow-hidden">
            <VirtualSongList
              songs={filteredSongs}
              onPlay={handlePlay}
              currentSongId={currentSong?.id}
              isPlaying={isPlaying}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default GenrePage;
