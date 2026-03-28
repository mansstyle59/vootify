import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "@/stores/playerStore";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Music, Disc3, RefreshCw, Loader2 } from "lucide-react";
import { searchArtistImage } from "@/lib/coverArtSearch";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "sonner";

/** Fetch songs by their custom_songs UUIDs */
function useCustomSectionSongs(songIds: string[]) {
  return useQuery({
    queryKey: ["custom-section-songs", songIds],
    queryFn: async (): Promise<Song[]> => {
      if (songIds.length === 0) return [];
      const { data, error } = await supabase
        .from("custom_songs")
        .select("*")
        .in("id", songIds);
      if (error) throw error;
      // Preserve the order from songIds
      const map = new Map((data || []).map((r) => [r.id, r]));
      return songIds
        .map((id) => map.get(id))
        .filter(Boolean)
        .map((r: any) => ({
          id: `custom-${r.id}`,
          title: r.title,
          artist: r.artist,
          album: r.album || "",
          duration: r.duration || 0,
          coverUrl: r.cover_url || "",
          streamUrl: r.stream_url || "",
          liked: false,
        }));
    },
    enabled: songIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });
}

const HomePage = () => {
  const navigate = useNavigate();
  const { play, setQueue, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const { data: homeConfig } = useHomeConfig();
  const { isAdmin } = useAdminAuth();
  const queryClient = useQueryClient();
  const [refreshingArtists, setRefreshingArtists] = useState(false);

  // Fetch unique artists with cover images
  const { data: artists, isLoading: loadingArtists } = useQuery({
    queryKey: ["home-artists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_songs")
        .select("artist, cover_url, created_at")
        .not("stream_url", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Keep order by most recent song per artist
      const artistMap = new Map<string, { cover: string; latestAt: string }>();
      for (const row of data || []) {
        if (!artistMap.has(row.artist)) {
          artistMap.set(row.artist, { cover: row.cover_url || "", latestAt: row.created_at });
        }
      }
      return Array.from(artistMap.entries())
        .sort((a, b) => new Date(b[1].latestAt).getTime() - new Date(a[1].latestAt).getTime())
        .map(([name, { cover }]) => ({ name, cover }));
    },
    staleTime: 2 * 60 * 1000,
  });

  // Fetch albums
  const { data: albums, isLoading: loadingAlbums } = useQuery({
    queryKey: ["home-albums"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_albums")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: recentlyAdded, isLoading: loadingAdded } = useRecentlyAdded(20);
  const { data: recentlyListened, isLoading: loadingListened } = useRecentlyListened(20);
  const { data: mostPlayed, isLoading: loadingMost } = useMostPlayed(20);
  const { data: recommended, isLoading: loadingRecommended } = useRecommended(20);

  // Gather all custom section song IDs for batch fetching
  const allCustomSongIds = useMemo(() => {
    if (!homeConfig?.customSections) return [];
    return [...new Set(homeConfig.customSections.flatMap((c) => c.songIds))];
  }, [homeConfig?.customSections]);

  const { data: customSongsData, isLoading: loadingCustomSongs } = useQuery({
    queryKey: ["all-custom-section-songs", allCustomSongIds],
    queryFn: async (): Promise<Map<string, Song>> => {
      if (allCustomSongIds.length === 0) return new Map();
      const { data, error } = await supabase
        .from("custom_songs")
        .select("*")
        .in("id", allCustomSongIds);
      if (error) throw error;
      const map = new Map<string, Song>();
      for (const r of data || []) {
        map.set(r.id, {
          id: `custom-${r.id}`,
          title: r.title,
          artist: r.artist,
          album: r.album || "",
          duration: r.duration || 0,
          coverUrl: r.cover_url || "",
          streamUrl: r.stream_url || "",
          liked: false,
        });
      }
      return map;
    },
    enabled: allCustomSongIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });

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

  const builtinDataMap: Record<string, { songs: Song[] | undefined; loading: boolean }> = useMemo(() => ({
    recently_added: { songs: recentlyAdded, loading: loadingAdded },
    recently_listened: { songs: recentlyListened, loading: loadingListened },
    most_played: { songs: mostPlayed, loading: loadingMost },
    recommended: { songs: recommended, loading: loadingRecommended },
    artists: { songs: undefined, loading: false }, // special rendering
    albums: { songs: undefined, loading: false },  // special rendering
  }), [recentlyAdded, loadingAdded, recentlyListened, loadingListened, mostPlayed, loadingMost, recommended, loadingRecommended]);

  const visibleSections = useMemo(() => {
    if (!homeConfig) return [];
    return [...homeConfig.sections]
      .filter((s) => s.visible)
      .sort((a, b) => a.order - b.order);
  }, [homeConfig]);

  const getCustomSectionSongs = useCallback((sectionId: string): Song[] => {
    if (!homeConfig?.customSections || !customSongsData) return [];
    const cs = homeConfig.customSections.find((c) => c.id === sectionId);
    if (!cs) return [];
    return cs.songIds
      .map((id) => customSongsData.get(id))
      .filter(Boolean) as Song[];
  }, [homeConfig?.customSections, customSongsData]);

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
                showPlay
              />
            ))
          )}
        </HorizontalScroll>
      </Section>
    );
  };

  return (
    <div className="pb-32 md:pb-40 max-w-7xl mx-auto relative overflow-y-auto">
      <HeroBanner customSubtitle={homeConfig?.heroSubtitle} bgColor={homeConfig?.heroBgColor} bgImage={homeConfig?.heroBgImage} />

      {visibleSections.map((section) => {
        const isCustom = section.id.startsWith("custom_");
        if (isCustom) {
          const songs = getCustomSectionSongs(section.id);
          return (
            <div key={section.id}>
              {renderSection(section.title, songs, loadingCustomSongs)}
            </div>
          );
        }

        // Artists section
        if (section.id === "artists") {
          if (!loadingArtists && (!artists || artists.length === 0)) return null;
          return (
            <Section key={section.id} title={section.title}>
              <HorizontalScroll>
                {loadingArtists ? (
                  <CoverSkeleton count={6} />
                ) : (
                  artists?.map((artist, i) => (
                    <ArtistCoverCard key={artist.name} artist={artist} index={i} navigate={navigate} />
                  ))
                )}
              </HorizontalScroll>
            </Section>
          );
        }

        // Albums section
        if (section.id === "albums") {
          if (!loadingAlbums && (!albums || albums.length === 0)) return null;
          return (
            <Section key={section.id} title={section.title}>
              <HorizontalScroll>
                {loadingAlbums ? (
                  <CoverSkeleton count={6} />
                ) : (
                  albums?.map((album, i) => (
                    <CoverCard
                      key={album.id}
                      title={album.title}
                      subtitle={album.artist}
                      imageUrl={album.cover_url || ""}
                      index={i}
                      onClick={() => navigate(`/album/${album.id}`)}
                    />
                  ))
                )}
              </HorizontalScroll>
            </Section>
          );
        }

        const data = builtinDataMap[section.id];
        if (!data) return null;
        return (
          <div key={section.id}>
            {renderSection(section.title, data.songs, data.loading)}
          </div>
        );
      })}
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

/** Artist card that fetches real Deezer photo, with custom image priority */
function ArtistCoverCard({ artist, index, navigate }: { artist: { name: string; cover: string }; index: number; navigate: ReturnType<typeof useNavigate> }) {
  const { data: customImage } = useQuery({
    queryKey: ["custom-artist-image", artist.name],
    queryFn: async () => {
      const { data } = await supabase.from("artist_images").select("image_url").eq("artist_name", artist.name).maybeSingle();
      return data?.image_url || null;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
  const { data: deezerImage } = useQuery({
    queryKey: ["artist-image", artist.name],
    queryFn: () => searchArtistImage(artist.name),
    staleTime: 24 * 60 * 60 * 1000,
    enabled: !customImage,
  });

  return (
    <CoverCard
      title={artist.name}
      subtitle=""
      imageUrl={customImage || deezerImage || artist.cover}
      index={index}
      rounded
      onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
    />
  );
}

export default HomePage;
