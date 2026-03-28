import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Users, Music, Radio, ListMusic, Shield, Loader2, Trash2, Crown, ShieldOff, UserX, ScrollText, Pencil, Check, X, Activity, LayoutDashboard, GripVertical, Eye, EyeOff, Save, Plus, Search, UserPlus, Lock, Mail, User, CreditCard, Clock, Calendar, TrendingUp, BarChart3, Inbox, CheckCircle, XCircle, Send, Upload, ImageIcon, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHomeConfig, useSaveHomeConfig, type HomeSection, type HomeConfig, type CustomSection } from "@/hooks/useHomeConfig";

import { motion } from "framer-motion";
import { toast } from "sonner";

type Tab = "users" | "songs" | "radios" | "stats" | "logs" | "home" | "subscriptions" | "requests";

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
    { key: "subscriptions", label: "Abonnements", icon: CreditCard },
    { key: "requests", label: "Demandes", icon: Inbox },
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
        {tab === "subscriptions" && <SubscriptionsTab />}
        {tab === "requests" && <RequestsTab />}
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
    { label: "Utilisateurs", value: stats.users, icon: Users, border: "border-blue-400/40", color: "text-blue-400" },
    { label: "Morceaux", value: stats.songs, icon: Music, border: "border-primary/40", color: "text-primary" },
    { label: "Radios", value: stats.radios, icon: Radio, border: "border-orange-400/40", color: "text-orange-400" },
    { label: "Playlists", value: stats.playlists, icon: ListMusic, border: "border-purple-400/40", color: "text-purple-400" },
    { label: "Titres aimés", value: stats.liked, icon: Music, border: "border-pink-400/40", color: "text-pink-400" },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-4 py-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 20 }}
          className={`w-24 h-24 rounded-full border-2 ${c.border} bg-secondary/40 flex flex-col items-center justify-center gap-0.5`}
        >
          <c.icon className={`w-4 h-4 ${c.color}`} />
          <p className="text-xl font-bold text-foreground leading-none">{c.value}</p>
          <p className="text-[10px] text-muted-foreground leading-tight text-center px-1">{c.label}</p>
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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCredsDialog, setShowCredsDialog] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ identifier: string; password: string; displayName: string } | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editingCreds, setEditingCreds] = useState(false);
  
  // Share playlist state
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareTargetUser, setShareTargetUser] = useState<UserProfile | null>(null);
  const [sharePlaylistName, setSharePlaylistName] = useState("");
  const [shareSearch, setShareSearch] = useState("");
  const [shareSelectedSongs, setShareSelectedSongs] = useState<Set<string>>(new Set());
  const [shareSending, setShareSending] = useState(false);

  const { data: allSongsForShare = [] } = useQuery({
    queryKey: ["admin-all-songs-share"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_songs")
        .select("*")
        .not("stream_url", "is", null)
        .order("title", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredShareSongs = useMemo(() => {
    if (!shareSearch.trim()) return allSongsForShare;
    const q = shareSearch.toLowerCase();
    return allSongsForShare.filter(
      (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || (s.album || "").toLowerCase().includes(q)
    );
  }, [allSongsForShare, shareSearch]);

  const handleSendPlaylist = async () => {
    if (!shareTargetUser || shareSelectedSongs.size === 0 || !sharePlaylistName.trim()) {
      toast.error("Nom de playlist et morceaux requis");
      return;
    }
    setShareSending(true);
    try {
      const selectedSongsList = allSongsForShare.filter((s) => shareSelectedSongs.has(s.id));
      const coverUrl = selectedSongsList.find((s) => s.cover_url)?.cover_url || null;

      const { data: playlist, error: plError } = await supabase
        .from("shared_playlists")
        .insert({
          playlist_name: sharePlaylistName.trim(),
          cover_url: coverUrl,
          shared_by: (await supabase.auth.getUser()).data.user?.id,
          shared_to: shareTargetUser.user_id,
        })
        .select("id")
        .single();

      if (plError) throw plError;

      const songRows = selectedSongsList.map((s, i) => ({
        shared_playlist_id: playlist.id,
        song_id: `custom-${s.id}`,
        title: s.title,
        artist: s.artist,
        album: s.album,
        cover_url: s.cover_url,
        stream_url: s.stream_url,
        duration: s.duration,
        position: i,
      }));

      const { error: songsError } = await supabase
        .from("shared_playlist_songs")
        .insert(songRows);

      if (songsError) throw songsError;

      toast.success(`Playlist envoyée à ${shareTargetUser.display_name || "l'utilisateur"}`);
      setShowShareDialog(false);
      setSharePlaylistName("");
      setShareSelectedSongs(new Set());
      setShareSearch("");
      setShareTargetUser(null);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi");
    } finally {
      setShareSending(false);
    }
  };

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

  const handleCreateUser = async () => {
    if (!createEmail.trim() || !createPassword.trim()) {
      toast.error("Identifiant et mot de passe requis");
      return;
    }
    if (createPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setCreating(true);
    try {
      // Auto-append domain for Supabase email requirement
      const email = createEmail.trim().includes("@") ? createEmail.trim() : `${createEmail.trim()}@vootify.app`;
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email,
          password: createPassword,
          display_name: createDisplayName.trim() || createEmail.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Store credentials for popup
      setCreatedCreds({ identifier: createEmail.trim(), password: createPassword, displayName: createDisplayName.trim() || createEmail.trim() });
      setShowCreateDialog(false);
      setCreateEmail("");
      setCreatePassword("");
      setCreateDisplayName("");
      setShowCredsDialog(true);
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateCredentials = async () => {
    if (!editUserId) return;
    if (!editEmail.trim() && !editPassword.trim()) return;
    setEditingCreds(true);
    try {
      const payload: Record<string, any> = { target_user_id: editUserId };
      if (editEmail.trim()) payload.email = editEmail.includes("@") ? editEmail : `${editEmail}@vootify.app`;
      if (editPassword.trim()) payload.password = editPassword;

      const { data, error } = await supabase.functions.invoke("admin-update-user", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Identifiants mis à jour");
      setShowEditDialog(false);
      setEditEmail("");
      setEditPassword("");
      setEditUserId(null);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setEditingCreds(false);
    }
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mt-12" />;

  return (
    <div className="space-y-2">
      {/* Create user button */}
      <div className="flex justify-end mb-3">
        <Button
          onClick={() => setShowCreateDialog(true)}
          size="sm"
          className="gap-1.5"
        >
          <UserPlus className="w-4 h-4" />
          Créer un utilisateur
        </Button>
      </div>

      {/* Create user dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Créer un utilisateur
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-name">Nom d'affichage</Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="create-name"
                  value={createDisplayName}
                  onChange={(e) => setCreateDisplayName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Identifiant *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="create-email"
                  type="text"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="nom_utilisateur"
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Mot de passe *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="create-password"
                  type={showCreatePassword ? "text" : "password"}
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  className="pl-9 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit credentials dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Modifier les identifiants
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Nouvel identifiant</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="edit-email"
                  type="text"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Laisser vide pour ne pas changer"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nouveau mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="edit-password"
                  type={showEditPassword ? "text" : "password"}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Laisser vide pour ne pas changer"
                  className="pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleUpdateCredentials}
              disabled={editingCreds || (!editEmail.trim() && !editPassword.trim())}
            >
              {editingCreds && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created credentials popup */}
      <Dialog open={showCredsDialog} onOpenChange={(open) => { if (!open) { setShowCredsDialog(false); setCreatedCreds(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <CheckCircle className="w-5 h-5" />
              Utilisateur créé avec succès
            </DialogTitle>
          </DialogHeader>
          {createdCreds && (
            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground">Voici les identifiants de connexion. Copiez-les avant de fermer.</p>
              <div className="space-y-2 rounded-xl bg-secondary/50 border border-border p-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Nom d'affichage</p>
                  <p className="text-sm font-medium text-foreground">{createdCreds.displayName}</p>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Identifiant</p>
                    <p className="text-sm font-mono font-medium text-foreground">{createdCreds.identifier}</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(createdCreds.identifier); toast.success("Identifiant copié"); }}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Copier"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Mot de passe</p>
                    <p className="text-sm font-mono font-medium text-foreground">{createdCreds.password}</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(createdCreds.password); toast.success("Mot de passe copié"); }}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Copier"
                  >
                    <Lock className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <Button
                className="w-full gap-1.5"
                onClick={() => {
                  const text = `Nom : ${createdCreds.displayName}\nIdentifiant : ${createdCreds.identifier}\nMot de passe : ${createdCreds.password}`;
                  navigator.clipboard.writeText(text);
                  toast.success("Tous les identifiants copiés");
                }}
              >
                <User className="w-4 h-4" />
                Tout copier
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCredsDialog(false); setCreatedCreds(null); }}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                       setShareTargetUser(u);
                       setSharePlaylistName("");
                       setShareSelectedSongs(new Set());
                       setShareSearch("");
                       setShowShareDialog(true);
                     }}
                     className="p-1.5 rounded-full text-muted-foreground hover:text-primary transition-colors"
                     title="Envoyer une playlist"
                   >
                     <Send className="w-4 h-4" />
                   </button>
                   <button
                     onClick={() => {
                       setEditUserId(u.user_id);
                       setEditEmail("");
                       setEditPassword("");
                       setShowEditDialog(true);
                     }}
                     className="p-1.5 rounded-full text-muted-foreground hover:text-primary transition-colors"
                     title="Modifier identifiants"
                   >
                     <Pencil className="w-4 h-4" />
                   </button>
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

      {/* Share playlist dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Envoyer une playlist à {shareTargetUser?.display_name || "l'utilisateur"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 flex-1 overflow-hidden flex flex-col">
            <div className="space-y-2">
              <Label>Nom de la playlist *</Label>
              <Input
                value={sharePlaylistName}
                onChange={(e) => setSharePlaylistName(e.target.value)}
                placeholder="Ex : Ma sélection du moment"
              />
            </div>
            <div className="space-y-2">
              <Label>Rechercher des morceaux</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={shareSearch}
                  onChange={(e) => setShareSearch(e.target.value)}
                  placeholder="Titre, artiste, album..."
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {shareSelectedSongs.size} morceau{shareSelectedSongs.size > 1 ? "x" : ""} sélectionné{shareSelectedSongs.size > 1 ? "s" : ""}
              </p>
              {shareSelectedSongs.size > 0 && (
                <button
                  onClick={() => setShareSelectedSongs(new Set())}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Tout désélectionner
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-[40vh]">
              {filteredShareSongs.map((song) => {
                const isSelected = shareSelectedSongs.has(song.id);
                return (
                  <button
                    key={song.id}
                    onClick={() => {
                      const next = new Set(shareSelectedSongs);
                      if (isSelected) next.delete(song.id);
                      else next.add(song.id);
                      setShareSelectedSongs(next);
                    }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                      isSelected ? "bg-primary/15 border border-primary/30" : "bg-secondary/30 border border-transparent hover:bg-secondary/60"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                      {song.cover_url ? (
                        <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-4 h-4 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })}
              {filteredShareSongs.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Aucun morceau trouvé</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSendPlaylist}
              disabled={shareSending || shareSelectedSongs.size === 0 || !sharePlaylistName.trim()}
              className="gap-1.5"
            >
              {shareSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Envoyer ({shareSelectedSongs.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SongsTab() {
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editCoverUrl, setEditCoverUrl] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [smartFixing, setSmartFixing] = useState(false);
  const [smartFixProgress, setSmartFixProgress] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState("");

  const isSelecting = selectedIds.size > 0;

  const handleSmartMetadataFix = async () => {
    const targetSongs = isSelecting
      ? songs.filter((s) => selectedIds.has(s.id))
      : songs;
    if (targetSongs.length === 0) return;
    if (!confirm(`Lancer la correction intelligente sur ${targetSongs.length} morceau${targetSongs.length > 1 ? "x" : ""} ?`)) return;

    setSmartFixing(true);
    let totalCorrected = 0;
    const BATCH = 10;

    try {
      for (let i = 0; i < targetSongs.length; i += BATCH) {
        const batch = targetSongs.slice(i, i + BATCH);
        setSmartFixProgress(`${Math.min(i + BATCH, targetSongs.length)}/${targetSongs.length}`);

        const { data, error } = await supabase.functions.invoke("smart-metadata", {
          body: {
            tracks: batch.map((s: any) => ({
              title: s.title,
              artist: s.artist,
              album: s.album,
              fileName: s.id,
            })),
          },
        });

        if (error || !data?.results) continue;

        for (let j = 0; j < data.results.length; j++) {
          const result = data.results[j];
          const song = batch[j];
          if (!result.corrected || result.duplicateOf) continue;

          const updates: Record<string, any> = {};
          if (result.normalizedArtist !== song.artist) updates.artist = result.normalizedArtist;
          if (result.normalizedTitle !== song.title) updates.title = result.normalizedTitle;
          if (result.album && result.album !== song.album) updates.album = result.album;

          if (Object.keys(updates).length > 0) {
            await supabase.from("custom_songs").update(updates).eq("id", song.id);
            setSongs((prev) =>
              prev.map((s) => (s.id === song.id ? { ...s, ...updates } : s))
            );
            totalCorrected++;
          }
        }
      }

      toast.success(
        totalCorrected > 0
          ? `${totalCorrected} morceau${totalCorrected > 1 ? "x" : ""} corrigé${totalCorrected > 1 ? "s" : ""}`
          : "Aucune correction nécessaire"
      );
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la correction");
    } finally {
      setSmartFixing(false);
      setSmartFixProgress("");
    }
  };

  const handleEnrichCovers = async () => {
    const missingCount = songs.filter((s) => !s.cover_url).length;
    if (missingCount === 0) {
      toast.info("Toutes les pochettes sont déjà présentes");
      return;
    }
    if (!confirm(`Enrichir les pochettes manquantes (${missingCount} morceaux sans pochette) via Deezer ?`)) return;

    setEnriching(true);
    let totalUpdated = 0;
    let offset = 0;

    try {
      while (true) {
        setEnrichProgress(`${offset}+ traités…`);
        const { data, error } = await supabase.functions.invoke("enrich-metadata", {
          body: { mode: "songs", offset, only_missing: true },
        });
        if (error) throw error;
        totalUpdated += data?.updated || 0;
        if (data?.done) break;
        offset = data?.nextOffset || offset + 50;
      }

      if (totalUpdated > 0) {
        await loadSongs();
      }
      toast.success(
        totalUpdated > 0
          ? `${totalUpdated} pochette${totalUpdated > 1 ? "s" : ""} enrichie${totalUpdated > 1 ? "s" : ""}`
          : "Aucune pochette trouvée sur Deezer"
      );
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'enrichissement");
    } finally {
      setEnriching(false);
      setEnrichProgress("");
    }
  };

  const loadSongs = async () => {
    setLoading(true);
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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`Supprimer ${count} morceau${count > 1 ? "x" : ""} ? Cette action est irréversible.`)) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    // Delete in batches of 50
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      await supabase.from("custom_songs").delete().in("id", batch);
    }
    setSongs((prev) => prev.filter((s) => !selectedIds.has(s.id)));
    setSelectedIds(new Set());
    setDeleting(false);
    toast.success(`${count} morceau${count > 1 ? "x" : ""} supprimé${count > 1 ? "s" : ""}`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === songs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(songs.map((s) => s.id)));
    }
  };

  const startEdit = (s: any) => {
    setEditingId(s.id);
    setEditTitle(s.title);
    setEditArtist(s.artist);
    setEditCoverUrl(s.cover_url || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCoverUrl("");
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Sélectionnez une image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image trop lourde (max 5 Mo)"); return; }
    setUploadingCover(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("covers").upload(path, file);
    if (error) { toast.error("Erreur d'upload"); setUploadingCover(false); return; }
    const { data: urlData } = supabase.storage.from("covers").getPublicUrl(path);
    setEditCoverUrl(urlData.publicUrl);
    setUploadingCover(false);
    toast.success("Image uploadée !");
    // Reset file input
    if (coverFileRef.current) coverFileRef.current.value = "";
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim() || !editArtist.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("custom_songs")
      .update({ title: editTitle.trim(), artist: editArtist.trim(), cover_url: editCoverUrl || null })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Erreur lors de la modification");
      return;
    }
    setSongs((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: editTitle.trim(), artist: editArtist.trim(), cover_url: editCoverUrl || null } : s))
    );
    setEditingId(null);
    setEditCoverUrl("");
    toast.success("Morceau modifié");
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mt-12" />;

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      {songs.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary/80 text-secondary-foreground hover:bg-secondary transition-colors"
          >
            {selectedIds.size === songs.length ? (
              <><X className="w-3.5 h-3.5" /> Tout désélectionner</>
            ) : (
              <><Check className="w-3.5 h-3.5" /> Tout sélectionner</>
            )}
          </button>
          <button
            onClick={handleSmartMetadataFix}
            disabled={smartFixing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            {smartFixing ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Correction… {smartFixProgress}</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> Corriger métadonnées {isSelecting ? `(${selectedIds.size})` : "(tout)"}</>
            )}
          </button>
          <button
            onClick={handleEnrichCovers}
            disabled={enriching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/60 text-accent-foreground hover:bg-accent/80 transition-colors"
          >
            {enriching ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Pochettes… {enrichProgress}</>
            ) : (
              <><ImageIcon className="w-3.5 h-3.5" /> Enrichir pochettes</>
            )}
          </button>
          {isSelecting && (
            <>
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors ml-auto"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Supprimer ({selectedIds.size})
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                title="Annuler la sélection"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )}

      {songs.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Aucun morceau custom</p>
      ) : (
        songs.map((s) => (
          <div
            key={s.id}
            className={`flex items-center gap-3 p-3 rounded-xl border group transition-colors cursor-pointer ${
              selectedIds.has(s.id)
                ? "bg-primary/10 border-primary/30"
                : "bg-secondary/30 border-border"
            }`}
            onClick={() => isSelecting && toggleSelect(s.id)}
          >
            {/* Checkbox */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleSelect(s.id); }}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                selectedIds.has(s.id)
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-muted-foreground/40 hover:border-primary/60"
              }`}
            >
              {selectedIds.has(s.id) && <Check className="w-3 h-3" />}
            </button>

            {editingId === s.id ? (
              <div className="relative w-10 h-10 rounded overflow-hidden bg-secondary flex-shrink-0 group/cover cursor-pointer" onClick={(e) => { e.stopPropagation(); coverFileRef.current?.click(); }}>
                <input ref={coverFileRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                {uploadingCover ? (
                  <div className="w-full h-full flex items-center justify-center bg-secondary">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  </div>
                ) : editCoverUrl ? (
                  <>
                    <img src={editCoverUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity">
                      <ImageIcon className="w-4 h-4 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
                    <Upload className="w-4 h-4 text-primary/50" />
                  </div>
                )}
              </div>
            ) : (
              <div className="w-10 h-10 rounded overflow-hidden bg-secondary flex-shrink-0">
                {s.cover_url ? (
                  <img src={s.cover_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
                    <Music className="w-4 h-4 text-primary/30" />
                  </div>
                )}
              </div>
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
                  onClick={(e) => e.stopPropagation()}
                />
                <input
                  value={editArtist}
                  onChange={(e) => setEditArtist(e.target.value)}
                  className="w-full text-xs bg-background/80 border border-border rounded px-2 py-1 text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Artiste"
                  onKeyDown={(e) => e.key === "Enter" && saveEdit(s.id)}
                  onClick={(e) => e.stopPropagation()}
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
                  onClick={(e) => { e.stopPropagation(); saveEdit(s.id); }}
                  disabled={saving}
                  className="p-1.5 rounded-full text-primary hover:bg-primary/10 transition-colors"
                  title="Sauvegarder"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                  title="Annuler"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : !isSelecting ? (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(s); }}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-primary transition-colors"
                  title="Modifier"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-destructive transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}

/* ── Radio Card for Admin ── */
function RadioCardAdmin({ station, isSelected, onEdit, onDelete, onSelect }: {
  station: any;
  isSelected: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={`group relative rounded-2xl overflow-hidden bg-secondary p-3 cursor-pointer transition-all duration-200 hover:shadow-lg ${
        isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      }`}
      onClick={onSelect}
    >
      <div className="relative aspect-square rounded-xl overflow-hidden ring-[1.5px] ring-border/20">
        {station.cover_url ? (
          <img src={station.cover_url} alt={station.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
            <Radio className="w-8 h-8 text-primary/25" />
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="bg-black/70 hover:bg-black text-white p-2 rounded-full transition-colors"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="bg-black/70 hover:bg-destructive text-white p-2 rounded-full transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <h3 className="font-semibold text-sm truncate text-foreground">{station.name}</h3>
        <p className="text-muted-foreground text-xs truncate mt-0.5">{station.genre || "Radio"}</p>
      </div>
    </div>
  );
}

function RadiosTab() {
  const [radios, setRadios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [editCoverUrl, setEditCoverUrl] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const radioCoverRef = useRef<HTMLInputElement>(null);

  const isSelecting = selectedIds.size > 0;

  const loadRadios = async () => {
    setLoading(true);
    const PAGE = 1000;
    let all: any[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from("custom_radio_stations")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    setRadios(all);
    setLoading(false);
  };

  useEffect(() => { loadRadios(); }, []);

  const handleDelete = async (id: string) => {
    await supabase.from("custom_radio_stations").delete().eq("id", id);
    setRadios((prev) => prev.filter((r) => r.id !== id));
    toast.success("Radio supprimée");
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`Supprimer ${count} radio${count > 1 ? "s" : ""} ? Cette action est irréversible.`)) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    for (let i = 0; i < ids.length; i += 50) {
      await supabase.from("custom_radio_stations").delete().in("id", ids.slice(i, i + 50));
    }
    setRadios((prev) => prev.filter((r) => !selectedIds.has(r.id)));
    setSelectedIds(new Set());
    setDeleting(false);
    toast.success(`${count} radio${count > 1 ? "s" : ""} supprimée${count > 1 ? "s" : ""}`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === radios.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(radios.map((r) => r.id)));
  };

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setEditName(r.name);
    setEditGenre(r.genre || "");
    setEditCoverUrl(r.cover_url || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCoverUrl("");
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Sélectionnez une image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image trop lourde (max 5 Mo)"); return; }
    setUploadingCover(true);
    const ext = file.name.split(".").pop();
    const path = `radio/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("covers").upload(path, file);
    if (error) { toast.error("Erreur d'upload"); setUploadingCover(false); return; }
    const { data: urlData } = supabase.storage.from("covers").getPublicUrl(path);
    setEditCoverUrl(urlData.publicUrl);
    setUploadingCover(false);
    toast.success("Image uploadée !");
    if (radioCoverRef.current) radioCoverRef.current.value = "";
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("custom_radio_stations")
      .update({ name: editName.trim(), genre: editGenre.trim() || null, cover_url: editCoverUrl || null })
      .eq("id", id);
    setSaving(false);
    if (error) { toast.error("Erreur lors de la modification"); return; }
    setRadios((prev) =>
      prev.map((r) => (r.id === id ? { ...r, name: editName.trim(), genre: editGenre.trim() || null, cover_url: editCoverUrl || null } : r))
    );
    setEditingId(null);
    setEditCoverUrl("");
    toast.success("Radio modifiée");
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mt-12" />;

  return (
    <div className="space-y-2">
      {radios.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary/80 text-secondary-foreground hover:bg-secondary transition-colors"
          >
            {selectedIds.size === radios.length ? (
              <><X className="w-3.5 h-3.5" /> Tout désélectionner</>
            ) : (
              <><Check className="w-3.5 h-3.5" /> Tout sélectionner</>
            )}
          </button>
          {isSelecting && (
            <>
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} sélectionnée{selectedIds.size > 1 ? "s" : ""}
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors ml-auto"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Supprimer ({selectedIds.size})
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )}

      {radios.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Aucune radio custom</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {radios.map((r) => {
            const isSelected = selectedIds.has(r.id);
            return (
              <div key={r.id} className="relative">
                {/* Selection checkbox overlay */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelect(r.id); }}
                  className={`absolute top-2 left-2 z-20 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground scale-100"
                      : "border-white/60 bg-black/30 hover:border-primary/60 scale-90 opacity-0 group-hover:opacity-100"
                  } ${isSelecting ? "!opacity-100 !scale-100" : ""}`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                </button>

                <RadioCardAdmin
                  station={r}
                  isSelected={isSelected}
                  onEdit={() => startEdit(r)}
                  onDelete={() => handleDelete(r.id)}
                  onSelect={() => isSelecting && toggleSelect(r.id)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingId} onOpenChange={(open) => { if (!open) cancelEdit(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier la station</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom de la station" />
            </div>
            <div className="space-y-2">
              <Label>Genre</Label>
              <Input value={editGenre} onChange={(e) => setEditGenre(e.target.value)} placeholder="Pop, Rock, Jazz..." />
            </div>
            <div className="space-y-2">
              <Label>Pochette</Label>
              <div className="flex items-center gap-3">
                <div
                  className="relative w-16 h-16 rounded-xl overflow-hidden bg-secondary cursor-pointer group/cover flex-shrink-0"
                  onClick={() => radioCoverRef.current?.click()}
                >
                  <input ref={radioCoverRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                  {uploadingCover ? (
                    <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                  ) : editCoverUrl ? (
                    <>
                      <img src={editCoverUrl} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity">
                        <ImageIcon className="w-4 h-4 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
                      <Upload className="w-5 h-5 text-primary/40" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Cliquez pour changer l'image</p>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelEdit}>Annuler</Button>
            <Button onClick={() => editingId && saveEdit(editingId)} disabled={saving || !editName.trim()}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const [uploadingBgImage, setUploadingBgImage] = useState(false);
  const bgImageFileRef = useRef<HTMLInputElement>(null);

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Sélectionnez une image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image trop lourde (max 5 Mo)"); return; }
    setUploadingBgImage(true);
    const ext = file.name.split(".").pop();
    const path = `hero-bg/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("covers").upload(path, file);
    if (error) { toast.error("Erreur d'upload"); setUploadingBgImage(false); return; }
    const { data: urlData } = supabase.storage.from("covers").getPublicUrl(path);
    setHeroBgImage(urlData.publicUrl);
    setUploadingBgImage(false);
    toast.success("Image uploadée !");
    if (bgImageFileRef.current) bgImageFileRef.current.value = "";
  };
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
            <label className="text-xs text-muted-foreground mb-1 block">Image de fond (optionnel)</label>
            <div className="flex gap-2">
              <input
                value={heroBgImage}
                onChange={(e) => setHeroBgImage(e.target.value)}
                placeholder="https://exemple.com/image.jpg"
                className="flex-1 text-sm bg-background/80 border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input ref={bgImageFileRef} type="file" accept="image/*" onChange={handleBgImageUpload} className="hidden" />
              <button
                onClick={() => bgImageFileRef.current?.click()}
                disabled={uploadingBgImage}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0"
              >
                {uploadingBgImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Importer
              </button>
            </div>
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

                <div className="flex-1 relative min-w-0">
                  <input
                    value={section.title}
                    onChange={(e) => {
                      updateTitle(section.id, e.target.value);
                      if (isCustom) updateCustomTitle(section.id, e.target.value);
                    }}
                    placeholder="Nom de la section (emoji inclus)"
                    className="w-full text-sm font-medium bg-transparent text-foreground focus:outline-none focus:bg-muted/40 focus:ring-1 focus:ring-primary/30 rounded px-2 py-1 min-w-0 transition-colors"
                  />
                </div>

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
    (async () => {
      const PAGE = 1000;
      let all: any[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from("custom_songs")
          .select("id, title, artist, cover_url")
          .not("stream_url", "is", null)
          .order("title")
          .range(from, from + PAGE - 1);
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setAllSongs(all);
      setLoading(false);
    })();
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

/* ── Subscriptions & Usage Tab ── */
interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  starts_at: string;
  expires_at: string | null;
  status: string;
}

function RequestsTab() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadRequests = async () => {
    const { data } = await supabase
      .from("access_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setRequests(data || []);
    setLoading(false);
  };

  useEffect(() => { loadRequests(); }, []);

  const handleAction = async (id: string, status: "approved" | "rejected", request?: any) => {
    setActionLoading(id);
    try {
      await supabase
        .from("access_requests")
        .update({ status, resolved_at: new Date().toISOString() })
        .eq("id", id);

      if (status === "approved" && request) {
        const now = new Date();
        const expiresAt = new Date(now);
        const dur = request.requested_duration || 30;
        const unit = request.requested_duration_unit || "days";
        if (unit === "months") {
          expiresAt.setMonth(expiresAt.getMonth() + dur);
        } else {
          expiresAt.setDate(expiresAt.getDate() + dur);
        }

        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", request.user_id)
          .maybeSingle();

        if (existingSub) {
          await supabase
            .from("subscriptions")
            .update({ status: "active", starts_at: now.toISOString(), expires_at: expiresAt.toISOString() })
            .eq("user_id", request.user_id);
        } else {
          await supabase.from("subscriptions").insert({
            user_id: request.user_id,
            plan: "standard",
            status: "active",
            starts_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          });
        }
        toast.success("Demande approuvée — abonnement activé");
      } else {
        toast.success("Demande rejetée");
      }
      await loadRequests();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mt-12" />;

  const pending = requests.filter(r => r.status === "pending");

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <Inbox className="w-4 h-4 text-primary" />
        Demandes d'accès
        {pending.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
            {pending.length}
          </span>
        )}
      </h3>

      {pending.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Aucune demande en attente</p>
      ) : (
        <div className="space-y-2">
          {pending.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border"
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                {(r.display_name || "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  {r.display_name || "Sans pseudo"}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3 h-3 flex-shrink-0" />
                  {r.user_email}
                </p>
                <p className="text-xs text-primary font-medium flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  {r.requested_duration === 0
                    ? "Illimité"
                    : `${r.requested_duration || 30} ${r.requested_duration_unit === "months" ? "mois" : "jours"}`}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(r.created_at).toLocaleString("fr-FR")}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleAction(r.id, "approved", r)}
                  disabled={!!actionLoading}
                  className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  title="Approuver"
                >
                  {actionLoading === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleAction(r.id, "rejected")}
                  disabled={!!actionLoading}
                  className="p-2 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                  title="Rejeter"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubscriptionsTab() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [usageHistory, setUsageHistory] = useState<{ date: string; seconds: number; user_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Dialog state
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState("premium");
  const [editDuration, setEditDuration] = useState(30);

  // Stats view
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");

  const loadData = async () => {
    setLoading(true);
    const [profilesRes, subsRes, usageRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
      supabase.from("usage_sessions").select("user_id, duration_seconds, session_date").order("session_date", { ascending: false }),
    ]);

    setUsers((profilesRes.data || []).map(p => ({ ...p, isAdmin: false })));
    setSubs(subsRes.data as Subscription[] || []);

    // Aggregate total usage per user
    const totals: Record<string, number> = {};
    const history: { date: string; seconds: number; user_id: string }[] = [];
    for (const row of (usageRes.data || [])) {
      const uid = (row as any).user_id;
      const secs = (row as any).duration_seconds || 0;
      const date = (row as any).session_date;
      totals[uid] = (totals[uid] || 0) + secs;
      history.push({ date, seconds: secs, user_id: uid });
    }
    setUsage(totals);
    setUsageHistory(history);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min`;
  };

  const getUserSub = (userId: string) => subs.find(s => s.user_id === userId && s.status === "active");

  const handleSetSubscription = async () => {
    if (!editUserId) return;
    setActionLoading("sub");
    try {
      // Deactivate existing active subs
      await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("user_id", editUserId)
        .eq("status", "active");

      const expiresAt = editDuration === 0 ? null : (() => {
        const d = new Date();
        d.setDate(d.getDate() + editDuration);
        return d.toISOString();
      })();

      await supabase.from("subscriptions").insert({
        user_id: editUserId,
        plan: editPlan,
        starts_at: new Date().toISOString(),
        expires_at: expiresAt,
        status: "active",
      });

      toast.success("Abonnement mis à jour");
      setShowSubDialog(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (userId: string) => {
    if (!confirm("Révoquer l'abonnement de cet utilisateur ?")) return;
    setActionLoading(`revoke-${userId}`);
    await supabase
      .from("subscriptions")
      .update({ status: "revoked" })
      .eq("user_id", userId)
      .eq("status", "active");
    toast.success("Abonnement révoqué");
    await loadData();
    setActionLoading(null);
  };

  // Usage chart data for selected user
  const chartData = useMemo(() => {
    if (!viewUserId) return [];
    const now = new Date();
    let days = period === "week" ? 7 : period === "month" ? 30 : 365;
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);

    const filtered = usageHistory.filter(
      h => h.user_id === viewUserId && new Date(h.date) >= cutoff
    );

    // Group by date
    const byDate: Record<string, number> = {};
    for (const h of filtered) {
      byDate[h.date] = (byDate[h.date] || 0) + h.seconds;
    }

    // Fill all dates
    const result: { date: string; minutes: number }[] = [];
    for (let d = new Date(cutoff); d <= now; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, minutes: Math.round((byDate[key] || 0) / 60) });
    }
    return result;
  }, [viewUserId, period, usageHistory]);

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mt-12" />;

  // Detail view for a user
  if (viewUserId) {
    const user = users.find(u => u.user_id === viewUserId);
    const sub = getUserSub(viewUserId);
    const totalMins = Math.round((usage[viewUserId] || 0) / 60);
    const maxVal = Math.max(...chartData.map(d => d.minutes), 1);

    return (
      <div className="space-y-4">
        <button
          onClick={() => setViewUserId(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <div className="rounded-xl bg-secondary/30 border border-border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
              {(user?.display_name || "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-foreground">{user?.display_name || "Sans nom"}</p>
              <p className="text-xs text-muted-foreground">Temps total : {formatTime(usage[viewUserId] || 0)}</p>
            </div>
            {sub && (
              <span className="ml-auto px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">
                {sub.plan}
              </span>
            )}
          </div>

          {sub && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Début : {new Date(sub.starts_at).toLocaleDateString("fr-FR")}</p>
              {sub.expires_at && (
                <p>Expire : {new Date(sub.expires_at).toLocaleDateString("fr-FR")}
                  {new Date(sub.expires_at) < new Date() && <span className="text-destructive ml-1">(expiré)</span>}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Period selector */}
        <div className="flex gap-1.5">
          {(["week", "month", "year"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/80 text-secondary-foreground hover:bg-secondary"
              }`}
            >
              {p === "week" ? "7 jours" : p === "month" ? "30 jours" : "1 an"}
            </button>
          ))}
        </div>

        {/* Bar chart */}
        <div className="rounded-xl bg-secondary/30 border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium text-foreground">Temps d'écoute (minutes)</p>
          </div>
          <div className="flex items-end gap-0.5 h-32">
            {chartData.map((d, i) => (
              <div
                key={d.date}
                className="flex-1 group relative"
                title={`${d.date}: ${d.minutes}min`}
              >
                <div
                  className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors"
                  style={{ height: `${(d.minutes / maxVal) * 100}%`, minHeight: d.minutes > 0 ? 2 : 0 }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">{chartData[0]?.date?.slice(5)}</span>
            <span className="text-[10px] text-muted-foreground">{chartData[chartData.length - 1]?.date?.slice(5)}</span>
          </div>
        </div>

        {/* Daily breakdown */}
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {chartData.filter(d => d.minutes > 0).reverse().map(d => (
            <div key={d.date} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/20 text-sm">
              <span className="text-muted-foreground">{new Date(d.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</span>
              <span className="font-medium text-foreground">{d.minutes} min</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Subscription dialog */}
      <Dialog open={showSubDialog} onOpenChange={setShowSubDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Attribuer un abonnement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Type d'abonnement</Label>
              <div className="flex gap-2">
                {["premium", "gold", "vip"].map(p => (
                  <button
                    key={p}
                    onClick={() => setEditPlan(p)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      editPlan === p
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Durée</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: "7 jours", value: 7 },
                  { label: "30 jours", value: 30 },
                  { label: "90 jours", value: 90 },
                  { label: "1 an", value: 365 },
                  { label: "Illimité", value: 0 },
                ].map(d => (
                  <button
                    key={d.value}
                    onClick={() => setEditDuration(d.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      editDuration === d.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubDialog(false)}>Annuler</Button>
            <Button onClick={handleSetSubscription} disabled={actionLoading === "sub"}>
              {actionLoading === "sub" && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Attribuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User list with subscription & usage info */}
      {users.map(u => {
        const sub = getUserSub(u.user_id);
        const totalTime = usage[u.user_id] || 0;
        const isExpired = sub?.expires_at && new Date(sub.expires_at) < new Date();

        return (
          <motion.div
            key={u.user_id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-secondary/30 border border-border p-3 space-y-2"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                {(u.display_name || "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{u.display_name || "Sans nom"}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{formatTime(totalTime)}</span>
                  {sub && (
                    <>
                      <span className="text-border">•</span>
                      <span className={`font-medium ${isExpired ? "text-destructive" : "text-primary"}`}>
                        {sub.plan.toUpperCase()} {isExpired ? "(expiré)" : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setViewUserId(u.user_id)}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-primary transition-colors"
                  title="Voir les statistiques"
                >
                  <TrendingUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setEditUserId(u.user_id);
                    setShowSubDialog(true);
                  }}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-primary transition-colors"
                  title="Gérer l'abonnement"
                >
                  <CreditCard className="w-4 h-4" />
                </button>
                {sub && (
                  <button
                    onClick={() => handleRevoke(u.user_id)}
                    disabled={actionLoading === `revoke-${u.user_id}`}
                    className="p-1.5 rounded-full text-muted-foreground hover:text-destructive transition-colors"
                    title="Révoquer l'abonnement"
                  >
                    {actionLoading === `revoke-${u.user_id}` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {sub && sub.expires_at && (
              <div className="ml-13 text-[10px] text-muted-foreground">
                Expire le {new Date(sub.expires_at).toLocaleDateString("fr-FR")}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

export default AdminPage;
