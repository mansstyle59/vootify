import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const songId = url.searchParams.get("id");

    if (!songId) {
      return new Response(JSON.stringify({ error: "Missing 'id' parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Look up the song in custom_songs
    const { data: song, error } = await supabase
      .from("custom_songs")
      .select("stream_url, title, artist")
      .eq("id", songId)
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!song || !song.stream_url) {
      return new Response(JSON.stringify({ error: "Song not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If the client wants JSON metadata + URL
    const accept = req.headers.get("accept") || "";
    if (accept.includes("application/json")) {
      return new Response(
        JSON.stringify({
          id: songId,
          title: song.title,
          artist: song.artist,
          stream_url: song.stream_url,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Default: redirect to the actual audio file
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: song.stream_url,
      },
    });
  } catch (e) {
    console.error("stream-audio error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
