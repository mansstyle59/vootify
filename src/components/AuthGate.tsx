import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { WifiOff, Music, Download } from "lucide-react";
import { motion } from "framer-motion";

/**
 * AuthGate: requires login when online.
 * If offline and not authenticated → shows offline landing with access to cached content.
 * Allows /auth and /reset-password without auth.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Public routes that don't require auth
  const publicPaths = ["/auth", "/reset-password", "/request-access"];
  const isPublicRoute = publicPaths.some((p) => location.pathname.startsWith(p));

  // Still loading auth state → show nothing (splash handles visual)
  if (loading) return null;

  // Authenticated → pass through
  if (user) return <>{children}</>;

  // Public route → pass through (auth page, reset password)
  if (isPublicRoute) return <>{children}</>;

  // Not authenticated + ONLINE → redirect to auth
  if (isOnline) {
    return <RedirectToAuth />;
  }

  // Not authenticated + OFFLINE → show offline mode
  return <OfflineLanding />;
}

function RedirectToAuth() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    navigate("/auth", { replace: true, state: { from: location.pathname } });
  }, [navigate, location.pathname]);

  return null;
}

function OfflineLanding() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-sm"
      >
        <div className="relative inline-flex mb-6">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <WifiOff className="w-10 h-10 text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
            <Music className="w-4 h-4 text-accent" />
          </div>
        </div>

        <h1 className="text-2xl font-display font-bold text-foreground mb-2">
          Mode hors-ligne
        </h1>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          Vous n'êtes pas connecté à Internet. Accédez à vos morceaux téléchargés en mode hors-ligne.
        </p>

        <button
          onClick={() => navigate("/library")}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2.5"
        >
          <Download className="w-4 h-4" />
          Accéder à ma bibliothèque
        </button>

        <p className="text-xs text-muted-foreground mt-4">
          Connectez-vous à Internet pour accéder à tout votre contenu
        </p>
      </motion.div>
    </div>
  );
}
