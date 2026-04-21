import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DEFAULT_IPA_URL =
  "https://mansstyle59.github.io/vootify/Vootify_1.0_1776764276.ipa";
const DEFAULT_VERSION = "1.0";
const DEFAULT_BUNDLE_ID = "app.lovable.vootify";
const ICON_URL = "https://mansstyle59.github.io/vootify/pwa-icon-512.png";

// iOS OTA requires Content-Type: application/x-plist – GitHub Pages cannot set
// custom headers, so we proxy the manifest through this edge function.
Deno.serve(async (req) => {
  // Allow Safari (iOS) to fetch without CORS issues
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Read configurable IPA URL from app_settings (key: "ios_install")
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ios_install")
      .maybeSingle();

    const settings = (data?.value ?? {}) as Record<string, string>;
    const ipaUrl = settings.ipa_url || DEFAULT_IPA_URL;
    const version = settings.version || DEFAULT_VERSION;
    const bundleId = settings.bundle_id || DEFAULT_BUNDLE_ID;
    const title = settings.title || "Vootify";

    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>${ipaUrl}</string>
        </dict>
        <dict>
          <key>kind</key>
          <string>display-image</string>
          <key>url</key>
          <string>${ICON_URL}</string>
        </dict>
        <dict>
          <key>kind</key>
          <string>full-size-image</string>
          <key>url</key>
          <string>${ICON_URL}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>${bundleId}</string>
        <key>bundle-version</key>
        <string>${version}</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>${title}</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>`;

    return new Response(plist, {
      status: 200,
      headers: {
        ...corsHeaders,
        // Critical: iOS requires this exact Content-Type to parse the manifest
        "Content-Type": "application/x-plist",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (e) {
    console.error("ota-manifest error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
