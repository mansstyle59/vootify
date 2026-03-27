import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlayerStore } from "@/stores/playerStore";
import { getEffectiveUserId } from "@/lib/deviceId";

import { Music, ListMusic, Radio, Loader2, CheckCircle, Sparkles, Upload, FileAudio, X, Trash2, Plus, Play, Link, Download, ExternalLink, ChevronDown, ChevronUp, Info, Camera, Image } from "lucide-react";
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="text-foreground font-semibold text-right truncate">{value}</span>
    </div>
  );
}

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
  genre?: string;
  bitrate?: number;
  sampleRate?: number;
  codec?: string;
  year?: number;
  trackNumber?: number;
  totalTracks?: number;
  albumArtist?: string;
  composer?: string;
}

function SongForm() {
  const { user } = useAuth();
  const effectiveUserId = getEffectiveUserId(user?.id);
  const [songs, setSongs] = useState<SongEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
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

      // Use ID3 metadata only

      entries.push({
        file,
        title: normalizeTitle(meta.title || file.name.replace(/\.[^.]+$/, "")),
        artist: normalizeArtist(meta.artist || ""),
        album: meta.album ? normalizeText(meta.album) : "",
        duration, coverUrl: meta.coverUrl || "", streamUrl: "", uploading: false, uploaded: false, skipped: false, id3Filled,
        genre: id3.genre, bitrate: id3.bitrate, sampleRate: id3.sampleRate, codec: id3.codec,
        year: id3.year, trackNumber: id3.trackNumber, totalTracks: id3.totalTracks,
        albumArtist: id3.albumArtist, composer: id3.composer,
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
    let replaced = 0;

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      if (song.uploaded || song.skipped || !song.title.trim() || !song.artist.trim()) continue;
      setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: true } : s));

      // Upload audio file
      const ext = song.file.name.split(".").pop()?.toLowerCase() || "mp3";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("audio").upload(path, song.file, { contentType: song.file.type || "audio/mpeg" });
      if (uploadErr) { toast.error(`Erreur upload: ${song.title}`); setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: false } : s)); continue; }

      const { data: urlData } = supabase.storage.from("audio").getPublicUrl(path);
      const streamUrl = urlData.publicUrl;

      // Check for existing duplicate
      const { data: existing } = await supabase
        .from("custom_songs")
        .select("id")
        .ilike("title", song.title.trim())
        .ilike("artist", song.artist.trim())
        .limit(1);

      if (existing && existing.length > 0) {
        // Duplicate found — overwrite (update)
        const { error: updateErr } = await supabase.from("custom_songs").update({
          album: song.album.trim() || null, duration: song.duration || 0,
          cover_url: song.coverUrl.trim() || null, stream_url: streamUrl,
          year: song.year || null, genre: song.genre || null,
        }).eq("id", existing[0].id);
        if (updateErr) { toast.error(`Erreur mise à jour: ${song.title}`); setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: false } : s)); continue; }
        replaced++;
      } else {
        // New song — insert
        const { error: dbErr } = await supabase.from("custom_songs").insert({
          user_id: effectiveUserId, title: song.title.trim(), artist: song.artist.trim(),
          album: song.album.trim() || null, duration: song.duration || 0, cover_url: song.coverUrl.trim() || null, stream_url: streamUrl,
          year: song.year || null, genre: song.genre || null,
        });
        if (dbErr) { toast.error(`Erreur DB: ${song.title}`); setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: false } : s)); continue; }
      }
      setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: false, uploaded: true, streamUrl } : s));
      imported++;
    }
    setSubmitting(false);
    if (imported > 0) toast.success(`${imported} chanson${imported > 1 ? "s" : ""} importée${imported > 1 ? "s" : ""}`);
    if (replaced > 0) toast.info(`${replaced} doublon${replaced > 1 ? "s" : ""} écrasé${replaced > 1 ? "s" : ""}`);
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
              <div className="flex gap-3">
                {/* Clickable cover with change option */}
                <SongCoverThumb
                  coverUrl={song.coverUrl}
                  disabled={song.uploaded || song.skipped}
                  onChange={(url) => updateSong(idx, "coverUrl", url)}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{song.title || song.file.name}</p>
                  <p className="text-[10px] text-muted-foreground/60 truncate">{song.artist || "Artiste inconnu"}</p>
                  {song.album && <p className="text-[10px] text-muted-foreground/40 truncate">{song.album}{song.year ? ` • ${song.year}` : ""}</p>}
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

              {/* Metadata badges — always visible */}
              {(song.codec || song.bitrate || song.genre) && (
                <div className="flex flex-wrap gap-1.5 px-0.5">
                  {song.codec && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide">
                      {song.codec}
                    </span>
                  )}
                  {song.bitrate && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10px] font-semibold">
                      {song.bitrate} kbps
                    </span>
                  )}
                  {song.genre && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/50 text-accent-foreground text-[10px] font-semibold">
                      {song.genre}
                    </span>
                  )}
                  {song.sampleRate && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10px] font-semibold">
                      {(song.sampleRate / 1000).toFixed(1)} kHz
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-[10px]"
                  >
                    <Info className="w-3 h-3" />
                    {expandedIdx === idx ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              )}

              {/* Expanded metadata details */}
              <AnimatePresence>
                {expandedIdx === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl bg-secondary/30 border border-border/30 p-3 space-y-1.5 text-[11px]">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {song.album && <MetaRow label="Album" value={song.album} />}
                        {song.albumArtist && <MetaRow label="Artiste album" value={song.albumArtist} />}
                        {song.year && <MetaRow label="Année" value={String(song.year)} />}
                        {song.genre && <MetaRow label="Genre" value={song.genre} />}
                        {song.composer && <MetaRow label="Compositeur" value={song.composer} />}
                        {song.trackNumber && (
                          <MetaRow label="Piste" value={`${song.trackNumber}${song.totalTracks ? ` / ${song.totalTracks}` : ""}`} />
                        )}
                        {song.codec && <MetaRow label="Codec" value={song.codec} />}
                        {song.bitrate && <MetaRow label="Débit" value={`${song.bitrate} kbps`} />}
                        {song.sampleRate && <MetaRow label="Échantillonnage" value={`${song.sampleRate} Hz`} />}
                        {song.duration > 0 && (
                          <MetaRow label="Durée" value={`${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, "0")}`} />
                        )}
                        <MetaRow label="Taille" value={`${(song.file.size / (1024 * 1024)).toFixed(1)} Mo`} />
                        <MetaRow label="Format" value={song.file.name.split(".").pop()?.toUpperCase() || "?"} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Editable fields */}
              {!song.uploaded && !song.skipped && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={song.title} onChange={(e) => updateSong(idx, "title", e.target.value)} placeholder="Titre *"
                      className={`px-3 py-2 rounded-xl bg-secondary/50 border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 ${song.id3Filled.has("title") ? "border-primary/30" : "border-border/30"}`} />
                    <input value={song.artist} onChange={(e) => updateSong(idx, "artist", e.target.value)} placeholder="Artiste *"
                      className={`px-3 py-2 rounded-xl bg-secondary/50 border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 ${song.id3Filled.has("artist") ? "border-primary/30" : "border-border/30"}`} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={song.album} onChange={(e) => updateSong(idx, "album", e.target.value)} placeholder="Album"
                      className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/30 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/40" />
                    <input value={song.genre || ""} onChange={(e) => updateSong(idx, "genre", e.target.value)} placeholder="Genre"
                      className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/30 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/40" />
                    <input value={song.year ? String(song.year) : ""} onChange={(e) => { const v = parseInt(e.target.value); setSongs(p => p.map((s, i) => i === idx ? { ...s, year: isNaN(v) ? undefined : v } : s)); }} placeholder="Année"
                      className="px-3 py-2 rounded-xl bg-secondary/50 border border-border/30 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary/40" />
                  </div>
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


  const processFiles = async (files: FileList) => {
    setProcessing(true);
    const entries: SongEntry[] = [];
    let firstCover = "";
    let firstAlbum = "";
    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) { toast.error(`${file.name} trop lourd`); continue; }
      const id3 = await extractID3(file, file.name);
      const id3Filled = new Set<string>();
      let meta = { title: id3.title, artist: id3.artist, album: id3.album, coverUrl: id3.coverUrl };
      if (meta.title) id3Filled.add("title");
      if (meta.artist) id3Filled.add("artist");

      // Capture first cover & album for auto-fill
      if (!firstCover && meta.coverUrl) firstCover = meta.coverUrl;
      if (!firstAlbum && meta.album) firstAlbum = meta.album;

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

      entries.push({
        file, title: meta.title || file.name.replace(/\.[^.]+$/, ""), artist: meta.artist || "", album: meta.album || "",
        duration, coverUrl: meta.coverUrl || "", streamUrl: "", uploading: false, uploaded: false, skipped: false, id3Filled,
      });
    }
    setSongs((prev) => [...prev, ...entries]);

    // Auto-fill playlist name & cover from metadata if empty
    if (!name.trim() && firstAlbum) setName(firstAlbum);
    if (!coverUrl.trim() && firstCover) setCoverUrl(firstCover);

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
        year: song.year || null, genre: song.genre || null,
      }, { onConflict: "title,artist" });

      await addSongToPlaylist(created.id, {
        id: `custom-${Date.now()}-${i}`, title: song.title.trim(), artist: song.artist.trim(),
        album: song.album.trim(), duration: song.duration, coverUrl: song.coverUrl, streamUrl, liked: false,
      });

      setSongs((prev) => prev.map((s, j) => j === i ? { ...s, uploading: false, uploaded: true } : s));
      addedCount++;
    }


    setLoading(false);
    toast.success(`Playlist "${name.trim()}" créée avec ${addedCount} titre${addedCount > 1 ? "s" : ""} !`);
    setName(""); setCoverUrl(""); setSongs([]);
  };

  const totalTracks = songs.filter(s => s.title.trim() && s.artist.trim()).length;

  return (
    <div className="space-y-5">
      <FieldInput label="Nom de la playlist" value={name} onChange={setName} placeholder="Ma playlist" required />
      <CoverImagePicker value={coverUrl} onChange={setCoverUrl} />


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
                <div className="flex-1 min-w-0 space-y-0.5">
                  <input value={song.title} onChange={(e) => setSongs(p => p.map((s, i) => i === idx ? { ...s, title: e.target.value } : s))}
                    className={`w-full text-xs font-semibold text-foreground bg-transparent focus:outline-none ${song.id3Filled.has("title") ? "text-primary" : ""}`} placeholder="Titre *" />
                  <input value={song.artist} onChange={(e) => setSongs(p => p.map((s, i) => i === idx ? { ...s, artist: e.target.value } : s))}
                    className={`w-full text-[10px] text-muted-foreground/60 bg-transparent focus:outline-none ${song.id3Filled.has("artist") ? "text-primary/70" : ""}`} placeholder="Artiste *" />
                  <div className="flex gap-2">
                    <input value={song.album} onChange={(e) => setSongs(p => p.map((s, i) => i === idx ? { ...s, album: e.target.value } : s))}
                      className="flex-1 text-[10px] text-muted-foreground/50 bg-transparent focus:outline-none" placeholder="Album" />
                    <input value={song.year ? String(song.year) : ""} onChange={(e) => setSongs(p => p.map((s, i) => i === idx ? { ...s, year: parseInt(e.target.value) || undefined } : s))}
                      className="w-12 text-[10px] text-muted-foreground/50 bg-transparent focus:outline-none text-right" placeholder="Année" />
                  </div>
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
