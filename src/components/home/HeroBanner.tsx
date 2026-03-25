import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Play, Headphones, Music2, LogIn, LogOut, Settings2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

function getGreeting(name?: string | null) {
  const h = new Date().getHours();
  const base = h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
  return name ? `${base}, ${name}` : `${base}`;
}

function getSubGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Commencez la journée en musique";
  if (h < 18) return "La bande-son de votre après-midi";
  return "Détendez-vous avec vos morceaux préférés";
}

export function HeroBanner({ onCustomize }: { onCustomize?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);

  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0];
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div ref={ref} className="relative overflow-hidden mb-0" style={{ minHeight: "220px" }}>
      {/* Parallax background */}
      <motion.div
        style={{ y, scale }}
        className="absolute inset-0 -z-10"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-background" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/15 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-accent/15 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/4" />
      </motion.div>

      {/* Bottom fade to background */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent z-[1]" />

        <motion.div
          animate={{ y: [0, -12, 0], rotate: [0, 8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-10 right-8 text-primary/20"
        >
          <Music2 className="w-12 h-12" />
        </motion.div>
        <motion.div
          animate={{ y: [0, 10, 0], rotate: [0, -6, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-8 right-24 text-accent/15"
        >
          <Headphones className="w-10 h-10" />
        </motion.div>
        <motion.div
          animate={{ y: [0, -8, 0], x: [0, 6, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-16 left-[60%] text-primary/10"
        >
          <Play className="w-8 h-8" />
        </motion.div>

      {/* Login / User button — top right */}
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        className="absolute top-4 right-4 z-20"
      >
        {user ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 backdrop-blur-sm border border-border/50 hover:bg-secondary transition-colors"
            >
              <Avatar className="w-6 h-6">
                <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                <AvatarFallback className="text-[10px] font-semibold bg-primary/20 text-primary">
                  {(displayName || "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-foreground truncate max-w-[100px]">
                {displayName}
              </span>
            </button>
            <button
              onClick={() => signOut()}
              className="p-2 rounded-full bg-secondary/80 backdrop-blur-sm border border-border/50 hover:bg-destructive/20 transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate("/auth")}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg hover:opacity-90 transition-opacity"
          >
            <LogIn className="w-4 h-4" />
            Connexion
          </button>
        )}
      </motion.div>

      {/* Content */}
      <motion.div
        style={{ opacity }}
        className="relative z-10 px-4 md:px-8 pt-10 pb-6 flex flex-col justify-end"
      >
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-sm font-medium text-primary mb-1 tracking-wide uppercase"
        >
          Vootify Music
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2"
        >
          {getGreeting(user ? displayName : null)} 👋
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-sm md:text-base text-muted-foreground max-w-md"
        >
          {getSubGreeting()}
        </motion.p>

        <div className="flex items-center gap-3 mt-4">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
            className="h-0.5 w-16 rounded-full bg-gradient-to-r from-primary to-accent origin-left"
          />
          {onCustomize && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              onClick={(e) => { e.stopPropagation(); onCustomize(); }}
              className="relative z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/80 backdrop-blur-sm border border-border/50 hover:bg-secondary transition-colors text-xs font-medium text-muted-foreground"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Personnaliser
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
