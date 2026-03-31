/**
 * AES-256-GCM encryption for offline cache data.
 * Key is derived from a user-specific seed using PBKDF2.
 * The encryption key is cached in memory for the session.
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM
const SALT_KEY = "vootify-crypto-salt";
const PBKDF2_ITERATIONS = 100_000;

let cachedKey: CryptoKey | null = null;
let cachedSeed: string | null = null;

/** Get or create a persistent salt stored in localStorage */
function getSalt(): Uint8Array {
  let b64 = localStorage.getItem(SALT_KEY);
  if (!b64) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    b64 = btoa(String.fromCharCode(...salt));
    localStorage.setItem(SALT_KEY, b64);
  }
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Derive an AES key from a seed string (user ID or device ID) */
async function deriveKey(seed: string): Promise<CryptoKey> {
  if (cachedKey && cachedSeed === seed) return cachedKey;

  const enc = new TextEncoder();
  const rawBytes = enc.encode(seed);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    rawBytes.buffer as ArrayBuffer,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: getSalt(), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );

  cachedKey = key;
  cachedSeed = seed;
  return key;
}

/** Encrypt a Blob → returns encrypted Blob (IV prepended) */
export async function encryptBlob(blob: Blob, seed: string): Promise<Blob> {
  const key = await deriveKey(seed);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const data = new Uint8Array(await blob.arrayBuffer());
  const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, data);
  // Prepend IV to ciphertext
  const result = new Uint8Array(IV_LENGTH + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), IV_LENGTH);
  return new Blob([result]);
}

/** Decrypt a Blob (IV prepended) → returns original Blob */
export async function decryptBlob(blob: Blob, seed: string, mimeType = "application/octet-stream"): Promise<Blob> {
  const key = await deriveKey(seed);
  const data = new Uint8Array(await blob.arrayBuffer());
  const iv = data.slice(0, IV_LENGTH);
  const ciphertext = data.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);
  return new Blob([decrypted], { type: mimeType });
}

/** Encrypt a JSON-serializable object → returns encrypted string (base64) */
export async function encryptJSON(obj: unknown, seed: string): Promise<string> {
  const blob = new Blob([JSON.stringify(obj)]);
  const encrypted = await encryptBlob(blob, seed);
  const buf = await encrypted.arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/** Decrypt a base64 encrypted string → returns parsed JSON */
export async function decryptJSON<T = unknown>(encoded: string, seed: string): Promise<T> {
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes]);
  const decrypted = await decryptBlob(blob, seed, "application/json");
  const text = await decrypted.text();
  return JSON.parse(text);
}

/** Check if Web Crypto API is available */
export function isCryptoAvailable(): boolean {
  return typeof crypto !== "undefined" && !!crypto.subtle;
}

/** Clear the cached key (call on logout) */
export function clearCryptoKey(): void {
  cachedKey = null;
  cachedSeed = null;
}

/** Check if encryption is enabled */
export function isEncryptionEnabled(): boolean {
  return localStorage.getItem("vootify-encryption-enabled") === "true";
}

/** Toggle encryption on/off */
export function setEncryptionEnabled(enabled: boolean): void {
  localStorage.setItem("vootify-encryption-enabled", enabled ? "true" : "false");
}
