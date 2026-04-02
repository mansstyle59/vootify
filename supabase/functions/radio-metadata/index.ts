const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type MetaResult = { title: string; artist: string; cover: string | null } | null;

/* ── Mouv' via RadioFrance titres-diffusés ── */
async function fetchMouvMetadata(): Promise<MetaResult> {
  try {
    const resp = await fetch("https://www.radiofrance.fr/mouv/titres-diffuses", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", Accept: "text/html" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    const songPattern = /titleProps:\{href:"[^"]*",text:"([^"]*)",title:"([^"]*)"\}/g;
    const matches = [...html.matchAll(songPattern)];
    if (matches.length === 0) return null;

    const songTitle = matches[0][1];
    const artist = matches[0][2];
    if (!songTitle || songTitle.length < 2) return null;

    // Cover is right after titleProps in the visual.src field
    const firstSongEnd = html.indexOf(matches[0][0]) + matches[0][0].length;
    const searchRegion = html.substring(firstSongEnd, firstSongEnd + 400);
    const coverMatch = searchRegion.match(/src:"(https:\/\/www\.radiofrance\.fr\/pikapi\/images\/[^"]+)"/);
    const coverUrl = coverMatch ? coverMatch[1] + "/600x600" : null;

    return { title: songTitle, artist: artist || "Mouv'", cover: coverUrl };
  } catch (e) {
    console.error("[radio-metadata] Mouv fetch error:", e);
    return null;
  }
}

/* ── Skyrock / Skyrock Klassiks via ecouterlaradio.fr ── */
const SKYROCK_PAGES: Record<string, string> = {
  skyrock: "https://ecouterlaradio.fr/105-skyrock.html",
  "skyrock klassiks": "https://ecouterlaradio.fr/1936-skyrock-klassiks.html",
};

// Shows/programs to ignore — only real songs
const SHOW_ARTISTS = new Set([
  "skyrock", "skyrock klassiks", "skyrock 100% francais",
]);

async function fetchSkyrockMetadata(pageUrl: string): Promise<MetaResult> {
  try {
    const resp = await fetch(pageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", Accept: "text/html" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    // Extract playlist items: cover, title, artist
    const itemPattern =
      /station-playlist__cover"\s*src="([^"]+)".*?station-playlist__title-song">([^<]+)<.*?station-playlist__artist">([^<]+)</gs;
    const items = [...html.matchAll(itemPattern)];

    // Find the first REAL song (skip show/program entries)
    for (const [, img, rawTitle, rawArtist] of items) {
      const artist = rawArtist.trim();
      const title = rawTitle.trim().replace(/\s*§\d+$/, ""); // remove §ID suffix

      // Skip if it's a show/program (artist matches station name)
      if (SHOW_ARTISTS.has(artist.toLowerCase())) continue;
      if (title.length < 2) continue;

      // Cover images are placeholders on ecouterlaradio — use Deezer search for HD covers
      const cover = await searchDeezerCover(title, artist);

      return { title, artist, cover };
    }

    return null;
  } catch (e) {
    console.error("[radio-metadata] Skyrock fetch error:", e);
    return null;
  }
}

/* ── Deezer cover search (free, no API key) ── */
async function searchDeezerCover(title: string, artist: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${artist} ${title}`);
    const resp = await fetch(`https://api.deezer.com/search?q=${q}&limit=1`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.data?.[0]?.album?.cover_big || data?.data?.[0]?.album?.cover_medium || null;
  } catch {
    return null;
  }
}

/* ── Station matcher ── */
function detectStation(name: string): string | null {
  const n = name.toLowerCase().trim();
  if (/mouv/i.test(n)) return "mouv";
  if (/skyrock\s*klassiks/i.test(n)) return "skyrock klassiks";
  if (/skyrock/i.test(n)) return "skyrock";
  return null;
}

/* ── Main handler ── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const station = url.searchParams.get("station") || "";
    const detected = detectStation(station);

    let meta: MetaResult = null;

    if (detected === "mouv") {
      meta = await fetchMouvMetadata();
    } else if (detected === "skyrock" || detected === "skyrock klassiks") {
      const pageUrl = SKYROCK_PAGES[detected];
      if (pageUrl) meta = await fetchSkyrockMetadata(pageUrl);
    }

    if (detected) {
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
