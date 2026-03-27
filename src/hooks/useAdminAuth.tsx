import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

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
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdmin = async (userId: string) => {
    const { data } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    return !!data;
  };

  useEffect(() => {
    let mounted = true;
    let initialDone = false;

    const resolve = async (session: import("@supabase/supabase-js").Session | null) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const admin = await checkAdmin(u.id);
        if (mounted) setIsAdmin(admin);
      } else {
        setIsAdmin(false);
      }
      if (mounted) setLoading(false);
    };

    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        initialDone = true;
        await resolve(session);
      }
    );

    // Then get session — skip if listener already fired
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!initialDone) {
        await resolve(session);
      }
    });

    return () => {
      mounted = false;
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
  };

  return (
    <AdminAuthCtx.Provider value={{ user, isAdmin, loading, signIn, signOut }}>
      {children}
    </AdminAuthCtx.Provider>
  );
}

export const useAdminAuth = () => useContext(AdminAuthCtx);
