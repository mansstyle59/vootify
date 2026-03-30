import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEEZER_API = "https://api.deezer.com";
const TUNEIN_API = "https://opml.radiotime.com";
const TUNEIN_CDN = "https://cdn-profiles.tunein.com";

// Known Radio France station mappings: URL pattern → station info
const RADIO_FRANCE_STATIONS: Record<string, { name: string; logo: string }> = {
  franceinter: { name: "France Inter", logo: "/radio-logos/france-inter.png" },
  franceinfo: { name: "franceinfo", logo: "/radio-logos/franceinfo.png" },
  fip: { name: "FIP", logo: "/radio-logos/fip.png" },
  francemusique: { name: "France Musique", logo: "/radio-logos/france-musique.png" },
  franceculture: { name: "France Culture", logo: "/radio-logos/france-culture.png" },
  mouv: { name: "Mouv'", logo: "/radio-logos/mouv.png" },
};

function detectRadioFranceStation(url: string): { name: string; logo: string } | null {
  if (!url.includes("radiofrance.fr")) return null;
  for (const [key, info] of Object.entries(RADIO_FRANCE_STATIONS)) {
    if (url.includes(key)) return info;
  }
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
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const body = data.body || [];

    // Find best matching station
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

    // Fallback to first station result
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

    // If we got artist + title from TuneIn, search Deezer for album art
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
      } catch {
        // use station logo as fallback
      }
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let nowPlaying = "";

    // ── Step 1: Try ICY metadata from the stream ──
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
      console.log("ICY fetch error:", e.message);
    } finally {
      clearTimeout(timeout);
    }

    let title = "";
    let artist = "";
    let coverUrl = "";

    // ── Step 2: If ICY gave us metadata, parse & search Deezer for cover art ──
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
          const query = `${artist} ${title}`;
          const deezerRes = await fetch(`${DEEZER_API}/search?q=${encodeURIComponent(query)}&limit=1`);
          if (deezerRes.ok) {
            const deezerData = await deezerRes.json();
            if (deezerData.data?.length > 0) {
              const track = deezerData.data[0];
              coverUrl = track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || "";
            }
          }
        } catch (e) {
          console.log("Deezer search error:", e.message);
        }
      }
    }

    // ── Step 3: Fallback — detect Radio France station ──
    if (!nowPlaying) {
      const station = detectRadioFranceStation(streamUrl);
      if (station) {
        nowPlaying = `En direct sur ${station.name}`;
        title = "En direct";
        artist = station.name;
        coverUrl = station.logo;
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
        // At least we got a good logo
        nowPlaying = `En direct sur ${stationName}`;
        title = "En direct";
        artist = stationName;
        coverUrl = tuneInData.logoHd;
      }
    }

    // ── Step 5: If still no cover from Deezer, try TuneIn logo ──
    if (!coverUrl && stationName) {
      try {
        const tuneInData = await fetchTuneInMetadata(stationName);
        if (tuneInData?.logoHd) {
          coverUrl = tuneInData.logoHd;
        }
      } catch {
        // silent
      }
    }

    // ── Step 6: Generic fallback — use station name from client ──
    if (!nowPlaying && stationName) {
      nowPlaying = `En direct sur ${stationName}`;
      title = "En direct";
      artist = stationName;
      coverUrl = stationCover || "";
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
