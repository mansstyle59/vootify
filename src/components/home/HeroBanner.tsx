import { motion, useScroll, useTransform, animate } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { LogIn, LogOut, Headphones, Music, Radio, ListMusic } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{
        background: "hsl(var(--card) / 0.4)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid hsl(var(--border) / 0.3)",
      }}
    >
      <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
      <span className="text-base font-black text-foreground tabular-nums">{display}</span>
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
    </motion.div>
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

function getSubGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Commencez la journée en musique";
  if (h < 18) return "La bande-son de votre après-midi";
  return "Détendez-vous avec vos morceaux préférés";
}

export function HeroBanner({ onCustomize, customSubtitle, bgColor, bgImage }: { onCustomize?: () => void; customSubtitle?: string; bgColor?: string; bgImage?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const blurValue = useTransform(scrollYProgress, [0, 0.5], [0, 8]);

  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0];
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div ref={ref} className="relative overflow-hidden mb-2" style={{ minHeight: "220px" }}>
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
              animate={{
                x: [0, 15, -10, 0],
                y: [0, -10, 8, 0],
              }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-20 -left-10 w-72 h-72 rounded-full"
              style={{
                background: "radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 65%)",
                filter: "blur(40px)",
              }}
            />

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

            {/* Subtle noise texture overlay */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              }}
            />
          </>
        )}
      </motion.div>

      {/* Bottom gradient fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 z-[1]"
        style={{ background: "linear-gradient(to top, hsl(var(--background)), hsl(var(--background) / 0.6) 40%, transparent)" }}
      />

      {/* User / Login pill — top right */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 25 }}
        className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] right-4 z-20"
      >
         {user ? (
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full transition-all duration-200"
              style={{
                background: "hsl(var(--card) / 0.6)",
                backdropFilter: "blur(20px) saturate(1.8)",
                WebkitBackdropFilter: "blur(20px) saturate(1.8)",
                border: "1px solid hsl(var(--border) / 0.4)",
                boxShadow: "0 4px 20px hsl(0 0% 0% / 0.15), inset 0 1px 0 hsl(0 0% 100% / 0.03)",
              }}
            >
              <Avatar className="w-7 h-7 ring-2 ring-primary/25">
                <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                <AvatarFallback className="text-[10px] font-bold bg-primary/15 text-primary">
                  {(displayName || "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-bold text-foreground truncate max-w-[80px]">
                {displayName}
              </span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => signOut()}
              className="flex items-center justify-center w-8 h-8 rounded-full transition-all"
              style={{
                background: "hsl(var(--card) / 0.6)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid hsl(var(--border) / 0.4)",
              }}
              title="Déconnexion"
            >
              <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
            </motion.button>
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
        style={{ opacity }}
        className="relative z-10 px-5 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-4 flex flex-col justify-end gpu-layer"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1, type: "spring", stiffness: 200 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full w-fit mb-3 mt-1"
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
          <span className="text-[11px] font-extrabold text-primary tracking-[0.15em] uppercase">Vootify</span>
        </motion.div>

        {/* Greeting */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, type: "spring", stiffness: 120 }}
          className="text-[24px] md:text-[32px] font-black text-foreground mb-1 leading-[1.1] tracking-tight"
        >
          {getGreeting(user ? displayName : null)}{" "}
          <motion.span
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 400, damping: 12 }}
            className="inline-block"
          >
            {getGreetingEmoji()}
          </motion.span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="text-[12px] md:text-[13px] text-muted-foreground max-w-md leading-relaxed"
        >
          {customSubtitle || getSubGreeting()}
        </motion.p>

        {/* Animated stats */}
        {stats && (stats.songs > 0 || stats.radios > 0 || stats.playlists > 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap gap-2 mt-3"
          >
            {stats.songs > 0 && <AnimatedCounter value={stats.songs} label="titres" icon={Music} delay={0.5} />}
            {stats.radios > 0 && <AnimatedCounter value={stats.radios} label="radios" icon={Radio} delay={0.65} />}
            {stats.playlists > 0 && <AnimatedCounter value={stats.playlists} label="playlists" icon={ListMusic} delay={0.8} />}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
