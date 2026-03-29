import { useMemo } from "react";
import { LogIn, LogOut, Headphones, Shuffle, User, ChevronDown } from "lucide-react";
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

export function HeroBanner({ customSubtitle, bgColor, bgImage }: { onCustomize?: () => void; customSubtitle?: string; bgColor?: string; bgImage?: string }) {
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

  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0];
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div className="relative">
      {/* ─── Top bar ─── */}
      <div
        className="flex items-center justify-between px-5 md:px-8 pb-1"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        {/* Large title */}
        <h1 className="text-[32px] md:text-[36px] font-black text-foreground leading-tight tracking-tight">
          {getGreeting()}
        </h1>

        {/* Profile / Login */}
        {user ? (
          <div className="flex items-center gap-2">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative outline-none active:scale-[0.92] transition-transform duration-150 flex items-center gap-1">
                  <div className="relative">
                    <Avatar className="w-8 h-8 ring-2 ring-primary/25">
                      <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                      <AvatarFallback
                        className="text-[10px] font-bold"
                        style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}
                      >
                        {(displayName || "U").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {getPendingCount() > 0 && (
                      <span
                        className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full flex items-center justify-center text-[8px] font-bold border-[1.5px] border-background"
                        style={{ background: "hsl(var(--destructive))", color: "hsl(var(--destructive-foreground))" }}
                      >
                        {getPendingCount()}
                      </span>
                    )}
                  </div>
                  <ChevronDown className="w-3 h-3 text-muted-foreground/60 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_3]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-2xl p-2 animate-scale-in"
                sideOffset={8}
                style={{
                  background: "hsl(var(--card) / 0.95)",
                  backdropFilter: "blur(60px) saturate(2)",
                  WebkitBackdropFilter: "blur(60px) saturate(2)",
                  border: "1px solid hsl(var(--border) / 0.1)",
                  boxShadow: "0 20px 60px hsl(0 0% 0% / 0.5)",
                }}
              >
                <div className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl" style={{ background: "hsl(var(--foreground) / 0.04)" }}>
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                    <AvatarFallback className="text-[11px] font-bold" style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}>
                      {(displayName || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-foreground truncate">{displayName}</p>
                    <p className="text-[10px] text-muted-foreground/50 truncate">{user.email}</p>
                  </div>
                </div>

                <DropdownMenuSeparator className="my-1" style={{ background: "hsl(var(--border) / 0.06)" }} />

                <DropdownMenuItem onClick={() => navigate("/profile")} className="rounded-xl gap-3 py-2.5 px-3 cursor-pointer transition-all duration-150">
                  <User className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-[13px]">Mon profil</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => navigate("/audio-settings")} className="rounded-xl gap-3 py-2.5 px-3 cursor-pointer transition-all duration-150">
                  <Headphones className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-[13px]">Paramètres audio</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1" style={{ background: "hsl(var(--border) / 0.06)" }} />

                <DropdownMenuItem onClick={() => signOut()} className="rounded-xl gap-3 py-2.5 px-3 cursor-pointer text-destructive focus:text-destructive transition-all duration-150">
                  <LogOut className="w-4 h-4" />
                  <span className="font-semibold text-[13px]">Déconnexion</span>
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

      {/* Subtitle / Quote */}
      <div className="px-5 md:px-8 pb-2">
        <p className="text-[13px] font-medium" style={{ color: "hsl(var(--muted-foreground) / 0.6)" }}>
          {customSubtitle || quote}
        </p>
      </div>

      {/* Shuffle button — Apple Music style inline */}
      <div className="px-5 md:px-8 pb-4">
        <button
          onClick={handleShuffle}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-bold active:scale-[0.96] transition-transform duration-150"
          style={{
            background: "hsl(var(--primary) / 0.12)",
            color: "hsl(var(--primary))",
          }}
        >
          <Shuffle className="w-4 h-4" />
          Lecture aléatoire
        </button>
      </div>
    </div>
  );
}
