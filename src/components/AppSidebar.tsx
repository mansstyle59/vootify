import { NavLink as RouterNavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Search, Library, Radio, PlusCircle, LogOut, Shield, Lock } from "lucide-react";
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

// Route → lazy chunk mapping for prefetch
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

export function AppSidebar() {
  const { isAdmin } = useAdminAuth();
  const { user, signOut } = useAuth();
  const { checkRoute } = useSubscriptionAccess();
  const navigate = useNavigate();
  const items = isAdmin ? [...navItems, ...adminItems] : navItems;

  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0];
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <aside className="hidden md:flex flex-col w-[240px] min-h-screen bg-card/80 backdrop-blur-xl border-r border-border/50 p-4">
      <div className="mb-8 px-2 flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold gradient-text-primary">
          Vootify
        </h1>
        <NotificationBell />
      </div>

      <nav className="flex flex-col gap-1 flex-1">
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
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  restricted
                    ? "text-muted-foreground/40 hover:text-muted-foreground/50"
                    : isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1">{item.label}</span>
              {restricted && <Lock className="w-3.5 h-3.5 text-muted-foreground/30" />}
            </RouterNavLink>
          );
        })}
      </nav>

      {user && (
        <div className="mt-auto pt-4 border-t border-border/50">
          <div className="flex items-center gap-3 px-2">
            <button onClick={() => navigate("/profile")} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
              <Avatar className="w-8 h-8">
                <AvatarImage src={avatarUrl} alt={displayName || "User"} />
                <AvatarFallback className="text-xs font-semibold bg-primary/20 text-primary">
                  {(displayName || "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                  {isAdmin && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/40 text-primary bg-primary/10 font-semibold shrink-0">
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

export function MobileNav() {
  const { isAdmin } = useAdminAuth();
  const { checkRoute } = useSubscriptionAccess();
  const items = isAdmin ? [...navItems, ...adminItems] : navItems;

  const handleTap = useCallback((to: string) => {
    prefetchRoute(to);
    if (navigator.vibrate) navigator.vibrate(5);
  }, []);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-2"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "hsl(var(--background) / 0.65)",
        backdropFilter: "blur(60px) saturate(2)",
        WebkitBackdropFilter: "blur(60px) saturate(2)",
        boxShadow: "0 -4px 30px hsl(0 0% 0% / 0.25), inset 0 1px 0 hsl(var(--border) / 0.15)",
      }}
    >
      <div className="flex justify-around py-2">
        {items.map((item) => {
          const restricted = !checkRoute(item.to);
          return (
            <RouterNavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onTouchStart={() => handleTap(item.to)}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-1 min-w-[52px] min-h-[48px] px-3 rounded-2xl text-[10px] font-semibold transition-all duration-200 ${
                  restricted
                    ? "text-muted-foreground/25"
                    : isActive
                    ? "text-primary"
                    : "text-muted-foreground/50 active:text-muted-foreground/80"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active pill background */}
                  {isActive && !restricted && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        background: "hsl(var(--primary) / 0.12)",
                        border: "1px solid hsl(var(--primary) / 0.15)",
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    />
                  )}
                  <div className="relative z-10">
                    {restricted ? (
                      <Lock className="w-[20px] h-[20px]" strokeWidth={1.6} />
                    ) : (
                      <motion.div
                        animate={isActive ? { scale: 1.15, y: -1 } : { scale: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 22 }}
                      >
                        <item.icon
                          className="w-[22px] h-[22px]"
                          strokeWidth={isActive ? 2.4 : 1.6}
                        />
                      </motion.div>
                    )}
                  </div>
                  <span className={`relative z-10 transition-all duration-200 ${
                    restricted ? "opacity-30" : isActive ? "opacity-100 text-[10.5px]" : "opacity-60"
                  }`}>
                    {item.label}
                  </span>
                  {/* Active glow dot */}
                  {isActive && !restricted && (
                    <motion.div
                      layoutId="nav-glow"
                      className="absolute -bottom-0.5 left-1/2 w-1.5 h-1.5 rounded-full bg-primary"
                      style={{
                        marginLeft: -3,
                        boxShadow: "0 0 8px hsl(var(--primary) / 0.6), 0 0 20px hsl(var(--primary) / 0.3)",
                      }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </>
              )}
            </RouterNavLink>
          );
        })}
      </div>
    </nav>
  );
}

