import { songs, albums, radioStations } from "@/data/mockData";
import { usePlayerStore } from "@/stores/playerStore";
import { ContentCard, SongCard } from "@/components/MusicCards";
import { motion } from "framer-motion";
import { TrendingUp, Clock, Sparkles } from "lucide-react";

const HomePage = () => {
  const { play, setQueue } = usePlayerStore();

  const featuredAlbums = albums.slice(0, 4);
  const trendingSongs = songs.slice(0, 6);
  const recentMixes = albums.slice(4, 8);

  const handleAlbumPlay = (albumId: string) => {
    const album = albums.find((a) => a.id === albumId);
    if (!album) return;
    const albumSongs = songs.filter((s) => album.songs.includes(s.id));
    if (albumSongs.length > 0) {
      setQueue(albumSongs);
      play(albumSongs[0]);
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
            <Sparkles className="w-4 h-4" /> Featured Today
          </p>
          <h1 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-2">
            Discover New Music
          </h1>
          <p className="text-muted-foreground max-w-md">
            Explore curated playlists, trending tracks, and your personal recommendations.
          </p>
        </div>
      </motion.div>

      {/* Featured Albums */}
      <section className="mb-10">
        <h2 className="text-xl font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> Featured Albums
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {featuredAlbums.map((album) => (
            <ContentCard
              key={album.id}
              title={album.title}
              subtitle={album.artist}
              imageUrl={album.coverUrl}
              onClick={() => handleAlbumPlay(album.id)}
            />
          ))}
        </div>
      </section>

      {/* Trending */}
      <section className="mb-10">
        <h2 className="text-xl font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" /> Trending Now
        </h2>
        <div className="glass-panel-light rounded-xl p-2">
          {trendingSongs.map((song, i) => (
            <SongCard key={song.id} song={song} index={i} showIndex />
          ))}
        </div>
      </section>

      {/* More Albums */}
      <section className="mb-10">
        <h2 className="text-xl font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" /> New Releases
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {recentMixes.map((album) => (
            <ContentCard
              key={album.id}
              title={album.title}
              subtitle={album.artist}
              imageUrl={album.coverUrl}
              onClick={() => handleAlbumPlay(album.id)}
            />
          ))}
        </div>
      </section>

      {/* Quick Radio */}
      <section>
        <h2 className="text-xl font-display font-semibold text-foreground mb-4">Popular Radio</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {radioStations.slice(0, 3).map((station) => (
            <ContentCard
              key={station.id}
              title={station.name}
              subtitle={`${station.genre} • ${(station.listeners / 1000).toFixed(1)}k listeners`}
              imageUrl={station.coverUrl}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
