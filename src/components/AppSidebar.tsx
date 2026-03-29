import { NavLink as RouterNavLink, useNavigate } from "react-router-dom";
import {
  Home, Search, Library, Radio, PlusCircle, LogOut, Shield, Lock,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAuth } from "@/hooks/useAuth";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useCallback } from "react";

const navItems = [
  { to: "/", icon: Home, label: "Accueil" },
  { to: "/search", icon: Search, label: "Recherche" },
  { to: "/library", icon: Library, label: "Bibliothèque" },
  { to: "/radio", icon: Radio, label: "Radio" },
];

const adminItems = [
  { to: "/add", icon: PlusCircle, label: "Ajouter" },
  { to: "/admin", icon: Shield, label: "Admin" },
];

const routeImports: Record<string, () => Promise<unknown>> = {
  "/": () => import("@/pages/Home"),
  "/search": () => import("@/pages/SearchPage"),
  "/library": () => import("@/pages/LibraryPage"),
  "/radio": () => import("@/pages/RadioPage"),
  "/add": () => import("@/pages/AddContentPage"),
  "/admin": () => import("@/pages/AdminPage"),
};

const prefetched = new Set<string>();

function prefetchRoute(to: string) {
  if (prefetched.has(to)) return;
  const loader = routeImports[to];
  if (loader) {
    prefetched.add(to);
    loader();
  }
}

/* ═══════════════════ Desktop Sidebar ═══════════════════ */

export function AppSidebar() {
  const { isAdmin } = useAdminAuth();
  const { user, signOut } = useAuth();
  const { checkRoute } = useSubscriptionAccess();
  const navigate = useNavigate();
  const items = isAdmin ? [...navItems, ...adminItems] : navItems;

  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0];
  const avatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <aside className="hidden md:flex flex-col w-[240px] min-h-screen bg-card/80 backdrop-blur-xl border-r border-border/50 p-4">
      <div className="mb-8 px-2 flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold gradient-text-primary">
          Vootify
        </h1>
        <NotificationBell />
      </div>

      <nav className="flex flex-col gap-0.5 flex-1">
        {items.map((item) => {
          const restricted = !checkRoute(item.to);
          return (
            <RouterNavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onMouseEnter={() => prefetchRoute(item.to)}
              onTouchStart={() => prefetchRoute(item.to)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  restricted
                    ? "text-muted-foreground/40 hover:text-muted-foreground/50"
                    : isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className="w-5 h-5"
                    strokeWidth={isActive && !restricted ? 2.4 : 1.6}
                    fill={isActive && !restricted ? "currentColor" : "none"}
                  />
                  <span className="flex-1">{item.label}</span>
                  {restricted && (
                    <Lock className="w-3.5 h-3.5 text-muted-foreground/30" />
                  )}
                </>
              )}
            </RouterNavLink>
          );
        })}
      </nav>

      {user && (
        <div className="mt-auto pt-4 border-t border-border/50">
          <div className="flex items-center gap-3 px-2">
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
            >
              <Avatar className="w-8 h-8">
                <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                <AvatarFallback className="text-xs font-semibold bg-primary/20 text-primary">
                  {(displayName || "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate">
                    {displayName}
                  </p>
                  {isAdmin && (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 h-4 border-primary/40 text-primary bg-primary/10 font-semibold shrink-0"
                    >
                      Admin
                    </Badge>
                  )}
                </div>
              </div>
            </button>
            <button
              onClick={() => signOut()}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

/* ═══════════════════ Mobile Tab Bar ═══════════════════ */

const pillItems = [
  { to: "/", icon: Home, label: "Accueil" },
  { to: "/radio", icon: Radio, label: "Radio" },
  { to: "/library", icon: Library, label: "Bibliothèque" },
];

export function MobileNav() {
  const { isAdmin } = useAdminAuth();
  const { checkRoute } = useSubscriptionAccess();

  const handleTap = useCallback((to: string) => {
    prefetchRoute(to);
    if (navigator.vibrate) navigator.vibrate(5);
  }, []);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center gap-2.5 px-4 py-2"
      style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
    >
      {/* ── Main pill ── */}
      <div
        className="flex items-center rounded-[28px] px-1 py-1"
        style={{
          background: "hsl(var(--card) / 0.85)",
          backdropFilter: "blur(40px) saturate(1.8)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
          boxShadow: "0 2px 20px hsl(0 0% 0% / 0.35), inset 0 0.5px 0 hsl(var(--foreground) / 0.06)",
        }}
      >
        {pillItems.map((item) => {
          const restricted = !checkRoute(item.to);
          return (
            <RouterNavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onTouchStart={() => handleTap(item.to)}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center min-w-[72px] min-h-[52px] px-4 py-1.5 rounded-[22px] text-[11px] font-semibold transition-all duration-200 ${
                  restricted
                    ? "text-muted-foreground/20"
                    : isActive
                    ? "bg-secondary/80 text-primary"
                    : "text-muted-foreground/60 active:text-muted-foreground/80"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {restricted ? (
                    <Lock className="w-[22px] h-[22px] mb-0.5" strokeWidth={1.5} />
                  ) : (
                    <item.icon
                      className="w-[22px] h-[22px] mb-0.5"
                      strokeWidth={isActive ? 2 : 1.5}
                      fill={isActive ? "currentColor" : "none"}
                    />
                  )}
                  <span className={restricted ? "opacity-25" : ""}>{item.label}</span>
                </>
              )}
            </RouterNavLink>
          );
        })}
      </div>

      {/* ── Search circle ── */}
      <RouterNavLink
        to="/search"
        onTouchStart={() => handleTap("/search")}
        className={({ isActive }) =>
          `flex items-center justify-center w-[52px] h-[52px] rounded-full transition-all duration-200 ${
            isActive
              ? "text-primary"
              : "text-muted-foreground/60 active:text-muted-foreground/80"
          }`
        }
        style={{
          background: "hsl(var(--card) / 0.85)",
          backdropFilter: "blur(40px) saturate(1.8)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
          boxShadow: "0 2px 20px hsl(0 0% 0% / 0.35), inset 0 0.5px 0 hsl(var(--foreground) / 0.06)",
        }}
      >
        {({ isActive }) => (
          <Search
            className="w-[22px] h-[22px]"
            strokeWidth={isActive ? 2.4 : 1.8}
            fill={isActive ? "currentColor" : "none"}
          />
        )}
      </RouterNavLink>

      {/* ── Admin items (small pills above if admin) ── */}
      {isAdmin && (
        <div
          className="flex items-center gap-1 rounded-full px-1 py-1"
          style={{
            background: "hsl(var(--card) / 0.85)",
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
            boxShadow: "0 2px 20px hsl(0 0% 0% / 0.35), inset 0 0.5px 0 hsl(var(--foreground) / 0.06)",
          }}
        >
          {adminItems.map((item) => (
            <RouterNavLink
              key={item.to}
              to={item.to}
              onTouchStart={() => handleTap(item.to)}
              className={({ isActive }) =>
                `flex items-center justify-center w-[40px] h-[40px] rounded-full transition-all duration-200 ${
                  isActive ? "bg-secondary/80 text-primary" : "text-muted-foreground/60"
                }`
              }
            >
              {({ isActive }) => (
                <item.icon
                  className="w-[18px] h-[18px]"
                  strokeWidth={isActive ? 2.2 : 1.5}
                  fill={isActive ? "currentColor" : "none"}
                />
              )}
            </RouterNavLink>
          ))}
        </div>
      )}
    </nav>
  );
}
