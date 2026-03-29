import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useMemo, useEffect, useState } from "react";
import { LogIn, LogOut, Headphones, Shuffle, Heart, Search, User, Music2, Radio, Library, RefreshCw } from "lucide-react";
import { getPendingCount } from "@/lib/offlineQueue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";

const QUOTES = [
  "La musique est le langage des émotions.",
  "Chaque jour mérite sa playlist.",
  "Laisse la musique guider tes pas.",
  "Un bon morceau change toute la journée.",
  "Écoute. Ressens. Vibre.",
  "La vie a besoin d'une bande-son.",
  "Musique : le remède universel.",
];

function getGreeting() {
  const h = new Date().getHours();
  return h < 6 ? "Bonne nuit" : h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
}

function getDailyQuote() {
  const day = Math.floor(Date.now() / 86400000);
  return QUOTES[day % QUOTES.length];
}

/* ── Animated sound wave bars ── */
function SoundWaveVisualizer() {
  return (
    <div className="flex items-end gap-[3px] h-8 opacity-40">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[2px] rounded-full"
          style={{ background: "hsl(var(--primary))" }}
          animate={{
            height: [4, 12 + Math.random() * 18, 6, 16 + Math.random() * 14, 4],
          }}
          transition={{
            duration: 1.8 + Math.random() * 0.8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.07,
          }}
        />
      ))}
    </div>
  );
}

export function HeroBanner({ customSubtitle, bgColor, bgImage }: { onCustomize?: () => void; customSubtitle?: string; bgColor?: string; bgImage?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { play, setQueue, currentSong, isPlaying } = usePlayerStore();
  const quote = useMemo(() => getDailyQuote(), []);

  const handleShuffle = async () => {
    const { data } = await supabase
      .from("custom_songs")
      .select("*")
      .not("stream_url", "is", null)
      .limit(50);
    if (!data || data.length === 0) return;
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    const songs = shuffled.map((r) => ({
      id: `custom-${r.id}`,
      title: r.title,
      artist: r.artist,
      album: r.album || "",
      duration: r.duration || 0,
      coverUrl: r.cover_url || "",
      streamUrl: r.stream_url || "",
      liked: false,
    }));
    setQueue(songs);
    play(songs[0]);
  };

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 40]);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0];
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div ref={ref} className="relative overflow-hidden">
      {/* ─── BG with parallax ─── */}
      <motion.div className="absolute inset-0 -z-10" style={{ scale: bgScale }}>
        {bgImage ? (
          <>
            <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(var(--background) / 0.2) 0%, hsl(var(--background)) 100%)" }} />
          </>
        ) : bgColor ? (
          <>
            <div className="absolute inset-0" style={{ background: bgColor }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, hsl(var(--background)) 100%)" }} />
          </>
        ) : (
          <>
            {/* Mesh gradient background */}
            <div className="absolute inset-0" style={{
              background: `
                radial-gradient(ellipse 80% 50% at 20% 10%, hsl(var(--primary) / 0.15) 0%, transparent 55%),
                radial-gradient(ellipse 60% 40% at 80% 30%, hsl(var(--primary) / 0.08) 0%, transparent 50%),
                radial-gradient(ellipse 40% 60% at 50% 80%, hsl(var(--primary) / 0.04) 0%, transparent 60%),
                hsl(var(--background))
              `,
            }} />
            {/* Animated glow orb */}
            <motion.div
              className="absolute w-[200px] h-[200px] rounded-full"
              style={{
                top: "10%",
                left: "15%",
                background: "radial-gradient(circle, hsl(var(--primary) / 0.12) 0%, transparent 70%)",
                filter: "blur(40px)",
              }}
              animate={{
                x: [0, 30, -10, 20, 0],
                y: [0, -15, 10, -5, 0],
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </>
        )}
      </motion.div>

      {/* ─── Top bar ─── */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-5 md:px-8 py-2.5"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.625rem)",
        }}
      >
        {/* Brand + SoundWave indicator */}
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-black text-primary tracking-wide uppercase">Vootify</span>
          {currentSong && isPlaying && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
              style={{ background: "hsl(var(--primary) / 0.1)" }}
            >
              <Music2 className="w-2.5 h-2.5 text-primary" />
              <span className="text-[9px] font-bold text-primary tracking-wider uppercase">SoundWave</span>
            </motion.div>
          )}
        </div>

        {/* Profile */}
        {user ? (
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="group relative flex items-center gap-2 pl-1 pr-3 py-1 rounded-full outline-none active:scale-[0.93] transition-all duration-200 hover:shadow-lg"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--foreground) / 0.06))",
                    backdropFilter: "blur(20px) saturate(1.6)",
                    WebkitBackdropFilter: "blur(20px) saturate(1.6)",
                    border: "1px solid hsl(var(--primary) / 0.12)",
                    boxShadow: "0 2px 12px hsl(var(--primary) / 0.08), inset 0 1px 0 hsl(var(--primary) / 0.06)",
                  }}
                >
                  <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ boxShadow: "0 0 20px hsl(var(--primary) / 0.2), inset 0 0 8px hsl(var(--primary) / 0.05)" }} />
                  <Avatar className="w-7 h-7 ring-[1.5px] ring-primary/30 group-hover:ring-primary/50 transition-all duration-200">
                    <AvatarImage src={avatarUrl} alt={displayName || "User"} className="group-hover:brightness-110 transition-all duration-200" />
                    <AvatarFallback
                      className="text-[10px] font-bold"
                      style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.1))", color: "hsl(var(--primary))" }}
                    >
                      {(displayName || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] font-semibold text-foreground truncate max-w-[72px] relative z-10">
                    {displayName}
                  </span>
                  {/* Online indicator */}
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background" style={{ background: "hsl(var(--primary))", boxShadow: "0 0 6px hsl(var(--primary) / 0.5)" }} />
                  {/* Sync pending badge */}
                  {getPendingCount() > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -bottom-1 -right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-background"
                      style={{
                        background: "hsl(var(--destructive))",
                        color: "hsl(var(--destructive-foreground))",
                        boxShadow: "0 2px 8px hsl(var(--destructive) / 0.4)",
                      }}
                    >
                      {getPendingCount()}
                    </motion.span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-2xl p-2 animate-scale-in"
                sideOffset={10}
                style={{
                  background: "linear-gradient(160deg, hsl(var(--card) / 0.95), hsl(var(--card) / 0.88))",
                  backdropFilter: "blur(60px) saturate(2)",
                  WebkitBackdropFilter: "blur(60px) saturate(2)",
                  border: "1px solid hsl(var(--primary) / 0.08)",
                  boxShadow: "0 24px 80px hsl(0 0% 0% / 0.55), 0 0 0 1px hsl(var(--primary) / 0.04), inset 0 1px 0 hsl(var(--primary) / 0.06)",
                }}
              >
                <div
                  className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl"
                  style={{ background: "hsl(var(--primary) / 0.06)" }}
                >
                  <Avatar className="w-10 h-10 ring-2 ring-primary/20">
                    <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                    <AvatarFallback className="text-[11px] font-bold" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.1))", color: "hsl(var(--primary))" }}>
                      {(displayName || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-foreground truncate">{displayName}</p>
                    <p className="text-[10px] text-muted-foreground/50 truncate">{user.email}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(var(--primary))", boxShadow: "0 0 4px hsl(var(--primary) / 0.5)" }} />
                      <span className="text-[9px] font-medium text-primary/70">En ligne</span>
                    </div>
                  </div>
                </div>

                <DropdownMenuSeparator className="my-1.5" style={{ background: "hsl(var(--border) / 0.06)" }} />

                <DropdownMenuItem onClick={() => navigate("/profile")} className="rounded-xl gap-3 py-2.5 px-3 cursor-pointer group/item transition-all duration-150 focus:bg-primary/8">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 group-hover/item:scale-110" style={{ background: "hsl(var(--primary) / 0.1)", boxShadow: "0 2px 8px hsl(var(--primary) / 0.1)" }}>
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-[12px]">Mon profil</span>
                    <p className="text-[9px] text-muted-foreground/50">Voir et modifier</p>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => navigate("/audio-settings")} className="rounded-xl gap-3 py-2.5 px-3 cursor-pointer group/item transition-all duration-150">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 group-hover/item:scale-110" style={{ background: "hsl(var(--foreground) / 0.05)" }}>
                    <Headphones className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-[12px]">Paramètres audio</span>
                    <p className="text-[9px] text-muted-foreground/50">Égaliseur et qualité</p>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1.5" style={{ background: "hsl(var(--border) / 0.06)" }} />

                <DropdownMenuItem onClick={() => signOut()} className="rounded-xl gap-3 py-2.5 px-3 cursor-pointer group/item text-destructive focus:text-destructive transition-all duration-150">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 group-hover/item:scale-110" style={{ background: "hsl(var(--destructive) / 0.1)" }}>
                    <LogOut className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-semibold text-[12px]">Déconnexion</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <button
            onClick={() => navigate("/auth")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold active:scale-95 transition-transform"
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            <LogIn className="w-3.5 h-3.5" />
            Connexion
          </button>
        )}
      </div>

      {/* ─── Main content ─── */}
      <motion.div
        style={{ opacity, y: contentY }}
        className="relative z-10 px-5 md:px-8 pt-3 pb-7"
      >
        {/* Sound wave visualizer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mb-4"
        >
          <SoundWaveVisualizer />
        </motion.div>

        {/* Large greeting */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-[34px] md:text-[40px] font-black text-foreground leading-[1.02] tracking-tight"
        >
          {getGreeting()}
        </motion.h1>

        {/* Daily quote */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-[13px] text-muted-foreground/50 mt-1.5 font-medium italic"
        >
          « {customSubtitle || quote} »
        </motion.p>

        {/* Action buttons — premium hierarchy */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
          className="flex flex-col gap-3 mt-5"
        >
          {/* Primary CTA — Shuffle */}
          <button
            onClick={handleShuffle}
            className="flex items-center justify-center gap-2.5 w-full py-3 rounded-full text-[13px] font-bold active:scale-[0.97] transition-all duration-200"
            style={{
              background: "hsl(var(--primary) / 0.12)",
              color: "hsl(var(--primary))",
            }}
          >
            <Shuffle className="w-4 h-4" />
            Lecture aléatoire
          </button>

          {/* Secondary actions row */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => navigate("/library")}
              className="flex items-center justify-center gap-2 py-3 rounded-full text-[12px] font-semibold active:scale-[0.95] transition-all duration-200"
              style={{
                background: "hsl(var(--primary) / 0.10)",
                color: "hsl(var(--primary))",
              }}
            >
              <Heart className="w-4 h-4" />
              Favoris
            </button>

            <button
              onClick={() => navigate("/search")}
              className="flex items-center justify-center gap-2 py-3 rounded-full text-[12px] font-semibold active:scale-[0.95] transition-all duration-200"
              style={{
                background: "hsl(var(--primary) / 0.10)",
                color: "hsl(var(--primary))",
              }}
            >
              <Search className="w-4 h-4" />
              Rechercher
            </button>

            <button
              onClick={() => navigate("/radio")}
              className="flex items-center justify-center gap-2 py-3 rounded-full text-[12px] font-semibold active:scale-[0.95] transition-all duration-200"
              style={{
                background: "hsl(var(--primary) / 0.10)",
                color: "hsl(var(--primary))",
              }}
            >
              <Radio className="w-4 h-4" />
              Radio
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
