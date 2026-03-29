import { useState, useRef, useEffect } from "react";
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
  Clock, Music, Heart, BarChart3, Sparkles, RefreshCw, Download
} from "lucide-react";
import { silentCacheRefresh } from "@/lib/appCache";
import { getPendingCount, flushQueue } from "@/lib/offlineQueue";
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
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    className={`rounded-3xl ${className}`}
    style={{
      background: "hsl(var(--card) / 0.3)",
      backdropFilter: "blur(48px) saturate(1.6)",
      WebkitBackdropFilter: "blur(48px) saturate(1.6)",
      border: "1px solid hsl(var(--border) / 0.08)",
      boxShadow: "0 8px 40px hsl(0 0% 0% / 0.2), inset 0 1px 0 hsl(0 0% 100% / 0.03)",
    }}
  >
    {children}
  </motion.div>
);

const StatCard = ({ icon: Icon, value, label, delay }: { icon: any; value: string; label: string; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    className="p-4 rounded-2xl text-center"
    style={{
      background: "hsl(var(--card) / 0.25)",
      border: "1px solid hsl(var(--border) / 0.06)",
      boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.02)",
    }}
  >
    <div
      className="w-8 h-8 rounded-xl mx-auto mb-2 flex items-center justify-center"
      style={{ background: "hsl(var(--primary) / 0.1)" }}
    >
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <p className="text-xl font-bold text-foreground leading-none">{value}</p>
    <p className="text-[10px] text-muted-foreground mt-1.5 font-medium">{label}</p>
  </motion.div>
);

const MenuRow = ({
  icon: Icon,
  iconBg,
  title,
  subtitle,
  onClick,
  trailing,
}: {
  icon: any;
  iconBg?: string;
  title: string;
  subtitle: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className="w-full p-4 flex items-center gap-3.5 transition-colors active:scale-[0.98] active:opacity-80"
    style={{ background: "transparent" }}
    onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--foreground) / 0.02)")}
    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
  >
    <div
      className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{ background: iconBg || "hsl(var(--primary) / 0.1)" }}
    >
      <Icon className="w-4.5 h-4.5 text-primary" />
    </div>
    <div className="flex-1 min-w-0 text-left">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground/60 font-medium">{subtitle}</p>
    </div>
    {trailing || <ChevronRight className="w-4 h-4 text-muted-foreground/20 flex-shrink-0" />}
  </button>
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
    if (!user) return;
    Promise.all([
      supabase.from("usage_sessions").select("duration_seconds").eq("user_id", user.id),
      supabase.from("recently_played").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("liked_songs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("playlists").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(([sessions, recent, liked, playlists]) => {
      if (sessions.data) {
        setTotalListeningSeconds(sessions.data.reduce((sum, s) => sum + (s.duration_seconds || 0), 0));
      }
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

  const plan = isActive && subscription ? normalizePlan(subscription.plan) : "free";
  const planBadge: Record<string, { bg: string; border: string; text: string }> = {
    premium: { bg: "hsl(var(--primary) / 0.12)", border: "hsl(var(--primary) / 0.2)", text: "hsl(var(--primary))" },
    gold: { bg: "hsl(45 90% 55% / 0.12)", border: "hsl(45 90% 55% / 0.2)", text: "hsl(45 90% 55%)" },
    vip: { bg: "hsl(0 70% 55% / 0.12)", border: "hsl(0 70% 55% / 0.2)", text: "hsl(0 70% 55%)" },
  };
  const badge = planBadge[plan];

  return (
    <div className="min-h-screen pb-20">
      {/* Ambient background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div
          className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(ellipse, hsl(var(--primary) / 0.08) 0%, transparent 70%)", filter: "blur(80px)" }}
        />
        <div
          className="absolute bottom-[20%] right-[-10%] w-[400px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(ellipse, hsl(var(--accent) / 0.06) 0%, transparent 70%)", filter: "blur(100px)" }}
        />
        <div
          className="absolute top-[50%] left-[-5%] w-[300px] h-[300px] rounded-full"
          style={{ background: "radial-gradient(ellipse, hsl(var(--primary) / 0.04) 0%, transparent 70%)", filter: "blur(80px)" }}
        />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="sticky top-0 z-30 px-4 md:px-8 py-3"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
          background: "hsl(var(--background) / 0.6)",
          backdropFilter: "blur(40px) saturate(1.4)",
          WebkitBackdropFilter: "blur(40px) saturate(1.4)",
          borderBottom: "1px solid hsl(var(--border) / 0.06)",
        }}
      >
        <div className="max-w-lg mx-auto flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <h1 className="flex-1 text-center text-sm font-bold text-foreground">Profil</h1>
          <div className="w-14" /> {/* balance */}
        </div>
      </motion.div>

      <div className="px-4 md:px-8 max-w-lg mx-auto space-y-4 mt-4">
        {/* Hero profile */}
        <GlassCard className="relative overflow-hidden" delay={0}>
          {/* Decorative gradient */}
          <div
            className="absolute inset-x-0 top-0 h-32 pointer-events-none"
            style={{ background: "linear-gradient(180deg, hsl(var(--primary) / 0.08) 0%, transparent 100%)" }}
          />

          <div className="relative p-6 pb-5 text-center">
            {/* Avatar */}
            <div className="relative group cursor-pointer mx-auto w-fit" onClick={() => fileInputRef.current?.click()}>
              <div
                className="absolute -inset-1.5 rounded-full"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary) / 0.4), hsl(var(--primary) / 0.1))",
                  filter: "blur(6px)",
                }}
              />
              <Avatar className="relative w-24 h-24 shadow-2xl" style={{ border: "2px solid hsl(var(--border) / 0.15)" }}>
                <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                <AvatarFallback
                  className="text-xl font-bold"
                  style={{ background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
              </div>
              {isAdmin && (
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{
                    background: "hsl(var(--primary) / 0.9)",
                    border: "2px solid hsl(var(--background))",
                  }}
                >
                  <Shield className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              )}
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />

            <h2 className="mt-4 text-lg font-bold text-foreground">{displayName || "Utilisateur"}</h2>
            <p className="text-xs text-muted-foreground/60 font-medium">{user.email}</p>

            {badge && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full"
                style={{
                  background: badge.bg,
                  border: `1px solid ${badge.border}`,
                  color: badge.text,
                }}
              >
                <Crown className="w-3.5 h-3.5" />
                <span className="text-xs font-bold capitalize">{getPlanConfig(plan).label}</span>
              </motion.div>
            )}
          </div>
        </GlassCard>

        {/* Stats */}
        <GlassCard className="p-5" delay={0.05}>
          <div className="flex items-center gap-2.5 mb-4">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: "hsl(var(--primary) / 0.1)" }}
            >
              <BarChart3 className="w-3.5 h-3.5 text-primary" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Statistiques d'écoute</h3>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard
              icon={Clock}
              value={totalListeningSeconds >= 3600
                ? `${Math.floor(totalListeningSeconds / 3600)}h${Math.floor((totalListeningSeconds % 3600) / 60)}m`
                : `${Math.floor(totalListeningSeconds / 60)}m`}
              label="Temps d'écoute"
              delay={0.1}
            />
            <StatCard icon={Music} value={tracksPlayed.toString()} label="Morceaux joués" delay={0.15} />
            <StatCard icon={Heart} value={likedCount.toString()} label="Favoris" delay={0.2} />
            <StatCard icon={Headphones} value={playlistCount.toString()} label="Playlists" delay={0.25} />
          </div>
        </GlassCard>

        {/* Edit name */}
        <GlassCard className="p-5 space-y-4" delay={0.1}>
          <div className="flex items-center gap-2.5 mb-1">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: "hsl(var(--primary) / 0.1)" }}
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Informations</h3>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground/60 mb-1.5 uppercase tracking-wider">
              Nom d'affichage
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Votre nom"
              className="w-full px-4 py-2.5 rounded-2xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none transition-all"
              style={{
                background: "hsl(var(--foreground) / 0.03)",
                border: "1px solid hsl(var(--border) / 0.08)",
                boxShadow: "inset 0 1px 2px hsl(0 0% 0% / 0.1)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.3)";
                e.currentTarget.style.boxShadow = "inset 0 1px 2px hsl(0 0% 0% / 0.1), 0 0 0 3px hsl(var(--primary) / 0.08)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "hsl(var(--border) / 0.08)";
                e.currentTarget.style.boxShadow = "inset 0 1px 2px hsl(0 0% 0% / 0.1)";
              }}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground/60 mb-1.5 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={user.email || ""}
              disabled
              className="w-full px-4 py-2.5 rounded-2xl text-sm text-muted-foreground/50 cursor-not-allowed"
              style={{
                background: "hsl(var(--foreground) / 0.015)",
                border: "1px solid hsl(var(--border) / 0.05)",
              }}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            style={{
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)",
            }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Sauvegarder
          </button>
        </GlassCard>

        {/* Quick links */}
        <GlassCard delay={0.15}>
          <div style={{ borderBottom: "1px solid hsl(var(--border) / 0.05)" }}>
            <MenuRow
              icon={Headphones}
              title="Paramètres audio"
              subtitle="Égaliseur, crossfade, presets"
              onClick={() => navigate("/audio-settings")}
            />
          </div>

          {isAdmin && (
            <div style={{ borderBottom: "1px solid hsl(var(--border) / 0.05)" }}>
              <MenuRow
                icon={Shield}
                title="Administration"
                subtitle="Gérer les utilisateurs et contenus"
                onClick={() => navigate("/admin")}
              />
            </div>
          )}

          {biometricSupported && (
            <div className="p-4 flex items-center gap-3.5">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "hsl(var(--primary) / 0.1)" }}
              >
                <Fingerprint className="w-4.5 h-4.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-foreground">Face ID / Touch ID</p>
                <p className="text-[11px] text-muted-foreground/60 font-medium">Connexion biométrique rapide</p>
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
                className="relative w-12 h-7 rounded-full transition-colors"
                style={{ background: biometricOn ? "hsl(var(--primary))" : "hsl(var(--muted))" }}
              >
                <motion.div
                  animate={{ x: biometricOn ? 22 : 3 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="absolute top-1.5 w-4 h-4 rounded-full bg-white shadow-sm"
                />
              </button>
            </div>
          )}
        </GlassCard>

        {/* Storage */}
        <GlassCard className="p-5 space-y-4" delay={0.2}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "hsl(var(--primary) / 0.1)" }}
            >
              <Database className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Stockage</h3>
              <p className="text-[11px] text-muted-foreground/60 font-medium">
                {totalUsed > 0 ? `${formatBytes(totalUsed)} utilisé` : "Calcul…"}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div
            className="h-2.5 rounded-full overflow-hidden flex"
            style={{ background: "hsl(var(--foreground) / 0.03)" }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${swPercent}%` }}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              className="h-full"
              style={{
                background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))",
                borderRadius: offlinePercent > 0 ? "9999px 0 0 9999px" : "9999px",
              }}
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${offlinePercent}%` }}
              transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
              className="h-full"
              style={{
                background: "hsl(var(--primary) / 0.35)",
                borderRadius: "0 9999px 9999px 0",
              }}
            />
          </div>

          {/* Legend */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(var(--primary))" }} />
                <span className="text-xs text-muted-foreground font-medium">Cache navigateur</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
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
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors active:scale-95"
                  style={{
                    background: "hsl(var(--destructive) / 0.08)",
                    color: "hsl(var(--destructive))",
                  }}
                >
                  Vider
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(var(--primary) / 0.35)" }} />
                <span className="text-xs text-muted-foreground font-medium">Hors-ligne</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {offlineCount} titre{offlineCount > 1 ? "s" : ""} · {offlineCacheSize !== null ? formatBytes(offlineCacheSize) : "…"}
                </span>
                <HardDrive className="w-3.5 h-3.5 text-muted-foreground/25" />
              </div>
            </div>
          </div>

          {/* Force refresh button */}
          <button
            onClick={async () => {
              if (isRefreshing) return;
              setIsRefreshing(true);
              try {
                // Refresh SW cache
                const reg = await navigator.serviceWorker?.getRegistration();
                if (reg) await reg.update();
                // Refresh app data cache
                if (user) silentCacheRefresh(user.id);
                // Sync offline queue
                const synced = await flushQueue();
                setPendingActions(getPendingCount());
                toast.success(synced > 0
                  ? `Mis à jour ! ${synced} action(s) synchronisée(s)`
                  : "Tout est à jour !"
                );
              } catch {
                toast.error("Erreur lors de la mise à jour");
              } finally {
                setIsRefreshing(false);
              }
            }}
            disabled={isRefreshing}
            className="w-full py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98] disabled:opacity-50"
            style={{
              background: "hsl(var(--primary) / 0.08)",
              color: "hsl(var(--primary))",
              border: "1px solid hsl(var(--primary) / 0.12)",
            }}
          >
            {isRefreshing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {isRefreshing ? "Mise à jour…" : "Forcer la mise à jour"}
            {pendingActions > 0 && (
              <span
                className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                style={{ background: "hsl(var(--primary) / 0.15)" }}
              >
                {pendingActions} en attente
              </span>
            )}
          </button>

          <button
            onClick={async () => {
              if (!("caches" in window)) return;
              const names = await caches.keys();
              await Promise.all(names.map((n) => caches.delete(n)));
              setSwCacheSize(0);
              toast.success("Tout le cache a été vidé !");
            }}
            className="w-full py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]"
            style={{
              background: "hsl(var(--destructive) / 0.06)",
              color: "hsl(var(--destructive))",
              border: "1px solid hsl(var(--destructive) / 0.08)",
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Vider tout le cache
          </button>
        </GlassCard>

        {/* Logout */}
        <GlassCard delay={0.25}>
          <button
            onClick={async () => { await signOut(); navigate("/"); }}
            className="w-full p-4 flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors active:scale-[0.98]"
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
