import { useState, useEffect } from "react";
import { X, Share, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return "standalone" in window.navigator && (window.navigator as any).standalone === true;
}

const DISMISSED_KEY = "pwa-install-dismissed";

export default function IosPwaInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIos()) return;
    if (isInStandaloneMode()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.95 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed bottom-20 left-3 right-3 z-[9999] rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Gradient border glow */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 blur-sm -z-10" />

          <div className="relative bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl p-4">
            <button onClick={dismiss} className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground transition-colors">
              <X size={16} />
            </button>

            <div className="flex items-start gap-3 pr-6">
              {/* Animated icon */}
              <motion.div
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25"
                animate={{ rotate: [0, -8, 8, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                <Plus size={20} className="text-primary-foreground" />
              </motion.div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Installer Vootify
                </p>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                  <span>Appuyez sur</span>
                  <motion.span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium"
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                  >
                    <Share size={12} />
                    Partager
                  </motion.span>
                  <span>puis</span>
                  <span className="font-medium text-foreground">« Écran d'accueil »</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
