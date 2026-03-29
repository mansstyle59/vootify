import { useState, useEffect } from "react";
import { X, Share, Plus, ChevronRight, Smartphone, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (
    ("standalone" in window.navigator && (window.navigator as any).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

const DISMISSED_KEY = "pwa-install-dismissed";
const INSTALLED_KEY = "pwa-installed";
const VISIT_COUNT_KEY = "pwa-visit-count";
const MIN_VISITS = 1;

const steps = {
  ios: [
    {
      icon: Share,
      label: "Partager",
      desc: "Appuyez sur l'icône Partager en bas de Safari",
      accent: true,
    },
    {
      icon: Plus,
      label: "Écran d'accueil",
      desc: "Faites défiler et appuyez sur « Sur l'écran d'accueil »",
      accent: false,
    },
    {
      icon: Smartphone,
      label: "Installer",
      desc: "Appuyez sur « Ajouter » pour confirmer l'installation",
      accent: false,
    },
  ],
  android: [
    {
      icon: () => (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      ),
      label: "Menu",
      desc: "Appuyez sur le menu ⋮ en haut à droite de Chrome",
      accent: true,
    },
    {
      icon: ArrowDown,
      label: "Installer",
      desc: "Appuyez sur « Installer l'application »",
      accent: false,
    },
    {
      icon: Smartphone,
      label: "Confirmer",
      desc: "Appuyez sur « Installer » dans la popup",
      accent: false,
    },
  ],
};

export default function IosPwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [platform, setPlatform] = useState<"ios" | "android">("ios");

  useEffect(() => {
    // If running as installed PWA, mark as installed permanently and never show again
    if (isInStandaloneMode()) {
      localStorage.setItem(INSTALLED_KEY, "1");
      return;
    }
    // Never show if already installed or previously dismissed
    if (localStorage.getItem(INSTALLED_KEY)) return;
    if (!isIos() && !isAndroid()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    setPlatform(isIos() ? "ios" : "android");

    const visits = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || "0", 10) + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(visits));
    if (visits < MIN_VISITS) return;

    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Listen for display-mode changes (user installs while page is open)
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        localStorage.setItem(INSTALLED_KEY, "1");
        setVisible(false);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  const activeSteps = steps[platform];

  const nextStep = () => {
    if (currentStep < activeSteps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      dismiss();
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 80, scale: 0.95 }}
          transition={{ type: "spring", damping: 24, stiffness: 260 }}
          className="fixed bottom-20 left-3 right-3 z-[9999] rounded-3xl overflow-hidden"
          style={{
            boxShadow:
              "0 -2px 40px hsl(var(--primary) / 0.12), 0 20px 60px hsl(0 0% 0% / 0.4)",
          }}
        >
          <div
            className="relative rounded-3xl overflow-hidden"
            style={{
              background: "hsl(var(--card) / 0.92)",
              backdropFilter: "blur(60px) saturate(1.8)",
              WebkitBackdropFilter: "blur(60px) saturate(1.8)",
              border: "1px solid hsl(var(--foreground) / 0.08)",
            }}
          >
            {/* Close button */}
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors z-10"
              style={{ background: "hsl(var(--foreground) / 0.06)" }}
            >
              <X size={14} />
            </button>

            {/* Header */}
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center gap-3">
                <motion.div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))",
                    boxShadow: "0 4px 16px hsl(var(--primary) / 0.3)",
                  }}
                  animate={{ rotate: [0, -5, 5, 0] }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    repeatDelay: 4,
                  }}
                >
                  <Smartphone size={22} className="text-primary-foreground" />
                </motion.div>
                <div>
                  <h3 className="text-[15px] font-bold text-foreground leading-tight">
                    Installer Vootify
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Expérience native • Audio en arrière-plan • Hors-ligne
                  </p>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div className="px-5 pb-2">
              <div className="flex items-center gap-2 mb-3">
                {activeSteps.map((_, i) => (
                  <motion.div
                    key={i}
                    className="h-[3px] flex-1 rounded-full"
                    animate={{
                      background:
                        i <= currentStep
                          ? "hsl(var(--primary))"
                          : "hsl(var(--foreground) / 0.08)",
                    }}
                    transition={{ duration: 0.3 }}
                  />
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{ background: "hsl(var(--foreground) / 0.04)" }}
                >
                  {/* Step number */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: activeSteps[currentStep].accent
                        ? "hsl(var(--primary) / 0.15)"
                        : "hsl(var(--foreground) / 0.06)",
                    }}
                  >
                    {(() => {
                      const Icon = activeSteps[currentStep].icon;
                      return (
                        <motion.div
                          animate={
                            activeSteps[currentStep].accent
                              ? { scale: [1, 1.15, 1] }
                              : {}
                          }
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            repeatDelay: 1,
                          }}
                        >
                          <Icon
                            size={18}
                            className={
                              activeSteps[currentStep].accent
                                ? "text-primary"
                                : "text-muted-foreground"
                            }
                          />
                        </motion.div>
                      );
                    })()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground leading-tight">
                      Étape {currentStep + 1} ·{" "}
                      {activeSteps[currentStep].label}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {activeSteps[currentStep].desc}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Actions */}
            <div className="px-5 pb-4 pt-2 flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={dismiss}
                  className="flex-1 text-[12px] font-semibold py-2.5 rounded-full transition-colors text-muted-foreground"
                  style={{ background: "hsl(var(--foreground) / 0.06)" }}
                >
                  Plus tard
                </button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={nextStep}
                className="flex-[2] text-[12px] font-bold py-2.5 rounded-full flex items-center justify-center gap-1.5 text-primary-foreground"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
                  boxShadow: "0 4px 16px hsl(var(--primary) / 0.25)",
                }}
              >
                {currentStep < activeSteps.length - 1 ? (
                  <>
                    Suivant
                    <ChevronRight size={14} />
                  </>
                ) : (
                  "C'est compris !"
                )}
              </motion.button>
              </div>
              <button
                onClick={dismissForever}
                className="text-[11px] text-muted-foreground/60 py-1 transition-colors hover:text-muted-foreground"
              >
                Ne plus afficher
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
