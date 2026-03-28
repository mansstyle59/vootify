import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEEZER_API = "https://api.deezer.com";
const DELAY_MS = 350;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function searchDeezerArtist(artistName: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${DEEZER_API}/search/artist?q=${encodeURIComponent(artistName)}&limit=3`,
      { headers: { "User-Agent": "Vootify/1.0" } }
    );
    const data = await res.json();
    if (!data.data?.length) return null;

    const lower = artistName.toLowerCase();
    const match = data.data.find((a: any) => a.name?.toLowerCase() === lower) || data.data[0];
    return match.picture_xl || match.picture_big || match.picture_medium || null;
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
    const onlyMissing = body.only_missing !== false; // default true
    const forceRefresh = body.force_refresh === true; // re-fetch even existing ones

    // Get all unique artists from custom_songs
    const { data: songs, error: songsErr } = await supabase
      .from("custom_songs")
      .select("artist")
      .not("stream_url", "is", null);
    if (songsErr) throw songsErr;

    const uniqueArtists = [...new Set((songs || []).map((s: any) => s.artist))];

    // Get existing artist images
    const { data: existing } = await supabase
      .from("artist_images")
      .select("artist_name, image_url");

    const existingMap = new Map<string, string>();
    for (const row of existing || []) {
      existingMap.set(row.artist_name, row.image_url);
    }

    let updated = 0;
    let skipped = 0;

    for (const artistName of uniqueArtists) {
      // Skip if already has a custom image and not force refresh
      if (onlyMissing && existingMap.has(artistName) && !forceRefresh) {
        skipped++;
        continue;
      }

      await delay(DELAY_MS);
      const imageUrl = await searchDeezerArtist(artistName);
      if (!imageUrl) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from("artist_images")
        .upsert(
          {
            artist_name: artistName,
            image_url: imageUrl,
            updated_by: "00000000-0000-0000-0000-000000000000",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "artist_name" }
        );

      if (!error) updated++;
    }

    return new Response(
      JSON.stringify({
        total: uniqueArtists.length,
        updated,
        skipped,
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
