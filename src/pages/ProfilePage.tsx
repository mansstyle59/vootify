import { useState, useRef, useEffect } from "react";
import { offlineCache } from "@/lib/offlineCache";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";

import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlayerStore } from "@/stores/playerStore";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera, ArrowLeft, Loader2, Check, LogOut, Shield, Trash2, HardDrive, Database, Crown, Headphones, ChevronRight } from "lucide-react";

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
        {/* Subscription badge */}
        {isActive && subscription && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6 p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground capitalize">{subscription.plan}</p>
              <p className="text-xs text-muted-foreground">
                {subscription.expires_at
                  ? `Expire le ${new Date(subscription.expires_at).toLocaleDateString("fr-FR")}`
                  : "Abonnement illimité"}
              </p>
            </div>
          </motion.div>
        )}


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


          {/* Audio Settings link */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => navigate("/audio-settings")}
            className="mt-4 w-full p-4 rounded-2xl bg-secondary/50 border border-border flex items-center gap-3 hover:bg-secondary/70 transition-colors active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Headphones className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-foreground">Paramètres audio</p>
              <p className="text-[11px] text-muted-foreground">Égaliseur, crossfade, presets</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
          </motion.button>

          {/* Storage section - separate card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-4 p-5 rounded-2xl bg-secondary/50 border border-border space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <Database className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Stockage</h3>
                <p className="text-[11px] text-muted-foreground">Espace utilisé par l'application</p>
              </div>
            </div>

            {/* Total usage bar */}
            {(() => {
              const totalUsed = (swCacheSize || 0) + (offlineCacheSize || 0);
              const maxEstimate = Math.max(totalUsed * 2, 50 * 1024 * 1024); // estimate max
              const swPercent = maxEstimate > 0 ? ((swCacheSize || 0) / maxEstimate) * 100 : 0;
              const offlinePercent = maxEstimate > 0 ? ((offlineCacheSize || 0) / maxEstimate) * 100 : 0;
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {totalUsed > 0 ? formatBytes(totalUsed) : "Calcul…"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">utilisé</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted/60 overflow-hidden flex">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${swPercent}%` }}
                      transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                      className="h-full rounded-l-full"
                      style={{ background: "hsl(var(--primary))" }}
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${offlinePercent}%` }}
                      transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
                      className="h-full"
                      style={{ background: "hsl(var(--primary) / 0.5)" }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Breakdown items */}
            <div className="space-y-3 pt-2">
              {/* SW Cache */}
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: "hsl(var(--primary))" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Cache navigateur</p>
                  <p className="text-[11px] text-muted-foreground">
                    {swCacheSize !== null ? formatBytes(swCacheSize) : "Calcul…"}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!("caches" in window)) return;
                    const names = await caches.keys();
                    await Promise.all(names.map((n) => caches.delete(n)));
                    setSwCacheSize(0);
                    toast.success("Cache navigateur vidé !");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors active:scale-95"
                >
                  <Trash2 className="w-3 h-3" />
                  Vider
                </button>
              </div>

              {/* Offline songs */}
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: "hsl(var(--primary) / 0.5)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Morceaux hors-ligne</p>
                  <p className="text-[11px] text-muted-foreground">
                    {offlineCount} titre{offlineCount > 1 ? "s" : ""} · {offlineCacheSize !== null ? formatBytes(offlineCacheSize) : "Calcul…"}
                  </p>
                </div>
                <HardDrive className="w-4 h-4 text-muted-foreground/50" />
              </div>
            </div>

            {/* Clear all button */}
            <button
              onClick={async () => {
                if (!("caches" in window)) return;
                const names = await caches.keys();
                await Promise.all(names.map((n) => caches.delete(n)));
                setSwCacheSize(0);
                toast.success("Tout le cache a été vidé !");
              }}
              className="w-full py-2.5 rounded-xl bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/15 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Vider tout le cache
            </button>
          </motion.div>

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
