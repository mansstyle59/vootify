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

  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0];
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div ref={ref} className="relative overflow-hidden">
      {/* BG */}
      <div className="absolute inset-0 -z-10">
        {bgImage ? (
          <>
            <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(var(--background) / 0.3) 0%, hsl(var(--background)) 100%)" }} />
          </>
        ) : bgColor ? (
          <>
            <div className="absolute inset-0" style={{ background: bgColor }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, hsl(var(--background)) 100%)" }} />
          </>
        ) : (
          <div className="absolute inset-0" style={{
            background: `
              radial-gradient(ellipse 90% 60% at 30% 0%, hsl(var(--primary) / 0.1) 0%, transparent 60%),
              radial-gradient(ellipse 50% 50% at 90% 20%, hsl(var(--primary) / 0.05) 0%, transparent 50%),
              hsl(var(--background))
            `,
          }} />
        )}
      </div>

      {/* ─── Top bar ─── */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-5 md:px-8 py-2.5"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.625rem)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-black text-primary tracking-wide uppercase">Vootify</span>
        </div>

        {/* Profile */}
        {user ? (
          <div className="flex items-center gap-2">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="outline-none active:scale-95 transition-transform">
                  <Avatar className="w-8 h-8 ring-2 ring-primary/20">
                    <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                    <AvatarFallback
                      className="text-[11px] font-bold"
                      style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}
                    >
                      {(displayName || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-2xl p-1.5 border-border/40"
                sideOffset={8}
                style={{
                  background: "hsl(var(--card) / 0.92)",
                  backdropFilter: "blur(40px) saturate(1.8)",
                  WebkitBackdropFilter: "blur(40px) saturate(1.8)",
                  boxShadow: "0 20px 60px hsl(0 0% 0% / 0.5)",
                }}
              >
                <div className="flex items-center gap-2.5 px-2.5 py-2 mb-0.5">
                  <Avatar className="w-9 h-9 ring-1 ring-primary/15">
                    <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                    <AvatarFallback className="text-[11px] font-bold" style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}>
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
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.1)" }}><User className="w-3 h-3 text-primary" /></div>
                  <span className="font-medium text-[12px]">Mon profil</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/audio-settings")} className="rounded-xl gap-2.5 py-2 px-2.5 cursor-pointer">
                  <div className="w-6 h-6 rounded-lg bg-secondary flex items-center justify-center"><Settings className="w-3 h-3 text-muted-foreground" /></div>
                  <span className="font-medium text-[12px]">Paramètres audio</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/20 my-1" />
                <DropdownMenuItem onClick={() => signOut()} className="rounded-xl gap-2.5 py-2 px-2.5 cursor-pointer text-destructive focus:text-destructive">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "hsl(var(--destructive) / 0.1)" }}><LogOut className="w-3 h-3" /></div>
                  <span className="font-medium text-[12px]">Déconnexion</span>
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
        className="relative z-10 px-5 md:px-8 pt-4 pb-6"
      >
        {/* Large greeting — Apple Music editorial style */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-[32px] md:text-[38px] font-black text-foreground leading-[1.05] tracking-tight"
        >
          {getGreeting(displayName)}
        </motion.h1>

        {customSubtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-muted-foreground/60 mt-1 font-medium"
          >
            {customSubtitle}
          </motion.p>
        )}

        {/* Action pills */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.35 }}
          className="flex gap-2.5 mt-5"
        >
          <button
            onClick={handleShuffle}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[12px] font-bold active:scale-95 transition-transform"
            style={{
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              boxShadow: "0 4px 24px hsl(var(--primary) / 0.3)",
            }}
          >
            <Shuffle className="w-3.5 h-3.5" />
            Lecture aléatoire
          </button>
          <button
            onClick={() => navigate("/library")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-semibold text-foreground active:scale-95 transition-transform"
            style={{
              background: "hsl(var(--foreground) / 0.06)",
            }}
          >
            <Heart className="w-3 h-3 text-pink-400" />
            Favoris
          </button>
          <button
            onClick={() => navigate("/search")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-semibold text-foreground active:scale-95 transition-transform"
            style={{
              background: "hsl(var(--foreground) / 0.06)",
            }}
          >
            <Search className="w-3 h-3" />
            Chercher
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
