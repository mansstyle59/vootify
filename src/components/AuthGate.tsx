import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";

/**
 * AuthGate: requires login. Allows /auth and /reset-password without auth.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  const publicPaths = ["/auth", "/reset-password", "/request-access"];
  const isPublicRoute = publicPaths.some((p) => location.pathname.startsWith(p));

  if (loading) return <>{children}</>;
  if (user) return <>{children}</>;
  if (isPublicRoute) return <>{children}</>;

  return <RedirectToAuth />;
}

function RedirectToAuth() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    navigate("/auth", { replace: true, state: { from: location.pathname } });
  }, [navigate, location.pathname]);

  return null;
}
