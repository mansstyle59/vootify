import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { LogIn, LogOut } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

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

export function HeroBanner({ onCustomize, customSubtitle }: { onCustomize?: () => void; customSubtitle?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 50]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.05]);

  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0];
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div ref={ref} className="relative overflow-hidden mb-1" style={{ minHeight: "260px" }}>
      {/* Parallax background */}
      <motion.div style={{ y, scale }} className="absolute inset-0 -z-10 gpu-layer">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(160deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--accent) / 0.05) 40%, hsl(var(--background)) 100%)",
          }}
        />
        <div
          className="absolute top-0 right-0 w-80 h-80 rounded-full -translate-y-1/3 translate-x-1/4"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 70%)",
          }}
        />
      </motion.div>

      {/* Bottom fade to background */}
      <div
        className="absolute bottom-0 left-0 right-0 h-20 z-[1]"
        style={{ background: "linear-gradient(to top, hsl(var(--background)), transparent)" }}
      />

      {/* User / Login — top right */}
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] right-4 z-20"
      >
        {user ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full transition-all duration-200"
              style={{
                background: "hsl(var(--card) / 0.7)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid hsl(var(--border) / 0.5)",
                boxShadow: "0 2px 12px hsl(0 0% 0% / 0.06)",
              }}
            >
              <Avatar className="w-7 h-7 ring-2 ring-primary/20">
                <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                <AvatarFallback className="text-[10px] font-bold bg-primary/15 text-primary">
                  {(displayName || "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-semibold text-foreground truncate max-w-[80px]">
                {displayName}
              </span>
            </button>
            <button
              onClick={() => signOut()}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
              style={{
                background: "hsl(var(--card) / 0.7)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid hsl(var(--border) / 0.5)",
              }}
              title="Se déconnecter"
            >
              <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/auth")}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold transition-all"
            style={{ boxShadow: "0 4px 16px hsl(var(--primary) / 0.25)" }}
          >
            <LogIn className="w-4 h-4" />
            Connexion
          </motion.button>
        )}
      </motion.div>

      {/* Main content */}
      <motion.div
        style={{ opacity }}
        className="relative z-10 px-5 md:px-8 pt-14 pb-8 flex flex-col justify-end gpu-layer"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full w-fit mb-4"
          style={{
            background: "hsl(var(--primary) / 0.08)",
            border: "1px solid hsl(var(--primary) / 0.12)",
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] font-bold text-primary tracking-wider uppercase">Vootify Music</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35, ease: "easeOut" }}
          className="text-[28px] md:text-4xl font-extrabold text-foreground mb-1 leading-[1.15]"
        >
          {getGreeting(user ? displayName : null)} {getGreetingEmoji()}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-[14px] text-muted-foreground max-w-md leading-relaxed"
        >
          {customSubtitle || getSubGreeting()}
        </motion.p>
      </motion.div>
    </div>
  );
}
