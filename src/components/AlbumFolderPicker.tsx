import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FolderUp, FileArchive, Loader2, X, FileAudio, Check } from "lucide-react";
import { toast } from "sonner";

export interface UploadedTrack {
  fileName: string;
  streamUrl: string;
  duration: number;
  title: string;
  artist: string;
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
  let name = fileName.replace(/\.[^.]+$/, ""); // remove extension
  // Remove leading track numbers like "01 - ", "01. ", "1 - "
  name = name.replace(/^\d{1,3}[\s.\-_]+/, "");
  return name.trim();
}

function detectDuration(file: File): Promise<number> {
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

async function extractFilesFromZip(zipFile: File): Promise<File[]> {
  // We'll use JSZip-like approach via the browser
  // Since we don't have JSZip, we'll inform user to use folder picker instead
  toast.error("Pour les .zip, décompressez d'abord puis utilisez le sélecteur de dossier");
  return [];
}

const AlbumFolderPicker = ({ onTracksUploaded, albumArtist = "", className = "" }: AlbumFolderPickerProps) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [tracks, setTracks] = useState<UploadedTrack[]>([]);
  const folderRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const audioFiles = Array.from(fileList).filter((f) => isAudioFile(f.name));
    if (audioFiles.length === 0) {
      toast.error("Aucun fichier audio trouvé dans le dossier");
      return;
    }

    // Sort by name for track order
    audioFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    setUploading(true);
    setProgress({ done: 0, total: audioFiles.length });
    const uploaded: UploadedTrack[] = [];

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      setProgress({ done: i, total: audioFiles.length });

      try {
        // Detect duration
        const duration = await detectDuration(file);

        // Upload
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
          title: cleanTitle(file.name),
          artist: albumArtist,
        });
      } catch (err) {
        console.error(`Error processing ${file.name}:`, err);
      }
    }

    setProgress({ done: audioFiles.length, total: audioFiles.length });
    setTracks(uploaded);
    onTracksUploaded(uploaded);
    setUploading(false);
    toast.success(`${uploaded.length} piste${uploaded.length > 1 ? "s" : ""} uploadée${uploaded.length > 1 ? "s" : ""} !`);
  };

  const handleRemoveTrack = (idx: number) => {
    const updated = tracks.filter((_, i) => i !== idx);
    setTracks(updated);
    onTracksUploaded(updated);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <span className="text-sm font-medium text-foreground block">Pistes de l'album</span>

      {/* Folder picker */}
      <input
        ref={folderRef}
        type="file"
        // @ts-ignore - webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        multiple
        onChange={handleFolderSelect}
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
      </div>

      {/* Track list */}
      {tracks.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {tracks.map((t, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-secondary/40 text-xs">
              <span className="text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
              <FileAudio className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate flex-1 text-foreground">{t.title}</span>
              <span className="text-muted-foreground shrink-0">
                {Math.floor(t.duration / 60)}:{(t.duration % 60).toString().padStart(2, "0")}
              </span>
              <button type="button" onClick={() => handleRemoveTrack(i)} className="p-0.5 text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </div>
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
