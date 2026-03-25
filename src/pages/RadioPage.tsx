import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ANONYMOUS_USER_ID } from "@/lib/constants";
import { radioBrowserApi, type RadioBrowserStation } from "@/lib/radioBrowserApi";
import { usePlayerStore } from "@/stores/playerStore";
import { Radio, Play, Pause, Search, Heart, Pencil, Trash2, X, Check, Waves, LayoutGrid, List, Volume2 } from "lucide-react";
import { getStationLogo } from "@/lib/radioLogos";
import { Input } from "@/components/ui/input";
import { useRadioMetadata } from "@/hooks/useRadioMetadata";
import { useDominantColor } from "@/hooks/useDominantColor";
import CoverImagePicker from "@/components/CoverImagePicker";
import { toast } from "sonner";
import { useRef, useEffect } from "react";



/* ── Marquee for long text ── */
function MarqueeText({ text, className }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (container && textEl) {
      setShouldScroll(textEl.scrollWidth > container.clientWidth + 2);
    }
  }, [text]);

  return (
    <div ref={containerRef} className={`overflow-hidden whitespace-nowrap ${className || ""}`} style={{ containerType: "inline-size" }}>
      <span
        ref={textRef}
        className={shouldScroll ? "animate-marquee pr-8" : ""}
      >
        {text}
      </span>
    </div>
  );
}
type ViewMode = "grid" | "list";

const GENRE_TAGS = ["pop", "rock", "jazz", "classical", "hip hop", "electronic", "news", "talk"];

// Simple equalizer indicator for active station
const LiveEqualizer = () => (
  <div className="flex items-end gap-[2px] h-4">
    <div className="w-[3px] rounded-full bg-primary h-2" />
    <div className="w-[3px] rounded-full bg-primary h-3" />
    <div className="w-[3px] rounded-full bg-primary h-2.5" />
    <div className="w-[3px] rounded-full bg-primary h-3.5" />
  </div>
);

/* ── Now Playing Hero ── */
function NowPlayingHero({
  station,
  radioMetadata,
  isPlaying,
  onTogglePlay,
}: {
  station: { id: string; name: string; coverUrl: string; artist: string };
  radioMetadata: { title?: string; artist?: string; coverUrl?: string; nowPlaying?: string } | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
}) {
  const coverUrl = radioMetadata?.coverUrl || station.coverUrl;
  const dominantColor = useDominantColor(coverUrl);

  return (
    <div
      className="relative rounded-2xl overflow-hidden mx-4 md:mx-8 mb-5"
      style={{ minHeight: 140 }}
    >
      {/* BG */}
      <div
        className="absolute inset-0 transition-colors duration-1000"
        style={{ background: dominantColor || "hsl(var(--secondary))" }}
      />
      <img
        src={coverUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-30 blur-[60px] scale-[2]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

      <div className="relative z-10 flex items-center gap-4 p-4 md:p-5">
        {/* Cover */}
        <button onClick={onTogglePlay} className="relative flex-shrink-0 active:scale-95 transition-transform">
          <img
              src={coverUrl}
              alt={station.name}
              className="w-24 h-24 md:w-28 md:h-28 rounded-xl object-cover"
              style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}
            />
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/20">
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white drop-shadow-lg" />
            ) : (
              <Play className="w-8 h-8 text-white drop-shadow-lg ml-0.5" />
            )}
          </div>
        </button>

        {/* Info */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-destructive/80 backdrop-blur-sm">
              <LiveEqualizer />
              <span className="text-[9px] font-bold text-white tracking-widest uppercase">LIVE</span>
            </span>
          </div>
          <MarqueeText text={station.name} className="text-lg md:text-xl font-bold text-white leading-tight" />
          {radioMetadata?.title ? (
            <div className="space-y-0.5">
              <MarqueeText text={`♪ ${radioMetadata.title}`} className="text-sm font-semibold text-white/90" />
              {radioMetadata.artist && (
                <MarqueeText text={radioMetadata.artist} className="text-xs text-white/60" />
              )}
            </div>
          ) : (
            <p className="text-sm text-white/60 truncate">{station.artist}</p>
          )}
        </div>
      </div>

      {/* Static bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: "hsl(0 0% 100% / 0.1)" }}>
        <div className="h-full bg-primary" style={{ width: "60%" }} />
      </div>
    </div>
  );
}

const RadioPage = () => {
  const { play, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", genre: "", streamUrl: "", coverUrl: "" });
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const queryClient = useQueryClient();

  // Live metadata
  const isLiveRadio = currentSong?.album === "Radio en direct";
  const radioMetadata = useRadioMetadata(
    isLiveRadio ? currentSong?.streamUrl : undefined,
    isLiveRadio,
    isPlaying,
    currentSong?.title,
    currentSong?.coverUrl
  );

  const playStation = (station: { id: string; name: string; genre: string; coverUrl: string; streamUrl: string }) => {
    if (currentSong?.id === station.id) { togglePlay(); return; }
    play({
      id: station.id, title: station.name, artist: station.genre || "Radio",
      album: "Radio en direct", duration: 0,
      coverUrl: getStationLogo(station.name, station.coverUrl),
      streamUrl: station.streamUrl, liked: false,
    });
  };

  const saveStation = async (station: RadioBrowserStation) => {
    const { error } = await supabase.from("custom_radio_stations").upsert({
      id: station.id, user_id: ANONYMOUS_USER_ID, name: station.name,
      genre: station.genre, cover_url: station.coverUrl, stream_url: station.streamUrl,
    }, { onConflict: "id" });
    if (error) { toast.error("Erreur lors de la sauvegarde"); }
    else { toast.success(`${station.name} ajoutée`); queryClient.invalidateQueries({ queryKey: ["custom-radio-stations"] }); queryClient.invalidateQueries({ queryKey: ["saved-station-ids"] }); }
  };

  const removeStation = async (id: string) => {
    const { error } = await supabase.from("custom_radio_stations").delete().eq("id", id);
    if (error) { toast.error("Erreur lors de la suppression"); }
    else { toast.success("Station supprimée"); queryClient.invalidateQueries({ queryKey: ["custom-radio-stations"] }); queryClient.invalidateQueries({ queryKey: ["saved-station-ids"] }); }
  };

  const startEdit = (station: RadioBrowserStation) => {
    setEditingId(station.id);
    setEditForm({ name: station.name, genre: station.genre, streamUrl: station.streamUrl, coverUrl: station.coverUrl });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase.from("custom_radio_stations").update({
      name: editForm.name, genre: editForm.genre, stream_url: editForm.streamUrl, cover_url: editForm.coverUrl,
    }).eq("id", editingId);
    if (error) { toast.error("Erreur lors de la modification"); }
    else { toast.success("Station modifiée"); setEditingId(null); queryClient.invalidateQueries({ queryKey: ["custom-radio-stations"] }); }
  };

  const { data: savedIds = new Set<string>() } = useQuery({
    queryKey: ["saved-station-ids"],
    queryFn: async () => {
      const { data } = await supabase.from("custom_radio_stations").select("id").eq("user_id", ANONYMOUS_USER_ID);
      return new Set((data || []).map((r) => r.id));
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: customStations = [], isLoading: loadingCustom } = useQuery({
    queryKey: ["custom-radio-stations"],
    queryFn: async (): Promise<RadioBrowserStation[]> => {
      const { data, error } = await supabase.from("custom_radio_stations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((s) => ({
        id: s.id, name: s.name, genre: s.genre || "Radio", coverUrl: s.cover_url || "",
        streamUrl: s.stream_url || "", country: "", countryCode: "", votes: 0, clicks: 0, codec: "", bitrate: 0,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: searchResults = [], isLoading: loadingSearch } = useQuery({
    queryKey: ["radio-browser-search", searchQuery],
    queryFn: () => radioBrowserApi.search(searchQuery, 30),
    staleTime: 5 * 60 * 1000,
    enabled: searchQuery.length >= 2,
  });

  const isLoading = searchQuery.length >= 2 ? loadingSearch : loadingCustom;

  const stations = useMemo(() => {
    if (searchQuery.length >= 2) return searchResults;
    return customStations;
  }, [searchQuery, searchResults, customStations]);

  const isCustomTab = searchQuery.length < 2;

  // Show Now Playing hero when a radio station is playing
  const showNowPlaying = isLiveRadio && currentSong;

  /* ── Station List Item (compact) ── */
  const StationListItem = useCallback(({ station, index }: { station: RadioBrowserStation; index: number }) => {
    const isSaved = savedIds.has(station.id);
    const isActive = currentSong?.id === station.id;
    const isActivePlaying = isActive && isPlaying;
    const stationLogo = getStationLogo(station.name, station.coverUrl);
    const displayCover = (isActive && radioMetadata?.coverUrl) || stationLogo || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop";

    return (
      <div
        onClick={() => playStation(station)}
        className={`group flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors duration-150 ${
          isActive ? "bg-primary/10" : "hover:bg-secondary/60"
        }`}
      >
        {/* Cover */}
        <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
          <img src={displayCover} alt={station.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop'; }} />
          <div className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity ${isActivePlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            {isActivePlaying ? <Volume2 className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isActivePlaying && <LiveEqualizer />}
            <MarqueeText text={station.name} className={`text-sm font-semibold ${isActive ? "text-primary" : "text-foreground"}`} />
          </div>
          {isActive && radioMetadata?.title ? (
            <div>
              <MarqueeText text={`♪ ${radioMetadata.artist ? `${radioMetadata.artist} — ` : ""}${radioMetadata.title}`} className="text-xs text-primary/80 font-medium" />
            </div>
          ) : (
            <MarqueeText text={station.genre || "Radio"} className="text-xs text-muted-foreground capitalize" />
          )}
        </div>

        {/* Meta badges */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {station.countryCode && (
            <span className="text-[10px] font-medium text-muted-foreground uppercase">{station.countryCode}</span>
          )}
          {station.bitrate > 0 && (
            <span className="text-[10px] text-muted-foreground">{station.bitrate}k</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {isCustomTab ? (
            <>
              <button onClick={(e) => { e.stopPropagation(); startEdit(station); }} className="p-1.5 rounded-full hover:bg-secondary transition-colors">
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); removeStation(station.id); }} className="p-1.5 rounded-full hover:bg-destructive/20 transition-colors">
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); isSaved ? removeStation(station.id) : saveStation(station); }} className="p-1.5 rounded-full hover:bg-secondary transition-colors">
              <Heart className={`w-3.5 h-3.5 ${isSaved ? "fill-primary text-primary" : "text-muted-foreground"}`} />
            </button>
          )}
        </div>
      </div>
    );
  }, [savedIds, currentSong?.id, isPlaying, radioMetadata, isCustomTab]);

  /* ── Station Grid Card ── */
  const StationCard = useCallback(({ station, index }: { station: RadioBrowserStation; index: number }) => {
    const isSaved = savedIds.has(station.id);
    const isEditing = editingId === station.id;
    const isActive = currentSong?.id === station.id;
    const isActivePlaying = isActive && isPlaying;

    const dynamicCover = isActive && radioMetadata?.coverUrl ? radioMetadata.coverUrl : null;
    const stationLogo = getStationLogo(station.name, station.coverUrl);
    const displayCover = dynamicCover || stationLogo || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop";

    const nowPlayingText = isActive && radioMetadata?.artist && radioMetadata?.title
      ? `${radioMetadata.artist} — ${radioMetadata.title}`
      : null;

    if (isEditing) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-border bg-card p-4 space-y-2.5"
        >
          <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nom" className="text-sm bg-secondary border-border/50" />
          <Input value={editForm.genre} onChange={(e) => setEditForm((f) => ({ ...f, genre: e.target.value }))} placeholder="Genre" className="text-sm bg-secondary border-border/50" />
          <Input value={editForm.streamUrl} onChange={(e) => setEditForm((f) => ({ ...f, streamUrl: e.target.value }))} placeholder="URL du flux" className="text-sm bg-secondary border-border/50" />
          <CoverImagePicker value={editForm.coverUrl} onChange={(v) => setEditForm((f) => ({ ...f, coverUrl: v }))} />
          <div className="flex gap-2 pt-1">
            <button onClick={saveEdit} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:brightness-110 transition-all">
              <Check className="w-3.5 h-3.5" /> Enregistrer
            </button>
            <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 transition-all">
              <X className="w-3.5 h-3.5" /> Annuler
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className="group cursor-pointer"
        onClick={() => playStation(station)}
      >
        <div className={`relative aspect-square rounded-2xl overflow-hidden mb-2.5 ring-2 transition-all duration-300 ${
          isActive ? "ring-primary shadow-lg shadow-primary/20" : "ring-transparent"
        }`}>
          <img
            src={displayCover}
            alt={station.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop'; }}
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`w-12 h-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-xl transition-all duration-300 ${
              isActivePlaying ? "opacity-100 scale-100" : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
            }`}>
              {isActivePlaying ? <Pause className="w-5 h-5 text-primary-foreground" /> : <Play className="w-5 h-5 text-primary-foreground ml-0.5" />}
            </div>
          </div>

          {/* Live badge */}
          {isActivePlaying && (
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/90 backdrop-blur-md">
              <LiveEqualizer />
              <span className="text-[10px] font-bold text-white tracking-widest uppercase">Live</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {isCustomTab ? (
              <>
                <button onClick={(e) => { e.stopPropagation(); startEdit(station); }} className="p-2 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/70 transition-colors">
                  <Pencil className="w-3.5 h-3.5 text-white" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); removeStation(station.id); }} className="p-2 rounded-full bg-black/50 backdrop-blur-md hover:bg-destructive/80 transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </button>
              </>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); isSaved ? removeStation(station.id) : saveStation(station); }} className="p-2 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/70 transition-colors">
                <Heart className={`w-3.5 h-3.5 transition-colors ${isSaved ? "fill-primary text-primary" : "text-white"}`} />
              </button>
            )}
          </div>

          {/* Badges */}
          <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
            {station.countryCode && (
              <span className="px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-sm text-[10px] font-medium text-white/80 uppercase">
                {station.countryCode}
              </span>
            )}
            {station.bitrate > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-sm text-[10px] font-semibold text-white/80 ml-auto">
                {station.bitrate}kbps
              </span>
            )}
          </div>
        </div>

        {/* Text */}
        <div className="px-0.5">
          <div className="flex items-center gap-1.5">
            {isActive && !isActivePlaying && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
            )}
            {isActivePlaying && <LiveEqualizer />}
            <MarqueeText text={station.name} className={`font-semibold text-sm ${isActive ? "text-primary" : "text-foreground"}`} />
          </div>
          {nowPlayingText ? (
            <div className="mt-0.5 space-y-0">
              <MarqueeText text={`♪ ${radioMetadata?.title}`} className="text-xs text-primary/90 font-semibold" />
              {radioMetadata?.artist && (
                <MarqueeText text={radioMetadata.artist} className="text-[11px] text-muted-foreground" />
              )}
            </div>
          ) : (
            <MarqueeText text={station.genre || "Radio"} className="text-xs text-muted-foreground capitalize mt-0.5" />
          )}
        </div>
      </div>
    );
  }, [savedIds, editingId, currentSong?.id, isPlaying, radioMetadata, editForm, isCustomTab]);

  return (
    <div className="pb-40 max-w-7xl mx-auto">
      {/* Hero header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-accent/5" />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary/5 blur-3xl -translate-y-1/2 translate-x-1/3" />
        
        <div className="relative px-4 md:px-8 pt-[max(2rem,env(safe-area-inset-top))] pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Waves className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Radio</h1>
              <p className="text-sm text-muted-foreground">Des milliers de stations en direct du monde entier</p>
            </div>
          </div>
        </div>
      </div>

      {/* Now Playing Hero */}
      {showNowPlaying && (
        <NowPlayingHero
          station={{ id: currentSong.id, name: currentSong.title, coverUrl: getStationLogo(currentSong.title, currentSong.coverUrl), artist: currentSong.artist }}
          radioMetadata={radioMetadata}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
        />
      )}

      <div className="px-4 md:px-8">
        {/* Search + View toggle */}
        <div className="flex items-center gap-2 mb-5">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl bg-secondary/60 border-border/50 focus:bg-secondary text-sm"
            />
          </div>

          {/* View mode toggle */}
          <div className="flex items-center rounded-lg bg-secondary/60 p-0.5 flex-shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Station count */}
        {!isLoading && stations.length > 0 && (
          <p className="text-xs text-muted-foreground mb-3">
            {stations.length} station{stations.length > 1 ? "s" : ""}
          </p>
        )}

        {/* Content */}
        {isLoading ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square rounded-2xl bg-secondary/60 mb-2.5" />
                  <div className="h-4 w-3/4 bg-secondary/60 rounded-lg mb-1.5" />
                  <div className="h-3 w-1/2 bg-secondary/40 rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 animate-pulse">
                  <div className="w-12 h-12 rounded-lg bg-secondary/60" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-2/3 bg-secondary/60 rounded" />
                    <div className="h-3 w-1/3 bg-secondary/40 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : stations.length > 0 ? (
          viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                {stations.map((station, i) => (
                  <StationCard key={station.id} station={station} index={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-0.5">
                {stations.map((station, i) => (
                  <StationListItem key={station.id} station={station} index={i} />
                ))}
              </div>
            )
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-full bg-secondary/60 flex items-center justify-center mb-5">
              <Radio className="w-9 h-9 text-muted-foreground/50" />
            </div>
            <h2 className="text-lg font-display font-semibold text-foreground mb-2">
              {searchQuery.length < 2 ? "Recherchez une station" : "Aucune station trouvée"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              {searchQuery.length < 2
                ? "Utilisez la barre de recherche pour trouver et ajouter des stations radio"
                : "Essayez un autre terme de recherche."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RadioPage;
