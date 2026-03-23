import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const JIOSAAVN_BASE = "https://saavn.dev/api";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, query, id, limit = 20 } = await req.json();

    let url: string;

    switch (action) {
      case "search":
        url = `${JIOSAAVN_BASE}/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`;
        break;
      case "song":
        url = `${JIOSAAVN_BASE}/songs/${id}`;
        break;
      case "album":
        url = `${JIOSAAVN_BASE}/albums?id=${id}`;
        break;
      case "playlist":
        url = `${JIOSAAVN_BASE}/playlists?id=${id}&limit=${limit}`;
        break;
      case "charts":
        // Use a trending playlist
        url = `${JIOSAAVN_BASE}/playlists?id=110858205&limit=${limit}`;
        break;
      case "search_albums":
        url = `${JIOSAAVN_BASE}/search/albums?query=${encodeURIComponent(query)}&limit=${limit}`;
        break;
      default:
        return new Response(
          JSON.stringify({ success: false, error: "Unknown action" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!data.success && !data.data) {
      return new Response(
        JSON.stringify({ success: false, error: data.message || "JioSaavn API error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: data.data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
