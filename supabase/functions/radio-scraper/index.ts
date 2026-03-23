const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RADIO_FR_BASE = 'https://www.radio.fr';

interface ScrapedStation {
  id: string;
  name: string;
  slug: string;
  genre: string;
  city: string;
  logoUrl: string;
  pageUrl: string;
}

function parseStationsFromHtml(html: string): ScrapedStation[] {
  const stations: ScrapedStation[] = [];
  const seen = new Set<string>();

  // Match patterns like: <a href="/s/slug" title="..."><img src="...logo..." alt="...name...">
  // Also match list items with station info
  const linkRegex = /<a[^>]*href="\/s\/([^"]+)"[^>]*title="[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*alt="(?:Radio\s+)?([^"]+)"[^>]*>/gi;
  
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const slug = match[1];
    if (seen.has(slug)) continue;
    seen.add(slug);

    const logoUrl = match[2].startsWith('http') ? match[2] : `${RADIO_FR_BASE}${match[2]}`;
    const name = match[3].trim();

    stations.push({
      id: `radio-fr-${slug}`,
      name,
      slug,
      genre: '',
      city: '',
      logoUrl,
      pageUrl: `${RADIO_FR_BASE}/s/${slug}`,
    });
  }

  // Also try to extract from structured list items with city/genre info
  // Pattern: name\n\ncity, genre
  const listRegex = /href="\/s\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*alt="(?:Radio\s+)?([^"]+)"[\s\S]*?<\/a>/gi;
  // Not duplicating, just enrich existing with surrounding text context

  return stations;
}

async function scrapeTopStations(): Promise<ScrapedStation[]> {
  const response = await fetch(`${RADIO_FR_BASE}/top-stations`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; VOOMusic/1.0)',
      'Accept': 'text/html',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    },
  });

  if (!response.ok) {
    // Fallback: try main page
    const mainResponse = await fetch(RADIO_FR_BASE, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VOOMusic/1.0)',
        'Accept': 'text/html',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    });
    if (!mainResponse.ok) {
      throw new Error(`Failed to fetch radio.fr: ${mainResponse.status}`);
    }
    const html = await mainResponse.text();
    return parseStationsFromHtml(html);
  }

  const html = await response.text();
  return parseStationsFromHtml(html);
}

async function scrapeStationDetails(slug: string): Promise<{ streamUrl?: string; genre?: string; city?: string }> {
  try {
    const response = await fetch(`${RADIO_FR_BASE}/s/${slug}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VOOMusic/1.0)',
        'Accept': 'text/html',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    });

    if (!response.ok) return {};

    const html = await response.text();

    // Try to find stream URL from page source
    const streamMatch = html.match(/(?:streamUrl|stream_url|src)["']?\s*[:=]\s*["'](https?:\/\/[^"'\s]+\.(?:mp3|aac|ogg|m3u8|pls)[^"'\s]*)/i);
    const streamUrl = streamMatch ? streamMatch[1] : undefined;

    // Try to extract genre/city from meta or content
    const genreMatch = html.match(/genre[s]?["']?\s*[:>]\s*["']?([^"'<,]+)/i);
    const cityMatch = html.match(/(?:city|location|ville)["']?\s*[:>]\s*["']?([^"'<,]+)/i);

    return {
      streamUrl,
      genre: genreMatch ? genreMatch[1].trim() : undefined,
      city: cityMatch ? cityMatch[1].trim() : undefined,
    };
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, slug } = await req.json();

    if (action === 'list') {
      console.log('Scraping radio.fr top stations...');
      const stations = await scrapeTopStations();
      console.log(`Found ${stations.length} stations`);

      // Hardcode known genres/cities for top French stations
      const knownInfo: Record<string, { genre: string; city: string }> = {
        rmcinfo: { genre: 'Info / Talk', city: 'Paris' },
        rtl: { genre: 'Généraliste', city: 'Paris' },
        franceinfo: { genre: 'Info', city: 'Paris' },
        radioorient: { genre: 'Musique Orientale', city: 'Clichy' },
        europe1: { genre: 'Généraliste', city: 'Paris' },
        franceinter: { genre: 'Généraliste', city: 'Paris' },
        nostalgie: { genre: 'Oldies', city: 'Paris' },
        nrjfrance: { genre: 'Hits / Pop', city: 'Paris' },
        rtl2: { genre: 'Pop / Rock', city: 'Paris' },
        freedom: { genre: 'Hits', city: 'Saint-Denis' },
        cheriefm: { genre: 'Pop', city: 'Paris' },
        beurfm: { genre: 'Musique Orientale', city: 'Troyes' },
        exofmreunion: { genre: 'Tropical', city: 'Saint-Denis' },
        skyrock: { genre: 'Hip Hop / Rap', city: 'Paris' },
        tropiquesfm: { genre: 'Zouk / Tropical', city: 'Paris' },
        rfm: { genre: 'Pop / 80s / 90s', city: 'Paris' },
        rireetchansons: { genre: 'Humour / Chanson', city: 'Paris' },
        funradio: { genre: 'Electro / House', city: 'Paris' },
        skyrockklassiks: { genre: 'Hip Hop / R&B', city: 'Paris' },
        bfmtv: { genre: 'Info', city: 'Paris' },
        europe2: { genre: 'Pop / Rock', city: 'Paris' },
        fip: { genre: 'Jazz / Eclectique', city: 'Paris' },
        radionova: { genre: 'Electro / Soul / Funk', city: 'Paris' },
        franceculture: { genre: 'Culture / Débats', city: 'Paris' },
        radiomeuh: { genre: 'Techno / Soul / Funk', city: 'La Clusaz' },
        fg: { genre: 'Electro / Deep House', city: 'Paris' },
        bfm: { genre: 'Business / Info', city: 'Paris' },
      };

      const enriched = stations.map((s) => {
        const info = knownInfo[s.slug];
        return {
          ...s,
          genre: info?.genre || s.genre || 'Radio',
          city: info?.city || s.city || '',
        };
      });

      return new Response(
        JSON.stringify({ success: true, stations: enriched }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'details' && slug) {
      console.log(`Scraping station details: ${slug}`);
      const details = await scrapeStationDetails(slug);
      return new Response(
        JSON.stringify({ success: true, ...details }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "list" or "details".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
