import { useCallback, useEffect, useState } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import type { Song } from "@/data/mockData";
import { Section } from "@/components/home/Section";
import { CoverCard } from "@/components/home/CoverCard";
import { HorizontalScroll, CoverSkeleton } from "@/components/home/HorizontalScroll";
import { HeroBanner } from "@/components/home/HeroBanner";
import {
  useRecentlyAdded,
  useRecentlyListened,
  useMostPlayed,
  useRecommended,
} from "@/hooks/useLocalSections";
import { deezerApi } from "@/lib/deezerApi";
import { Clock, Flame, Sparkles, Music, Globe } from "lucide-react";

const HomePage = () => {
  const { play, setQueue, currentSong, isPlaying, togglePlay } = usePlayerStore();

  const { data: recentlyAdded, isLoading: loadingAdded } = useRecentlyAdded(20);
  const { data: recentlyListened, isLoading: loadingListened } = useRecentlyListened(20);
  const { data: mostPlayed, isLoading: loadingMost } = useMostPlayed(20);
  const { data: recommended, isLoading: loadingRecommended } = useRecommended(20);

  // Deezer chart tracks
  const [deezerChart, setDeezerChart] = useState<Song[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);

  useEffect(() => {
    deezerApi.getChartTracks(20)
      .then(setDeezerChart)
      .catch(() => setDeezerChart([]))
      .finally(() => setLoadingChart(false));
  }, []);

  const handlePlayTrack = useCallback(
    (song: Song, allSongs: Song[]) => {
      if (currentSong?.id === song.id) {
        togglePlay();
        return;
      }
      setQueue(allSongs);
      play(song);
    },
    [currentSong?.id, togglePlay, setQueue, play]
  );

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    songs: Song[] | undefined,
    loading: boolean
  ) => {
    if (!loading && (!songs || songs.length === 0)) return null;

    return (
      <Section
        title={title}
        songs={songs}
        onPlayAll={
          songs && songs.length > 0
            ? () => {
                setQueue(songs);
                play(songs[0]);
              }
            : undefined
        }
      >
        <HorizontalScroll>
          {loading ? (
            <CoverSkeleton count={6} />
          ) : (
            songs?.map((song, i) => (
              <CoverCard
                key={song.id}
                title={song.title}
                subtitle={song.artist}
                imageUrl={song.coverUrl}
                index={i}
                isActive={currentSong?.id === song.id && isPlaying}
                onClick={() => handlePlayTrack(song, songs)}
              />
            ))
          )}
        </HorizontalScroll>
      </Section>
    );
  };

  return (
    <div className="pb-40 max-w-7xl mx-auto relative overflow-y-auto">
      <HeroBanner />

      {renderSection("Ajoutés récemment 🆕", <Music className="w-4 h-4" />, recentlyAdded, loadingAdded)}
      {renderSection("Écoutés récemment 🕐", <Clock className="w-4 h-4" />, recentlyListened, loadingListened)}
      {renderSection("Les plus écoutés 🔥", <Flame className="w-4 h-4" />, mostPlayed, loadingMost)}
      {renderSection("Recommandés pour vous ✨", <Sparkles className="w-4 h-4" />, recommended, loadingRecommended)}

      {/* Deezer trending section */}
      {renderSection(
        "Tendances Deezer 🌍",
        <Globe className="w-4 h-4" />,
        deezerChart,
        loadingChart
      )}

      {/* Empty state */}
      {!loadingAdded && (!recentlyAdded || recentlyAdded.length === 0) && !loadingChart && deezerChart.length === 0 && (
        <div className="px-4 md:px-8 py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Music className="w-10 h-10 text-primary/40" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Aucune musique pour le moment</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            L'administrateur n'a pas encore ajouté de morceaux. Revenez plus tard !
          </p>
        </div>
      )}
    </div>
  );
};

export default HomePage;
