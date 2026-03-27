/**
 * Service Worker registration guard.
 * Prevents SW from running inside iframes or development preview hosts
 * where it would cause stale content issues.
 */
export function guardServiceWorker() {
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
  }
}
