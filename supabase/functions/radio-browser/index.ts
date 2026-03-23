const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_BASE = 'https://de1.api.radio-browser.info/json';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, query, tag, country, limit, offset } = await req.json();
    const perPage = Math.min(limit || 30, 100);
    const skip = offset || 0;

    let url = '';
    const params = new URLSearchParams({
      limit: String(perPage),
      offset: String(skip),
      hidebroken: 'true',
      order: 'clickcount',
      reverse: 'true',
    });

    if (action === 'search' && query) {
      params.set('name', query);
      url = `${API_BASE}/stations/search?${params}`;
    } else if (action === 'by_country') {
      const c = country || 'France';
      url = `${API_BASE}/stations/bycountry/${encodeURIComponent(c)}?${params}`;
    } else if (action === 'by_tag') {
      const t = tag || 'pop';
      url = `${API_BASE}/stations/bytag/${encodeURIComponent(t)}?${params}`;
    } else if (action === 'top') {
      url = `${API_BASE}/stations/topclick?${params}`;
    } else if (action === 'tags') {
      url = `${API_BASE}/tags?order=stationcount&reverse=true&limit=${perPage}`;
    } else if (action === 'countries') {
      url = `${API_BASE}/countries?order=stationcount&reverse=true&limit=${perPage}`;
    } else {
      // Default: top French stations
      params.set('countrycode', 'FR');
      url = `${API_BASE}/stations/search?${params}`;
    }

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'VOOMusic/1.0',
        'Accept': 'application/json',
      },
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`radio-browser API error ${resp.status}: ${body.slice(0, 200)}`);
    }

    const data = await resp.json();

    // For station results, normalize the response
    if (['search', 'by_country', 'by_tag', 'top'].includes(action) || !action) {
      const stations = (Array.isArray(data) ? data : []).map((s: any) => ({
        id: s.stationuuid || s.id,
        name: s.name?.trim() || 'Station inconnue',
        genre: (s.tags || '').split(',')[0]?.trim() || 'Radio',
        coverUrl: s.favicon || '',
        streamUrl: s.url_resolved || s.url || '',
        country: s.country || '',
        countryCode: s.countrycode || '',
        votes: s.votes || 0,
        clicks: s.clickcount || 0,
        codec: s.codec || '',
        bitrate: s.bitrate || 0,
      })).filter((s: any) => s.streamUrl);

      return new Response(
        JSON.stringify({ success: true, stations }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For tags/countries, return as-is
    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('radio-browser proxy error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
