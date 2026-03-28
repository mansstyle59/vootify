import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { useRef, useMemo, useState } from "react";
import { LogIn, LogOut, Headphones, Music, Shuffle, Heart, Search, Settings, User } from "lucide-react";
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

/* ── Sound wave visualizer ── */
function SoundWave() {
  return (
    <div className="flex items-end gap-[2px] h-3.5">
      {[0, 0.15, 0.3, 0.1, 0.25].map((d, i) => (
        <motion.div
          key={i}
          className="w-[2.5px] rounded-full bg-primary/30"
          animate={{ height: ["25%", "100%", "45%", "85%", "25%"] }}
          transition={{ duration: 1.2, delay: d, repeat: Infinity, ease: "easeInOut" }}
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

export function HeroBanner({ onCustomize, customSubtitle, bgColor, bgImage }: { onCustomize?: () => void; customSubtitle?: string; bgColor?: string; bgImage?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { play, setQueue } = usePlayerStore();
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
  const y = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 40]);
  const blur = useTransform(scrollYProgress, [0, 0.6], [0, 10]);
  const [blurPx, setBlurPx] = useState(0);
  useMotionValueEvent(blur, "change", (v) => setBlurPx(v));

  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0];
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const greeting = getGreeting(displayName);

  return (
    <div ref={ref} className="relative overflow-hidden mb-1">
      {/* Parallax background */}
      <motion.div style={{ y, scale }} className="absolute inset-0 -z-10 gpu-layer">
        {bgImage ? (
          <>
            <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(var(--background) / 0.2) 0%, hsl(var(--background) / 0.65) 50%, hsl(var(--background)) 100%)" }} />
          </>
        ) : bgColor ? (
          <>
            <div className="absolute inset-0" style={{ background: bgColor }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, hsl(var(--background)) 100%)" }} />
          </>
        ) : (
          <>
            <div className="absolute inset-0 hero-mesh-bg" />
            {/* Single subtle glow */}
            <motion.div
              animate={{ x: [0, 12, -8, 0], y: [0, -8, 6, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-16 -left-8 w-64 h-64 rounded-full"
              style={{
                background: "radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 60%)",
                filter: "blur(50px)",
              }}
            />
            <motion.div
              animate={{ x: [0, -10, 6, 0], y: [0, 12, -4, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-8 -right-12 w-52 h-52 rounded-full"
              style={{
                background: "radial-gradient(circle, hsl(var(--accent) / 0.1) 0%, transparent 60%)",
                filter: "blur(45px)",
              }}
            />
          </>
        )}
      </motion.div>

      {/* Scroll blur overlay */}
      {blurPx > 0.1 && (
        <div
          className="absolute inset-0 z-[1] pointer-events-none gpu-layer"
          style={{ backdropFilter: `blur(${blurPx}px)`, WebkitBackdropFilter: `blur(${blurPx}px)` }}
        />
      )}

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-20 z-[1]"
        style={{ background: "linear-gradient(to top, hsl(var(--background)), transparent)" }}
      />

      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 25 }}
        className="absolute top-[calc(env(safe-area-inset-top,0px)+0.5rem)] left-4 right-4 z-20 flex items-center justify-between"
      >
        {/* VOOTIFY badge */}
        <div className="flex items-center gap-2">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: "hsl(var(--card) / 0.5)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid hsl(var(--border) / 0.2)",
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-primary"
              style={{ boxShadow: "0 0 6px hsl(var(--primary) / 0.5)" }}
            />
            <Headphones className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-extrabold text-primary tracking-[0.12em] uppercase">Vootify</span>
          </div>
          <SoundWave />
        </div>

        {/* Profile */}
        {user ? (
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full outline-none"
                  style={{
                    background: "hsl(var(--card) / 0.5)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: "1px solid hsl(var(--border) / 0.2)",
                  }}
                >
                  <Avatar className="w-7 h-7 ring-1 ring-primary/20">
                    <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                    <AvatarFallback
                      className="text-[10px] font-bold"
                      style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}
                    >
                      {(displayName || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[12px] font-semibold text-foreground truncate max-w-[80px]">{displayName}</span>
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
                  boxShadow: "0 16px 48px hsl(0 0% 0% / 0.35)",
                }}
              >
                <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1">
                  <Avatar className="w-9 h-9 ring-1 ring-primary/20">
                    <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                    <AvatarFallback
                      className="text-[11px] font-bold"
                      style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}
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
            onClick={() => navigate("/auth")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold"
            style={{
              background: "var(--gradient-primary)",
              color: "hsl(var(--primary-foreground))",
              boxShadow: "0 4px 16px hsl(var(--primary) / 0.3)",
            }}
          >
            <LogIn className="w-3.5 h-3.5" />
            Connexion
          </motion.button>
        )}
      </motion.div>

      {/* Main content */}
      <motion.div
        style={{ opacity, y: contentY }}
        className="relative z-10 px-5 md:px-10 pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] pb-5 flex flex-col gpu-layer"
      >
        {/* Greeting */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="text-[22px] md:text-[26px] font-extrabold text-foreground leading-tight tracking-tight"
        >
          {greeting}
        </motion.h1>

        {/* Daily quote */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="text-[12px] md:text-[13px] text-muted-foreground/70 max-w-[300px] leading-relaxed mt-1.5 italic"
        >
          « {quote.text} »
          <span className="not-italic text-[10px] text-muted-foreground/40 ml-1">— {quote.author}</span>
        </motion.p>

        {/* Action pills */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.35 }}
          className="flex gap-2 mt-4"
        >
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={handleShuffle}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold"
            style={{
              background: "var(--gradient-primary)",
              color: "hsl(var(--primary-foreground))",
              boxShadow: "0 3px 16px hsl(var(--primary) / 0.3)",
            }}
          >
            <Shuffle className="w-3.5 h-3.5" />
            Aléatoire
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => navigate("/library")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-semibold"
            style={{
              background: "hsl(var(--secondary) / 0.6)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid hsl(var(--border) / 0.25)",
            }}
          >
            <Heart className="w-3.5 h-3.5 text-pink-400" />
            Favoris
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => navigate("/search")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-semibold"
            style={{
              background: "hsl(var(--secondary) / 0.6)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid hsl(var(--border) / 0.25)",
            }}
          >
            <Search className="w-3.5 h-3.5" />
            Chercher
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
