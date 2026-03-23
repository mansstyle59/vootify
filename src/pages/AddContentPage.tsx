import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ANONYMOUS_USER_ID } from "@/lib/constants";

import { Music, Disc3, Radio, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "song" | "album" | "radio";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "song", label: "Chanson", icon: Music },
  { key: "album", label: "Album", icon: Disc3 },
  { key: "radio", label: "Station Radio", icon: Radio },
];

function FieldInput({ label, value, onChange, placeholder, type = "text", required = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground mb-1 block">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
      />
    </label>
  );
}

function SongForm() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", artist: "", album: "", duration: "", coverUrl: "", streamUrl: "" });

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
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldInput label="Titre" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Nom de la chanson" required />
      <FieldInput label="Artiste" value={form.artist} onChange={(v) => setForm({ ...form, artist: v })} placeholder="Nom de l'artiste" required />
      <FieldInput label="Album" value={form.album} onChange={(v) => setForm({ ...form, album: v })} placeholder="Nom de l'album (optionnel)" />
      <FieldInput label="Durée (secondes)" value={form.duration} onChange={(v) => setForm({ ...form, duration: v })} placeholder="180" type="number" />
      <FieldInput label="URL de la pochette" value={form.coverUrl} onChange={(v) => setForm({ ...form, coverUrl: v })} placeholder="https://..." />
      <FieldInput label="URL du flux audio" value={form.streamUrl} onChange={(v) => setForm({ ...form, streamUrl: v })} placeholder="https://..." />
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.artist.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("custom_albums").insert({
      user_id: ANONYMOUS_USER_ID,
      title: form.title.trim(),
      artist: form.artist.trim(),
      cover_url: form.coverUrl.trim() || null,
      year: parseInt(form.year) || null,
    });
    setLoading(false);
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success("Album ajouté !");
    setForm({ title: "", artist: "", coverUrl: "", year: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldInput label="Titre" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Nom de l'album" required />
      <FieldInput label="Artiste" value={form.artist} onChange={(v) => setForm({ ...form, artist: v })} placeholder="Nom de l'artiste" required />
      <FieldInput label="Année" value={form.year} onChange={(v) => setForm({ ...form, year: v })} placeholder="2025" type="number" />
      <FieldInput label="URL de la pochette" value={form.coverUrl} onChange={(v) => setForm({ ...form, coverUrl: v })} placeholder="https://..." />
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
      <FieldInput label="URL du logo" value={form.coverUrl} onChange={(v) => setForm({ ...form, coverUrl: v })} placeholder="https://..." />
      <FieldInput label="URL du flux audio" value={form.streamUrl} onChange={(v) => setForm({ ...form, streamUrl: v })} placeholder="https://..." />
      <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        Ajouter la station
      </button>
    </form>
  );
}

const AddContentPage = () => {
  const [tab, setTab] = useState<Tab>("song");

  return (
    <div className="p-4 md:p-8 pb-32 max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-6">Ajouter du contenu</h1>

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
