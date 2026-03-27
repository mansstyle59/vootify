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

const HomePage = () => {
  const { play, setQueue, currentSong, isPlaying, togglePlay, likedSongs } = usePlayerStore();
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

  const handlePlayTrack = async (song: Song, allSongs: Song[]) => {
    if (currentSong?.id === song.id) {
      togglePlay();
      return;
    }
    const resolved = await deezerApi.resolveFullStream(song);
    setQueue(allSongs);
    play(resolved);
  };

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
          <Section key="pourVous" title={sectionTitle(section)} songs={personalizedMix} onPlayAll={() => { setQueue(personalizedMix); play(personalizedMix[0]); }} viewAllLink="/library">
            <HorizontalScroll>
              {personalizedMix.map((song, i) => (
                <CoverCard key={song.id} title={song.title} subtitle={song.artist} imageUrl={song.coverUrl} index={i} isActive={currentSong?.id === song.id && isPlaying} onClick={() => handlePlayTrack(song, personalizedMix)} />
              ))}
            </HorizontalScroll>
          </Section>
        ) : null;

      case "coupsDeCœur":
        return likedSongs.length > 0 && isVisible("coupsDeCœur") ? (
          <Section key="coupsDeCœur" title={sectionTitle(section)} songs={likedSongs.slice(0, 20)} onPlayAll={() => { setQueue(likedSongs); play(likedSongs[0]); }} viewAllLink="/library">
            <HorizontalScroll>
              {likedSongs.slice(0, 20).map((song, i) => (
                <CoverCard key={song.id} title={song.title} subtitle={song.artist} imageUrl={song.coverUrl} index={i} isActive={currentSong?.id === song.id && isPlaying} onClick={() => handlePlayTrack(song, likedSongs)} />
              ))}
            </HorizontalScroll>
          </Section>
        ) : null;

      case "titresDuMoment":
        return isVisible("titresDuMoment") ? (
          <Section key="titresDuMoment" title={sectionTitle(section)} songs={titresDuMoment} viewAllLink={`/playlist/dz-${PLAYLISTS.titresDuMoment}`} onPlayAll={() => { if (titresDuMoment?.length) { setQueue(titresDuMoment); play(titresDuMoment[0]); } }}>
            <HorizontalScroll>
              {loadingTitres ? <CoverSkeleton /> : titresDuMoment?.map((song, i) => (
                <CoverCard key={song.id} title={song.title} subtitle={song.artist} imageUrl={song.coverUrl} index={i} isActive={currentSong?.id === song.id && isPlaying} onClick={() => handlePlayTrack(song, titresDuMoment)} />
              ))}
            </HorizontalScroll>
          </Section>
        ) : null;

      case "popHits":
        return isVisible("popHits") ? (
          <Section key="popHits" title={sectionTitle(section)} songs={popHits} viewAllLink={`/playlist/dz-${PLAYLISTS.popHits}`} onPlayAll={() => { if (popHits?.length) { setQueue(popHits); play(popHits[0]); } }}>
            <HorizontalScroll>
              {loadingPop ? <CoverSkeleton /> : popHits?.map((song, i) => (
                <CoverCard key={song.id} title={song.title} subtitle={song.artist} imageUrl={song.coverUrl} index={i} isActive={currentSong?.id === song.id && isPlaying} onClick={() => handlePlayTrack(song, popHits)} />
              ))}
            </HorizontalScroll>
          </Section>
        ) : null;

      case "rapstars":
        return isVisible("rapstars") ? (
          <Section key="rapstars" title={sectionTitle(section)} songs={rapstars} viewAllLink={`/playlist/dz-${PLAYLISTS.rapstars}`} onPlayAll={() => { if (rapstars?.length) { setQueue(rapstars); play(rapstars[0]); } }}>
            <HorizontalScroll>
              {loadingRap ? <CoverSkeleton /> : rapstars?.map((song, i) => (
                <CoverCard key={song.id} title={song.title} subtitle={song.artist} imageUrl={song.coverUrl} index={i} isActive={currentSong?.id === song.id && isPlaying} onClick={() => handlePlayTrack(song, rapstars)} />
              ))}
            </HorizontalScroll>
          </Section>
        ) : null;

      case "chillVibes":
        return isVisible("chillVibes") ? (
          <Section key="chillVibes" title={sectionTitle(section)} songs={chillVibes} viewAllLink={`/playlist/dz-${PLAYLISTS.chillVibes}`} onPlayAll={() => { if (chillVibes?.length) { setQueue(chillVibes); play(chillVibes[0]); } }}>
            <HorizontalScroll>
              {loadingChill ? <CoverSkeleton /> : chillVibes?.map((song, i) => (
                <CoverCard key={song.id} title={song.title} subtitle={song.artist} imageUrl={song.coverUrl} index={i} isActive={currentSong?.id === song.id && isPlaying} onClick={() => handlePlayTrack(song, chillVibes)} />
              ))}
            </HorizontalScroll>
          </Section>
        ) : null;

      case "afrobeats":
        return isVisible("afrobeats") ? (
          <Section key="afrobeats" title={sectionTitle(section)} songs={afrobeats} viewAllLink={`/playlist/dz-${PLAYLISTS.afrobeats}`} onPlayAll={() => { if (afrobeats?.length) { setQueue(afrobeats); play(afrobeats[0]); } }}>
            <HorizontalScroll>
              {loadingAfro ? <CoverSkeleton /> : afrobeats?.map((song, i) => (
                <CoverCard key={song.id} title={song.title} subtitle={song.artist} imageUrl={song.coverUrl} index={i} isActive={currentSong?.id === song.id && isPlaying} onClick={() => handlePlayTrack(song, afrobeats)} />
              ))}
            </HorizontalScroll>
          </Section>
        ) : null;

      case "top10":
        return isVisible("top10") ? (
          <Section key="top10" title={sectionTitle(section)} songs={topData.songs} onPlayAll={() => { if (topData.songs.length) { setQueue(topData.source); play(topData.songs[0]); } }}>
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
    <div className="pb-40 max-w-7xl mx-auto relative overflow-y-auto animate-fade-in">
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
