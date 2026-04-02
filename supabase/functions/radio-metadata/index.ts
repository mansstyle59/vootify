import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEEZER_API = "https://api.deezer.com";
const RF_LIVEMETA = "https://api.radiofrance.fr/livemeta/pull";
const RADIO_FR_API = "https://prod.radio-api.net";

// ─── In-memory cache (TTL 25s) ───
const metadataCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_MS = 25_000;

function getCached(key: string): any | null {
  const entry = metadataCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    metadataCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: any) {
  metadataCache.set(key, { data, ts: Date.now() });
  if (metadataCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of metadataCache) {
      if (now - v.ts > CACHE_TTL_MS) metadataCache.delete(k);
    }
  }
}

// ─── AD-BLOCK: Detect and filter radio ads ───
const AD_PATTERNS = [
  /^pub\b/i, /\bpub\s/i, /\bpublicit[eé]/i,
  /\bad\s*break/i, /\badvert/i, /\bcommercial/i,
  /\bsponsored?\b/i, /\bsponsor\b/i,
  /\bjingle\b/i, /\bstation\s*id\b/i,
  /\bpromo(tion)?\b/i, /\bannonce\b/i,
  /^\s*-\s*$/, /^[\s.]+$/,
  /\bwww\.[a-z]/i, /\bhttps?:\/\//i,
  /\b(achetez|abonnez|profitez|offre|reduction|remise|code\s*promo)\b/i,
  /\b(appel|appelez|composez|sms|texto)\s*(le|au|now)?\s*\d/i,
  /\bflash\s*(info|actu|traffic|m[eé]t[eé]o)/i,
  /\bm[eé]t[eé]o\b/i, /\binfo\s*trafic/i, /\bhoroscope\b/i,
  /\bchronique\b/i, /\bédito(rial)?\b/i,
  /^\d{3,}\s*$/,  // just numbers
  /^radio\s/i,    // "Radio XYZ" generic station ID
];

function isAd(text: string): boolean {
  if (!text || text.length < 3) return true;
  const t = text.trim();
  // Pure URL
  if (/^https?:\/\//i.test(t)) return true;
  // Too short to be a song
  if (t.length < 4 && !t.includes("-")) return true;
  for (const p of AD_PATTERNS) {
    if (p.test(t)) return true;
  }
  return false;
}

// ─── Radio France station mappings ───
const RADIO_FRANCE_STATIONS: Record<string, { name: string; stationId: number }> = {
  franceinter:   { name: "France Inter",    stationId: 1 },
  franceinfo:    { name: "franceinfo",      stationId: 2 },
  franceculture: { name: "France Culture",  stationId: 3 },
  francemusique: { name: "France Musique",  stationId: 4 },
  fip:           { name: "FIP",             stationId: 5 },
  mouv:          { name: "Mouv'",           stationId: 6 },
};

function detectRadioFranceStation(url: string): { name: string; stationId: number } | null {
  if (!url.includes("radiofrance.fr")) return null;
  for (const [key, info] of Object.entries(RADIO_FRANCE_STATIONS)) {
    if (url.includes(key)) return info;
  }
  return null;
}

// ─── ICY metadata cleanup ───
function cleanIcyTitle(raw: string): { artist: string; title: string } {
  const cleaned = raw
    .replace(/\s*§\d+$/g, "")
    .replace(/\s*\|.*$/g, "")
    .replace(/\s*\[live\]\s*/gi, "")
    .replace(/\s*\(live\)\s*/gi, "")
    .replace(/^[^-]+:\s+(?=[^-]+-)/i, "")
    .replace(/^(?:https?:\/\/)?(?:www\.)?[\w.-]+\.\w+\s*[-–—]\s*/i, "")
    .replace(/\.+$/, "")
    .trim();

  if (!cleaned) return { artist: "", title: "" };

  const separators = [" - ", " – ", " — "];
  for (const sep of separators) {
    const idx = cleaned.indexOf(sep);
    if (idx > 0) {
      const artist = cleaned.substring(0, idx).trim();
      const title = cleaned.substring(idx + sep.length).trim();
      if (artist && title) return { artist, title };
    }
  }

  if (cleaned.includes(" / ")) {
    const parts = cleaned.split(" / ");
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      return { artist: parts[0].trim(), title: parts[1].trim() };
    }
  }

  return { artist: "", title: cleaned };
}

// ─── Normalize strings for fuzzy matching ───
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*feat\.?\s+.*/i, "")
    .replace(/\s*ft\.?\s+.*/i, "")
    .replace(/\s*\(.*?\)/g, "")
    .replace(/\s*\[.*?\]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Deezer search — enhanced with multiple strategies ───
async function searchDeezerCover(artist: string, title: string): Promise<{
  coverUrl: string; deezerArtist: string; deezerTitle: string; deezerAlbum: string;
} | null> {
  if (!artist && !title) return null;

  const cacheKey = `deezer:${artist}:${title}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const cleanArtist = artist
    .replace(/\s*feat\.?\s+.*/i, "")
    .replace(/\s*ft\.?\s+.*/i, "")
    .replace(/\s*&\s+.*/i, "")
    .replace(/\s*,\s+.*/i, "")
    .trim();

  const cleanTitle = title
    .replace(/\s*\(.*?\)/g, "")
    .replace(/\s*\[.*?\]/g, "")
    .replace(/\s*-\s*(?:radio edit|single|remix|remaster|version|edit).*$/i, "")
    .trim();

  // Multiple search strategies for better hit rate
  const queries = [
    `artist:"${cleanArtist}" track:"${cleanTitle}"`,
    `${cleanArtist} ${cleanTitle}`,
    `${cleanTitle} ${cleanArtist}`,  // reversed order
  ];

  // If title has parentheses content, also try without
  const bareTitle = cleanTitle.replace(/\s*\(.*\)/, "").trim();
  if (bareTitle !== cleanTitle && bareTitle.length > 2) {
    queries.push(`${cleanArtist} ${bareTitle}`);
  }

  const normArtist = normalize(cleanArtist);
  const normTitle = normalize(cleanTitle);

  for (const q of queries) {
    try {
      const res = await fetch(`${DEEZER_API}/search?q=${encodeURIComponent(q)}&limit=5`, {
        signal: AbortSignal.timeout(3500),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.data?.length) continue;

      // Score-based matching
      let bestMatch = data.data[0];
      let bestScore = 0;

      for (const track of data.data) {
        let score = 0;
        const tArtist = normalize(track.artist?.name || "");
        const tTitle = normalize(track.title_short || track.title || "");

        // Exact match
        if (tArtist === normArtist) score += 50;
        else if (tArtist.includes(normArtist) || normArtist.includes(tArtist)) score += 30;

        if (tTitle === normTitle) score += 50;
        else if (tTitle.includes(normTitle) || normTitle.includes(tTitle)) score += 25;

        // Word overlap
        const artistWords = normArtist.split(" ").filter(w => w.length > 2);
        const titleWords = normTitle.split(" ").filter(w => w.length > 2);
        const matchedArtistWords = artistWords.filter(w => tArtist.includes(w));
        const matchedTitleWords = titleWords.filter(w => tTitle.includes(w));
        
        if (artistWords.length > 0) score += (matchedArtistWords.length / artistWords.length) * 20;
        if (titleWords.length > 0) score += (matchedTitleWords.length / titleWords.length) * 20;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = track;
        }
      }

      // Only accept if minimum confidence
      if (bestScore < 30 && queries.indexOf(q) < queries.length - 1) continue;

      const coverUrl = bestMatch.album?.cover_xl || bestMatch.album?.cover_big || bestMatch.album?.cover_medium || "";
      if (coverUrl) {
        const result = {
          coverUrl,
          deezerArtist: bestMatch.artist?.name || artist,
          deezerTitle: bestMatch.title_short || bestMatch.title || title,
          deezerAlbum: bestMatch.album?.title || "",
        };
        setCache(cacheKey, result);
        return result;
      }
    } catch { /* continue */ }
  }
  return null;
}

// ─── Radio France livemeta API ───
async function fetchRadioFranceLive(stationId: number): Promise<{
  title: string; artist: string; coverUrl: string; album: string;
} | null> {
  const cacheKey = `rf:${stationId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

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

      if (!current) {
        current = songSteps
          .filter((step) => step.start <= now)
          .sort((a, b) => b.start - a.start)[0] || songSteps[0] || null;
      }

      if (!current) continue;

      const title = current.title || "";
      const artist = current.authors || current.highlightedArtists?.[0] || "";
      const album = current.titreAlbum || "";

      // Filter ads from Radio France
      if (isAd(`${artist} - ${title}`)) continue;

      let coverUrl = current.visual || "";
      if (coverUrl && !coverUrl.startsWith("http")) {
        coverUrl = `https://www.radiofrance.fr/s3/cruiser-production-eu3/${coverUrl}`;
      }

      if (title || artist) {
        const result = { title, artist, coverUrl, album };
        setCache(cacheKey, result);
        return result;
      }
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
  const cacheKey = `radiofr:${stationName}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const searchResp = await fetch(
      `${RADIO_FR_API}/stations/search?query=${encodeURIComponent(stationName)}&limit=5&pageIndex=0`,
      {
        headers: { "User-Agent": "Vootify/1.0", "Accept": "application/json" },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!searchResp.ok) return null;
    const searchData = await searchResp.json();

    const stations = searchData.playables || searchData.results || searchData.stations || [];
    if (!Array.isArray(stations) || stations.length === 0) return null;

    const nameNorm = stationName.toLowerCase().trim();
    const station = stations.find((s: any) => {
      const n = (s.name || s.title || "").toLowerCase().trim();
      return n === nameNorm || n.includes(nameNorm) || nameNorm.includes(n);
    }) || stations[0];

    const stationId = station.id || station.systemName;
    if (!stationId) return null;

    const npResp = await fetch(`${RADIO_FR_API}/stations/${stationId}/now-playing`, {
      headers: { "User-Agent": "Vootify/1.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(4000),
    });

    if (!npResp.ok) return null;
    const npData = await npResp.json();

    const songTitle = npData.title || npData.songTitle || "";
    const songArtist = npData.artist || npData.artistName || "";

    if (!songTitle && !songArtist) return null;

    // Filter ads
    if (isAd(`${songArtist} - ${songTitle}`)) return null;

    const coverUrl = npData.cover || npData.coverUrl || npData.albumCover || "";
    const nowPlaying = songArtist && songTitle ? `${songArtist} - ${songTitle}` : songTitle || songArtist;

    const result = { nowPlaying, title: songTitle, artist: songArtist, coverUrl };
    setCache(cacheKey, result);
    return result;
  } catch (e) {
    console.log("radio.fr API error:", (e as Error).message);
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
    const { streamUrl, stationName, stationCover, force } = await req.json();
    if (!streamUrl) {
      return new Response(JSON.stringify({ success: false, error: "No streamUrl" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Check full-response cache first (skip if force refresh) ──
    const responseCacheKey = `resp:${streamUrl}:${stationName || ""}`;
    if (!force) {
      const cachedResponse = getCached(responseCacheKey);
      if (cachedResponse) {
        return new Response(JSON.stringify(cachedResponse), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Force: invalidate cache for this key
      metadataCache.delete(responseCacheKey);
      // Also invalidate sub-caches
      for (const [k] of metadataCache) {
        if (k.startsWith(`rf:`) || k.startsWith(`radiofr:`) || k.startsWith(`resp:${streamUrl}`)) {
          metadataCache.delete(k);
        }
      }
    }

    let nowPlaying = "";
    let title = "";
    let artist = "";
    let coverUrl = "";
    let album = "";
    let source = "none"; // official | stream | radio_fr | none

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
          if (deezer) {
            coverUrl = deezer.coverUrl;
            album = deezer.deezerAlbum || album;
          }
        }
        if (!coverUrl) coverUrl = stationCover || "";

        const responseData = { success: true, nowPlaying, title, artist, coverUrl, album, source };
        setCache(responseCacheKey, responseData);

        return new Response(JSON.stringify(responseData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`RF livemeta unavailable for ${rfStation.name}, fallback chain enabled`);
    }

    // ── Step 2: Try radio.fr API (official metadata) ──
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

    // ── Step 3: Fallback — ICY metadata from stream ──
    if (!nowPlaying) {
      const icyRaw = await fetchIcyMetadata(streamUrl);
      if (icyRaw) {
        // Ad-block: filter out ads from ICY stream
        if (isAd(icyRaw)) {
          // Return last known good metadata or station info
          const responseData = {
            success: true,
            nowPlaying: `En direct sur ${resolvedStationName || "Radio"}`,
            title: "En direct",
            artist: resolvedStationName || "Radio",
            coverUrl: stationCover || "",
            album: "",
            source: "none",
            adFiltered: true,
          };
          return new Response(JSON.stringify(responseData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

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
        } else if (title && !artist) {
          // Try searching with just the title
          const deezer = await searchDeezerCover("", title);
          if (deezer) {
            coverUrl = deezer.coverUrl;
            album = deezer.deezerAlbum;
            artist = deezer.deezerArtist || "";
            title = deezer.deezerTitle || title;
            if (artist) nowPlaying = `${artist} - ${title}`;
          }
        }
      }
    }

    // ── Step 4: Generic fallback ──
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

    const responseData = { success: true, nowPlaying, title, artist, coverUrl, album, source };
    setCache(responseCacheKey, responseData);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
