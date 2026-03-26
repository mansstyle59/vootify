/**
 * Returns a stable device UUID for anonymous (unauthenticated) users.
 * Persisted in localStorage so custom content survives page reloads.
 */
const STORAGE_KEY = "vootify_device_id";

function generateUUID(): string {
  return crypto.randomUUID?.() ??
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
}

export function getDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/**
 * Returns the authenticated user ID if available, otherwise the device ID.
 */
export function getEffectiveUserId(authUserId: string | null | undefined): string {
  return authUserId || getDeviceId();
}
