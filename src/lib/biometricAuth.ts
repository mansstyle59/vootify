/**
 * Biometric authentication using the Credential Management API.
 * On iOS (Face ID) and Android (fingerprint/face), the browser
 * prompts biometric verification before returning stored credentials.
 */

const BIOMETRIC_KEY = "vootify_biometric_enabled";

/** Check if the device supports credential management with biometric */
export function isBiometricAvailable(): boolean {
  // PasswordCredential is supported in most modern browsers
  // On iOS Safari PWA, credential access triggers Face ID automatically
  return (
    "credentials" in navigator &&
    typeof (window as any).PasswordCredential === "function"
  );
}

/** Check if the user has enabled biometric login */
export function isBiometricEnabled(): boolean {
  try {
    return localStorage.getItem(BIOMETRIC_KEY) === "true";
  } catch {
    return false;
  }
}

/** Store credentials for biometric login */
export async function enableBiometric(email: string, password: string): Promise<boolean> {
  if (!isBiometricAvailable()) return false;

  try {
    const cred = new (window as any).PasswordCredential({
      id: email,
      password: password,
      name: "Vootify",
    });

    await navigator.credentials.store(cred);
    localStorage.setItem(BIOMETRIC_KEY, "true");
    return true;
  } catch (e) {
    console.warn("[biometric] Failed to store credential:", e);
    return false;
  }
}

/** Retrieve stored credentials (triggers biometric prompt on supported devices) */
export async function getBiometricCredential(): Promise<{ email: string; password: string } | null> {
  if (!isBiometricAvailable() || !isBiometricEnabled()) return null;

  try {
    const cred = await navigator.credentials.get({
      password: true,
      mediation: "optional", // "optional" = use biometric if available, silent otherwise
    } as any);

    if (cred && cred.type === "password") {
      const pwCred = cred as any;
      return {
        email: pwCred.id,
        password: pwCred.password,
      };
    }
    return null;
  } catch (e) {
    console.warn("[biometric] Failed to get credential:", e);
    return null;
  }
}

/** Disable biometric login */
export function disableBiometric(): void {
  try {
    localStorage.removeItem(BIOMETRIC_KEY);
    // Prevent auto-sign-in for this origin
    if ("credentials" in navigator && navigator.credentials.preventSilentAccess) {
      navigator.credentials.preventSilentAccess();
    }
  } catch {}
}
