/**
 * Capacitor Filesystem storage for iOS offline music files.
 *
 * Saves audio tracks and cover images to the app's Documents directory
 * under a "Vootify Music" folder.  This folder appears in the iPhone's
 * Files app (Files → On My iPhone → Vootify → Vootify Music) when the app
 * is built with UIFileSharingEnabled in its Info.plist.
 *
 * On non-Capacitor platforms (web/PWA) every method is a no-op so the rest
 * of the codebase works unchanged.
 */

import type { Song } from "@/data/mockData";

const MUSIC_FOLDER = "Vootify Music";
const AUDIO_SUBFOLDER = `${MUSIC_FOLDER}/Audio`;
const COVERS_SUBFOLDER = `${MUSIC_FOLDER}/Covers`;

type CapFilesystem = typeof import("@capacitor/filesystem").Filesystem;
type CapDirectory = typeof import("@capacitor/filesystem").Directory;

let _Filesystem: CapFilesystem | null = null;
let _Directory: CapDirectory | null = null;
let _initialized = false;

/**
 * Lazily import the Capacitor Filesystem plugin.
 * Returns null on web/PWA where the plugin is not available.
 */
async function getFilesystem(): Promise<{ Filesystem: CapFilesystem; Directory: CapDirectory } | null> {
  if (_initialized) {
    return _Filesystem && _Directory ? { Filesystem: _Filesystem, Directory: _Directory } : null;
  }
  _initialized = true;
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    // Verify we are actually on a native Capacitor platform
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return null;
    _Filesystem = Filesystem;
    _Directory = Directory;
    return { Filesystem, Directory };
  } catch {
    return null;
  }
}

/** Convert a Blob to a base64 string (without the data: prefix) */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip "data:<mime>;base64," prefix
      const commaIdx = result.indexOf(",");
      if (commaIdx === -1) {
        reject(new Error("FileReader did not return a valid data URL"));
        return;
      }
      resolve(result.slice(commaIdx + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Sanitize a string so it's safe to use as a file-system path component */
function safeName(str: string): string {
  return str
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

/** Build the audio file path for a song */
function audioPath(song: Song): string {
  const name = safeName(`${song.artist}_-_${song.title}`);
  return `${AUDIO_SUBFOLDER}/${name}_${song.id.slice(0, 8)}.mp3`;
}

/** Build the cover image file path for a song */
function coverPath(song: Song): string {
  const name = safeName(`${song.artist}_-_${song.title}`);
  return `${COVERS_SUBFOLDER}/${name}_${song.id.slice(0, 8)}.jpg`;
}

/** Ensure the Vootify Music sub-directories exist */
async function ensureFolders(Filesystem: CapFilesystem, Directory: CapDirectory): Promise<void> {
  for (const dir of [MUSIC_FOLDER, AUDIO_SUBFOLDER, COVERS_SUBFOLDER]) {
    try {
      await Filesystem.mkdir({ path: dir, directory: Directory.Documents, recursive: true });
    } catch {
      // Directory probably already exists — ignore
    }
  }
}

/**
 * Save an audio blob and optional cover blob to the iOS Files app folder.
 * No-op on web/PWA.
 */
export async function saveToFilesystem(
  song: Song,
  audioBlob: Blob,
  coverBlob: Blob | null,
): Promise<void> {
  const cap = await getFilesystem();
  if (!cap) return;
  const { Filesystem, Directory } = cap;

  try {
    await ensureFolders(Filesystem, Directory);

    // Save audio file
    const audioData = await blobToBase64(audioBlob);
    await Filesystem.writeFile({
      path: audioPath(song),
      data: audioData,
      directory: Directory.Documents,
    });

    // Save cover image if available
    if (coverBlob) {
      const coverData = await blobToBase64(coverBlob);
      await Filesystem.writeFile({
        path: coverPath(song),
        data: coverData,
        directory: Directory.Documents,
      });
    }
  } catch (e) {
    console.warn("[filesystemStorage] Failed to save to filesystem:", e);
  }
}

/**
 * Remove a song's audio and cover files from the iOS Files app folder.
 * No-op on web/PWA.
 */
export async function removeFromFilesystem(song: Song): Promise<void> {
  const cap = await getFilesystem();
  if (!cap) return;
  const { Filesystem, Directory } = cap;

  try {
    await Filesystem.deleteFile({ path: audioPath(song), directory: Directory.Documents }).catch(() => {});
    await Filesystem.deleteFile({ path: coverPath(song), directory: Directory.Documents }).catch(() => {});
  } catch (e) {
    console.warn("[filesystemStorage] Failed to remove from filesystem:", e);
  }
}

/**
 * Check whether the "Vootify Music" folder is accessible.
 * Useful as a health check when the app starts.
 * Returns false on web/PWA.
 */
export async function isFilesystemAvailable(): Promise<boolean> {
  const cap = await getFilesystem();
  if (!cap) return false;
  const { Filesystem, Directory } = cap;
  try {
    await ensureFolders(Filesystem, Directory);
    return true;
  } catch {
    return false;
  }
}
