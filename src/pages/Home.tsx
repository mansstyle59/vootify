import { useCallback, useEffect, useState, useMemo } from "react";
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
import { useHomeConfig } from "@/hooks/useHomeConfig";
import { Music } from "lucide-react";

const HomePage = () => {
  const { play, setQueue, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const { data: homeConfig } = useHomeConfig();

  const { data: recentlyAdded, isLoading: loadingAdded } = useRecentlyAdded(20);
  const { data: recentlyListened, isLoading: loadingListened } = useRecentlyListened(20);
  const { data: mostPlayed, isLoading: loadingMost } = useMostPlayed(20);
  const { data: recommended, isLoading: loadingRecommended } = useRecommended(20);

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

  const sectionDataMap: Record<string, { songs: Song[] | undefined; loading: boolean }> = useMemo(() => ({
    recently_added: { songs: recentlyAdded, loading: loadingAdded },
    recently_listened: { songs: recentlyListened, loading: loadingListened },
    most_played: { songs: mostPlayed, loading: loadingMost },
    recommended: { songs: recommended, loading: loadingRecommended },
  }), [recentlyAdded, loadingAdded, recentlyListened, loadingListened, mostPlayed, loadingMost, recommended, loadingRecommended]);

  const visibleSections = useMemo(() => {
    if (!homeConfig) return [];
    return [...homeConfig.sections]
      .filter((s) => s.visible && s.id !== "deezer_chart")
      .sort((a, b) => a.order - b.order);
  }, [homeConfig]);

  const renderSection = (
    title: string,
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
      <HeroBanner customSubtitle={homeConfig?.heroSubtitle} bgColor={homeConfig?.heroBgColor} bgImage={homeConfig?.heroBgImage} />

      {visibleSections.map((section) => {
        const data = sectionDataMap[section.id];
        if (!data) return null;
        return (
          <div key={section.id}>
            {renderSection(section.title, data.songs, data.loading)}
          </div>
        );
      })}

      {/* Empty state */}
      {!loadingAdded && (!recentlyAdded || recentlyAdded.length === 0) && (
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
