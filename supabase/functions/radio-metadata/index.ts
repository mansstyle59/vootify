import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEEZER_API = "https://api.deezer.com";
const TUNEIN_API = "https://opml.radiotime.com";
const TUNEIN_CDN = "https://cdn-profiles.tunein.com";
const RF_LIVEMETA = "https://api.radiofrance.fr/livemeta/pull";
const RADIO_FR_API = "https://prod.radio-api.net";

// ─── Radio France station mappings ───
const RADIO_FRANCE_STATIONS: Record<string, { name: string; stationId: number }> = {
  franceinter:   { name: "France Inter",    stationId: 1 },
  franceinfo:    { name: "franceinfo",      stationId: 2 },
  franceculture: { name: "France Culture",  stationId: 3 },
  francemusique: { name: "France Musique",  stationId: 4 },
  fip:           { name: "FIP",             stationId: 5 },
  mouv:          { name: "Mouv'",           stationId: 7 },
};

function detectRadioFranceStation(url: string): { name: string; stationId: number } | null {
  if (!url.includes("radiofrance.fr")) return null;
  for (const [key, info] of Object.entries(RADIO_FRANCE_STATIONS)) {
    if (url.includes(key)) return info;
  }
  return null;
}

// ─── ICY metadata cleanup ───
// Remove common prefixes/suffixes that radio stations inject into stream titles
function cleanIcyTitle(raw: string): { artist: string; title: string } {
  let cleaned = raw
    // Remove trailing station codes like "§123", " | StationName", " [Live]"
    .replace(/\s*§\d+$/g, "")
    .replace(/\s*\|.*$/g, "")
    .replace(/\s*\[live\]\s*/gi, "")
    .replace(/\s*\(live\)\s*/gi, "")
    // Remove leading station name prefixes: "StationName: Artist - Title"
    .replace(/^[^-]+:\s+(?=[^-]+-)/i, "")
    // Remove "www.station.com" or URL-like prefixes
    .replace(/^(?:https?:\/\/)?(?:www\.)?[\w.-]+\.\w+\s*[-–—]\s*/i, "")
    // Trim whitespace and trailing dots
    .replace(/\.+$/, "")
    .trim();

  if (!cleaned) return { artist: "", title: "" };

  // Try multiple separator patterns: " - ", " – ", " — ", " / "
  const separators = [" - ", " – ", " — "];
  for (const sep of separators) {
    const idx = cleaned.indexOf(sep);
    if (idx > 0) {
      const artist = cleaned.substring(0, idx).trim();
      const title = cleaned.substring(idx + sep.length).trim();
      if (artist && title) return { artist, title };
    }
  }

  // Try " / " only if no dash separator found
  if (cleaned.includes(" / ")) {
    const parts = cleaned.split(" / ");
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      return { artist: parts[0].trim(), title: parts[1].trim() };
    }
  }

  return { artist: "", title: cleaned };
}

// ─── Deezer search with smart query cleaning ───
async function searchDeezerCover(artist: string, title: string): Promise<{
  coverUrl: string; deezerArtist: string; deezerTitle: string; deezerAlbum: string;
} | null> {
  if (!artist && !title) return null;

  // Clean up search terms
  const cleanArtist = artist
    .replace(/\s*feat\.?\s+.*/i, "")   // Remove "feat. ..."
    .replace(/\s*ft\.?\s+.*/i, "")     // Remove "ft. ..."
    .replace(/\s*&\s+.*/i, "")         // Simplify "A & B" to just "A"
    .replace(/\s*,\s+.*/i, "")         // Simplify "A, B" to just "A"
    .trim();

  const cleanTitle = title
    .replace(/\s*\(.*?\)/g, "")        // Remove parenthetical content
    .replace(/\s*\[.*?\]/g, "")        // Remove bracketed content
    .replace(/\s*-\s*(?:radio edit|single|remix|remaster|version|edit).*$/i, "")
    .trim();

  // Try exact search first, then simplified
  const queries = [
    `artist:"${cleanArtist}" track:"${cleanTitle}"`,
    `${cleanArtist} ${cleanTitle}`,
  ];

  for (const q of queries) {
    try {
      const res = await fetch(`${DEEZER_API}/search?q=${encodeURIComponent(q)}&limit=3`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.data?.length) continue;

      // Find best match - prefer exact artist name match
      const artistLower = cleanArtist.toLowerCase();
      const track = data.data.find((t: any) =>
        t.artist?.name?.toLowerCase() === artistLower
      ) || data.data[0];

      const coverUrl = track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || "";
      if (coverUrl) {
        return {
          coverUrl,
          deezerArtist: track.artist?.name || artist,
          deezerTitle: track.title_short || track.title || title,
          deezerAlbum: track.album?.title || "",
        };
      }
    } catch { /* continue to next query */ }
  }
  return null;
}

// ─── Radio France livemeta API ───
async function fetchRadioFranceLive(stationId: number): Promise<{
  title: string; artist: string; coverUrl: string; album: string;
} | null> {
  const timeouts = [6000, 10000];

  for (const timeoutMs of timeouts) {
    try {
      const resp = await fetch(`${RF_LIVEMETA}/${stationId}`, {
        headers: { "User-Agent": "Vootify/1.0" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!resp.ok) continue;

      const data = await resp.json();
      const steps = data.steps || {};
      const now = Date.now() / 1000;
      const allSteps = Object.values(steps) as any[];
      const songSteps = allSteps.filter((step) => step?.embedType === "song");

      let current: any = songSteps.find((step) => step.start <= now && step.end >= now);

      // Fallback for slight clock drift / missing window alignment
      if (!current) {
        current = songSteps
          .filter((step) => step.start <= now)
          .sort((a, b) => b.start - a.start)[0] || songSteps[0] || null;
      }

      if (!current) continue;

      const title = current.title || "";
      const artist = current.authors || current.highlightedArtists?.[0] || "";
      const album = current.titreAlbum || "";

      let coverUrl = current.visual || "";
      if (coverUrl && !coverUrl.startsWith("http")) {
        coverUrl = `https://www.radiofrance.fr/s3/cruiser-production-eu3/${coverUrl}`;
      }

      if (title || artist) return { title, artist, coverUrl, album };
    } catch (e) {
      console.error(`RF livemeta error (timeout ${timeoutMs}ms):`, (e as Error).message);
    }
  }

  return null;
}

// ─── radio.fr API (prod.radio-api.net) ───
async function fetchRadioFrMetadata(stationName: string): Promise<{
  nowPlaying: string; title: string; artist: string; coverUrl: string;
} | null> {
  try {
    // Search for the station on radio.fr API
    const searchResp = await fetch(
      `${RADIO_FR_API}/stations/search?query=${encodeURIComponent(stationName)}&limit=5&pageIndex=0`,
      {
        headers: {
          "User-Agent": "Vootify/1.0",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!searchResp.ok) return null;
    const searchData = await searchResp.json();

    const stations = searchData.playables || searchData.results || searchData.stations || [];
    if (!Array.isArray(stations) || stations.length === 0) return null;

    // Find best match
    const nameNorm = stationName.toLowerCase().trim();
    const station = stations.find((s: any) => {
      const n = (s.name || s.title || "").toLowerCase().trim();
      return n === nameNorm || n.includes(nameNorm) || nameNorm.includes(n);
    }) || stations[0];

    const stationId = station.id || station.systemName;
    if (!stationId) return null;

    // Fetch now playing info
    const npResp = await fetch(`${RADIO_FR_API}/stations/${stationId}/now-playing`, {
      headers: { "User-Agent": "Vootify/1.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(4000),
    });

    if (!npResp.ok) return null;
    const npData = await npResp.json();

    const songTitle = npData.title || npData.songTitle || "";
    const songArtist = npData.artist || npData.artistName || "";

    if (!songTitle && !songArtist) return null;

    const coverUrl = npData.cover || npData.coverUrl || npData.albumCover || "";
    const nowPlaying = songArtist && songTitle ? `${songArtist} - ${songTitle}` : songTitle || songArtist;

    return { nowPlaying, title: songTitle, artist: songArtist, coverUrl };
  } catch (e) {
    console.log("radio.fr API error:", (e as Error).message);
    return null;
  }
}

// ─── TuneIn search ───
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
      const parsed = cleanIcyTitle(currentTrack);
      artist = parsed.artist;
      title = parsed.title;
    }

    if (artist && title) {
      const deezer = await searchDeezerCover(artist, title);
      if (deezer) coverUrl = deezer.coverUrl;
    }

    return { nowPlaying: currentTrack, title, artist, coverUrl: coverUrl || logoHd, logoHd };
  } catch {
    return null;
  }
}

// ─── ICY metadata extraction from stream ───
async function fetchIcyMetadata(streamUrl: string): Promise<string> {
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
      const chunks: Uint8Array[] = [];

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
          if (match) return match[1].trim();
        }
      }
    }
  } catch (e) {
    console.log("ICY fetch error:", (e as Error).message);
  } finally {
    clearTimeout(timeout);
  }
  return "";
}

// ═══════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════
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
    let album = "";
    let source = "none"; // official | stream | radio_fr | tunein | none

    const rfStation = detectRadioFranceStation(streamUrl);
    const resolvedStationName = stationName || rfStation?.name || "";

    // ── Step 1: Radio France → livemeta API (best source for RF stations) ──
    if (rfStation) {
      const rfLive = await fetchRadioFranceLive(rfStation.stationId);
      if (rfLive && (rfLive.title || rfLive.artist)) {
        title = rfLive.title;
        artist = rfLive.artist || rfStation.name;
        album = rfLive.album;
        coverUrl = rfLive.coverUrl || "";
        nowPlaying = artist && title ? `${artist} - ${title}` : title || `En direct sur ${rfStation.name}`;
        source = "official";

        if (!coverUrl && artist && title) {
          const deezer = await searchDeezerCover(artist, title);
          if (deezer) coverUrl = deezer.coverUrl;
        }
        if (!coverUrl) coverUrl = stationCover || "";

        return new Response(
          JSON.stringify({ success: true, nowPlaying, title, artist, coverUrl, album, source }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`RF livemeta unavailable for ${rfStation.name}, fallback chain enabled`);
    }

    // ── Step 2: Try ICY metadata from the stream ──
    const icyRaw = await fetchIcyMetadata(streamUrl);
    if (icyRaw) {
      const parsed = cleanIcyTitle(icyRaw);
      artist = parsed.artist;
      title = parsed.title;
      nowPlaying = icyRaw;
      source = "stream";

      if (artist && title) {
        const deezer = await searchDeezerCover(artist, title);
        if (deezer) {
          coverUrl = deezer.coverUrl;
          album = deezer.deezerAlbum;
          if (deezer.deezerArtist) artist = deezer.deezerArtist;
          if (deezer.deezerTitle) title = deezer.deezerTitle;
          nowPlaying = `${artist} - ${title}`;
        }
      }
    }

    // ── Step 3: Fallback — try radio.fr API ──
    if (!nowPlaying && resolvedStationName) {
      const radioFr = await fetchRadioFrMetadata(resolvedStationName);
      if (radioFr && (radioFr.title || radioFr.artist)) {
        nowPlaying = radioFr.nowPlaying;
        title = radioFr.title;
        artist = radioFr.artist;
        coverUrl = radioFr.coverUrl || "";
        source = "radio_fr";

        if (!coverUrl && artist && title) {
          const deezer = await searchDeezerCover(artist, title);
          if (deezer) {
            coverUrl = deezer.coverUrl;
            album = deezer.deezerAlbum;
          }
        }
      }
    }

    // ── Step 4: Fallback — TuneIn for now playing + logo ──
    if (!nowPlaying && resolvedStationName) {
      const tuneInData = await fetchTuneInMetadata(resolvedStationName);
      if (tuneInData && tuneInData.nowPlaying) {
        nowPlaying = tuneInData.nowPlaying;
        title = tuneInData.title;
        artist = tuneInData.artist;
        coverUrl = tuneInData.coverUrl || stationCover || "";
        source = "tunein";
      } else if (tuneInData?.logoHd) {
        nowPlaying = `En direct sur ${resolvedStationName}`;
        title = "En direct";
        artist = resolvedStationName;
        coverUrl = tuneInData.logoHd;
        source = "tunein";
      }
    }

    // ── Step 5: If we have metadata but no cover, try TuneIn logo ──
    if (!coverUrl && resolvedStationName) {
      try {
        const tuneInData = await fetchTuneInMetadata(resolvedStationName);
        if (tuneInData?.logoHd) coverUrl = tuneInData.logoHd;
      } catch { /* silent */ }
    }

    // ── Step 6: Generic fallback ──
    if (!nowPlaying && resolvedStationName) {
      nowPlaying = `En direct sur ${resolvedStationName}`;
      title = "En direct";
      artist = resolvedStationName;
      coverUrl = stationCover || "";
      source = "none";
    }

    // Never return relative/broken paths
    if (!coverUrl || coverUrl.startsWith("/")) {
      coverUrl = stationCover || "";
    }

    return new Response(
      JSON.stringify({ success: true, nowPlaying, title, artist, coverUrl, album, source }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
