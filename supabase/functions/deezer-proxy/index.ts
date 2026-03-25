const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DEEZER_API = 'https://api.deezer.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, query, id, limit, url: shortUrl, index } = await req.json();

    // Resolve short links (link.deezer.com)
    if (action === 'resolve_short_link') {
      if (!shortUrl) {
        return new Response(
          JSON.stringify({ error: 'Missing url parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`Resolving short link: ${shortUrl}`);
      const resp = await fetch(shortUrl, { redirect: 'follow' });
      const finalUrl = resp.url;
      const match = finalUrl.match(/deezer\.com\/(?:\w+\/)?playlist\/(\d+)/);
      return new Response(
        JSON.stringify({ resolved_url: finalUrl, playlist_id: match ? match[1] : null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let url: string;

    switch (action) {
      case 'search':
        url = `${DEEZER_API}/search?q=${encodeURIComponent(query || '')}&limit=${limit || 25}&index=${index || 0}`;
        break;
      case 'chart':
        url = `${DEEZER_API}/chart/0/tracks?limit=${limit || 25}`;
        break;
      case 'chart_albums':
        url = `${DEEZER_API}/chart/0/albums?limit=${limit || 25}`;
        break;
      case 'chart_artists':
        url = `${DEEZER_API}/chart/0/artists?limit=${limit || 25}`;
        break;
      case 'album':
        url = `${DEEZER_API}/album/${id}`;
        break;
      case 'search_albums':
        url = `${DEEZER_API}/search/album?q=${encodeURIComponent(query || '')}&limit=${limit || 12}`;
        break;
      case 'artist':
        url = `${DEEZER_API}/artist/${id}`;
        break;
      case 'artist_top':
        url = `${DEEZER_API}/artist/${id}/top?limit=${limit || 10}`;
        break;
      case 'track':
        url = `${DEEZER_API}/track/${id}`;
        break;
      case 'radio':
        url = `${DEEZER_API}/radio`;
        break;
      case 'radio_tracks':
        url = `${DEEZER_API}/radio/${id}/tracks?limit=${limit || 25}`;
        break;
      case 'genre':
        url = `${DEEZER_API}/genre`;
        break;
      case 'editorial':
        url = `${DEEZER_API}/editorial/0`;
        break;
      case 'playlist':
        url = `${DEEZER_API}/playlist/${id}`;
        break;
      case 'search_playlists':
        url = `${DEEZER_API}/search/playlist?q=${encodeURIComponent(query || '')}&limit=${limit || 10}`;
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`Deezer API call: ${action} -> ${url}`);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('Deezer API error:', data);
      return new Response(
        JSON.stringify({ error: data.error?.message || 'Deezer API error' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
