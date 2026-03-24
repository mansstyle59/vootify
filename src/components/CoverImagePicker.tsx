import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Link, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface CoverImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  className?: string;
}

const CoverImagePicker = ({ value, onChange, className = "" }: CoverImagePickerProps) => {
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Sélectionnez une image");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop lourde (max 5 Mo)");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage.from("covers").upload(path, file);
    if (error) {
      toast.error("Erreur d'upload");
      console.error(error);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("covers").getPublicUrl(path);
    onChange(urlData.publicUrl);
    setUploading(false);
    toast.success("Image uploadée !");
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput("");
      setShowUrlInput(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <span className="text-sm font-medium text-foreground block">Pochette / Logo</span>

      {value && (
        <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-secondary group">
          <img src={value} alt="Cover" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-1 right-1 p-1 rounded-full bg-background/70 text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? "Upload..." : "Uploader"}
        </button>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
        >
          <Link className="w-3.5 h-3.5" />
          URL
        </button>
      </div>

      {showUrlInput && (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleUrlSubmit())}
            placeholder="https://..."
            className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
            autoFocus
          />
          <button type="button" onClick={handleUrlSubmit} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium">OK</button>
        </div>
      )}
    </div>
  );
};

export default CoverImagePicker;
