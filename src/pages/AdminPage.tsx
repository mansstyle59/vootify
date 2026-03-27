import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Users, Music, Radio, ListMusic, Shield, Loader2, Trash2, Crown, ShieldOff, UserX, ScrollText, Pencil, Check, X, Activity, LayoutDashboard, GripVertical, Eye, EyeOff, Save, Plus, Search } from "lucide-react";
import { useHomeConfig, useSaveHomeConfig, type HomeSection, type HomeConfig, type CustomSection } from "@/hooks/useHomeConfig";

import { motion } from "framer-motion";
import { toast } from "sonner";

type Tab = "users" | "songs" | "radios" | "stats" | "logs" | "home";

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
    { key: "home", label: "Accueil", icon: LayoutDashboard },
    { key: "users", label: "Utilisateurs", icon: Users },
    { key: "songs", label: "Morceaux", icon: Music },
    { key: "radios", label: "Radios", icon: Radio },
    { key: "logs", label: "Logs", icon: ScrollText },
  ];

  return (
    <div className="min-h-screen pb-40 animate-fade-in">
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
        {tab === "home" && <HomeTab />}
        {tab === "users" && <UsersTab />}
        {tab === "songs" && <SongsTab />}
        {tab === "radios" && <RadiosTab />}
        {tab === "logs" && <LogsTab />}
        
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

  const loadSongs = async () => {
    setLoading(true);
    // Fetch all songs by paginating past the 1000-row default limit
    let allSongs: any[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data } = await supabase
        .from("custom_songs")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      allSongs = allSongs.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    setSongs(allSongs);
    setLoading(false);
  };

  useEffect(() => { loadSongs(); }, []);

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

function HomeTab() {
  const { data: config, isLoading } = useHomeConfig();
  const saveMutation = useSaveHomeConfig();
  const { user } = useAdminAuth();
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [customSections, setCustomSections] = useState<CustomSection[]>([]);
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [heroBgColor, setHeroBgColor] = useState("");
  const [heroBgImage, setHeroBgImage] = useState("");
  const [editingCustom, setEditingCustom] = useState<string | null>(null);
  const [songPickerOpen, setSongPickerOpen] = useState(false);

  useEffect(() => {
    if (config) {
      setSections([...config.sections].sort((a, b) => a.order - b.order));
      setCustomSections(config.customSections || []);
      setHeroTitle(config.heroTitle || "");
      setHeroSubtitle(config.heroSubtitle || "");
      setHeroBgColor(config.heroBgColor || "");
      setHeroBgImage(config.heroBgImage || "");
    }
  }, [config]);

  const toggleVisibility = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s))
    );
  };

  const updateTitle = (id: string, title: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title } : s))
    );
  };

  const moveSection = (from: number, to: number) => {
    if (to < 0 || to >= sections.length) return;
    const updated = [...sections];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setSections(updated.map((s, i) => ({ ...s, order: i })));
  };

  const addCustomSection = () => {
    const id = `custom_${Date.now()}`;
    const newCustom: CustomSection = { id, title: "Nouvelle section", songIds: [] };
    setCustomSections((prev) => [...prev, newCustom]);
    // Add to sections list
    setSections((prev) => [
      ...prev,
      { id, title: "Nouvelle section ⭐", visible: true, order: prev.length },
    ]);
    setEditingCustom(id);
    setSongPickerOpen(true);
  };

  const removeCustomSection = (id: string) => {
    setCustomSections((prev) => prev.filter((c) => c.id !== id));
    setSections((prev) => prev.filter((s) => s.id !== id));
    if (editingCustom === id) setEditingCustom(null);
  };

  const updateCustomTitle = (id: string, title: string) => {
    setCustomSections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
    updateTitle(id, title);
  };

  const updateCustomSongs = (id: string, songIds: string[]) => {
    setCustomSections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, songIds } : c))
    );
  };

  const handleSave = () => {
    if (!user) return;
    saveMutation.mutate(
      {
        config: {
          sections: sections.map((s, i) => ({ ...s, order: i })),
          customSections,
          heroTitle: heroTitle || undefined,
          heroSubtitle: heroSubtitle || undefined,
          heroBgColor: heroBgColor || undefined,
          heroBgImage: heroBgImage || undefined,
        },
        userId: user.id,
      },
      {
        onSuccess: () => toast.success("Page d'accueil mise à jour ✨"),
        onError: () => toast.error("Erreur lors de la sauvegarde"),
      }
    );
  };

  if (isLoading) return <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mt-12" />;

  return (
    <div className="space-y-6">
      {/* Hero customization */}
      <div className="rounded-xl bg-secondary/30 border border-border p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-primary" />
          Bannière d'accueil
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Sous-titre personnalisé (optionnel)</label>
            <input
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              placeholder="Ex: Bienvenue sur votre plateforme musicale"
              className="w-full text-sm bg-background/80 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Couleur de fond (optionnel)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={heroBgColor || "#000000"}
                onChange={(e) => setHeroBgColor(e.target.value)}
                className="w-9 h-9 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
              />
              <input
                value={heroBgColor}
                onChange={(e) => setHeroBgColor(e.target.value)}
                placeholder="#1a1a2e ou rgb(26,26,46)"
                className="flex-1 text-sm bg-background/80 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {heroBgColor && (
                <button onClick={() => setHeroBgColor("")} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Image de fond (URL, optionnel)</label>
            <input
              value={heroBgImage}
              onChange={(e) => setHeroBgImage(e.target.value)}
              placeholder="https://exemple.com/image.jpg"
              className="w-full text-sm bg-background/80 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {heroBgImage && (
              <div className="mt-2 relative rounded-lg overflow-hidden h-20">
                <img src={heroBgImage} alt="Aperçu" className="w-full h-full object-cover" />
                <button onClick={() => setHeroBgImage("")} className="absolute top-1 right-1 p-1 rounded-full bg-background/50 text-foreground hover:bg-background/70"><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sections ordering */}
      <div className="rounded-xl bg-secondary/30 border border-border p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <ListMusic className="w-4 h-4 text-primary" />
          Sections (ordre & visibilité)
        </h3>
        <div className="space-y-1.5">
          {sections.map((section, idx) => {
            const isCustom = section.id.startsWith("custom_");
            return (
              <motion.div
                key={section.id}
                layout
                className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${
                  section.visible
                    ? "bg-background/60 border-border"
                    : "bg-muted/30 border-border/50 opacity-60"
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveSection(idx, idx - 1)}
                    disabled={idx === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-opacity text-xs leading-none"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveSection(idx, idx + 1)}
                    disabled={idx === sections.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-opacity text-xs leading-none"
                  >
                    ▼
                  </button>
                </div>

                <input
                  value={section.title}
                  onChange={(e) => {
                    updateTitle(section.id, e.target.value);
                    if (isCustom) updateCustomTitle(section.id, e.target.value);
                  }}
                  className="flex-1 text-sm font-medium bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 rounded px-1 min-w-0"
                />

                {isCustom && (
                  <>
                    <button
                      onClick={() => { setEditingCustom(section.id); setSongPickerOpen(true); }}
                      className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                      title="Gérer les morceaux"
                    >
                      <Music className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {customSections.find((c) => c.id === section.id)?.songIds.length || 0}
                    </span>
                    <button
                      onClick={() => removeCustomSection(section.id)}
                      className="p-1.5 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Supprimer la section"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}

                <button
                  onClick={() => toggleVisibility(section.id)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    section.visible
                      ? "text-primary hover:bg-primary/10"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                  title={section.visible ? "Masquer" : "Afficher"}
                >
                  {section.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </motion.div>
            );
          })}
        </div>

        <button
          onClick={addCustomSection}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors w-full justify-center"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter une section personnalisée
        </button>
      </div>

      {/* Song picker modal */}
      {songPickerOpen && editingCustom && (
        <SongPickerModal
          sectionId={editingCustom}
          selectedIds={customSections.find((c) => c.id === editingCustom)?.songIds || []}
          onUpdate={(ids) => updateCustomSongs(editingCustom, ids)}
          onClose={() => { setSongPickerOpen(false); setEditingCustom(null); }}
        />
      )}

      {/* Save button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all disabled:opacity-50"
      >
        {saveMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        Sauvegarder
      </motion.button>
    </div>
  );
}

/** Modal to pick songs for a custom section */
function SongPickerModal({
  sectionId,
  selectedIds,
  onUpdate,
  onClose,
}: {
  sectionId: string;
  selectedIds: string[];
  onUpdate: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [allSongs, setAllSongs] = useState<{ id: string; title: string; artist: string; cover_url: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  useEffect(() => {
    supabase
      .from("custom_songs")
      .select("id, title, artist, cover_url")
      .not("stream_url", "is", null)
      .order("title")
      .then(({ data }) => {
        setAllSongs(data || []);
        setLoading(false);
      });
  }, []);

  const filtered = search.trim()
    ? allSongs.filter(
        (s) =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          s.artist.toLowerCase().includes(search.toLowerCase())
      )
    : allSongs;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDone = () => {
    onUpdate(Array.from(selected));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg max-h-[80vh] rounded-2xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Choisir les morceaux</h3>
            <p className="text-xs text-muted-foreground">{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un morceau..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>
        </div>

        {/* Song list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Aucun morceau trouvé</p>
          ) : (
            filtered.map((song) => {
              const isSelected = selected.has(song.id);
              return (
                <button
                  key={song.id}
                  onClick={() => toggle(song.id)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-left transition-colors ${
                    isSelected
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-secondary/60 border border-transparent"
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                    isSelected ? "bg-primary border-primary" : "border-border"
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  {song.cover_url ? (
                    <img src={song.cover_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Music className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border flex items-center justify-between gap-3">
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Tout désélectionner
          </button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleDone}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
          >
            Valider ({selected.size})
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

export default AdminPage;
