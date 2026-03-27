const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BASE = 'https://myradioendirect.fr';

interface ScrapedStation {
  name: string;
  slug: string;
  logoUrl: string;
  logoHdUrl: string;
  nowPlaying: string;
  artist: string;
  title: string;
  pageUrl: string;
}

/**
 * Parse the homepage HTML to extract station cards.
 * Each card looks like:
 *   <a href="/nrj" title="NRJ - Radio en ligne">
 *     <span class="name">NRJ</span>
 *     <span class="onAir">ARTIST - TITLE</span>
 *     <img src=".../list_45.jpg" alt="Logo de NRJ">
 *   </a>
 */
function parseHomepage(html: string): ScrapedStation[] {
  const stations: ScrapedStation[] = [];

  // Match station links with name + nowplaying + logo
  // Pattern: links to station pages with logo images
  const linkRegex = /href="\/([a-z0-9-]+)"\s+title="([^"]*?)\s*-\s*Radio en ligne"/gi;
  const imgRegex = /radio_img\/([a-z0-9-]+)\/list_45\.(jpg|png)/gi;
  const onAirRegex = /<span[^>]*class="[^"]*onAir[^"]*"[^>]*>([^<]*)<\/span>/gi;

  // Simpler approach: extract data from the structured markdown-like pattern
  // The HTML has cards with: name, nowPlaying text, and logo image
  
  // Extract all station blocks using a more robust regex
  // Each station card has: data-url="slug" in the player div or href="/slug"
  const cardRegex = /href="https?:\/\/myradioendirect\.fr\/([a-z0-9-]+)"\s*title="([^"]*?)(?:\s*-\s*Radio en ligne)?"/gi;
  let match;
  const seenSlugs = new Set<string>();

  while ((match = cardRegex.exec(html)) !== null) {
    const slug = match[1];
    if (seenSlugs.has(slug) || ['contact', 'playlist', 'programmes', 'debogueur-radio', 'partenaires'].includes(slug)) continue;
    seenSlugs.add(slug);

    const name = match[2].replace(/\s*-\s*Radio en ligne$/i, '').trim();
    if (!name) continue;

    // Try to find the logo for this station
    const logoSmall = `${BASE}/public/uploads/radio_img/${slug}/list_45.jpg`;
    const logoHd = `${BASE}/public/uploads/radio_img/${slug}/play_250_250.png`;

    stations.push({
      name,
      slug,
      logoUrl: logoSmall,
      logoHdUrl: logoHd,
      nowPlaying: '',
      artist: '',
      title: '',
      pageUrl: `${BASE}/${slug}`,
    });
  }

  // Now try to extract now playing info from the page
  // The pattern in HTML is: station name followed by nowPlaying text
  // From the markdown scrape we see patterns like:
  // [NRJ\n\nJENNIFER LOPEZ - Save Me Tonight\n\n![Logo...
  // Let's parse the raw text patterns
  const nowPlayingRegex = /title="([^"]*?)\s*-\s*Radio en ligne"[^>]*>.*?<(?:span|div)[^>]*class="[^"]*(?:onAir|now|song|playing)[^"]*"[^>]*>([^<]+)/gis;
  let npMatch;
  while ((npMatch = nowPlayingRegex.exec(html)) !== null) {
    const stationTitle = npMatch[1].trim();
    const nowPlaying = npMatch[2].trim();
    const station = stations.find(s => s.name.toLowerCase() === stationTitle.toLowerCase());
    if (station && nowPlaying) {
      station.nowPlaying = nowPlaying;
      const parts = nowPlaying.split(' - ');
      if (parts.length >= 2) {
        station.artist = parts[0].trim();
        station.title = parts.slice(1).join(' - ').trim();
      } else {
        station.title = nowPlaying;
      }
    }
  }

  return stations;
}

/**
 * Parse a station detail page for now playing + stream info
 */
function parseStationPage(html: string, slug: string): {
  nowPlaying: string;
  artist: string;
  title: string;
  logoHdUrl: string;
  subStreams: { name: string; bitrate: string }[];
} {
  let nowPlaying = '';
  let artist = '';
  let title = '';
  const logoHdUrl = `${BASE}/public/uploads/radio_img/${slug}/play_250_250.png`;
  const subStreams: { name: string; bitrate: string }[] = [];

  // Extract "En ce moment" / now playing from meta or content
  // Pattern: <meta property="og:description" content="... En ce moment: ARTIST - TITLE ...">
  const ogMatch = html.match(/property="og:description"\s+content="([^"]*)"/i);
  if (ogMatch) {
    const desc = ogMatch[1];
    const enCeMoment = desc.match(/En ce moment\s*:\s*(.+?)(?:\.|$)/i);
    if (enCeMoment) {
      nowPlaying = enCeMoment[1].trim();
    }
  }

  // Also try to find in page content - look for onAir class or similar
  const onAirMatch = html.match(/<[^>]*class="[^"]*(?:onAir|nowPlaying|currentSong)[^"]*"[^>]*>([^<]+)/i);
  if (!nowPlaying && onAirMatch) {
    nowPlaying = onAirMatch[1].trim();
  }

  // Also try the link pattern we see in the markdown: [ARTIST - TITLE](url/playlist)
  const playlistLinkMatch = html.match(/class="[^"]*song[^"]*"[^>]*>([^<]+)/i) ||
    html.match(/<a[^>]*playlist[^>]*>([^<]+)/i);
  if (!nowPlaying && playlistLinkMatch) {
    nowPlaying = playlistLinkMatch[1].trim();
  }

  if (nowPlaying) {
    const parts = nowPlaying.split(' - ');
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    } else {
      title = nowPlaying;
    }
  }

  return { nowPlaying, artist, title, logoHdUrl, subStreams };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, slug, query } = await req.json();

    if (action === 'list' || action === 'search') {
      // Fetch homepage
      const resp = await fetch(BASE, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VootifyBot/1.0)' },
      });
      if (!resp.ok) throw new Error(`Failed to fetch myradioendirect: ${resp.status}`);
      const html = await resp.text();
      let stations = parseHomepage(html);

      // If search query, filter
      if (action === 'search' && query) {
        const q = query.toLowerCase().trim();
        stations = stations.filter(s =>
          s.name.toLowerCase().includes(q) ||
          s.nowPlaying.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q)
        );
      }

      return new Response(
        JSON.stringify({ success: true, stations }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'station' && slug) {
      // Fetch individual station page
      const resp = await fetch(`${BASE}/${slug}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VootifyBot/1.0)' },
      });
      if (!resp.ok) throw new Error(`Failed to fetch station ${slug}: ${resp.status}`);
      const html = await resp.text();
      const data = parseStationPage(html, slug);

      return new Response(
        JSON.stringify({ success: true, ...data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: return station list
    const resp = await fetch(BASE, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VootifyBot/1.0)' },
    });
    const html = await resp.text();
    const stations = parseHomepage(html);

    return new Response(
      JSON.stringify({ success: true, stations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('myradio-scraper error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
