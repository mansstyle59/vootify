import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useEffect } from "react";

/**
 * AuthGate: requires login. Allows /auth and /reset-password without auth.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  const publicPaths = ["/auth", "/reset-password", "/request-access"];
  const isPublicRoute = publicPaths.some((p) => location.pathname.startsWith(p));

  if (loading) return <AuthLoadingSkeleton />;
  if (user) return <>{children}</>;
  if (isPublicRoute) return <>{children}</>;

  return <RedirectToAuth />;
}

/** Ultra-light skeleton matching the app shell — shown only while session restores */
function AuthLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 pt-[calc(env(safe-area-inset-top,0px)+16px)]">
        <div className="h-6 w-24 rounded-lg bg-muted/40 animate-pulse" />
        <div className="h-8 w-8 rounded-full bg-muted/30 animate-pulse" />
      </div>
      <div className="px-5 space-y-5 mt-4">
        <div className="h-40 w-full rounded-2xl bg-muted/20 animate-pulse" />
        <div className="space-y-3">
          <div className="h-4 w-32 rounded bg-muted/30 animate-pulse" />
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 w-28 rounded-xl bg-muted/20 animate-pulse flex-shrink-0" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RedirectToAuth() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    navigate("/auth", { replace: true, state: { from: location.pathname } });
  }, [navigate, location.pathname]);

  return null;
}
