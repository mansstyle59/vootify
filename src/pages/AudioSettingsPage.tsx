import { useNavigate } from "react-router-dom";
import { usePlayerStore } from "@/stores/playerStore";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Music, Disc3, Volume2, Sparkles, Save, Check, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  getProfiles, saveProfiles, getActiveProfileId, setActiveProfileId,
  isNormalizationEnabled, setNormalizationEnabled,
  isAutoEqEnabled, setAutoEqEnabled, getGenreEq,
  type AudioProfile,
} from "@/lib/audioProfiles";

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
    bassBoost, trebleBoost, setBassBoost, setTrebleBoost, currentSong,
  } = usePlayerStore();

  const [profiles, setProfiles] = useState<AudioProfile[]>(getProfiles);
  const [activeProfile, setActiveProfile] = useState<string | null>(getActiveProfileId);
  const [normalization, setNorm] = useState(isNormalizationEnabled);
  const [autoEq, setAutoEq] = useState(isAutoEqEnabled);

  // Auto EQ detection
  const detectedEq = useMemo(() => {
    if (!autoEq || !currentSong) return null;
    return getGenreEq((currentSong as any).genre);
  }, [autoEq, currentSong]);

  // Apply auto EQ when song changes
  useEffect(() => {
    if (detectedEq && autoEq && !activeProfile) {
      setBassBoost(detectedEq.bass);
      setTrebleBoost(detectedEq.treble);
    }
  }, [detectedEq, autoEq, activeProfile]);

  const handleBass = useCallback(([val]: number[]) => { setBassBoost(val); setActiveProfile(null); setActiveProfileId(null); }, [setBassBoost]);
  const handleTreble = useCallback(([val]: number[]) => { setTrebleBoost(val); setActiveProfile(null); setActiveProfileId(null); }, [setTrebleBoost]);
  const handleCrossfade = useCallback(([val]: number[]) => setCrossfadeDuration(val), [setCrossfadeDuration]);

  const applyProfile = useCallback((profile: AudioProfile) => {
    setBassBoost(profile.bass);
    setTrebleBoost(profile.treble);
    setCrossfadeEnabled(profile.crossfadeEnabled);
    setCrossfadeDuration(profile.crossfadeDuration);
    setNormalizationEnabled(profile.normalization);
    setNorm(profile.normalization);
    setActiveProfile(profile.id);
    setActiveProfileId(profile.id);
    toast.success(`Profil "${profile.name}" activé`);
  }, [setBassBoost, setTrebleBoost, setCrossfadeEnabled, setCrossfadeDuration]);

  const saveCurrentAsProfile = useCallback(() => {
    if (!activeProfile) return;
    const updated = profiles.map(p =>
      p.id === activeProfile
        ? { ...p, bass: bassBoost, treble: trebleBoost, crossfadeEnabled, crossfadeDuration, normalization }
        : p
    );
    setProfiles(updated);
    saveProfiles(updated);
    toast.success("Profil mis à jour !");
  }, [activeProfile, profiles, bassBoost, trebleBoost, crossfadeEnabled, crossfadeDuration, normalization]);

  const toggleNormalization = useCallback((val: boolean) => {
    setNorm(val);
    setNormalizationEnabled(val);
  }, []);

  const toggleAutoEq = useCallback((val: boolean) => {
    setAutoEq(val);
    setAutoEqEnabled(val);
    if (val && !activeProfile) {
      const eq = getGenreEq((currentSong as any)?.genre);
      if (eq) { setBassBoost(eq.bass); setTrebleBoost(eq.treble); }
    }
  }, [activeProfile, currentSong, setBassBoost, setTrebleBoost]);

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div
        className="sticky top-0 z-30 px-4 py-3"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + var(--ai-banner-h, 0px) + var(--pwa-top-extra, 0px) + 0.75rem)",
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

        {/* ── Audio Profiles ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="p-5 rounded-2xl space-y-4"
          style={cardStyle}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.12)" }}>
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Profils audio</h3>
              <p className="text-[11px] text-muted-foreground/60">Basculez selon votre contexte</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {profiles.map((profile) => {
              const active = activeProfile === profile.id;
              return (
                <motion.button
                  key={profile.id}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => applyProfile(profile)}
                  className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-xs font-medium transition-all active:scale-95 relative"
                  style={{
                    background: active ? "hsl(var(--primary) / 0.15)" : "hsl(var(--secondary))",
                    border: active ? "0.5px solid hsl(var(--primary) / 0.3)" : "0.5px solid transparent",
                    color: active ? "hsl(var(--primary))" : undefined,
                    boxShadow: active ? "0 4px 16px hsl(var(--primary) / 0.1)" : undefined,
                  }}
                >
                  <span className="text-xl">{profile.emoji}</span>
                  <span className="text-[10px] leading-tight font-semibold">{profile.name}</span>
                  {active && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: "hsl(var(--primary))" }}
                    >
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {activeProfile && (
            <motion.button
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={saveCurrentAsProfile}
              className="w-full py-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
              style={{ background: "hsl(var(--primary) / 0.08)", color: "hsl(var(--primary))" }}
            >
              <Save className="w-3 h-3" />
              Sauvegarder les réglages dans "{profiles.find(p => p.id === activeProfile)?.name}"
            </motion.button>
          )}
        </motion.div>

        {/* ── Auto EQ ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="p-5 rounded-2xl space-y-4"
          style={cardStyle}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.12)" }}>
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-foreground">EQ adaptatif</h3>
              <p className="text-[11px] text-muted-foreground/60">Ajuste l'EQ selon le genre du morceau</p>
            </div>
            <Switch checked={autoEq} onCheckedChange={toggleAutoEq} />
          </div>

          <AnimatePresence>
            {autoEq && detectedEq && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "hsl(var(--primary) / 0.06)" }}>
                  <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-primary">
                      Genre détecté : {detectedEq.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Basses {detectedEq.bass > 0 ? "+" : ""}{detectedEq.bass} · Aigus {detectedEq.treble > 0 ? "+" : ""}{detectedEq.treble}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {autoEq && !detectedEq && currentSong && (
            <p className="text-[10px] text-muted-foreground/50 text-center">
              Genre non détecté — EQ manuel actif
            </p>
          )}
        </motion.div>

        {/* ── Volume Normalization ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.09 }}
          className="p-5 rounded-2xl space-y-3"
          style={cardStyle}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.12)" }}>
              <Volume2 className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-foreground">Volume intelligent</h3>
              <p className="text-[11px] text-muted-foreground/60">Niveau sonore constant entre les morceaux</p>
            </div>
            <Switch checked={normalization} onCheckedChange={toggleNormalization} />
          </div>
          <p className="text-[10px] text-muted-foreground/40 px-1">
            Normalise automatiquement le volume pour éviter les écarts entre les titres
          </p>
        </motion.div>

        {/* ── Crossfade ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
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

          <AnimatePresence>
            {crossfadeEnabled && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">Durée</p>
                  <span className="text-sm font-mono text-primary">{crossfadeDuration}s</span>
                </div>
                <Slider value={[crossfadeDuration]} onValueChange={handleCrossfade} min={1} max={12} step={1} className="w-full" />
                <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                  <span>1s</span><span>6s</span><span>12s</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Equalizer ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
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
                    onClick={() => { setBassBoost(preset.bass); setTrebleBoost(preset.treble); setActiveProfile(null); setActiveProfileId(null); }}
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
            <Slider value={[bassBoost]} onValueChange={handleBass} min={-12} max={12} step={1} className="w-full" />
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
              <span>−12</span><span>0</span><span>+12</span>
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
            <Slider value={[trebleBoost]} onValueChange={handleTreble} min={-12} max={12} step={1} className="w-full" />
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
              <span>−12</span><span>0</span><span>+12</span>
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
