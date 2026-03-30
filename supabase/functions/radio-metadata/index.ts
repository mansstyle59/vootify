import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEEZER_API = "https://api.deezer.com";
const TUNEIN_API = "https://opml.radiotime.com";
const TUNEIN_CDN = "https://cdn-profiles.tunein.com";
const RF_LIVEMETA = "https://api.radiofrance.fr/livemeta/pull";

// Radio France station mappings: URL pattern → livemeta station ID
const RADIO_FRANCE_STATIONS: Record<string, { name: string; stationId: number }> = {
  franceinter:  { name: "France Inter",    stationId: 1 },
  franceinfo:   { name: "franceinfo",      stationId: 2 },
  franceculture:{ name: "France Culture",  stationId: 3 },
  francemusique:{ name: "France Musique",  stationId: 4 },
  fip:          { name: "FIP",             stationId: 5 },
  mouv:         { name: "Mouv'",           stationId: 7 },
};

function detectRadioFranceStation(url: string): { name: string; stationId: number } | null {
  if (!url.includes("radiofrance.fr")) return null;
  for (const [key, info] of Object.entries(RADIO_FRANCE_STATIONS)) {
    if (url.includes(key)) return info;
  }
  return null;
}

/**
 * Fetch live metadata from Radio France's livemeta API.
 * Returns the currently playing track with artist, title, cover, and album.
 */
async function fetchRadioFranceLive(stationId: number): Promise<{
  title: string; artist: string; coverUrl: string; album: string;
} | null> {
  try {
    const url = `${RF_LIVEMETA}/${stationId}`;
    console.log("RF livemeta fetch:", url);
    const resp = await fetch(url, {
      headers: { "User-Agent": "Vootify/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    console.log("RF livemeta status:", resp.status);
    if (!resp.ok) return null;
    const data = await resp.json();
    console.log("RF livemeta steps count:", Object.keys(data.steps || {}).length);
    const steps = data.steps || {};
    const now = Date.now() / 1000;

    // Find the currently playing step (embedType === "song" preferred)
    let current: any = null;
    for (const step of Object.values(steps) as any[]) {
      if (step.start <= now && step.end >= now) {
        // Prefer song-type steps over program-type
        if (!current || step.embedType === "song") {
          current = step;
        }
      }
    }

    if (!current) {
      console.log("RF: no current step found for now=", Date.now() / 1000);
      return null;
    }

    const title = current.title || "";
    const artist = current.authors || current.highlightedArtists?.[0] || "";
    const album = current.titreAlbum || "";

    // Cover URL: some stations return full URLs, others return UUIDs
    let coverUrl = current.visual || "";
    if (coverUrl && !coverUrl.startsWith("http")) {
      // It's a UUID — construct the full URL
      coverUrl = `https://www.radiofrance.fr/s3/cruiser-production-eu3/${coverUrl}`;
    }

    if (title || artist) {
      return { title, artist, coverUrl, album };
    }
    return null;
  } catch (e) {
    console.error("RF livemeta error:", (e as Error).message);
    return null;
  }
}

/**
 * Try to find now playing + logo via TuneIn search.
 */
async function fetchTuneInMetadata(stationName: string): Promise<{
  nowPlaying: string; title: string; artist: string; coverUrl: string; logoHd: string;
} | null> {
  try {
    const searchUrl = `${TUNEIN_API}/Search.ashx?query=${encodeURIComponent(stationName)}&render=json&types=station`;
    const resp = await fetch(searchUrl, {
      headers: { "User-Agent": "Vootify/1.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const body = data.body || [];

    const nameNorm = stationName.toLowerCase().trim();
    let bestStation: any = null;

    for (const item of body) {
      if (item.item !== "station") continue;
      const itemName = (item.text || "").toLowerCase().trim();
      if (itemName === nameNorm || itemName.includes(nameNorm) || nameNorm.includes(itemName)) {
        bestStation = item;
        break;
      }
    }
    if (!bestStation) {
      bestStation = body.find((item: any) => item.item === "station");
    }
    if (!bestStation) return null;

    const id = bestStation.guide_id;
    const logoHd = id ? `${TUNEIN_CDN}/${id}/images/logog.png` : (bestStation.image || "");
    const currentTrack = bestStation.current_track || bestStation.subtext || "";

    let artist = "";
    let title = "";
    let coverUrl = "";

    if (currentTrack) {
      const parts = currentTrack.split(" - ");
      if (parts.length >= 2) {
        artist = parts[0].trim();
        title = parts.slice(1).join(" - ").trim();
      } else {
        title = currentTrack;
      }
    }

    if (artist && title) {
      try {
        const deezerRes = await fetch(`${DEEZER_API}/search?q=${encodeURIComponent(`${artist} ${title}`)}&limit=1`);
        if (deezerRes.ok) {
          const deezerData = await deezerRes.json();
          if (deezerData.data?.length > 0) {
            const track = deezerData.data[0];
            coverUrl = track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || "";
          }
        }
      } catch { /* silent */ }
    }

    return { nowPlaying: currentTrack, title, artist, coverUrl: coverUrl || logoHd, logoHd };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { streamUrl, stationName, stationCover } = await req.json();
    if (!streamUrl) {
      return new Response(JSON.stringify({ success: false, error: "No streamUrl" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let nowPlaying = "";
    let title = "";
    let artist = "";
    let coverUrl = "";

    // ── Step 1: Detect Radio France → use livemeta API ──
    const rfStation = detectRadioFranceStation(streamUrl);
    if (rfStation) {
      const rfLive = await fetchRadioFranceLive(rfStation.stationId);
      if (rfLive && (rfLive.title || rfLive.artist)) {
        title = rfLive.title;
        artist = rfLive.artist || rfStation.name;
        coverUrl = rfLive.coverUrl || "";
        nowPlaying = artist && title ? `${artist} - ${title}` : title || `En direct sur ${rfStation.name}`;

        // If no cover from RF API, try Deezer search
        if (!coverUrl && artist && title) {
          try {
            const deezerRes = await fetch(`${DEEZER_API}/search?q=${encodeURIComponent(`${artist} ${title}`)}&limit=1`);
            if (deezerRes.ok) {
              const dd = await deezerRes.json();
              if (dd.data?.length > 0) {
                coverUrl = dd.data[0].album?.cover_xl || dd.data[0].album?.cover_big || "";
              }
            }
          } catch { /* silent */ }
        }

        // Final fallback to station cover from client
        if (!coverUrl) coverUrl = stationCover || "";
      } else {
        // RF API failed — generic fallback with station cover
        nowPlaying = `En direct sur ${rfStation.name}`;
        title = "En direct";
        artist = rfStation.name;
        coverUrl = stationCover || "";
      }

      return new Response(
        JSON.stringify({ success: true, nowPlaying, title, artist, coverUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 2: Try ICY metadata from the stream ──
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

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
            const metaStr = new TextDecoder("utf-8").decode(metaBytes).replace(/\0+$/, "");
            const match = metaStr.match(/StreamTitle='([^']*)'/);
            if (match) {
              nowPlaying = match[1].trim();
            }
          }
        }
      }
    } catch (e) {
      console.log("ICY fetch error:", (e as Error).message);
    } finally {
      clearTimeout(timeout);
    }

    // ── Step 3: Parse ICY metadata & search Deezer for cover art ──
    if (nowPlaying) {
      const cleaned = nowPlaying.replace(/\s*§\d+$/, "").trim();
      const parts = cleaned.split(" - ");
      if (parts.length >= 2) {
        artist = parts[0].trim();
        title = parts.slice(1).join(" - ").trim();
      } else {
        title = cleaned;
      }

      if (artist && title) {
        try {
          const deezerRes = await fetch(`${DEEZER_API}/search?q=${encodeURIComponent(`${artist} ${title}`)}&limit=1`);
          if (deezerRes.ok) {
            const deezerData = await deezerRes.json();
            if (deezerData.data?.length > 0) {
              const track = deezerData.data[0];
              coverUrl = track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || "";
            }
          }
        } catch (e) {
          console.log("Deezer search error:", (e as Error).message);
        }
      }
    }

    // ── Step 4: Fallback — search TuneIn for now playing + logo ──
    if (!nowPlaying && stationName) {
      const tuneInData = await fetchTuneInMetadata(stationName);
      if (tuneInData && tuneInData.nowPlaying) {
        nowPlaying = tuneInData.nowPlaying;
        title = tuneInData.title;
        artist = tuneInData.artist;
        coverUrl = tuneInData.coverUrl || stationCover || "";
      } else if (tuneInData?.logoHd) {
        nowPlaying = `En direct sur ${stationName}`;
        title = "En direct";
        artist = stationName;
        coverUrl = tuneInData.logoHd;
      }
    }

    // ── Step 5: If still no cover, try TuneIn logo ──
    if (!coverUrl && stationName) {
      try {
        const tuneInData = await fetchTuneInMetadata(stationName);
        if (tuneInData?.logoHd) {
          coverUrl = tuneInData.logoHd;
        }
      } catch { /* silent */ }
    }

    // ── Step 6: Generic fallback ──
    if (!nowPlaying && stationName) {
      nowPlaying = `En direct sur ${stationName}`;
      title = "En direct";
      artist = stationName;
      coverUrl = stationCover || "";
    }

    // Never return relative paths
    if (!coverUrl || coverUrl.startsWith("/")) {
      coverUrl = stationCover || "";
    }

    return new Response(
      JSON.stringify({ success: true, nowPlaying, title, artist, coverUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
