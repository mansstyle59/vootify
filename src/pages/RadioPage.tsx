import { useState, useCallback, useMemo, useRef, useEffect } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getEffectiveUserId } from "@/lib/deviceId";
import { radioBrowserApi, type RadioBrowserStation } from "@/lib/radioBrowserApi";
import { myRadioApi, buildMyRadioLogoMap, findMyRadioLogo } from "@/lib/myRadioApi";
import { usePlayerStore } from "@/stores/playerStore";
import { Radio, Play, Pause, Search, Heart, Pencil, Trash2, Check, LayoutGrid, List, Volume2, RefreshCw } from "lucide-react";
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

type ViewMode = "grid" | "list";

const GENRE_TAGS = ["all", "pop", "rock", "jazz", "classical", "hip hop", "electronic", "news"];

/* ── Live Equalizer ── */
const LiveEqualizer = ({ color = "bg-primary" }: { color?: string }) => (
  <div className="flex items-end gap-[2px] h-4">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className={`w-[3px] rounded-full ${color} animate-equalizer-${i}`} />
    ))}
  </div>
);

/* ── Genre Pill ── */
function GenrePill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative px-4 py-1.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap transition-all duration-200 active:scale-95"
      style={{
        color: active ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
        background: !active ? "hsl(var(--foreground) / 0.04)" : undefined,
      }}
    >
      {active && (
        <motion.div
          layoutId="radioGenrePill"
          className="absolute inset-0 rounded-full bg-primary"
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
        />
      )}
      <span className="relative z-10">{label === "all" ? "Toutes" : label}</span>
    </button>
  );
}

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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-3xl overflow-hidden mx-4 md:mx-8 mb-6"
      style={{ minHeight: 150 }}
    >
      {/* Layered BG */}
      <div className="absolute inset-0 transition-colors duration-1000" style={{ background: dominantColor || "hsl(var(--secondary))" }} />
      <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25 blur-[80px] scale-[2.5]" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
      <div className="absolute inset-0" style={{ backdropFilter: "blur(2px) saturate(1.4)" }} />

      <div className="relative z-10 flex items-center gap-5 p-5 md:p-6">
        {/* Cover with glow */}
        <button onClick={onTogglePlay} className="relative flex-shrink-0 active:scale-95 transition-transform">
          <div className="absolute -inset-2 rounded-2xl opacity-40 blur-xl" style={{ background: dominantColor || "hsl(var(--primary))" }} />
          <img
            src={coverUrl}
            alt={station.name}
            className="relative w-24 h-24 md:w-28 md:h-28 rounded-2xl object-cover ring-1 ring-white/10"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}
          />
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/20">
            {isPlaying ? (
              <Pause className="w-9 h-9 text-white drop-shadow-lg" />
            ) : (
              <Play className="w-9 h-9 text-white drop-shadow-lg ml-0.5" />
            )}
          </div>
        </button>

        {/* Info */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/90 backdrop-blur-md shadow-lg shadow-destructive/30">
              <LiveEqualizer color="bg-white" />
              <span className="text-[9px] font-bold text-white tracking-[0.15em] uppercase">EN DIRECT</span>
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
            <p className="text-sm text-white/50 truncate">{station.artist}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

const RadioPage = () => {
  const { play, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", genre: "", streamUrl: "", coverUrl: "" });
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeGenre, setActiveGenre] = useState("all");
  const [deletingStation, setDeletingStation] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

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

  const isLoading = searchQuery.length >= 2 ? loadingSearch : loadingCustom;

  const stations = useMemo(() => {
    let result: RadioBrowserStation[];

    if (searchQuery.length >= 2) {
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
      result = merged;
    } else {
      result = myRadioLogoMap
        ? customStations.map(s => {
            const hdLogo = findMyRadioLogo(s.name, myRadioLogoMap);
            if (hdLogo && (!s.coverUrl || s.coverUrl.length < 10)) return { ...s, coverUrl: hdLogo };
            return s;
          })
        : customStations;
    }

    // Apply genre filter
    if (activeGenre !== "all") {
      result = result.filter(s =>
        s.genre?.toLowerCase().includes(activeGenre.toLowerCase())
      );
    }

    return result;
  }, [searchQuery, searchResults, myRadioResults, customStations, myRadioLogoMap, activeGenre]);

  const isCustomTab = searchQuery.length < 2;
  const showNowPlaying = isLiveRadio && currentSong;

  /* ── Station List Item ── */
  const StationListItem = useCallback(({ station, index }: { station: RadioBrowserStation; index: number }) => {
    const isSaved = savedIds.has(station.id);
    const isActive = currentSong?.id === station.id;
    const isActivePlaying = isActive && isPlaying;
    const stationLogo = getStationLogo(station.name, station.coverUrl);
    const displayCover = (isActive && radioMetadata?.coverUrl) || stationLogo || "";

    return (
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03 }}
        onClick={() => playStation(station)}
        className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200 ${
          isActive
            ? "bg-primary/10 ring-1 ring-primary/20"
            : "hover:bg-card/60"
        }`}
        style={{
          backdropFilter: isActive ? "blur(20px) saturate(1.5)" : undefined,
        }}
      >
        <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-secondary/40 ring-1 ring-border/10">
          <LazyImage src={displayCover} alt={station.name} className="w-full h-full object-contain p-1" fallback wrapperClassName="w-full h-full" />
          <div className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity ${isActivePlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            {isActivePlaying ? <Volume2 className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isActivePlaying && <LiveEqualizer />}
            <MarqueeText text={station.name} className={`text-sm font-semibold ${isActive ? "text-primary" : "text-foreground"}`} />
          </div>
          {isActive && radioMetadata?.title ? (
            <MarqueeText text={`♪ ${radioMetadata.artist ? `${radioMetadata.artist} — ` : ""}${radioMetadata.title}`} className="text-xs text-primary/80 font-medium" />
          ) : (station as any)._nowPlaying ? (
            <MarqueeText text={`♪ ${(station as any)._nowPlaying}`} className="text-xs text-primary/60 font-medium" />
          ) : (
            <MarqueeText text={station.genre || "Radio"} className="text-xs text-muted-foreground capitalize" />
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {station.countryCode && <span className="text-[10px] font-medium text-muted-foreground uppercase">{station.countryCode}</span>}
          {station.bitrate > 0 && <span className="text-[10px] text-muted-foreground">{station.bitrate}k</span>}
        </div>

        <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
          {isCustomTab ? (
            <>
              <button onClick={(e) => { e.stopPropagation(); startEdit(station); }} className="p-1.5 rounded-full hover:bg-secondary transition-colors"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
              <button onClick={(e) => { e.stopPropagation(); confirmDelete(station.id, station.name); }} className="p-1.5 rounded-full hover:bg-destructive/20 transition-colors"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
            </>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); isSaved ? removeStation(station.id) : saveStation(station); }} className="p-1.5 rounded-full hover:bg-secondary transition-colors">
              <Heart className={`w-3.5 h-3.5 ${isSaved ? "fill-primary text-primary" : "text-muted-foreground"}`} />
            </button>
          )}
        </div>
      </motion.div>
    );
  }, [savedIds, currentSong?.id, isPlaying, radioMetadata, isCustomTab]);

  /* ── Station Grid Card ── */
  const StationCard = useCallback(({ station, index }: { station: RadioBrowserStation; index: number }) => {
    const isSaved = savedIds.has(station.id);
    const isActive = currentSong?.id === station.id;
    const isActivePlaying = isActive && isPlaying;
    const dynamicCover = isActive && radioMetadata?.coverUrl ? radioMetadata.coverUrl : null;
    const stationLogo = getStationLogo(station.name, station.coverUrl);
    const displayCover = dynamicCover || stationLogo || "";
    const myRadioMeta = (station as any)._nowPlaying;
    const nowPlayingText = isActive && radioMetadata?.artist && radioMetadata?.title
      ? `${radioMetadata.artist} — ${radioMetadata.title}`
      : (!isActive && myRadioMeta) ? myRadioMeta : null;

    const [showCardActions, setShowCardActions] = useState(false);
    const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
    const hideTimer = useRef<ReturnType<typeof setTimeout>>();

    const handleTouchStart = useCallback(() => {
      longPressTimer.current = setTimeout(() => {
        setShowCardActions(true);
        if (navigator.vibrate) navigator.vibrate(10);
        hideTimer.current = setTimeout(() => setShowCardActions(false), 3500);
      }, 400);
    }, []);

    const handleTouchEnd = useCallback(() => {
      clearTimeout(longPressTimer.current);
    }, []);

    const handleCardClick = useCallback(() => {
      if (showCardActions) {
        setShowCardActions(false);
        return;
      }
      playStation(station);
    }, [showCardActions, station]);

    const actionsVisible = showCardActions || isActivePlaying;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.04, type: "spring", stiffness: 300, damping: 25 }}
        className="group cursor-pointer active:scale-[0.97] transition-transform duration-150"
        onClick={handleCardClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div
          className={`relative aspect-square rounded-2xl overflow-hidden mb-2.5 transition-all duration-300 ${
            isActive
              ? "ring-2 ring-primary/60"
              : "ring-1 ring-border/5 hover:ring-border/20"
          }`}
          style={{
            boxShadow: isActive
              ? "0 8px 32px hsl(var(--primary) / 0.2)"
              : "0 2px 8px hsl(0 0% 0% / 0.06)",
          }}
        >
          {/* Neutral bg for logos */}
          <div className="absolute inset-0 bg-card" />
          <LazyImage
            src={displayCover}
            alt={station.name}
            className="relative w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-110"
            fallback
            wrapperClassName="w-full h-full"
          />

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                isActivePlaying ? "opacity-100 scale-100" : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100"
              }`}
              style={{
                background: "hsl(var(--primary) / 0.9)",
                boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)",
              }}
            >
              {isActivePlaying ? <Pause className="w-5 h-5 text-primary-foreground" /> : <Play className="w-5 h-5 text-primary-foreground ml-0.5" />}
            </div>
          </div>

          {/* Live badge */}
          {isActivePlaying && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                background: "hsl(var(--destructive) / 0.9)",
              }}
            >
              <LiveEqualizer color="bg-white" />
              <span className="text-[9px] font-bold text-white tracking-[0.15em] uppercase">Live</span>
            </motion.div>
          )}

          {/* Action buttons — long-press on mobile, hover on desktop */}
          <div className={`absolute top-2 right-2 flex gap-1.5 transition-all duration-200 ${
            actionsVisible ? "opacity-100 scale-100" : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
          }`}>
            {isCustomTab ? (
              <>
                <button onClick={(e) => { e.stopPropagation(); startEdit(station); }}
                  className="p-2 rounded-full text-white active:scale-90 transition-all duration-150 hover:brightness-125"
                  style={{
                    background: "hsl(0 0% 100% / 0.15)",
                    backdropFilter: "blur(12px) saturate(1.5)",
                    boxShadow: "0 2px 8px hsl(0 0% 0% / 0.2), inset 0 0.5px 0 hsl(0 0% 100% / 0.15)",
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); confirmDelete(station.id, station.name); }}
                  className="p-2 rounded-full text-white active:scale-90 transition-all duration-150 hover:brightness-125"
                  style={{
                    background: "hsl(var(--destructive) / 0.6)",
                    backdropFilter: "blur(12px) saturate(1.5)",
                    boxShadow: "0 2px 8px hsl(var(--destructive) / 0.3), inset 0 0.5px 0 hsl(0 0% 100% / 0.1)",
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); isSaved ? removeStation(station.id) : saveStation(station); }}
                className="p-2 rounded-full text-white active:scale-90 transition-all duration-150 hover:brightness-125"
                style={{
                  background: "hsl(0 0% 100% / 0.15)",
                  backdropFilter: "blur(12px) saturate(1.5)",
                  boxShadow: "0 2px 8px hsl(0 0% 0% / 0.2), inset 0 0.5px 0 hsl(0 0% 100% / 0.15)",
                }}
              >
                <Heart className={`w-3.5 h-3.5 transition-colors ${isSaved ? "fill-primary text-primary" : "text-white"}`} />
              </button>
            )}
          </div>

          {/* Bottom badges */}
          <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between opacity-0 group-hover:opacity-100 transition-opacity">
            {station.countryCode && (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium text-white/90 uppercase"
                style={{ background: "hsl(0 0% 0% / 0.35)" }}>
                {station.countryCode}
              </span>
            )}
            {station.bitrate > 0 && (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold text-white/90 ml-auto"
                style={{ background: "hsl(0 0% 0% / 0.35)" }}>
                {station.bitrate}kbps
              </span>
            )}
          </div>
        </div>

        {/* Text */}
        <div className="px-0.5 space-y-0.5">
          <div className="flex items-center gap-1.5">
            {isActive && !isActivePlaying && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
            {isActivePlaying && <LiveEqualizer />}
            <MarqueeText text={station.name} className={`font-semibold text-xs leading-tight ${isActive ? "text-primary" : "text-foreground"}`} />
          </div>
          {nowPlayingText ? (
            <div>
              {isActive && radioMetadata?.title ? (
                <>
                  <MarqueeText text={`♪ ${radioMetadata.title}`} className="text-[10px] text-primary/90 font-semibold" />
                  {radioMetadata?.artist && <MarqueeText text={radioMetadata.artist} className="text-[10px] text-muted-foreground" />}
                </>
              ) : (
                <MarqueeText text={`♪ ${nowPlayingText}`} className="text-[10px] text-primary/70 font-medium" />
              )}
            </div>
          ) : (
            <MarqueeText text={station.genre || "Radio"} className="text-[10px] text-muted-foreground capitalize" />
          )}
        </div>
      </motion.div>
    );
  }, [savedIds, currentSong?.id, isPlaying, radioMetadata, isCustomTab]);

  /* ═══════════════════════════ RENDER ═══════════════════════════ */

  return (
    <div className="pb-20 max-w-7xl mx-auto animate-fade-in">
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-20"
        style={{
          background: "hsl(var(--background) / 0.85)",
          backdropFilter: "blur(40px) saturate(1.6)",
          WebkitBackdropFilter: "blur(40px) saturate(1.6)",
          borderBottom: "1px solid hsl(var(--border) / 0.05)",
        }}
      >
        <div className="px-4 md:px-8 pt-[max(1.5rem,env(safe-area-inset-top))] pb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <h1 className="text-[28px] md:text-[34px] font-black text-foreground leading-tight tracking-tight">Radio</h1>
            </div>
          </div>
        </div>
      </div>

      {/* ── Now Playing Hero ── */}
      <AnimatePresence>
        {showNowPlaying && (
          <NowPlayingHero
            station={{ id: currentSong.id, name: currentSong.title, coverUrl: getStationLogo(currentSong.title, currentSong.coverUrl), artist: currentSong.artist }}
            radioMetadata={radioMetadata}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
          />
        )}
      </AnimatePresence>

      <div className="px-4 md:px-8">
        {/* ── Search + View Toggle ── */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <Input
              placeholder="Rechercher une station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 rounded-full text-sm border-0"
              style={{
                background: "hsl(var(--foreground) / 0.05)",
              }}
            />
          </div>

          {/* View mode */}
          <div className="flex items-center rounded-full p-0.5 flex-shrink-0"
            style={{ background: "hsl(var(--foreground) / 0.05)" }}
          >
            {(["grid", "list"] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`p-2 rounded-full transition-all duration-200 ${
                  viewMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {mode === "grid" ? <LayoutGrid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </div>

        {/* ── Genre Filters ── */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-4 -mx-1 px-1">
          {GENRE_TAGS.map(tag => (
            <GenrePill key={tag} label={tag} active={activeGenre === tag} onClick={() => setActiveGenre(tag)} />
          ))}
        </div>

        {/* ── Station Count ── */}
        {!isLoading && stations.length > 0 && (
          <p className="text-[11px] text-muted-foreground/60 font-medium mb-3">
            {stations.length} station{stations.length > 1 ? "s" : ""}
          </p>
        )}

        {/* ── Content ── */}
        {isLoading ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i}>
                  <div className="aspect-square rounded-2xl bg-secondary/40 mb-2.5 animate-pulse" />
                  <div className="h-3.5 w-3/4 bg-secondary/40 rounded-lg mb-1.5 animate-pulse" />
                  <div className="h-2.5 w-1/2 bg-secondary/30 rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                  <div className="w-12 h-12 rounded-xl bg-secondary/40" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-2/3 bg-secondary/40 rounded-lg" />
                    <div className="h-2.5 w-1/3 bg-secondary/30 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : stations.length > 0 ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {stations.map((station, i) => (
                <StationCard key={station.id} station={station} index={i} />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {stations.map((station, i) => (
                <StationListItem key={station.id} station={station} index={i} />
              ))}
            </div>
          )
        ) : (
          /* ── Empty State ── */
          <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
              style={{ background: "hsl(var(--foreground) / 0.04)" }}
            >
              <Radio className="w-7 h-7 text-muted-foreground/25" />
            </div>
            <h2 className="text-base font-bold text-foreground mb-1">
              {searchQuery.length < 2 ? "Recherchez une station" : "Aucune station trouvée"}
            </h2>
            <p className="text-[12px] text-muted-foreground/45 max-w-[240px]">
              {searchQuery.length < 2
                ? "Utilisez la barre de recherche pour trouver et ajouter des stations radio"
                : "Essayez un autre terme de recherche."}
            </p>
          </div>
        )}
      </div>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editingId} onOpenChange={(open) => { if (!open) setEditingId(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
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

export default RadioPage;
