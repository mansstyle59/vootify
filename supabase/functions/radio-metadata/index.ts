const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── Stream URLs ── */
const STREAM_URLS: Record<string, string> = {
  skyrock: "https://icecast.skyrock.net/s/natio_mp3_128k",
  "skyrock klassiks": "https://icecast.skyrock.net/s/klassiks_mp3_128k",
  mouv: "http://icecast.radiofrance.fr/mouv-midfi.mp3",
};

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

/* ── Parse ICY title ── */
const SHOW_PATTERNS = /^skyrock\b|difool|radio libre|morning|planète rap|urban klassiks non stop/i;

function parseIcyTitle(raw: string): { title: string; artist: string } | null {
  const cleaned = raw.replace(/\s*§\d+$/, "").trim();
  if (!cleaned || cleaned.length < 3) return null;
  if (SHOW_PATTERNS.test(cleaned)) return null;

  const sep = cleaned.indexOf(" - ");
  if (sep > 0) {
    return {
      artist: cleaned.substring(0, sep).trim(),
      title: cleaned.substring(sep + 3).trim(),
    };
  }
  return { artist: "Inconnu", title: cleaned };
}

/* ── Deezer cover search ── */
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

    if (!detected || !STREAM_URLS[detected]) {
      return new Response(
        JSON.stringify({ success: true, data: null, reason: "unsupported_station" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const raw = await fetchIcyMetadata(STREAM_URLS[detected]);
    if (!raw) {
      return new Response(
        JSON.stringify({ success: true, data: null, reason: "no_icy" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = parseIcyTitle(raw);
    if (!parsed) {
      return new Response(
        JSON.stringify({ success: true, data: null, reason: "show_or_jingle" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cover = await searchDeezerCover(parsed.title, parsed.artist);

    return new Response(
      JSON.stringify({ success: true, data: { ...parsed, cover } }),
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
