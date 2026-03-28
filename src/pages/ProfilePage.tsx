import { useState, useRef, useEffect } from "react";
import { offlineCache } from "@/lib/offlineCache";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Camera, ArrowLeft, Loader2, Check, LogOut, Trash2,
  HardDrive, Database, Crown, Headphones, ChevronRight, Shield, Sparkles, Fingerprint
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  disableBiometric,
} from "@/lib/biometricAuth";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
}

const GlassCard = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    className={`rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-2xl ${className}`}
  >
    {children}
  </motion.div>
);

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminAuth();
  const { subscription, isActive } = useSubscription(user?.id ?? null);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [swCacheSize, setSwCacheSize] = useState<number | null>(null);
  const [offlineCacheSize, setOfflineCacheSize] = useState<number | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [biometricOn, setBiometricOn] = useState(isBiometricEnabled());
  const biometricSupported = isBiometricAvailable();

  useEffect(() => {
    if ("caches" in window) {
      (async () => {
        try {
          const cacheNames = await caches.keys();
          let total = 0;
          for (const name of cacheNames) {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            for (const req of keys) {
              try {
                const res = await cache.match(req);
                if (res) {
                  const blob = await res.clone().blob();
                  total += blob.size;
                }
              } catch {}
            }
          }
          setSwCacheSize(total);
        } catch {}
      })();
    }
    offlineCache.getCacheSize().then(setOfflineCacheSize).catch(() => {});
    offlineCache.getAllCached().then((songs) => setOfflineCount(songs.length)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    const meta = user.user_metadata;
    setDisplayName(meta?.display_name || meta?.full_name || user.email?.split("@")[0] || "");
    setAvatarUrl(meta?.avatar_url || meta?.picture || null);
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          if (data.display_name) setDisplayName(data.display_name);
          if (data.avatar_url) setAvatarUrl(data.avatar_url);
        }
      });
  }, [user, navigate]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("L'image doit faire moins de 2 Mo"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(publicUrl);
      toast.success("Photo mise à jour");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'upload");
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ display_name: displayName, avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (profileError) throw profileError;
      const { error: authError } = await supabase.auth.updateUser({ data: { display_name: displayName, avatar_url: avatarUrl } });
      if (authError) throw authError;
      toast.success("Profil mis à jour !");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la sauvegarde");
    } finally { setSaving(false); }
  };

  if (!user) return null;
  const initials = (displayName || "U").slice(0, 2).toUpperCase();
  const totalUsed = (swCacheSize || 0) + (offlineCacheSize || 0);
  const maxEstimate = Math.max(totalUsed * 2, 50 * 1024 * 1024);
  const swPercent = maxEstimate > 0 ? ((swCacheSize || 0) / maxEstimate) * 100 : 0;
  const offlinePercent = maxEstimate > 0 ? ((offlineCacheSize || 0) / maxEstimate) * 100 : 0;

  return (
    <div className="min-h-screen pb-40">
      {/* Ambient bg */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/3 right-0 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <div className="relative px-4 md:px-8" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
      </div>

      <div className="px-4 md:px-8 max-w-lg mx-auto space-y-5">
        {/* Profile hero card */}
        <GlassCard className="p-6 text-center relative overflow-hidden" delay={0}>
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] to-transparent pointer-events-none" />
          
          <div className="relative">
            <div className="relative group cursor-pointer mx-auto w-fit" onClick={() => fileInputRef.current?.click()}>
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 blur-sm" />
              <Avatar className="relative w-24 h-24 border-2 border-white/10 shadow-2xl">
                <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                <AvatarFallback className="text-xl font-bold bg-primary/20 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
              </div>
              {isAdmin && (
                <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-primary/90 border-2 border-background flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              )}
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />

            <h2 className="mt-4 text-lg font-bold text-foreground">{displayName || "Utilisateur"}</h2>
            <p className="text-xs text-muted-foreground">{user.email}</p>

            {isActive && subscription && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/20">
                <Crown className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary capitalize">{subscription.plan}</span>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Edit name */}
        <GlassCard className="p-5 space-y-4" delay={0.08}>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
              Nom d'affichage
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Votre nom"
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/30 text-sm transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={user.email || ""}
              disabled
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-muted-foreground text-sm cursor-not-allowed"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Sauvegarder
          </button>
        </GlassCard>

        {/* Quick links */}
        <GlassCard className="divide-y divide-white/[0.04]" delay={0.16}>
          <button
            onClick={() => navigate("/audio-settings")}
            className="w-full p-4 flex items-center gap-3 hover:bg-white/[0.03] transition-colors active:scale-[0.98]"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Headphones className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-foreground">Paramètres audio</p>
              <p className="text-[11px] text-muted-foreground">Égaliseur, crossfade, presets</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
          </button>

          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="w-full p-4 flex items-center gap-3 hover:bg-white/[0.03] transition-colors active:scale-[0.98]"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4.5 h-4.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-foreground">Administration</p>
                <p className="text-[11px] text-muted-foreground">Gérer les utilisateurs et contenus</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
            </button>
          )}

          {/* Biometric toggle */}
          {biometricSupported && (
            <div className="w-full p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Fingerprint className="w-4.5 h-4.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-foreground">Face ID / Touch ID</p>
                <p className="text-[11px] text-muted-foreground">Connexion biométrique rapide</p>
              </div>
              <button
                onClick={() => {
                  if (biometricOn) {
                    disableBiometric();
                    setBiometricOn(false);
                    toast.success("Authentification biométrique désactivée");
                  } else {
                    toast("Connectez-vous avec votre mot de passe pour activer Face ID");
                  }
                }}
                className={`relative w-11 h-6 rounded-full transition-colors ${biometricOn ? "bg-primary" : "bg-muted"}`}
              >
                <motion.div
                  animate={{ x: biometricOn ? 20 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                />
              </button>
            </div>
          )}
        </GlassCard>

        {/* Storage */}
        <GlassCard className="p-5 space-y-4" delay={0.24}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Database className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Stockage</h3>
              <p className="text-[11px] text-muted-foreground">
                {totalUsed > 0 ? `${formatBytes(totalUsed)} utilisé` : "Calcul…"}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden flex">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${swPercent}%` }}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              className="h-full rounded-l-full bg-primary"
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${offlinePercent}%` }}
              transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
              className="h-full bg-primary/50"
            />
          </div>

          {/* Legend */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="text-xs text-muted-foreground">Cache navigateur</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">
                  {swCacheSize !== null ? formatBytes(swCacheSize) : "…"}
                </span>
                <button
                  onClick={async () => {
                    if (!("caches" in window)) return;
                    const names = await caches.keys();
                    await Promise.all(names.map((n) => caches.delete(n)));
                    setSwCacheSize(0);
                    toast.success("Cache navigateur vidé !");
                  }}
                  className="px-2 py-0.5 rounded-md bg-destructive/10 text-destructive text-[10px] font-medium hover:bg-destructive/20 transition-colors active:scale-95"
                >
                  Vider
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-primary/50" />
                <span className="text-xs text-muted-foreground">Hors-ligne</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">
                  {offlineCount} titre{offlineCount > 1 ? "s" : ""} · {offlineCacheSize !== null ? formatBytes(offlineCacheSize) : "…"}
                </span>
                <HardDrive className="w-3.5 h-3.5 text-muted-foreground/30" />
              </div>
            </div>
          </div>

          <button
            onClick={async () => {
              if (!("caches" in window)) return;
              const names = await caches.keys();
              await Promise.all(names.map((n) => caches.delete(n)));
              setSwCacheSize(0);
              toast.success("Tout le cache a été vidé !");
            }}
            className="w-full py-2 rounded-xl bg-destructive/8 text-destructive text-xs font-medium hover:bg-destructive/15 transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Vider tout le cache
          </button>
        </GlassCard>

        {/* Logout */}
        <GlassCard delay={0.32}>
          <button
            onClick={async () => { await signOut(); navigate("/"); }}
            className="w-full p-4 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </GlassCard>
      </div>
    </div>
  );
};

export default ProfilePage;
