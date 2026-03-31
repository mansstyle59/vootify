import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi, Check, Loader2, AlertTriangle } from "lucide-react";
import { getPendingCount, getPendingSummary } from "@/lib/offlineQueue";
import { toast } from "sonner";

const ACTION_LABELS: Record<string, string> = {
  like: "favoris",
  unlike: "favoris",
  play: "historique",
  playlist_add: "playlist",
  playlist_remove: "playlist",
  playlist_create: "playlist",
  playlist_rename: "playlist",
  search_history: "recherche",
  profile_update: "profil",
};

function formatPendingSummary(): string {
  const summary = getPendingSummary();
  const parts: string[] = [];
  const grouped: Record<string, number> = {};
  
  for (const [type, count] of Object.entries(summary)) {
    const label = ACTION_LABELS[type] || type;
    grouped[label] = (grouped[label] || 0) + count;
  }
  
  for (const [label, count] of Object.entries(grouped)) {
    parts.push(`${count} ${label}`);
  }
  
  return parts.join(", ");
}

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number } | null>(null);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowBanner(true);
        setSyncing(true);
        setSyncResult(null);
      }
    };
    const goOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowBanner(true);
      setSyncResult(null);
    };

    const onSyncDone = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const { synced = 0, failed = 0 } = detail;
      setSyncing(false);
      setSyncResult({ synced, failed });

      if (synced > 0 && failed === 0) {
        toast.success(`${synced} action${synced > 1 ? "s" : ""} synchronisée${synced > 1 ? "s" : ""}`, {
          description: "Toutes vos modifications hors-ligne sont à jour",
          duration: 3000,
        });
      } else if (synced > 0 && failed > 0) {
        toast.warning(`${synced} synchronisée${synced > 1 ? "s" : ""}, ${failed} échouée${failed > 1 ? "s" : ""}`, {
          description: "Les actions échouées seront réessayées",
          duration: 4000,
        });
      } else if (failed > 0) {
        toast.error(`${failed} action${failed > 1 ? "s" : ""} non synchronisée${failed > 1 ? "s" : ""}`, {
          description: "Nouvelle tentative automatique",
          duration: 4000,
        });
      }

      setTimeout(() => setShowBanner(false), synced > 0 ? 2500 : 4000);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("offline-sync-done", onSyncDone);

    let timer: ReturnType<typeof setTimeout>;
    if (showBanner && isOnline && !syncing) {
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
  }, [wasOffline, showBanner, isOnline, syncing]);

  const pending = !isOnline ? getPendingCount() : 0;
  const pendingDetail = !isOnline && pending > 0 ? formatPendingSummary() : "";

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
              ? syncResult?.failed
                ? "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(40 100% 50%) 100%)"
                : "hsl(var(--primary))"
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
              ) : syncResult?.failed ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>
                {syncing
                  ? "Synchronisation en cours…"
                  : syncResult?.failed
                  ? `${syncResult.synced} sync · ${syncResult.failed} en attente`
                  : "Connexion rétablie"}
              </span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span>Mode hors-ligne</span>
              {pending > 0 && (
                <span className="text-xs opacity-80 ml-1">
                  · {pendingDetail || `${pending} en attente`}
                </span>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
