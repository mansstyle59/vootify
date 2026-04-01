import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const ADMIN_CACHE_KEY = "vootify_is_admin";

function readCachedAdmin(): boolean {
  try { return localStorage.getItem(ADMIN_CACHE_KEY) === "true"; } catch { return false; }
}
function writeCachedAdmin(val: boolean) {
  try { localStorage.setItem(ADMIN_CACHE_KEY, String(val)); } catch { /* */ }
}

interface AdminAuthContext {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AdminAuthCtx = createContext<AdminAuthContext>({
  user: null,
  isAdmin: false,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const cachedAdmin = readCachedAdmin();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(cachedAdmin);
  const [loading, setLoading] = useState(!cachedAdmin);

  const checkAdmin = async (userId: string) => {
    const { data } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const result = !!data;
    writeCachedAdmin(result);
    return result;
  };

  useEffect(() => {
    let mounted = true;

    // Safety timeout: resolve as non-admin if offline/stuck
    const safetyTimer = setTimeout(() => {
      if (mounted && loading) {
        console.warn("[AdminAuth] Timeout — resolving as non-admin");
        setLoading(false);
      }
    }, 2000);

    const resolve = (session: import("@supabase/supabase-js").Session | null) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setLoading(true);

      checkAdmin(u.id)
        .then((admin) => {
          if (mounted) setIsAdmin(admin);
        })
        .catch(() => {
          if (mounted) setIsAdmin(false);
        })
        .finally(() => {
          clearTimeout(safetyTimer);
          if (mounted) setLoading(false);
        });
    };

    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        resolve(session);
      }
    );

    // Then get session
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(safetyTimer);
      resolve(session);
    }).catch(() => {
      clearTimeout(safetyTimer);
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    writeCachedAdmin(false);
  };

  return (
    <AdminAuthCtx.Provider value={{ user, isAdmin, loading, signIn, signOut }}>
      {children}
    </AdminAuthCtx.Provider>
  );
}

export const useAdminAuth = () => useContext(AdminAuthCtx);
