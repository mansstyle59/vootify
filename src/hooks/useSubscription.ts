import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Subscription {
  id: string;
  plan: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
}

export function useSubscription(userId: string | null) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);

  const fetchSub = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", uid)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setSubscription(data);
      const active = !data.expires_at || new Date(data.expires_at) > new Date();
      setIsActive(active);
    } else {
      setSubscription(null);
      setIsActive(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!userId) {
      setSubscription(null);
      setIsActive(false);
      setLoading(false);
      return;
    }

    let mounted = true;

    setLoading(true);
    fetchSub(userId).then(() => { if (!mounted) return; });

    // Listen for realtime changes
    const channel = supabase
      .channel(`sub-${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "subscriptions",
        filter: `user_id=eq.${userId}`,
      }, () => { if (mounted) fetchSub(userId); })
      .subscribe();

    // Also re-check on visibility change (PWA reopen)
    const onVisible = () => {
      if (document.visibilityState === "visible" && mounted) {
        fetchSub(userId);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [userId, fetchSub]);

  return { subscription, loading, isActive };
}
