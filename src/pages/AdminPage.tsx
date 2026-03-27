import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Users, Music, Radio, ListMusic, Shield, Loader2, Trash2, Crown, ShieldOff, UserX, ScrollText, Pencil, Check, X, Activity } from "lucide-react";
import { resolveLog } from "@/lib/resolveLog";
import { motion } from "framer-motion";
import { toast } from "sonner";

type Tab = "users" | "songs" | "radios" | "stats" | "logs" | "resolve";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  isAdmin?: boolean;
}

const AdminPage = () => {
  const { isAdmin, loading } = useAdminAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("stats");

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/", { replace: true });
  }, [loading, isAdmin, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "stats", label: "Statistiques", icon: Shield },
    { key: "users", label: "Utilisateurs", icon: Users },
    { key: "songs", label: "Morceaux", icon: Music },
    { key: "radios", label: "Radios", icon: Radio },
    { key: "logs", label: "Logs", icon: ScrollText },
    { key: "resolve", label: "Résolution", icon: Activity },
  ];

  return (
    <div className="min-h-screen pb-40">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-destructive/10 via-destructive/5 to-background" />
        <div className="relative px-4 md:px-8 pt-6 pb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Shield className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Administration</h1>
              <p className="text-sm text-muted-foreground">Gérez votre application</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 px-4 md:px-8 mb-5 overflow-x-auto scrollbar-hide pb-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              tab === key
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                : "bg-secondary/80 text-secondary-foreground hover:bg-secondary"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 md:px-8 max-w-4xl mx-auto">
        {tab === "stats" && <StatsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "songs" && <SongsTab />}
        {tab === "radios" && <RadiosTab />}
        {tab === "logs" && <LogsTab />}
        {tab === "resolve" && <ResolveTab />}
      </div>
    </div>
  );
};

function StatsTab() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [profiles, songs, radios, playlists, liked] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("custom_songs").select("id", { count: "exact", head: true }),
        supabase.from("custom_radio_stations").select("id", { count: "exact", head: true }),
        supabase.from("playlists").select("id", { count: "exact", head: true }),
        supabase.from("liked_songs").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        users: profiles.count || 0,
        songs: songs.count || 0,
        radios: radios.count || 0,
        playlists: playlists.count || 0,
        liked: liked.count || 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mt-12" />;

  const cards = [
    { label: "Utilisateurs", value: stats.users, icon: Users, color: "text-blue-400" },
    { label: "Morceaux custom", value: stats.songs, icon: Music, color: "text-primary" },
    { label: "Radios custom", value: stats.radios, icon: Radio, color: "text-orange-400" },
    { label: "Playlists", value: stats.playlists, icon: ListMusic, color: "text-purple-400" },
    { label: "Titres aimés", value: stats.liked, icon: Music, color: "text-pink-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-xl bg-secondary/50 border border-border p-4"
        >
          <c.icon className={`w-5 h-5 ${c.color} mb-2`} />
          <p className="text-2xl font-bold text-foreground">{c.value}</p>
          <p className="text-xs text-muted-foreground">{c.label}</p>
        </motion.div>
      ))}
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { user: currentAdmin } = useAdminAuth();

  const loadUsers = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    const adminIds = new Set((roles || []).filter(r => r.role === "admin").map(r => r.user_id));

    setUsers(
      (profiles || []).map((p) => ({
        ...p,
        isAdmin: adminIds.has(p.user_id),
      }))
    );
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const manageRole = async (action: string, targetUserId: string) => {
    setActionLoading(`${action}-${targetUserId}`);
    try {
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: { action, target_user_id: targetUserId, role: "admin" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      const labels: Record<string, string> = {
        promote: "Utilisateur promu admin",
        demote: "Rôle admin retiré",
        delete_user: "Utilisateur supprimé",
      };
      toast.success(labels[action] || "Action effectuée");
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mt-12" />;

  return (
    <div className="space-y-2">
      {users.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Aucun utilisateur</p>
      ) : (
        users.map((u) => {
          const isSelf = u.user_id === currentAdmin?.id;
          return (
            <motion.div
              key={u.user_id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border group"
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                {(u.display_name || "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {u.display_name || "Sans nom"}
                  {isSelf && <span className="text-xs text-muted-foreground ml-1">(vous)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  Inscrit le {new Date(u.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>

              {u.isAdmin ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">
                  <Crown className="w-3 h-3" />
                  Admin
                </span>
              ) : null}

              {/* Actions */}
              {!isSelf && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {u.isAdmin ? (
                    <button
                      onClick={() => manageRole("demote", u.user_id)}
                      disabled={actionLoading === `demote-${u.user_id}`}
                      className="p-1.5 rounded-full text-muted-foreground hover:text-orange-400 transition-colors"
                      title="Retirer admin"
                    >
                      {actionLoading === `demote-${u.user_id}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldOff className="w-4 h-4" />
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => manageRole("promote", u.user_id)}
                      disabled={actionLoading === `promote-${u.user_id}`}
                      className="p-1.5 rounded-full text-muted-foreground hover:text-primary transition-colors"
                      title="Promouvoir admin"
                    >
                      {actionLoading === `promote-${u.user_id}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Shield className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Supprimer ${u.display_name || "cet utilisateur"} ? Cette action est irréversible.`)) {
                        manageRole("delete_user", u.user_id);
                      }
                    }}
                    disabled={actionLoading === `delete_user-${u.user_id}`}
                    className="p-1.5 rounded-full text-muted-foreground hover:text-destructive transition-colors"
                    title="Supprimer l'utilisateur"
                  >
                    {actionLoading === `delete_user-${u.user_id}` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserX className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          );
        })
      )}
    </div>
  );
}

function SongsTab() {
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("custom_songs")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setSongs(data || []);
        setLoading(false);
      });
  }, []);

  const handleDelete = async (id: string) => {
    await supabase.from("custom_songs").delete().eq("id", id);
    setSongs((prev) => prev.filter((s) => s.id !== id));
    toast.success("Morceau supprimé");
  };

  const startEdit = (s: any) => {
    setEditingId(s.id);
    setEditTitle(s.title);
    setEditArtist(s.artist);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim() || !editArtist.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("custom_songs")
      .update({ title: editTitle.trim(), artist: editArtist.trim() })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Erreur lors de la modification");
      return;
    }
    setSongs((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: editTitle.trim(), artist: editArtist.trim() } : s))
    );
    setEditingId(null);
    toast.success("Morceau modifié");
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mt-12" />;

  return (
    <div className="space-y-2">
      {songs.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Aucun morceau custom</p>
      ) : (
        songs.map((s) => (
          <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border group">
            {s.cover_url && (
              <img src={s.cover_url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
            )}
            {editingId === s.id ? (
              <div className="flex-1 min-w-0 space-y-1.5">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-sm font-medium bg-background/80 border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Titre"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && saveEdit(s.id)}
                />
                <input
                  value={editArtist}
                  onChange={(e) => setEditArtist(e.target.value)}
                  className="w-full text-xs bg-background/80 border border-border rounded px-2 py-1 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Artiste"
                  onKeyDown={(e) => e.key === "Enter" && saveEdit(s.id)}
                />
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                <p className="text-xs text-muted-foreground truncate">{s.artist}</p>
              </div>
            )}
            {editingId === s.id ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => saveEdit(s.id)}
                  disabled={saving}
                  className="p-1.5 rounded-full text-primary hover:bg-primary/10 transition-colors"
                  title="Sauvegarder"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={cancelEdit}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                  title="Annuler"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(s)}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-primary transition-colors"
                  title="Modifier"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-destructive transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function RadiosTab() {
  const [radios, setRadios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("custom_radio_stations")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRadios(data || []);
        setLoading(false);
      });
  }, []);

  const handleDelete = async (id: string) => {
    await supabase.from("custom_radio_stations").delete().eq("id", id);
    setRadios((prev) => prev.filter((r) => r.id !== id));
    toast.success("Radio supprimée");
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mt-12" />;

  return (
    <div className="space-y-2">
      {radios.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Aucune radio custom</p>
      ) : (
        radios.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border group">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
              <p className="text-xs text-muted-foreground truncate">{r.genre || "Radio"}</p>
            </div>
            <button
              onClick={() => handleDelete(r.id)}
              className="p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setLogs(data || []);
        setLoading(false);
      });
  }, []);

  const actionLabels: Record<string, { label: string; color: string }> = {
    promote: { label: "Promotion", color: "text-primary" },
    demote: { label: "Rétrogradation", color: "text-orange-400" },
    delete_user: { label: "Suppression", color: "text-destructive" },
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mt-12" />;

  return (
    <div className="space-y-2">
      {logs.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Aucun log enregistré</p>
      ) : (
        logs.map((log) => {
          const info = actionLabels[log.action] || { label: log.action, color: "text-foreground" };
          return (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30 border border-border"
            >
              <ScrollText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className={`font-semibold ${info.color}`}>{info.label}</span>
                  {log.details?.role && (
                    <span className="text-muted-foreground"> — rôle: {log.details.role}</span>
                  )}
                  {log.details?.deleted_user_name && (
                    <span className="text-muted-foreground"> — {log.details.deleted_user_name}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(log.created_at).toLocaleString("fr-FR")}
                  {log.target_user_id && (
                    <span className="ml-2 font-mono text-[10px] opacity-60">
                      cible: {log.target_user_id.slice(0, 8)}…
                    </span>
                  )}
                </p>
              </div>
            </motion.div>
          );
        })
      )}
    </div>
  );
}

function ResolveTab() {
  const [entries, setEntries] = useState(resolveLog.getAll());
  const stats = resolveLog.stats();
  const [filter, setFilter] = useState<"all" | "custom" | "hd" | "none">("all");

  const refresh = () => setEntries(resolveLog.getAll());

  const filtered = filter === "all" ? entries : entries.filter((e) => e.source === filter);

  const statCards = [
    { label: "Total", value: stats.total, color: "text-foreground" },
    { label: "Custom", value: stats.custom, color: "text-primary" },
    { label: "HD", value: stats.hd, color: "text-blue-400" },
    { label: "Échecs", value: stats.none, color: "text-destructive" },
    { label: "Corrigés", value: stats.corrected, color: "text-orange-400" },
  ];

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-5 gap-2">
        {statCards.map((c) => (
          <div key={c.label} className="rounded-xl bg-secondary/50 border border-border p-3 text-center">
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-[10px] text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filter + actions */}
      <div className="flex items-center gap-2">
        {(["all", "custom", "hd", "none"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/80 text-secondary-foreground hover:bg-secondary"
            }`}
          >
            {f === "all" ? "Tous" : f === "custom" ? "Custom" : f === "hd" ? "HD" : "Échecs"}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={refresh}
          className="px-3 py-1 rounded-full text-xs font-medium bg-secondary/80 text-secondary-foreground hover:bg-secondary transition-colors"
        >
          Rafraîchir
        </button>
        <button
          onClick={() => { resolveLog.clear(); setEntries([]); toast.success("Logs vidés"); }}
          className="px-3 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
        >
          Vider
        </button>
      </div>

      {/* Entries list */}
      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto scrollbar-hide">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Aucune résolution enregistrée dans cette session</p>
        ) : (
          [...filtered].reverse().map((e, i) => {
            const sourceColor = e.source === "custom" ? "text-primary" : e.source === "hd" ? "text-blue-400" : "text-destructive";
            const sourceLabel = e.source === "custom" ? "Custom" : e.source === "hd" ? "HD" : "Échec";
            return (
              <motion.div
                key={`${e.songId}-${e.ts}-${i}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="p-3 rounded-xl bg-secondary/30 border border-border"
              >
                <div className="flex items-start gap-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${sourceColor} bg-current/10`}
                    style={{ backgroundColor: `hsl(var(--secondary))` }}
                  >
                    {sourceLabel}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.originalTitle}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.originalArtist}</p>
                    {e.resolvedTitle && e.resolvedTitle !== e.originalTitle && (
                      <p className="text-[11px] text-orange-400 mt-0.5 truncate">→ {e.resolvedTitle}</p>
                    )}
                    {e.resolvedArtist && e.resolvedArtist !== e.originalArtist && (
                      <p className="text-[11px] text-orange-400 truncate">→ {e.resolvedArtist}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">
                    {new Date(e.ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default AdminPage;
