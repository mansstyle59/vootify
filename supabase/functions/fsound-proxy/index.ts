const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FSOUND_API = 'https://fsound.lol/secure/tracks';
const SAAVN_API = 'https://jiosaavn-api-privatecvc2.vercel.app';

interface FsoundTrack {
  id: number;
  name: string;
  duration: number;
  image: string | null;
  plays: number;
  album?: { id: number; name: string; image: string };
  artists?: Array<{ id: number; name: string; image_small: string }>;
}

interface SaavnResult {
  name: string;
  duration: number;
  downloadUrl: Array<{ quality: string; link: string }>;
  image: Array<{ quality: string; link: string }>;
  artists?: { primary?: Array<{ name: string }> };
}

async function resolveAudio(artistName: string, trackName: string): Promise<string> {
  try {
    const query = `${artistName} ${trackName}`.trim();
    const resp = await fetch(
      `${SAAVN_API}/search/songs?query=${encodeURIComponent(query)}&limit=3`,
      { headers: { 'User-Agent': 'VOOMusic/1.0' } }
    );
    if (!resp.ok) return '';

    const data = await resp.json();
    const results: SaavnResult[] = data?.data?.results || [];

    if (results.length === 0) return '';

    // Try to find best match by name similarity
    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetName = normalise(trackName);
    const best = results.find(r => normalise(r.name) === targetName) || results[0];

    const urls = best.downloadUrl || [];
    // Prefer 160kbps for balance of quality and speed
    const preferred = urls.find(u => u.quality === '160kbps')
      || urls.find(u => u.quality === '320kbps')
      || urls.find(u => u.quality === '96kbps')
      || urls[urls.length - 1];

    return preferred?.link || '';
  } catch (e) {
    console.error('Audio resolve error:', e);
    return '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, query, limit, page } = await req.json();

    if (action === 'popular') {
      // Fetch popular tracks from fsound.lol
      const perPage = limit || 20;
      const pageNum = page || 1;
      const url = `${FSOUND_API}?perPage=${perPage}&orderBy=popularity&orderDir=desc&page=${pageNum}`;

      const resp = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://fsound.lol/',
        },
      });

      if (!resp.ok) throw new Error(`FSound API error: ${resp.status}`);
      const data = await resp.json();
      const tracks: FsoundTrack[] = data?.pagination?.data || [];

      console.log(`Fetched ${tracks.length} popular tracks from fsound.lol`);

      // Resolve audio URLs in parallel batches
      const resolved = await Promise.allSettled(
        tracks.map(async (t) => {
          const artistName = t.artists?.[0]?.name || '';
          const streamUrl = await resolveAudio(artistName, t.name);
          return {
            id: `fs-${t.id}`,
            title: t.name,
            artist: artistName,
            album: t.album?.name || '',
            duration: Math.round((t.duration || 0) / 1000),
            coverUrl: t.album?.image || t.image || '',
            streamUrl,
            plays: t.plays || 0,
          };
        })
      );

      const songs = resolved
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(s => s.streamUrl); // Only return tracks with resolved audio

      console.log(`Resolved ${songs.length}/${tracks.length} with audio`);

      return new Response(
        JSON.stringify({ success: true, tracks: songs }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'search') {
      if (!query) {
        return new Response(
          JSON.stringify({ success: false, error: 'Query required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Search directly via JioSaavn for better audio match
      const searchLimit = limit || 15;
      const resp = await fetch(
        `${SAAVN_API}/search/songs?query=${encodeURIComponent(query)}&limit=${searchLimit}`,
        { headers: { 'User-Agent': 'VOOMusic/1.0' } }
      );

      if (!resp.ok) throw new Error(`Saavn search error: ${resp.status}`);
      const data = await resp.json();
      const results: SaavnResult[] = data?.data?.results || [];

      const songs = results
        .map((r, i) => {
          const urls = r.downloadUrl || [];
          const preferred = urls.find(u => u.quality === '160kbps')
            || urls.find(u => u.quality === '320kbps')
            || urls.find(u => u.quality === '96kbps')
            || urls[urls.length - 1];
          const images = r.image || [];
          const img = images.find(im => im.quality === '500x500')
            || images[images.length - 1];
          const artistNames = r.artists?.primary?.map(a => a.name).join(', ') || '';

          return {
            id: `fs-search-${i}-${Date.now()}`,
            title: r.name,
            artist: artistNames,
            album: '',
            duration: r.duration || 0,
            coverUrl: img?.link || '',
            streamUrl: preferred?.link || '',
            plays: 0,
          };
        })
        .filter(s => s.streamUrl);

      console.log(`Search "${query}" returned ${songs.length} results`);

      return new Response(
        JSON.stringify({ success: true, tracks: songs }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action. Use: popular, search' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('FSound proxy error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
