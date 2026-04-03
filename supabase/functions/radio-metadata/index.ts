const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── Stream URLs for ICY ── */
const ICY_STREAMS: Record<string, string> = {
  skyrock: "https://icecast.skyrock.net/s/natio_mp3_128k",
  "skyrock klassiks": "https://icecast.skyrock.net/s/klassiks_mp3_128k",
};

const SHOW_PATTERNS = /^skyrock\b|difool|radio libre|morning|planète rap|urban klassiks non stop/i;

/* ── ICY metadata reader ── */
async function fetchIcyMetadata(streamUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const resp = await fetch(streamUrl, {
      headers: { "User-Agent": "Mozilla/5.0", "Icy-MetaData": "1" },
      signal: controller.signal,
    });

    const metaintStr = resp.headers.get("icy-metaint");
    if (!metaintStr) {
      clearTimeout(timeout);
      await resp.body?.cancel();
      return null;
    }

    const metaint = parseInt(metaintStr, 10);
    const reader = resp.body!.getReader();
    let buffer = new Uint8Array(0);
    const needed = metaint + 4096;

    while (buffer.length < needed) {
      const { done, value } = await reader.read();
      if (done) break;
      const merged = new Uint8Array(buffer.length + value.length);
      merged.set(buffer);
      merged.set(value, buffer.length);
      buffer = merged;
    }

    reader.cancel();
    clearTimeout(timeout);

    if (buffer.length <= metaint) return null;
    const metaLength = buffer[metaint] * 16;
    if (metaLength === 0) return null;

    const metaBytes = buffer.slice(metaint + 1, metaint + 1 + metaLength);
    const metaStr = new TextDecoder("utf-8").decode(metaBytes).replace(/\0+$/, "");
    const match = metaStr.match(/StreamTitle='([^']*)'/);
    return match ? match[1] : null;
  } catch (e) {
    console.error("[radio-metadata] ICY error:", e);
    return null;
  }
}

function parseIcyTitle(raw: string): { title: string; artist: string } | null {
  const cleaned = raw.replace(/\s*§\d+$/, "").trim();
  if (!cleaned || cleaned.length < 3) return null;
  if (SHOW_PATTERNS.test(cleaned)) return null;

  const sep = cleaned.indexOf(" - ");
  if (sep > 0) {
    return { artist: cleaned.substring(0, sep).trim(), title: cleaned.substring(sep + 3).trim() };
  }
  return { artist: "Inconnu", title: cleaned };
}

/* ── Deezer cover search ── */
async function searchDeezerCover(title: string, artist: string): Promise<string | null> {
  try {
    // Clean title: remove suffixes like "- Inédit", "(feat. ...)" for better search
    const cleanTitle = title.replace(/\s*[-–]\s*(inédit|bonus|remix)$/i, "").replace(/\s*\(feat\.?[^)]*\)/i, "").trim();
    const cleanArtist = artist.split(",")[0].trim(); // Use first artist only
    const q = encodeURIComponent(`${cleanArtist} ${cleanTitle}`);
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

/* ── Mouv' via Radio France page scraping ── */
async function fetchMouvMetadata(): Promise<{ title: string; artist: string; cover: string | null } | null> {
  try {
    const resp = await fetch("https://www.radiofrance.fr/mouv/titres-diffuses", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", Accept: "text/html" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    const songPattern = /__typename:"Song".*?deezerLink:(?:"https:\/\/www\.deezer\.com\/track\/(\d+)"|void 0).*?titleProps:\{href:"[^"]*",text:"([^"]*)",title:"([^"]*)"\}.*?src:"(https:\/\/www\.radiofrance\.fr\/pikapi\/images\/[^"]+)"/g;
    const match = songPattern.exec(html);
    if (!match) return null;

    const [, deezerTrackId, songTitle, artistFromTitle, coverSrc] = match;
    const fallbackCover = coverSrc ? coverSrc + "/600x600" : null;

    if (deezerTrackId) {
      try {
        const dResp = await fetch(`https://api.deezer.com/track/${deezerTrackId}`, { signal: AbortSignal.timeout(4000) });
        if (dResp.ok) {
          const d = await dResp.json();
          if (d?.title) {
            return {
              title: d.title,
              artist: d.artist?.name || artistFromTitle || "Mouv'",
              cover: d.album?.cover_big || d.album?.cover_medium || fallbackCover,
            };
          }
        }
      } catch { /* fall through */ }
    }

    if (artistFromTitle && songTitle) {
      const cover = await searchDeezerCover(songTitle, artistFromTitle) || fallbackCover;
      return { title: songTitle, artist: artistFromTitle, cover };
    }

    return songTitle ? { title: songTitle, artist: "Mouv'", cover: fallbackCover } : null;
  } catch (e) {
    console.error("[radio-metadata] Mouv fetch error:", e);
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

    if (!detected) {
      return new Response(
        JSON.stringify({ success: true, data: null, reason: "unsupported_station" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let data: { title: string; artist: string; cover: string | null } | null = null;

    if (detected === "mouv") {
      data = await fetchMouvMetadata();
    } else {
      // Skyrock / Skyrock Klassiks via ICY
      const raw = await fetchIcyMetadata(ICY_STREAMS[detected]);
      if (raw) {
        const parsed = parseIcyTitle(raw);
        if (parsed) {
          const cover = await searchDeezerCover(parsed.title, parsed.artist);
          data = { ...parsed, cover };
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, data }),
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
