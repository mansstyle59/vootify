/**
 * Service Worker registration guard + stale module recovery.
 * 1. Prevents SW from running inside iframes or development preview hosts.
 * 2. Catches stale chunk/module errors and auto-recovers by purging caches.
 */

const RECOVERY_KEY = "sw-recovery-ts";
const RECOVERY_DONE_KEY = "sw-recovery-done";
const RECOVERY_COOLDOWN = 10_000; // 10s between auto-recoveries

export function guardServiceWorker() {
  // Show toast if we just recovered from a stale module error
  if (sessionStorage.getItem(RECOVERY_DONE_KEY)) {
    sessionStorage.removeItem(RECOVERY_DONE_KEY);
    setTimeout(() => {
      import("sonner").then(({ toast }) => {
        toast.info("Mise à jour appliquée", {
          description: "L'application a été actualisée automatiquement.",
          duration: 4000,
        });
      });
    }, 1500);
  }

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const isPreviewHost =
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes(".lovableproject.com");

  if (isPreviewHost || isInIframe) {
    navigator.serviceWorker?.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
    return;
  }

  // Install global error handler for stale module/chunk failures
  installStaleModuleRecovery();
}

/**
 * Detects dynamic import / module fetch failures (stale chunks after deploy)
 * and auto-recovers by purging SW caches then hard-reloading once.
 */
function installStaleModuleRecovery() {
  const isModuleError = (msg: string) =>
    /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|Failed to load module script/i.test(msg);

  const recover = async () => {
    // Prevent infinite reload loops: only recover once per cooldown
    const lastRecovery = Number(sessionStorage.getItem(RECOVERY_KEY) || 0);
    if (Date.now() - lastRecovery < RECOVERY_COOLDOWN) return;
    sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));

    console.warn("[SW Guard] Stale module detected — purging caches and reloading…");

    try {
      // 1. Unregister all service workers
      const regs = await navigator.serviceWorker?.getRegistrations();
      if (regs) {
        await Promise.all(regs.map((r) => r.unregister()));
      }

      // 2. Delete all Cache Storage entries (workbox precache, runtime caches)
      const cacheNames = await caches?.keys();
      if (cacheNames) {
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
    } catch (e) {
      console.error("[SW Guard] Cache cleanup error:", e);
    }

    // 3. Flag for post-reload toast, then hard reload
    sessionStorage.setItem(RECOVERY_DONE_KEY, "1");
    window.location.reload();
  };

  // Catch unhandled errors (sync module failures)
  window.addEventListener("error", (event) => {
    const msg = event.message || String(event);
    if (isModuleError(msg)) {
      event.preventDefault();
      recover();
    }
  });

  // Catch unhandled promise rejections (dynamic import failures)
  window.addEventListener("unhandledrejection", (event) => {
    const msg = event.reason?.message || String(event.reason);
    if (isModuleError(msg)) {
      event.preventDefault();
      recover();
    }
  });
}
