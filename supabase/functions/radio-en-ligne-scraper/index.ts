const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RADIO_BROWSER_API = 'https://de1.api.radio-browser.info/json';

interface ScrapedStation {
  name: string;
  slug: string;
  coverUrl: string;
}

interface ResolvedStation {
  id: string;
  name: string;
  genre: string;
  coverUrl: string;
  streamUrl: string;
  listeners: number;
}

async function scrapeStationList(page = 1): Promise<ScrapedStation[]> {
  const url = page === 1
    ? 'https://www.radio-en-ligne.fr'
    : `https://www.radio-en-ligne.fr/radios/${page}`;

  console.log(`Scraping station list from: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch radio-en-ligne.fr: ${response.status}`);
  }

  const html = await response.text();
  const stations: ScrapedStation[] = [];

  // Parse station entries: <a href="/station-slug" title="Station Name">
  // with <img src="..." alt="Station Name">
  const stationRegex = /<a\s+href="https:\/\/www\.radio-en-ligne\.fr\/([^"\/]+)"\s+title="([^"]+)">\s*<img[^>]+src="([^"]+)"[^>]*alt="[^"]*">/g;
  let match;

  while ((match = stationRegex.exec(html)) !== null) {
    const [, slug, name, coverUrl] = match;
    // Skip non-station links (regions, genres, etc.)
    if (slug.startsWith('radio/') || slug.startsWith('cherche') || slug.startsWith('api')) continue;
    // Skip international stations
    if (slug.includes('/')) continue;

    stations.push({
      name: decodeHTMLEntities(name),
      slug,
      coverUrl: coverUrl.replace('radio-default.jpg', '') || '',
    });
  }

  // Also try alternate pattern from main list
  const altRegex = /href="https:\/\/www\.radio-en-ligne\.fr\/([^"\/]+)"[^>]*>\s*(?:<img[^>]*src="([^"]+)"[^>]*>)?\s*(?:\\n\s*)?([^<]+)<\/a>/g;
  while ((match = altRegex.exec(html)) !== null) {
    const [, slug, coverUrl, name] = match;
    if (slug.startsWith('radio/') || slug.startsWith('cherche') || slug.includes('/')) continue;
    const cleanName = name.trim();
    if (!cleanName || stations.some(s => s.slug === slug)) continue;

    stations.push({
      name: decodeHTMLEntities(cleanName),
      slug,
      coverUrl: coverUrl || '',
    });
  }

  // Deduplicate by slug
  const seen = new Set<string>();
  return stations.filter(s => {
    if (seen.has(s.slug)) return false;
    seen.add(s.slug);
    return true;
  });
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

async function resolveStreamUrl(stationName: string): Promise<{ streamUrl: string; genre: string; votes: number } | null> {
  try {
    const searchUrl = `${RADIO_BROWSER_API}/stations/byname/${encodeURIComponent(stationName)}?limit=5&countrycode=FR&order=clickcount&reverse=true`;
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'VOOMusic/1.0' },
    });

    if (!response.ok) return null;

    const stations = await response.json();
    if (!stations || stations.length === 0) return null;

    // Find best match (prefer stations with working URLs)
    const best = stations.find((s: { url_resolved: string }) => s.url_resolved) || stations[0];
    return {
      streamUrl: best.url_resolved || best.url || '',
      genre: (best.tags || '').split(',')[0] || '',
      votes: best.clickcount || 0,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action = 'list', page = 1 } = await req.json().catch(() => ({}));

    if (action === 'list') {
      // Scrape station list from radio-en-ligne.fr
      const scraped = await scrapeStationList(page);
      console.log(`Scraped ${scraped.length} stations from page ${page}`);

      // Resolve stream URLs via Radio Browser API (batch, max 20 at a time)
      const toResolve = scraped.slice(0, 40);
      const resolved: ResolvedStation[] = [];

      // Process in parallel batches of 10
      const batchSize = 10;
      for (let i = 0; i < toResolve.length; i += batchSize) {
        const batch = toResolve.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (station) => {
            const stream = await resolveStreamUrl(station.name);
            if (!stream || !stream.streamUrl) return null;
            return {
              id: `rel-${station.slug}`,
              name: station.name,
              genre: stream.genre || 'Radio',
              coverUrl: station.coverUrl || '',
              streamUrl: stream.streamUrl,
              listeners: stream.votes,
            };
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            resolved.push(result.value);
          }
        }
      }

      console.log(`Resolved ${resolved.length}/${toResolve.length} stream URLs`);

      return new Response(
        JSON.stringify({
          success: true,
          stations: resolved,
          totalScraped: scraped.length,
          page,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scraper error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Scraper failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
