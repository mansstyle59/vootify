import { useQuery } from "@tanstack/react-query";
import { deezerApi } from "@/lib/deezerApi";
import { usePlayerStore } from "@/stores/playerStore";
import { ContentCard, SongCard, CardSkeleton, SongSkeleton } from "@/components/MusicCards";
import { motion } from "framer-motion";
import { TrendingUp, Sparkles, Disc3, Music2, Clock } from "lucide-react";
import type { Song } from "@/data/mockData";
import { musicDb } from "@/lib/musicDb";
import { ANONYMOUS_USER_ID } from "@/lib/constants";

const sectionAnim = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.06 } },
};

const HomePage = () => {
  const { play, setQueue } = usePlayerStore();

  const { data: chartTracks, isLoading: loadingTracks } = useQuery({
    queryKey: ["deezer-chart-tracks"],
    queryFn: () => deezerApi.getChartTracks(20),
    staleTime: 10 * 60 * 1000,
  });

  const { data: chartAlbums, isLoading: loadingAlbums } = useQuery({
    queryKey: ["deezer-chart-albums"],
    queryFn: () => deezerApi.getChartAlbums(12),
    staleTime: 5 * 60 * 1000,
  });

  const { data: recentlyPlayed = [] } = useQuery({
    queryKey: ["recently-played"],
    queryFn: () => musicDb.getRecentlyPlayed(ANONYMOUS_USER_ID, 10),
    staleTime: 60 * 1000,
  });

  const handlePlayTrack = (song: Song, allSongs: Song[]) => {
    setQueue(allSongs);
    play(song);
  };

  const handleAlbumClick = async (albumId: string) => {
    try {
      const { tracks } = await deezerApi.getAlbumTracks(albumId);
      if (tracks.length > 0) {
        setQueue(tracks);
        play(tracks[0]);
      }
    } catch (e) {
      console.error("Failed to load album tracks", e);
    }
  };

  return (
    <div className="p-4 md:p-8 pb-32 max-w-7xl mx-auto space-y-10">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-2xl p-6 md:p-10 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent" />
        <div className="relative z-10">
          <p className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Musique en streaming
          </p>
          <h1 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-2">
            Bienvenue sur VOO Music
          </h1>
          <p className="text-muted-foreground max-w-md">
            Explorez les tendances et découvrez de nouveaux artistes.
          </p>
        </div>
      </motion.div>

      {/* Recently Played */}
      {recentlyPlayed.length > 0 && (
        <motion.section variants={sectionAnim} initial="hidden" animate="show">
          <h2 className="text-xl font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" /> Écoutés récemment
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {recentlyPlayed.slice(0, 5).map((song) => (
              <motion.div
                key={song.id}
                whileHover={{ scale: 1.03, y: -4 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="glass-panel-light rounded-xl p-3 cursor-pointer group"
                onClick={() => handlePlayTrack(song, recentlyPlayed)}
              >
                <div className="relative overflow-hidden rounded-lg mb-2">
                  <img src={song.coverUrl} alt={song.title} className="w-full aspect-square object-cover" />
                  <div className="absolute inset-0 bg-background/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="p-2.5 rounded-full bg-primary text-primary-foreground glow-primary">
                      <Music2 className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                <p className="text-sm font-medium truncate text-foreground">{song.title}</p>
                <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Tendances */}
      <motion.section variants={sectionAnim} initial="hidden" animate="show">
        <h2 className="text-xl font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" /> Tendances
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <div className="glass-panel-light rounded-xl p-2">
            {loadingTracks
              ? Array.from({ length: 5 }).map((_, i) => <SongSkeleton key={i} />)
              : chartTracks?.slice(0, 5).map((song, i) => (
                  <div key={song.id} onClick={() => handlePlayTrack(song, chartTracks)}>
                    <SongCard song={song} index={i} showIndex />
                  </div>
                ))}
          </div>
          <div className="glass-panel-light rounded-xl p-2 mt-4 md:mt-0">
            {loadingTracks
              ? Array.from({ length: 5 }).map((_, i) => <SongSkeleton key={i} />)
              : chartTracks?.slice(5, 10).map((song, i) => (
                  <div key={song.id} onClick={() => handlePlayTrack(song, chartTracks)}>
                    <SongCard song={song} index={i + 5} showIndex />
                  </div>
                ))}
          </div>
        </div>
      </motion.section>

      {/* Top Albums */}
      <motion.section variants={sectionAnim} initial="hidden" animate="show">
        <h2 className="text-xl font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <Disc3 className="w-5 h-5 text-primary" /> Meilleurs Albums
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {loadingAlbums
            ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
            : chartAlbums?.slice(0, 6).map((album) => (
                <ContentCard
                  key={album.id}
                  title={album.title}
                  subtitle={album.artist}
                  imageUrl={album.coverUrl}
                  onClick={() => handleAlbumClick(album.id)}
                />
              ))}
        </div>
      </motion.section>

      {/* More Albums */}
      {chartAlbums && chartAlbums.length > 6 && (
        <motion.section variants={sectionAnim} initial="hidden" animate="show">
          <h2 className="text-xl font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" /> À découvrir
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {chartAlbums.slice(6, 12).map((album) => (
              <ContentCard
                key={album.id}
                title={album.title}
                subtitle={album.artist}
                imageUrl={album.coverUrl}
                onClick={() => handleAlbumClick(album.id)}
              />
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
};

export default HomePage;
