import { Song } from "@/data/mockData";

const DB_NAME = "music-offline-cache";
const DB_VERSION = 1;
const AUDIO_STORE = "audio";
const META_STORE = "meta";

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
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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

  /** Download and cache a song's audio + metadata */
  async cacheSong(song: Song, onProgress?: (pct: number) => void): Promise<void> {
    if (!song.streamUrl) throw new Error("No stream URL");

    const response = await fetch(song.streamUrl);
    if (!response.ok) throw new Error("Failed to fetch audio");

    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    let received = 0;
    const chunks: Uint8Array[] = [];
    const reader = response.body?.getReader();

    if (!reader) throw new Error("No readable stream");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total > 0 && onProgress) {
        onProgress(Math.round((received / total) * 100));
      }
    }

    const blob = new Blob(chunks as unknown as BlobPart[], { type: "audio/mpeg" });
    const db = await openDb();

    // Store audio blob
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readwrite");
      tx.objectStore(AUDIO_STORE).put(blob, song.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Store metadata
    const meta = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      coverUrl: song.coverUrl,
      streamUrl: song.streamUrl,
      cachedAt: Date.now(),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readwrite");
      tx.objectStore(META_STORE).put(meta, song.id);
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
      req.onsuccess = () => {
        if (req.result instanceof Blob) {
          resolve(URL.createObjectURL(req.result));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  },

  /** Get all cached songs metadata */
  async getAllCached(): Promise<(Song & { cachedAt: number })[]> {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(META_STORE, "readonly");
      const store = tx.objectStore(META_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const metas = req.result || [];
        resolve(
          metas.map((m: any) => ({
            id: m.id,
            title: m.title,
            artist: m.artist,
            album: m.album,
            duration: m.duration,
            coverUrl: m.coverUrl,
            streamUrl: "", // will be resolved from cache
            liked: false,
            cachedAt: m.cachedAt,
          }))
        );
      };
      req.onerror = () => resolve([]);
    });
  },

  /** Remove a cached song */
  async removeCached(songId: string): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([AUDIO_STORE, META_STORE], "readwrite");
      tx.objectStore(AUDIO_STORE).delete(songId);
      tx.objectStore(META_STORE).delete(songId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /** Get total cache size in bytes */
  async getCacheSize(): Promise<number> {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(AUDIO_STORE, "readonly");
      const store = tx.objectStore(AUDIO_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const blobs = req.result || [];
        const total = blobs.reduce((sum: number, b: Blob) => sum + (b.size || 0), 0);
        resolve(total);
      };
      req.onerror = () => resolve(0);
    });
  },
};
