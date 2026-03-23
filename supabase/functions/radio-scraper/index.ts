const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BASE_URL = 'https://www.radio-en-ligne.fr';

interface ScrapedStation {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  pageUrl: string;
}

function parseStations(html: string): ScrapedStation[] {
  const stations: ScrapedStation[] = [];
  const liRegex = /<li[^>]*class="mdc-grid-tile"[^>]*>[\s\S]*?<\/li>/gi;
  let match;
  while ((match = liRegex.exec(html)) !== null) {
    const block = match[0];
    const hrefMatch = block.match(/<a\s+href="([^"]+)"/);
    if (!hrefMatch) continue;
    const pageUrl = hrefMatch[1];
    const slug = pageUrl.replace(/.*\//, '');
    const dataSrcMatch = block.match(/data-src="([^"]+)"/);
    const srcMatch = block.match(/<img[^>]*src="([^"]+)"/);
    let logoUrl = dataSrcMatch?.[1] || srcMatch?.[1] || '';
    if (logoUrl.includes('radio-default.jpg') && dataSrcMatch) {
      logoUrl = dataSrcMatch[1];
    }
    const titleMatch = block.match(/<span\s+class="mdc-grid-tile__title">([^<]+)<\/span>/);
    const altMatch = block.match(/alt="([^"]+)"/);
    const name = titleMatch?.[1]?.trim() || altMatch?.[1]?.trim() || slug;
    stations.push({
      id: `rel-${slug}`,
      name,
      slug,
      logoUrl,
      pageUrl: pageUrl.startsWith('http') ? pageUrl : `${BASE_URL}/${slug}`,
    });
  }
  return stations;
}

function parseGenres(html: string): Array<{ name: string; slug: string; url: string }> {
  const genres: Array<{ name: string; slug: string; url: string }> = [];
  const collapseMatch = html.match(/<div\s+id="collapse_1"[^>]*>([\s\S]*?)<\/div>/);
  if (!collapseMatch) return genres;
  const block = collapseMatch[1];
  const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>\s*([^<]+)\s*<\/a>/gi;
  let m;
  while ((m = linkRegex.exec(block)) !== null) {
    const url = m[1];
    const name = m[2].trim();
    const slug = url.replace(/.*\/radio\//, '').replace(/.*\//, '');
    genres.push({ name, slug, url });
  }
  return genres;
}

function parseRegions(html: string): Array<{ name: string; slug: string; url: string }> {
  const regions: Array<{ name: string; slug: string; url: string }> = [];
  const collapseMatch = html.match(/<div\s+id="collapse_2"[^>]*>([\s\S]*?)<\/div>/);
  if (!collapseMatch) return regions;
  const block = collapseMatch[1];
  const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>\s*([^<]+)\s*<\/a>/gi;
  let m;
  while ((m = linkRegex.exec(block)) !== null) {
    const url = m[1];
    const name = m[2].trim();
    if (name === 'Tous') continue;
    const slug = url.replace(/.*\/radio\//, '').replace(/.*\//, '');
    regions.push({ name, slug, url });
  }
  return regions;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, genre, region } = await req.json();

    let url = BASE_URL;
    if (action === 'genre' && genre) {
      url = `${BASE_URL}/radio/${genre}`;
    } else if (action === 'region' && region) {
      url = `${BASE_URL}/radio/${region}`;
    }

    console.log(`Scraping: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const stations = parseStations(html);
    const genres = parseGenres(html);
    const regions = parseRegions(html);

    console.log(`Found ${stations.length} stations, ${genres.length} genres, ${regions.length} regions`);

    return new Response(
      JSON.stringify({ success: true, stations, genres, regions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scraper error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
