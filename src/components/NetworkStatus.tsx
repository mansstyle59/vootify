import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi } from "lucide-react";

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

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={`fixed top-0 left-0 right-0 z-[150] flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium ${
            isOnline
              ? "bg-primary text-primary-foreground"
              : "bg-destructive text-destructive-foreground"
          }`}
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.625rem)" }}
        >
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4" />
              <span>Connexion rétablie</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span>Vous êtes hors-ligne</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
