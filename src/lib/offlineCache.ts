import { Song } from "@/data/mockData";

const DB_NAME = "music-offline-cache";
const DB_VERSION = 2;

/** Maximum offline cache size: ~1 TB (smart limit for large libraries) */
const MAX_CACHE_BYTES = 1024 * 1024 * 1024; // 1 GB
const AUDIO_STORE = "audio";
const META_STORE = "meta";
const COVER_STORE = "covers";

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

/** Fetch an image URL and return it as a Blob */
async function fetchCoverBlob(url: string): Promise<Blob | null> {
  try {
    // Try with CORS first, fall back to no-cors
    let res = await fetch(url);
    if (!res.ok) {
      res = await fetch(url, { mode: "no-cors" });
    }
    const blob = await res.blob();
    // Ensure we got a real image (no-cors gives opaque responses with size 0)
    return blob.size > 0 ? blob : null;
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

  /** Download and cache a song's audio + metadata + cover art */
  async cacheSong(song: Song, onProgress?: (pct: number) => void): Promise<void> {
    if (!song.streamUrl) throw new Error("No stream URL");

    // Check cache size limit
    try {
      const currentSize = await this.getCacheSize();
      if (currentSize >= MAX_CACHE_BYTES) {
        throw new Error("Cache limit reached (1 TB)");
      }
    } catch (e: any) {
      if (e.message?.includes("Cache limit")) throw e;
    }

    const response = await fetch(song.streamUrl);
    if (!response.ok) throw new Error("Failed to fetch audio");

    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    let received = 0;
    const chunks: Uint8Array[] = [];
    const reader = response.body?.getReader();

    if (!reader) throw new Error("No readable stream");

    // Download cover in parallel with audio
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

    const audioBlob = new Blob(chunks as unknown as BlobPart[], { type: "audio/mpeg" });
    const coverBlob = await coverPromise;
    const db = await openDb();

    // Store audio blob
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

  /** Get a cached song's cover art as an object URL */
  async getCachedCoverUrl(songId: string): Promise<string | null> {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(COVER_STORE, "readonly");
      const req = tx.objectStore(COVER_STORE).get(songId);
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

  /** Get all cached songs metadata, with cover blob URLs resolved */
  async getAllCached(): Promise<(Song & { cachedAt: number })[]> {
    const db = await openDb();
    const metas: any[] = await new Promise((resolve) => {
      const tx = db.transaction(META_STORE, "readonly");
      const store = tx.objectStore(META_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    // Resolve cover blob URLs for each cached song
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
          cachedAt: m.cachedAt,
        };
      })
    );
    return songs;
  },

  /** Remove a cached song */
  async removeCached(songId: string): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([AUDIO_STORE, META_STORE, COVER_STORE], "readwrite");
      tx.objectStore(AUDIO_STORE).delete(songId);
      tx.objectStore(META_STORE).delete(songId);
      tx.objectStore(COVER_STORE).delete(songId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
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
