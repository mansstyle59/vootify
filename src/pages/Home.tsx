import { useQuery } from "@tanstack/react-query";
import { deezerApi } from "@/lib/deezerApi";
import { usePlayerStore } from "@/stores/playerStore";
import { ContentCard, SongCard, CardSkeleton, SongSkeleton } from "@/components/MusicCards";
import { motion } from "framer-motion";
import { TrendingUp, Sparkles, Music, AlertCircle } from "lucide-react";
import type { Song } from "@/data/mockData";

const HomePage = () => {
  const { play, setQueue } = usePlayerStore();

  const { data: chartTracks, isLoading: loadingTracks, error: tracksError } = useQuery({
    queryKey: ["deezer-chart-tracks"],
    queryFn: () => deezerApi.getChartTracks(12),
    staleTime: 5 * 60 * 1000,
  });

  const { data: chartAlbums, isLoading: loadingAlbums } = useQuery({
    queryKey: ["deezer-chart-albums"],
    queryFn: () => deezerApi.getChartAlbums(8),
    staleTime: 5 * 60 * 1000,
  });

  const { data: radioStations, isLoading: loadingRadio } = useQuery({
    queryKey: ["deezer-radio"],
    queryFn: () => deezerApi.getRadioStations(),
    staleTime: 10 * 60 * 1000,
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
    <div className="p-4 md:p-8 pb-32 max-w-7xl mx-auto">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-2xl p-6 md:p-10 mb-8 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent" />
        <div className="relative z-10">
          <p className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Propulsé par Deezer
          </p>
          <h1 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-2">
            Découvrez de nouvelles musiques
          </h1>
          <p className="text-muted-foreground max-w-md">
            Explorez les titres tendances, les meilleurs albums et les stations radio.
          </p>
        </div>
      </motion.div>

      {tracksError && (
        <div className="glass-panel-light rounded-xl p-4 mb-8 flex items-center gap-3 text-destructive">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Erreur de chargement. Essayez de rafraîchir la page.</p>
        </div>
      )}

      {/* Chart Albums */}
      <section className="mb-10">
        <h2 className="text-xl font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> Top Albums
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loadingAlbums
            ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
            : chartAlbums?.slice(0, 4).map((album) => (
                <ContentCard
                  key={album.id}
                  title={album.title}
                  subtitle={album.artist}
                  imageUrl={album.coverUrl}
                  onClick={() => handleAlbumClick(album.id)}
                />
              ))}
        </div>
      </section>

      {/* Trending Tracks */}
      <section className="mb-10">
        <h2 className="text-xl font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" /> Trending Now
        </h2>
        <div className="glass-panel-light rounded-xl p-2">
          {loadingTracks
            ? Array.from({ length: 6 }).map((_, i) => <SongSkeleton key={i} />)
            : chartTracks?.slice(0, 8).map((song, i) => (
                <div key={song.id} onClick={() => handlePlayTrack(song, chartTracks)}>
                  <SongCard song={song} index={i} showIndex />
                </div>
              ))}
        </div>
      </section>

      {/* More Albums */}
      {chartAlbums && chartAlbums.length > 4 && (
        <section className="mb-10">
          <h2 className="text-xl font-display font-semibold text-foreground mb-4">More Albums</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {chartAlbums.slice(4, 8).map((album) => (
              <ContentCard
                key={album.id}
                title={album.title}
                subtitle={album.artist}
                imageUrl={album.coverUrl}
                onClick={() => handleAlbumClick(album.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Radio */}
      <section>
        <h2 className="text-xl font-display font-semibold text-foreground mb-4">Radio Stations</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {loadingRadio
            ? Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
            : radioStations?.slice(0, 3).map((station) => (
                <ContentCard
                  key={station.id}
                  title={station.name}
                  subtitle={station.genre}
                  imageUrl={station.coverUrl}
                />
              ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
