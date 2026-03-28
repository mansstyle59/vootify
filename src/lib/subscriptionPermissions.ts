/**
 * Subscription-based access control.
 * Plans: premium (lowest) → gold → vip (full access).
 * Admins always bypass all restrictions.
 */

export type PlanType = "premium" | "gold" | "vip" | "free";

export type LibraryTab = "liked" | "playlists" | "recent" | "downloads" | "custom" | "albums" | "artists";

interface PlanPermissions {
  allowedRoutes: string[];        // routes the plan can access
  blockedRoutes: string[];        // explicitly blocked
  allowedLibraryTabs: LibraryTab[];
  label: string;
  color: string;                  // tailwind color token
  icon: "crown" | "star" | "gem";
}

const PLAN_CONFIG: Record<PlanType, PlanPermissions> = {
  free: {
    allowedRoutes: ["/", "/auth", "/reset-password", "/request-access", "/profile"],
    blockedRoutes: ["/search", "/radio", "/library", "/add", "/admin"],
    allowedLibraryTabs: [],
    label: "Free",
    color: "muted-foreground",
    icon: "star",
  },
  premium: {
    allowedRoutes: ["/", "/library", "/profile", "/audio-settings", "/auth", "/reset-password", "/request-access"],
    blockedRoutes: ["/search", "/radio"],
    allowedLibraryTabs: ["artists", "albums"],
    label: "Premium",
    color: "primary",
    icon: "crown",
  },
  gold: {
    allowedRoutes: ["/", "/search", "/library", "/profile", "/audio-settings", "/auth", "/reset-password", "/request-access", "/add", "/admin"],
    blockedRoutes: ["/radio"],
    allowedLibraryTabs: ["liked", "playlists", "recent", "downloads", "custom", "albums", "artists"],
    label: "Gold",
    color: "yellow-500",
    icon: "star",
  },
  vip: {
    allowedRoutes: ["*"],
    blockedRoutes: [],
    allowedLibraryTabs: ["liked", "playlists", "recent", "downloads", "custom", "albums", "artists"],
    label: "VIP",
    color: "red-500",
    icon: "gem",
  },
};

export function getPlanConfig(plan: PlanType): PlanPermissions {
  return PLAN_CONFIG[plan] || PLAN_CONFIG.free;
}

export function normalizePlan(raw: string | null | undefined): PlanType {
  if (!raw) return "free";
  const lower = raw.toLowerCase().trim();
  if (lower === "vip") return "vip";
  if (lower === "gold") return "gold";
  if (lower === "premium") return "premium";
  return "free";
}

/**
 * Check if a route is accessible for a given plan.
 * Dynamic routes like /playlist/:id, /album/:id, /artist/:name follow base route rules.
 */
export function canAccessRoute(plan: PlanType, pathname: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;

  const config = getPlanConfig(plan);
  if (config.allowedRoutes.includes("*")) return true;

  // Map dynamic routes to their base
  const base = getBaseRoute(pathname);

  // Always allow auth-related routes
  const publicRoutes = ["/auth", "/reset-password", "/request-access", "/profile", "/audio-settings"];
  if (publicRoutes.includes(base)) return true;

  // Check blocked first
  if (config.blockedRoutes.includes(base)) return false;

  // Check allowed
  return config.allowedRoutes.includes(base);
}

export function canAccessLibraryTab(plan: PlanType, tab: LibraryTab, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  const config = getPlanConfig(plan);
  return config.allowedLibraryTabs.includes(tab);
}

export function getUpgradeMessage(plan: PlanType, feature: string): string {
  const next = plan === "premium" ? "Gold" : plan === "gold" ? "VIP" : "un abonnement";
  return `${feature} est réservé aux abonnés ${next}. Mettez à niveau pour y accéder.`;
}

function getBaseRoute(pathname: string): string {
  if (pathname === "/") return "/";
  // /playlist/xxx → /library context (allowed if library is allowed)
  if (pathname.startsWith("/playlist/")) return "/library";
  if (pathname.startsWith("/album/")) return "/library";
  if (pathname.startsWith("/artist/")) return "/library";
  if (pathname.startsWith("/genre/")) return "/search";
  // Return first segment
  const match = pathname.match(/^\/[^/]*/);
  return match ? match[0] : pathname;
}

/** Which nav items should be visually restricted */
export function isNavRestricted(plan: PlanType, route: string, isAdmin: boolean): boolean {
  return !canAccessRoute(plan, route, isAdmin);
}
