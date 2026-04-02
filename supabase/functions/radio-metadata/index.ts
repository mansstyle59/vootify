import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEEZER_API = "https://api.deezer.com";
const RF_LIVEMETA = "https://api.radiofrance.fr/livemeta/pull";
const RADIO_FR_API = "https://prod.radio-api.net";
const ITUNES_SEARCH = "https://itunes.apple.com/search";

// ─── In-memory cache (TTL 20s) ───
const metadataCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_MS = 20_000;

function getCached(key: string): any | null {
  const entry = metadataCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { metadataCache.delete(key); return null; }
  return entry.data;
}

function setCache(key: string, data: any) {
  metadataCache.set(key, { data, ts: Date.now() });
  if (metadataCache.size > 300) {
    const now = Date.now();
    for (const [k, v] of metadataCache) {
      if (now - v.ts > CACHE_TTL_MS) metadataCache.delete(k);
    }
  }
}

// ─── AD-BLOCK: Intelligent radio ad filtering ───

// Known ad/jingle artist names
const AD_ARTISTS = new Set([
  "pub", "publicité", "jingle", "radio", "station id", "promo",
  "annonce", "sponsor", "advertisement", "commercial break",
  "flash info", "météo", "horoscope", "trafic", "info trafic",
]);

// Known ad network / syndication patterns in titles
const AD_TITLE_PATTERNS = [
  /^pub\b/i, /\bpub\s/i, /\bpub$/i, /\bpublicit[eé]/i,
  /\bad[\s_-]*break/i, /\badvert(isement)?/i, /\bcommercial/i,
  /\bsponsore?d?\b/i, /\bsponsor\b/i,
  /\bjingle\b/i, /\bstation[\s_-]*id\b/i,
  /\bpromo(tion)?\b/i, /\bannonce\b/i,
  /^\s*-\s*$/, /^[\s.]+$/, /^[*_#~]+$/,
  /\bwww\.[a-z]/i, /\bhttps?:\/\//i,
  // French CTA / commerce
  /\b(achetez|abonnez|profitez|offre|r[eé]duction|remise|code[\s_]*promo)\b/i,
  /\b(appel|appelez|composez|sms|texto)\s*(le|au|now)?\s*\d/i,
  /\b(num[eé]ro|t[eé]l[eé]phone|gratuit|essai\s*gratuit)\b/i,
  /\b(livraison|commandez|code\s*\w{3,8})\b/i,
  // News / info breaks
  /\bflash\s*(info|actu|traffic|m[eé]t[eé]o)/i,
  /\bm[eé]t[eé]o\b/i, /\binfo[\s_-]*trafic/i, /\bhoroscope\b/i,
  /\bchronique\b/i, /\b[eé]dito(rial)?\b/i,
  /\bbulletin\b/i, /\bjournal\b/i,
  // Station self-promo
  /^\d{3,}\s*$/, /^radio\s/i,
  /\b(ici|ceci est|vous [eé]coutez|bienvenue sur|restez [aà] l'[eé]coute)\b/i,
  /\b(on continue|apr[eè]s la pause|tout de suite|dans un instant)\b/i,
  // English ad patterns
  /\b(buy now|shop now|limited offer|click here|subscribe now|free trial)\b/i,
  /\b(call now|text\s+\d|dial\s+\d)\b/i,
  /\b(brought to you|presented by|powered by)\b/i,
];

// Heuristic: ultra-short titles or titles with only numbers/symbols
const SUSPICIOUS_LENGTH_MIN = 3;
const SUSPICIOUS_LENGTH_MAX_NO_SPACE = 2; // Single words under 3 chars

function isAd(text: string): boolean {
  if (!text || text.length < SUSPICIOUS_LENGTH_MIN) return true;
  const t = text.trim();
  if (/^https?:\/\//i.test(t)) return true;
  if (t.length <= SUSPICIOUS_LENGTH_MAX_NO_SPACE && !t.includes("-")) return true;

  // Check if it's ONLY numbers, symbols, or whitespace
  if (/^[\d\s\W]+$/.test(t) && t.length < 20) return true;

  // Check known ad artist names
  const lower = t.toLowerCase();
  for (const adArtist of AD_ARTISTS) {
    if (lower === adArtist || lower.startsWith(adArtist + " ") || lower.endsWith(" " + adArtist)) return true;
  }

  // Check patterns
  for (const p of AD_TITLE_PATTERNS) { if (p.test(t)) return true; }

  // Heuristic: too many uppercase words in short text = likely station ID / promo
  const words = t.split(/\s+/);
  if (words.length <= 3) {
    const upperWords = words.filter(w => w === w.toUpperCase() && w.length > 1);
    if (upperWords.length === words.length && !t.includes("-")) return true;
  }

  return false;
}

/** Check both artist and title separately for ad content */
function isAdContent(artist: string, title: string): boolean {
  if (isAd(`${artist} - ${title}`)) return true;
  // Also check them individually — a known ad artist with any title = ad
  if (artist && AD_ARTISTS.has(artist.toLowerCase().trim())) return true;
  if (title && isAd(title)) return true;
  return false;
}

// ─── Radio France station mappings (with logo URLs) ───
const RADIO_FRANCE_STATIONS: Record<string, { name: string; stationId: number; logo?: string }> = {
  franceinter:   { name: "France Inter",    stationId: 1, logo: "https://www.radiofrance.fr/s3/cruiser-production/2022/05/8a8e3e5a-e1e1-4f88-8d84-4b6e2e0dba95/200x200_rf_omm_0000026085_dnc.0057.jpg" },
  franceinfo:    { name: "franceinfo",      stationId: 2, logo: "https://www.radiofrance.fr/s3/cruiser-production/2022/05/87d93c76-b6db-43c4-a7e4-7e3c9e6d6c10/200x200_rf_omm_0000026086_dnc.0057.jpg" },
  franceculture: { name: "France Culture",  stationId: 3 },
  francemusique: { name: "France Musique",  stationId: 4 },
  fip:           { name: "FIP",             stationId: 5 },
  mouv:          { name: "Mouv'",           stationId: 6 },
};

function detectRadioFranceStation(url: string): { name: string; stationId: number; logo?: string } | null {
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

  const queries = [
    `artist:"${cleanArtist}" track:"${cleanTitle}"`,
    `${cleanArtist} ${cleanTitle}`,
    `${cleanTitle} ${cleanArtist}`,
  ];

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

      let bestMatch = data.data[0];
      let bestScore = 0;

      for (const track of data.data) {
        let score = 0;
        const tArtist = normalize(track.artist?.name || "");
        const tTitle = normalize(track.title_short || track.title || "");

        if (tArtist === normArtist) score += 50;
        else if (tArtist.includes(normArtist) || normArtist.includes(tArtist)) score += 30;

        if (tTitle === normTitle) score += 50;
        else if (tTitle.includes(normTitle) || normTitle.includes(tTitle)) score += 25;

        const artistWords = normArtist.split(" ").filter(w => w.length > 2);
        const titleWords = normTitle.split(" ").filter(w => w.length > 2);
        const matchedArtistWords = artistWords.filter(w => tArtist.includes(w));
        const matchedTitleWords = titleWords.filter(w => tTitle.includes(w));

        if (artistWords.length > 0) score += (matchedArtistWords.length / artistWords.length) * 20;
        if (titleWords.length > 0) score += (matchedTitleWords.length / titleWords.length) * 20;

        if (score > bestScore) { bestScore = score; bestMatch = track; }
      }

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

// ─── iTunes / Apple Music search (fallback for cover art) ───
async function searchiTunesCover(artist: string, title: string): Promise<string | null> {
  if (!artist && !title) return null;
  const cacheKey = `itunes:${artist}:${title}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const q = `${artist} ${title}`.trim();
    const res = await fetch(
      `${ITUNES_SEARCH}?term=${encodeURIComponent(q)}&media=music&entity=song&limit=3`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results?.length) return null;

    const normA = normalize(artist);
    const normT = normalize(title);

    for (const r of data.results) {
      const rA = normalize(r.artistName || "");
      const rT = normalize(r.trackName || "");
      if ((rA.includes(normA) || normA.includes(rA)) && (rT.includes(normT) || normT.includes(rT))) {
        // Get high-res artwork (600x600)
        const url = (r.artworkUrl100 || "").replace("100x100", "600x600");
        if (url) { setCache(cacheKey, url); return url; }
      }
    }
    // Fallback: return first result if no exact match
    const url = (data.results[0].artworkUrl100 || "").replace("100x100", "600x600");
    if (url) { setCache(cacheKey, url); return url; }
  } catch { /* ignore */ }
  return null;
}

// ─── Radio France livemeta API (enhanced: shows + songs) ───
async function fetchRadioFranceLive(stationId: number): Promise<{
  title: string; artist: string; coverUrl: string; album: string;
  showName?: string; showCover?: string; isShow?: boolean;
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

      // Get current show info (concept/expression)
      const showSteps = allSteps.filter((s) => s?.embedType === "expression" || s?.embedType === "concept");
      const currentShow = showSteps.find((s) => s.start <= now && s.end >= now)
        || showSteps.filter((s) => s.start <= now).sort((a, b) => b.start - a.start)[0];

      const showName = currentShow?.title || currentShow?.concept?.title || "";
      let showCover = currentShow?.visual || currentShow?.concept?.visual || "";
      if (showCover && !showCover.startsWith("http")) {
        showCover = `https://www.radiofrance.fr/s3/cruiser-production-eu3/${showCover}`;
      }

      // Get current song
      const songSteps = allSteps.filter((step) => step?.embedType === "song");
      let current: any = songSteps.find((step) => step.start <= now && step.end >= now);
      if (!current) {
        current = songSteps.filter((step) => step.start <= now)
          .sort((a, b) => b.start - a.start)[0] || songSteps[0] || null;
      }

      // If no song but we have a show → return show info (talk/emission)
      if (!current && showName) {
        const result = {
          title: showName,
          artist: "",
          coverUrl: showCover || "",
          album: "",
          showName,
          showCover: showCover || "",
          isShow: true,
        };
        setCache(cacheKey, result);
        return result;
      }

      if (!current) continue;

      const title = current.title || "";
      const artist = current.authors || current.highlightedArtists?.[0] || "";
      const album = current.titreAlbum || "";

      if (isAdContent(artist, title)) continue;

      let coverUrl = current.visual || "";
      if (coverUrl && !coverUrl.startsWith("http")) {
        coverUrl = `https://www.radiofrance.fr/s3/cruiser-production-eu3/${coverUrl}`;
      }

      if (title || artist) {
        const result = { title, artist, coverUrl, album, showName, showCover, isShow: false };
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

// ─── Multi-source cover art resolution ───
async function resolveCoverArt(artist: string, title: string, existingCover?: string): Promise<{
  coverUrl: string; album: string; resolvedArtist: string; resolvedTitle: string;
}> {
  // 1. Try Deezer first (best cover quality)
  const deezer = await searchDeezerCover(artist, title);
  if (deezer?.coverUrl) {
    return {
      coverUrl: deezer.coverUrl,
      album: deezer.deezerAlbum,
      resolvedArtist: deezer.deezerArtist || artist,
      resolvedTitle: deezer.deezerTitle || title,
    };
  }

  // 2. Fallback to iTunes/Apple Music
  const itunesCover = await searchiTunesCover(artist, title);
  if (itunesCover) {
    return { coverUrl: itunesCover, album: "", resolvedArtist: artist, resolvedTitle: title };
  }

  // 3. Use existing cover
  return {
    coverUrl: existingCover || "",
    album: "",
    resolvedArtist: artist,
    resolvedTitle: title,
  };
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

    // ── Check full-response cache first ──
    const responseCacheKey = `resp:${streamUrl}:${stationName || ""}`;
    if (!force) {
      const cachedResponse = getCached(responseCacheKey);
      if (cachedResponse) {
        return new Response(JSON.stringify(cachedResponse), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      metadataCache.delete(responseCacheKey);
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
    let source = "none";
    let showName = "";
    let showCover = "";
    let isShow = false;

    const rfStation = detectRadioFranceStation(streamUrl);
    const resolvedStationName = stationName || rfStation?.name || "";

    // ── Step 1: Radio France → livemeta API ──
    if (rfStation) {
      const rfLive = await fetchRadioFranceLive(rfStation.stationId);
      if (rfLive) {
        if (rfLive.isShow) {
          // Talk show / emission — use show cover
          title = rfLive.title;
          artist = rfStation.name;
          coverUrl = rfLive.showCover || rfLive.coverUrl || rfStation.logo || stationCover || "";
          nowPlaying = `${rfStation.name} — ${rfLive.title}`;
          showName = rfLive.showName || "";
          showCover = rfLive.showCover || "";
          isShow = true;
          source = "official";
        } else if (rfLive.title || rfLive.artist) {
          title = rfLive.title;
          artist = rfLive.artist || rfStation.name;
          album = rfLive.album;
          coverUrl = rfLive.coverUrl || "";
          showName = rfLive.showName || "";
          showCover = rfLive.showCover || "";
          nowPlaying = artist && title ? `${artist} - ${title}` : title || `En direct sur ${rfStation.name}`;
          source = "official";

          // Enrich cover from multiple sources
          if (!coverUrl && artist && title) {
            const resolved = await resolveCoverArt(artist, title, stationCover);
            coverUrl = resolved.coverUrl;
            album = resolved.album || album;
          }
        }

        if (source === "official") {
          if (!coverUrl) coverUrl = rfStation.logo || stationCover || "";
          const responseData = {
            success: true, nowPlaying, title, artist, coverUrl, album, source,
            showName, showCover, isShow,
          };
          setCache(responseCacheKey, responseData);
          return new Response(JSON.stringify(responseData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // ── Step 2: Try radio.fr API ──
    if (!nowPlaying && resolvedStationName) {
      const radioFr = await fetchRadioFrMetadata(resolvedStationName);
      if (radioFr && (radioFr.title || radioFr.artist)) {
        nowPlaying = radioFr.nowPlaying;
        title = radioFr.title;
        artist = radioFr.artist;
        coverUrl = radioFr.coverUrl || "";
        source = "radio_fr";

        if (!coverUrl && artist && title) {
          const resolved = await resolveCoverArt(artist, title, stationCover);
          coverUrl = resolved.coverUrl;
          album = resolved.album;
        }
      }
    }

    // ── Step 3: Fallback — ICY metadata from stream ──
    if (!nowPlaying) {
      const icyRaw = await fetchIcyMetadata(streamUrl);
      if (icyRaw) {
        if (isAd(icyRaw)) {
          const responseData = {
            success: true,
            nowPlaying: `En direct sur ${resolvedStationName || "Radio"}`,
            title: "En direct", artist: resolvedStationName || "Radio",
            coverUrl: stationCover || "", album: "", source: "none",
            adFiltered: true, showName: "", showCover: "", isShow: false,
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
          const resolved = await resolveCoverArt(artist, title, stationCover);
          coverUrl = resolved.coverUrl;
          album = resolved.album;
          if (resolved.resolvedArtist) artist = resolved.resolvedArtist;
          if (resolved.resolvedTitle) title = resolved.resolvedTitle;
          nowPlaying = `${artist} - ${title}`;
        } else if (title && !artist) {
          const resolved = await resolveCoverArt("", title, stationCover);
          coverUrl = resolved.coverUrl;
          album = resolved.album;
          artist = resolved.resolvedArtist || "";
          title = resolved.resolvedTitle || title;
          if (artist) nowPlaying = `${artist} - ${title}`;
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

    if (!coverUrl || coverUrl.startsWith("/")) {
      coverUrl = stationCover || "";
    }

    const responseData = {
      success: true, nowPlaying, title, artist, coverUrl, album, source,
      showName, showCover, isShow,
    };
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
