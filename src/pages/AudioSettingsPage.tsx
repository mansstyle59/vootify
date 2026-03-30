import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "@/stores/playerStore";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Music, Disc3 } from "lucide-react";
import { motion } from "framer-motion";
import { useCallback } from "react";

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

const cardStyle = {
  background: "hsl(var(--card))",
  border: "0.5px solid hsl(var(--border) / 0.3)",
  boxShadow: "0 4px 20px hsl(0 0% 0% / 0.15)",
};

const AudioSettingsPage = () => {
  const navigate = useNavigate();
  const {
    crossfadeEnabled, crossfadeDuration, setCrossfadeEnabled, setCrossfadeDuration,
    bassBoost, trebleBoost, setBassBoost, setTrebleBoost,
  } = usePlayerStore();

  const handleBass = useCallback(([val]: number[]) => setBassBoost(val), [setBassBoost]);
  const handleTreble = useCallback(([val]: number[]) => setTrebleBoost(val), [setTrebleBoost]);
  const handleCrossfade = useCallback(([val]: number[]) => setCrossfadeDuration(val), [setCrossfadeDuration]);

  return (
    <div className="min-h-screen pb-20">
      {/* Header — solid background, no blur */}
      <div
        className="sticky top-0 z-30 px-4 py-3"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + var(--ai-banner-h, 0px) + 0.75rem)",
          background: "hsl(var(--background))",
          borderBottom: "0.5px solid hsl(var(--border) / 0.3)",
        }}
      >
        <div className="max-w-lg mx-auto flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="flex-1 text-center text-sm font-bold text-foreground">Paramètres audio</h1>
          <div className="w-9" />
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-lg mx-auto space-y-4 mt-3">
        {/* Crossfade */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-5 rounded-2xl space-y-5"
          style={cardStyle}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.12)" }}>
              <Disc3 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Crossfade</h3>
              <p className="text-[11px] text-muted-foreground/60">Transition fluide entre les pistes</p>
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
                onValueChange={handleCrossfade}
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
          transition={{ delay: 0.1 }}
          className="p-5 rounded-2xl space-y-5"
          style={cardStyle}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.12)" }}>
              <Music className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Égaliseur</h3>
              <p className="text-[11px] text-muted-foreground/60">Ajustez les basses et les aigus</p>
            </div>
          </div>

          {/* Presets */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Presets</p>
            <div className="grid grid-cols-4 gap-2">
              {EQ_PRESETS.map((preset) => {
                const active = bassBoost === preset.bass && trebleBoost === preset.treble;
                return (
                  <button
                    key={preset.label}
                    onClick={() => { setBassBoost(preset.bass); setTrebleBoost(preset.treble); }}
                    className="flex flex-col items-center gap-1 px-2 py-3 rounded-xl text-xs font-medium transition-colors active:scale-95"
                    style={{
                      background: active ? "hsl(var(--primary) / 0.15)" : "hsl(var(--secondary))",
                      border: active ? "0.5px solid hsl(var(--primary) / 0.25)" : "0.5px solid transparent",
                      color: active ? "hsl(var(--primary))" : undefined,
                    }}
                  >
                    <span className="text-lg">{preset.emoji}</span>
                    <span className="text-[10px] leading-tight">{preset.label}</span>
                  </button>
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
              onValueChange={handleBass}
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
              onValueChange={handleTreble}
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

          <div className="pt-3" style={{ borderTop: "0.5px solid hsl(var(--foreground) / 0.05)" }}>
            <p className="text-[11px] text-muted-foreground/50 text-center">
              Les changements sont appliqués en temps réel et sauvegardés automatiquement
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AudioSettingsPage;