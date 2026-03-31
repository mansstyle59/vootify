const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEEZER_API = 'https://api.deezer.com';

/**
 * Resolve a Deezer short link (link.deezer.com/s/...) to its full URL.
 * Follows redirects to get the final deezer.com URL.
 */
async function resolveShortLink(shortUrl: string): Promise<string | null> {
  try {
    const res = await fetch(shortUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Vootify/1.0' },
    });
    // The final URL after redirect is what we want
    return res.url || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // GET with imageUrl param → proxy an image (for offline cover caching)
    const imageUrl = url.searchParams.get('imageUrl');
    if (req.method === 'GET' && imageUrl) {
      const imgRes = await fetch(imageUrl, {
        headers: { 'User-Agent': 'Vootify/1.0' },
      });
      if (!imgRes.ok) {
        return new Response('Image not found', { status: 404, headers: corsHeaders });
      }
      const blob = await imgRes.blob();
      return new Response(blob, {
        headers: {
          ...corsHeaders,
          'Content-Type': imgRes.headers.get('Content-Type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const body = await req.json();
    const { path, resolveUrl } = body;

    // If resolveUrl is provided, resolve a short link
    if (resolveUrl && typeof resolveUrl === 'string') {
      const resolved = await resolveShortLink(resolveUrl);
      return new Response(JSON.stringify({ resolvedUrl: resolved }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!path || typeof path !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ensure path starts with /
    const safePath = path.startsWith('/') ? path : `/${path}`;
    const apiUrl = `${DEEZER_API}${safePath}`;

    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Vootify/1.0' },
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
