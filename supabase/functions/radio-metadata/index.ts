import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEEZER_API = "https://api.deezer.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { streamUrl } = await req.json();
    if (!streamUrl) {
      return new Response(JSON.stringify({ success: false, error: "No streamUrl" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

        while (bytesRead <= icyMetaInt + 512) {
          const { value, done } = await reader.read();
          if (done || !value) break;
          chunks.push(value);
          bytesRead += value.length;
          if (bytesRead > icyMetaInt) break;
        }

        reader.cancel().catch(() => {});

        const allBytes = new Uint8Array(bytesRead);
        let offset = 0;
        for (const chunk of chunks) {
          allBytes.set(chunk, offset);
          offset += chunk.length;
        }

        if (allBytes.length > icyMetaInt) {
          const metaLength = allBytes[icyMetaInt] * 16;
          if (metaLength > 0 && allBytes.length >= icyMetaInt + 1 + metaLength) {
            const metaBytes = allBytes.slice(icyMetaInt + 1, icyMetaInt + 1 + metaLength);
            const metaStr = new TextDecoder("utf-8").decode(metaBytes).replace(/\0+$/,  "");
            const match = metaStr.match(/StreamTitle='([^']*)'/);
            if (match) {
              nowPlaying = match[1].trim();
            }
          }
        }
      }
    } catch (e) {
      console.log("ICY fetch error:", e.message);
    } finally {
      clearTimeout(timeout);
    }

    let title = "";
    let artist = "";
    let coverUrl = "";

    if (nowPlaying) {
      // Clean up metadata (remove trailing codes like §7413009)
      const cleaned = nowPlaying.replace(/\s*§\d+$/, "").trim();
      
      const parts = cleaned.split(" - ");
      if (parts.length >= 2) {
        artist = parts[0].trim();
        title = parts.slice(1).join(" - ").trim();
      } else {
        title = cleaned;
      }

      // Search Deezer for cover art
      if (artist && title) {
        try {
          const query = `${artist} ${title}`;
          const deezerRes = await fetch(`${DEEZER_API}/search?q=${encodeURIComponent(query)}&limit=1`);
          if (deezerRes.ok) {
            const deezerData = await deezerRes.json();
            if (deezerData.data && deezerData.data.length > 0) {
              const track = deezerData.data[0];
              coverUrl = track.album?.cover_big || track.album?.cover_medium || track.album?.cover || "";
            }
          }
        } catch (e) {
          console.log("Deezer search error:", e.message);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, nowPlaying, title, artist, coverUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
