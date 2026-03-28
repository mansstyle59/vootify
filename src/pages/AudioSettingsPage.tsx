import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "@/stores/playerStore";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Music, Headphones, Disc3 } from "lucide-react";
import { motion } from "framer-motion";

const EQ_PRESETS = [
  { label: "Normal", emoji: "🎵", bass: 0, treble: 0 },
  { label: "Bass Boost", emoji: "🔊", bass: 10, treble: -2 },
  { label: "Pop", emoji: "🎤", bass: 2, treble: 4 },
  { label: "Rock", emoji: "🎸", bass: 5, treble: 3 },
  { label: "Jazz", emoji: "🎷", bass: 4, treble: -3 },
  { label: "Classique", emoji: "🎻", bass: -2, treble: 6 },
  { label: "Voix", emoji: "🎙️", bass: -4, treble: 5 },
  { label: "Électro", emoji: "🎧", bass: 8, treble: 5 },
];

const AudioSettingsPage = () => {
  const navigate = useNavigate();
  const {
    crossfadeEnabled, crossfadeDuration, setCrossfadeEnabled, setCrossfadeDuration,
    bassBoost, trebleBoost, setBassBoost, setTrebleBoost,
  } = usePlayerStore();

  return (
    <div className="min-h-screen pb-20 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-primary/5 to-background" />
        <div className="absolute top-0 right-0 w-60 h-60 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4" />

        <div className="relative px-4 md:px-8 pb-6" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Headphones className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Paramètres audio</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Personnalisez votre expérience sonore</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-lg mx-auto space-y-5">
        {/* Crossfade */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-5 rounded-2xl bg-secondary/50 border border-border space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Disc3 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Crossfade</h3>
              <p className="text-[11px] text-muted-foreground">Transition fluide entre les pistes</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Activer le crossfade</p>
            <Switch checked={crossfadeEnabled} onCheckedChange={setCrossfadeEnabled} />
          </div>

          {crossfadeEnabled && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">Durée</p>
                <span className="text-sm font-mono text-primary">{crossfadeDuration}s</span>
              </div>
              <Slider
                value={[crossfadeDuration]}
                onValueChange={([val]) => setCrossfadeDuration(val)}
                min={1}
                max={12}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                <span>1s</span>
                <span>6s</span>
                <span>12s</span>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Equalizer */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-5 rounded-2xl bg-secondary/50 border border-border space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Music className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Égaliseur</h3>
              <p className="text-[11px] text-muted-foreground">Ajustez les basses et les aigus</p>
            </div>
          </div>

          {/* Presets */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Presets</p>
            <div className="grid grid-cols-4 gap-2">
              {EQ_PRESETS.map((preset) => {
                const active = bassBoost === preset.bass && trebleBoost === preset.treble;
                return (
                  <motion.button
                    key={preset.label}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => { setBassBoost(preset.bass); setTrebleBoost(preset.treble); }}
                    className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl text-xs font-medium transition-all border ${
                      active
                        ? "bg-primary/15 text-primary border-primary/25 shadow-sm"
                        : "bg-secondary/60 text-muted-foreground border-border/50 hover:bg-secondary"
                    }`}
                  >
                    <span className="text-lg">{preset.emoji}</span>
                    <span className="text-[10px] leading-tight">{preset.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Bass slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground">Basses</p>
              <span className="text-sm font-mono text-primary tabular-nums">
                {bassBoost > 0 ? "+" : ""}{bassBoost} dB
              </span>
            </div>
            <Slider
              value={[bassBoost]}
              onValueChange={([val]) => setBassBoost(val)}
              min={-12}
              max={12}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
              <span>−12</span>
              <span>0</span>
              <span>+12</span>
            </div>
          </div>

          {/* Treble slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground">Aigus</p>
              <span className="text-sm font-mono text-primary tabular-nums">
                {trebleBoost > 0 ? "+" : ""}{trebleBoost} dB
              </span>
            </div>
            <Slider
              value={[trebleBoost]}
              onValueChange={([val]) => setTrebleBoost(val)}
              min={-12}
              max={12}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
              <span>−12</span>
              <span>0</span>
              <span>+12</span>
            </div>
          </div>

          {/* Visual indicator */}
          <div className="pt-3 border-t border-border/50">
            <p className="text-[11px] text-muted-foreground text-center">
              Les changements sont appliqués en temps réel et sauvegardés automatiquement
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AudioSettingsPage;
