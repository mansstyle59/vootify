const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPOTIFY_API = 'https://api.spotify.com/v1';

/** Get a Spotify access token using Client Credentials flow */
async function getAccessToken(): Promise<string | null> {
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token || null;
}

/** Resolve Spotify short links (spotify.link/...) */
async function resolveShortLink(shortUrl: string): Promise<string | null> {
  try {
    const res = await fetch(shortUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Vootify/1.0' },
    });
    return res.url || null;
  } catch {
    return null;
  }
}

/** Extract Spotify resource type and ID from URL */
function parseSpotifyUrl(url: string): { type: string; id: string } | null {
  // open.spotify.com/playlist/ID, open.spotify.com/album/ID
  const match = url.match(/open\.spotify\.com\/(playlist|album|track)\/([a-zA-Z0-9]+)/);
  if (match) return { type: match[1], id: match[2] };

  // spotify:playlist:ID
  const uriMatch = url.match(/spotify:(playlist|album|track):([a-zA-Z0-9]+)/);
  if (uriMatch) return { type: uriMatch[1], id: uriMatch[2] };

  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { url, resolveUrl } = body;

    // Resolve short link
    if (resolveUrl) {
      const resolved = await resolveShortLink(resolveUrl);
      return new Response(JSON.stringify({ resolved }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse the Spotify URL
    let finalUrl = url;
    if (/spotify\.link/i.test(url)) {
      const resolved = await resolveShortLink(url);
      if (resolved) finalUrl = resolved;
    }

    const parsed = parseSpotifyUrl(finalUrl);
    if (!parsed) {
      return new Response(JSON.stringify({ error: 'Invalid Spotify URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = await getAccessToken();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Spotify API credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { type, id } = parsed;
    let apiPath = '';
    if (type === 'playlist') apiPath = `/playlists/${id}?fields=name,images,tracks.items(track(name,artists,album(name,images),duration_ms))&limit=100`;
    else if (type === 'album') apiPath = `/albums/${id}`;
    else if (type === 'track') apiPath = `/tracks/${id}`;

    const res = await fetch(`${SPOTIFY_API}${apiPath}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: `Spotify API error: ${res.status}`, details: errText }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();

    // Normalize response to a common format
    let result: {
      title: string;
      coverUrl: string;
      type: string;
      tracks: { title: string; artist: string; album: string; duration: number; coverUrl: string }[];
    };

    if (type === 'playlist') {
      result = {
        title: data.name || '',
        coverUrl: data.images?.[0]?.url || '',
        type: 'playlist',
        tracks: (data.tracks?.items || [])
          .filter((item: Record<string, unknown>) => item.track)
          .map((item: Record<string, unknown>) => {
            const t = item.track as Record<string, unknown>;
            const artists = t.artists as Array<{ name: string }>;
            const album = t.album as { name: string; images: Array<{ url: string }> };
            return {
              title: (t.name as string) || '',
              artist: artists?.map((a) => a.name).join(', ') || '',
              album: album?.name || '',
              duration: Math.round(((t.duration_ms as number) || 0) / 1000),
              coverUrl: album?.images?.[0]?.url || '',
            };
          }),
      };
    } else if (type === 'album') {
      result = {
        title: data.name || '',
        coverUrl: data.images?.[0]?.url || '',
        type: 'album',
        tracks: (data.tracks?.items || []).map((t: Record<string, unknown>) => {
          const artists = t.artists as Array<{ name: string }>;
          return {
            title: (t.name as string) || '',
            artist: artists?.map((a) => a.name).join(', ') || '',
            album: data.name || '',
            duration: Math.round(((t.duration_ms as number) || 0) / 1000),
            coverUrl: data.images?.[0]?.url || '',
          };
        }),
      };
    } else {
      const artists = data.artists as Array<{ name: string }>;
      const album = data.album as { name: string; images: Array<{ url: string }> };
      result = {
        title: data.name || '',
        coverUrl: album?.images?.[0]?.url || '',
        type: 'track',
        tracks: [{
          title: data.name || '',
          artist: artists?.map((a) => a.name).join(', ') || '',
          album: album?.name || '',
          duration: Math.round((data.duration_ms || 0) / 1000),
          coverUrl: album?.images?.[0]?.url || '',
        }],
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
