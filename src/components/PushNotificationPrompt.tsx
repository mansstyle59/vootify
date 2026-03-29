import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { isPushSupported, getPushPermission, subscribeToPush, isSubscribed } from "@/lib/pushNotifications";

/**
 * A one-time prompt asking the user to enable push notifications.
 * Shows after 3rd app open, dismissable, remembers choice.
 */
export function PushNotificationPrompt() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user?.id || !isPushSupported()) return;
    
    const dismissed = localStorage.getItem("vootify-push-dismissed");
    if (dismissed) return;

    const permission = getPushPermission();
    if (permission === "granted" || permission === "denied") return;

    // Show after 3rd visit
    const visits = parseInt(localStorage.getItem("vootify-push-visits") || "0") + 1;
    localStorage.setItem("vootify-push-visits", String(visits));
    
    if (visits >= 3) {
      // Check if already subscribed
      isSubscribed().then((sub) => {
        if (!sub) {
          setTimeout(() => setShow(true), 5000);
        }
      });
    }
  }, [user]);

  const handleEnable = async () => {
    if (!user?.id) return;
    const ok = await subscribeToPush(user.id);
    if (ok) {
      localStorage.setItem("vootify-push-dismissed", "true");
    }
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem("vootify-push-dismissed", "true");
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 100, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed bottom-24 left-4 right-4 z-[140] rounded-2xl border border-border overflow-hidden"
          style={{
            background: "hsl(var(--popover))",
            boxShadow: "0 8px 40px hsl(0 0% 0% / 0.4), 0 0 0 1px hsl(var(--border) / 0.5)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.05))",
                }}
              >
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Activer les notifications
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Recevez des alertes pour les nouvelles sorties et mises à jour.
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleEnable}
                className="flex-1 py-2.5 rounded-full text-xs font-bold active:scale-[0.97] transition-transform"
                style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
              >
                Activer
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2.5 rounded-full text-xs font-semibold active:scale-[0.97] transition-transform"
                style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
              >
                Plus tard
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
