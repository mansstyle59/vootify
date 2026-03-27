import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlayerStore } from "@/stores/playerStore";
import { getEffectiveUserId } from "@/lib/deviceId";

import { Music, ListMusic, Radio, Loader2, CheckCircle, Sparkles, Upload, FileAudio, X, Trash2, Plus, Play, Link, Download, ExternalLink } from "lucide-react";
import CoverImagePicker from "@/components/CoverImagePicker";
import AudioFilePicker from "@/components/AudioFilePicker";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { extractID3 } from "@/lib/id3Utils";

import { normalizeTitle, normalizeArtist, normalizeText } from "@/lib/metadataEnrich";

type Tab = "song" | "playlist" | "radio";

const tabs: { key: Tab; label: string; icon: React.ElementType; desc: string }[] = [
  { key: "song", label: "Chansons", icon: Music, desc: "Importez vos fichiers audio" },
  { key: "playlist", label: "Playlist", icon: ListMusic, desc: "Créez une playlist avec vos titres" },
  { key: "radio", label: "Radio", icon: Radio, desc: "Ajoutez une station radio" },
];

function FieldInput({ label, value, onChange, placeholder, type = "text", required = false, autoFilled = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; autoFilled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
        {label} {required && <span className="text-destructive text-xs">*</span>}
        {autoFilled && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
            <Sparkles className="w-2.5 h-2.5" /> Auto
          </span>
        )}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={`w-full px-4 py-3 rounded-xl bg-secondary/50 border text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all ${
          autoFilled ? "border-primary/30" : "border-border/50"
        }`}
      />
    </label>
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
  skipped: boolean;
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
      if (file.size > 50 * 1024 * 1024) { toast.error(`${file.name} trop lourd (max 50 Mo)`); continue; }
      const id3 = await extractID3(file, file.name);
      let meta = { title: id3.title, artist: id3.artist, album: id3.album, coverUrl: id3.coverUrl };
      const id3Filled = new Set<string>();
      if (meta.title) id3Filled.add("title");
      if (meta.artist) id3Filled.add("artist");
      if (meta.album) id3Filled.add("album");
      if (meta.coverUrl) id3Filled.add("coverUrl");

      let duration = id3.duration && id3.duration > 0 ? Math.round(id3.duration) : 0;
      if (!duration) {
        try {
          const objectUrl = URL.createObjectURL(file);
          duration = await new Promise<number>((resolve) => {
            const audio = new Audio();
            audio.preload = "metadata";
            audio.src = objectUrl;
            audio.addEventListener("loadedmetadata", () => { resolve(audio.duration && isFinite(audio.duration) ? Math.round(audio.duration) : 0); URL.revokeObjectURL(objectUrl); }, { once: true });
            audio.addEventListener("error", () => { resolve(0); URL.revokeObjectURL(objectUrl); }, { once: true });
          });
        } catch { duration = 0; }
      }
      if (duration) id3Filled.add("duration");

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
        title: normalizeTitle(meta.title || file.name.replace(/\.[^.]+$/, "")),
        artist: normalizeArtist(meta.artist || ""),
        album: meta.album ? normalizeText(meta.album) : "",
        duration, coverUrl: meta.coverUrl || "", streamUrl: "", uploading: false, uploaded: false, skipped: false, id3Filled,
      });
    }
    setSongs((prev) => [...prev, ...entries]);
    setProcessing(false);
    if (entries.length > 0) toast.success(`${entries.length} fichier${entries.length > 1 ? "s" : ""} analysé${entries.length > 1 ? "s" : ""}`);
  };

  const updateSong = (idx: number, field: string, value: string) => {
    setSongs((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const removeSong = (idx: number) => { setSongs((prev) => prev.filter((_, i) => i !== idx)); };

  const handleSubmit = async () => {
    const toUpload = songs.filter((s) => !s.uploaded && !s.skipped && s.title.trim() && s.artist.trim());
    if (toUpload.length === 0) return;
    setSubmitting(true);

    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      if (song.uploaded || song.skipped || !song.title.trim() || !song.artist.trim()) continue;
      setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: true } : s));

      // Check for duplicate BEFORE uploading the file
      const { data: existing } = await supabase
        .from("custom_songs")
        .select("id")
        .ilike("title", song.title.trim())
        .ilike("artist", song.artist.trim())
        .limit(1);

      if (existing && existing.length > 0) {
        // Duplicate found — skip entirely, no upload
        setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: false, skipped: true } : s));
        skipped++;
        continue;
      }

      const ext = song.file.name.split(".").pop()?.toLowerCase() || "mp3";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("audio").upload(path, song.file, { contentType: song.file.type || "audio/mpeg" });
      if (uploadErr) { toast.error(`Erreur upload: ${song.title}`); setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: false } : s)); continue; }

      const { data: urlData } = supabase.storage.from("audio").getPublicUrl(path);
      const streamUrl = urlData.publicUrl;

      const { error: dbErr } = await supabase.from("custom_songs").insert({
        user_id: effectiveUserId, title: song.title.trim(), artist: song.artist.trim(),
        album: song.album.trim() || null, duration: song.duration || 0, cover_url: song.coverUrl.trim() || null, stream_url: streamUrl,
      });
      if (dbErr) { toast.error(`Erreur DB: ${song.title}`); setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: false } : s)); continue; }
      setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: false, uploaded: true, streamUrl } : s));
      imported++;
    }
    setSubmitting(false);
    if (imported > 0) toast.success(`${imported} chanson${imported > 1 ? "s" : ""} ajoutée${imported > 1 ? "s" : ""}`);
    if (skipped > 0) toast.info(`${skipped} doublon${skipped > 1 ? "s" : ""} ignoré${skipped > 1 ? "s" : ""}`);
  };

  const pendingCount = songs.filter((s) => !s.uploaded && !s.skipped && s.title.trim() && s.artist.trim()).length;

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept={ACCEPTED_AUDIO} multiple onChange={(e) => e.target.files && processFiles(e.target.files)} className="hidden" />
      
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={() => fileRef.current?.click()}
        disabled={processing}
        className="w-full flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-2xl border-2 border-dashed border-border/50 hover:border-primary/40 bg-secondary/20 hover:bg-secondary/30 transition-all"
      >
        <div className="p-3 rounded-2xl bg-primary/10">
          {processing ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Upload className="w-6 h-6 text-primary" />}
        </div>
        <span className="text-sm font-medium text-foreground">{processing ? "Analyse en cours..." : "Sélectionner des fichiers audio"}</span>
        <span className="text-[11px] text-muted-foreground/60">MP3, M4A, FLAC, WAV • Max 50 Mo</span>
      </motion.button>

      {songs.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wider px-1">
            {songs.length} fichier{songs.length > 1 ? "s" : ""} • {songs.filter(s => s.uploaded).length} importé{songs.filter(s => s.uploaded).length > 1 ? "s" : ""}
          </p>
          {songs.map((song, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-2xl p-3.5 space-y-2.5 transition-all ${
                song.uploaded || song.skipped ? "liquid-glass opacity-60" : "liquid-glass"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {song.coverUrl ? (
                  <img src={song.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover shadow-md" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <FileAudio className="w-4 h-4 text-muted-foreground/50" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{song.title || song.file.name}</p>
                  <p className="text-[10px] text-muted-foreground/60 truncate">{song.artist || "Artiste inconnu"}</p>
                </div>
                {song.uploaded && <CheckCircle className="w-5 h-5 text-primary shrink-0" />}
                {song.skipped && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 shrink-0">Doublon</span>
                )}
                {song.uploading && <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />}
                {!song.uploaded && !song.uploading && !song.skipped && (
                  <button type="button" onClick={() => removeSong(idx)} className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {!song.uploaded && !song.skipped && (
                <div className="grid grid-cols-2 gap-2">
                  <input value={song.title} onChange={(e) => updateSong(idx, "title", e.target.value)} placeholder="Titre *"
                    className={`px-3 py-2 rounded-xl bg-secondary/50 border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 ${song.id3Filled.has("title") ? "border-primary/30" : "border-border/30"}`} />
                  <input value={song.artist} onChange={(e) => updateSong(idx, "artist", e.target.value)} placeholder="Artiste *"
                    className={`px-3 py-2 rounded-xl bg-secondary/50 border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 ${song.id3Filled.has("artist") ? "border-primary/30" : "border-border/30"}`} />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {pendingCount > 0 && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/25 hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Importer {pendingCount} chanson{pendingCount > 1 ? "s" : ""}
        </motion.button>
      )}
    </div>
  );
}

function PlaylistForm() {
  const { user } = useAuth();
  const effectiveUserId = getEffectiveUserId(user?.id);
  const { createPlaylist, playlists, addSongToPlaylist } = usePlayerStore();
  const [name, setName] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [songs, setSongs] = useState<SongEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Deezer import state
  const [deezerUrl, setDeezerUrl] = useState("");
  const [deezerLoading, setDeezerLoading] = useState(false);
  const [deezerTracks, setDeezerTracks] = useState<{ id: string; title: string; artist: string; album: string; duration: number; coverUrl: string; streamUrl: string }[]>([]);
  const [deezerInfo, setDeezerInfo] = useState<{ title: string; picture: string } | null>(null);

  const extractPlaylistId = async (input: string): Promise<string | null> => {
    const trimmed = input.trim();
    // Direct ID
    if (/^\d+$/.test(trimmed)) return trimmed;
    // Standard URL: deezer.com/.../playlist/123
    const stdMatch = trimmed.match(/deezer\.com\/(?:\w+\/)?playlist\/(\d+)/);
    if (stdMatch) return stdMatch[1];
    // Short link: dz.page.link or link.deezer.com
    if (trimmed.includes("dz.page.link") || trimmed.includes("link.deezer.com") || trimmed.includes("dzr.page.link")) {
      try {
        const data = await callDeezerProxy({ action: "resolve_short_link", url: trimmed });
        if (data.playlist_id) return data.playlist_id;
      } catch {}
    }
    return null;
  };

  const callDeezerProxy = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("deezer-proxy", { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleDeezerImport = async () => {
    if (!deezerUrl.trim()) return;
    setDeezerLoading(true);
    setDeezerTracks([]);
    setDeezerInfo(null);

    try {
      const playlistId = await extractPlaylistId(deezerUrl);
      if (!playlistId) {
        toast.error("Lien de playlist Deezer invalide");
        setDeezerLoading(false);
        return;
      }

      console.log("DEEZER IMPORT: playlist ID =", playlistId);
      const data = await callDeezerProxy({ action: "playlist", id: playlistId });

      if (!data || !data.tracks?.data?.length) {
        toast.error("Playlist vide ou introuvable");
        setDeezerLoading(false);
        return;
      }

      const info = {
        title: data.title || "Playlist Deezer",
        picture: data.picture_medium || data.picture_big || data.picture || "",
      };
      setDeezerInfo(info);

      // Auto-fill name and cover if empty
      if (!name.trim()) setName(info.title);
      if (!coverUrl.trim() && info.picture) setCoverUrl(info.picture);

      const tracks = (data.tracks.data as any[]).map((t: any) => ({
        id: `dz-${t.id}`,
        title: t.title || "Sans titre",
        artist: t.artist?.name || "Inconnu",
        album: t.album?.title || "",
        duration: t.duration || 0,
        coverUrl: t.album?.cover_medium || t.album?.cover_big || "",
        streamUrl: t.preview || "",
      }));

      setDeezerTracks(tracks);
      toast.success(`${tracks.length} titres trouvés dans "${info.title}"`);
    } catch (e: any) {
      console.error("Deezer import error:", e);
      toast.error("Erreur lors de l'import: " + (e.message || "Erreur inconnue"));
    }
    setDeezerLoading(false);
  };

  const processFiles = async (files: FileList) => {
    setProcessing(true);
    const entries: SongEntry[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) { toast.error(`${file.name} trop lourd`); continue; }
      const id3 = await extractID3(file, file.name);
      const id3Filled = new Set<string>();
      let meta = { title: id3.title, artist: id3.artist, album: id3.album, coverUrl: id3.coverUrl };
      if (meta.title) id3Filled.add("title");
      if (meta.artist) id3Filled.add("artist");

      let duration = id3.duration && id3.duration > 0 ? Math.round(id3.duration) : 0;
      if (!duration) {
        try {
          const objectUrl = URL.createObjectURL(file);
          duration = await new Promise<number>((resolve) => {
            const audio = new Audio();
            audio.preload = "metadata"; audio.src = objectUrl;
            audio.addEventListener("loadedmetadata", () => { resolve(audio.duration && isFinite(audio.duration) ? Math.round(audio.duration) : 0); URL.revokeObjectURL(objectUrl); }, { once: true });
            audio.addEventListener("error", () => { resolve(0); URL.revokeObjectURL(objectUrl); }, { once: true });
          });
        } catch { duration = 0; }
      }

      if (!meta.title || !meta.artist || !meta.coverUrl) {
        const cleanName = file.name.replace(/\.[^.]+$/, "").replace(/^\d{1,3}[\s.\-_]+/, "").trim();
        try {
          const results = await deezerApi.searchTracks(meta.title || cleanName, 3);
          if (results.length > 0) {
            if (!meta.title) meta.title = results[0].title;
            if (!meta.artist) meta.artist = results[0].artist;
            if (!meta.coverUrl) meta.coverUrl = results[0].coverUrl;
          }
        } catch {}
      }

      entries.push({
        file, title: meta.title || file.name.replace(/\.[^.]+$/, ""), artist: meta.artist || "", album: meta.album || "",
        duration, coverUrl: meta.coverUrl || "", streamUrl: "", uploading: false, uploaded: false, skipped: false, id3Filled,
      });
    }
    setSongs((prev) => [...prev, ...entries]);
    setProcessing(false);
    if (entries.length > 0) toast.success(`${entries.length} fichier${entries.length > 1 ? "s" : ""} prêt${entries.length > 1 ? "s" : ""}`);
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("Donnez un nom à la playlist"); return; }
    setLoading(true);

    // Create the playlist
    await createPlaylist(name.trim());
    const newPlaylists = usePlayerStore.getState().playlists;
    const created = newPlaylists.find((p) => p.name === name.trim());
    if (!created) { toast.error("Erreur création playlist"); setLoading(false); return; }

    // Update cover if provided
    if (coverUrl.trim()) {
      await supabase.from("playlists").update({ cover_url: coverUrl.trim() }).eq("id", created.id);
    }

    let addedCount = 0;

    // Upload local audio files
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      if (!song.title.trim() || !song.artist.trim()) continue;
      setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: true } : s));

      const ext = song.file.name.split(".").pop()?.toLowerCase() || "mp3";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("audio").upload(path, song.file, { contentType: song.file.type || "audio/mpeg" });
      if (uploadErr) { setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: false } : s)); continue; }

      const { data: urlData } = supabase.storage.from("audio").getPublicUrl(path);
      const streamUrl = urlData.publicUrl;

      await supabase.from("custom_songs").upsert({
        user_id: effectiveUserId, title: song.title.trim(), artist: song.artist.trim(),
        album: song.album.trim() || null, duration: song.duration || 0,
        cover_url: song.coverUrl.trim() || null, stream_url: streamUrl,
      }, { onConflict: "title,artist" });

      await addSongToPlaylist(created.id, {
        id: `custom-${Date.now()}-${i}`, title: song.title.trim(), artist: song.artist.trim(),
        album: song.album.trim(), duration: song.duration, coverUrl: song.coverUrl, streamUrl, liked: false,
      });

      setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: false, uploaded: true } : s));
      addedCount++;
    }

    // Add Deezer tracks to playlist
    for (let i = 0; i < deezerTracks.length; i++) {
      const t = deezerTracks[i];
      await addSongToPlaylist(created.id, {
        id: t.id, title: t.title, artist: t.artist, album: t.album,
        duration: t.duration, coverUrl: t.coverUrl, streamUrl: t.streamUrl, liked: false,
      });
      addedCount++;
    }

    setLoading(false);
    toast.success(`Playlist "${name.trim()}" créée avec ${addedCount} titre${addedCount > 1 ? "s" : ""} !`);
    setName(""); setCoverUrl(""); setSongs([]); setDeezerTracks([]); setDeezerInfo(null); setDeezerUrl("");
  };

  const totalTracks = songs.filter(s => s.title.trim() && s.artist.trim()).length + deezerTracks.length;

  return (
    <div className="space-y-5">
      <FieldInput label="Nom de la playlist" value={name} onChange={setName} placeholder="Ma playlist" required />
      <CoverImagePicker value={coverUrl} onChange={setCoverUrl} />

      {/* Deezer Import Section */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" />
          Importer depuis Deezer
        </p>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <input
              value={deezerUrl}
              onChange={(e) => setDeezerUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDeezerImport()}
              placeholder="Coller un lien Deezer playlist..."
              className="w-full pl-9 pr-3 py-3 rounded-xl bg-secondary/50 border border-border/50 text-foreground text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={handleDeezerImport}
            disabled={deezerLoading || !deezerUrl.trim()}
            className="px-4 py-3 rounded-xl bg-primary/10 text-primary font-semibold text-sm hover:bg-primary/20 transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0"
          >
            {deezerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
            Importer
          </motion.button>
        </div>

        {/* Deezer tracks preview */}
        <AnimatePresence>
          {deezerTracks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1.5 overflow-hidden"
            >
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wider">
                  {deezerTracks.length} titres Deezer
                </p>
                <button
                  onClick={() => { setDeezerTracks([]); setDeezerInfo(null); }}
                  className="text-[10px] text-destructive/70 hover:text-destructive font-medium"
                >
                  Retirer tout
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl">
                {deezerTracks.map((t, idx) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="flex items-center gap-2.5 p-2 rounded-xl liquid-glass"
                  >
                    <span className="text-[10px] text-muted-foreground/40 w-5 text-center tabular-nums">{idx + 1}</span>
                    {t.coverUrl ? (
                      <img src={t.coverUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"><Music className="w-3 h-3 text-muted-foreground/40" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{t.title}</p>
                      <p className="text-[10px] text-muted-foreground/60 truncate">{t.artist}</p>
                    </div>
                    <button
                      onClick={() => setDeezerTracks(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground/30 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Local audio files section */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Music className="w-4 h-4 text-primary" />
          Ajouter des fichiers audio
          <span className="text-[10px] text-muted-foreground/50">(optionnel)</span>
        </p>

        <input ref={fileRef} type="file" accept={ACCEPTED_AUDIO} multiple onChange={(e) => e.target.files && processFiles(e.target.files)} className="hidden" />
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => fileRef.current?.click()}
          disabled={processing}
          className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-border/40 hover:border-primary/30 bg-secondary/10 transition-all text-sm text-muted-foreground hover:text-foreground"
        >
          {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {processing ? "Analyse..." : "Ajouter des fichiers audio"}
        </motion.button>

        {songs.length > 0 && (
          <div className="space-y-1.5">
            {songs.map((song, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${song.uploaded || song.skipped ? "opacity-50" : "liquid-glass"}`}
              >
                <span className="text-[10px] text-muted-foreground/40 w-5 text-center tabular-nums font-medium">{idx + 1}</span>
                {song.coverUrl ? (
                  <img src={song.coverUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center"><Music className="w-3.5 h-3.5 text-muted-foreground/40" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <input value={song.title} onChange={(e) => setSongs(p => p.map((s, i) => i === idx ? { ...s, title: e.target.value } : s))}
                    className="w-full text-xs font-semibold text-foreground bg-transparent focus:outline-none" placeholder="Titre" />
                  <input value={song.artist} onChange={(e) => setSongs(p => p.map((s, i) => i === idx ? { ...s, artist: e.target.value } : s))}
                    className="w-full text-[10px] text-muted-foreground/60 bg-transparent focus:outline-none" placeholder="Artiste" />
                </div>
                {song.uploaded ? <CheckCircle className="w-4 h-4 text-primary" /> : song.skipped ? (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 shrink-0">Doublon</span>
                ) : song.uploading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : (
                  <button onClick={() => setSongs(p => p.filter((_, i) => i !== idx))} className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={handleSubmit}
        disabled={loading || !name.trim()}
        className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/25 hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        Créer la playlist{totalTracks > 0 ? ` (${totalTracks} titre${totalTracks > 1 ? "s" : ""})` : ""}
      </motion.button>
    </div>
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
      user_id: effectiveUserId, name: form.name.trim(), genre: form.genre.trim() || null,
      cover_url: form.coverUrl.trim() || null, stream_url: form.streamUrl.trim() || null,
    });
    setLoading(false);
    if (error) { toast.error("Erreur: " + error.message); return; }
    toast.success("Station radio ajoutée !");
    setForm({ name: "", genre: "", coverUrl: "", streamUrl: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FieldInput label="Nom de la station" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="France Inter" required />
      <FieldInput label="Genre" value={form.genre} onChange={(v) => setForm({ ...form, genre: v })} placeholder="Pop, Jazz, Info..." />
      <CoverImagePicker value={form.coverUrl} onChange={(v) => setForm({ ...form, coverUrl: v })} />
      <FieldInput label="URL du flux audio" value={form.streamUrl} onChange={(v) => setForm({ ...form, streamUrl: v })} placeholder="https://..." />
      <motion.button
        type="submit"
        whileTap={{ scale: 0.97 }}
        disabled={loading}
        className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/25 hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
        Ajouter la station
      </motion.button>
    </form>
  );
}

const AddContentPage = () => {
  const [tab, setTab] = useState<Tab>("song");

  return (
    <div className="pb-40 max-w-2xl mx-auto" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
      {/* Header */}
      <div className="px-4 md:px-8 mb-6">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Ajouter</h1>
        <p className="text-xs text-muted-foreground/60 mt-1">Importez votre musique et créez vos playlists</p>
      </div>

      {/* Tabs */}
      <div className="px-4 md:px-8 mb-6">
        <div className="grid grid-cols-3 gap-2">
          {tabs.map(({ key, label, icon: Icon, desc }) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.97 }}
              onClick={() => setTab(key)}
              className={`relative flex flex-col items-center gap-1.5 p-4 rounded-2xl text-center transition-all ${
                tab === key
                  ? "bg-primary/10 ring-1 ring-primary/25 text-primary"
                  : "liquid-glass text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-semibold">{label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="rounded-2xl liquid-glass p-5"
          >
            {tab === "song" && <SongForm />}
            {tab === "playlist" && <PlaylistForm />}
            {tab === "radio" && <RadioForm />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AddContentPage;
