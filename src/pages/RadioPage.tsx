import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getEffectiveUserId } from "@/lib/deviceId";
import { radioBrowserApi, type RadioBrowserStation } from "@/lib/radioBrowserApi";
import { myRadioApi, buildMyRadioLogoMap, findMyRadioLogo } from "@/lib/myRadioApi";
import { usePlayerStore } from "@/stores/playerStore";
import { Radio, Play, Pause, Search, Heart, Pencil, Trash2, Check, Volume2, ChevronRight, X, Headphones, Globe, Music2 } from "lucide-react";
import { getStationLogo } from "@/lib/radioLogos";
import { Input } from "@/components/ui/input";
import { useRadioMetadata } from "@/hooks/useRadioMetadata";
import { useDominantColor } from "@/hooks/useDominantColor";
import CoverImagePicker from "@/components/CoverImagePicker";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { LazyImage } from "@/components/LazyImage";

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
    <div ref={containerRef} className={`overflow-hidden whitespace-nowrap ${className || ""}`}>
      <span ref={textRef} className={shouldScroll ? "animate-marquee pr-8" : ""}>
        {text}
      </span>
    </div>
  );
}

/* ── Live Equalizer ── */
const LiveEqualizer = ({ color = "bg-primary" }: { color?: string }) => (
  <div className="flex items-end gap-[2px] h-4">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className={`w-[3px] rounded-full ${color} animate-equalizer-${i}`} />
    ))}
  </div>
);

/* ── TuneIn-style Category Card ── */
const CATEGORY_ICONS: Record<string, typeof Radio> = {
  pop: Music2,
  rock: Headphones,
  jazz: Music2,
  classical: Music2,
  "hip hop": Headphones,
  electronic: Headphones,
  news: Globe,
};

const CATEGORY_COLORS: Record<string, string> = {
  pop: "220 70% 55%",
  rock: "0 65% 50%",
  jazz: "35 80% 50%",
  classical: "270 50% 55%",
  "hip hop": "160 60% 40%",
  electronic: "280 70% 55%",
  news: "200 60% 45%",
};

function CategoryCard({ genre, active, onClick }: { genre: string; active: boolean; onClick: () => void }) {
  const Icon = CATEGORY_ICONS[genre] || Radio;
  const color = CATEGORY_COLORS[genre] || "var(--primary)";

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 relative overflow-hidden rounded-2xl active:scale-[0.95] transition-transform duration-150"
      style={{
        width: 120,
        height: 72,
        background: active
          ? `hsl(${color})`
          : `linear-gradient(145deg, hsl(${color} / 0.15), hsl(${color} / 0.06))`,
        backdropFilter: active ? "none" : "blur(16px) saturate(1.4)",
        WebkitBackdropFilter: active ? "none" : "blur(16px) saturate(1.4)",
        border: active ? "none" : `0.5px solid hsl(${color} / 0.12)`,
        boxShadow: active
          ? `0 4px 20px hsl(${color} / 0.3)`
          : `0 2px 8px hsl(0 0% 0% / 0.06), inset 0 0.5px 0 hsl(${color} / 0.08)`,
      }}
    >
      <Icon
        className="absolute -bottom-1 -right-1 opacity-15"
        style={{ width: 48, height: 48, color: active ? "white" : `hsl(${color})` }}
      />
      <div className="relative z-10 h-full flex flex-col justify-end p-3">
        <span
          className="text-[12px] font-bold capitalize leading-tight"
          style={{ color: active ? "white" : `hsl(${color})` }}
        >
          {genre}
        </span>
      </div>
      {active && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white/80" />
      )}
    </button>
  );
}

/* ── Horizontal station strip ── */
function StationStrip({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-3 overflow-x-auto pl-4 pr-4 md:pl-8 md:pr-8 pb-1 scrollbar-hide"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {children}
      <div className="flex-shrink-0 w-1" aria-hidden />
    </div>
  );
}

/* ── Section header — TuneIn style ── */
function SectionHeader({ title, count, onSeeAll }: { title: string; count?: number; onSeeAll?: () => void }) {
  return (
    <div className="flex items-end justify-between px-4 md:px-8 mb-2.5 mt-6">
      <div>
        <h2 className="text-[18px] md:text-[20px] font-extrabold text-foreground leading-tight tracking-tight">
          {title}
        </h2>
        {count !== undefined && count > 0 && (
          <p className="text-[11px] mt-0.5" style={{ color: "hsl(var(--muted-foreground) / 0.45)" }}>
            {count} station{count > 1 ? "s" : ""}
          </p>
        )}
      </div>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="flex items-center gap-0.5 text-[13px] font-semibold active:opacity-70 transition-opacity"
          style={{ color: "hsl(var(--primary))" }}
        >
          Voir tout
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/* ── Now Playing Hero — TuneIn style ── */
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="relative overflow-hidden mx-4 md:mx-8 mb-4 rounded-3xl"
      style={{ minHeight: 120 }}
    >
      {/* BG */}
      <div className="absolute inset-0 transition-colors duration-1000" style={{ background: dominantColor || "hsl(var(--secondary))" }} />
      <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-[60px] scale-[2]" />
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, hsl(0 0% 0% / 0.45), hsl(0 0% 0% / 0.25))",
          backdropFilter: "blur(8px) saturate(1.4)",
          WebkitBackdropFilter: "blur(8px) saturate(1.4)",
        }}
      />

      <div className="relative z-10 flex items-center gap-4 p-4">
        {/* Cover */}
        <button onClick={onTogglePlay} className="relative flex-shrink-0 active:scale-95 transition-transform">
          <img
            src={coverUrl}
            alt={station.name}
            className="w-20 h-20 md:w-24 md:h-24 rounded-xl object-cover ring-1 ring-white/10"
            style={{ boxShadow: "0 6px 24px rgba(0,0,0,0.4)" }}
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
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: "hsl(var(--destructive) / 0.85)" }}>
              <LiveEqualizer color="bg-white" />
              <span className="text-[8px] font-bold text-white tracking-[0.12em] uppercase">EN DIRECT</span>
            </span>
          </div>
          <MarqueeText text={station.name} className="text-base md:text-lg font-bold text-white leading-tight" />
          {radioMetadata?.title ? (
            <div className="space-y-0.5">
              <MarqueeText text={`♪ ${radioMetadata.title}`} className="text-[12px] font-semibold text-white/85" />
              {radioMetadata.artist && (
                <MarqueeText text={radioMetadata.artist} className="text-[11px] text-white/55" />
              )}
            </div>
          ) : (
            <p className="text-[12px] text-white/45 truncate">{station.artist}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

const GENRE_LIST = ["pop", "rock", "jazz", "classical", "hip hop", "electronic", "news"];

const RadioPage = () => {
  const { play, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", genre: "", streamUrl: "", coverUrl: "" });
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [showAllStations, setShowAllStations] = useState(false);
  const [deletingStation, setDeletingStation] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isLiveRadio = currentSong?.album === "Radio en direct";
  const radioMetadata = useRadioMetadata(
    isLiveRadio ? currentSong?.streamUrl : undefined,
    isLiveRadio, isPlaying, currentSong?.title, currentSong?.coverUrl
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
    const effectiveUserId = getEffectiveUserId(user?.id);
    const { error } = await supabase.from("custom_radio_stations").upsert({
      id: station.id, user_id: effectiveUserId, name: station.name,
      genre: station.genre, cover_url: station.coverUrl, stream_url: station.streamUrl,
    }, { onConflict: "id" });
    if (error) toast.error("Erreur lors de la sauvegarde");
    else {
      toast.success(`${station.name} ajoutée`);
      queryClient.invalidateQueries({ queryKey: ["custom-radio-stations"] });
      queryClient.invalidateQueries({ queryKey: ["saved-station-ids"] });
    }
  };

  const removeStation = async (id: string) => {
    const { error, count } = await supabase.from("custom_radio_stations").delete({ count: "exact" }).eq("id", id);
    if (error) {
      toast.error("Erreur lors de la suppression");
    } else if (count === 0 && user) {
      await supabase.from("custom_radio_stations").update({ user_id: user.id }).eq("id", id);
      const { error: err2 } = await supabase.from("custom_radio_stations").delete().eq("id", id);
      if (err2) toast.error("Impossible de supprimer");
      else {
        toast.success("Station supprimée");
        queryClient.invalidateQueries({ queryKey: ["custom-radio-stations"] });
        queryClient.invalidateQueries({ queryKey: ["saved-station-ids"] });
      }
    } else {
      toast.success("Station supprimée");
      queryClient.invalidateQueries({ queryKey: ["custom-radio-stations"] });
      queryClient.invalidateQueries({ queryKey: ["saved-station-ids"] });
    }
  };

  const startEdit = (station: RadioBrowserStation) => {
    setEditingId(station.id);
    setEditForm({ name: station.name, genre: station.genre, streamUrl: station.streamUrl, coverUrl: station.coverUrl });
  };

  const saveEdit = async () => {
    if (!editingId || !editForm.name.trim()) return;
    const { error } = await supabase.from("custom_radio_stations").update({
      name: editForm.name.trim(), genre: editForm.genre.trim(),
      stream_url: editForm.streamUrl.trim(), cover_url: editForm.coverUrl,
    }).eq("id", editingId);
    if (error) toast.error("Erreur lors de la modification");
    else {
      toast.success("Station modifiée");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["custom-radio-stations"] });
    }
  };

  const confirmDelete = (id: string, name: string) => setDeletingStation({ id, name });
  const executeDelete = async () => {
    if (!deletingStation) return;
    await removeStation(deletingStation.id);
    setDeletingStation(null);
  };

  /* ── Queries ── */
  const { data: savedIds = new Set<string>() } = useQuery({
    queryKey: ["saved-station-ids"],
    queryFn: async () => {
      const { data } = await supabase.from("custom_radio_stations").select("id");
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

  const { data: myRadioLogoMap } = useQuery({
    queryKey: ["myradio-logos"],
    queryFn: async () => {
      const stations = await myRadioApi.getAll();
      return buildMyRadioLogoMap(stations);
    },
    staleTime: 30 * 60 * 1000,
  });

  const { data: myRadioResults = [] } = useQuery({
    queryKey: ["myradio-search", searchQuery],
    queryFn: async () => {
      const stations = await myRadioApi.search(searchQuery);
      return stations.map(s => ({
        id: `mred-${s.slug}`, name: s.name, genre: s.nowPlaying || "Radio française",
        coverUrl: s.logoHdUrl || s.logoUrl, streamUrl: "", country: "France", countryCode: "FR",
        votes: 0, clicks: 0, codec: "", bitrate: 0,
        _nowPlaying: s.nowPlaying, _artist: s.artist, _title: s.title, _slug: s.slug,
      } as RadioBrowserStation & { _nowPlaying?: string; _artist?: string; _title?: string; _slug?: string }));
    },
    staleTime: 2 * 60 * 1000,
    enabled: searchQuery.length >= 2,
  });

  const { data: searchResults = [], isLoading: loadingSearch } = useQuery({
    queryKey: ["radio-browser-search", searchQuery],
    queryFn: () => radioBrowserApi.search(searchQuery, 30),
    staleTime: 5 * 60 * 1000,
    enabled: searchQuery.length >= 2,
  });

  const isSearching = searchQuery.length >= 2;
  const isLoading = isSearching ? loadingSearch : loadingCustom;

  // Enriched custom stations
  const enrichedCustom = useMemo(() => {
    if (!myRadioLogoMap) return customStations;
    return customStations.map(s => {
      const hdLogo = findMyRadioLogo(s.name, myRadioLogoMap);
      if (hdLogo && (!s.coverUrl || s.coverUrl.length < 10)) return { ...s, coverUrl: hdLogo };
      return s;
    });
  }, [customStations, myRadioLogoMap]);

  // Merge search results
  const searchStations = useMemo(() => {
    if (!isSearching) return [];
    const enrichedBrowser = searchResults.map(s => {
      if (myRadioLogoMap) {
        const hdLogo = findMyRadioLogo(s.name, myRadioLogoMap);
        if (hdLogo) return { ...s, coverUrl: hdLogo };
      }
      return s;
    });
    const seenNames = new Set<string>();
    const merged: RadioBrowserStation[] = [];
    for (const mr of myRadioResults) {
      const nameLower = mr.name.toLowerCase().trim();
      const browserMatch = enrichedBrowser.find(b =>
        b.name.toLowerCase().trim() === nameLower ||
        b.name.toLowerCase().includes(nameLower) ||
        nameLower.includes(b.name.toLowerCase().trim())
      );
      if (browserMatch) {
        merged.push({ ...browserMatch, coverUrl: mr.coverUrl || browserMatch.coverUrl });
        seenNames.add(nameLower);
        seenNames.add(browserMatch.name.toLowerCase().trim());
      } else {
        merged.push(mr);
        seenNames.add(nameLower);
      }
    }
    for (const s of enrichedBrowser) {
      if (!seenNames.has(s.name.toLowerCase().trim())) {
        merged.push(s);
        seenNames.add(s.name.toLowerCase().trim());
      }
    }
    return merged;
  }, [isSearching, searchResults, myRadioResults, myRadioLogoMap]);

  // Genre-filtered stations from saved
  const genreStations = useMemo(() => {
    if (!activeGenre) return [];
    return enrichedCustom.filter(s =>
      s.genre?.toLowerCase().includes(activeGenre.toLowerCase())
    );
  }, [enrichedCustom, activeGenre]);

  const showNowPlaying = isLiveRadio && currentSong;

  const displayStations = showAllStations ? enrichedCustom : enrichedCustom.slice(0, 8);

  /* ── Compact Station Card — TuneIn style ── */
  function StationTile({ station }: { station: RadioBrowserStation }) {
    const isSaved = savedIds.has(station.id);
    const isActive = currentSong?.id === station.id;
    const isActivePlaying = isActive && isPlaying;
    const dynamicCover = isActive && radioMetadata?.coverUrl ? radioMetadata.coverUrl : null;
    const stationLogo = getStationLogo(station.name, station.coverUrl);
    const displayCover = dynamicCover || stationLogo || "";
    const myRadioMeta = (station as any)._nowPlaying;

    const [showActions, setShowActions] = useState(false);
    const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
    const hideTimer = useRef<ReturnType<typeof setTimeout>>();

    const handleTouchStart = useCallback(() => {
      longPressTimer.current = setTimeout(() => {
        setShowActions(true);
        if (navigator.vibrate) navigator.vibrate(10);
        hideTimer.current = setTimeout(() => setShowActions(false), 3500);
      }, 400);
    }, []);

    const handleTouchEnd = useCallback(() => {
      clearTimeout(longPressTimer.current);
    }, []);

    const handleClick = useCallback(() => {
      if (showActions) { setShowActions(false); return; }
      playStation(station);
    }, [showActions, station]);

    return (
      <div
        className="flex-shrink-0 w-[120px] md:w-[140px] cursor-pointer group active:scale-[0.96] transition-transform duration-150 snap-start"
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div
          className={`relative aspect-square rounded-xl overflow-hidden mb-2 transition-all duration-200 ${
            isActive ? "ring-2 ring-primary/50" : "ring-1 ring-border/5"
          }`}
          style={{
            boxShadow: isActive ? "0 4px 20px hsl(var(--primary) / 0.2)" : "0 1px 6px hsl(0 0% 0% / 0.06)",
          }}
        >
          <div className="absolute inset-0 bg-card" />
          <LazyImage
            src={displayCover}
            alt={station.name}
            className="relative w-full h-full object-contain p-2.5 transition-transform duration-300 group-hover:scale-105"
            fallback
            wrapperClassName="w-full h-full"
          />

          {/* Play overlay */}
          <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
            isActivePlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`} style={{ background: "hsl(0 0% 0% / 0.25)" }}>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "hsl(var(--primary) / 0.9)", boxShadow: "0 2px 12px hsl(var(--primary) / 0.3)" }}
            >
              {isActivePlaying ? <Pause className="w-4 h-4 text-primary-foreground" /> : <Play className="w-4 h-4 text-primary-foreground ml-0.5" />}
            </div>
          </div>

          {/* Live badge */}
          {isActivePlaying && (
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: "hsl(var(--destructive) / 0.85)" }}>
              <LiveEqualizer color="bg-white" />
              <span className="text-[8px] font-bold text-white tracking-wider uppercase">Live</span>
            </div>
          )}

          {/* Action buttons */}
          <div className={`absolute top-1.5 right-1.5 flex gap-1 transition-all duration-200 ${
            showActions ? "opacity-100 scale-100" : "opacity-0 scale-90 md:group-hover:opacity-100 md:group-hover:scale-100"
          }`}>
            {!isSearching ? (
              <>
                <button onClick={(e) => { e.stopPropagation(); startEdit(station); }}
                  className="p-1.5 rounded-full text-white active:scale-90"
                  style={{ background: "hsl(0 0% 100% / 0.2)", backdropFilter: "blur(8px)" }}
                ><Pencil className="w-3 h-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); confirmDelete(station.id, station.name); }}
                  className="p-1.5 rounded-full text-white active:scale-90"
                  style={{ background: "hsl(var(--destructive) / 0.6)", backdropFilter: "blur(8px)" }}
                ><Trash2 className="w-3 h-3" /></button>
              </>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); isSaved ? removeStation(station.id) : saveStation(station); }}
                className="p-1.5 rounded-full text-white active:scale-90"
                style={{ background: "hsl(0 0% 100% / 0.2)", backdropFilter: "blur(8px)" }}
              >
                <Heart className={`w-3 h-3 ${isSaved ? "fill-primary text-primary" : "text-white"}`} />
              </button>
            )}
          </div>
        </div>

        {/* Text */}
        <div className="px-0.5">
          <div className="flex items-center gap-1">
            {isActivePlaying && <LiveEqualizer />}
            <MarqueeText text={station.name} className={`text-[11px] font-semibold leading-tight ${isActive ? "text-primary" : "text-foreground"}`} />
          </div>
          {isActive && radioMetadata?.title ? (
            <MarqueeText text={`♪ ${radioMetadata.title}`} className="text-[10px] text-primary/80 font-medium mt-0.5" />
          ) : myRadioMeta ? (
            <MarqueeText text={`♪ ${myRadioMeta}`} className="text-[10px] text-primary/60 font-medium mt-0.5" />
          ) : (
            <MarqueeText text={station.genre || "Radio"} className="text-[10px] text-muted-foreground capitalize mt-0.5" />
          )}
        </div>
      </div>
    );
  }

  /* ── Search Result Row — TuneIn list style ── */
  function SearchResultRow({ station }: { station: RadioBrowserStation }) {
    const isSaved = savedIds.has(station.id);
    const isActive = currentSong?.id === station.id;
    const isActivePlaying = isActive && isPlaying;
    const stationLogo = getStationLogo(station.name, station.coverUrl);
    const displayCover = (isActive && radioMetadata?.coverUrl) || stationLogo || "";

    return (
      <div
        onClick={() => playStation(station)}
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-150 active:bg-foreground/[0.03] ${
          isActive ? "bg-primary/[0.06]" : ""
        }`}
      >
        <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-card ring-1 ring-border/8">
          <LazyImage src={displayCover} alt={station.name} className="w-full h-full object-contain p-1" fallback wrapperClassName="w-full h-full" />
          {isActivePlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25 rounded-xl">
              <Volume2 className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isActivePlaying && <LiveEqualizer />}
            <MarqueeText text={station.name} className={`text-[13px] font-semibold ${isActive ? "text-primary" : "text-foreground"}`} />
          </div>
          {isActive && radioMetadata?.title ? (
            <MarqueeText text={`♪ ${radioMetadata.artist ? `${radioMetadata.artist} — ` : ""}${radioMetadata.title}`} className="text-[11px] text-primary/70 font-medium" />
          ) : (station as any)._nowPlaying ? (
            <MarqueeText text={`♪ ${(station as any)._nowPlaying}`} className="text-[11px] text-primary/60" />
          ) : (
            <p className="text-[11px] text-muted-foreground capitalize truncate">{station.genre || "Radio"}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {station.countryCode && <span className="text-[9px] font-medium text-muted-foreground/50 uppercase">{station.countryCode}</span>}
          <button onClick={(e) => { e.stopPropagation(); isSaved ? removeStation(station.id) : saveStation(station); }}
            className="p-1.5 rounded-full active:scale-90 transition-transform"
          >
            <Heart className={`w-4 h-4 ${isSaved ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════ RENDER ═══════════════════════════ */

  return (
    <div className="pb-20 max-w-7xl mx-auto">
      {/* ── Glass Header ── */}
      <div
        className="sticky top-0 z-20"
        style={{
          background: "linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background) / 0.92) 70%, hsl(var(--background) / 0) 100%)",
          backdropFilter: "blur(40px) saturate(1.8)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        }}
      >
        <div className="px-4 md:px-8 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
          <h1 className="text-[28px] md:text-[34px] font-black text-foreground leading-tight tracking-tight mb-3">
            Radio
          </h1>

          {/* Glass Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <Input
              ref={searchInputRef}
              placeholder="Rechercher une station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-9 h-10 rounded-2xl text-sm border-0"
              style={{
                background: "linear-gradient(145deg, hsl(var(--card) / 0.45), hsl(var(--card) / 0.2))",
                backdropFilter: "blur(24px) saturate(1.6)",
                WebkitBackdropFilter: "blur(24px) saturate(1.6)",
                border: "0.5px solid hsl(var(--foreground) / 0.06)",
                boxShadow: "0 2px 12px hsl(0 0% 0% / 0.1), inset 0 0.5px 0 hsl(var(--foreground) / 0.04)",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full active:scale-90"
                style={{ background: "hsl(var(--foreground) / 0.08)" }}
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Now Playing ── */}
      <AnimatePresence>
        {showNowPlaying && (
          <div className="mt-4">
            <NowPlayingHero
              station={{ id: currentSong.id, name: currentSong.title, coverUrl: getStationLogo(currentSong.title, currentSong.coverUrl), artist: currentSong.artist }}
              radioMetadata={radioMetadata}
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── SEARCH MODE ── */}
      {isSearching ? (
        <div>
          <div className="px-4 md:px-8 py-3">
            <p className="text-[12px] font-medium" style={{ color: "hsl(var(--muted-foreground) / 0.5)" }}>
              {loadingSearch ? "Recherche..." : `${searchStations.length} résultat${searchStations.length > 1 ? "s" : ""}`}
            </p>
          </div>
          {loadingSearch ? (
            <div className="space-y-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                  <div className="w-12 h-12 rounded-xl" style={{ background: "hsl(var(--foreground) / 0.04)" }} />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-2/3 rounded-lg" style={{ background: "hsl(var(--foreground) / 0.04)" }} />
                    <div className="h-2.5 w-1/3 rounded-lg" style={{ background: "hsl(var(--foreground) / 0.03)" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : searchStations.length > 0 ? (
            <div>
              {searchStations.map((station) => (
                <SearchResultRow key={station.id} station={station} />
              ))}
            </div>
          ) : (
            <EmptyState searching />
          )}
        </div>
      ) : activeGenre ? (
        /* ── GENRE MODE ── */
        <div>
          <div className="px-4 md:px-8 mt-5 mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveGenre(null)}
                className="p-1.5 rounded-full active:scale-90 transition-transform"
                style={{ background: "hsl(var(--foreground) / 0.06)" }}
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
              <h2 className="text-[20px] font-extrabold text-foreground capitalize">{activeGenre}</h2>
              <span className="text-[11px] font-medium" style={{ color: "hsl(var(--muted-foreground) / 0.45)" }}>
                {genreStations.length} station{genreStations.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
          {genreStations.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 px-4 md:px-8">
              {genreStations.map((station) => (
                <StationTile key={station.id} station={station} />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      ) : (
        /* ── BROWSE MODE (TuneIn home) ── */
        <div>
          {/* Categories */}
          <SectionHeader title="Parcourir" />
          <StationStrip>
            {GENRE_LIST.map(genre => (
              <CategoryCard
                key={genre}
                genre={genre}
                active={false}
                onClick={() => setActiveGenre(genre)}
              />
            ))}
          </StationStrip>

          {/* My stations */}
          {enrichedCustom.length > 0 && (
            <>
              <SectionHeader
                title="Mes stations"
                count={enrichedCustom.length}
                onSeeAll={enrichedCustom.length > 8 ? () => setShowAllStations(!showAllStations) : undefined}
              />
              {showAllStations ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 px-4 md:px-8">
                  {enrichedCustom.map((station) => (
                    <StationTile key={station.id} station={station} />
                  ))}
                </div>
              ) : (
                <StationStrip>
                  {displayStations.map((station) => (
                    <StationTile key={station.id} station={station} />
                  ))}
                </StationStrip>
              )}
            </>
          )}

          {/* Empty state if no stations */}
          {!loadingCustom && enrichedCustom.length === 0 && (
            <EmptyState />
          )}

          {/* Loading */}
          {loadingCustom && (
            <div className="px-4 md:px-8 mt-4">
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-[120px]">
                    <div className="aspect-square rounded-xl mb-2 animate-pulse" style={{ background: "hsl(var(--foreground) / 0.04)" }} />
                    <div className="h-2.5 w-3/4 rounded mb-1 animate-pulse" style={{ background: "hsl(var(--foreground) / 0.04)" }} />
                    <div className="h-2 w-1/2 rounded animate-pulse" style={{ background: "hsl(var(--foreground) / 0.03)" }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editingId} onOpenChange={(open) => { if (!open) setEditingId(null); }}>
        <DialogContent className="sm:max-w-md rounded-3xl" style={{ backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)", background: "hsl(var(--card) / 0.85)", border: "0.5px solid hsl(var(--foreground) / 0.06)" }}>
          <DialogHeader>
            <DialogTitle className="font-display">Modifier la station</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Nom</Label><Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom de la station" className="rounded-xl" /></div>
            <div className="space-y-2"><Label>Genre</Label><Input value={editForm.genre} onChange={(e) => setEditForm(f => ({ ...f, genre: e.target.value }))} placeholder="Pop, Rock, Jazz..." className="rounded-xl" /></div>
            <div className="space-y-2"><Label>URL du flux</Label><Input value={editForm.streamUrl} onChange={(e) => setEditForm(f => ({ ...f, streamUrl: e.target.value }))} placeholder="https://..." className="rounded-xl" /></div>
            <div className="space-y-2"><Label>Pochette</Label><CoverImagePicker value={editForm.coverUrl} onChange={(v) => setEditForm(f => ({ ...f, coverUrl: v }))} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingId(null)} className="rounded-xl">Annuler</Button>
            <Button onClick={saveEdit} disabled={!editForm.name.trim()} className="rounded-xl"><Check className="w-4 h-4 mr-1" /> Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={!!deletingStation} onOpenChange={(open) => { if (!open) setDeletingStation(null); }}>
        <DialogContent className="sm:max-w-sm rounded-3xl" style={{ backdropFilter: "blur(40px) saturate(1.8)", background: "hsl(var(--card) / 0.85)" }}>
          <DialogHeader>
            <DialogTitle className="font-display">Supprimer la station</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Voulez-vous vraiment supprimer <strong>{deletingStation?.name}</strong> ? Cette action est irréversible.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingStation(null)} className="rounded-xl">Annuler</Button>
            <Button variant="destructive" onClick={executeDelete} className="rounded-xl"><Trash2 className="w-4 h-4 mr-1" /> Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ── Empty State ── */
function EmptyState({ searching }: { searching?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: "linear-gradient(145deg, hsl(var(--card) / 0.5), hsl(var(--card) / 0.2))",
          backdropFilter: "blur(40px) saturate(1.8)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
          border: "0.5px solid hsl(var(--foreground) / 0.06)",
          boxShadow: "0 4px 20px hsl(0 0% 0% / 0.12)",
        }}
      >
        <Radio className="w-6 h-6 text-muted-foreground/20" />
      </div>
      <h2 className="text-[15px] font-bold text-foreground mb-1">
        {searching ? "Aucune station trouvée" : "Recherchez une station"}
      </h2>
      <p className="text-[12px] max-w-[220px]" style={{ color: "hsl(var(--muted-foreground) / 0.4)" }}>
        {searching
          ? "Essayez un autre terme de recherche."
          : "Utilisez la barre de recherche pour trouver et ajouter vos stations préférées."}
      </p>
    </div>
  );
}

export default RadioPage;
