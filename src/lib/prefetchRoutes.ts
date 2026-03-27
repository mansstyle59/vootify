/**
 * Prefetch lazy-loaded route chunks on user interaction hints.
 * Call once at app startup — listens for link hovers/touches
 * and eagerly loads the matching route chunk.
 */

const routeImports: Record<string, () => Promise<unknown>> = {
  "/": () => import("@/pages/Home"),
  "/search": () => import("@/pages/SearchPage"),
  "/library": () => import("@/pages/LibraryPage"),
  "/radio": () => import("@/pages/RadioPage"),
  "/add": () => import("@/pages/AddContentPage"),
  "/auth": () => import("@/pages/AuthPage"),
  "/profile": () => import("@/pages/ProfilePage"),
  "/admin": () => import("@/pages/AdminPage"),
};

const prefetched = new Set<string>();

function prefetchRoute(path: string) {
  const base = "/" + (path.split("/").filter(Boolean)[0] || "");
  const key = base === "/" ? "/" : base;
  if (prefetched.has(key)) return;
  const loader = routeImports[key];
  if (loader) {
    prefetched.add(key);
    loader().catch(() => {
      prefetched.delete(key);
    });
  }
}

export function initRoutePrefetch() {
  // Prefetch on pointer enter (hover) and touch start
  document.addEventListener(
    "pointerenter",
    (e) => {
      const anchor = (e.target as HTMLElement).closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (href?.startsWith("/")) prefetchRoute(href);
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    "touchstart",
    (e) => {
      const anchor = (e.target as HTMLElement).closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (href?.startsWith("/")) prefetchRoute(href);
    },
    { capture: true, passive: true }
  );

  // Prefetch all main navigation routes immediately on idle
  const prefetchAll = () => {
    prefetchRoute("/");
    prefetchRoute("/search");
    prefetchRoute("/library");
    prefetchRoute("/radio");
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(prefetchAll, { timeout: 1500 });
  } else {
    setTimeout(prefetchAll, 1000);
  }
}
