import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getEffectiveUserId } from "@/lib/deviceId";

import { Music, Disc3, Radio, Loader2, CheckCircle, Lock, LogOut, Sparkles, Upload, FileAudio, X, Trash2 } from "lucide-react";
import CoverImagePicker from "@/components/CoverImagePicker";
import AudioFilePicker from "@/components/AudioFilePicker";
import AlbumFolderPicker, { type UploadedTrack } from "@/components/AlbumFolderPicker";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { extractID3 } from "@/lib/id3Utils";
import { deezerApi } from "@/lib/deezerApi";

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
  const { signIn } = useAuth();
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

const ACCEPTED_AUDIO = ".mp3,.m4a,.aac,.ogg,.flac,.wav,.wma,.opus";

interface SongEntry {
  file: File;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
  streamUrl: string;
  uploading: boolean;
  uploaded: boolean;
  id3Filled: Set<string>;
}

function SongForm() {
  const { user } = useAuth();
  const effectiveUserId = getEffectiveUserId(user?.id);
  const [songs, setSongs] = useState<SongEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: FileList) => {
    setProcessing(true);
    const entries: SongEntry[] = [];

    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} trop lourd (max 50 Mo)`);
        continue;
      }

      const id3 = await extractID3(file, file.name);
      let meta = { title: id3.title, artist: id3.artist, album: id3.album, coverUrl: id3.coverUrl };
      const id3Filled = new Set<string>();

      if (meta.title) id3Filled.add("title");
      if (meta.artist) id3Filled.add("artist");
      if (meta.album) id3Filled.add("album");
      if (meta.coverUrl) id3Filled.add("coverUrl");

      // Duration
      let duration = id3.duration && id3.duration > 0 ? Math.round(id3.duration) : 0;
      if (!duration) {
        try {
          const objectUrl = URL.createObjectURL(file);
          duration = await new Promise<number>((resolve) => {
            const audio = new Audio();
            audio.preload = "metadata";
            audio.src = objectUrl;
            audio.addEventListener("loadedmetadata", () => {
              resolve(audio.duration && isFinite(audio.duration) ? Math.round(audio.duration) : 0);
              URL.revokeObjectURL(objectUrl);
            }, { once: true });
            audio.addEventListener("error", () => { resolve(0); URL.revokeObjectURL(objectUrl); }, { once: true });
          });
        } catch { duration = 0; }
      }
      if (duration) id3Filled.add("duration");

      // Deezer lookup for missing fields
      if (!meta.title || !meta.artist || !meta.coverUrl) {
        const cleanName = file.name.replace(/\.[^.]+$/, "").replace(/^\d{1,3}[\s.\-_]+/, "").trim();
        const query = meta.title && meta.artist ? `${meta.artist} ${meta.title}` : meta.title || cleanName;
        try {
          const results = await deezerApi.searchTracks(query, 3);
          if (results.length > 0) {
            const best = results[0];
            if (!meta.title) meta.title = best.title;
            if (!meta.artist) meta.artist = best.artist;
            if (!meta.album) meta.album = best.album;
            if (!meta.coverUrl) meta.coverUrl = best.coverUrl;
          }
        } catch {}
      }

      entries.push({
        file,
        title: meta.title || file.name.replace(/\.[^.]+$/, ""),
        artist: meta.artist || "",
        album: meta.album || "",
        duration,
        coverUrl: meta.coverUrl || "",
        streamUrl: "",
        uploading: false,
        uploaded: false,
        id3Filled,
      });
    }

    setSongs((prev) => [...prev, ...entries]);
    setProcessing(false);
    if (entries.length > 0) toast.success(`${entries.length} fichier${entries.length > 1 ? "s" : ""} analysé${entries.length > 1 ? "s" : ""}`);
  };

  const updateSong = (idx: number, field: string, value: string) => {
    setSongs((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const removeSong = (idx: number) => {
    setSongs((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    const toUpload = songs.filter((s) => !s.uploaded && s.title.trim() && s.artist.trim());
    if (toUpload.length === 0) return;

    setSubmitting(true);

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      if (song.uploaded || !song.title.trim() || !song.artist.trim()) continue;

      setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: true } : s));

      // Upload audio file
      const ext = song.file.name.split(".").pop()?.toLowerCase() || "mp3";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("audio").upload(path, song.file, {
        contentType: song.file.type || "audio/mpeg",
      });

      if (uploadErr) {
        toast.error(`Erreur upload: ${song.title}`);
        setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: false } : s));
        continue;
      }

      const { data: urlData } = supabase.storage.from("audio").getPublicUrl(path);
      const streamUrl = urlData.publicUrl;

      // Check for duplicate (same title + artist)
      const { data: existing } = await supabase.from("custom_songs")
        .select("id")
        .eq("title", song.title.trim())
        .eq("artist", song.artist.trim())
        .limit(1);

      if (existing && existing.length > 0) {
        // Update existing song instead of blocking
        const existingId = existing[0].id;
        const { error: updateErr } = await supabase.from("custom_songs").update({
          album: song.album.trim() || null,
          duration: song.duration || 0,
          cover_url: song.coverUrl.trim() || null,
          stream_url: streamUrl,
        }).eq("id", existingId);

        if (updateErr) {
          toast.error(`Erreur mise à jour: ${song.title}`);
          await supabase.storage.from("audio").remove([path]);
        } else {
          toast.success(`"${song.title}" mis à jour`);
        }
        setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: false, uploaded: !updateErr } : s));
        continue;
      }

      // Insert into DB
      const { error: dbErr } = await supabase.from("custom_songs").insert({
        user_id: effectiveUserId,
        title: song.title.trim(),
        artist: song.artist.trim(),
        album: song.album.trim() || null,
        duration: song.duration || 0,
        cover_url: song.coverUrl.trim() || null,
        stream_url: streamUrl,
      });

      if (dbErr) {
        toast.error(`Erreur DB: ${song.title}`);
        setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: false } : s));
        continue;
      }

      setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: false, uploaded: true, streamUrl } : s));
    }

    setSubmitting(false);
    const uploadedCount = songs.filter((s) => s.uploaded).length + toUpload.length;
    toast.success(`${toUpload.length} chanson${toUpload.length > 1 ? "s" : ""} ajoutée${toUpload.length > 1 ? "s" : ""} !`);
  };

  const pendingCount = songs.filter((s) => !s.uploaded && s.title.trim() && s.artist.trim()).length;

  return (
    <div className="space-y-4">
      {/* File picker */}
      <input ref={fileRef} type="file" accept={ACCEPTED_AUDIO} multiple onChange={(e) => e.target.files && processFiles(e.target.files)} className="hidden" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={processing}
        className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-secondary/30 hover:bg-secondary/50 transition-all text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {processing ? "Analyse en cours..." : "Sélectionner des fichiers audio"}
      </button>

      {/* Song list */}
      {songs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{songs.length} fichier{songs.length > 1 ? "s" : ""}</p>
          {songs.map((song, idx) => (
            <div
              key={idx}
              className={`rounded-xl border p-3 space-y-2 transition-all ${
                song.uploaded
                  ? "border-primary/30 bg-primary/5 opacity-70"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground truncate flex-1">{song.file.name}</span>
                {song.uploaded && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
                {song.uploading && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
                {!song.uploaded && !song.uploading && (
                  <button type="button" onClick={() => removeSong(idx)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {!song.uploaded && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={song.title}
                    onChange={(e) => updateSong(idx, "title", e.target.value)}
                    placeholder="Titre *"
                    className={`px-2.5 py-1.5 rounded-lg bg-secondary border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 ${
                      song.id3Filled.has("title") ? "border-primary/40" : "border-border"
                    }`}
                  />
                  <input
                    value={song.artist}
                    onChange={(e) => updateSong(idx, "artist", e.target.value)}
                    placeholder="Artiste *"
                    className={`px-2.5 py-1.5 rounded-lg bg-secondary border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 ${
                      song.id3Filled.has("artist") ? "border-primary/40" : "border-border"
                    }`}
                  />
                  <input
                    value={song.album}
                    onChange={(e) => updateSong(idx, "album", e.target.value)}
                    placeholder="Album"
                    className={`px-2.5 py-1.5 rounded-lg bg-secondary border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 ${
                      song.id3Filled.has("album") ? "border-primary/40" : "border-border"
                    }`}
                  />
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    {song.duration > 0 && <span>{Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, "0")}</span>}
                    {song.coverUrl && <span className="text-primary">• Pochette</span>}
                    {song.id3Filled.size > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-primary/15 text-primary">
                        <Sparkles className="w-2 h-2" /> ID3
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Submit */}
      {pendingCount > 0 && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Ajouter {pendingCount} chanson{pendingCount > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}

function AlbumForm() {
  const { user } = useAuth();
  const effectiveUserId = getEffectiveUserId(user?.id);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", artist: "", coverUrl: "", year: "" });
  const [tracks, setTracks] = useState<UploadedTrack[]>([]);
  const [id3Fields, setId3Fields] = useState<Set<string>>(new Set());

  const handleTracksUploaded = (uploaded: UploadedTrack[]) => {
    setTracks(uploaded);
    if (uploaded.length === 0) return;

    const filled = new Set<string>();

    setForm((f) => {
      const updated = { ...f };
      // Auto-fill artist from first track's ID3 artist if empty
      const firstArtist = uploaded.find((t) => t.artist)?.artist;
      if (!f.artist && firstArtist) { updated.artist = firstArtist; filled.add("artist"); }

      // Auto-fill cover from first track's ID3 cover
      const firstCover = uploaded.find((t) => t.coverUrl)?.coverUrl;
      if (!f.coverUrl && firstCover) { updated.coverUrl = firstCover; filled.add("coverUrl"); }

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.artist.trim()) return;
    setLoading(true);

    const { data: album, error } = await supabase.from("custom_albums").insert({
      user_id: effectiveUserId,
      title: form.title.trim(),
      artist: form.artist.trim(),
      cover_url: form.coverUrl.trim() || null,
      year: parseInt(form.year) || null,
    }).select("id").single();

    if (error) { toast.error("Erreur: " + error.message); setLoading(false); return; }

    if (tracks.length > 0 && album) {
      // Filter out duplicates
      const dupeChecks = await Promise.all(tracks.map(async (t) => {
        const { data } = await supabase.from("custom_songs")
          .select("id")
          .eq("title", t.title)
          .eq("artist", t.artist || form.artist.trim())
          .limit(1);
        return { track: t, isDupe: !!(data && data.length > 0) };
      }));

      const newTracks = dupeChecks.filter((c) => !c.isDupe).map((c) => c.track);
      const dupeCount = dupeChecks.filter((c) => c.isDupe).length;
      if (dupeCount > 0) toast.info(`${dupeCount} piste${dupeCount > 1 ? "s" : ""} déjà existante${dupeCount > 1 ? "s" : ""}, ignorée${dupeCount > 1 ? "s" : ""}`);

      if (newTracks.length > 0) {
        const songInserts = newTracks.map((t) => ({
          user_id: effectiveUserId,
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
    }

    setLoading(false);
    const trackCount = tracks.length;
    toast.success(`Album ajouté${trackCount > 0 ? ` avec ${trackCount} piste${trackCount > 1 ? "s" : ""}` : ""} !`);
    setForm({ title: "", artist: "", coverUrl: "", year: "" });
    setTracks([]);
    setId3Fields(new Set());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FieldInput label="Titre" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Nom de l'album" required />
      <FieldInput label="Artiste" value={form.artist} onChange={(v) => setForm({ ...form, artist: v })} placeholder="Nom de l'artiste" required autoFilled={id3Fields.has("artist")} />
      <FieldInput label="Année" value={form.year} onChange={(v) => setForm({ ...form, year: v })} placeholder="2025" type="number" />
      <CoverImagePicker value={form.coverUrl} onChange={(v) => setForm({ ...form, coverUrl: v })} />
      {id3Fields.has("coverUrl") && form.coverUrl && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold -mt-2">
          <Sparkles className="w-2.5 h-2.5" /> Pochette ID3
        </span>
      )}
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
  const { user } = useAuth();
  const effectiveUserId = getEffectiveUserId(user?.id);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", genre: "", coverUrl: "", streamUrl: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("custom_radio_stations").insert({
      user_id: effectiveUserId,
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
  const [tab, setTab] = useState<Tab>("song");

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
