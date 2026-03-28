import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "@/stores/playerStore";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Song } from "@/data/mockData";
import { Section } from "@/components/home/Section";
import { CoverCard } from "@/components/home/CoverCard";
import { ContentStrip, StripSkeleton } from "@/components/home/ContentStrip";
import { HeroBanner } from "@/components/home/HeroBanner";
import {
  useRecentlyAdded,
  useRecentlyListened,
  useMostPlayed,
  useRecommended,
} from "@/hooks/useLocalSections";
import { useHomeConfig } from "@/hooks/useHomeConfig";
import { Music, RefreshCw, Loader2, User } from "lucide-react";
import { searchArtistImage } from "@/lib/coverArtSearch";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { LazyImage } from "@/components/LazyImage";
import { QuickAccess } from "@/components/home/QuickAccess";
import { useUserHomeLayout } from "@/hooks/useUserHomeLayout";
import { EditModeToggle, EditModePanel } from "@/components/home/EditModeToolbar";

const HomePage = () => {
  const navigate = useNavigate();
  const { play, setQueue, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const { data: homeConfig } = useHomeConfig();
  const { isAdmin } = useAdminAuth();
  const queryClient = useQueryClient();
  const [refreshingArtists, setRefreshingArtists] = useState(false);

  const { data: artists, isLoading: loadingArtists } = useQuery({
    queryKey: ["home-artists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_songs")
        .select("artist, cover_url, created_at")
        .not("stream_url", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
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

  const renderSection = (title: string, songs: Song[] | undefined, loading: boolean) => {
    if (!loading && (!songs || songs.length === 0)) return null;
    return (
      <Section
        title={title}
        songs={songs}
        onPlayAll={
          songs && songs.length > 0
            ? () => { setQueue(songs); play(songs[0]); }
            : undefined
        }
      >
        <ContentStrip>
          {loading ? (
            <StripSkeleton count={6} />
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
        </ContentStrip>
      </Section>
    );
  };

  return (
    <div className="pb-20 max-w-7xl mx-auto">
      <HeroBanner customSubtitle={homeConfig?.heroSubtitle} bgColor={homeConfig?.heroBgColor} bgImage={homeConfig?.heroBgImage} />

      {/* QuickAccess playlists removed */}

      <div className="mt-5" />

      {visibleSections.map((section) => {
        const isCustom = section.id.startsWith("custom_");
        if (isCustom) {
          const songs = getCustomSectionSongs(section.id);
          return <div key={section.id}>{renderSection(section.title, songs, loadingCustomSongs)}</div>;
        }

        if (section.id === "top_artists") {
          if (!loadingTopArtists && (!topArtists || topArtists.length === 0)) return null;
          return (
            <Section key={section.id} title={section.title}>
              <div className="px-5 md:px-9">
                {loadingTopArtists ? (
                  <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-4 pt-2 -mx-1 px-1">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-2.5 flex-shrink-0">
                        <div className="w-[76px] h-[76px] rounded-full animate-pulse" style={{ background: "hsl(var(--foreground) / 0.06)" }} />
                        <div className="w-14 h-2.5 rounded-full animate-pulse" style={{ background: "hsl(var(--foreground) / 0.04)" }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-4 pt-2 -mx-1 px-1">
                    {topArtists?.map((artist, i) => (
                      <TopArtistBubble key={artist.name} artist={artist} index={i} navigate={navigate} />
                    ))}
                    <div className="w-1 flex-shrink-0" />
                  </div>
                )}
              </div>
            </Section>
          );
        }

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
                      toast.success(`${data.updated} photo${data.updated > 1 ? "s" : ""} mise${data.updated > 1 ? "s" : ""} à jour`);
                    } catch {
                      toast.error("Erreur lors du rafraîchissement");
                    } finally {
                      setRefreshingArtists(false);
                    }
                  }}
                  disabled={refreshingArtists}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold active:scale-95 transition-transform disabled:opacity-50"
                  style={{ background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}
                >
                  {refreshingArtists ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {refreshingArtists ? "Refresh…" : "Refresh"}
                </button>
              ) : undefined}
            >
              <ContentStrip>
                {loadingArtists ? (
                  <StripSkeleton count={6} />
                ) : (
                  artists?.map((artist, i) => (
                    <ArtistCoverCard key={artist.name} artist={artist} index={i} navigate={navigate} />
                  ))
                )}
              </ContentStrip>
            </Section>
          );
        }

        if (section.id === "albums") {
          if (!loadingAlbums && (!albums || albums.length === 0)) return null;
          return (
            <Section key={section.id} title={section.title}>
              <ContentStrip>
                {loadingAlbums ? (
                  <StripSkeleton count={6} />
                ) : (
                  albums?.map((album, i) => (
                    <AlbumOverlayCard key={album.id} album={album} index={i} navigate={navigate} />
                  ))
                )}
              </ContentStrip>
            </Section>
          );
        }

        const data = builtinDataMap[section.id];
        if (!data) return null;
        return <div key={section.id}>{renderSection(section.title, data.songs, data.loading)}</div>;
      })}

      {/* Empty state */}
      {!loadingAdded && (!recentlyAdded || recentlyAdded.length === 0) && (
        <div className="px-5 md:px-8 py-24 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "hsl(var(--foreground) / 0.04)" }}
          >
            <Music className="w-7 h-7 text-muted-foreground/20" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1">Aucune musique pour le moment</h2>
          <p className="text-[13px] text-muted-foreground/50 max-w-xs mx-auto">
            L'administrateur n'a pas encore ajouté de morceaux. Revenez bientôt !
          </p>
        </div>
      )}

      {/* Edit mode */}
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
  const [imgLoaded, setImgLoaded] = useState(false);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: "easeOut" }}
      className="flex-shrink-0 w-[140px] md:w-[160px] cursor-pointer group snap-start active:scale-[0.96] transition-transform duration-150"
      onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
    >
      <div
        className="relative w-[140px] h-[140px] md:w-[160px] md:h-[160px] rounded-2xl overflow-hidden mb-2"
        style={{
          boxShadow: "0 4px 20px hsl(0 0% 0% / 0.15), 0 1px 4px hsl(0 0% 0% / 0.08)",
        }}
      >
        {imageUrl ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 overflow-hidden" style={{ background: "hsl(var(--foreground) / 0.06)" }}>
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
              </div>
            )}
            <img
              src={imageUrl}
              alt={artist.name}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              className={`w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "hsl(var(--foreground) / 0.06)" }}>
            <User className="w-10 h-10 text-muted-foreground/20" />
          </div>
        )}
        {/* Shine / glare effect on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: "linear-gradient(105deg, transparent 30%, hsl(0 0% 100% / 0.12) 45%, hsl(0 0% 100% / 0.03) 55%, transparent 70%)",
          }}
        />
        {/* Bottom gradient overlay with name */}
        <div
          className="absolute inset-x-0 bottom-0 h-[55%] flex items-end p-3"
          style={{
            background: "linear-gradient(to top, hsl(0 0% 0% / 0.65) 0%, hsl(0 0% 0% / 0.25) 60%, transparent 100%)",
          }}
        >
          <p className="text-[13px] font-bold text-white leading-tight line-clamp-2 drop-shadow-sm">
            {artist.name}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

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
  const isPodium = index < 3;
  const size = isPodium ? 76 : 64;

  const podiumGradients: Record<number, string> = {
    0: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))",
    1: "linear-gradient(135deg, hsl(var(--primary) / 0.7), hsl(var(--primary) / 0.3))",
    2: "linear-gradient(135deg, hsl(var(--primary) / 0.5), hsl(var(--primary) / 0.2))",
  };

  const podiumGlow: Record<number, string> = {
    0: "0 0 16px hsl(var(--primary) / 0.4), 0 4px 12px hsl(0 0% 0% / 0.15)",
    1: "0 0 12px hsl(var(--primary) / 0.25), 0 4px 10px hsl(0 0% 0% / 0.12)",
    2: "0 0 8px hsl(var(--primary) / 0.15), 0 4px 8px hsl(0 0% 0% / 0.1)",
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: "easeOut" }}
      onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
      className="flex flex-col items-center gap-2 flex-shrink-0 group active:scale-[0.93] transition-transform duration-200"
    >
      <div className="relative">
        {/* Ring glow for podium */}
        {isPodium && (
          <div
            className="absolute -inset-[3px] rounded-full opacity-80 group-hover:opacity-100 transition-opacity"
            style={{ background: podiumGradients[index] }}
          />
        )}
        <div
          className="rounded-full overflow-hidden relative"
          style={{
            width: size,
            height: size,
            boxShadow: isPodium ? podiumGlow[index] : "0 2px 8px hsl(0 0% 0% / 0.1)",
            border: isPodium ? "none" : "2px solid hsl(var(--foreground) / 0.06)",
          }}
        >
          {imageUrl ? (
            <LazyImage src={imageUrl} alt={artist.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: "hsl(var(--foreground) / 0.06)" }}>
              <User className="w-1/3 h-1/3 text-muted-foreground/30" />
            </div>
          )}
        </div>
        {/* Rank badge */}
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 min-w-[20px] h-[20px] rounded-full flex items-center justify-center text-[10px] font-black shadow-lg"
          style={{
            background: isPodium ? podiumGradients[index] : "hsl(var(--foreground) / 0.08)",
            color: isPodium ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground) / 0.5)",
            boxShadow: isPodium
              ? "0 2px 8px hsl(var(--primary) / 0.3)"
              : "0 1px 4px hsl(0 0% 0% / 0.08)",
          }}
        >
          {index + 1}
        </div>
      </div>
      <div className="text-center mt-0.5" style={{ maxWidth: size + 12 }}>
        <p className="text-[11px] font-semibold text-foreground truncate leading-tight">{artist.name}</p>
        <p className="text-[9px] text-muted-foreground/50 mt-0.5">{artist.count} écoute{artist.count > 1 ? "s" : ""}</p>
      </div>
    </motion.button>
  );
}

function AlbumOverlayCard({ album, index, navigate }: { album: { id: string; title: string; artist: string; cover_url: string | null }; index: number; navigate: ReturnType<typeof useNavigate> }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const imageUrl = album.cover_url || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: "easeOut" }}
      className="flex-shrink-0 w-[140px] md:w-[160px] cursor-pointer group snap-start active:scale-[0.96] transition-transform duration-150"
      onClick={() => navigate(`/album/${album.id}`)}
    >
      <div
        className="relative w-[140px] h-[140px] md:w-[160px] md:h-[160px] rounded-2xl overflow-hidden mb-2"
        style={{
          boxShadow: "0 4px 20px hsl(0 0% 0% / 0.15), 0 1px 4px hsl(0 0% 0% / 0.08)",
        }}
      >
        {imageUrl ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 overflow-hidden" style={{ background: "hsl(var(--foreground) / 0.06)" }}>
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
              </div>
            )}
            <img
              src={imageUrl}
              alt={album.title}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              className={`w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "hsl(var(--foreground) / 0.06)" }}>
            <Music className="w-10 h-10 text-muted-foreground/20" />
          </div>
        )}
        {/* Bottom gradient overlay with title & artist */}
        <div
          className="absolute inset-x-0 bottom-0 h-[60%] flex flex-col justify-end p-3"
          style={{
            background: "linear-gradient(to top, hsl(0 0% 0% / 0.7) 0%, hsl(0 0% 0% / 0.3) 55%, transparent 100%)",
          }}
        >
          <p className="text-[13px] font-bold text-white leading-tight line-clamp-2 drop-shadow-sm">
            {album.title}
          </p>
          <p className="text-[11px] text-white/60 truncate mt-0.5 drop-shadow-sm">
            {album.artist}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default HomePage;
