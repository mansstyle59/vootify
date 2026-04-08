import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/* ── Helpers to map DB rows → OpenMusic types ── */

function toSearchedArtist(name: string): any {
  return {
    ArtistID: name.toLowerCase().replace(/\s+/g, "-"),
    Name: name,
    Profile_Photo: "",
    Subscribers: 0,
  };
}

function toSearchedAlbum(song: any): any {
  return {
    AlbumID: song.album
      ? song.album.toLowerCase().replace(/\s+/g, "-")
      : song.id,
    Title: song.album || song.title,
    Artwork: song.cover_url || "",
    AlbumType: "album",
    Year: song.year || 0,
    Artists: [toSearchedArtist(song.artist)],
  };
}

function toFetchedTrack(song: any, index = 0): any {
  return {
    TrackID: song.id,
    Title: song.title,
    Playback_Clean: song.id,
    Playback_Explicit: null,
    Length: song.duration || 0,
    Index: index + 1,
    Views: 0,
    Album: toSearchedAlbum(song),
    Features: [],
  };
}

/* ── Route handlers ── */

async function handleStatus() {
  return json({
    online: true,
    title: "Vootify Music Server",
    body: "Votre serveur de musique personnel propulsé par Vootify",
    footer: `${new Date().toISOString().slice(0, 10)} · ${1192} morceaux`,
    om_verify: "",
  });
}

async function handleSearch(q: string) {
  const sb = getSupabase();
  const query = `%${q}%`;

  const { data: songs } = await sb
    .from("custom_songs")
    .select("*")
    .or(`title.ilike.${query},artist.ilike.${query},album.ilike.${query}`)
    .limit(30);

  const tracks = (songs || []).map((s: any, i: number) => toFetchedTrack(s, i));

  // Deduplicate albums & artists
  const albumMap = new Map<string, any>();
  const artistMap = new Map<string, any>();
  for (const s of songs || []) {
    const album = toSearchedAlbum(s);
    albumMap.set(album.AlbumID, album);
    const artist = toSearchedArtist(s.artist);
    artistMap.set(artist.ArtistID, artist);
  }

  return json({
    Tracks: tracks,
    Albums: [...albumMap.values()].slice(0, 10),
    Singles: [],
    Artists: [...artistMap.values()].slice(0, 10),
  });
}

async function handleQuick(q: string) {
  const sb = getSupabase();
  const query = `%${q}%`;
  const { data: songs } = await sb
    .from("custom_songs")
    .select("*")
    .or(`title.ilike.${query},artist.ilike.${query}`)
    .limit(8);

  return json({
    Tracks: (songs || []).map((s: any, i: number) => toFetchedTrack(s, i)),
  });
}

async function handleAlbum(albumId: string) {
  const sb = getSupabase();

  // albumId is slug-ified album name — reverse it
  const albumName = albumId.replace(/-/g, " ");
  const { data: songs } = await sb
    .from("custom_songs")
    .select("*")
    .ilike("album", `%${albumName}%`)
    .order("title");

  if (!songs || songs.length === 0) {
    return json({ error: "Album not found" }, 404);
  }

  const first = songs[0];
  return json({
    AlbumID: albumId,
    Title: first.album || first.title,
    Artwork: first.cover_url || "",
    AlbumType: "album",
    Year: first.year || 0,
    Artists: [toSearchedArtist(first.artist)],
    Tracks: songs.map((s: any, i: number) => toFetchedTrack(s, i)),
    Features: [],
  });
}

async function handleArtist(artistId: string) {
  const sb = getSupabase();
  const artistName = artistId.replace(/-/g, " ");

  const { data: songs } = await sb
    .from("custom_songs")
    .select("*")
    .ilike("artist", `%${artistName}%`)
    .order("title")
    .limit(100);

  if (!songs || songs.length === 0) {
    return json({ error: "Artist not found" }, 404);
  }

  const first = songs[0];
  const albumMap = new Map<string, any>();
  for (const s of songs) {
    const album = toSearchedAlbum(s);
    albumMap.set(album.AlbumID, album);
  }

  return json({
    ArtistID: artistId,
    Name: first.artist,
    Profile_Photo: "",
    Subscribers: 0,
    Albums: [...albumMap.values()],
    Singles: [],
    Tracks: songs.map((s: any, i: number) => toFetchedTrack(s, i)),
  });
}

async function handlePlayback(playbackId: string) {
  const sb = getSupabase();

  const { data: song } = await sb
    .from("custom_songs")
    .select("id, stream_url")
    .eq("id", playbackId)
    .maybeSingle();

  if (!song || !song.stream_url) {
    return json({ error: "Playback not found" }, 404);
  }

  return json({
    PlaybackID: song.id,
    YT_Video_ID: "",
    YT_Audio_ID: "",
    Playback_Audio_URL: song.stream_url,
  });
}

async function handleExact(songTitle: string, album: string, artist: string) {
  const sb = getSupabase();

  let query = sb.from("custom_songs").select("*");
  if (songTitle) query = query.ilike("title", `%${songTitle}%`);
  if (artist) query = query.ilike("artist", `%${artist}%`);

  const { data: songs } = await query.limit(10);

  const tracks = (songs || []).map((s: any, i: number) => ({
    ...toFetchedTrack(s, i),
    titleScore: 1.0,
    albumScore: 1.0,
    artistScore: 1.0,
  }));

  return json({ Tracks: tracks });
}

async function handleExplore() {
  const sb = getSupabase();

  const { data: recent } = await sb
    .from("custom_songs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  // Group by artist for shelves
  const artistMap = new Map<string, any[]>();
  for (const s of recent || []) {
    const list = artistMap.get(s.artist) || [];
    list.push(s);
    artistMap.set(s.artist, list);
  }

  const shelves = [
    {
      Title: "Ajoutés récemment",
      Albums: (recent || [])
        .reduce((acc: any[], s: any) => {
          const a = toSearchedAlbum(s);
          if (!acc.find((x: any) => x.AlbumID === a.AlbumID)) acc.push(a);
          return acc;
        }, [])
        .slice(0, 10),
    },
  ];

  return json({ Shelves: shelves });
}

/* ── Main router ── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop() || "";

    switch (path) {
      case "status":
        return await handleStatus();

      case "search": {
        const q = url.searchParams.get("q") || "";
        return await handleSearch(q);
      }

      case "quick": {
        const q = url.searchParams.get("q") || "";
        return await handleQuick(q);
      }

      case "album": {
        const id = url.searchParams.get("id") || "";
        return await handleAlbum(id);
      }

      case "artist": {
        const id = url.searchParams.get("id") || "";
        return await handleArtist(id);
      }

      case "playback": {
        const id = url.searchParams.get("id") || "";
        return await handlePlayback(id);
      }

      case "exact": {
        const song = url.searchParams.get("song") || "";
        const album = url.searchParams.get("album") || "";
        const artist = url.searchParams.get("artist") || "";
        return await handleExact(song, album, artist);
      }

      case "explore":
        return await handleExplore();

      default:
        // Root path — return status
        return await handleStatus();
    }
  } catch (e) {
    console.error("openmusic-server error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});
