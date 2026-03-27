import { NavLink as RouterNavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Search, Library, Radio, PlusCircle, LogOut, Shield } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAuth } from "@/hooks/useAuth";
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
  const navigate = useNavigate();
  const items = isAdmin ? [...navItems, ...adminItems] : navItems;

  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0];
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <aside className="hidden md:flex flex-col w-[240px] min-h-screen bg-card/80 backdrop-blur-xl border-r border-border/50 p-4">
      <div className="mb-8 px-2">
        <h1 className="text-2xl font-display font-bold gradient-text-primary">
          Vootify
        </h1>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {items.map((item) => (
          <RouterNavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onMouseEnter={() => prefetchRoute(item.to)}
            onTouchStart={() => prefetchRoute(item.to)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </RouterNavLink>
        ))}
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
                <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
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
  const items = isAdmin ? [...navItems, ...adminItems] : navItems;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/30 px-1"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "hsl(var(--card) / 0.75)",
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
      }}
    >
      <div className="flex justify-around py-1">
        {items.map((item) => (
          <RouterNavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onTouchStart={() => prefetchRoute(item.to)}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl text-[10px] font-semibold transition-all duration-200 native-press-sm ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground/70"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <item.icon
                    className={`w-[22px] h-[22px] transition-transform duration-200 ${
                      isActive ? "scale-110" : ""
                    }`}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                </div>
                <span>{item.label}</span>
              </>
            )}
          </RouterNavLink>
        ))}
      </div>
    </nav>
  );
}

