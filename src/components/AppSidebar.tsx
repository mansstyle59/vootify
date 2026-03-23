import { NavLink as RouterNavLink } from "react-router-dom";
import { Home, Search, Library, Radio } from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/search", icon: Search, label: "Search" },
  { to: "/library", icon: Library, label: "Library" },
  { to: "/radio", icon: Radio, label: "Radio" },
];

export function AppSidebar() {
  return (
    <aside className="hidden md:flex flex-col w-[240px] min-h-screen glass-panel border-r border-border/50 p-4">
      <div className="mb-8 px-2">
        <h1 className="text-2xl font-display font-bold gradient-text-primary">
          VOO Music
        </h1>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
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
            {({ isActive }) => (
              <>
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 w-0.5 h-6 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </>
            )}
          </RouterNavLink>
        ))}
      </nav>
    </aside>
  );
}

export function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-border/50 px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around py-2">
        {navItems.map((item) => (
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
