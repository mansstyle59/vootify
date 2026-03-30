import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi, Check, Loader2 } from "lucide-react";
import { getPendingCount } from "@/lib/offlineQueue";
import { toast } from "sonner";

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowBanner(true);
        setSyncing(true);
        // Banner will be updated by sync-done event
      }
    };
    const goOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowBanner(true);
    };

    const onSyncDone = (e: Event) => {
      const count = (e as CustomEvent).detail?.count || 0;
      setSyncing(false);
      if (count > 0) {
        toast.success(`${count} action${count > 1 ? "s" : ""} synchronisée${count > 1 ? "s" : ""}`);
      }
      setTimeout(() => setShowBanner(false), 2500);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("offline-sync-done", onSyncDone);

    // Also hide banner after timeout if no sync event fires
    let timer: ReturnType<typeof setTimeout>;
    if (showBanner && isOnline) {
      timer = setTimeout(() => {
        setSyncing(false);
        setShowBanner(false);
      }, 5000);
    }

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("offline-sync-done", onSyncDone);
      clearTimeout(timer);
    };
  }, [wasOffline, showBanner, isOnline]);

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
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{syncing ? "Synchronisation…" : "Connexion rétablie"}</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span>Mode hors-ligne</span>
              {pending > 0 && (
                <span className="text-xs opacity-80 ml-1">
                  · {pending} action{pending > 1 ? "s" : ""} en attente
                </span>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
