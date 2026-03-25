import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deezerApi } from "@/lib/deezerApi";
import { usePlayerStore } from "@/stores/playerStore";
import { SongSkeleton } from "@/components/MusicCards";
import { motion } from "framer-motion";
import type { Song } from "@/data/mockData";
import { Section } from "@/components/home/Section";
import { CoverCard } from "@/components/home/CoverCard";
import { HorizontalScroll, CoverSkeleton } from "@/components/home/HorizontalScroll";
import { HeroBanner } from "@/components/home/HeroBanner";
import { TopChartCard } from "@/components/home/TopChartCard";
import { HomeCustomizer, type HomeSection } from "@/components/home/HomeCustomizer";
import { CustomPlaylistSection } from "@/components/home/CustomPlaylistSection";
import { useGlobalHomeConfig } from "@/hooks/useGlobalHomeConfig";
import { useAdminAuth } from "@/hooks/useAdminAuth";

const PLAYLISTS = {
  titresDuMoment: "53362031",
  rapstars: "3272614282",
  popHits: "1996494362",
  chillVibes: "1362516565",
  afrobeats: "6460178564",
} as const;

type TopGenre = "all" | "rap" | "pop" | "chill" | "afro";

const TOP_TABS: { key: TopGenre; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "rap", label: "Rap" },
  { key: "pop", label: "Pop" },
  { key: "chill", label: "Chill" },
  { key: "afro", label: "Afro" },
];

const HomePage = () => {
  const { play, setQueue, currentSong, isPlaying, togglePlay, likedSongs } = usePlayerStore();
  const [topGenre, setTopGenre] = useState<TopGenre>("all");
  const { isAdmin } = useAdminAuth();
  const { sections, saveConfig } = useGlobalHomeConfig();
  const [localSections, setLocalSections] = useState<HomeSection[] | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const queryClient = useQueryClient();

  // Refresh on app visibility change (returning to app)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [queryClient]);

  // Use local override while customizer is open, otherwise DB config
  const activeSections = localSections ?? sections;

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

  const handlePlayTrack = async (song: Song, allSongs: Song[]) => {
    if (currentSong?.id === song.id) {
      togglePlay();
      return;
    }
    const resolved = await deezerApi.resolveFullStream(song);
    setQueue(allSongs);
    play(resolved);
  };

  const filterFull = (songs?: Song[]) =>
    (songs || []).filter((s) => s.streamUrl && !s.streamUrl.includes("dzcdn.net"));

  const getTopSongs = (): { songs: Song[]; loading: boolean; source: Song[] } => {
    switch (topGenre) {
      case "rap": return { songs: filterFull(rapstars).slice(0, 10), loading: loadingRap, source: rapstars || [] };
      case "pop": return { songs: filterFull(popHits).slice(0, 10), loading: loadingPop, source: popHits || [] };
      case "chill": return { songs: filterFull(chillVibes).slice(0, 10), loading: loadingChill, source: chillVibes || [] };
      case "afro": return { songs: filterFull(afrobeats).slice(0, 10), loading: loadingAfro, source: afrobeats || [] };
      default: return { songs: filterFull(titresDuMoment).slice(0, 10), loading: loadingTitres, source: titresDuMoment || [] };
    }
  };

  const topData = getTopSongs();

  const personalizedMix = (() => {
    const pool = [...likedSongs];
    const seen = new Set<string>();
    const unique = pool.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    const day = new Date().getDate();
    return unique.sort((a, b) => {
      const ha = (a.id.charCodeAt(0) * 31 + day) % 100;
      const hb = (b.id.charCodeAt(0) * 31 + day) % 100;
      return ha - hb;
    }).slice(0, 20);
  })();

  const isVisible = useCallback(
    (id: string) => activeSections.find((s) => s.id === id)?.visible ?? true,
    [activeSections]
  );

  const sectionTitle = (s: HomeSection) => `${s.label} ${s.emoji}`;

  const renderSection = (section: HomeSection) => {
    // Custom Deezer playlist
    if (section.deezerPlaylistId && section.visible) {
      return (
        <CustomPlaylistSection
          key={section.id}
          playlistId={section.deezerPlaylistId}
          label={sectionTitle(section)}
          onPlayTrack={handlePlayTrack}
        />
      );
    }

    switch (section.id) {
      case "pourVous":
        return personalizedMix.length >= 4 && isVisible("pourVous") ? (
          <Section key="pourVous" title={sectionTitle(section)}>
            <HorizontalScroll>
              {personalizedMix.map((song, i) => (
                <CoverCard key={song.id} title={song.title} subtitle={song.artist} imageUrl={song.coverUrl} index={i} isActive={currentSong?.id === song.id && isPlaying} onClick={() => handlePlayTrack(song, personalizedMix)} />
              ))}
            </HorizontalScroll>
          </Section>
        ) : null;

      case "coupsDeCœur":
        return likedSongs.length > 0 && isVisible("coupsDeCœur") ? (
          <Section key="coupsDeCœur" title={sectionTitle(section)}>
            <HorizontalScroll>
              {likedSongs.slice(0, 20).map((song, i) => (
                <CoverCard key={song.id} title={song.title} subtitle={song.artist} imageUrl={song.coverUrl} index={i} isActive={currentSong?.id === song.id && isPlaying} onClick={() => handlePlayTrack(song, likedSongs)} />
              ))}
            </HorizontalScroll>
          </Section>
        ) : null;

      case "titresDuMoment":
        return isVisible("titresDuMoment") ? (
          <Section key="titresDuMoment" title={sectionTitle(section)}>
            <HorizontalScroll>
              {loadingTitres ? <CoverSkeleton /> : titresDuMoment?.map((song, i) => (
                <CoverCard key={song.id} title={song.title} subtitle={song.artist} imageUrl={song.coverUrl} index={i} isActive={currentSong?.id === song.id && isPlaying} onClick={() => handlePlayTrack(song, titresDuMoment)} />
              ))}
            </HorizontalScroll>
          </Section>
        ) : null;

      case "popHits":
        return isVisible("popHits") ? (
          <Section key="popHits" title={sectionTitle(section)}>
            <HorizontalScroll>
              {loadingPop ? <CoverSkeleton /> : popHits?.map((song, i) => (
                <CoverCard key={song.id} title={song.title} subtitle={song.artist} imageUrl={song.coverUrl} index={i} isActive={currentSong?.id === song.id && isPlaying} onClick={() => handlePlayTrack(song, popHits)} />
              ))}
            </HorizontalScroll>
          </Section>
        ) : null;

      case "rapstars":
        return isVisible("rapstars") ? (
          <Section key="rapstars" title={sectionTitle(section)}>
            <HorizontalScroll>
              {loadingRap ? <CoverSkeleton /> : rapstars?.map((song, i) => (
                <CoverCard key={song.id} title={song.title} subtitle={song.artist} imageUrl={song.coverUrl} index={i} isActive={currentSong?.id === song.id && isPlaying} onClick={() => handlePlayTrack(song, rapstars)} />
              ))}
            </HorizontalScroll>
          </Section>
        ) : null;

      case "chillVibes":
        return isVisible("chillVibes") ? (
          <Section key="chillVibes" title={sectionTitle(section)}>
            <HorizontalScroll>
              {loadingChill ? <CoverSkeleton /> : chillVibes?.map((song, i) => (
                <CoverCard key={song.id} title={song.title} subtitle={song.artist} imageUrl={song.coverUrl} index={i} isActive={currentSong?.id === song.id && isPlaying} onClick={() => handlePlayTrack(song, chillVibes)} />
              ))}
            </HorizontalScroll>
          </Section>
        ) : null;

      case "afrobeats":
        return isVisible("afrobeats") ? (
          <Section key="afrobeats" title={sectionTitle(section)}>
            <HorizontalScroll>
              {loadingAfro ? <CoverSkeleton /> : afrobeats?.map((song, i) => (
                <CoverCard key={song.id} title={song.title} subtitle={song.artist} imageUrl={song.coverUrl} index={i} isActive={currentSong?.id === song.id && isPlaying} onClick={() => handlePlayTrack(song, afrobeats)} />
              ))}
            </HorizontalScroll>
          </Section>
        ) : null;

      case "top10":
        return isVisible("top10") ? (
          <Section key="top10" title={sectionTitle(section)}>
            <div className="px-4 md:px-8">
              <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-hide pb-1">
                {TOP_TABS.map(({ key, label }) => (
                  <button key={key} onClick={() => setTopGenre(key)} className={`relative px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors duration-200 flex-shrink-0 ${topGenre === key ? "text-primary-foreground" : "bg-secondary/80 text-secondary-foreground hover:bg-secondary"}`}>
                    {topGenre === key && (
                      <motion.div layoutId="topTabIndicator" className="absolute inset-0 bg-primary rounded-full shadow-md shadow-primary/25" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                    )}
                    <span className="relative z-10">{label}</span>
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={topGenre} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25, ease: "easeInOut" }} className="rounded-xl bg-secondary/20 border border-border/50 overflow-hidden divide-y divide-border/30">
                  {topData.loading
                    ? Array.from({ length: 10 }).map((_, i) => <SongSkeleton key={i} />)
                    : topData.songs.map((song, i) => (
                        <TopChartCard key={song.id} song={song} rank={i + 1} onClick={() => handlePlayTrack(song, topData.source)} />
                      ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </Section>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div className="pb-40 max-w-7xl mx-auto relative overflow-y-auto">
      <HeroBanner onCustomize={isAdmin ? () => setShowCustomizer(true) : undefined} />

      {activeSections.map((s) => renderSection(s))}

      {isAdmin && (
        <HomeCustomizer
          open={showCustomizer}
          onClose={() => {
            setShowCustomizer(false);
            setLocalSections(null);
          }}
          onSave={async (newSections) => {
            setLocalSections(newSections);
            try {
              await saveConfig(newSections);
              toast.success("Personnalisation sauvegardée ✨");
            } catch (err) {
              toast.error("Erreur lors de la sauvegarde");
            }
            setLocalSections(null);
          }}
          current={activeSections}
        />
      )}
    </div>
  );
};

export default HomePage;
