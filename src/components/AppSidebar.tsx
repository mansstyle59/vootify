import { NavLink as RouterNavLink } from "react-router-dom";
import { Home, Search, Library, Radio, PlusCircle, LogOut } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { to: "/", icon: Home, label: "Accueil" },
  { to: "/search", icon: Search, label: "Recherche" },
  { to: "/library", icon: Library, label: "Bibliothèque" },
  { to: "/radio", icon: Radio, label: "Radio" },
];

const adminItems = [
  { to: "/add", icon: PlusCircle, label: "Ajouter" },
];

export function AppSidebar() {
  const { isAdmin } = useAdminAuth();
  const { user, signOut } = useAuth();
  const items = isAdmin ? [...navItems, ...adminItems] : navItems;

  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0];
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <aside className="hidden md:flex flex-col w-[240px] min-h-screen glass-panel border-r border-border/50 p-4">
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
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
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
            <Avatar className="w-8 h-8">
              <AvatarImage src={avatarUrl} alt={displayName || "User"} />
              <AvatarFallback className="text-xs font-semibold bg-primary/20 text-primary">
                {(displayName || "U").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            </div>
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-border/50 px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around py-2">
        {items.map((item) => (
          <RouterNavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </RouterNavLink>
        ))}
      </div>
    </nav>
  );
}
