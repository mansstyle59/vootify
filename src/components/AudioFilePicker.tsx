import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileAudio, Loader2, X, Search } from "lucide-react";
import { toast } from "sonner";
import { extractID3 } from "@/lib/id3Utils";
import { normalizeTitle, normalizeArtist, cleanSongTitle } from "@/lib/metadataEnrich";


export interface AudioFileMetadata {
  title?: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
}

interface AudioFilePickerProps {
  value: string;
  onChange: (url: string) => void;
  onDurationDetected?: (seconds: number) => void;
  onMetadataExtracted?: (meta: AudioFileMetadata) => void;
  className?: string;
}

const ACCEPTED_AUDIO = ".mp3,.m4a,.aac,.ogg,.flac,.wav,.wma,.opus";

const AudioFilePicker = ({ value, onChange, onDurationDetected, onMetadataExtracted, className = "" }: AudioFilePickerProps) => {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Fichier trop lourd (max 50 Mo)");
      return;
    }

    setUploading(true);
    setFileName(file.name);

    // Extract ID3 metadata
    const id3 = await extractID3(file, file.name);
    let durationDetected = false;
    if (id3.duration && id3.duration > 0 && onDurationDetected) {
      onDurationDetected(Math.round(id3.duration));
      durationDetected = true;
    }

    // Fallback: detect duration via HTML5 Audio element
    if (!durationDetected && onDurationDetected) {
      try {
        const objectUrl = URL.createObjectURL(file);
        const audio = new Audio();
        audio.preload = "metadata";
        audio.src = objectUrl;
        audio.addEventListener("loadedmetadata", () => {
          if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
            onDurationDetected(Math.round(audio.duration));
          }
          URL.revokeObjectURL(objectUrl);
        }, { once: true });
        audio.addEventListener("error", () => URL.revokeObjectURL(objectUrl), { once: true });
      } catch (e) {
        console.error("Audio duration fallback failed:", e);
      }
    }

    // Normalize extracted metadata
    let finalMeta = {
      title: id3.title ? cleanSongTitle(id3.title) : undefined,
      artist: id3.artist ? normalizeArtist(id3.artist) : undefined,
      album: id3.album || undefined,
      coverUrl: id3.coverUrl,
    };

    if (onMetadataExtracted) {
      onMetadataExtracted(finalMeta);
    }

    // Upload audio to storage
    const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage.from("audio").upload(path, file, {
      contentType: file.type || "audio/mpeg",
    });

    if (error) {
      toast.error("Erreur d'upload audio");
      console.error(error);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("audio").getPublicUrl(path);
    onChange(urlData.publicUrl);
    setUploading(false);
    toast.success("Fichier audio uploadé !");
  };

  const handleRemove = () => {
    onChange("");
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <span className="text-sm font-medium text-foreground block">Fichier audio local</span>

      {value && fileName && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/60 text-sm">
          <FileAudio className="w-4 h-4 text-primary shrink-0" />
          <span className="text-foreground truncate flex-1">{fileName}</span>
          <button type="button" onClick={handleRemove} className="p-0.5 rounded text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept={ACCEPTED_AUDIO} onChange={handleFileUpload} className="hidden" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        {uploading ? "Upload..." : "Choisir un fichier"}
      </button>
    </div>
  );
};

export default AudioFilePicker;
