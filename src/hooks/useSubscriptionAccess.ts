import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useSubscription } from "@/hooks/useSubscription";
import {
  normalizePlan,
  canAccessRoute,
  canAccessLibraryTab,
  getPlanConfig,
  type PlanType,
  type LibraryTab,
} from "@/lib/subscriptionPermissions";

export function useSubscriptionAccess() {
  const { user } = useAuth();
  const { isAdmin } = useAdminAuth();
  const { subscription, isActive, loading } = useSubscription(user?.id ?? null);

  const plan: PlanType = useMemo(() => {
    if (isAdmin) return "vip";
    if (!isActive || !subscription) return "free";
    return normalizePlan(subscription.plan);
  }, [isAdmin, isActive, subscription]);

  const config = useMemo(() => getPlanConfig(plan), [plan]);

  return {
    plan,
    config,
    loading,
    isAdmin,
    checkRoute: (pathname: string) => canAccessRoute(plan, pathname, isAdmin),
    checkLibraryTab: (tab: LibraryTab) => canAccessLibraryTab(plan, tab, isAdmin),
  };
}
