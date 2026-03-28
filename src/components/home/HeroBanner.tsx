import { motion, useScroll, useTransform, useMotionValueEvent, animate } from "framer-motion";
import { useRef, useEffect, useState, useMemo } from "react";
import { LogIn, LogOut, Headphones, Music, Radio, ListMusic, Shuffle, Heart, Search, Settings, User } from "lucide-react";
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";

/* ── Daily music quotes ── */
const QUOTES = [
  { text: "La musique est le langage des émotions.", author: "Emmanuel Kant" },
  { text: "Sans musique, la vie serait une erreur.", author: "Friedrich Nietzsche" },
  { text: "La musique donne une âme à nos cœurs.", author: "Platon" },
  { text: "Un seul morceau peut changer ta journée.", author: "Vootify" },
  { text: "Là où les mots s'arrêtent, la musique commence.", author: "Heinrich Heine" },
  { text: "La vie sans musique est tout simplement une erreur.", author: "Nietzsche" },
  { text: "La musique exprime ce qui ne peut être dit.", author: "Victor Hugo" },
  { text: "Chaque jour mérite sa bande-son.", author: "Vootify" },
  { text: "La musique est la nourriture de l'amour.", author: "Shakespeare" },
  { text: "Écouter, c'est déjà voyager.", author: "Vootify" },
  { text: "La musique commence là où le pouvoir des mots s'arrête.", author: "Richard Wagner" },
  { text: "Le rythme est l'architecture du temps.", author: "Vootify" },
];

function getDailyQuote() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

/* ── Animated counter ── */
function AnimatedCounter({ value, label, icon: Icon, delay }: { value: number; label: string; icon: React.ElementType; delay: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    const controls = animate(0, value, {
      duration: 1.2,
      delay,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, delay]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay + 0.1, type: "spring", stiffness: 200, damping: 20 }}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
      style={{
        background: "hsl(var(--card) / 0.4)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid hsl(var(--border) / 0.3)",
      }}
    >
      <Icon className="w-3 h-3 text-primary flex-shrink-0" />
      <span className="text-sm font-black text-foreground tabular-nums">{display}</span>
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
    </motion.div>
  );
}

/* ── Floating music note particle ── */
function FloatingNote({ delay, x, size }: { delay: number; x: number; size: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, x, scale: 0 }}
      animate={{
        opacity: [0, 0.4, 0.2, 0],
        y: [40, -20, -60, -100],
        x: [x, x + 15, x - 10, x + 5],
        scale: [0, 1, 0.8, 0.3],
        rotate: [0, 15, -10, 20],
      }}
      transition={{
        duration: 6,
        delay,
        repeat: Infinity,
        ease: "easeOut",
      }}
      className="absolute bottom-8 pointer-events-none"
      style={{ left: `${x}%` }}
    >
      <Music className="text-primary/30" style={{ width: size, height: size }} />
    </motion.div>
  );
}

/* ── Sound wave visualizer bars ── */
function SoundWave() {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {[0, 0.15, 0.3, 0.1, 0.25].map((d, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-primary/25"
          animate={{ height: ["30%", "100%", "50%", "80%", "30%"] }}
          transition={{
            duration: 1.2,
            delay: d,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function getGreeting(name?: string | null) {
  const h = new Date().getHours();
  const base = h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
  return name ? `${base}, ${name}` : `${base}`;
}

function getGreetingEmoji() {
  const h = new Date().getHours();
  if (h < 12) return "☀️";
  if (h < 18) return "👋";
  return "🌙";
}

export function HeroBanner({ onCustomize, customSubtitle, bgColor, bgImage }: { onCustomize?: () => void; customSubtitle?: string; bgColor?: string; bgImage?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { play, setQueue } = usePlayerStore();
  const quote = useMemo(() => getDailyQuote(), []);

  const { data: stats } = useQuery({
    queryKey: ["hero-stats"],
    queryFn: async () => {
      const [songs, radios, playlists] = await Promise.all([
        supabase.from("custom_songs").select("id", { count: "exact", head: true }),
        supabase.from("custom_radio_stations").select("id", { count: "exact", head: true }),
        supabase.from("playlists").select("id", { count: "exact", head: true }),
      ]);
      return {
        songs: songs.count || 0,
        radios: radios.count || 0,
        playlists: playlists.count || 0,
      };
    },
    staleTime: 5 * 60 * 1000,
  });


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

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 50]);
  const orbY = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const blur = useTransform(scrollYProgress, [0, 0.6], [0, 12]);
  const [blurPx, setBlurPx] = useState(0);
  useMotionValueEvent(blur, "change", (v) => setBlurPx(v));

  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0];
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div ref={ref} className="relative overflow-hidden mb-2">
      {/* Parallax background layer */}
      <motion.div style={{ y, scale }} className="absolute inset-0 -z-10 gpu-layer">
        {bgImage ? (
          <>
            <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(var(--background) / 0.3) 0%, hsl(var(--background) / 0.7) 60%, hsl(var(--background)) 100%)" }} />
          </>
        ) : bgColor ? (
          <>
            <div className="absolute inset-0" style={{ background: bgColor }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, hsl(var(--background)) 100%)" }} />
          </>
        ) : (
          <>
            {/* Animated mesh gradient background */}
            <div className="absolute inset-0 hero-mesh-bg" />

            {/* Primary glow orb — top left */}
            <motion.div
              style={{ y: orbY }}
              animate={{
                x: [0, 15, -10, 0],
                y: [0, -10, 8, 0],
              }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-20 -left-10 w-72 h-72 rounded-full gpu-layer"
              initial={{ opacity: 0, scale: 0.6 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <div className="w-full h-full rounded-full" style={{
                background: "radial-gradient(circle, hsl(var(--primary) / 0.2) 0%, transparent 65%)",
                filter: "blur(40px)",
              }} />
            </motion.div>

            {/* Secondary orb — right */}
            <motion.div
              animate={{
                x: [0, -12, 8, 0],
                y: [0, 15, -5, 0],
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-10 -right-16 w-64 h-64 rounded-full"
              style={{
                background: "radial-gradient(circle, hsl(var(--accent) / 0.12) 0%, transparent 65%)",
                filter: "blur(50px)",
              }}
            />

            {/* Third orb — center bottom */}
            <motion.div
              animate={{
                x: [0, 20, -15, 0],
                y: [0, -8, 12, 0],
                opacity: [0.08, 0.15, 0.1, 0.08],
              }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full"
              style={{
                background: "radial-gradient(circle, hsl(var(--primary) / 0.1) 0%, transparent 70%)",
                filter: "blur(35px)",
              }}
            />

            {/* Noise texture overlay */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              }}
            />

            {/* Floating music notes */}
            <FloatingNote delay={0} x={15} size={14} />
            <FloatingNote delay={2} x={70} size={10} />
            <FloatingNote delay={4} x={45} size={12} />
            <FloatingNote delay={1.5} x={85} size={9} />
          </>
        )}
      </motion.div>

      {/* Progressive blur overlay on scroll */}
      {blurPx > 0.1 && (
        <div
          className="absolute inset-0 z-[1] pointer-events-none gpu-layer"
          style={{
            backdropFilter: `blur(${blurPx}px)`,
            WebkitBackdropFilter: `blur(${blurPx}px)`,
          }}
        />
      )}

      {/* Bottom gradient fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 z-[1]"
        style={{ background: "linear-gradient(to top, hsl(var(--background)), hsl(var(--background) / 0.6) 40%, transparent)" }}
      />

      {/* Top bar — badge left, profile right */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 25 }}
        className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] left-4 right-4 z-20 flex items-center justify-between"
      >
        {/* Left: VOOTIFY badge + sound wave */}
        <div className="flex items-center gap-2.5">
          <div
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
            style={{
              background: "hsl(var(--primary) / 0.1)",
              border: "1px solid hsl(var(--primary) / 0.15)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 rounded-full"
              style={{ background: "var(--gradient-primary)", boxShadow: "0 0 8px hsl(var(--primary) / 0.5)" }}
            />
            <Headphones className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-extrabold text-primary tracking-[0.15em] uppercase">Vootify</span>
          </div>
          <SoundWave />
        </div>

        {/* Right: Profile / Login */}
         {user ? (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full transition-all duration-200 outline-none"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--card) / 0.7) 0%, hsl(var(--card) / 0.5) 100%)",
                    backdropFilter: "blur(24px) saturate(2)",
                    WebkitBackdropFilter: "blur(24px) saturate(2)",
                    border: "1px solid hsl(var(--primary) / 0.15)",
                    boxShadow: "0 4px 24px hsl(0 0% 0% / 0.2), 0 0 0 0.5px hsl(var(--primary) / 0.1), inset 0 1px 0 hsl(0 0% 100% / 0.05)",
                  }}
                >
                  <Avatar className="w-8 h-8 ring-[1.5px] ring-primary/30 shadow-md">
                    <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                    <AvatarFallback
                      className="text-[11px] font-extrabold"
                      style={{
                        background: "linear-gradient(135deg, hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.1))",
                        color: "hsl(var(--primary))",
                      }}
                    >
                      {(displayName || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[13px] font-bold text-foreground truncate max-w-[90px]">
                    {displayName}
                  </span>
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="text-muted-foreground/60 flex-shrink-0 -ml-0.5">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-2xl p-2 border-border/50"
                sideOffset={8}
                style={{
                  background: "hsl(var(--card) / 0.92)",
                  backdropFilter: "blur(40px) saturate(1.8)",
                  WebkitBackdropFilter: "blur(40px) saturate(1.8)",
                  boxShadow: "0 16px 48px hsl(0 0% 0% / 0.35), 0 0 0 1px hsl(var(--border) / 0.3)",
                }}
              >
                <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1">
                  <Avatar className="w-9 h-9 ring-[1.5px] ring-primary/20">
                    <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                    <AvatarFallback
                      className="text-[11px] font-extrabold"
                      style={{
                        background: "linear-gradient(135deg, hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.1))",
                        color: "hsl(var(--primary))",
                      }}
                    >
                      {(displayName || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator className="bg-border/30 my-1" />
                <DropdownMenuItem onClick={() => navigate("/profile")} className="rounded-xl gap-2.5 py-2.5 px-2.5 cursor-pointer">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="font-medium text-[13px]">Mon profil</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/audio-settings")} className="rounded-xl gap-2.5 py-2.5 px-2.5 cursor-pointer">
                  <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <span className="font-medium text-[13px]">Paramètres audio</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/30 my-1" />
                <DropdownMenuItem onClick={() => signOut()} className="rounded-xl gap-2.5 py-2.5 px-2.5 cursor-pointer text-destructive focus:text-destructive">
                  <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <LogOut className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium text-[13px]">Déconnexion</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <NotificationBell />
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.93 }}
            whileHover={{ scale: 1.03 }}
            onClick={() => navigate("/auth")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all"
            style={{
              background: "var(--gradient-primary)",
              color: "hsl(var(--primary-foreground))",
              boxShadow: "0 4px 24px hsl(var(--primary) / 0.3), 0 0 0 1px hsl(var(--primary) / 0.15)",
            }}
          >
            <LogIn className="w-4 h-4" />
            Connexion
          </motion.button>
        )}
      </motion.div>

      {/* Main content */}
      <motion.div
        style={{ opacity, y: contentY }}
        className="relative z-10 px-5 md:px-10 pt-[calc(env(safe-area-inset-top,0px)+4rem)] pb-6 flex flex-col gpu-layer"
      >
        {/* Daily quote */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="text-[13px] md:text-[14px] text-muted-foreground max-w-[320px] md:max-w-lg leading-relaxed italic"
        >
          « {quote.text} »
          <span className="not-italic text-[10px] text-muted-foreground/60 ml-1">— {quote.author}</span>
        </motion.p>

        {/* Quick action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="flex gap-3 mt-5"
        >
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={handleShuffle}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-bold transition-colors"
            style={{
              background: "var(--gradient-primary)",
              color: "hsl(var(--primary-foreground))",
              boxShadow: "0 4px 20px hsl(var(--primary) / 0.35)",
            }}
          >
            <Shuffle className="w-4 h-4" />
            Aléatoire
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => navigate("/library")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-bold transition-colors"
            style={{
              background: "hsl(var(--card) / 0.5)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid hsl(var(--border) / 0.3)",
              color: "hsl(var(--foreground))",
            }}
          >
            <Heart className="w-4 h-4 text-pink-400" />
            Favoris
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => navigate("/search")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-bold transition-colors"
            style={{
              background: "hsl(var(--card) / 0.5)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid hsl(var(--border) / 0.3)",
              color: "hsl(var(--foreground))",
            }}
          >
            <Search className="w-4 h-4" />
            Chercher
          </motion.button>
        </motion.div>


      </motion.div>
    </div>
  );
}
