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
import { Music, Disc3, RefreshCw, Loader2, TrendingUp, User } from "lucide-react";
import { searchArtistImage } from "@/lib/coverArtSearch";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { LazyImage } from "@/components/LazyImage";
import { QuickAccess } from "@/components/home/QuickAccess";
import { useUserHomeLayout } from "@/hooks/useUserHomeLayout";
import { EditModeToggle, EditModePanel } from "@/components/home/EditModeToolbar";

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

  // Top artists by play count
  const userId = usePlayerStore((s) => s.userId);
  const { data: topArtists, isLoading: loadingTopArtists } = useQuery({
    queryKey: ["top-artists", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("recently_played")
        .select("artist, cover_url")
        .eq("user_id", userId)
        .neq("album", "Radio en direct");
      if (error) throw error;
      const counts = new Map<string, { count: number; cover: string }>();
      for (const r of data || []) {
        const existing = counts.get(r.artist);
        if (existing) existing.count++;
        else counts.set(r.artist, { count: 1, cover: r.cover_url || "" });
      }
      return Array.from(counts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([name, { count, cover }]) => ({ name, count, cover }));
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });

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
    artists: { songs: undefined, loading: false },
    albums: { songs: undefined, loading: false },
    top_artists: { songs: undefined, loading: false },
  }), [recentlyAdded, loadingAdded, recentlyListened, loadingListened, mostPlayed, loadingMost, recommended, loadingRecommended]);

  // User-level layout customization (localStorage)
  const adminSections = useMemo(() => {
    if (!homeConfig) return [];
    return [...homeConfig.sections].sort((a, b) => a.order - b.order);
  }, [homeConfig]);

  const {
    editMode,
    setEditMode,
    sections: userSections,
    toggleVisibility,
    reorder,
    resetLayout,
    hasCustomLayout,
  } = useUserHomeLayout(adminSections);

  const visibleSections = useMemo(() => {
    return userSections.filter((s) => s.visible);
  }, [userSections]);

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

      <QuickAccess />

      <div className="mt-3" />

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

        // Top Artists bubbles section
        if (section.id === "top_artists") {
          if (!loadingTopArtists && (!topArtists || topArtists.length === 0)) return null;
          return (
            <Section key={section.id} title={section.title}>
              <div className="px-4 md:px-8">
                {loadingTopArtists ? (
                  <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 pt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                        <div className="w-[64px] h-[64px] rounded-full bg-secondary/40 animate-pulse" />
                        <div className="w-10 h-2.5 rounded bg-secondary/40 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-3 pt-1">
                    {topArtists?.map((artist, i) => (
                      <TopArtistBubble key={artist.name} artist={artist} index={i} navigate={navigate} />
                    ))}
                  </div>
                )}
              </div>
            </Section>
          );
        }

        // Artists section
        if (section.id === "artists") {
          if (!loadingArtists && (!artists || artists.length === 0)) return null;
          return (
            <Section
              key={section.id}
              title={section.title}
              action={isAdmin ? (
                <button
                  onClick={async () => {
                    if (refreshingArtists) return;
                    setRefreshingArtists(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("refresh-artist-images", {
                        body: { only_missing: false, force_refresh: true },
                      });
                      if (error) throw error;
                      queryClient.invalidateQueries({ queryKey: ["custom-artist-image"] });
                      queryClient.invalidateQueries({ queryKey: ["artist-image"] });
                      queryClient.invalidateQueries({ queryKey: ["home-artists"] });
                      toast.success(`${data.updated} photo${data.updated > 1 ? "s" : ""} artiste${data.updated > 1 ? "s" : ""} mise${data.updated > 1 ? "s" : ""} à jour`);
                    } catch (e) {
                      toast.error("Erreur lors du rafraîchissement");
                    } finally {
                      setRefreshingArtists(false);
                    }
                  }}
                  disabled={refreshingArtists}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {refreshingArtists ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {refreshingArtists ? "Refresh…" : "Refresh photos"}
                </button>
              ) : undefined}
            >
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
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="px-4 md:px-8 py-20 text-center"
        >
          <div className="w-24 h-24 rounded-3xl liquid-glass flex items-center justify-center mx-auto mb-5 glow-primary">
            <Music className="w-11 h-11 text-primary/50" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Aucune musique pour le moment</h2>
          <p className="text-sm text-muted-foreground/70 max-w-sm mx-auto leading-relaxed">
            L'administrateur n'a pas encore ajouté de morceaux. Revenez bientôt !
          </p>
        </motion.div>
      )}
      {/* Edit mode UI */}
      <EditModeToggle editMode={editMode} onToggle={() => setEditMode(!editMode)} />
      <AnimatePresence>
        {editMode && (
          <EditModePanel
            sections={userSections}
            onToggleVisibility={toggleVisibility}
            onMoveUp={(i) => i > 0 && reorder(i, i - 1)}
            onMoveDown={(i) => i < userSections.length - 1 && reorder(i, i + 1)}
            onReset={resetLayout}
            hasCustomLayout={hasCustomLayout}
            onClose={() => setEditMode(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
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

/** Top artist bubble with rank badge, play count, and artist photo */
function TopArtistBubble({ artist, index, navigate }: { artist: { name: string; count: number; cover: string }; index: number; navigate: ReturnType<typeof useNavigate> }) {
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

  const imageUrl = customImage || deezerImage || artist.cover;
  const isTop3 = index < 3;
  const size = isTop3 ? "w-[68px] h-[68px]" : "w-[58px] h-[58px]";
  const ringColor = index === 0
    ? "ring-yellow-400/60"
    : index === 1
    ? "ring-gray-300/60"
    : index === 2
    ? "ring-amber-600/50"
    : "ring-border/40";

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 220, damping: 20 }}
      onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
      className="flex flex-col items-center gap-1 flex-shrink-0 group"
    >
      <div className="relative">
        <div className={`${size} rounded-full overflow-hidden ring-[1.5px] ${ringColor} transition-transform group-hover:scale-105 group-active:scale-95`}>
          {imageUrl ? (
            <LazyImage src={imageUrl} alt={artist.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <User className="w-1/3 h-1/3 text-primary/35" />
            </div>
          )}
        </div>
        {/* Rank badge */}
        <div
          className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black ${
            index === 0
              ? "bg-yellow-400 text-yellow-950"
              : index === 1
              ? "bg-gray-200 text-gray-700"
              : index === 2
              ? "bg-amber-600 text-amber-50"
              : "bg-secondary text-secondary-foreground border border-border/50"
          }`}
        >
          {index + 1}
        </div>
      </div>
      <div className="text-center max-w-[68px]">
        <p className="text-[10px] font-bold text-foreground truncate leading-tight">{artist.name}</p>
        <p className="text-[8px] text-muted-foreground/60 font-medium">{artist.count} écoute{artist.count > 1 ? "s" : ""}</p>
      </div>
    </motion.button>
  );
}

export default HomePage;
