import { useQuery } from "@tanstack/react-query";
import { deezerApi } from "@/lib/deezerApi";
import { jiosaavnApi } from "@/lib/jiosaavnApi";
import { usePlayerStore } from "@/stores/playerStore";
import { SongCard, SongSkeleton } from "@/components/MusicCards";
import { motion } from "framer-motion";
import { Play, Pause, ChevronRight } from "lucide-react";
import type { Song } from "@/data/mockData";
import { musicDb } from "@/lib/musicDb";
import { ANONYMOUS_USER_ID } from "@/lib/constants";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

const HomePage = () => {
  const { play, setQueue, currentSong, isPlaying, togglePlay } = usePlayerStore();

  const { data: chartTracks, isLoading: loadingTracks } = useQuery({
    queryKey: ["jiosaavn-chart-tracks"],
    queryFn: () => jiosaavnApi.getCharts(20),
    staleTime: 10 * 60 * 1000,
  });

  const { data: chartAlbums, isLoading: loadingAlbums } = useQuery({
    queryKey: ["deezer-chart-albums"],
    queryFn: () => deezerApi.getChartAlbums(20),
    staleTime: 5 * 60 * 1000,
  });

  const { data: recentlyPlayed = [] } = useQuery({
    queryKey: ["recently-played"],
    queryFn: () => musicDb.getRecentlyPlayed(ANONYMOUS_USER_ID, 10),
    staleTime: 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const handlePlayTrack = (song: Song, allSongs: Song[]) => {
    if (currentSong?.id === song.id) {
      togglePlay();
      return;
    }
    setQueue(allSongs);
    play(song);
  };

  const handleAlbumClick = async (albumId: string) => {
    try {
      const { tracks } = await deezerApi.getAlbumTracks(albumId);
      if (tracks.length > 0) {
        const resolved = await deezerApi.resolveFullStreams(tracks);
        setQueue(resolved);
        play(resolved[0]);
      }
    } catch (e) {
      console.error("Failed to load album tracks", e);
    }
  };

  return (
    <div className="pb-32 max-w-7xl mx-auto">
      {/* ─── Greeting header ─── */}
      <div className="px-4 md:px-8 pt-6 pb-4">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl md:text-3xl font-display font-bold text-foreground"
        >
          {getGreeting()} 👋
        </motion.h1>
      </div>

      {/* ─── Quick-access grid (Spotify-style) — recently played ─── */}
      {recentlyPlayed.length > 0 && (
        <div className="px-4 md:px-8 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {recentlyPlayed.slice(0, 8).map((song, i) => {
              const isActive = currentSong?.id === song.id;
              return (
                <motion.button
                  key={song.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handlePlayTrack(song, recentlyPlayed)}
                  className={`flex items-center gap-3 rounded-md overflow-hidden text-left transition-colors group ${
                    isActive ? "bg-primary/15" : "bg-secondary/60 hover:bg-secondary"
                  }`}
                >
                  <img
                    src={song.coverUrl}
                    alt={song.title}
                    className="w-12 h-12 object-cover flex-shrink-0"
                  />
                  <span className={`text-[13px] font-semibold truncate pr-2 flex-1 ${
                    isActive ? "text-primary" : "text-foreground"
                  }`}>
                    {song.title}
                  </span>
                  <div className={`pr-3 transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                    {isActive && isPlaying ? (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
                        <Pause className="w-4 h-4 text-primary-foreground" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
                        <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
                      </div>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Tendances — horizontal scroll (Deezer Flow style) ─── */}
      <Section title="Tendances du moment">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-2">
          {loadingTracks
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-40 animate-pulse">
                  <div className="w-40 h-40 rounded-xl bg-secondary mb-2" />
                  <div className="h-3.5 w-28 bg-secondary rounded mb-1" />
                  <div className="h-3 w-20 bg-secondary rounded" />
                </div>
              ))
            : chartTracks?.map((song, i) => (
                <CoverCard
                  key={song.id}
                  title={song.title}
                  subtitle={song.artist}
                  imageUrl={song.coverUrl}
                  index={i}
                  isActive={currentSong?.id === song.id && isPlaying}
                  onClick={() => handlePlayTrack(song, chartTracks)}
                />
              ))}
        </div>
      </Section>

      {/* ─── Top Albums — horizontal scroll ─── */}
      <Section title="Meilleurs Albums">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-2">
          {loadingAlbums
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-44 animate-pulse">
                  <div className="w-44 h-44 rounded-xl bg-secondary mb-2" />
                  <div className="h-3.5 w-32 bg-secondary rounded mb-1" />
                  <div className="h-3 w-20 bg-secondary rounded" />
                </div>
              ))
            : chartAlbums?.slice(0, 10).map((album, i) => (
                <CoverCard
                  key={album.id}
                  title={album.title}
                  subtitle={album.artist}
                  imageUrl={album.coverUrl}
                  index={i}
                  size="lg"
                  onClick={() => handleAlbumClick(album.id)}
                />
              ))}
        </div>
      </Section>

      {/* ─── Top 10 Chart list ─── */}
      <Section title="Top 10">
        <div className="px-4 md:px-8">
          <div className="rounded-xl bg-secondary/30 overflow-hidden">
            {loadingTracks
              ? Array.from({ length: 10 }).map((_, i) => <SongSkeleton key={i} />)
              : chartTracks?.slice(0, 10).map((song, i) => (
                  <div key={song.id} onClick={() => handlePlayTrack(song, chartTracks!)}>
                    <SongCard song={song} index={i} showIndex />
                  </div>
                ))}
          </div>
        </div>
      </Section>

      {/* ─── À découvrir — albums grid ─── */}
      {chartAlbums && chartAlbums.length > 10 && (
        <Section title="À découvrir">
          <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-2">
            {chartAlbums.slice(10).map((album, i) => (
              <CoverCard
                key={album.id}
                title={album.title}
                subtitle={album.artist}
                imageUrl={album.coverUrl}
                index={i}
                onClick={() => handleAlbumClick(album.id)}
              />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

/* ─── Section wrapper ─── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <div className="flex items-center justify-between px-4 md:px-8 mb-3">
        <h2 className="text-lg md:text-xl font-display font-bold text-foreground">{title}</h2>
        <button className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5">
          Tout voir <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      {children}
    </motion.section>
  );
}

/* ─── Cover card (horizontal scroll item) ─── */
function CoverCard({
  title, subtitle, imageUrl, index = 0, size = "md", isActive = false, onClick,
}: {
  title: string;
  subtitle: string;
  imageUrl: string;
  index?: number;
  size?: "md" | "lg";
  isActive?: boolean;
  onClick?: () => void;
}) {
  const w = size === "lg" ? "w-44" : "w-40";
  const imgSize = size === "lg" ? "w-44 h-44" : "w-40 h-40";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`flex-shrink-0 ${w} cursor-pointer group`}
      onClick={onClick}
    >
      <div className={`relative ${imgSize} rounded-xl overflow-hidden mb-2 bg-secondary`}>
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-colors" />
        <div className={`absolute bottom-2 right-2 w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-xl transition-all ${
          isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0"
        }`}>
          {isActive ? (
            <Pause className="w-4 h-4 text-primary-foreground" />
          ) : (
            <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
          )}
        </div>
      </div>
      <h3 className={`text-sm font-semibold truncate ${isActive ? "text-primary" : "text-foreground"}`}>{title}</h3>
      <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
    </motion.div>
  );
}

export default HomePage;
