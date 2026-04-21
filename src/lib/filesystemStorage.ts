/**
 * Web-native "Save to iPhone Files" utility.
 *
 * Works entirely through standard browser APIs — no Xcode, no native build,
 * no Capacitor Filesystem plugin required.
 *
 * Strategy (iOS Safari / PWA):
 *   1. Try the Web Share API (navigator.share with files) — available on
 *      iOS 15 + and Android Chrome. Opens the system share sheet where the
 *      user can choose "Save to Files".
 *   2. Fall back to a programmatic <a download> click — iOS Safari shows a
 *      "Download" prompt that lands in Files → On My iPhone.
 *   3. If neither works, return a descriptive status so the caller can react.
 */

import type { Song } from "@/data/mockData";
import { offlineCache } from "@/lib/offlineCache";

/** Sanitize a string so it is safe as a file name */
function safeName(str: string): string {
  return str
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

/** Build a human-readable audio file name for a song */
function audioFileName(song: Song): string {
  return `${safeName(song.artist)}_-_${safeName(song.title)}.mp3`;
}

export type SaveToFilesResult = "saved" | "cancelled" | "not_cached" | "error";

/**
 * Save the cached audio for a song to the iPhone Files app using only
 * web APIs (Web Share API or <a download> fallback).
 *
 * Returns:
 *   "saved"       — the share sheet / download was triggered successfully
 *   "cancelled"   — the user dismissed the share sheet (AbortError)
 *   "not_cached"  — the song is not in IndexedDB yet
 *   "error"       — an unexpected error occurred
 */
export async function saveToiPhoneFiles(song: Song): Promise<SaveToFilesResult> {
  // 1. Read the audio blob from IndexedDB
  const audioUrl = await offlineCache.getCachedUrl(song.id);
  if (!audioUrl) return "not_cached";

  try {
    const audioResp = await fetch(audioUrl);
    const audioBlob = await audioResp.blob();
    const audioFile = new File(
      [audioBlob],
      audioFileName(song),
      { type: "audio/mpeg" }
    );

    // 2. Try Web Share API (iOS 15+, Android Chrome 86+)
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [audioFile] })
    ) {
      await navigator.share({ files: [audioFile], title: `${song.artist} – ${song.title}` });
      return "saved";
    }

    // 3. Fallback: programmatic <a download> — iOS Safari saves to Files
    const link = document.createElement("a");
    link.href = URL.createObjectURL(audioBlob);
    link.download = audioFileName(song);
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    // Clean up after a short delay
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      document.body.removeChild(link);
    }, 2000);
    return "saved";
  } catch (e: unknown) {
    // User cancelled the share sheet — not a real error
    if (e instanceof Error && e.name === "AbortError") return "cancelled";
    console.warn("[filesystemStorage] saveToiPhoneFiles failed:", e);
    return "error";
  } finally {
    // Revoke the object URL created by getCachedUrl
    URL.revokeObjectURL(audioUrl);
  }
}

/**
 * Returns true if the current platform supports saving files
 * (Web Share API with files, or the <a download> fallback).
 * Always true in modern browsers; used to conditionally show the UI button.
 */
export function canSaveToFiles(): boolean {
  if (typeof navigator === "undefined") return false;
  // Web Share API with files supported
  if (typeof navigator.share === "function") return true;
  // <a download> works on every desktop and mobile browser
  return typeof document !== "undefined";
}


