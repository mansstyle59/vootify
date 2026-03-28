import { useState, useEffect } from "react";
import { X, Share } from "lucide-react";

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

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[9999] rounded-xl bg-card border border-border p-4 shadow-lg animate-in slide-in-from-bottom-4 duration-300">
      <button onClick={dismiss} className="absolute top-2 right-2 p-1 text-muted-foreground">
        <X size={18} />
      </button>
      <p className="text-sm text-foreground pr-6">
        Pour une meilleure expérience, installez Vootify :
      </p>
      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
        Appuyez sur <Share size={14} className="text-primary" /> puis <strong>« Sur l'écran d'accueil »</strong>
      </p>
    </div>
  );
}
