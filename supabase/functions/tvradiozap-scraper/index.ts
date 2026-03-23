const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ScrapedStation {
  id: string;
  name: string;
  category: string;
  genre: string;
  country: string;
  logoUrl: string;
  siteUrl: string;
  notes: string;
}

function parseStations(html: string): ScrapedStation[] {
  const stations: ScrapedStation[] = [];

  // Each station is a <tr> in the tbody
  // Pattern: <tr ...> with <td> cells containing category, logo+name, site link, country, genre, notes
  const trRegex = /<tr[^>]*data-n="(\d+)"[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;

  while ((match = trRegex.exec(html)) !== null) {
    const id = match[1];
    const row = match[2];

    // Extract all td contents
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(row)) !== null) {
      cells.push(tdMatch[1]);
    }

    if (cells.length < 5) continue;

    // Category is typically in cell index 1
    const catMatch = cells[1]?.match(/>([^<]+)</);
    const category = catMatch?.[1]?.trim() || '';

    // Logo from img src
    const logoMatch = row.match(/<img[^>]*src="([^"]+)"/);
    const logoUrl = logoMatch?.[1] || '';

    // Station name - look for the main link text
    const nameMatch = row.match(/<a[^>]*class="[^"]*lienStation[^"]*"[^>]*>([^<]+)<\/a>/);
    const nameMatch2 = row.match(/<a[^>]*href="[^"]*"[^>]*>([^<]+)<\/a>/);
    const name = nameMatch?.[1]?.trim() || nameMatch2?.[1]?.trim() || '';

    // Site URL
    const siteMatch = row.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>/);
    const siteUrl = siteMatch?.[1] || '';

    // Country
    const countryMatch = cells[4]?.replace(/<[^>]+>/g, '').trim();
    const country = countryMatch || '';

    // Genre
    const genreCell = cells.length > 8 ? cells[8] : '';
    const genre = genreCell?.replace(/<[^>]+>/g, '').trim() || '';

    // Notes
    const notesCell = cells.length > 9 ? cells[9] : '';
    const notes = notesCell?.replace(/<[^>]+>/g, '').trim() || '';

    if (name) {
      stations.push({ id: `tvrz-${id}`, name, category, genre, country, logoUrl, siteUrl, notes });
    }
  }

  return stations;
}

// Fallback: parse from markdown table structure (more reliable with the fetched content)
function parseFromMarkdown(html: string): ScrapedStation[] {
  const stations: ScrapedStation[] = [];

  // The table rows have pattern: | id | Category | ![](logoUrl) | [Name](siteUrl) | Country | ... | ... | ... | genre | notes |
  // In HTML each row is: <tr data-n="ID"> with tds
  // Let's try a simpler approach: find all station entries by looking for the table structure

  // Try extracting from the rendered table: each station has an img and a link
  const rowPattern = /<tr[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<\/tr>/gi;
  let m;
  let idx = 0;

  while ((m = rowPattern.exec(html)) !== null) {
    const logoUrl = m[1];
    const siteUrl = m[2];
    const name = m[3].trim();
    if (!name || name.length < 2) continue;

    stations.push({
      id: `tvrz-${idx++}`,
      name,
      category: '',
      genre: '',
      country: 'France',
      logoUrl,
      siteUrl,
      notes: '',
    });
  }

  return stations;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type } = await req.json();
    const page = type || 'trztop';
    const url = `https://tvradiozap.eu/index.php/f/1/ty/${page}`;

    console.log(`Scraping TVRadioZap: ${url}`);

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

    // Try structured parsing first, fall back to simpler approach
    let stations = parseStations(html);
    if (stations.length === 0) {
      stations = parseFromMarkdown(html);
    }

    console.log(`Found ${stations.length} stations from TVRadioZap`);

    return new Response(
      JSON.stringify({ success: true, stations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('TVRadioZap scraper error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
