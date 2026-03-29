import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useMemo } from "react";
import { LogIn, LogOut, Headphones, Shuffle, Heart, Search, User, Music2, Radio } from "lucide-react";
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

/* ── Floating particles for immersion ── */
const PARTICLES = Array.from({ length: 8 }).map((_, i) => ({
  id: i,
  size: 2 + Math.random() * 3,
  x: 10 + Math.random() * 80,
  y: 20 + Math.random() * 60,
  duration: 6 + Math.random() * 8,
  delay: Math.random() * 4,
}));

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
            {/* Deep mesh gradient */}
            <div className="absolute inset-0" style={{
              background: `
                radial-gradient(ellipse 90% 60% at 15% 5%, hsl(var(--primary) / 0.22) 0%, transparent 50%),
                radial-gradient(ellipse 70% 50% at 85% 25%, hsl(var(--primary) / 0.14) 0%, transparent 45%),
                radial-gradient(ellipse 50% 70% at 40% 90%, hsl(var(--primary) / 0.08) 0%, transparent 55%),
                radial-gradient(ellipse 100% 80% at 50% 50%, hsl(var(--primary) / 0.03) 0%, transparent 70%),
                hsl(var(--background))
              `,
            }} />
            {/* Primary glow orb */}
            <motion.div
              className="absolute w-[260px] h-[260px] rounded-full"
              style={{
                top: "5%",
                left: "10%",
                background: "radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 65%)",
                filter: "blur(50px)",
              }}
              animate={{
                x: [0, 40, -15, 25, 0],
                y: [0, -20, 15, -8, 0],
                scale: [1, 1.1, 0.95, 1.05, 1],
              }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Secondary glow orb */}
            <motion.div
              className="absolute w-[180px] h-[180px] rounded-full"
              style={{
                bottom: "15%",
                right: "5%",
                background: "radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 70%)",
                filter: "blur(40px)",
              }}
              animate={{
                x: [0, -20, 10, -15, 0],
                y: [0, 10, -12, 6, 0],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            />
            {/* Floating particles */}
            {PARTICLES.map((p) => (
              <motion.div
                key={p.id}
                className="absolute rounded-full"
                style={{
                  width: p.size,
                  height: p.size,
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  background: "hsl(var(--primary) / 0.25)",
                }}
                animate={{
                  y: [0, -20, 5, -10, 0],
                  opacity: [0.15, 0.4, 0.2, 0.35, 0.15],
                }}
                transition={{
                  duration: p.duration,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: p.delay,
                }}
              />
            ))}
          </>
        )}
      </motion.div>

      {/* ─── Top bar ─── */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-5 md:px-8 py-2.5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.625rem)" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-black tracking-wide uppercase" style={{ color: "hsl(var(--primary))" }}>Vootify</span>
          {currentSong && isPlaying && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
              style={{ background: "hsl(var(--primary) / 0.1)" }}
            >
              <Music2 className="w-2.5 h-2.5 text-primary" />
              <span className="text-[9px] font-bold text-primary tracking-wider uppercase">Live</span>
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
                  className="group relative flex items-center gap-2 pl-1 pr-3 py-1 rounded-full outline-none active:scale-[0.93] transition-all duration-200"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--foreground) / 0.06))",
                    backdropFilter: "blur(20px) saturate(1.6)",
                    WebkitBackdropFilter: "blur(20px) saturate(1.6)",
                    border: "1px solid hsl(var(--primary) / 0.12)",
                    boxShadow: "0 2px 12px hsl(var(--primary) / 0.08), inset 0 1px 0 hsl(var(--primary) / 0.06)",
                  }}
                >
                  <Avatar className="w-7 h-7 ring-[1.5px] ring-primary/30">
                    <AvatarImage src={avatarUrl} alt={displayName || "User"} />
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
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background" style={{ background: "hsl(var(--primary))", boxShadow: "0 0 6px hsl(var(--primary) / 0.5)" }} />
                  {getPendingCount() > 0 && (
                    <span
                      className="absolute -bottom-1 -right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[8px] font-bold border-2 border-background"
                      style={{
                        background: "hsl(var(--destructive))",
                        color: "hsl(var(--destructive-foreground))",
                        boxShadow: "0 2px 8px hsl(var(--destructive) / 0.4)",
                      }}
                    >
                      {getPendingCount()}
                    </span>
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
                <div className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl" style={{ background: "hsl(var(--primary) / 0.06)" }}>
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
                      <span className="text-[9px] font-medium" style={{ color: "hsl(var(--primary) / 0.7)" }}>En ligne</span>
                    </div>
                  </div>
                </div>

                <DropdownMenuSeparator className="my-1.5" style={{ background: "hsl(var(--border) / 0.06)" }} />

                <DropdownMenuItem onClick={() => navigate("/profile")} className="rounded-xl gap-3 py-2.5 px-3 cursor-pointer group/item transition-all duration-150">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 group-hover/item:scale-110" style={{ background: "hsl(var(--primary) / 0.1)" }}>
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
        className="relative z-10 px-5 md:px-8 pt-2 pb-6"
      >
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="text-[34px] md:text-[40px] font-black text-foreground leading-[1.02] tracking-tight">
            {getGreeting()}
            <span className="inline-block ml-2 align-middle">
              <span className="inline-flex items-end gap-[2px] h-5 opacity-20">
                {Array.from({ length: 5 }).map((_, i) => (
                  <motion.span
                    key={i}
                    className="w-[2px] rounded-full inline-block"
                    style={{ background: "hsl(var(--primary))" }}
                    animate={{ height: [2, 8 + Math.random() * 10, 3, 12 + Math.random() * 6, 2] }}
                    transition={{ duration: 2 + Math.random() * 1, repeat: Infinity, ease: "easeInOut", delay: i * 0.1 }}
                  />
                ))}
              </span>
            </span>
          </h1>
        </motion.div>

        {/* Quote with decorative line */}
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex items-center gap-2.5 mt-2"
        >
          <div className="w-[3px] h-4 rounded-full" style={{ background: "hsl(var(--primary) / 0.35)" }} />
          <p className="text-[12px] font-medium italic" style={{ color: "hsl(var(--primary) / 0.55)" }}>
            {customSubtitle || quote}
          </p>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex flex-col gap-2.5 mt-6"
        >
          {/* Primary CTA — Shuffle with glow */}
          <button
            onClick={handleShuffle}
            className="relative flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl text-[14px] font-bold active:scale-[0.97] transition-all duration-200 overflow-hidden"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.08))",
              color: "hsl(var(--primary))",
              border: "1px solid hsl(var(--primary) / 0.2)",
              boxShadow: "0 4px 20px hsl(var(--primary) / 0.1), inset 0 1px 0 hsl(var(--primary) / 0.1)",
            }}
          >
            {/* Shimmer effect */}
            <div
              className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite]"
              style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.06), transparent)" }}
            />
            <Shuffle className="w-[18px] h-[18px] relative z-10" />
            <span className="relative z-10">Lecture aléatoire</span>
          </button>

          {/* Secondary actions */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: Heart, label: "Favoris", route: "/library" },
              { icon: Search, label: "Rechercher", route: "/search" },
              { icon: Radio, label: "Radio", route: "/radio" },
            ].map(({ icon: Icon, label, route }) => (
              <button
                key={route}
                onClick={() => navigate(route)}
                className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-[11px] font-semibold active:scale-[0.95] transition-all duration-200"
                style={{
                  background: "hsl(var(--foreground) / 0.04)",
                  color: "hsl(var(--foreground) / 0.7)",
                  border: "1px solid hsl(var(--foreground) / 0.06)",
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
