const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RADIO_BROWSER_API = 'https://de1.api.radio-browser.info/json';
const LOGO_BASE = 'https://cdn.instant.audio/images/logos/ecouterradioenligne-com';

interface ScrapedStation {
  slug: string;
  name: string;
  coverUrl: string;
  genres: string[];
}

function decodeHTML(text: string): string {
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&agrave;/g, 'à')
    .replace(/&ccedil;/g, 'ç').replace(/&uuml;/g, 'ü').replace(/&Uuml;/g, 'Ü');
}

async function scrapeHomepage(): Promise<ScrapedStation[]> {
  const response = await fetch('https://ecouterradioenligne.com', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    },
  });

  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  const html = await response.text();
  const stations: ScrapedStation[] = [];
  const seen = new Set<string>();

  // Parse station list items: href="#slug" title="Name" with img src for logo
  const itemRegex = /href="https:\/\/ecouterradioenligne\.com\/#([^"]+)"\s+title="([^"]+)">\s*<img[^>]+src="([^"]+)"/g;
  let match;

  while ((match = itemRegex.exec(html)) !== null) {
    const [, slug, name, coverUrl] = match;
    if (seen.has(slug)) continue;
    seen.add(slug);

    stations.push({
      slug,
      name: decodeHTML(name),
      coverUrl,
      genres: [],
    });
  }

  // If regex didn't catch them, try alternate pattern from menu
  const menuRegex = /href="https:\/\/ecouterradioenligne\.com\/([^"\/]+)\/"[^>]*>([^<]+)<\/a>/g;
  while ((match = menuRegex.exec(html)) !== null) {
    const [, slug, name] = match;
    if (seen.has(slug) || slug.startsWith('genre') || slug.startsWith('region') || slug === 'favoris' || slug === 'recemment-ecoute' || slug === 'genres' || slug === 'aide') continue;
    seen.add(slug);

    stations.push({
      slug,
      name: decodeHTML(name.trim()),
      coverUrl: `${LOGO_BASE}/${slug}.png`,
      genres: [],
    });
  }

  return stations;
}

async function scrapeStationPage(slug: string): Promise<{ genres: string[]; frequency: string } | null> {
  try {
    const response = await fetch(`https://ecouterradioenligne.com/${slug}/`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!response.ok) return null;
    const html = await response.text();

    const genres: string[] = [];
    const genreRegex = /genre\/[^"]+\/">([^<]+)</g;
    let m;
    while ((m = genreRegex.exec(html)) !== null) {
      genres.push(decodeHTML(m[1]));
    }

    const freqMatch = html.match(/id="radio-signal">([^<]+)</);
    const frequency = freqMatch ? decodeHTML(freqMatch[1]) : '';

    return { genres, frequency };
  } catch {
    return null;
  }
}

async function resolveStreamUrl(stationName: string): Promise<{ streamUrl: string; genre: string; votes: number } | null> {
  try {
    // Clean station name for better matching
    const cleanName = stationName
      .replace(/\s*\([^)]*\)\s*/g, '') // Remove (Paris), (Lyon) etc
      .replace(/\s+France$/i, '')
      .replace(/^Radio\s+/i, '')
      .trim();

    const searchUrl = `${RADIO_BROWSER_API}/stations/byname/${encodeURIComponent(cleanName)}?limit=5&countrycode=FR&order=clickcount&reverse=true`;
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'VOOMusic/1.0' },
    });

    if (!response.ok) return null;
    const stations = await response.json();

    if (!stations || stations.length === 0) {
      // Try with full name
      const fullUrl = `${RADIO_BROWSER_API}/stations/byname/${encodeURIComponent(stationName)}?limit=5&order=clickcount&reverse=true`;
      const fullResp = await fetch(fullUrl, { headers: { 'User-Agent': 'VOOMusic/1.0' } });
      if (!fullResp.ok) return null;
      const fullStations = await fullResp.json();
      if (!fullStations || fullStations.length === 0) return null;
      const best = fullStations.find((s: { url_resolved: string }) => s.url_resolved) || fullStations[0];
      return { streamUrl: best.url_resolved || best.url || '', genre: (best.tags || '').split(',')[0] || '', votes: best.clickcount || 0 };
    }

    const best = stations.find((s: { url_resolved: string }) => s.url_resolved) || stations[0];
    return { streamUrl: best.url_resolved || best.url || '', genre: (best.tags || '').split(',')[0] || '', votes: best.clickcount || 0 };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const scraped = await scrapeHomepage();
    console.log(`Scraped ${scraped.length} stations from ecouterradioenligne.com`);

    // Resolve stream URLs in parallel batches
    const resolved: Array<{
      id: string; name: string; genre: string;
      coverUrl: string; streamUrl: string; listeners: number;
    }> = [];

    const batchSize = 10;
    for (let i = 0; i < scraped.length; i += batchSize) {
      const batch = scraped.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (station) => {
          const stream = await resolveStreamUrl(station.name);
          if (!stream || !stream.streamUrl) return null;

          // Optionally get genre from detail page
          let genre = stream.genre;
          if (!genre) {
            const detail = await scrapeStationPage(station.slug);
            if (detail?.genres?.length) genre = detail.genres[0];
          }

          return {
            id: `erel-${station.slug}`,
            name: station.name,
            genre: genre || 'Radio',
            coverUrl: station.coverUrl,
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

    console.log(`Resolved ${resolved.length}/${scraped.length} stream URLs`);

    return new Response(
      JSON.stringify({ success: true, stations: resolved }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scraper error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Scraper failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
