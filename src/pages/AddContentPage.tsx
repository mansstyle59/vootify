import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ANONYMOUS_USER_ID } from "@/lib/constants";
import { useAdminAuth } from "@/hooks/useAdminAuth";

import { Music, Disc3, Radio, Loader2, CheckCircle, Lock, LogOut, Sparkles } from "lucide-react";
import CoverImagePicker from "@/components/CoverImagePicker";
import AudioFilePicker from "@/components/AudioFilePicker";
import AlbumFolderPicker, { type UploadedTrack } from "@/components/AlbumFolderPicker";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "song" | "album" | "radio";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "song", label: "Chanson", icon: Music },
  { key: "album", label: "Album", icon: Disc3 },
  { key: "radio", label: "Station Radio", icon: Radio },
];

function FieldInput({ label, value, onChange, placeholder, type = "text", required = false, autoFilled = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; autoFilled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground mb-1 flex items-center gap-1.5">
        {label} {required && <span className="text-destructive">*</span>}
        {autoFilled && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
            <Sparkles className="w-2.5 h-2.5" />
            ID3
          </span>
        )}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={`w-full px-3 py-2.5 rounded-lg bg-secondary border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${
          autoFilled ? "border-primary/40" : "border-border"
        }`}
      />
    </label>
  );
}

function AdminLoginForm() {
  const { signIn } = useAdminAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    // Convert identifier to email format
    const email = identifier.includes("@") ? identifier : `${identifier}@voomusic.app`;
    const result = await signIn(email, password);
    setLoading(false);
    if (result.error) {
      setError("Identifiants incorrects");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel rounded-2xl p-8 w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 rounded-full bg-primary/10 mb-3">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-display font-bold text-foreground">Accès Admin</h2>
          <p className="text-sm text-muted-foreground mt-1">Connectez-vous pour gérer le contenu</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldInput
            label="Identifiant"
            value={identifier}
            onChange={setIdentifier}
            placeholder="adminvoo"
            required
          />
          <label className="block">
            <span className="text-sm font-medium text-foreground mb-1 block">
              Mot de passe <span className="text-destructive">*</span>
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </label>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Se connecter
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function SongForm() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", artist: "", album: "", duration: "", coverUrl: "", streamUrl: "" });
  const [id3Fields, setId3Fields] = useState<Set<string>>(new Set());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.artist.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("custom_songs").insert({
      user_id: ANONYMOUS_USER_ID,
      title: form.title.trim(),
      artist: form.artist.trim(),
      album: form.album.trim() || null,
      duration: parseInt(form.duration) || 0,
      cover_url: form.coverUrl.trim() || null,
      stream_url: form.streamUrl.trim() || null,
    });
    setLoading(false);
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success("Chanson ajoutée !");
    setForm({ title: "", artist: "", album: "", duration: "", coverUrl: "", streamUrl: "" });
    setId3Fields(new Set());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldInput label="Titre" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Nom de la chanson" required autoFilled={id3Fields.has("title")} />
      <FieldInput label="Artiste" value={form.artist} onChange={(v) => setForm({ ...form, artist: v })} placeholder="Nom de l'artiste" required autoFilled={id3Fields.has("artist")} />
      <FieldInput label="Album" value={form.album} onChange={(v) => setForm({ ...form, album: v })} placeholder="Nom de l'album (optionnel)" autoFilled={id3Fields.has("album")} />
      <FieldInput label="Durée (secondes)" value={form.duration} onChange={(v) => setForm({ ...form, duration: v })} placeholder="180" type="number" autoFilled={id3Fields.has("duration")} />
      <CoverImagePicker value={form.coverUrl} onChange={(v) => setForm({ ...form, coverUrl: v })} />
      {id3Fields.has("coverUrl") && form.coverUrl && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold -mt-2">
          <Sparkles className="w-2.5 h-2.5" /> Pochette ID3
        </span>
      )}
      <AudioFilePicker
        value={form.streamUrl}
        onChange={(url) => setForm((f) => ({ ...f, streamUrl: url }))}
        onDurationDetected={(dur) => {
          setForm((f) => ({ ...f, duration: String(dur) }));
          setId3Fields((s) => new Set(s).add("duration"));
        }}
        onMetadataExtracted={(meta) => {
          const filled = new Set<string>();
          setForm((f) => {
            const updated = { ...f };
            if (meta.title) { updated.title = meta.title; filled.add("title"); }
            if (meta.artist) { updated.artist = meta.artist; filled.add("artist"); }
            if (meta.album) { updated.album = meta.album; filled.add("album"); }
            if (meta.coverUrl) { updated.coverUrl = meta.coverUrl; filled.add("coverUrl"); }
            return updated;
          });
          setId3Fields((prev) => {
            const next = new Set(prev);
            filled.forEach((f) => next.add(f));
            return next;
          });
          if (filled.size > 0) {
            toast.success(`${filled.size} champ${filled.size > 1 ? "s" : ""} rempli${filled.size > 1 ? "s" : ""} via ID3`);
          }
        }}
      />
      <FieldInput label="Ou URL du flux audio" value={form.streamUrl} onChange={(v) => setForm({ ...form, streamUrl: v })} placeholder="https://..." />
      <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        Ajouter la chanson
      </button>
    </form>
  );
}

function AlbumForm() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", artist: "", coverUrl: "", year: "" });
  const [tracks, setTracks] = useState<UploadedTrack[]>([]);

  const handleTracksUploaded = (uploaded: UploadedTrack[]) => {
    setTracks(uploaded);
    // Auto-fill cover from first track's ID3 cover if no cover set
    if (!form.coverUrl && uploaded.length > 0) {
      const firstCover = uploaded.find((t) => t.coverUrl)?.coverUrl;
      if (firstCover) setForm((f) => ({ ...f, coverUrl: firstCover }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.artist.trim()) return;
    setLoading(true);

    // Create the album
    const { data: album, error } = await supabase.from("custom_albums").insert({
      user_id: ANONYMOUS_USER_ID,
      title: form.title.trim(),
      artist: form.artist.trim(),
      cover_url: form.coverUrl.trim() || null,
      year: parseInt(form.year) || null,
    }).select("id").single();

    if (error) { toast.error("Erreur: " + error.message); setLoading(false); return; }

    // Create songs for each uploaded track
    if (tracks.length > 0 && album) {
      const songInserts = tracks.map((t) => ({
        user_id: ANONYMOUS_USER_ID,
        title: t.title,
        artist: t.artist || form.artist.trim(),
        album: form.title.trim(),
        duration: t.duration,
        cover_url: form.coverUrl.trim() || null,
        stream_url: t.streamUrl,
      }));

      const { error: songsError } = await supabase.from("custom_songs").insert(songInserts);
      if (songsError) {
        toast.error("Album créé mais erreur sur les pistes: " + songsError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    const trackCount = tracks.length;
    toast.success(`Album ajouté${trackCount > 0 ? ` avec ${trackCount} piste${trackCount > 1 ? "s" : ""}` : ""} !`);
    setForm({ title: "", artist: "", coverUrl: "", year: "" });
    setTracks([]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldInput label="Titre" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Nom de l'album" required />
      <FieldInput label="Artiste" value={form.artist} onChange={(v) => setForm({ ...form, artist: v })} placeholder="Nom de l'artiste" required />
      <FieldInput label="Année" value={form.year} onChange={(v) => setForm({ ...form, year: v })} placeholder="2025" type="number" />
      <CoverImagePicker value={form.coverUrl} onChange={(v) => setForm({ ...form, coverUrl: v })} />
      <AlbumFolderPicker
        albumArtist={form.artist}
        onTracksUploaded={handleTracksUploaded}
      />
      <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        Ajouter l'album
      </button>
    </form>
  );
}

function RadioForm() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", genre: "", coverUrl: "", streamUrl: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("custom_radio_stations").insert({
      user_id: ANONYMOUS_USER_ID,
      name: form.name.trim(),
      genre: form.genre.trim() || null,
      cover_url: form.coverUrl.trim() || null,
      stream_url: form.streamUrl.trim() || null,
    });
    setLoading(false);
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success("Station radio ajoutée !");
    setForm({ name: "", genre: "", coverUrl: "", streamUrl: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldInput label="Nom de la station" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="France Inter" required />
      <FieldInput label="Genre" value={form.genre} onChange={(v) => setForm({ ...form, genre: v })} placeholder="Pop, Jazz, Info..." />
      <CoverImagePicker value={form.coverUrl} onChange={(v) => setForm({ ...form, coverUrl: v })} />
      <FieldInput label="URL du flux audio" value={form.streamUrl} onChange={(v) => setForm({ ...form, streamUrl: v })} placeholder="https://..." />
      <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        Ajouter la station
      </button>
    </form>
  );
}

const AddContentPage = () => {
  const { isAdmin, loading, signOut } = useAdminAuth();
  const [tab, setTab] = useState<Tab>("song");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <AdminLoginForm />;
  }

  return (
    <div className="p-4 md:p-8 pb-40 max-w-2xl mx-auto" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Ajouter du contenu</h1>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Déconnexion
        </button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              tab === key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="glass-panel-light rounded-xl p-6"
        >
          {tab === "song" && <SongForm />}
          {tab === "album" && <AlbumForm />}
          {tab === "radio" && <RadioForm />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default AddContentPage;
