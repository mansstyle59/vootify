import { Song } from "@/data/mockData";
import {
  encryptBlob, decryptBlob, encryptJSON, decryptJSON,
  isCryptoAvailable, isEncryptionEnabled,
} from "@/lib/cryptoCache";
import { getDeviceId } from "@/lib/deviceId";
import { saveToFilesystem, removeFromFilesystem } from "@/lib/filesystemStorage";

const DB_NAME = "music-offline-cache";
const DB_VERSION = 2;

/** Maximum offline cache: 1 GB / 300 songs */
const MAX_CACHE_BYTES = 1024 * 1024 * 1024; // 1 GB
const MAX_CACHE_SONGS = 300;
const AUDIO_STORE = "audio";
const META_STORE = "meta";
const COVER_STORE = "covers";

/** Shape of the metadata record stored in META_STORE */
interface CachedMeta {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
  streamUrl: string;
  genre: string | null;
  year: number | null;
  cachedAt: number;
  hasCover: boolean;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE);
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
      if (!db.objectStoreNames.contains(COVER_STORE)) {
        db.createObjectStore(COVER_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Check if we should encrypt */
function shouldEncrypt(): boolean {
  return isCryptoAvailable() && isEncryptionEnabled();
}

/** Get seed for encryption (device ID - always available) */
function getSeed(): string {
  return getDeviceId();
}

/** Encrypt a blob if encryption is enabled */
async function maybeEncrypt(blob: Blob): Promise<Blob> {
  if (!shouldEncrypt()) return blob;
  return encryptBlob(blob, getSeed());
}

/** Decrypt a blob if it's encrypted (detected by checking if it's a valid media blob) */
async function maybeDecryptBlob(blob: Blob, mimeType: string): Promise<Blob> {
  if (!shouldEncrypt()) return blob;
  try {
    return await decryptBlob(blob, getSeed(), mimeType);
  } catch {
    // Fallback: blob might not be encrypted (legacy data)
    return blob;
  }
}

/** Encrypt metadata if encryption is enabled */
async function maybeEncryptMeta(meta: object): Promise<object | string> {
  if (!shouldEncrypt()) return meta;
  return { _encrypted: true, _data: await encryptJSON(meta, getSeed()) };
}

/** Decrypt metadata if encrypted */
async function maybeDecryptMeta<T>(stored: any): Promise<T> {
  if (stored && stored._encrypted && stored._data) {
    try {
      return await decryptJSON<T>(stored._data, getSeed());
    } catch {
      return stored as T;
    }
  }
  return stored as T;
}

/** Compress an image blob to a smaller JPEG (max 300x300, quality 0.7) */
async function compressCover(blob: Blob, maxSize = 300, quality = 0.7): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(blob); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (result) => resolve(result || blob),
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
    img.src = url;
  });
}

/** Fetch an image URL and return it as a compressed Blob */
async function fetchCoverBlob(url: string): Promise<Blob | null> {
  try {
    let res = await fetch(url);
    if (!res.ok) {
      res = await fetch(url, { referrerPolicy: "no-referrer" });
    }
    let blob = await res.blob();
    if (blob && blob.size > 0 && blob.type !== "text/html") {
      return await compressCover(blob);
    }
    const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deezer-proxy?imageUrl=${encodeURIComponent(url)}`;
    res = await fetch(proxyUrl);
    if (res.ok) {
      blob = await res.blob();
      if (blob && blob.size > 0) {
        return await compressCover(blob);
      }
    }
    return null;
  } catch {
    return null;
  }
}

export const offlineCache = {
  /** Check if a song is cached */
  async isCached(songId: string): Promise<boolean> {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(META_STORE, "readonly");
      const store = tx.objectStore(META_STORE);
      const req = store.get(songId);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  },

  /** Get total number of cached songs */
  async getAllCachedCount(): Promise<number> {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(META_STORE, "readonly");
      const req = tx.objectStore(META_STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  },

  /** Download and cache a song's audio + metadata + cover art */
  async cacheSong(song: Song, onProgress?: (pct: number) => void): Promise<void> {
    if (!song.streamUrl) throw new Error("No stream URL");

    // Check cache limits
    try {
      const [currentSize, allCached] = await Promise.all([
        this.getCacheSize(),
        this.getAllCachedCount(),
      ]);
      if (currentSize >= MAX_CACHE_BYTES) {
        throw new Error("Limite de stockage atteinte (1 Go)");
      }
      if (allCached >= MAX_CACHE_SONGS) {
        throw new Error("Limite de 300 titres hors-ligne atteinte");
      }
    } catch (e: any) {
      if (e.message?.includes("Limite")) throw e;
    }

    const response = await fetch(song.streamUrl);
    if (!response.ok) throw new Error("Failed to fetch audio");

    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    let received = 0;
    const chunks: Uint8Array[] = [];
    const reader = response.body?.getReader();

    if (!reader) throw new Error("No readable stream");

    const coverPromise = song.coverUrl ? fetchCoverBlob(song.coverUrl) : Promise.resolve(null);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total > 0 && onProgress) {
        onProgress(Math.round((received / total) * 100));
      }
    }

    const rawAudioBlob: Blob = new Blob(chunks as unknown as BlobPart[], { type: "audio/mpeg" });
    const rawCoverBlob = await coverPromise;

    // Mirror unencrypted files to the iOS Files app ("Vootify Music" folder).
    // Runs in parallel with IndexedDB storage and never throws.
    saveToFilesystem(song, rawAudioBlob, rawCoverBlob).catch(() => {});

    // Encrypt blobs if enabled
    const audioBlob = await maybeEncrypt(rawAudioBlob);
    const coverBlob = rawCoverBlob ? await maybeEncrypt(rawCoverBlob) : null;

    const db = await openDb();

    // Store audio + cover blobs
    await new Promise<void>((resolve, reject) => {
      const stores = [AUDIO_STORE];
      if (coverBlob) stores.push(COVER_STORE);
      const tx = db.transaction(stores, "readwrite");
      tx.objectStore(AUDIO_STORE).put(audioBlob, song.id);
      if (coverBlob) {
        tx.objectStore(COVER_STORE).put(coverBlob, song.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Store metadata (encrypted if enabled)
    const meta = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      coverUrl: song.coverUrl,
      streamUrl: song.streamUrl,
      genre: song.genre || null,
      year: song.year || null,
      cachedAt: Date.now(),
      hasCover: !!coverBlob,
    };
    const storedMeta = await maybeEncryptMeta(meta);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readwrite");
      tx.objectStore(META_STORE).put(storedMeta, song.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /** Get a cached song's audio as an object URL */
  async getCachedUrl(songId: string): Promise<string | null> {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(AUDIO_STORE, "readonly");
      const req = tx.objectStore(AUDIO_STORE).get(songId);
      req.onsuccess = async () => {
        if (req.result instanceof Blob) {
          try {
            const decrypted = await maybeDecryptBlob(req.result, "audio/mpeg");
            resolve(URL.createObjectURL(decrypted));
          } catch {
            resolve(URL.createObjectURL(req.result));
          }
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  },

  /** Get a cached song's cover art as an object URL */
  async getCachedCoverUrl(songId: string): Promise<string | null> {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(COVER_STORE, "readonly");
      const req = tx.objectStore(COVER_STORE).get(songId);
      req.onsuccess = async () => {
        if (req.result instanceof Blob) {
          try {
            const decrypted = await maybeDecryptBlob(req.result, "image/jpeg");
            resolve(URL.createObjectURL(decrypted));
          } catch {
            resolve(URL.createObjectURL(req.result));
          }
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  },

  /** Get all cached songs metadata, with cover blob URLs resolved */
  async getAllCached(): Promise<(Song & { cachedAt: number })[]> {
    const db = await openDb();
    const rawMetas: any[] = await new Promise((resolve) => {
      const tx = db.transaction(META_STORE, "readonly");
      const store = tx.objectStore(META_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    // Decrypt metadata if needed
    const metas = await Promise.all(rawMetas.map((m) => maybeDecryptMeta<any>(m)));

    const songs = await Promise.all(
      metas.map(async (m: any) => {
        let coverUrl = m.coverUrl;
        try {
          const cachedCover = await offlineCache.getCachedCoverUrl(m.id);
          if (cachedCover) coverUrl = cachedCover;
        } catch {}
        return {
          id: m.id,
          title: m.title,
          artist: m.artist,
          album: m.album,
          duration: m.duration,
          coverUrl,
          streamUrl: m.streamUrl || "",
          liked: false,
          genre: m.genre || undefined,
          year: m.year || undefined,
          cachedAt: m.cachedAt,
        };
      })
    );
    return songs;
  },

  /** Remove a cached song */
  async removeCached(songId: string): Promise<void> {
    // Retrieve metadata before deleting so we can build the filesystem path
    const db = await openDb();
    let songMeta: Song | null = null;
    try {
      const raw: unknown = await new Promise((resolve) => {
        const tx = db.transaction(META_STORE, "readonly");
        const req = tx.objectStore(META_STORE).get(songId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      if (raw) {
        const meta = await maybeDecryptMeta<CachedMeta>(raw);
        if (meta) {
          songMeta = {
            id: meta.id,
            title: meta.title,
            artist: meta.artist,
            album: meta.album,
            duration: meta.duration,
            coverUrl: meta.coverUrl,
            streamUrl: meta.streamUrl || "",
            liked: false,
          };
        }
      }
    } catch {}

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([AUDIO_STORE, META_STORE, COVER_STORE], "readwrite");
      tx.objectStore(AUDIO_STORE).delete(songId);
      tx.objectStore(META_STORE).delete(songId);
      tx.objectStore(COVER_STORE).delete(songId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Remove from iOS Files app folder too (non-blocking)
    if (songMeta) {
      removeFromFilesystem(songMeta).catch(() => {});
    }
  },

  /** Get total cache size in bytes (audio + covers) */
  async getCacheSize(): Promise<number> {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction([AUDIO_STORE, COVER_STORE], "readonly");
      let total = 0;
      let pending = 2;
      const done = () => { pending--; if (pending === 0) resolve(total); };

      const audioReq = tx.objectStore(AUDIO_STORE).getAll();
      audioReq.onsuccess = () => {
        const blobs = audioReq.result || [];
        total += blobs.reduce((sum: number, b: Blob) => sum + (b.size || 0), 0);
        done();
      };
      audioReq.onerror = done;

      const coverReq = tx.objectStore(COVER_STORE).getAll();
      coverReq.onsuccess = () => {
        const blobs = coverReq.result || [];
        total += blobs.reduce((sum: number, b: Blob) => sum + (b.size || 0), 0);
        done();
      };
      coverReq.onerror = done;
    });
  },
};
