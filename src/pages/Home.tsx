import { useState, useCallback } from "react";
import { toast } from "sonner";
import { usePlayerStore } from "@/stores/playerStore";
import type { Song } from "@/data/mockData";
import { Section } from "@/components/home/Section";
import { CoverCard } from "@/components/home/CoverCard";
import { HorizontalScroll } from "@/components/home/HorizontalScroll";
import { HeroBanner } from "@/components/home/HeroBanner";
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

  // Removed aggressive refetch on visibility change — staleTime handles freshness

  // Use local override while customizer is open, otherwise DB config
  const activeSections = localSections ?? sections;

  const handlePlayTrack = (song: Song, allSongs: Song[]) => {
    if (currentSong?.id === song.id) {
      togglePlay();
      return;
    }
    // Don't pre-resolve here — Player handles resolution to avoid double latency
    setQueue(allSongs);
    play(song);
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
