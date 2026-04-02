import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEEZER_API = "https://api.deezer.com";
const RF_LIVEMETA = "https://api.radiofrance.fr/livemeta/pull";
const RADIO_FR_API = "https://prod.radio-api.net";
const ITUNES_SEARCH = "https://itunes.apple.com/search";

// ─── In-memory cache (TTL 15s) ───
const metadataCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_MS = 15_000;

function getCached(key: string): any | null {
  const entry = metadataCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { metadataCache.delete(key); return null; }
  return entry.data;
}

function setCache(key: string, data: any, ttl?: number) {
  metadataCache.set(key, { data, ts: Date.now() });
  if (metadataCache.size > 400) {
    const now = Date.now();
    for (const [k, v] of metadataCache) {
      if (now - v.ts > (ttl || CACHE_TTL_MS)) metadataCache.delete(k);
    }
  }
}

// ─── AD-BLOCK: Intelligent radio ad filtering ───
const AD_ARTISTS = new Set([
  "pub", "publicité", "jingle", "radio", "station id", "promo",
  "annonce", "sponsor", "advertisement", "commercial break",
  "flash info", "météo", "horoscope", "trafic", "info trafic",
]);

const AD_TITLE_PATTERNS = [
  /^pub\b/i, /\bpub\s/i, /\bpub$/i, /\bpublicit[eé]/i,
  /\bad[\s_-]*break/i, /\badvert(isement)?/i, /\bcommercial/i,
  /\bsponsore?d?\b/i, /\bsponsor\b/i,
  /\bjingle\b/i, /\bstation[\s_-]*id\b/i,
  /\bpromo(tion)?\b/i, /\bannonce\b/i,
  /^\s*-\s*$/, /^[\s.]+$/, /^[*_#~]+$/,
  /\bwww\.[a-z]/i, /\bhttps?:\/\//i,
  /\b(achetez|abonnez|profitez|offre|r[eé]duction|remise|code[\s_]*promo)\b/i,
  /\b(appel|appelez|composez|sms|texto)\s*(le|au|now)?\s*\d/i,
  /\b(num[eé]ro|t[eé]l[eé]phone|gratuit|essai\s*gratuit)\b/i,
  /\b(livraison|commandez|code\s*\w{3,8})\b/i,
  /\bflash\s*(info|actu|traffic|m[eé]t[eé]o)/i,
  /\bm[eé]t[eé]o\b/i, /\binfo[\s_-]*trafic/i, /\bhoroscope\b/i,
  /\bchronique\b/i, /\b[eé]dito(rial)?\b/i,
  /\bbulletin\b/i, /\bjournal\b/i,
  /^\d{3,}\s*$/, /^radio\s/i,
  /\b(ici|ceci est|vous [eé]coutez|bienvenue sur|restez [aà] l'[eé]coute)\b/i,
  /\b(on continue|apr[eè]s la pause|tout de suite|dans un instant)\b/i,
  /\b(buy now|shop now|limited offer|click here|subscribe now|free trial)\b/i,
  /\b(call now|text\s+\d|dial\s+\d)\b/i,
  /\b(brought to you|presented by|powered by)\b/i,
];

const SUSPICIOUS_LENGTH_MIN = 3;

function isAd(text: string): boolean {
  if (!text || text.length < SUSPICIOUS_LENGTH_MIN) return true;
  const t = text.trim();
  if (/^https?:\/\//i.test(t)) return true;
  if (t.length <= 2 && !t.includes("-")) return true;
  if (/^[\d\s\W]+$/.test(t) && t.length < 20) return true;
  const lower = t.toLowerCase();
  for (const adArtist of AD_ARTISTS) {
    if (lower === adArtist || lower.startsWith(adArtist + " ") || lower.endsWith(" " + adArtist)) return true;
  }
  for (const p of AD_TITLE_PATTERNS) { if (p.test(t)) return true; }
  const words = t.split(/\s+/);
  if (words.length <= 3) {
    const upperWords = words.filter(w => w === w.toUpperCase() && w.length > 1);
    if (upperWords.length === words.length && !t.includes("-")) return true;
  }
  return false;
}

function isAdContent(artist: string, title: string): boolean {
  if (isAd(`${artist} - ${title}`)) return true;
  if (artist && AD_ARTISTS.has(artist.toLowerCase().trim())) return true;
  if (title && isAd(title)) return true;
  return false;
}

// ─── programmes-radio.com API ───
const PROGRADIO_API = "https://api.programmes-radio.com";
const PROGRADIO_CDN = "https://cdn.radio-addict.com/media/cache/page_thumb/media/program";

// Extended: support commercial stations too
const PROGRADIO_STATION_MAP: Record<string, string> = {
  franceinter: "franceinter",
  franceinfo: "franceinfo",
  franceculture: "franceculture",
  francemusique: "francemusique",
  fip: "fip",
  mouv: "mouv",
  nrj: "nrj",
  skyrock: "skyrock",
  "fun radio": "funradio",
  funradio: "funradio",
  nostalgie: "nostalgie",
  "cherie fm": "cheriefm",
  "chérie fm": "cheriefm",
  rfm: "rfm",
  "rire et chansons": "rireetchansons",
  rtl2: "rtl2",
  rtl: "rtl",
  "virgin radio": "virginradio",
  europe1: "europe1",
  "europe 1": "europe1",
  "radio nova": "nova",
  nova: "nova",
  "radio classique": "radioclassique",
  "sud radio": "sudradio",
  voltage: "voltage",
  "contact fm": "contactfm",
  "ouï fm": "ouifm",
  "oui fm": "ouifm",
  "tsf jazz": "tsfjazz",
  latina: "latina",
  "radio latina": "latina",
  generations: "generations",
};

interface ProgRadioShow {
  title: string;
  description: string;
  pictureUrl: string;
  startAt: string;
  endAt: string;
}

function resolveProgRadioCode(stationName: string): string | null {
  const n = stationName.toLowerCase().trim().replace(/['']/g, "'").replace(/\s+/g, " ");
  if (PROGRADIO_STATION_MAP[n]) return PROGRADIO_STATION_MAP[n];
  for (const [key, code] of Object.entries(PROGRADIO_STATION_MAP)) {
    if (n.includes(key) || key.includes(n)) return code;
  }
  return null;
}

async function fetchProgRadioSchedule(stationCode: string): Promise<ProgRadioShow | null> {
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `progradio:${stationCode}:${today}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const resp = await fetch(`${PROGRADIO_API}/schedule/${today}?r=${stationCode}`, {
      headers: { "User-Agent": "Vootify/1.0", "Referer": "https://www.programmes-radio.com/" },
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const schedule = data?.schedule?.[stationCode]?.[stationCode];
    if (!schedule || typeof schedule !== "object") return null;

    const now = new Date();
    const shows = Object.values(schedule) as any[];
    const currentShow = shows.find((show: any) => {
      const start = new Date(show.start_at);
      const end = new Date(show.end_at);
      return start <= now && now <= end;
    });

    if (!currentShow) return null;
    const pictureUrl = currentShow.picture_url ? `${PROGRADIO_CDN}/${currentShow.picture_url}` : "";
    const result: ProgRadioShow = {
      title: currentShow.title || "",
      description: currentShow.description || "",
      pictureUrl,
      startAt: currentShow.start_at,
      endAt: currentShow.end_at,
    };
    setCache(cacheKey, result);
    return result;
  } catch (e) {
    console.log("programmes-radio.com error:", (e as Error).message);
    return null;
  }
}

// ─── programmes-radio.com now-playing (song-level) via schedule parsing ───
async function fetchProgRadioNowPlaying(stationCode: string): Promise<{
  title: string; artist: string; coverUrl: string;
} | null> {
  // The /now/ endpoint doesn't exist on programmes-radio.com
  // Instead we only have schedule data (show-level, not song-level)
  // This function is kept as a stub for future API support
  return null;
}

// ─── Radio France station mappings ───
const RADIO_FRANCE_STATIONS: Record<string, { name: string; stationId: number; logo?: string; progCode?: string }> = {
  franceinter:   { name: "France Inter",    stationId: 1, progCode: "franceinter", logo: "https://www.radiofrance.fr/s3/cruiser-production/2022/05/8a8e3e5a-e1e1-4f88-8d84-4b6e2e0dba95/200x200_rf_omm_0000026085_dnc.0057.jpg" },
  franceinfo:    { name: "franceinfo",      stationId: 2, progCode: "franceinfo", logo: "https://www.radiofrance.fr/s3/cruiser-production/2022/05/87d93c76-b6db-43c4-a7e4-7e3c9e6d6c10/200x200_rf_omm_0000026086_dnc.0057.jpg" },
  franceculture: { name: "France Culture",  stationId: 3, progCode: "franceculture" },
  francemusique: { name: "France Musique",  stationId: 4, progCode: "francemusique" },
  fip:           { name: "FIP",             stationId: 5, progCode: "fip" },
  mouv:          { name: "Mouv'",           stationId: 6, progCode: "mouv" },
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

// ─── Normalize for fuzzy matching ───
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*feat\.?\s+.*/i, "").replace(/\s*ft\.?\s+.*/i, "")
    .replace(/\s*\(.*?\)/g, "").replace(/\s*\[.*?\]/g, "")
    .replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// ─── Deezer search — HD cover priority ───
async function searchDeezerCover(artist: string, title: string): Promise<{
  coverUrl: string; deezerArtist: string; deezerTitle: string; deezerAlbum: string;
} | null> {
  if (!artist && !title) return null;
  const cacheKey = `deezer:${artist}:${title}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const cleanArtist = artist.replace(/\s*feat\.?\s+.*/i, "").replace(/\s*ft\.?\s+.*/i, "")
    .replace(/\s*&\s+.*/i, "").replace(/\s*,\s+.*/i, "").trim();
  const cleanTitle = title.replace(/\s*\(.*?\)/g, "").replace(/\s*\[.*?\]/g, "")
    .replace(/\s*-\s*(?:radio edit|single|remix|remaster|version|edit).*$/i, "").trim();

  const queries = [
    `artist:"${cleanArtist}" track:"${cleanTitle}"`,
    `${cleanArtist} ${cleanTitle}`,
    `${cleanTitle} ${cleanArtist}`,
  ];
  const bareTitle = cleanTitle.replace(/\s*\(.*\)/, "").trim();
  if (bareTitle !== cleanTitle && bareTitle.length > 2) queries.push(`${cleanArtist} ${bareTitle}`);

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

      // Prefer XL (1000x1000) > big (500x500) > medium
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

// ─── iTunes / Apple Music search (fallback) ───
async function searchiTunesCover(artist: string, title: string): Promise<string | null> {
  if (!artist && !title) return null;
  const cacheKey = `itunes:${artist}:${title}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const q = `${artist} ${title}`.trim();
    const res = await fetch(`${ITUNES_SEARCH}?term=${encodeURIComponent(q)}&media=music&entity=song&limit=3`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results?.length) return null;

    const normA = normalize(artist);
    const normT = normalize(title);
    for (const r of data.results) {
      const rA = normalize(r.artistName || "");
      const rT = normalize(r.trackName || "");
      if ((rA.includes(normA) || normA.includes(rA)) && (rT.includes(normT) || normT.includes(rT))) {
        const url = (r.artworkUrl100 || "").replace("100x100", "600x600");
        if (url) { setCache(cacheKey, url); return url; }
      }
    }
    const url = (data.results[0].artworkUrl100 || "").replace("100x100", "600x600");
    if (url) { setCache(cacheKey, url); return url; }
  } catch { /* ignore */ }
  return null;
}

// ─── Radio France livemeta API ───
async function fetchRadioFranceLive(stationId: number): Promise<{
  title: string; artist: string; coverUrl: string; album: string;
  showName?: string; showCover?: string; isShow?: boolean; hasSongData?: boolean;
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

      const showSteps = allSteps.filter((s) => s?.embedType === "expression" || s?.embedType === "concept");
      const currentShow = showSteps.find((s) => s.start <= now && s.end >= now)
        || showSteps.filter((s) => s.start <= now).sort((a, b) => b.start - a.start)[0];

      const showName = currentShow?.title || currentShow?.concept?.title || "";
      let showCover = currentShow?.visual || currentShow?.concept?.visual || "";
      if (showCover && !showCover.startsWith("http")) {
        showCover = `https://www.radiofrance.fr/s3/cruiser-production-eu3/${showCover}`;
      }

      const songSteps = allSteps.filter((step) => step?.embedType === "song");
      let current: any = songSteps.find((step) => step.start <= now && step.end >= now);
      if (!current) {
        current = songSteps.filter((step) => step.start <= now)
          .sort((a, b) => b.start - a.start)[0] || songSteps[0] || null;
      }

      if (!current && showName) {
        const result = {
          title: showName, artist: "", coverUrl: showCover || "", album: "",
          showName, showCover: showCover || "", isShow: true, hasSongData: false,
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
        const result = { title, artist, coverUrl, album, showName, showCover, isShow: false, hasSongData: true };
        setCache(cacheKey, result);
        return result;
      }
    } catch (e) {
      console.error(`RF livemeta error:`, (e as Error).message);
    }
  }
  return null;
}

// ─── Skyrock API (native) ───
async function fetchSkyrockMetadata(streamUrl: string): Promise<{
  nowPlaying: string; title: string; artist: string; coverUrl: string;
  showName?: string; showCover?: string; isShow?: boolean;
} | null> {
  const cacheKey = `skyrock:now`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const resp = await fetch("https://skyrock.fm/api/v3/player/onair", {
      headers: { "User-Agent": "Vootify/1.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();

    const showName = data.on_air_program?.title || "";
    const showCover = data.on_air_program?.cover_uri_640 || data.on_air_program?.cover_uri || "";
    const schedule = data.schedule || [];
    const now = Math.floor(Date.now() / 1000);
    const currentSong = schedule.find((s: any) =>
      s.type === "record" && s.info && parseInt(s.info.start_ts) <= now && parseInt(s.info.end_ts) >= now
    ) || (schedule.length > 0 && schedule[0].type === "record" ? schedule[0] : null);

    if (currentSong?.info) {
      const title = currentSong.info.title || "";
      const artistName = currentSong.artists?.[0]?.name || "";
      const coverUrl = currentSong.info.cover_big_uri || currentSong.info.cover_uri || "";
      if (title && artistName && !isAdContent(artistName, title)) {
        const result = {
          nowPlaying: `${artistName} - ${title}`, title, artist: artistName, coverUrl,
          showName, showCover, isShow: false,
        };
        setCache(cacheKey, result);
        return result;
      }
    }
    if (showName) {
      const result = {
        nowPlaying: `Skyrock — ${showName}`, title: showName, artist: "Skyrock", coverUrl: showCover,
        showName, showCover, isShow: true,
      };
      setCache(cacheKey, result);
      return result;
    }
  } catch (e) {
    console.log("Skyrock API error:", (e as Error).message);
  }
  return null;
}

// ─── Native station detection ───
function detectNativeStation(url: string, stationName?: string): string | null {
  const u = url.toLowerCase();
  const n = (stationName || "").toLowerCase();
  if (u.includes("skyrock") || n.includes("skyrock")) return "skyrock";
  return null;
}

// ─── Stations where radio.fr returns WRONG data ───
const RADIO_FR_BLACKLIST = new Set<string>([]);

// ─── Stations that should prioritize ICY stream metadata ───
// NOTE: Mouv' REMOVED — its ICY returns show names, not songs. RF livemeta is better.
const ICY_PRIORITY_STATIONS = new Set<string>([]);

function isIcyPriorityStation(stationName: string): boolean {
  const n = stationName.toLowerCase().trim().replace(/['']/g, "'");
  return ICY_PRIORITY_STATIONS.has(n);
}


// ─── Known station ID mappings for radio.fr ───
const RADIO_FR_STATION_IDS: Record<string, string> = {
  "nrj": "nrjfrance", "nrj hits": "nrjhits", "nrj ibiza": "nrjibizafr",
  "nrj french hits": "nrjfrenchhits", "nostalgie": "nostalgie",
  "cherie fm": "cheriefm", "chérie fm": "cheriefm", "rire et chansons": "rireetchansons",
  "rtl2": "rtl2", "rtl": "rtlfrance",
  "skyrock": "skyrock",
  "europe 1": "europe1", "europe1": "europe1", "virgin radio": "virginradio",
  "rfm": "rfm", "rmc": "rmc",
  "fun radio": "funradio",
  "france inter": "franceinter", "franceinfo": "franceinfofrance", "france info": "franceinfofrance",
  "france culture": "franceculture", "france musique": "francemusique",
  "fip": "fip",
  "contact fm": "contactfm", "voltage": "voltage",
  "ouï fm": "ouifm", "oui fm": "ouifm", "tsf jazz": "tsfjazz",
  "radio nova": "nova", "nova": "nova",
  "radio classique": "radioclassique", "classique": "radioclassique",
  "sud radio": "sudradio", "bfm business": "bfmbusiness",
  "rfi": "rfi", "france 24": "france24",
  "radio meuh": "radiomeuh", "generations": "generations",
  "latina": "radiolatinaparis", "radio latina": "radiolatinaparis",
};

function resolveRadioFrStationId(stationName: string, streamUrl?: string): string | null {
  const n = stationName.toLowerCase().trim().replace(/['']/g, "'").replace(/\s+/g, " ");
  if (RADIO_FR_STATION_IDS[n]) return RADIO_FR_STATION_IDS[n];
  for (const [key, id] of Object.entries(RADIO_FR_STATION_IDS)) {
    if (n.includes(key) || key.includes(n)) return id;
  }
  if (streamUrl) {
    const u = streamUrl.toLowerCase();
    for (const [key, id] of Object.entries(RADIO_FR_STATION_IDS)) {
      const slug = key.replace(/\s+/g, "").replace(/['']/g, "");
      if (u.includes(slug)) return id;
    }
  }
  return null;
}

async function fetchRadioFrMetadata(stationName: string, streamUrl?: string): Promise<{
  nowPlaying: string; title: string; artist: string; coverUrl: string;
} | null> {
  const nameNormalized = stationName.toLowerCase().trim().replace(/['']/g, "'");
  if (RADIO_FR_BLACKLIST.has(nameNormalized)) return null;

  const knownId = resolveRadioFrStationId(stationName, streamUrl);
  if (knownId) {
    const cacheKey = `radiofr:np:${knownId}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const resp = await fetch(`${RADIO_FR_API}/stations/now-playing?stationIds=${knownId}`, {
        headers: { "User-Agent": "Mozilla/5.0 Vootify/1.0", "Accept": "application/json" },
        signal: AbortSignal.timeout(4000),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0 && data[0].title) {
          const raw = data[0].title as string;
          const cleaned = raw.replace(/\s*§\d+$/, "").trim();
          const parsed = cleanIcyTitle(cleaned);
          if (parsed.artist && parsed.title && !isAdContent(parsed.artist, parsed.title)) {
            const result = {
              nowPlaying: `${parsed.artist} - ${parsed.title}`,
              title: parsed.title, artist: parsed.artist, coverUrl: "",
            };
            setCache(cacheKey, result);
            return result;
          }
        }
      }
    } catch (e) {
      console.log("radio.fr batch error:", (e as Error).message);
    }
  }

  // Fallback: search + station detail
  const cacheKey = `radiofr:search:${stationName}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const searchResp = await fetch(
      `${RADIO_FR_API}/stations/search?query=${encodeURIComponent(stationName)}&limit=5&pageIndex=0`,
      {
        headers: { "User-Agent": "Mozilla/5.0 Vootify/1.0", "Accept": "application/json" },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!searchResp.ok) return null;
    const searchData = await searchResp.json();
    const stations = searchData.playables || searchData.results || searchData.stations || [];
    if (!Array.isArray(stations) || stations.length === 0) return null;

    const nameNorm = stationName.toLowerCase().trim();
    const station = stations.find((s: any) => {
      const sn = (s.name || s.title || "").toLowerCase().trim();
      return sn === nameNorm || sn.includes(nameNorm) || nameNorm.includes(sn);
    }) || stations[0];

    const stationId = station.id || station.systemName;
    if (!stationId) return null;

    const npResp = await fetch(`${RADIO_FR_API}/stations/now-playing?stationIds=${stationId}`, {
      headers: { "User-Agent": "Mozilla/5.0 Vootify/1.0", "Accept": "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!npResp.ok) return null;
    const npData = await npResp.json();

    if (Array.isArray(npData) && npData.length > 0 && npData[0].title) {
      const raw = npData[0].title as string;
      const cleaned = raw.replace(/\s*§\d+$/, "").trim();
      const parsed = cleanIcyTitle(cleaned);
      if (parsed.artist && parsed.title && !isAdContent(parsed.artist, parsed.title)) {
        const result = {
          nowPlaying: `${parsed.artist} - ${parsed.title}`,
          title: parsed.title, artist: parsed.artist, coverUrl: "",
        };
        setCache(cacheKey, result);
        return result;
      }
    }
  } catch (e) {
    console.log("radio.fr search error:", (e as Error).message);
  }
  return null;
}

// ─── ICY metadata extraction ───
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
      for (const chunk of chunks) { allBytes.set(chunk, offset); offset += chunk.length; }
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
    console.log("ICY error:", (e as Error).message);
  } finally { clearTimeout(timeout); }
  return "";
}

// ─── Multi-source cover art with cross-validation ───
async function resolveCoverArt(artist: string, title: string, existingCover?: string): Promise<{
  coverUrl: string; album: string; resolvedArtist: string; resolvedTitle: string;
}> {
  // Try Deezer + iTunes in parallel for speed
  const [deezer, itunesCover] = await Promise.all([
    searchDeezerCover(artist, title),
    searchiTunesCover(artist, title),
  ]);

  if (deezer?.coverUrl) {
    return {
      coverUrl: deezer.coverUrl,
      album: deezer.deezerAlbum,
      resolvedArtist: deezer.deezerArtist || artist,
      resolvedTitle: deezer.deezerTitle || title,
    };
  }

  if (itunesCover) {
    return { coverUrl: itunesCover, album: "", resolvedArtist: artist, resolvedTitle: title };
  }

  return { coverUrl: existingCover || "", album: "", resolvedArtist: artist, resolvedTitle: title };
}

// ─── Cross-validate: compare two sources and pick best ───
function crossValidate(
  source1: { artist: string; title: string } | null,
  source2: { artist: string; title: string } | null,
): { artist: string; title: string; confidence: "high" | "medium" | "low" } {
  if (!source1 && !source2) return { artist: "", title: "", confidence: "low" };
  if (!source1) return { artist: source2!.artist, title: source2!.title, confidence: "medium" };
  if (!source2) return { artist: source1.artist, title: source1.title, confidence: "medium" };

  const n1a = normalize(source1.artist);
  const n1t = normalize(source1.title);
  const n2a = normalize(source2.artist);
  const n2t = normalize(source2.title);

  // Both agree → high confidence
  if ((n1a === n2a || n1a.includes(n2a) || n2a.includes(n1a)) &&
      (n1t === n2t || n1t.includes(n2t) || n2t.includes(n1t))) {
    // Prefer the longer/more detailed version
    return {
      artist: source1.artist.length >= source2.artist.length ? source1.artist : source2.artist,
      title: source1.title.length >= source2.title.length ? source1.title : source2.title,
      confidence: "high",
    };
  }

  // Artist matches but title differs → medium, use source1
  if (n1a === n2a || n1a.includes(n2a) || n2a.includes(n1a)) {
    return { artist: source1.artist, title: source1.title, confidence: "medium" };
  }

  // Default to source1 (usually the more reliable one)
  return { artist: source1.artist, title: source1.title, confidence: "medium" };
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

    // ── Check full-response cache ──
    const responseCacheKey = `resp:${streamUrl}:${stationName || ""}`;
    if (!force) {
      const cachedResponse = getCached(responseCacheKey);
      if (cachedResponse) {
        return new Response(JSON.stringify(cachedResponse), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Clear all related caches on force refresh
      for (const [k] of metadataCache) {
        if (k.startsWith(`rf:`) || k.startsWith(`radiofr:`) || k.startsWith(`resp:${streamUrl}`) ||
            k.startsWith(`skyrock:`) || k.startsWith(`progradio:np:`)) {
          metadataCache.delete(k);
        }
      }
    }

    let nowPlaying = "";
    let title = "";
    let artist = "";
    let coverUrl = "";
    let album = "";
    let source: string = "none";
    let showName = "";
    let showCover = "";
    let isShow = false;

    const rfStation = detectRadioFranceStation(streamUrl);
    const resolvedStationName = stationName || rfStation?.name || "";

    // ── Step 1: Radio France → livemeta + programmes-radio + ICY enrichment ──
    if (rfStation) {
      const stationKey = Object.entries(RADIO_FRANCE_STATIONS).find(([, v]) => v.stationId === rfStation.stationId)?.[0] || "";
      const icyPriority = isIcyPriorityStation(resolvedStationName) || isIcyPriorityStation(stationKey);
      const progCode = resolveProgRadioCode(resolvedStationName) || stationKey;

      // Fetch ALL sources in parallel: livemeta + schedule + ICY + programmes-radio now-playing
      const [rfLive, progShow, icyRaw, progNp] = await Promise.all([
        fetchRadioFranceLive(rfStation.stationId),
        stationKey ? fetchProgRadioSchedule(stationKey) : Promise.resolve(null),
        icyPriority ? fetchIcyMetadata(streamUrl) : Promise.resolve(""),
        progCode ? fetchProgRadioNowPlaying(progCode) : Promise.resolve(null),
      ]);

      const progShowName = progShow?.title || "";
      const progShowCover = progShow?.pictureUrl || "";

      // Parse ICY result
      let icyParsed: { artist: string; title: string } | null = null;
      if (icyRaw && !isAd(icyRaw)) {
        const parsed = cleanIcyTitle(icyRaw);
        if (parsed.artist && parsed.title && parsed.artist.length >= 2 && parsed.title.length >= 3
            && !isAdContent(parsed.artist, parsed.title)) {
          icyParsed = parsed;
        }
      }

      // For ICY-priority stations (Mouv'), prefer ICY metadata when it has song data
      if (icyPriority && icyParsed) {
        // Cross-validate ICY with livemeta if available
        let rfSong: { artist: string; title: string } | null = null;
        if (rfLive && !rfLive.isShow && rfLive.title && rfLive.artist) {
          rfSong = { artist: rfLive.artist, title: rfLive.title };
        }
        const validated = crossValidate(icyParsed, rfSong);
        artist = validated.artist;
        title = validated.title;
        nowPlaying = `${artist} - ${title}`;
        showName = rfLive?.showName || progShowName || "";
        showCover = progShowCover || rfLive?.showCover || "";
        source = "stream";

        // Resolve HD cover
        const resolved = await resolveCoverArt(artist, title, stationCover);
        coverUrl = resolved.coverUrl || "";
        album = resolved.album || rfLive?.album || "";
        if (resolved.resolvedArtist && normalize(resolved.resolvedArtist) === normalize(artist)) {
          artist = resolved.resolvedArtist;
        }
        if (resolved.resolvedTitle && normalize(resolved.resolvedTitle) === normalize(title)) {
          title = resolved.resolvedTitle;
        }
        nowPlaying = `${artist} - ${title}`;

        if (!coverUrl) coverUrl = rfStation.logo || stationCover || "";
        const responseData = {
          success: true, nowPlaying, title, artist, coverUrl, album, source,
          showName, showCover, isShow: false,
        };
        setCache(responseCacheKey, responseData);
        return new Response(JSON.stringify(responseData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (rfLive) {
        if (rfLive.isShow && !rfLive.hasSongData) {
          // Show mode with no song data — check programmes-radio now-playing for actual song
          if (progNp?.title && progNp?.artist && !isAdContent(progNp.artist, progNp.title)) {
            // programmes-radio found a song playing during the show!
            artist = progNp.artist;
            title = progNp.title;
            nowPlaying = `${artist} - ${title}`;
            showName = rfLive.showName || progShowName || rfLive.title || "";
            showCover = progShowCover || rfLive.showCover || rfLive.coverUrl || "";
            source = "official";
            isShow = false;

            const resolved = await resolveCoverArt(artist, title, progNp.coverUrl || stationCover);
            coverUrl = resolved.coverUrl || progNp.coverUrl || "";
            album = resolved.album || "";
            if (resolved.resolvedArtist && normalize(resolved.resolvedArtist) === normalize(artist)) {
              artist = resolved.resolvedArtist;
            }
            if (resolved.resolvedTitle && normalize(resolved.resolvedTitle) === normalize(title)) {
              title = resolved.resolvedTitle;
            }
            nowPlaying = `${artist} - ${title}`;

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

          // No song found — show info only
          title = rfLive.title || progShowName || "";
          artist = rfStation.name;
          showCover = progShowCover || rfLive.showCover || rfLive.coverUrl || "";
          coverUrl = showCover || rfStation.logo || stationCover || "";
          showName = rfLive.showName || progShowName || title;
          nowPlaying = `${rfStation.name} — ${title}`;
          isShow = true;
          source = "official";

          const isLikelyMusicShow = /playlist|mix|juice|dj|music|son|hit|top|groove|vib/i.test(title);
          if (!isLikelyMusicShow) {
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
        } else if (rfLive.title || rfLive.artist) {
          // Cross-validate with programmes-radio now-playing
          let rfSong = { artist: rfLive.artist || rfStation.name, title: rfLive.title };
          let progSong: { artist: string; title: string } | null = null;
          if (progNp?.artist && progNp?.title && !isAdContent(progNp.artist, progNp.title)) {
            progSong = { artist: progNp.artist, title: progNp.title };
          }
          const validated = crossValidate(rfSong, progSong);
          title = validated.title || rfLive.title;
          artist = validated.artist || rfLive.artist || rfStation.name;
          album = rfLive.album;
          coverUrl = rfLive.coverUrl || "";
          showName = rfLive.showName || progShowName || "";
          showCover = progShowCover || rfLive.showCover || "";
          nowPlaying = artist && title ? `${artist} - ${title}` : title || `En direct sur ${rfStation.name}`;
          source = "official";

          if (artist && title) {
            const resolved = await resolveCoverArt(artist, title, coverUrl || stationCover);
            if (resolved.coverUrl) coverUrl = resolved.coverUrl;
            album = resolved.album || album;
            if (resolved.resolvedArtist && normalize(resolved.resolvedArtist) === normalize(artist)) {
              artist = resolved.resolvedArtist;
            }
            if (resolved.resolvedTitle && normalize(resolved.resolvedTitle) === normalize(title)) {
              title = resolved.resolvedTitle;
            }
            nowPlaying = `${artist} - ${title}`;
          }

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

    // ── Step 1.5: Native station APIs (Skyrock) ──
    if (!nowPlaying) {
      const nativeStation = detectNativeStation(streamUrl, stationName);
      if (nativeStation === "skyrock") {
        const skyData = await fetchSkyrockMetadata(streamUrl);
        if (skyData) {
          nowPlaying = skyData.nowPlaying;
          title = skyData.title;
          artist = skyData.artist;
          coverUrl = skyData.coverUrl;
          showName = skyData.showName || "";
          showCover = skyData.showCover || "";
          isShow = skyData.isShow || false;
          source = "official";

          if (!coverUrl && artist && title && !isShow) {
            const resolved = await resolveCoverArt(artist, title, stationCover);
            coverUrl = resolved.coverUrl;
            album = resolved.album;
          }

          if (!coverUrl) coverUrl = stationCover || "";
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

    // ── Step 2: radio.fr API + cross-validation with ICY/programmes-radio ──
    let radioFrResult: { artist: string; title: string } | null = null;
    let icyResult: { artist: string; title: string } | null = null;

    if (!nowPlaying || (isShow && /playlist|mix|juice|dj|music|son|hit|top|groove|vib/i.test(title))) {
      const radioFrName = resolvedStationName || rfStation?.name || "";

      // Fetch radio.fr + ICY + programmes-radio in parallel for cross-validation
      const progCode = resolveProgRadioCode(radioFrName);
      const [radioFr, icyRaw, progNp] = await Promise.all([
        radioFrName ? fetchRadioFrMetadata(radioFrName, streamUrl) : Promise.resolve(null),
        fetchIcyMetadata(streamUrl),
        progCode ? fetchProgRadioNowPlaying(progCode) : Promise.resolve(null),
      ]);

      if (radioFr?.title && radioFr?.artist) {
        radioFrResult = { artist: radioFr.artist, title: radioFr.title };
      }

      if (icyRaw && !isAd(icyRaw)) {
        const parsed = cleanIcyTitle(icyRaw);
        if (parsed.artist && parsed.title && !isAdContent(parsed.artist, parsed.title)) {
          icyResult = { artist: parsed.artist, title: parsed.title };
        }
      }

      // programmes-radio now-playing as additional source
      let progResult: { artist: string; title: string } | null = null;
      if (progNp?.title && progNp?.artist) {
        progResult = { artist: progNp.artist, title: progNp.title };
      }

      // Cross-validate: prefer radio.fr, cross-check with ICY
      const validated = crossValidate(
        radioFrResult || progResult,
        icyResult,
      );

      if (validated.artist && validated.title) {
        const prevShowName = showName;
        const prevShowCover = showCover;
        artist = validated.artist;
        title = validated.title;
        nowPlaying = `${artist} - ${title}`;
        source = isShow ? "official" : (radioFrResult ? "radio_fr" : "stream");
        isShow = false;
        showName = prevShowName;
        showCover = prevShowCover;

        // Resolve HD cover art
        const resolved = await resolveCoverArt(artist, title, stationCover);
        coverUrl = resolved.coverUrl || coverUrl;
        album = resolved.album || album;
        // Use Deezer-corrected names if they match
        if (resolved.resolvedArtist && normalize(resolved.resolvedArtist) === normalize(artist)) {
          artist = resolved.resolvedArtist;
        }
        if (resolved.resolvedTitle && normalize(resolved.resolvedTitle) === normalize(title)) {
          title = resolved.resolvedTitle;
        }
        nowPlaying = `${artist} - ${title}`;
      }
    }

    // ── Step 3: ICY-only fallback (if no cross-validation above) ──
    if (!nowPlaying) {
      const icyRaw = await fetchIcyMetadata(streamUrl);
      if (icyRaw) {
        const parsed = cleanIcyTitle(icyRaw);
        if (isAd(icyRaw) || isAdContent(parsed.artist, parsed.title)) {
          const responseData = {
            success: true,
            nowPlaying: `En direct sur ${resolvedStationName || "Radio"}`,
            title: "En direct", artist: resolvedStationName || "Radio",
            coverUrl: stationCover || "", album: "", source: "none",
            adFiltered: true, showName: "", showCover: "", isShow: false,
          };
          setCache(responseCacheKey, responseData);
          return new Response(JSON.stringify(responseData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

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
