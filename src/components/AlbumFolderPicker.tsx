import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import { FolderUp, FileArchive, Loader2, X, FileAudio, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { extractID3 } from "@/lib/id3Utils";


export interface UploadedTrack {
  fileName: string;
  streamUrl: string;
  duration: number;
  title: string;
  artist: string;
  coverUrl?: string;
}

interface AlbumFolderPickerProps {
  onTracksUploaded: (tracks: UploadedTrack[]) => void;
  albumArtist?: string;
  className?: string;
}

const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "ogg", "flac", "wav", "wma", "opus"];

function isAudioFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return AUDIO_EXTENSIONS.includes(ext);
}

function cleanTitle(fileName: string): string {
  // Strip path prefixes (zip entries can have folder paths)
  let name = fileName.split("/").pop() || fileName;
  // Remove file extension
  name = name.replace(/\.[^.]+$/, "");
  // Remove leading track numbers: "01 - ", "1. ", "01.", "03 ", etc.
  name = name.replace(/^\d{1,3}[\s.\-_]+/, "");
  // Remove leading/trailing whitespace and dashes
  name = name.replace(/^[\s\-_]+|[\s\-_]+$/g, "");
  return name.trim();
}

// detectDuration kept as fallback
function detectDuration(file: File | Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      resolve(Math.round(audio.duration));
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    audio.src = url;
  });
}

const MIME_MAP: Record<string, string> = {
  mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac",
  ogg: "audio/ogg", flac: "audio/flac", wav: "audio/wav",
  wma: "audio/x-ms-wma", opus: "audio/opus",
};

async function extractAudioFromZip(zipFile: File): Promise<File[]> {
  const zip = await JSZip.loadAsync(zipFile);
  const files: File[] = [];

  const entries = Object.entries(zip.files).filter(
    ([name, entry]) => !entry.dir && isAudioFile(name) && !name.startsWith("__MACOSX")
  );

  for (const [name, entry] of entries) {
    const blob = await entry.async("blob");
    const ext = name.split(".").pop()?.toLowerCase() || "mp3";
    const fileName = name.split("/").pop() || name;
    const file = new File([blob], fileName, { type: MIME_MAP[ext] || "audio/mpeg" });
    files.push(file);
  }

  return files;
}

async function uploadAndProcessFiles(
  audioFiles: File[],
  albumArtist: string,
  setProgress: (p: { done: number; total: number }) => void,
): Promise<UploadedTrack[]> {
  audioFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const uploaded: UploadedTrack[] = [];

  for (let i = 0; i < audioFiles.length; i++) {
    const file = audioFiles[i];
    setProgress({ done: i, total: audioFiles.length });

    try {
      // Extract ID3 metadata
      const id3 = await extractID3(file, file.name);
      const duration = id3.duration || await detectDuration(file);

      let title = id3.title;
      let artist = id3.artist;
      let coverUrl = id3.coverUrl;

      // If ID3 is incomplete, try Deezer search
      if (!title || !artist || !coverUrl) {
        const cleanName = cleanTitle(file.name);
        const searchQuery = title && artist
          ? `${artist} ${title}`
          : title || cleanName;
        try {
          const results = await deezerApi.searchTracks(searchQuery, 3);
          if (results.length > 0) {
            const best = results[0];
            if (!title) title = best.title;
            if (!artist) artist = best.artist;
            if (!coverUrl) coverUrl = best.coverUrl;
          }
        } catch {}
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("audio").upload(path, file, {
        contentType: file.type || "audio/mpeg",
      });

      if (error) {
        console.error(`Upload failed for ${file.name}:`, error);
        continue;
      }

      const { data: urlData } = supabase.storage.from("audio").getPublicUrl(path);
      uploaded.push({
        fileName: file.name,
        streamUrl: urlData.publicUrl,
        duration,
        title: title || cleanTitle(file.name),
        artist: artist || albumArtist,
        coverUrl,
      });
    } catch (err) {
      console.error(`Error processing ${file.name}:`, err);
    }
  }

  setProgress({ done: audioFiles.length, total: audioFiles.length });
  return uploaded;
}

function TrackRow({ track, index, onUpdate, onRemove }: {
  track: UploadedTrack;
  index: number;
  onUpdate: (field: "title" | "artist", value: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);

  const save = () => {
    if (title.trim()) onUpdate("title", title.trim());
    if (artist.trim()) onUpdate("artist", artist.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1 px-2.5 py-2 rounded-lg bg-secondary/60 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground w-5 text-right shrink-0">{index + 1}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 bg-background/80 border border-border rounded px-2 py-1 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Titre"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </div>
        <div className="flex items-center gap-1.5 pl-[26px]">
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="flex-1 bg-background/80 border border-border rounded px-2 py-1 text-muted-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Artiste"
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          <button type="button" onClick={save} className="p-1 text-primary hover:bg-primary/10 rounded">
            <Check className="w-3 h-3" />
          </button>
          <button type="button" onClick={() => setEditing(false)} className="p-1 text-muted-foreground hover:text-foreground rounded">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-secondary/40 text-xs group">
      <span className="text-muted-foreground w-5 text-right shrink-0">{index + 1}</span>
      <FileAudio className="w-3.5 h-3.5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="truncate block text-foreground">{track.title}</span>
        <span className="truncate block text-muted-foreground text-[10px]">{track.artist}</span>
      </div>
      <span className="text-muted-foreground shrink-0">
        {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, "0")}
      </span>
      <button type="button" onClick={() => setEditing(true)} className="p-0.5 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil className="w-3 h-3" />
      </button>
      <button type="button" onClick={onRemove} className="p-0.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

const AlbumFolderPicker = ({ onTracksUploaded, albumArtist = "", className = "" }: AlbumFolderPickerProps) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [tracks, setTracks] = useState<UploadedTrack[]>([]);
  const folderRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  const finishUpload = (uploaded: UploadedTrack[]) => {
    setTracks(uploaded);
    onTracksUploaded(uploaded);
    setUploading(false);
    toast.success(`${uploaded.length} piste${uploaded.length > 1 ? "s" : ""} uploadée${uploaded.length > 1 ? "s" : ""} !`);
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const audioFiles = Array.from(fileList).filter((f) => isAudioFile(f.name));
    if (audioFiles.length === 0) {
      toast.error("Aucun fichier audio trouvé dans le dossier");
      return;
    }

    setUploading(true);
    const uploaded = await uploadAndProcessFiles(audioFiles, albumArtist, setProgress);
    finishUpload(uploaded);
  };

  const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024 * 1024) {
      toast.error("Fichier trop lourd (max 500 Mo)");
      return;
    }

    setUploading(true);
    setProgress({ done: 0, total: 0 });

    try {
      toast.info("Extraction du ZIP en cours...");
      const audioFiles = await extractAudioFromZip(file);

      if (audioFiles.length === 0) {
        toast.error("Aucun fichier audio trouvé dans le ZIP");
        setUploading(false);
        return;
      }

      toast.info(`${audioFiles.length} piste${audioFiles.length > 1 ? "s" : ""} trouvée${audioFiles.length > 1 ? "s" : ""}, upload...`);
      const uploaded = await uploadAndProcessFiles(audioFiles, albumArtist, setProgress);
      finishUpload(uploaded);
    } catch (err) {
      console.error("ZIP extraction failed:", err);
      toast.error("Erreur lors de l'extraction du ZIP");
      setUploading(false);
    }
  };

  const handleRemoveTrack = (idx: number) => {
    const updated = tracks.filter((_, i) => i !== idx);
    setTracks(updated);
    onTracksUploaded(updated);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <span className="text-sm font-medium text-foreground block">Pistes de l'album</span>

      <input
        ref={folderRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        multiple
        onChange={handleFolderSelect}
        className="hidden"
      />
      <input
        ref={zipRef}
        type="file"
        accept=".zip"
        onChange={handleZipSelect}
        className="hidden"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => folderRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderUp className="w-3.5 h-3.5" />}
          {uploading ? `${progress.done}/${progress.total}...` : "Dossier"}
        </button>
        <button
          type="button"
          onClick={() => zipRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
        >
          <FileArchive className="w-3.5 h-3.5" />
          ZIP
        </button>
      </div>

      {tracks.length > 0 && (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {tracks.map((t, i) => (
            <TrackRow
              key={i}
              track={t}
              index={i}
              onUpdate={(field, value) => {
                const updated = [...tracks];
                updated[i] = { ...updated[i], [field]: value };
                setTracks(updated);
                onTracksUploaded(updated);
              }}
              onRemove={() => handleRemoveTrack(i)}
            />
          ))}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <Check className="w-3.5 h-3.5 text-primary" />
            {tracks.length} piste{tracks.length > 1 ? "s" : ""} •{" "}
            {Math.floor(tracks.reduce((s, t) => s + t.duration, 0) / 60)} min
          </div>
        </div>
      )}
    </div>
  );
};

export default AlbumFolderPicker;
