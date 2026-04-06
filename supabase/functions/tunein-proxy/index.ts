import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TUNEIN_API = "https://opml.radiotime.com";
const TUNEIN_CDN = "https://cdn-profiles.tunein.com";

interface TuneInStation {
  id: string;
  name: string;
  logo: string;
  logoHd: string;
  genre: string;
  currentTrack: string;
  country: string;
  frequency: string;
  slogan: string;
  streamUrl: string;
}

/**
 * Parse a TuneIn search/browse JSON response into station objects.
 */
function parseStations(body: any[]): TuneInStation[] {
  const stations: TuneInStation[] = [];

  for (const item of body) {
    // Handle grouped results (children array)
    if (item.children) {
      stations.push(...parseStations(item.children));
      continue;
    }

    if (item.item !== "station" || !item.guide_id) continue;

    const id = item.guide_id;
    const logoBase = `${TUNEIN_CDN}/${id}/images`;

    stations.push({
      id,
      name: item.text || "",
      logo: item.image || `${logoBase}/logoq.png`,
      logoHd: `${logoBase}/logog.png`, // large logo
      genre: item.genre_id || "",
      currentTrack: item.current_track || item.subtext || "",
      country: "",
      frequency: "",
      slogan: item.subtext || "",
      streamUrl: item.URL || "",
    });
  }

  return stations;
}

/**
 * Parse a TuneIn Describe response (station detail) into enriched metadata.
 */
function parseDescribe(body: any[]): {
  name: string;
  logo: string;
  logoHd: string;
  genre: string;
  genreName: string;
  currentTrack: string;
  currentArtist: string;
  currentAlbumArt: string;
  description: string;
  slogan: string;
  frequency: string;
  location: string;
  language: string;
} | null {
  if (!body || body.length === 0) return null;
  const s = body[0];

  const id = s.guide_id || s.preset_id;
  const logoBase = id ? `${TUNEIN_CDN}/${id}/images` : "";

  return {
    name: s.name || "",
    logo: s.logo || (logoBase ? `${logoBase}/logoq.png` : ""),
    logoHd: logoBase ? `${logoBase}/logog.png` : (s.logo || ""),
    genre: s.genre_id || "",
    genreName: s.genre_name || "",
    currentTrack: s.current_song ? `${s.current_artist || ""} - ${s.current_song}`.trim().replace(/^- /, "") : "",
    currentArtist: s.current_artist || "",
    currentAlbumArt: s.current_album_art || s.current_artist_art || "",
    description: s.description || "",
    slogan: s.slogan || "",
    frequency: s.frequency ? `${s.frequency} ${s.band || "FM"}` : "",
    location: s.location || "",
    language: s.language || "",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, query, stationId, country, limit } = await req.json();

    let url: string;

    switch (action) {
      case "search":
        // Search stations by name
        url = `${TUNEIN_API}/Search.ashx?query=${encodeURIComponent(query || "")}&render=json&types=station`;
        break;

      case "describe":
        // Get full station details (logo HD, now playing, description)
        if (!stationId) throw new Error("stationId required for describe");
        url = `${TUNEIN_API}/Describe.ashx?id=${encodeURIComponent(stationId)}&render=json`;
        break;

      case "browse_local":
        // Browse local stations
        url = `${TUNEIN_API}/Browse.ashx?c=local&render=json`;
        break;

      case "browse_trending":
        // Browse trending stations
        url = `${TUNEIN_API}/Browse.ashx?c=trending&render=json`;
        break;

      case "browse_country":
        // Browse by country (e.g. "France")
        url = `${TUNEIN_API}/Search.ashx?query=${encodeURIComponent(country || "France")}&render=json&types=station&filter=s`;
        break;

      case "now_playing":
        // Get now playing for a specific station
        if (!stationId) throw new Error("stationId required for now_playing");
        url = `${TUNEIN_API}/Describe.ashx?id=${encodeURIComponent(stationId)}&render=json`;
        break;

      case "logo_search":
        // Search for a station logo by name — returns just logo URLs
        url = `${TUNEIN_API}/Search.ashx?query=${encodeURIComponent(query || "")}&render=json&types=station`;
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const resp = await fetch(url, {
      headers: { "User-Agent": "Vootify/1.0" },
    });

    if (!resp.ok) {
      throw new Error(`TuneIn API error: ${resp.status}`);
    }

    const data = await resp.json();

    // Handle describe/now_playing actions differently
    if (action === "describe" || action === "now_playing") {
      const detail = parseDescribe(data.body || []);
      return new Response(
        JSON.stringify({ success: true, station: detail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle logo_search — return just matching logos
    if (action === "logo_search") {
      const stations = parseStations(data.body || []);
      const maxResults = limit || 5;
      const logos = stations.slice(0, maxResults).map(s => ({
        id: s.id,
        name: s.name,
        logo: s.logo,
        logoHd: s.logoHd,
      }));
      return new Response(
        JSON.stringify({ success: true, logos }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Standard search/browse — return station list
    const stations = parseStations(data.body || []);
    const maxResults = limit || 50;

    return new Response(
      JSON.stringify({ success: true, stations: stations.slice(0, maxResults) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
