import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { useRef, useMemo, useState } from "react";
import { LogIn, LogOut, Headphones, Shuffle, Heart, Search, Settings, User, Sparkles } from "lucide-react";
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
  { text: "Sans musique, la vie serait une erreur.", author: "Nietzsche" },
  { text: "La musique donne une âme à nos cœurs.", author: "Platon" },
  { text: "Un seul morceau peut changer ta journée.", author: "Vootify" },
  { text: "Là où les mots s'arrêtent, la musique commence.", author: "H. Heine" },
  { text: "La musique exprime ce qui ne peut être dit.", author: "V. Hugo" },
  { text: "Chaque jour mérite sa bande-son.", author: "Vootify" },
  { text: "Écouter, c'est déjà voyager.", author: "Vootify" },
  { text: "Le rythme est l'architecture du temps.", author: "Vootify" },
];

function getDailyQuote() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

/* ── Animated equalizer bars ── */
function EqualizerBars() {
  return (
    <div className="flex items-end gap-[1.5px] h-4">
      {[0, 0.12, 0.24, 0.08, 0.2, 0.16].map((d, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{
            width: 2.5,
            background: "hsl(var(--primary))",
            opacity: 0.5,
          }}
          animate={{ height: ["20%", "90%", "40%", "80%", "20%"] }}
          transition={{ duration: 1.0 + i * 0.1, delay: d, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function getGreeting(name?: string | null) {
  const h = new Date().getHours();
  const base = h < 6 ? "Bonne nuit" : h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
  return name ? `${base}, ${name}` : base;
}

export function HeroBanner({ customSubtitle, bgColor, bgImage }: { onCustomize?: () => void; customSubtitle?: string; bgColor?: string; bgImage?: string }) {
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
  const y = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.06]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 30]);
  const blur = useTransform(scrollYProgress, [0, 0.5], [0, 8]);
  const [blurPx, setBlurPx] = useState(0);
  useMotionValueEvent(blur, "change", (v) => setBlurPx(v));

  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0];
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div ref={ref} className="relative overflow-hidden mb-2">
      {/* Parallax BG */}
      <motion.div style={{ y, scale }} className="absolute inset-0 -z-10">
        {bgImage ? (
          <>
            <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(var(--background) / 0.15) 0%, hsl(var(--background) / 0.7) 55%, hsl(var(--background)) 100%)" }} />
          </>
        ) : bgColor ? (
          <>
            <div className="absolute inset-0" style={{ background: bgColor }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, hsl(var(--background)) 100%)" }} />
          </>
        ) : (
          <>
            <div className="absolute inset-0" style={{
              background: `
                radial-gradient(ellipse 80% 60% at 20% 10%, hsl(var(--primary) / 0.12) 0%, transparent 50%),
                radial-gradient(ellipse 60% 50% at 80% 30%, hsl(var(--accent) / 0.08) 0%, transparent 50%),
                radial-gradient(ellipse 70% 40% at 50% 90%, hsl(var(--primary) / 0.06) 0%, transparent 50%),
                hsl(var(--background))
              `,
            }} />
            {/* Floating orbs */}
            <motion.div
              animate={{ x: [0, 15, -10, 0], y: [0, -12, 8, 0], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-10 left-[10%] w-48 h-48 rounded-full"
              style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.12) 0%, transparent 65%)", filter: "blur(40px)" }}
            />
            <motion.div
              animate={{ x: [0, -12, 8, 0], y: [0, 10, -6, 0], opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-12 right-[5%] w-40 h-40 rounded-full"
              style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.1) 0%, transparent 60%)", filter: "blur(35px)" }}
            />
          </>
        )}
      </motion.div>

      {/* Scroll blur overlay */}
      {blurPx > 0.2 && (
        <div className="absolute inset-0 z-[1] pointer-events-none" style={{ backdropFilter: `blur(${blurPx}px)`, WebkitBackdropFilter: `blur(${blurPx}px)` }} />
      )}

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-16 z-[1]" style={{ background: "linear-gradient(to top, hsl(var(--background)), transparent)" }} />

      {/* ─── Top bar ─── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 280, damping: 24 }}
        className="absolute top-[calc(env(safe-area-inset-top,0px)+0.5rem)] left-4 right-4 z-20 flex items-center justify-between"
      >
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: "hsl(var(--card) / 0.45)",
              backdropFilter: "blur(20px) saturate(1.6)",
              WebkitBackdropFilter: "blur(20px) saturate(1.6)",
              border: "1px solid hsl(var(--border) / 0.15)",
            }}
          >
            <Headphones className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-black text-primary tracking-[0.14em] uppercase">Vootify</span>
          </div>
          <EqualizerBars />
        </div>

        {/* Profile */}
        {user ? (
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  className="flex items-center gap-1.5 pl-0.5 pr-2.5 py-0.5 rounded-full outline-none"
                  style={{
                    background: "hsl(var(--card) / 0.45)",
                    backdropFilter: "blur(20px) saturate(1.6)",
                    WebkitBackdropFilter: "blur(20px) saturate(1.6)",
                    border: "1px solid hsl(var(--border) / 0.15)",
                  }}
                >
                  <Avatar className="w-7 h-7 ring-1 ring-primary/15">
                    <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                    <AvatarFallback className="text-[10px] font-bold bg-primary/15 text-primary">
                      {(displayName || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] font-bold text-foreground truncate max-w-[72px]">{displayName}</span>
                </motion.button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-2xl p-1.5 border-border/40"
                sideOffset={8}
                style={{
                  background: "hsl(var(--card) / 0.92)",
                  backdropFilter: "blur(40px) saturate(1.8)",
                  WebkitBackdropFilter: "blur(40px) saturate(1.8)",
                  boxShadow: "0 20px 60px hsl(0 0% 0% / 0.4)",
                }}
              >
                <div className="flex items-center gap-2.5 px-2.5 py-2 mb-0.5">
                  <Avatar className="w-9 h-9 ring-1 ring-primary/15">
                    <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                    <AvatarFallback className="text-[11px] font-bold bg-primary/15 text-primary">
                      {(displayName || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{displayName}</p>
                    <p className="text-[10px] text-muted-foreground/60 truncate">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator className="bg-border/20 my-1" />
                <DropdownMenuItem onClick={() => navigate("/profile")} className="rounded-xl gap-2.5 py-2 px-2.5 cursor-pointer">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center"><User className="w-3 h-3 text-primary" /></div>
                  <span className="font-medium text-[12px]">Mon profil</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/audio-settings")} className="rounded-xl gap-2.5 py-2 px-2.5 cursor-pointer">
                  <div className="w-6 h-6 rounded-lg bg-secondary flex items-center justify-center"><Settings className="w-3 h-3 text-muted-foreground" /></div>
                  <span className="font-medium text-[12px]">Paramètres audio</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/20 my-1" />
                <DropdownMenuItem onClick={() => signOut()} className="rounded-xl gap-2.5 py-2 px-2.5 cursor-pointer text-destructive focus:text-destructive">
                  <div className="w-6 h-6 rounded-lg bg-destructive/10 flex items-center justify-center"><LogOut className="w-3 h-3" /></div>
                  <span className="font-medium text-[12px]">Déconnexion</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => navigate("/auth")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-bold bg-primary text-primary-foreground"
            style={{ boxShadow: "0 4px 20px hsl(var(--primary) / 0.35)" }}
          >
            <LogIn className="w-3.5 h-3.5" />
            Connexion
          </motion.button>
        )}
      </motion.div>

      {/* ─── Main content ─── */}
      <motion.div
        style={{ opacity, y: contentY }}
        className="relative z-10 px-5 md:px-10 pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] pb-4"
      >
        {/* Greeting */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
          className="text-[24px] md:text-[28px] font-black text-foreground leading-[1.1] tracking-tight"
        >
          {getGreeting(displayName)}
        </motion.h1>

        {/* Quote */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="flex items-start gap-1.5 mt-2"
        >
          <Sparkles className="w-3 h-3 text-primary/40 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] md:text-[12px] text-muted-foreground/60 max-w-[280px] leading-relaxed italic">
            {quote.text}
            <span className="not-italic text-[9px] text-muted-foreground/30 ml-1.5">— {quote.author}</span>
          </p>
        </motion.div>

        {/* Action chips */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.35 }}
          className="flex gap-2 mt-4"
        >
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleShuffle}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[11px] font-bold bg-primary text-primary-foreground"
            style={{ boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)" }}
          >
            <Shuffle className="w-3.5 h-3.5" />
            Lecture aléatoire
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate("/library")}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-[11px] font-semibold text-foreground"
            style={{
              background: "hsl(var(--secondary) / 0.5)",
              backdropFilter: "blur(12px)",
              border: "1px solid hsl(var(--border) / 0.15)",
            }}
          >
            <Heart className="w-3 h-3 text-pink-400" />
            Favoris
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate("/search")}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-[11px] font-semibold text-foreground"
            style={{
              background: "hsl(var(--secondary) / 0.5)",
              backdropFilter: "blur(12px)",
              border: "1px solid hsl(var(--border) / 0.15)",
            }}
          >
            <Search className="w-3 h-3" />
            Chercher
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
