import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, Smartphone, CheckCircle, AlertCircle, ArrowLeft, Apple } from "lucide-react";
import { useNavigate } from "react-router-dom";

const MANIFEST_URL = "https://mansstyle59.github.io/vootify/manifest.plist";
const INSTALL_URL = `itms-services://?action=download-manifest&url=${encodeURIComponent(MANIFEST_URL)}`;

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function detectiOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

const InstallPage = () => {
  const navigate = useNavigate();
  const [isIOS, setIsIOS] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setIsIOS(detectiOS());
  }, []);

  const handleInstall = () => {
    setInstalling(true);
    window.location.href = INSTALL_URL;
    setTimeout(() => {
      setInstalling(false);
      setDone(true);
    }, 2000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-sm"
      >
        {/* Back button */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-primary text-sm font-medium mb-8 active:opacity-60 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        {/* App icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <img
              src="/vootify/pwa-icon-192.png"
              alt="Vootify"
              className="w-24 h-24 rounded-[22%] shadow-lg shadow-primary/20"
            />
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md">
              <Apple className="w-4 h-4 text-primary-foreground" />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">Installer Vootify</h1>
          <p className="text-sm text-muted-foreground">Version 1.0 · iOS</p>
        </div>

        {/* Main card */}
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 mb-4 space-y-3">
          <InfoRow icon={<Smartphone className="w-4 h-4 text-primary" />} label="Plateforme" value="iPhone / iPad" />
          <InfoRow icon={<Apple className="w-4 h-4 text-primary" />} label="Système" value="iOS 14+" />
          <InfoRow icon={<Download className="w-4 h-4 text-primary" />} label="Taille" value="5,2 Mo" />
        </div>

        {/* Install button or non-iOS message */}
        {isIOS ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleInstall}
            disabled={installing || done}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2.5 shadow-lg shadow-primary/30 disabled:opacity-60 transition-all"
          >
            {done ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Installation lancée
              </>
            ) : installing ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Download className="w-5 h-5" />
                </motion.div>
                Ouverture…
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Installer sur cet iPhone
              </>
            )}
          </motion.button>
        ) : (
          <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-4 flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground mb-0.5">Appareil non compatible</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                L'installation directe est uniquement disponible sur iPhone ou iPad. Ouvre cette page depuis Safari sur iOS.
              </p>
            </div>
          </div>
        )}

        {/* Instructions */}
        {isIOS && (
          <div className="mt-5 space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Instructions</p>
            {[
              "Appuie sur « Installer sur cet iPhone »",
              "Confirme l'installation dans la popup iOS",
              "Va dans Réglages → Général → VPN et gestion → fais confiance à l'app",
              "Ouvre Vootify depuis l'écran d'accueil",
            ].map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        )}

        {/* Direct link fallback */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Lien direct :{" "}
          <a
            href={INSTALL_URL}
            className="text-primary underline underline-offset-2 break-all"
          >
            Installer via itms-services
          </a>
        </p>
      </motion.div>
    </div>
  );
};

export default InstallPage;
