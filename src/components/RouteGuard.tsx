import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { UpgradePrompt } from "@/components/UpgradePrompt";

const ROUTE_LABELS: Record<string, string> = {
  "/search": "La recherche",
  "/radio": "La radio",
  "/library": "La bibliothèque",
};

/** Routes that work offline (served from cache / IndexedDB) */
const OFFLINE_ALLOWED = ["/library", "/profile", "/audio-settings", "/auth", "/reset-password", "/request-access"];

/**
 * Wraps routes to check subscription-based access AND offline availability.
 * When offline, non-allowed routes redirect to /library (downloads tab).
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { checkRoute, loading } = useSubscriptionAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // When offline, redirect to library if current route isn't offline-capable
  useEffect(() => {
    if (!isOffline) return;
    const base = "/" + location.pathname.split("/").filter(Boolean)[0];
    const isAllowed = OFFLINE_ALLOWED.some((p) => location.pathname.startsWith(p)) || location.pathname === "/";
    if (!isAllowed) {
      navigate("/library", { replace: true });
    }
  }, [isOffline, location.pathname, navigate]);

  if (loading) return null;

  if (!checkRoute(location.pathname)) {
    const base = "/" + location.pathname.split("/")[1];
    const feature = ROUTE_LABELS[base] || "Cette page";
    return <UpgradePrompt feature={feature} />;
  }

  return <>{children}</>;
}
