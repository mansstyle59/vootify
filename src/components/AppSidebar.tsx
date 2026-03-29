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
        className="flex items-center rounded-[28px] px-1.5 py-1.5"
        style={{
          background: "linear-gradient(145deg, hsl(var(--card) / 0.55), hsl(var(--card) / 0.3))",
          backdropFilter: "blur(80px) saturate(2.4) brightness(1.08)",
          WebkitBackdropFilter: "blur(80px) saturate(2.4) brightness(1.08)",
          boxShadow: "0 8px 32px hsl(0 0% 0% / 0.35), inset 0 1px 0 hsl(var(--foreground) / 0.1), inset 0 -0.5px 0 hsl(0 0% 0% / 0.2)",
          border: "0.5px solid hsl(var(--foreground) / 0.1)",
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
                `relative flex flex-col items-center justify-center min-w-[74px] min-h-[54px] px-4 py-2 rounded-[20px] text-[10.5px] font-semibold tracking-wide transition-all duration-200 active:scale-[0.9] ${
                  restricted
                    ? "text-muted-foreground/20"
                    : isActive
                    ? "text-primary"
                    : "text-muted-foreground/50 active:text-muted-foreground/70"
                }`
              }
              style={({ isActive }: { isActive: boolean }) => ({
                background: !restricted && isActive
                  ? "linear-gradient(145deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.08))"
                  : "transparent",
                boxShadow: !restricted && isActive
                  ? "0 0 20px hsl(var(--primary) / 0.12), inset 0 0.5px 0 hsl(var(--primary) / 0.15)"
                  : "none",
                border: !restricted && isActive ? "0.5px solid hsl(var(--primary) / 0.15)" : "0.5px solid transparent",
              }) as React.CSSProperties}
            >
              {({ isActive }) => (
                <>
                  {restricted ? (
                    <Lock className="w-[21px] h-[21px] mb-1" strokeWidth={1.6} />
                  ) : (
                    <item.icon
                      className={`w-[24px] h-[24px] mb-0.5 transition-all duration-250 ${isActive ? "drop-shadow-[0_0_8px_hsl(var(--primary)/0.4)]" : ""}`}
                      strokeWidth={isActive ? 2.4 : 1.4}
                      fill={isActive ? "currentColor" : "none"}
                    />
                  )}
                  <span className={`transition-all duration-200 ${restricted ? "opacity-25" : isActive ? "font-bold tracking-wider" : "opacity-70"}`}>
                    {item.label}
                  </span>
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
          `flex items-center justify-center w-[54px] h-[54px] rounded-full transition-all duration-200 active:scale-[0.87] ${
            isActive
              ? "text-primary"
              : "text-muted-foreground/50 active:text-muted-foreground/70"
          }`
        }
        style={({ isActive }: { isActive: boolean }) => ({
          background: isActive
            ? "linear-gradient(145deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.08))"
            : "linear-gradient(145deg, hsl(var(--card) / 0.55), hsl(var(--card) / 0.3))",
          backdropFilter: "blur(80px) saturate(2.4) brightness(1.08)",
          WebkitBackdropFilter: "blur(80px) saturate(2.4) brightness(1.08)",
          boxShadow: isActive
            ? "0 8px 32px hsl(0 0% 0% / 0.35), inset 0 1px 0 hsl(var(--foreground) / 0.1), 0 0 24px hsl(var(--primary) / 0.1)"
            : "0 8px 32px hsl(0 0% 0% / 0.35), inset 0 1px 0 hsl(var(--foreground) / 0.1), inset 0 -0.5px 0 hsl(0 0% 0% / 0.2)",
          border: isActive ? "0.5px solid hsl(var(--primary) / 0.15)" : "0.5px solid hsl(var(--foreground) / 0.1)",
        }) as React.CSSProperties}
      >
        {({ isActive }) => (
          <Search
            className={`w-[24px] h-[24px] transition-all duration-250 ${isActive ? "drop-shadow-[0_0_8px_hsl(var(--primary)/0.4)]" : ""}`}
            strokeWidth={isActive ? 2.6 : 1.6}
            fill={isActive ? "currentColor" : "none"}
          />
        )}
      </RouterNavLink>

      {/* ── Admin items (small pills above if admin) ── */}
      {isAdmin && (
        <div
          className="flex items-center gap-1 rounded-full px-1 py-1"
          style={{
            background: "linear-gradient(135deg, hsl(var(--card) / 0.45), hsl(var(--card) / 0.25))",
            backdropFilter: "blur(80px) saturate(2.2) brightness(1.1)",
            WebkitBackdropFilter: "blur(80px) saturate(2.2) brightness(1.1)",
            boxShadow: "0 4px 30px hsl(0 0% 0% / 0.3), inset 0 0.5px 0 hsl(var(--foreground) / 0.1), inset 0 -0.5px 0 hsl(0 0% 0% / 0.15)",
            border: "0.5px solid hsl(var(--foreground) / 0.08)",
          }}
        >
          {adminItems.map((item) => (
            <RouterNavLink
              key={item.to}
              to={item.to}
              onTouchStart={() => handleTap(item.to)}
              className={({ isActive }) =>
                `flex items-center justify-center w-[40px] h-[40px] rounded-full transition-all duration-200 active:scale-[0.85] ${
                  isActive ? "text-primary" : "text-muted-foreground/60"
                }`
              }
              style={({ isActive }: { isActive: boolean }) => ({
                background: isActive ? "hsl(var(--primary) / 0.12)" : "transparent",
                boxShadow: isActive ? "0 0 12px hsl(var(--primary) / 0.15)" : "none",
              }) as React.CSSProperties}
            >
              {({ isActive }) => (
                <item.icon
                  className={`w-[18px] h-[18px] transition-transform duration-200 ${isActive ? "scale-110" : ""}`}
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
