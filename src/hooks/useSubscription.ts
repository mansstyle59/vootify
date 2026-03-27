import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!userId) {
      setSubscription(null);
      setIsActive(false);
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mounted) return;

      if (data) {
        setSubscription(data);
        // Active if no expiry or expiry in the future
        const active = !data.expires_at || new Date(data.expires_at) > new Date();
        setIsActive(active);
      } else {
        setSubscription(null);
        setIsActive(false);
      }
      setLoading(false);
    };

    fetch();

    // Listen for realtime changes
    const channel = supabase
      .channel(`sub-${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "subscriptions",
        filter: `user_id=eq.${userId}`,
      }, () => { fetch(); })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { subscription, loading, isActive };
}
