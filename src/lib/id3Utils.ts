import * as mm from "music-metadata-browser";
import { supabase } from "@/integrations/supabase/client";

export interface ID3Metadata {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  coverUrl?: string;
  year?: number;
  genre?: string;
  trackNumber?: number;
  totalTracks?: number;
  albumArtist?: string;
  composer?: string;
  bitrate?: number;
  sampleRate?: number;
  codec?: string;
}

/**
 * Common filename patterns to extract artist/title:
 *   "Artist - Title"
 *   "01 - Artist - Title"
 *   "01. Title"
 *   "Artist_-_Title"
 */
function parseFileName(fileName: string): { title?: string; artist?: string; trackNo?: number } {
  let name = fileName.split("/").pop() || fileName;
  // Remove extension
  name = name.replace(/\.[^.]+$/, "");
  // Decode URL-encoded chars
  try { name = decodeURIComponent(name); } catch {}
  // Replace underscores with spaces
  name = name.replace(/_/g, " ");
  // Collapse whitespace
  name = name.replace(/\s+/g, " ").trim();

  let trackNo: number | undefined;

  // Extract leading track number: "01 - ...", "01. ...", "01 ..."
  const trackMatch = name.match(/^(\d{1,3})[\s.\-)+]+(.+)/);
  if (trackMatch) {
    trackNo = parseInt(trackMatch[1], 10);
    name = trackMatch[2].trim();
  }

  // Try "Artist - Title" pattern (with various dash types)
  const dashMatch = name.match(/^(.+?)\s*[\-–—]\s*(.+)$/);
  if (dashMatch) {
    const left = dashMatch[1].trim();
    const right = dashMatch[2].trim();
    // If left is very short (1-2 chars) it's likely a track number fragment
    if (left.length > 2) {
      return { artist: left, title: right, trackNo };
    }
    return { title: right, trackNo };
  }

  return { title: name, trackNo };
}

/**
 * Extract ID3 metadata from an audio file.
 * Falls back to intelligent filename parsing when tags are missing.
 * If a cover image is found, it's uploaded to the covers bucket.
 */
export async function extractID3(file: File | Blob, fileName?: string): Promise<ID3Metadata> {
  const result: ID3Metadata = {};

  try {
    const metadata = await mm.parseBlob(file);
    const { common, format } = metadata;

    result.title = common.title || undefined;
    result.artist = common.artist || undefined;
    result.album = common.album || undefined;
    result.duration = format.duration ? Math.round(format.duration) : undefined;
    result.year = common.year || undefined;
    result.genre = common.genre?.[0] || undefined;
    result.trackNumber = common.track?.no || undefined;
    result.totalTracks = common.track?.of || undefined;
    result.albumArtist = common.albumartist || undefined;
    result.composer = common.composer?.[0] || undefined;
    result.bitrate = format.bitrate ? Math.round(format.bitrate / 1000) : undefined;
    result.sampleRate = format.sampleRate || undefined;
    result.codec = format.codec || undefined;

    // Extract embedded cover art
    const picture = common.picture?.[0];
    if (picture) {
      try {
        const ext = picture.format?.includes("png") ? "png" : "jpg";
        const blob = new Blob([new Uint8Array(picture.data)], { type: picture.format || "image/jpeg" });
        const path = `id3-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("covers").upload(path, blob, {
          contentType: picture.format || "image/jpeg",
        });
        if (!error) {
          const { data } = supabase.storage.from("covers").getPublicUrl(path);
          result.coverUrl = data.publicUrl;
        }
      } catch (e) {
        console.error("Cover upload failed:", e);
      }
    }
  } catch (e) {
    console.error("ID3 extraction failed:", e);
  }

  // Fallback: parse filename for missing title/artist
  if (fileName && (!result.title || !result.artist)) {
    const parsed = parseFileName(fileName);
    if (!result.title && parsed.title) result.title = parsed.title;
    if (!result.artist && parsed.artist) result.artist = parsed.artist;
    if (!result.trackNumber && parsed.trackNo) result.trackNumber = parsed.trackNo;
  }

  return result;
}

/**
 * Cross-reference a batch of extracted metadata to fill gaps.
 * e.g. if most tracks share the same album/artist, apply to all.
 */
export function crossReferenceBatch(tracks: ID3Metadata[]): ID3Metadata[] {
  if (tracks.length <= 1) return tracks;

  // Find most common album
  const albumCounts = new Map<string, number>();
  const artistCounts = new Map<string, number>();
  let sharedCover: string | undefined;
  let coverCount = 0;

  for (const t of tracks) {
    if (t.album) albumCounts.set(t.album, (albumCounts.get(t.album) || 0) + 1);
    if (t.artist) artistCounts.set(t.artist, (artistCounts.get(t.artist) || 0) + 1);
    if (t.coverUrl) { sharedCover = t.coverUrl; coverCount++; }
  }

  // If >50% share the same album, apply to all missing
  const dominantAlbum = [...albumCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const dominantArtist = [...artistCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const threshold = tracks.length * 0.5;

  return tracks.map((t) => ({
    ...t,
    album: t.album || (dominantAlbum && dominantAlbum[1] >= threshold ? dominantAlbum[0] : t.album),
    artist: t.artist || (dominantArtist && dominantArtist[1] >= threshold ? dominantArtist[0] : t.artist),
    coverUrl: t.coverUrl || (coverCount >= threshold ? sharedCover : t.coverUrl),
  }));
}
