import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://de1.api.radio-browser.info/json";

interface RBStation {
  stationuuid: string;
  name: string;
  tags: string;
  favicon: string;
  url_resolved: string;
  country: string;
  countrycode: string;
  votes: number;
  clickcount: number;
  codec: string;
  bitrate: number;
}

function mapStation(s: RBStation) {
  return {
    id: s.stationuuid,
    name: s.name,
    genre: (s.tags || "").split(",")[0]?.trim() || "Radio",
    coverUrl: s.favicon || "",
    streamUrl: s.url_resolved || "",
    country: s.country || "",
    countryCode: s.countrycode || "",
    votes: s.votes || 0,
    clicks: s.clickcount || 0,
    codec: s.codec || "",
    bitrate: s.bitrate || 0,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, query, tag, country, limit = 30 } = await req.json();

    let url: string;
    const params = new URLSearchParams({
      limit: String(limit),
      hidebroken: "true",
      order: "clickcount",
      reverse: "true",
    });

    // Special action: get station counts for multiple tags
    if (action === "tag_counts") {
      const { tags } = await req.json().catch(() => ({ tags: [] }));
      const tagList: string[] = body?.tags || tags || [];
      const counts: Record<string, number> = {};

      await Promise.all(
        tagList.map(async (t: string) => {
          try {
            const r = await fetch(
              `${API_BASE}/stations/bytag/${encodeURIComponent(t)}?hidebroken=true&limit=1&offset=0`,
              { headers: { "User-Agent": "Vootify/1.0" } }
            );
            // Use search endpoint with count
            const r2 = await fetch(
              `${API_BASE}/stations/search?tag=${encodeURIComponent(t)}&hidebroken=true&limit=0`,
              { headers: { "User-Agent": "Vootify/1.0" } }
            );
            const countHeader = r2.headers.get("x-total-count");
            if (countHeader) {
              counts[t] = parseInt(countHeader, 10);
            } else {
              // Fallback: fetch a batch and use length as estimate
              const r3 = await fetch(
                `${API_BASE}/stations/bytag/${encodeURIComponent(t)}?hidebroken=true&limit=200`,
                { headers: { "User-Agent": "Vootify/1.0" } }
              );
              const data = await r3.json();
              counts[t] = Array.isArray(data) ? data.length : 0;
            }
          } catch {
            counts[t] = 0;
          }
        })
      );

      return new Response(
        JSON.stringify({ success: true, counts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { query: q2, tag: t2, country: c2, limit: l2 = 30 } = body;

    let url: string;
    const params = new URLSearchParams({
      limit: String(l2),
      hidebroken: "true",
      order: "clickcount",
      reverse: "true",
    });

    switch (action) {
      case "search":
        url = `${API_BASE}/stations/search?name=${encodeURIComponent(q2 || "")}&${params}`;
        break;
      case "by_tag":
        url = `${API_BASE}/stations/bytag/${encodeURIComponent(t2 || "")}?${params}`;
        break;
      case "by_country":
        url = `${API_BASE}/stations/bycountry/${encodeURIComponent(c2 || "France")}?${params}`;
        break;
      case "top":
        url = `${API_BASE}/stations/topclick?${params}`;
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const resp = await fetch(url, {
      headers: { "User-Agent": "Vootify/1.0" },
    });

    if (!resp.ok) {
      throw new Error(`Radio Browser API error: ${resp.status}`);
    }

    const raw: RBStation[] = await resp.json();
    const stations = raw
      .filter((s) => s.url_resolved && s.name)
      .map(mapStation);

    return new Response(
      JSON.stringify({ success: true, stations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
