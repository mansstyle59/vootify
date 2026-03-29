import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Convert URL-safe base64 to Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}

/** Sign a JWT for VAPID using Web Crypto (ES256 / P-256) */
async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64url: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };

  const enc = new TextEncoder();
  const toB64url = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unsigned = `${headerB64}.${payloadB64}`;

  // Import private key
  const rawKey = urlBase64ToUint8Array(privateKeyBase64url);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: privateKeyBase64url,
    // We need x,y from the public key, but we can derive them
    // Actually for signing we only need d; import as pkcs8 would need DER
    // Use JWK import with x,y derived from public key
  };

  // For ECDSA P-256, we need the full JWK. Instead, let's use the raw private key
  // by constructing a proper JWK with x,y coordinates from the public key env var
  const publicKeyB64url = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const publicKeyBytes = urlBase64ToUint8Array(publicKeyB64url);

  // Uncompressed public key: 0x04 || x (32 bytes) || y (32 bytes)
  const x = toB64url(publicKeyBytes.slice(1, 33));
  const y = toB64url(publicKeyBytes.slice(33, 65));

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d: privateKeyBase64url },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(unsigned)
  );

  // Convert DER signature to raw r||s format expected by WebPush
  const sigBytes = new Uint8Array(signature);
  // crypto.subtle already returns r||s for ECDSA (64 bytes)
  const sigB64 = toB64url(sigBytes);

  return `${unsigned}.${sigB64}`;
}

/** Send a single Web Push notification */
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await createVapidJwt(audience, "mailto:noreply@vootify.app", vapidPrivateKey);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        TTL: "86400",
        Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      },
      body: new TextEncoder().encode(payload),
    });

    return response.ok || response.status === 201;
  } catch (e) {
    console.error("Push failed:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub as string;

    // Check admin role
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { title, body: notifBody, icon_url, action_url } = body;

    if (!title || !notifBody) {
      return new Response(JSON.stringify({ error: "title and body required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all push subscriptions
    const { data: subscriptions } = await adminClient
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth");

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const payload = JSON.stringify({
      title,
      body: notifBody,
      icon: icon_url || "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
      data: { url: action_url || "/" },
    });

    let successCount = 0;
    const results = await Promise.allSettled(
      (subscriptions || []).map(async (sub) => {
        const ok = await sendWebPush(sub, payload, vapidPublicKey, vapidPrivateKey);
        if (ok) successCount++;
        return ok;
      })
    );

    // Log the notification
    await adminClient.from("admin_notifications").insert({
      title,
      body: notifBody,
      icon_url,
      action_url,
      sent_by: userId,
      target_count: successCount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: subscriptions?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
