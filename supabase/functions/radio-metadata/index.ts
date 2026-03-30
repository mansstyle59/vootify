import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEEZER_API = "https://api.deezer.com";
const TUNEIN_API = "https://opml.radiotime.com";
const TUNEIN_CDN = "https://cdn-profiles.tunein.com";

// Radio France API for live metadata
const RADIO_FRANCE_API = "https://www.radiofrance.fr/api/v2.1/stations";
const RADIO_FRANCE_STATIONS: Record<string, { name: string; apiSlug: string }> = {
  franceinter:  { name: "France Inter",    apiSlug: "france-inter" },
  franceinfo:   { name: "franceinfo",      apiSlug: "franceinfo" },
  fip:          { name: "FIP",             apiSlug: "fip" },
  francemusique:{ name: "France Musique",  apiSlug: "france-musique" },
  franceculture:{ name: "France Culture",  apiSlug: "france-culture" },
  mouv:         { name: "Mouv'",           apiSlug: "mouv" },
};

function detectRadioFranceStation(url: string): { name: string; apiSlug: string } | null {
  if (!url.includes("radiofrance.fr")) return null;
  for (const [key, info] of Object.entries(RADIO_FRANCE_STATIONS)) {
    if (url.includes(key)) return info;
  }
  return null;
}

/**
 * Fetch live metadata from Radio France's public API
 */
async function fetchRadioFranceLive(slug: string): Promise<{ title: string; artist: string; coverUrl: string } | null> {
  try {
    // Try the open API endpoint
    const resp = await fetch(`${RADIO_FRANCE_API}/${slug}/live`, {
      headers: { "User-Agent": "Vootify/1.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (resp.ok) {
      const data = await resp.json();
      const now = data?.now;
      if (now) {
        const title = now.secondLine || now.title || now.firstLine || "";
        const artist = now.thirdLine || now.subtitle || "";
        const cover = now.visual?.src || now.cover || "";
        if (title || artist) {
          return { title, artist, coverUrl: cover };
        }
      }
    }
  } catch { /* silent */ }

  // Alternative: scrape the grid/webapi
  try {
    const resp2 = await fetch(`https://www.radiofrance.fr/api/v2.1/stations/${slug}/grid?x-token=Undefined`, {
      headers: { "User-Agent": "Vootify/1.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (resp2.ok) {
      const grid = await resp2.json();
      const steps = grid?.steps || grid?.data?.steps || [];
      const now = Date.now() / 1000;
      const current = steps.find((s: any) => s.start <= now && s.end >= now);
      if (current) {
        const title = current.title || current.diffusion?.title || "";
        const artist = current.artists?.[0]?.name || "";
        const cover = current.visual?.src || "";
        if (title) return { title, artist, coverUrl: cover };
      }
    }
  } catch { /* silent */ }

  return null;
}

/**
 * Try to find now playing + logo via TuneIn search.
 */
async function fetchTuneInMetadata(stationName: string): Promise<{
  nowPlaying: string;
  title: string;
  artist: string;
  coverUrl: string;
  logoHd: string;
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

    // If we got artist + title, search Deezer for album art
    if (artist && title) {
      try {
        const query = `${artist} ${title}`;
        const deezerRes = await fetch(`${DEEZER_API}/search?q=${encodeURIComponent(query)}&limit=1`);
        if (deezerRes.ok) {
          const deezerData = await deezerRes.json();
          if (deezerData.data?.length > 0) {
            const track = deezerData.data[0];
            coverUrl = track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || "";
          }
        }
      } catch { /* silent */ }
    }

    return {
      nowPlaying: currentTrack,
      title,
      artist,
      coverUrl: coverUrl || logoHd,
      logoHd,
    };
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

    // ── Step 1: Detect Radio France → use their API for live metadata ──
    const rfStation = detectRadioFranceStation(streamUrl);
    if (rfStation) {
      const rfLive = await fetchRadioFranceLive(rfStation.apiSlug);
      if (rfLive && (rfLive.title || rfLive.artist)) {
        title = rfLive.title;
        artist = rfLive.artist || rfStation.name;
        coverUrl = rfLive.coverUrl || "";
        nowPlaying = artist && title ? `${artist} - ${title}` : title || `En direct sur ${rfStation.name}`;

        // If Radio France API gave us artist+title but no cover, search Deezer
        if (!coverUrl && artist && title && title !== "En direct") {
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

        // Use station cover from client as fallback
        if (!coverUrl) coverUrl = stationCover || "";
      } else {
        // Radio France detected but no live data from API — try TuneIn
        const tuneIn = await fetchTuneInMetadata(rfStation.name);
        if (tuneIn && tuneIn.title) {
          title = tuneIn.title;
          artist = tuneIn.artist || rfStation.name;
          coverUrl = tuneIn.coverUrl || stationCover || "";
          nowPlaying = tuneIn.nowPlaying;
        } else {
          nowPlaying = `En direct sur ${rfStation.name}`;
          title = "En direct";
          artist = rfStation.name;
          coverUrl = stationCover || "";
        }
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

    // Final fallback: never return relative paths like /radio-logos/...
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
