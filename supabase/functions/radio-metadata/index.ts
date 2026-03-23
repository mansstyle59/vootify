import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { streamUrl } = await req.json();
    if (!streamUrl) {
      return new Response(JSON.stringify({ success: false, error: "No streamUrl" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to fetch ICY metadata from the stream
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let nowPlaying = "";

    try {
      const response = await fetch(streamUrl, {
        headers: { "Icy-MetaData": "1" },
        signal: controller.signal,
      });

      const icyMetaInt = parseInt(response.headers.get("icy-metaint") || "0", 10);

      if (icyMetaInt > 0 && response.body) {
        const reader = response.body.getReader();
        let bytesRead = 0;
        let chunks: Uint8Array[] = [];

        // Read until we get past the first metadata block
        while (bytesRead <= icyMetaInt + 512) {
          const { value, done } = await reader.read();
          if (done || !value) break;
          chunks.push(value);
          bytesRead += value.length;

          if (bytesRead > icyMetaInt) {
            // We have enough data to extract metadata
            break;
          }
        }

        reader.cancel().catch(() => {});

        // Combine chunks
        const allBytes = new Uint8Array(bytesRead);
        let offset = 0;
        for (const chunk of chunks) {
          allBytes.set(chunk, offset);
          offset += chunk.length;
        }

        // Extract metadata after icyMetaInt bytes
        if (allBytes.length > icyMetaInt) {
          const metaLength = allBytes[icyMetaInt] * 16;
          if (metaLength > 0 && allBytes.length >= icyMetaInt + 1 + metaLength) {
            const metaBytes = allBytes.slice(icyMetaInt + 1, icyMetaInt + 1 + metaLength);
            const metaStr = new TextDecoder("utf-8").decode(metaBytes).replace(/\0+$/, "");
            
            // Parse StreamTitle='...'
            const match = metaStr.match(/StreamTitle='([^']*)'/);
            if (match) {
              nowPlaying = match[1].trim();
            }
          }
        }
      }
    } catch (e) {
      // Stream fetch failed, that's ok
      console.log("ICY fetch error:", e.message);
    } finally {
      clearTimeout(timeout);
    }

    // Parse title - artist from "Artist - Title" or "Title" format
    let title = "";
    let artist = "";
    
    if (nowPlaying) {
      const parts = nowPlaying.split(" - ");
      if (parts.length >= 2) {
        artist = parts[0].trim();
        title = parts.slice(1).join(" - ").trim();
      } else {
        title = nowPlaying;
      }
    }

    return new Response(
      JSON.stringify({ success: true, nowPlaying, title, artist }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
