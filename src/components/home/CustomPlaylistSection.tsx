import { useQuery } from "@tanstack/react-query";
import { deezerApi } from "@/lib/deezerApi";
import { usePlayerStore } from "@/stores/playerStore";
import { Section } from "@/components/home/Section";
import { CoverCard } from "@/components/home/CoverCard";
import { HorizontalScroll, CoverSkeleton } from "@/components/home/HorizontalScroll";
import type { Song } from "@/data/mockData";

interface Props {
  playlistId: string;
  label: string;
  onPlayTrack: (song: Song, allSongs: Song[]) => void;
}

export function CustomPlaylistSection({ playlistId, label, onPlayTrack }: Props) {
  const { currentSong, isPlaying, play, setQueue } = usePlayerStore();

  const { data: tracks, isLoading } = useQuery({
    queryKey: ["deezer-custom-playlist", playlistId],
    queryFn: () => deezerApi.getPlaylistTracks(playlistId, 20),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <Section
      title={label}
      songs={tracks}
      viewAllLink={`/playlist/dz-${playlistId}`}
      onPlayAll={() => {
        if (tracks?.length) {
          setQueue(tracks);
          play(tracks[0]);
        }
      }}
    >
      <HorizontalScroll>
        {isLoading ? (
          <CoverSkeleton />
        ) : (
          tracks?.map((song, i) => (
            <CoverCard
              key={song.id}
              title={song.title}
              subtitle={song.artist}
              imageUrl={song.coverUrl}
              index={i}
              isActive={currentSong?.id === song.id && isPlaying}
              onClick={() => onPlayTrack(song, tracks)}
            />
          ))
        )}
      </HorizontalScroll>
    </Section>
  );
}
