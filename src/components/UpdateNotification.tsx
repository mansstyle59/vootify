import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X, Check } from "lucide-react";

/**
 * Detects Service Worker updates and shows a sleek "update available" banner
 * with a visual progress percentage during the update process.
 */
export function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleControllerChange = () => {
      // New SW has taken over — reload for fresh content
      window.location.reload();
    };

    // Listen for new SW activating
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    // Check registrations for a waiting worker (already downloaded update)
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      // If there's already a waiting worker
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setUpdateAvailable(true);
        return;
      }

      // Listen for new SW installing
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New version installed but waiting to activate
            setWaitingWorker(newWorker);
            setUpdateAvailable(true);
          }
        });
      });

      // Check for updates every 30 minutes
      const interval = setInterval(() => {
        reg.update().catch(() => {});
      }, 30 * 60 * 1000);

      return () => clearInterval(interval);
    });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const handleUpdate = useCallback(() => {
    if (waitingWorker && !updating) {
      setUpdating(true);
      setProgress(0);
      // Simulate progress while SW activates
      let p = 0;
      const interval = setInterval(() => {
        p += Math.random() * 15 + 5;
        if (p >= 95) {
          p = 95;
          clearInterval(interval);
        }
        setProgress(Math.round(p));
      }, 200);
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      // controllerchange will reload — but show 100% briefly
      const onDone = () => {
        clearInterval(interval);
        setProgress(100);
      };
      navigator.serviceWorker.addEventListener("controllerchange", onDone, { once: true });
    }
  }, [waitingWorker, updating]);

  const handleDismiss = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return (
    <AnimatePresence>
      {updateAvailable && (
        <motion.div
          initial={{ y: -80, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -80, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed top-0 left-0 right-0 z-[160] flex flex-col px-4 py-3"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
            background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.85) 100%)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {updating && progress >= 100 ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  <Check className="w-4 h-4 text-primary-foreground flex-shrink-0" />
                </motion.div>
              ) : (
                <motion.div
                  animate={updating ? { rotate: 360 } : {}}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <RefreshCw className="w-4 h-4 text-primary-foreground flex-shrink-0" />
                </motion.div>
              )}
              <span className="text-sm font-semibold text-primary-foreground truncate">
                {updating
                  ? progress >= 100
                    ? "Mise à jour terminée !"
                    : `Mise à jour… ${progress}%`
                  : "Mise à jour disponible"}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {!updating && (
                <>
                  <button
                    onClick={handleUpdate}
                    className="px-3 py-1.5 rounded-full text-xs font-bold bg-primary-foreground text-primary active:scale-95 transition-transform"
                  >
                    Mettre à jour
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="p-1 rounded-full text-primary-foreground/70 hover:text-primary-foreground active:scale-90 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
              {updating && progress < 100 && (
                <span className="text-xs font-bold text-primary-foreground/90 tabular-nums">
                  {progress}%
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {updating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 4 }}
              className="mt-2 w-full rounded-full overflow-hidden bg-primary-foreground/20"
            >
              <motion.div
                className="h-full rounded-full bg-primary-foreground"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: "easeOut", duration: 0.3 }}
              />
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
