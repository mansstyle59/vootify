import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEEZER_API = "https://api.deezer.com";

interface TrackInput {
  title: string;
  artist: string;
  album?: string;
  fileName?: string;
}

interface TrackOutput extends TrackInput {
  corrected: boolean;
  corrections: string[];
  duplicateOf?: string; // existing song id if duplicate
  normalizedArtist: string;
  normalizedTitle: string;
}

/**
 * Normalize artist name: trim, collapse spaces, unify feat/ft, unify case for known artists.
 */
function normalizeArtistName(name: string): string {
  let n = name.trim().replace(/\s+/g, " ");
  // Normalize feat variants
  n = n.replace(/\s*(ft\.?|feat\.?|featuring)\s*/gi, " feat. ");
  // Normalize separators
  n = n.replace(/\s*[&+]\s*/g, " & ");
  return n;
}

/**
 * Normalize title: trim, collapse spaces, remove common noise
 */
function normalizeTrackTitle(title: string): string {
  let t = title.trim().replace(/\s+/g, " ");
  // Remove common video/audio markers
  t = t.replace(
    /\s*[\[(](?:official\s*(?:video|audio|music\s*video|lyric\s*video)|lyrics?|audio|hd|hq|4k|1080p|720p|clip\s*officiel|version\s*originale)[\])]/gi,
    ""
  );
  t = t.replace(/[\s\-_]+$/, "");
  return t;
}

/**
 * Use Deezer search to validate/correct artist ↔ title.
 * If searching "artist: X, track: Y" returns no results but
 * "artist: Y, track: X" does → swap detected.
 */
async function validateWithDeezer(
  artist: string,
  title: string
): Promise<{ artist: string; title: string; swapped: boolean; album?: string } | null> {
  try {
    // First try as-is
    const q1 = `artist:"${artist}" track:"${title}"`;
    const res1 = await fetch(
      `${DEEZER_API}/search?q=${encodeURIComponent(q1)}&limit=3`,
      { headers: { "User-Agent": "Vootify/1.0" } }
    );
    const data1 = await res1.json();

    if (data1.data?.length > 0) {
      const match = data1.data[0];
      return {
        artist: match.artist?.name || artist,
        title: match.title || title,
        swapped: false,
        album: match.album?.title,
      };
    }

    // Try swapped: title as artist, artist as title
    const q2 = `artist:"${title}" track:"${artist}"`;
    const res2 = await fetch(
      `${DEEZER_API}/search?q=${encodeURIComponent(q2)}&limit=3`,
      { headers: { "User-Agent": "Vootify/1.0" } }
    );
    const data2 = await res2.json();

    if (data2.data?.length > 0) {
      const match = data2.data[0];
      return {
        artist: match.artist?.name || title,
        title: match.title || artist,
        swapped: true,
        album: match.album?.title,
      };
    }

    // Try loose search
    const q3 = `${artist} ${title}`;
    const res3 = await fetch(
      `${DEEZER_API}/search?q=${encodeURIComponent(q3)}&limit=3`,
      { headers: { "User-Agent": "Vootify/1.0" } }
    );
    const data3 = await res3.json();

    if (data3.data?.length > 0) {
      const match = data3.data[0];
      return {
        artist: match.artist?.name || artist,
        title: match.title || title,
        swapped: false,
        album: match.album?.title,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check for fuzzy duplicates in existing songs.
 * Compares normalized lowercase versions.
 */
function findDuplicate(
  artist: string,
  title: string,
  existingSongs: Array<{ id: string; artist: string; title: string }>
): string | undefined {
  const normA = artist.toLowerCase().replace(/[^a-z0-9àâäéèêëïîôùûüÿçœæ]/g, "");
  const normT = title.toLowerCase().replace(/[^a-z0-9àâäéèêëïîôùûüÿçœæ]/g, "");

  for (const song of existingSongs) {
    const sA = song.artist.toLowerCase().replace(/[^a-z0-9àâäéèêëïîôùûüÿçœæ]/g, "");
    const sT = song.title.toLowerCase().replace(/[^a-z0-9àâäéèêëïîôùûüÿçœæ]/g, "");

    if (sA === normA && sT === normT) return song.id;
    // Check swapped
    if (sA === normT && sT === normA) return song.id;
  }
  return undefined;
}

/**
 * Unify artist name casing using a known-artists map.
 * Uses the most frequent casing found in existing songs.
 */
function unifyArtistCasing(
  artist: string,
  knownArtists: Map<string, string>
): string {
  const key = artist.toLowerCase().trim();
  return knownArtists.get(key) || artist;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const tracks: TrackInput[] = body.tracks || [];

    if (!tracks.length) {
      return new Response(
        JSON.stringify({ error: "No tracks provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch existing songs for duplicate detection & artist name unification
    const { data: existingSongs } = await supabase
      .from("custom_songs")
      .select("id, artist, title");

    const existing = existingSongs || [];

    // Build known artists map (lowercase → most frequent casing)
    const artistCasingCounts = new Map<string, Map<string, number>>();
    for (const song of existing) {
      const key = song.artist.toLowerCase().trim();
      if (!artistCasingCounts.has(key)) artistCasingCounts.set(key, new Map());
      const casings = artistCasingCounts.get(key)!;
      casings.set(song.artist, (casings.get(song.artist) || 0) + 1);
    }
    const knownArtists = new Map<string, string>();
    for (const [key, casings] of artistCasingCounts) {
      const best = [...casings.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best) knownArtists.set(key, best[0]);
    }

    const results: TrackOutput[] = [];

    for (const track of tracks) {
      const corrections: string[] = [];
      let artist = normalizeArtistName(track.artist);
      let title = normalizeTrackTitle(track.title);
      let album = track.album;

      // 1. Validate with Deezer (detect artist↔title swap)
      const deezerResult = await validateWithDeezer(artist, title);

      if (deezerResult) {
        if (deezerResult.swapped) {
          corrections.push(`Inversion corrigée : "${artist}" était le titre, "${title}" était l'artiste`);
          artist = deezerResult.artist;
          title = deezerResult.title;
        } else {
          // Use Deezer's canonical casing
          if (deezerResult.artist !== artist) {
            corrections.push(`Artiste corrigé : "${artist}" → "${deezerResult.artist}"`);
            artist = deezerResult.artist;
          }
          if (deezerResult.title !== title) {
            corrections.push(`Titre corrigé : "${title}" → "${deezerResult.title}"`);
            title = deezerResult.title;
          }
        }
        if (!album && deezerResult.album) {
          album = deezerResult.album;
          corrections.push(`Album trouvé : "${album}"`);
        }
      }

      // 2. Unify artist casing with existing library
      const unified = unifyArtistCasing(artist, knownArtists);
      if (unified !== artist) {
        corrections.push(`Artiste unifié : "${artist}" → "${unified}"`);
        artist = unified;
      }

      // 3. Detect duplicates (fuzzy)
      const dupId = findDuplicate(artist, title, existing);
      if (dupId) {
        corrections.push(`Doublon détecté (ID: ${dupId})`);
      }

      results.push({
        title,
        artist,
        album,
        fileName: track.fileName,
        corrected: corrections.length > 0,
        corrections,
        duplicateOf: dupId,
        normalizedArtist: artist,
        normalizedTitle: title,
      });

      // Small delay to respect Deezer rate limits
      await new Promise((r) => setTimeout(r, 300));
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
