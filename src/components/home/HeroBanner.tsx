import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { LogIn, LogOut, Settings2 } from "lucide-react";
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

  const y = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0];
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div ref={ref} className="relative overflow-hidden mb-2 pt-[env(safe-area-inset-top)]" style={{ minHeight: "260px" }}>
      {/* Parallax background with richer gradients */}
      <motion.div style={{ y, scale }} className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-accent/15 to-background" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/12 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/12 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4" />
        {/* Extra ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-[150px]" />
      </motion.div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent z-[1]" />

      {/* User / Login — top right */}
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        className="absolute top-[calc(env(safe-area-inset-top,0px)+1rem)] right-4 z-20"
      >
        {user ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full liquid-glass hover:bg-secondary/60 transition-all duration-200"
            >
              <Avatar className="w-7 h-7 ring-2 ring-primary/30">
                <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                <AvatarFallback className="text-[10px] font-bold bg-primary/20 text-primary">
                  {(displayName || "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-semibold text-foreground truncate max-w-[100px]">
                {displayName}
              </span>
            </button>
            <button
              onClick={() => signOut()}
              className="p-2 rounded-full liquid-glass hover:bg-destructive/20 transition-all duration-200"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/auth")}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-lg glow-primary transition-all"
          >
            <LogIn className="w-4 h-4" />
            Connexion
          </motion.button>
        )}
      </motion.div>

      {/* Main content */}
      <motion.div
        style={{ opacity }}
        className="relative z-10 px-5 md:px-8 pt-12 pb-8 flex flex-col justify-end"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 20 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 w-fit mb-3"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
          <span className="text-xs font-semibold text-primary tracking-wide uppercase">Vootify Music</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 150, damping: 20 }}
          className="text-3xl md:text-4xl font-display font-extrabold text-foreground mb-1.5 leading-tight"
        >
          {getGreeting(user ? displayName : null)} 👋
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-sm md:text-base text-muted-foreground max-w-md leading-relaxed"
        >
          {getSubGreeting()}
        </motion.p>

        <div className="flex items-center gap-3 mt-5">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
            className="h-[3px] w-20 rounded-full bg-gradient-to-r from-primary via-accent to-primary/30 origin-left"
          />
          {onCustomize && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ delay: 0.6 }}
              onClick={(e) => { e.stopPropagation(); onCustomize(); }}
              className="relative z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full liquid-glass hover:bg-secondary/60 transition-all duration-200 text-xs font-semibold text-muted-foreground"
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
