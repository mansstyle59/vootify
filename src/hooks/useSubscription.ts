import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const SUB_CACHE_KEY = "vootify-sub-cache";

interface Subscription {
  id: string;
  plan: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
}

interface SubCache {
  userId: string;
  sub: Subscription | null;
  active: boolean;
  ts: number;
}

function getCachedSub(uid: string): SubCache | null {
  try {
    const raw = localStorage.getItem(SUB_CACHE_KEY);
    if (!raw) return null;
    const c: SubCache = JSON.parse(raw);
    if (c.userId !== uid) return null;
    // Cache valid for 1 hour
    if (Date.now() - c.ts > 3600_000) return null;
    return c;
  } catch { return null; }
}

function setCachedSub(uid: string, sub: Subscription | null, active: boolean) {
  try {
    localStorage.setItem(SUB_CACHE_KEY, JSON.stringify({ userId: uid, sub, active, ts: Date.now() }));
  } catch { /* ignore */ }
}

export function useSubscription(userId: string | null) {
  const cached = userId ? getCachedSub(userId) : null;
  const [subscription, setSubscription] = useState<Subscription | null>(cached?.sub ?? null);
  const [loading, setLoading] = useState(!cached);
  const [isActive, setIsActive] = useState(cached?.active ?? false);

  const fetchSub = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", uid)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const active = data ? (!data.expires_at || new Date(data.expires_at) > new Date()) : false;
    setSubscription(data);
    setIsActive(active);
    setCachedSub(uid, data, active);
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

    // If we have cache, don't show loading — refresh in background
    if (!cached) setLoading(true);
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
