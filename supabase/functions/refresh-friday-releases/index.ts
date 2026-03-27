import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEEZER_API = "https://api.deezer.com";
const PLAYLIST_IDS = ["1071669561", "1478649355"];

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const seen = new Set<number>();
    const releases: Array<{
      album_id: number;
      title: string;
      artist: string;
      cover_url: string;
      position: number;
    }> = [];

    for (const pid of PLAYLIST_IDS) {
      try {
        const res = await fetch(
          `${DEEZER_API}/playlist/${pid}/tracks?limit=30`,
          { headers: { "User-Agent": "Vootify/1.0" } }
        );
        const data = await res.json();
        if (!data.data) continue;

        for (const t of data.data) {
          const albumId = t.album?.id;
          if (!albumId || seen.has(albumId)) continue;
          seen.add(albumId);
          releases.push({
            album_id: albumId,
            title: t.album?.title || t.title || "",
            artist: t.artist?.name || "",
            cover_url:
              t.album?.cover_xl ||
              t.album?.cover_big ||
              t.album?.cover_medium ||
              "",
            position: releases.length,
          });
        }
        await delay(300);
      } catch {
        // skip playlist
      }
    }

    if (releases.length === 0) {
      return new Response(
        JSON.stringify({ error: "No releases found" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clear old data and insert new
    await supabase.from("friday_releases").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error } = await supabase.from("friday_releases").insert(releases.slice(0, 25));

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, count: Math.min(releases.length, 25) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
