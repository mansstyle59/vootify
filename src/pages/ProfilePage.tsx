import { useState, useRef, useEffect, useMemo } from "react";
import { offlineCache } from "@/lib/offlineCache";
import { useSubscription } from "@/hooks/useSubscription";
import { normalizePlan, getPlanConfig } from "@/lib/subscriptionPermissions";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Camera, ArrowLeft, Loader2, Check, LogOut, Trash2,
  HardDrive, Database, Crown, Headphones, ChevronRight, Shield, Fingerprint,
  Clock, Music, Heart, BarChart3, RefreshCw, Download, Settings, Edit3, Layers, Wifi
} from "lucide-react";
import { silentCacheRefresh } from "@/lib/appCache";
import { getPendingCount, flushQueue } from "@/lib/offlineQueue";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  disableBiometric,
} from "@/lib/biometricAuth";
import { isAutoDownloadEnabled, setAutoDownloadEnabled } from "@/lib/autoDownload";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
}

const GlassCard = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
    className={`rounded-2xl ${className}`}
    style={{
      background: "linear-gradient(145deg, hsl(var(--card) / 0.4), hsl(var(--card) / 0.2))",
      backdropFilter: "blur(80px) saturate(2.2) brightness(1.05)",
      WebkitBackdropFilter: "blur(80px) saturate(2.2) brightness(1.05)",
      border: "0.5px solid hsl(var(--foreground) / 0.07)",
      boxShadow: "0 8px 40px hsl(0 0% 0% / 0.2), inset 0 0.5px 0 hsl(var(--foreground) / 0.06), inset 0 -0.5px 0 hsl(0 0% 0% / 0.1)",
    }}
  >
    {children}
  </motion.div>
);

const MenuRow = ({
  icon: Icon,
  title,
  subtitle,
  onClick,
  trailing,
  destructive,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
}) => (
  <button
    onClick={onClick}
    className="w-full px-4 py-3 flex items-center gap-3 transition-colors active:scale-[0.98] active:opacity-80"
    style={{ background: "transparent" }}
    onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--foreground) / 0.02)")}
    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
  >
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: destructive ? "hsl(var(--destructive) / 0.1)" : "hsl(var(--primary) / 0.1)" }}
    >
      <Icon className={`w-4 h-4 ${destructive ? "text-destructive" : "text-primary"}`} />
    </div>
    <div className="flex-1 min-w-0 text-left">
      <p className={`text-[13px] font-semibold ${destructive ? "text-destructive" : "text-foreground"}`}>{title}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground/50 font-medium">{subtitle}</p>}
    </div>
    {trailing || <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/20 flex-shrink-0" />}
  </button>
);

const Divider = () => <div className="mx-4" style={{ height: 1, background: "hsl(var(--border) / 0.06)" }} />;

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminAuth();
  const { subscription, isActive } = useSubscription(user?.id ?? null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [swCacheSize, setSwCacheSize] = useState<number | null>(null);
  const [offlineCacheSize, setOfflineCacheSize] = useState<number | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [coverCacheCount, setCoverCacheCount] = useState(0);
  const [coverCacheSize, setCoverCacheSize] = useState<number | null>(null);
  const [pageCacheCount, setPageCacheCount] = useState({ albums: 0, artists: 0, playlists: 0 });
  const [biometricOn, setBiometricOn] = useState(isBiometricEnabled());
  const biometricSupported = isBiometricAvailable();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingActions, setPendingActions] = useState(getPendingCount());

  const [totalListeningSeconds, setTotalListeningSeconds] = useState(0);
  const [tracksPlayed, setTracksPlayed] = useState(0);
  const [likedCount, setLikedCount] = useState(0);
  const [playlistCount, setPlaylistCount] = useState(0);

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
                if (res) { const blob = await res.clone().blob(); total += blob.size; }
              } catch {}
            }
          }
          setSwCacheSize(total);
        } catch {}
      })();
      // Count cached page data (API responses for albums, artists, playlists)
      (async () => {
        try {
          const cacheNames = await caches.keys();
          let albums = 0, artists = 0, playlists = 0;
          for (const name of cacheNames) {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            for (const req of keys) {
              const url = req.url || "";
              if (url.includes("custom_albums")) albums++;
              else if (url.includes("custom_songs") || url.includes("artist_images")) artists++;
              else if (url.includes("playlist_songs")) playlists++;
            }
          }
          setPageCacheCount({ albums, artists, playlists });
        } catch {}
      })();
    }
    offlineCache.getCacheSize().then(setOfflineCacheSize).catch(() => {});
    offlineCache.getAllCached().then((songs) => setOfflineCount(songs.length)).catch(() => {});

    (async () => {
      try {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open("music-offline-cache", 2);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const tx = db.transaction("covers", "readonly");
        const store = tx.objectStore("covers");
        const allKeys = await new Promise<IDBValidKey[]>((resolve) => {
          const r = store.getAllKeys();
          r.onsuccess = () => resolve(r.result || []);
          r.onerror = () => resolve([]);
        });
        setCoverCacheCount(allKeys.length);
        const allBlobs = await new Promise<Blob[]>((resolve) => {
          const r = store.getAll();
          r.onsuccess = () => resolve(r.result || []);
          r.onerror = () => resolve([]);
        });
        setCoverCacheSize(allBlobs.reduce((sum, b) => sum + (b instanceof Blob ? b.size : 0), 0));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("usage_sessions").select("duration_seconds").eq("user_id", user.id),
      supabase.from("recently_played").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("liked_songs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("playlists").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(([sessions, recent, liked, playlists]) => {
      if (sessions.data) setTotalListeningSeconds(sessions.data.reduce((sum, s) => sum + (s.duration_seconds || 0), 0));
      setTracksPlayed(recent.count ?? 0);
      setLikedCount(liked.count ?? 0);
      setPlaylistCount(playlists.count ?? 0);
    });
  }, [user]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    const meta = user.user_metadata;
    setDisplayName(meta?.display_name || meta?.full_name || user.email?.split("@")[0] || "");
    setAvatarUrl(meta?.avatar_url || meta?.picture || null);
    supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user.id).single().then(({ data }) => {
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
      setAvatarUrl(`${urlData.publicUrl}?t=${Date.now()}`);
      toast.success("Photo mise à jour");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'upload");
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from("profiles").update({ display_name: displayName, avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq("user_id", user.id);
      await supabase.auth.updateUser({ data: { display_name: displayName, avatar_url: avatarUrl } });
      setEditingName(false);
      toast.success("Profil mis à jour !");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally { setSaving(false); }
  };

  if (!user) return null;
  const initials = (displayName || "U").slice(0, 2).toUpperCase();
  const totalUsed = (swCacheSize || 0) + (offlineCacheSize || 0) + (coverCacheSize || 0);
  const maxEstimate = Math.max(totalUsed * 2, 50 * 1024 * 1024);
  const swPercent = maxEstimate > 0 ? ((swCacheSize || 0) / maxEstimate) * 100 : 0;
  const coverPercent = maxEstimate > 0 ? ((coverCacheSize || 0) / maxEstimate) * 100 : 0;
  const offlinePercent = maxEstimate > 0 ? ((offlineCacheSize || 0) / maxEstimate) * 100 : 0;

  const plan = isActive && subscription ? normalizePlan(subscription.plan) : "free";
  const planBadge: Record<string, { bg: string; border: string; text: string }> = {
    premium: { bg: "hsl(var(--primary) / 0.12)", border: "hsl(var(--primary) / 0.2)", text: "hsl(var(--primary))" },
    gold: { bg: "hsl(45 90% 55% / 0.12)", border: "hsl(45 90% 55% / 0.2)", text: "hsl(45 90% 55%)" },
    vip: { bg: "hsl(0 70% 55% / 0.12)", border: "hsl(0 70% 55% / 0.2)", text: "hsl(0 70% 55%)" },
  };
  const badge = planBadge[plan];

  const formatListenTime = () => {
    if (totalListeningSeconds >= 3600) {
      const h = Math.floor(totalListeningSeconds / 3600);
      const m = Math.floor((totalListeningSeconds % 3600) / 60);
      return `${h}h${m}m`;
    }
    return `${Math.floor(totalListeningSeconds / 60)}m`;
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Ambient background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div
          className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(ellipse, hsl(var(--primary) / 0.07) 0%, transparent 70%)", filter: "blur(80px)" }}
        />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="sticky top-0 z-30 px-4 py-3"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
          background: "linear-gradient(180deg, hsl(var(--background) / 0.7), hsl(var(--background) / 0.5))",
          backdropFilter: "blur(80px) saturate(2.2) brightness(1.05)",
          WebkitBackdropFilter: "blur(80px) saturate(2.2) brightness(1.05)",
          borderBottom: "0.5px solid hsl(var(--foreground) / 0.06)",
        }}
      >
        <div className="max-w-lg mx-auto flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="flex-1 text-center text-sm font-bold text-foreground">Profil</h1>
          <div className="w-9" />
        </div>
      </motion.div>

      <div className="px-4 max-w-lg mx-auto space-y-3 mt-3">
        {/* ─── HERO : Avatar + Nom + Stats en une seule carte ─── */}
        <GlassCard className="relative overflow-hidden" delay={0}>
          <div
            className="absolute inset-x-0 top-0 h-24 pointer-events-none"
            style={{ background: "linear-gradient(180deg, hsl(var(--primary) / 0.06) 0%, transparent 100%)" }}
          />

          <div className="relative px-5 pt-5 pb-4">
            {/* Avatar + Info row */}
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative group cursor-pointer flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
                <div
                  className="absolute -inset-1 rounded-full"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--primary) / 0.05))", filter: "blur(4px)" }}
                />
                <Avatar className="relative w-16 h-16 shadow-xl" style={{ border: "2px solid hsl(var(--border) / 0.12)" }}>
                  <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                  <AvatarFallback className="text-base font-bold" style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
                </div>
                {isAdmin && (
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "hsl(var(--primary) / 0.9)", border: "2px solid hsl(var(--background))" }}
                  >
                    <Shield className="w-2.5 h-2.5 text-primary-foreground" />
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />

              {/* Name + email + badge */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <AnimatePresence mode="wait">
                    {editingName ? (
                      <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 flex-1">
                        <input
                          autoFocus
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSave()}
                          className="flex-1 min-w-0 text-base font-bold text-foreground bg-transparent border-b border-primary/30 focus:outline-none focus:border-primary py-0.5"
                        />
                        <button onClick={handleSave} disabled={saving} className="p-1 rounded-lg active:scale-90" style={{ color: "hsl(var(--primary))" }}>
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div key="display" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                        <h2 className="text-base font-bold text-foreground truncate">{displayName || "Utilisateur"}</h2>
                        <button onClick={() => setEditingName(true)} className="p-1 rounded-lg active:scale-90 text-muted-foreground/30 hover:text-muted-foreground/60">
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <p className="text-[11px] text-muted-foreground/50 font-medium truncate">{user.email}</p>
                {badge && (
                  <div
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full mt-1.5"
                    style={{ background: badge.bg, border: `1px solid ${badge.border}`, color: badge.text }}
                  >
                    <Crown className="w-3 h-3" />
                    <span className="text-[10px] font-bold capitalize">{getPlanConfig(plan).label}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats row compact */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              {[
                { icon: Clock, value: formatListenTime(), label: "Écoute" },
                { icon: Music, value: tracksPlayed.toString(), label: "Morceaux" },
                { icon: Heart, value: likedCount.toString(), label: "Favoris" },
                { icon: Headphones, value: playlistCount.toString(), label: "Playlists" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
                  className="py-2.5 rounded-xl text-center"
                  style={{ background: "hsl(var(--foreground) / 0.02)", border: "1px solid hsl(var(--border) / 0.04)" }}
                >
                  <stat.icon className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                  <p className="text-sm font-bold text-foreground leading-none">{stat.value}</p>
                  <p className="text-[9px] text-muted-foreground/50 mt-0.5 font-medium">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* ─── MENU RAPIDE ─── */}
        <GlassCard delay={0.08}>
          <MenuRow icon={Headphones} title="Paramètres audio" subtitle="Égaliseur, crossfade et qualité" onClick={() => navigate("/audio-settings")} />
          {isAdmin && (
            <>
              <Divider />
              <MenuRow icon={Shield} title="Administration" subtitle="Utilisateurs et contenus" onClick={() => navigate("/admin")} />
            </>
          )}
          {biometricSupported && (
            <>
              <Divider />
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "hsl(var(--primary) / 0.1)" }}>
                  <Fingerprint className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">Face ID / Touch ID</p>
                  <p className="text-[10px] text-muted-foreground/50 font-medium">Connexion biométrique</p>
                </div>
                <button
                  onClick={() => {
                    if (biometricOn) { disableBiometric(); setBiometricOn(false); toast.success("Biométrique désactivé"); }
                    else toast("Connectez-vous avec votre mot de passe pour activer");
                  }}
                  className="relative w-11 h-6 rounded-full transition-colors"
                  style={{ background: biometricOn ? "hsl(var(--primary))" : "hsl(var(--muted))" }}
                >
                  <motion.div
                    animate={{ x: biometricOn ? 20 : 3 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>
            </>
          )}
          {/* Auto-download Wi-Fi toggle */}
          <Divider />
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "hsl(var(--primary) / 0.1)" }}>
              <Wifi className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground">Téléchargement auto</p>
              <p className="text-[10px] text-muted-foreground/50 font-medium">En Wi-Fi, cache favoris & récents</p>
            </div>
            <button
              onClick={() => {
                const next = !isAutoDownloadEnabled();
                setAutoDownloadEnabled(next);
                setAutoDownloadOn(next);
                toast.success(next ? "Téléchargement auto activé" : "Téléchargement auto désactivé");
              }}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{ background: autoDownloadOn ? "hsl(var(--primary))" : "hsl(var(--muted))" }}
            >
              <motion.div
                animate={{ x: autoDownloadOn ? 20 : 3 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
              />
            </button>
          </div>
        </GlassCard>

        {/* ─── STOCKAGE COMPACT ─── */}
        <GlassCard className="p-4 space-y-3" delay={0.12}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "hsl(var(--primary) / 0.1)" }}>
                <Database className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-[13px] font-bold text-foreground">Stockage</h3>
                <p className="text-[10px] text-muted-foreground/50 font-medium">
                  {totalUsed > 0 ? formatBytes(totalUsed) : "Calcul…"}
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                if (isRefreshing) return;
                setIsRefreshing(true);
                try {
                  const reg = await navigator.serviceWorker?.getRegistration();
                  if (reg) await reg.update();
                  if (user) silentCacheRefresh(user.id);
                  const synced = await flushQueue();
                  setPendingActions(getPendingCount());
                  await queryClient.invalidateQueries();
                  toast.success(synced > 0 ? `${synced} action(s) synchronisée(s)` : "Données à jour !");
                } catch { toast.error("Erreur"); }
                finally { setIsRefreshing(false); }
              }}
              disabled={isRefreshing}
              className="p-2 rounded-xl active:scale-95 transition-transform"
              style={{ background: "hsl(var(--primary) / 0.08)" }}
            >
              {isRefreshing ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <RefreshCw className="w-4 h-4 text-primary" />}
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full overflow-hidden flex" style={{ background: "hsl(var(--foreground) / 0.03)" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${swPercent}%` }} transition={{ duration: 0.8, delay: 0.2 }}
              className="h-full" style={{ background: "hsl(var(--primary))", borderRadius: (offlinePercent > 0 || coverPercent > 0) ? "9999px 0 0 9999px" : "9999px" }} />
            <motion.div initial={{ width: 0 }} animate={{ width: `${coverPercent}%` }} transition={{ duration: 0.8, delay: 0.3 }}
              className="h-full" style={{ background: "hsl(var(--primary) / 0.55)" }} />
            <motion.div initial={{ width: 0 }} animate={{ width: `${offlinePercent}%` }} transition={{ duration: 0.8, delay: 0.4 }}
              className="h-full" style={{ background: "hsl(var(--primary) / 0.3)", borderRadius: "0 9999px 9999px 0" }} />
          </div>

          {/* Legend compact - 4 columns */}
          <div className="grid grid-cols-4 gap-1">
            <div className="text-center py-1.5">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(var(--primary))" }} />
                <span className="text-[9px] text-muted-foreground/60 font-medium">Cache</span>
              </div>
              <p className="text-[10px] font-semibold text-foreground">{swCacheSize !== null ? formatBytes(swCacheSize) : "…"}</p>
            </div>
            <div className="text-center py-1.5">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(var(--primary) / 0.55)" }} />
                <span className="text-[9px] text-muted-foreground/60 font-medium">Pochettes</span>
              </div>
              <p className="text-[10px] font-semibold text-foreground">{coverCacheCount}</p>
            </div>
            <div className="text-center py-1.5">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(var(--primary) / 0.3)" }} />
                <span className="text-[9px] text-muted-foreground/60 font-medium">Hors-ligne</span>
              </div>
              <p className="text-[10px] font-semibold text-foreground">{offlineCount} titre{offlineCount > 1 ? "s" : ""}</p>
            </div>
            <div className="text-center py-1.5">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Layers className="w-2.5 h-2.5 text-primary/60" />
                <span className="text-[9px] text-muted-foreground/60 font-medium">Pages</span>
              </div>
              <p className="text-[10px] font-semibold text-foreground">{pageCacheCount.albums + pageCacheCount.artists + pageCacheCount.playlists}</p>
            </div>
          </div>

          {pendingActions > 0 && (
            <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg" style={{ background: "hsl(var(--primary) / 0.06)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-semibold text-primary">{pendingActions} action{pendingActions > 1 ? "s" : ""} en attente</span>
            </div>
          )}

          {/* Clear cache */}
          <button
            onClick={async () => {
              if (!("caches" in window)) return;
              const names = await caches.keys();
              await Promise.all(names.map((n) => caches.delete(n)));
              setSwCacheSize(0);
              toast.success("Cache vidé !");
            }}
            className="w-full py-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
            style={{ background: "hsl(var(--destructive) / 0.06)", color: "hsl(var(--destructive))" }}
          >
            <Trash2 className="w-3 h-3" />
            Vider le cache
          </button>
        </GlassCard>

        {/* ─── DÉCONNEXION ─── */}
        <GlassCard delay={0.16}>
          <MenuRow
            icon={LogOut}
            title="Se déconnecter"
            destructive
            onClick={async () => { await signOut(); navigate("/"); }}
            trailing={<span />}
          />
        </GlassCard>
      </div>
    </div>
  );
};

export default ProfilePage;
