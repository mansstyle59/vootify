import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi, Download } from "lucide-react";
import { getPendingCount } from "@/lib/offlineQueue";

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowBanner(true);
        setTimeout(() => setShowBanner(false), 3000);
      }
    };
    const goOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowBanner(true);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [wasOffline]);

  const pending = !isOnline ? getPendingCount() : 0;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed top-0 left-0 right-0 z-[150] flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.625rem)",
            background: isOnline
              ? "hsl(var(--primary))"
              : "linear-gradient(135deg, hsl(var(--destructive)) 0%, hsl(var(--destructive) / 0.9) 100%)",
            color: isOnline
              ? "hsl(var(--primary-foreground))"
              : "hsl(var(--destructive-foreground))",
          }}
        >
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4" />
              <span>Connexion rétablie</span>
              {pending > 0 && (
                <span className="text-xs opacity-80 ml-1">
                  · {pending} action(s) en cours de sync
                </span>
              )}
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span>Mode hors-ligne</span>
              <span className="text-xs opacity-80 ml-1">
                · Contenu en cache disponible
              </span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
