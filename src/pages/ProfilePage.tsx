import { useState, useRef, useEffect } from "react";
import { hdCache } from "@/lib/hdCache";
import { offlineCache } from "@/lib/offlineCache";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Camera, ArrowLeft, Loader2, Check, LogOut, Shield, Music, Trash2, Sun, Moon, Monitor, HardDrive, Database } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
}

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminAuth();
  const { theme, setTheme } = useTheme();
  const { crossfadeEnabled, crossfadeDuration, setCrossfadeEnabled, setCrossfadeDuration } = usePlayerStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [swCacheSize, setSwCacheSize] = useState<number | null>(null);
  const [offlineCacheSize, setOfflineCacheSize] = useState<number | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);

  // Load cache sizes
  useEffect(() => {
    // SW cache size
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
    // Offline (IndexedDB) cache
    offlineCache.getCacheSize().then(setOfflineCacheSize).catch(() => {});
    offlineCache.getAllCached().then((songs) => setOfflineCount(songs.length)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    // Load from user metadata
    const meta = user.user_metadata;
    setDisplayName(meta?.display_name || meta?.full_name || user.email?.split("@")[0] || "");
    setAvatarUrl(meta?.avatar_url || meta?.picture || null);

    // Also load from profiles table (may have updated values)
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

    if (file.size > 2 * 1024 * 1024) {
      toast.error("L'image doit faire moins de 2 Mo");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(publicUrl);
      toast.success("Photo mise à jour");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Update profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // Update auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
          avatar_url: avatarUrl,
        },
      });

      if (authError) throw authError;

      toast.success("Profil mis à jour !");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const initials = (displayName || "U").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen pb-40 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/5 to-background" />
        <div className="absolute top-0 right-0 w-60 h-60 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4" />

        <div className="relative px-4 md:px-8 pb-8" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>

          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Mon profil</h1>
          <p className="text-sm text-muted-foreground mt-1">Gérez vos informations personnelles</p>
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-lg mx-auto">
        {/* Avatar section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-8"
        >
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <Avatar className="w-28 h-28 border-4 border-primary/20 shadow-xl">
              <AvatarImage src={avatarUrl || undefined} alt={displayName} />
              <AvatarFallback className="text-2xl font-bold bg-primary/20 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />

          <p className="text-xs text-muted-foreground mt-3">
            Cliquez pour changer la photo
          </p>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Nom d'affichage
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Votre nom"
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <input
              type="email"
              value={user.email || ""}
              disabled
              className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-muted-foreground text-sm cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground mt-1">L'email ne peut pas être modifié</p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Sauvegarder
          </button>

          {/* Theme Settings */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="hidden"
          >

          {/* Audio Settings */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4 p-5 rounded-2xl bg-secondary/50 border border-border space-y-5"
          >
            <div className="flex items-center gap-3 mb-1">
              <Music className="w-5 h-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">Lecture audio</h3>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Crossfade</p>
                <p className="text-xs text-muted-foreground">Transition fluide entre les pistes</p>
              </div>
              <Switch
                checked={crossfadeEnabled}
                onCheckedChange={setCrossfadeEnabled}
              />
            </div>

            {crossfadeEnabled && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">Durée du crossfade</p>
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
                  <span>12s</span>
                </div>
              </div>
            )}

            {/* Clear HD cache */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div>
                <p className="text-sm font-medium text-foreground">Cache HD</p>
                <p className="text-xs text-muted-foreground">
                  {hdCache.stats().count} résolution{hdCache.stats().count > 1 ? "s" : ""} en cache
                </p>
              </div>
              <button
                onClick={() => {
                  hdCache.clear();
                  toast.success("Cache HD vidé !");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Vider
              </button>
            </div>

            {/* SW & Offline cache indicators */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="flex items-center gap-3 mb-1">
                <Database className="w-5 h-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">Stockage</h3>
              </div>

              {/* Service Worker cache */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Cache navigateur (SW)</p>
                  <p className="text-xs text-muted-foreground">
                    {swCacheSize !== null ? formatBytes(swCacheSize) : "Calcul…"}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!("caches" in window)) return;
                    const names = await caches.keys();
                    await Promise.all(names.map((n) => caches.delete(n)));
                    setSwCacheSize(0);
                    toast.success("Cache SW vidé !");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Vider
                </button>
              </div>

              {/* Offline downloads cache */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Morceaux hors-ligne</p>
                  <p className="text-xs text-muted-foreground">
                    {offlineCount} titre{offlineCount > 1 ? "s" : ""} · {offlineCacheSize !== null ? formatBytes(offlineCacheSize) : "Calcul…"}
                  </p>
                </div>
                <HardDrive className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </motion.div>

          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="w-full py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive font-medium text-sm hover:bg-destructive/20 transition-colors flex items-center justify-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Administration
            </button>
          )}

          <button
            onClick={async () => { await signOut(); navigate("/"); }}
            className="w-full py-3 rounded-xl bg-secondary border border-border text-muted-foreground font-medium text-sm hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfilePage;
