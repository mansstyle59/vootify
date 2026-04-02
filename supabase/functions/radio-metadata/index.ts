const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type MetaResult = { title: string; artist: string; cover: string | null } | null;

/* ── Deezer helpers ── */

async function fetchDeezerTrack(trackId: string): Promise<MetaResult> {
  try {
    const resp = await fetch(`https://api.deezer.com/track/${trackId}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data?.title) return null;
    return {
      title: data.title,
      artist: data.artist?.name || "Inconnu",
      cover: data.album?.cover_big || data.album?.cover_medium || null,
    };
  } catch {
    return null;
  }
}

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

async function searchDeezerFull(title: string): Promise<MetaResult> {
  try {
    const q = encodeURIComponent(title);
    const resp = await fetch(`https://api.deezer.com/search?q=${q}&limit=1`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const track = data?.data?.[0];
    if (!track) return null;
    return {
      title: track.title || title,
      artist: track.artist?.name || "Inconnu",
      cover: track.album?.cover_big || track.album?.cover_medium || null,
    };
  } catch {
    return null;
  }
}

/* ── Mouv' via RadioFrance titres-diffusés ── */
async function fetchMouvMetadata(): Promise<MetaResult> {
  try {
    const resp = await fetch("https://www.radiofrance.fr/mouv/titres-diffuses", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", Accept: "text/html" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    // Extract first song block: deezerLink + titleProps.text + visual.src
    const songPattern = /__typename:"Song".*?deezerLink:(?:"(https:\/\/www\.deezer\.com\/track\/(\d+))"|void 0).*?titleProps:\{href:"[^"]*",text:"([^"]*)",title:"([^"]*)"\}.*?src:"(https:\/\/www\.radiofrance\.fr\/pikapi\/images\/[^"]+)"/g;
    const match = songPattern.exec(html);

    if (!match) return null;

    const [, , deezerTrackId, songTitle, artistFromTitle, coverSrc] = match;
    const fallbackCover = coverSrc ? coverSrc + "/600x600" : null;

    // Strategy 1: Use Deezer track ID for exact metadata
    if (deezerTrackId) {
      const deezerMeta = await fetchDeezerTrack(deezerTrackId);
      if (deezerMeta) {
        return {
          title: deezerMeta.title,
          artist: deezerMeta.artist,
          cover: deezerMeta.cover || fallbackCover,
        };
      }
    }

    // Strategy 2: Artist is sometimes in titleProps.title field
    if (artistFromTitle && artistFromTitle.length > 1) {
      const cover = await searchDeezerCover(songTitle, artistFromTitle) || fallbackCover;
      return { title: songTitle, artist: artistFromTitle, cover };
    }

    // Strategy 3: Search Deezer by song title
    if (songTitle && songTitle.length > 2) {
      const deezerResult = await searchDeezerFull(songTitle);
      if (deezerResult) {
        return {
          title: deezerResult.title,
          artist: deezerResult.artist,
          cover: deezerResult.cover || fallbackCover,
        };
      }
      return { title: songTitle, artist: "Mouv'", cover: fallbackCover };
    }

    return null;
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

    const itemPattern =
      /station-playlist__cover"\s*src="([^"]+)".*?station-playlist__title-song">([^<]+)<.*?station-playlist__artist">([^<]+)</gs;
    const items = [...html.matchAll(itemPattern)];

    for (const [, , rawTitle, rawArtist] of items) {
      const artist = rawArtist.trim();
      const title = rawTitle.trim().replace(/\s*§\d+$/, "");

      if (SHOW_ARTISTS.has(artist.toLowerCase())) continue;
      if (title.length < 2) continue;

      const cover = await searchDeezerCover(title, artist);
      return { title, artist, cover };
    }

    return null;
  } catch (e) {
    console.error("[radio-metadata] Skyrock fetch error:", e);
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
