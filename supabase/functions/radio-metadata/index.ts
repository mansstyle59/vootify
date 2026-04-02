const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Scrapes https://www.radiofrance.fr/mouv/titres-diffuses
 * to extract the currently playing song from the embedded SvelteKit data.
 *
 * The page embeds `__sveltekit_*.data = { ... }` with song items.
 * First item = now playing.
 * titleProps.text  = song title
 * titleProps.title = artist name (only populated for the current/"En ce moment" item)
 * visual.src       = cover image URL (pikapi)
 * additionalInfos  = album info
 */
async function fetchMouvMetadata(): Promise<{
  title: string;
  artist: string;
  cover: string | null;
} | null> {
  try {
    const resp = await fetch(
      "https://www.radiofrance.fr/mouv/titres-diffuses",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!resp.ok) {
      console.error("[radio-metadata] HTTP", resp.status);
      return null;
    }

    const html = await resp.text();

    // Extract songs from SvelteKit embedded data
    // Pattern: titleProps:{href:"...",text:"TITLE",title:"ARTIST"}
    const songPattern =
      /titleProps:\{href:"[^"]*",text:"([^"]*)",title:"([^"]*)"\}/g;
    const matches = [...html.matchAll(songPattern)];

    if (matches.length === 0) {
      console.warn("[radio-metadata] No songs found in page");
      return null;
    }

    // First match = currently playing
    const firstMatch = matches[0];
    const songTitle = firstMatch[1];
    const artist = firstMatch[2];

    // If artist is empty, try to find from additionalInfos or skip
    if (!songTitle || songTitle.length < 2) return null;

    // Extract cover URL for the first song
    // The visual.src appears right AFTER the titleProps in the data
    const firstSongEnd = html.indexOf(matches[0][0]) + matches[0][0].length;
    const searchRegion = html.substring(firstSongEnd, firstSongEnd + 400);
    const coverMatch = searchRegion.match(
      /src:"(https:\/\/www\.radiofrance\.fr\/pikapi\/images\/[^"]+)"/
    );
    const coverUrl = coverMatch ? coverMatch[1] + "/600x600" : null;

    return {
      title: songTitle,
      artist: artist || "Mouv'",
      cover: coverUrl,
    };
  } catch (e) {
    console.error("[radio-metadata] Fetch error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const station = url.searchParams.get("station") || "";

    if (station.toLowerCase().includes("mouv")) {
      const meta = await fetchMouvMetadata();
      return new Response(JSON.stringify({ success: true, data: meta }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, data: null, reason: "unsupported_station" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[radio-metadata] Error:", e);
    return new Response(
      JSON.stringify({ success: false, error: String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
