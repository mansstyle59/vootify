import { useQuery } from "@tanstack/react-query";
import { deezerApi } from "@/lib/deezerApi";
import { usePlayerStore } from "@/stores/playerStore";
import { SongCard, SongSkeleton } from "@/components/MusicCards";
import { motion } from "framer-motion";
import { Play, Pause } from "lucide-react";
import type { Song } from "@/data/mockData";
import { musicDb } from "@/lib/musicDb";
import { ANONYMOUS_USER_ID } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { Section } from "@/components/home/Section";
import { CoverCard } from "@/components/home/CoverCard";
import { HorizontalScroll, CoverSkeleton } from "@/components/home/HorizontalScroll";
import { HeroBanner } from "@/components/home/HeroBanner";

const PLAYLISTS = {
  titresDuMoment: "53362031",
  rapstars: "3272614282",
  popHits: "1996494362",    // Pop Hits
  chillVibes: "1362516565", // Chill Vibes
  afrobeats: "6460178564",  // Afrobeats
} as const;

const HomePage = () => {
  const { play, setQueue, currentSong, isPlaying, togglePlay, likedSongs } = usePlayerStore();

  const { data: titresDuMoment, isLoading: loadingTitres } = useQuery({
    queryKey: ["deezer-titres-du-moment"],
    queryFn: () => deezerApi.getPlaylistTracks(PLAYLISTS.titresDuMoment, 20),
    staleTime: 10 * 60 * 1000,
  });

  const { data: rapstars, isLoading: loadingRap } = useQuery({
    queryKey: ["deezer-rapstars"],
    queryFn: () => deezerApi.getPlaylistTracks(PLAYLISTS.rapstars, 20),
    staleTime: 10 * 60 * 1000,
  });

  const { data: popHits, isLoading: loadingPop } = useQuery({
    queryKey: ["deezer-pop-hits"],
    queryFn: () => deezerApi.getPlaylistTracks(PLAYLISTS.popHits, 20),
    staleTime: 10 * 60 * 1000,
  });

  const { data: chillVibes, isLoading: loadingChill } = useQuery({
    queryKey: ["deezer-chill-vibes"],
    queryFn: () => deezerApi.getPlaylistTracks(PLAYLISTS.chillVibes, 20),
    staleTime: 10 * 60 * 1000,
  });

  const { data: afrobeats, isLoading: loadingAfro } = useQuery({
    queryKey: ["deezer-afrobeats"],
    queryFn: () => deezerApi.getPlaylistTracks(PLAYLISTS.afrobeats, 20),
    staleTime: 10 * 60 * 1000,
  });

  const { data: recentlyPlayed = [] } = useQuery({
    queryKey: ["recently-played"],
    queryFn: () => musicDb.getRecentlyPlayed(ANONYMOUS_USER_ID, 10),
    staleTime: 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const handlePlayTrack = async (song: Song, allSongs: Song[]) => {
    if (currentSong?.id === song.id) {
      togglePlay();
      return;
    }
    const resolved = await deezerApi.resolveFullStream(song);
    setQueue(allSongs);
    play(resolved);
  };

  return (
    <div className="pb-32 max-w-7xl mx-auto">
      {/* ─── Hero Banner with parallax ─── */}
      <HeroBanner />

      {/* ─── Quick-access — recently played ─── */}
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
                  <img src={song.coverUrl} alt={song.title} className="w-12 h-12 object-cover flex-shrink-0" />
                  <span className={`text-[13px] font-semibold truncate pr-2 flex-1 ${isActive ? "text-primary" : "text-foreground"}`}>
                    {song.title}
                  </span>
                  <div className={`pr-3 transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
                      {isActive && isPlaying ? (
                        <Pause className="w-4 h-4 text-primary-foreground" />
                      ) : (
                        <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Vos coups de cœur ─── */}
      {likedSongs.length > 0 && (
        <Section title="Vos coups de cœur ❤️">
          <HorizontalScroll>
            {likedSongs.slice(0, 20).map((song, i) => (
              <CoverCard
                key={song.id}
                title={song.title}
                subtitle={song.artist}
                imageUrl={song.coverUrl}
                index={i}
                isActive={currentSong?.id === song.id && isPlaying}
                onClick={() => handlePlayTrack(song, likedSongs)}
              />
            ))}
          </HorizontalScroll>
        </Section>
      )}

      {/* ─── Les titres du moment ─── */}
      <Section title="Les titres du moment 🔥">
        <HorizontalScroll>
          {loadingTitres
            ? <CoverSkeleton />
            : titresDuMoment?.map((song, i) => (
                <CoverCard
                  key={song.id}
                  title={song.title}
                  subtitle={song.artist}
                  imageUrl={song.coverUrl}
                  index={i}
                  isActive={currentSong?.id === song.id && isPlaying}
                  onClick={() => handlePlayTrack(song, titresDuMoment)}
                />
              ))}
        </HorizontalScroll>
      </Section>

      {/* ─── Pop Hits ─── */}
      <Section title="Pop Hits 🎤">
        <HorizontalScroll>
          {loadingPop
            ? <CoverSkeleton />
            : popHits?.map((song, i) => (
                <CoverCard
                  key={song.id}
                  title={song.title}
                  subtitle={song.artist}
                  imageUrl={song.coverUrl}
                  index={i}
                  isActive={currentSong?.id === song.id && isPlaying}
                  onClick={() => handlePlayTrack(song, popHits)}
                />
              ))}
        </HorizontalScroll>
      </Section>

      {/* ─── Rapstars ─── */}
      <Section title="Rapstars ⭐">
        <HorizontalScroll>
          {loadingRap
            ? <CoverSkeleton />
            : rapstars?.map((song, i) => (
                <CoverCard
                  key={song.id}
                  title={song.title}
                  subtitle={song.artist}
                  imageUrl={song.coverUrl}
                  index={i}
                  isActive={currentSong?.id === song.id && isPlaying}
                  onClick={() => handlePlayTrack(song, rapstars)}
                />
              ))}
        </HorizontalScroll>
      </Section>

      {/* ─── Chill Vibes ─── */}
      <Section title="Chill & Détente 🌙">
        <HorizontalScroll>
          {loadingChill
            ? <CoverSkeleton />
            : chillVibes?.map((song, i) => (
                <CoverCard
                  key={song.id}
                  title={song.title}
                  subtitle={song.artist}
                  imageUrl={song.coverUrl}
                  index={i}
                  isActive={currentSong?.id === song.id && isPlaying}
                  onClick={() => handlePlayTrack(song, chillVibes)}
                />
              ))}
        </HorizontalScroll>
      </Section>

      {/* ─── Afrobeats ─── */}
      <Section title="Afrobeats 🌍">
        <HorizontalScroll>
          {loadingAfro
            ? <CoverSkeleton />
            : afrobeats?.map((song, i) => (
                <CoverCard
                  key={song.id}
                  title={song.title}
                  subtitle={song.artist}
                  imageUrl={song.coverUrl}
                  index={i}
                  isActive={currentSong?.id === song.id && isPlaying}
                  onClick={() => handlePlayTrack(song, afrobeats)}
                />
              ))}
        </HorizontalScroll>
      </Section>

      {/* ─── Top 10 ─── */}
      <Section title="Top 10 🏆">
        <div className="px-4 md:px-8">
          <div className="rounded-xl bg-secondary/30 overflow-hidden">
            {loadingTitres
              ? Array.from({ length: 10 }).map((_, i) => <SongSkeleton key={i} />)
              : titresDuMoment
                  ?.filter((s) => s.streamUrl && !s.streamUrl.includes("dzcdn.net"))
                  .slice(0, 10)
                  .map((song, i) => (
                    <div key={song.id} onClick={() => handlePlayTrack(song, titresDuMoment!)}>
                      <SongCard song={song} index={i} showIndex />
                    </div>
                  ))}
          </div>
        </div>
      </Section>
    </div>
  );
};

export default HomePage;
