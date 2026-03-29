/**
 * Client-side push notification subscription management.
 * Handles permission request, subscription creation, and backend sync.
 */

import { supabase } from "@/integrations/supabase/client";

// VAPID public key — safe to expose client-side
const VAPID_PUBLIC_KEY = "BA4ncGRDTTJetLzk1NAUY275A-__2ElWMjguo4uNishzqTj5zRYiRcjppLdU2pmiw1491rPqMQtg-hgqEjUcq9I";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}

/** Check if push notifications are supported */
export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Get current permission state */
export function getPushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/** Check if user is currently subscribed */
export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

/**
 * Request push notification permission and subscribe.
 * Stores the subscription in the database.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const reg = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const subJson = sub.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      console.error("[push] Invalid subscription object");
      return false;
    }

    // Save to database
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) {
      console.error("[push] Failed to save subscription:", error);
      return false;
    }

    return true;
  } catch (e) {
    console.error("[push] Subscribe failed:", e);
    return false;
  }
}

/** Unsubscribe from push notifications */
export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();

    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      // Remove from database
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", endpoint);
    }

    return true;
  } catch (e) {
    console.error("[push] Unsubscribe failed:", e);
    return false;
  }
}
