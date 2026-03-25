import * as mm from "music-metadata-browser";
import { supabase } from "@/integrations/supabase/client";

export interface ID3Metadata {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  coverUrl?: string;
  year?: number;
}

/**
 * Extract ID3 metadata from an audio file.
 * If a cover image is found, it's uploaded to the covers bucket.
 */
export async function extractID3(file: File | Blob, fileName?: string): Promise<ID3Metadata> {
  try {
    const metadata = await mm.parseBlob(file);
    const { common, format } = metadata;

    let coverUrl: string | undefined;

    // Extract embedded cover art
    const picture = common.picture?.[0];
    if (picture) {
      try {
        const ext = picture.format?.includes("png") ? "png" : "jpg";
        const blob = new Blob([picture.data], { type: picture.format || "image/jpeg" });
        const path = `id3-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("covers").upload(path, blob, {
          contentType: picture.format || "image/jpeg",
        });
        if (!error) {
          const { data } = supabase.storage.from("covers").getPublicUrl(path);
          coverUrl = data.publicUrl;
        }
      } catch (e) {
        console.error("Cover upload failed:", e);
      }
    }

    return {
      title: common.title || undefined,
      artist: common.artist || undefined,
      album: common.album || undefined,
      duration: format.duration ? Math.round(format.duration) : undefined,
      year: common.year || undefined,
      coverUrl,
    };
  } catch (e) {
    console.error("ID3 extraction failed:", e);
    return {};
  }
}
