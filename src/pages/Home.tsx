import { useState, useCallback } from "react";
import { ScrollBlurHeader } from "@/components/ScrollBlurHeader";
import { toast } from "sonner";
import { usePlayerStore } from "@/stores/playerStore";
import type { Song } from "@/data/mockData";
import { Section } from "@/components/home/Section";
import { CoverCard } from "@/components/home/CoverCard";
import { HorizontalScroll } from "@/components/home/HorizontalScroll";
import { HeroBanner } from "@/components/home/HeroBanner";
import { HomeCustomizer, type HomeSection } from "@/components/home/HomeCustomizer";
import { CustomPlaylistSection } from "@/components/home/CustomPlaylistSection";
import { TrendingSection } from "@/components/home/TrendingSection";
import { NewAlbumsSection } from "@/components/home/NewAlbumsSection";
import { useGlobalHomeConfig } from "@/hooks/useGlobalHomeConfig";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/** Curated Deezer playlist IDs for recommendations */
const CURATED_PLAYLISTS = [
  { id: "1313621735", label: "Hits du moment 🎵" },
  { id: "1111141961", label: "Rap FR 🇫🇷" },
  { id: "1282495565", label: "Pop Hits ✨" },
  { id: "1116189381", label: "Chill Vibes 🌊" },
  { id: "5765628182", label: "Afro Hits 🌍" },
];

const HomePage = () => {
  const { play, setQueue, currentSong, isPlaying, togglePlay, likedSongs } = usePlayerStore();
  const { isAdmin } = useAdminAuth();
  const { sections, saveConfig } = useGlobalHomeConfig();
  const [localSections, setLocalSections] = useState<HomeSection[] | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);

  const activeSections = localSections ?? sections;

  const handlePlayTrack = (song: Song, allSongs: Song[]) => {
    if (currentSong?.id === song.id) {
      togglePlay();
      return;
    }
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
    <div className="pb-40 max-w-7xl mx-auto relative overflow-y-auto">
      <ScrollBlurHeader scrollThreshold={120}>
        <div className="px-5 md:px-8 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5 flex items-center justify-between">
          <span className="text-[15px] font-extrabold text-foreground tracking-tight">Vootify</span>
        </div>
      </ScrollBlurHeader>

      <HeroBanner onCustomize={isAdmin ? () => setShowCustomizer(true) : undefined} />

      {/* User's custom sections (pour vous, coups de cœur, admin playlists) */}
      {activeSections.map((s) => renderSection(s))}

      {/* Trending tracks from Deezer charts */}
      <TrendingSection onPlayTrack={handlePlayTrack} />

      {/* New album releases */}
      <NewAlbumsSection />

      {/* Curated playlists */}
      {CURATED_PLAYLISTS.map((pl) => (
        <CustomPlaylistSection
          key={pl.id}
          playlistId={pl.id}
          label={pl.label}
          onPlayTrack={handlePlayTrack}
        />
      ))}

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
