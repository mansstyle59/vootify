import { useLocation } from "react-router-dom";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { UpgradePrompt } from "@/components/UpgradePrompt";

const ROUTE_LABELS: Record<string, string> = {
  "/search": "La recherche",
  "/radio": "La radio",
  "/library": "La bibliothèque",
};

/**
 * Wraps routes to check subscription-based access.
 * Shows UpgradePrompt if the current plan can't access the route.
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { checkRoute, loading } = useSubscriptionAccess();
  const location = useLocation();

  if (loading) return null;

  if (!checkRoute(location.pathname)) {
    const base = "/" + location.pathname.split("/")[1];
    const feature = ROUTE_LABELS[base] || "Cette page";
    return <UpgradePrompt feature={feature} />;
  }

  return <>{children}</>;
}
