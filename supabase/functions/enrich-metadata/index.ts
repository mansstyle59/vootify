import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEEZER_API = "https://api.deezer.com";
const BATCH_SIZE = 50; // process 50 songs per invocation
const DELAY_MS = 350;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function deezerSearch(artist: string, title: string, album?: string) {
  try {
    let query = `artist:"${artist}" track:"${title}"`;
    if (album) query = `artist:"${artist}" album:"${album}" track:"${title}"`;

    let res = await fetch(`${DEEZER_API}/search?q=${encodeURIComponent(query)}&limit=3`, {
      headers: { "User-Agent": "Vootify/1.0" },
    });
    let data = await res.json();

    if (!data.data?.length) {
      res = await fetch(`${DEEZER_API}/search?q=${encodeURIComponent(`${artist} ${title}`)}&limit=3`, {
        headers: { "User-Agent": "Vootify/1.0" },
      });
      data = await res.json();
      if (!data.data?.length) return null;
    }

    const track = data.data[0];
    const coverUrl = track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || "";
    if (!coverUrl) return null;

    let genre: string | undefined;
    let year: number | undefined;
    const albumId = track.album?.id;

    if (albumId) {
      try {
        const albumRes = await fetch(`${DEEZER_API}/album/${albumId}`, {
          headers: { "User-Agent": "Vootify/1.0" },
        });
        const albumData = await albumRes.json();
        if (albumData.release_date) {
          const y = parseInt(albumData.release_date.split("-")[0], 10);
          if (y > 1900 && y <= new Date().getFullYear() + 1) year = y;
        }
        if (albumData.genres?.data?.length > 0) {
          genre = albumData.genres.data[0].name;
        }
      } catch { /* skip */ }
    }

    return {
      coverUrl,
      album: track.album?.title || undefined,
      artist: track.artist?.name || undefined,
      title: track.title || undefined,
      year,
      genre,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const offset = body.offset || 0;
    const onlyMissing = body.only_missing !== false; // default: only enrich missing genre/year

    // Fetch batch of songs
    let query = supabase
      .from("custom_songs")
      .select("id, title, artist, album, cover_url, genre, year")
      .order("created_at", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (onlyMissing) {
      query = query.or("genre.is.null,year.is.null");
    }

    const { data: songs, error } = await query;
    if (error) throw error;
    if (!songs || songs.length === 0) {
      return new Response(JSON.stringify({ done: true, updated: 0, offset, message: "No more songs to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache by album to avoid duplicate API calls
    const albumCache = new Map<string, any>();
    let updated = 0;

    for (const song of songs) {
      const albumKey = song.album ? `${song.artist.toLowerCase()}|||${song.album.toLowerCase()}` : "";

      let meta: any = null;
      if (albumKey && albumCache.has(albumKey)) {
        meta = albumCache.get(albumKey);
      } else {
        await delay(DELAY_MS);
        meta = await deezerSearch(song.artist, song.title, song.album || undefined);
        if (albumKey) albumCache.set(albumKey, meta);
      }

      if (!meta) continue;

      const updates: Record<string, any> = {};
      if (meta.coverUrl && !song.cover_url) updates.cover_url = meta.coverUrl;
      if (meta.genre && !song.genre) updates.genre = meta.genre;
      if (meta.year && !song.year) updates.year = meta.year;
      // Always update album name if Deezer has a better one
      if (meta.album && song.album !== meta.album) updates.album = meta.album;

      if (Object.keys(updates).length > 0) {
        await supabase.from("custom_songs").update(updates).eq("id", song.id);
        updated++;
      }
    }

    return new Response(
      JSON.stringify({
        done: songs.length < BATCH_SIZE,
        updated,
        processed: songs.length,
        offset,
        nextOffset: offset + songs.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
