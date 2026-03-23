const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_BASE = 'https://de1.api.radio-browser.info/json';

interface RadioBrowserStation {
  stationuuid: string;
  name: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  tags: string;
  country: string;
  countrycode: string;
  codec: string;
  bitrate: number;
  votes: number;
  clickcount: number;
  lastcheckok: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, country, tag, name, limit } = await req.json();
    const maxResults = Math.min(limit || 50, 100);

    let url: string;

    switch (action) {
      case 'search':
        url = `${API_BASE}/stations/search?name=${encodeURIComponent(name || '')}&countrycode=${country || 'FR'}&limit=${maxResults}&order=votes&reverse=true&lastcheckok=1&hidebroken=true`;
        break;
      case 'bytag':
        url = `${API_BASE}/stations/bytag/${encodeURIComponent(tag || 'pop')}?countrycode=${country || 'FR'}&limit=${maxResults}&order=votes&reverse=true&lastcheckok=1&hidebroken=true`;
        break;
      case 'topclick':
        url = `${API_BASE}/stations/topclick/${maxResults}?countrycode=${country || 'FR'}&lastcheckok=1&hidebroken=true`;
        break;
      case 'tags':
        url = `${API_BASE}/tags?order=stationcount&reverse=true&limit=30&hidebroken=true`;
        break;
      default:
        // Default: top voted French stations
        url = `${API_BASE}/stations/bycountry/${country || 'france'}?limit=${maxResults}&order=votes&reverse=true&lastcheckok=1&hidebroken=true`;
    }

    console.log(`Radio Browser API: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'VOOMusic/1.0',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error ${response.status}: ${text}`);
    }

    const data = await response.json();

    // For tags endpoint, return as-is
    if (action === 'tags') {
      return new Response(
        JSON.stringify({ success: true, tags: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map to our format, filter out stations without stream URL
    const stations = (data as RadioBrowserStation[])
      .filter((s) => s.url_resolved && s.lastcheckok === 1)
      .map((s) => ({
        id: `rb-${s.stationuuid}`,
        name: s.name.trim(),
        genre: s.tags ? s.tags.split(',')[0].trim() : 'Radio',
        coverUrl: s.favicon || '',
        streamUrl: s.url_resolved,
        votes: s.votes,
        clickcount: s.clickcount,
        codec: s.codec,
        bitrate: s.bitrate,
        country: s.country,
        homepage: s.homepage,
      }));

    console.log(`Found ${stations.length} stations with stream URLs`);

    return new Response(
      JSON.stringify({ success: true, stations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Radio Browser error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
