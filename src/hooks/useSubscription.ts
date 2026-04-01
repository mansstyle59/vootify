import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
const CACHE_KEY = "vootify_sub_cache";

interface Subscription {
  id: string;
  plan: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
}

function readCachedSub(): { subscription: Subscription; isActive: boolean } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Subscription;
    const active = !cached.expires_at || new Date(cached.expires_at) > new Date();
    return { subscription: cached, isActive: active };
  } catch {
    return null;
  }
}

function writeCachedSub(sub: Subscription | null) {
  try {
    if (sub) localStorage.setItem(CACHE_KEY, JSON.stringify(sub));
    else localStorage.removeItem(CACHE_KEY);
  } catch { /* quota */ }
}

export function useSubscription(userId: string | null) {
  const cached = readCachedSub();
  const [subscription, setSubscription] = useState<Subscription | null>(cached?.subscription ?? null);
  const [loading, setLoading] = useState(!cached);
  const [isActive, setIsActive] = useState(cached?.isActive ?? false);

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
      writeCachedSub(data);
    } else {
      setSubscription(null);
      setIsActive(false);
      writeCachedSub(null);
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

    // Safety timeout: don't block app forever if offline
    const safetyTimer = setTimeout(() => {
      if (mounted && loading) {
        console.warn("[Subscription] Timeout — resolving as inactive");
        setLoading(false);
      }
    }, 2000);

    setLoading(true);
    fetchSub(userId).catch(() => {
      if (mounted) setLoading(false);
    }).finally(() => {
      clearTimeout(safetyTimer);
    });

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
      clearTimeout(safetyTimer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [userId, fetchSub]);

  return { subscription, loading, isActive };
}
