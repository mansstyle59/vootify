import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-emby-authorization, x-mediabrowser-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SERVER_NAME = "Vootify";
const SERVER_ID = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
const SERVER_VERSION = "10.9.11";
// Fake user for auth responses
const FAKE_USER_ID = "f0e1d2c3b4a5f0e1d2c3b4a5f0e1d2c3";
const FAKE_USER_NAME = "vootify";
// Simple API key — anyone with the Supabase anon key can access
const API_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

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

/* ── /System/Info ── */
function handleSystemInfo() {
  return json({
    LocalAddress: "",
    ServerName: SERVER_NAME,
    Version: SERVER_VERSION,
    ProductName: "Jellyfin Server",
    Id: SERVER_ID,
    StartupWizardCompleted: true,
    OperatingSystem: "Linux",
    HasPendingRestart: false,
    HasUpdateAvailable: false,
    SupportsLibraryMonitor: true,
  });
}

/* ── /System/Info/Public ── */
function handleSystemInfoPublic() {
  return json({
    LocalAddress: "",
    ServerName: SERVER_NAME,
    Version: SERVER_VERSION,
    ProductName: "Jellyfin Server",
    Id: SERVER_ID,
    StartupWizardCompleted: true,
  });
}

/* ── /Users/AuthenticateByName ── */
function handleAuth() {
  return json({
    User: {
      Name: FAKE_USER_NAME,
      ServerId: SERVER_ID,
      Id: FAKE_USER_ID,
      HasPassword: true,
      HasConfiguredPassword: true,
      HasConfiguredEasyPassword: false,
      Policy: {
        IsAdministrator: true,
        IsHidden: false,
        IsDisabled: false,
        EnableAllFolders: true,
        EnableMediaPlayback: true,
        EnableAudioPlaybackTranscoding: false,
        EnableVideoPlaybackTranscoding: false,
        EnableContentDeletion: false,
      },
      Configuration: {
        PlayDefaultAudioTrack: true,
        DisplayMissingEpisodes: false,
        SubtitleMode: "Default",
      },
    },
    AccessToken: API_KEY,
    ServerId: SERVER_ID,
  });
}

/* ── /Users ── */
function handleUsers() {
  return json([
    {
      Name: FAKE_USER_NAME,
      ServerId: SERVER_ID,
      Id: FAKE_USER_ID,
      HasPassword: true,
      HasConfiguredPassword: true,
      Policy: { IsAdministrator: true },
    },
  ]);
}

/* ── Map DB song → Jellyfin BaseItemDto ── */
function toJellyfinItem(song: any): any {
  return {
    Name: song.title,
    ServerId: SERVER_ID,
    Id: song.id,
    Type: "Audio",
    MediaType: "Audio",
    RunTimeTicks: (song.duration || 0) * 10_000_000, // seconds → ticks
    Album: song.album || "",
    AlbumId: song.album
      ? song.album.toLowerCase().replace(/\s+/g, "-")
      : undefined,
    AlbumArtist: song.artist,
    Artists: [song.artist],
    AlbumPrimaryImageTag: song.cover_url ? "cover" : undefined,
    ImageTags: song.cover_url ? { Primary: "cover" } : {},
    BackdropImageTags: [],
    UserData: {
      PlaybackPositionTicks: 0,
      PlayCount: 0,
      IsFavorite: false,
      Played: false,
    },
    MediaSources: [
      {
        Id: song.id,
        Protocol: "Http",
        SupportsDirectPlay: true,
        SupportsDirectStream: true,
        SupportsTranscoding: false,
        Path: song.stream_url || "",
        Type: "Default",
        Container: "mp3",
        RunTimeTicks: (song.duration || 0) * 10_000_000,
      },
    ],
  };
}

function toJellyfinAlbum(album: string, artist: string, coverUrl: string | null, songs: any[]): any {
  const albumId = album.toLowerCase().replace(/\s+/g, "-");
  return {
    Name: album,
    ServerId: SERVER_ID,
    Id: albumId,
    Type: "MusicAlbum",
    AlbumArtist: artist,
    Artists: [artist],
    ChildCount: songs.length,
    ImageTags: coverUrl ? { Primary: "cover" } : {},
    BackdropImageTags: [],
    UserData: { PlayCount: 0, IsFavorite: false, Played: false },
  };
}

function toJellyfinArtist(name: string): any {
  return {
    Name: name,
    ServerId: SERVER_ID,
    Id: name.toLowerCase().replace(/\s+/g, "-"),
    Type: "MusicArtist",
    ImageTags: {},
    BackdropImageTags: [],
    UserData: { PlayCount: 0, IsFavorite: false, Played: false },
  };
}

/* ── /Items (search & browse) ── */
async function handleItems(params: URLSearchParams) {
  const sb = getSupabase();
  const searchTerm = params.get("SearchTerm") || params.get("searchTerm") || "";
  const parentId = params.get("ParentId") || params.get("parentId") || "";
  const includeItemTypes = (params.get("IncludeItemTypes") || params.get("includeItemTypes") || "").split(",").filter(Boolean);
  const limit = parseInt(params.get("Limit") || params.get("limit") || "50");
  const startIndex = parseInt(params.get("StartIndex") || params.get("startIndex") || "0");
  const sortBy = params.get("SortBy") || params.get("sortBy") || "";
  const albumId = params.get("AlbumIds") || params.get("albumIds") || "";

  // If requesting items of a specific album
  if (albumId || (parentId && parentId !== "root")) {
    const targetAlbum = albumId || parentId;
    const albumName = targetAlbum.replace(/-/g, " ");
    const { data: songs } = await sb
      .from("custom_songs")
      .select("*")
      .ilike("album", `%${albumName}%`)
      .order("title")
      .range(startIndex, startIndex + limit - 1);

    const items = (songs || []).map(toJellyfinItem);
    return json({ Items: items, TotalRecordCount: items.length, StartIndex: startIndex });
  }

  // Search
  if (searchTerm) {
    const q = `%${searchTerm}%`;
    const { data: songs, count } = await sb
      .from("custom_songs")
      .select("*", { count: "exact" })
      .or(`title.ilike.${q},artist.ilike.${q},album.ilike.${q}`)
      .order("title")
      .range(startIndex, startIndex + limit - 1);

    const items = (songs || []).map(toJellyfinItem);
    return json({ Items: items, TotalRecordCount: count || items.length, StartIndex: startIndex });
  }

  // Browse by type
  if (includeItemTypes.includes("MusicAlbum")) {
    const { data: songs } = await sb.from("custom_songs").select("*").order("album");
    const albumMap = new Map<string, { artist: string; cover: string | null; songs: any[] }>();
    for (const s of songs || []) {
      const key = s.album || s.title;
      if (!albumMap.has(key)) albumMap.set(key, { artist: s.artist, cover: s.cover_url, songs: [] });
      albumMap.get(key)!.songs.push(s);
    }
    const items = [...albumMap.entries()].map(([name, info]) =>
      toJellyfinAlbum(name, info.artist, info.cover, info.songs)
    );
    return json({ Items: items.slice(startIndex, startIndex + limit), TotalRecordCount: items.length, StartIndex: startIndex });
  }

  if (includeItemTypes.includes("MusicArtist")) {
    const { data: songs } = await sb.from("custom_songs").select("artist");
    const artists = [...new Set((songs || []).map((s: any) => s.artist))];
    const items = artists.map(toJellyfinArtist);
    return json({ Items: items.slice(startIndex, startIndex + limit), TotalRecordCount: items.length, StartIndex: startIndex });
  }

  // Default: return recent songs
  const { data: songs, count } = await sb
    .from("custom_songs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(startIndex, startIndex + limit - 1);

  const items = (songs || []).map(toJellyfinItem);
  return json({ Items: items, TotalRecordCount: count || items.length, StartIndex: startIndex });
}

/* ── /Items/:id ── */
async function handleItemById(itemId: string) {
  const sb = getSupabase();
  const { data: song } = await sb
    .from("custom_songs")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();

  if (!song) return json({ error: "Item not found" }, 404);
  return json(toJellyfinItem(song));
}

/* ── /Audio/:id/universal or /Audio/:id/stream ── */
async function handleAudioStream(itemId: string) {
  const sb = getSupabase();
  const { data: song } = await sb
    .from("custom_songs")
    .select("stream_url")
    .eq("id", itemId)
    .maybeSingle();

  if (!song?.stream_url) return json({ error: "Audio not found" }, 404);

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: song.stream_url },
  });
}

/* ── /Items/:id/Images/:type ── */
async function handleImage(itemId: string) {
  const sb = getSupabase();
  // Try song first
  const { data: song } = await sb
    .from("custom_songs")
    .select("cover_url")
    .eq("id", itemId)
    .maybeSingle();

  if (song?.cover_url) {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: song.cover_url },
    });
  }

  // Try as album slug
  const albumName = itemId.replace(/-/g, " ");
  const { data: albumSong } = await sb
    .from("custom_songs")
    .select("cover_url")
    .ilike("album", `%${albumName}%`)
    .not("cover_url", "is", null)
    .limit(1)
    .maybeSingle();

  if (albumSong?.cover_url) {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: albumSong.cover_url },
    });
  }

  return json({ error: "Image not found" }, 404);
}

/* ── /Views ── */
function handleViews() {
  return json({
    Items: [
      {
        Name: "Music",
        ServerId: SERVER_ID,
        Id: "music-library",
        Etag: "music",
        CollectionType: "music",
        Type: "CollectionFolder",
        IsFolder: true,
        UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, UnplayedItemCount: 0 },
        ImageTags: {},
        BackdropImageTags: [],
        LocationType: "FileSystem",
        MediaType: "",
      },
    ],
    TotalRecordCount: 1,
    StartIndex: 0,
  });
}

/* ── /Library/VirtualFolders ── */
function handleVirtualFolders() {
  return json([
    {
      Name: "Music",
      Locations: ["/music"],
      CollectionType: "music",
      LibraryOptions: {
        EnableArchiveMediaFiles: false,
        EnablePhotos: false,
        EnableRealtimeMonitor: true,
        EnableChapterImageExtraction: false,
        ExtractChapterImagesDuringLibraryScan: false,
        SaveLocalMetadata: false,
        EnableInternetProviders: true,
        AutomaticRefreshIntervalDays: 0,
        MetadataCountryCode: "FR",
        PreferredMetadataLanguage: "fr",
      },
      ItemId: "music-library",
      PrimaryImageItemId: null,
    },
  ]);
}

/* ── /Library/MediaFolders ── */
function handleMediaFolders() {
  return json({
    Items: [
      {
        Name: "Music",
        ServerId: SERVER_ID,
        Id: "music-library",
        CollectionType: "music",
        Type: "CollectionFolder",
        IsFolder: true,
        ImageTags: {},
        BackdropImageTags: [],
      },
    ],
    TotalRecordCount: 1,
    StartIndex: 0,
  });
}

/* ── Main router ── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Remove the edge function base path to get the API path
    const fullPath = url.pathname;
    // Extract path after /jellyfin-server/
    const apiPath = fullPath.replace(/^.*\/jellyfin-server\/?/, "/");

    // Jellyfin clients use different path patterns
    // /System/Info/Public — no auth needed
    if (apiPath.match(/^\/System\/Info\/Public/i)) {
      return handleSystemInfoPublic();
    }

    // /System/Info
    if (apiPath.match(/^\/System\/Info/i)) {
      return handleSystemInfo();
    }

    // /Users/AuthenticateByName
    if (apiPath.match(/^\/Users\/AuthenticateByName/i)) {
      return handleAuth();
    }

    // /Users/Public
    if (apiPath.match(/^\/Users\/Public/i)) {
      return handleUsers();
    }

    // /Users
    if (apiPath.match(/^\/Users\/?$/i)) {
      return handleUsers();
    }

    // /Users/:id
    if (apiPath.match(/^\/Users\/[^/]+\/?$/i)) {
      return handleAuth(); // return user info
    }

    // /Users/:id/Views
    if (apiPath.match(/^\/Users\/[^/]+\/Views/i)) {
      return handleViews();
    }

    // /Users/:id/Items (same as /Items)
    if (apiPath.match(/^\/Users\/[^/]+\/Items/i)) {
      // Check if it's /Users/:id/Items/:itemId
      const itemMatch = apiPath.match(/^\/Users\/[^/]+\/Items\/([^/?]+)/i);
      if (itemMatch) return await handleItemById(itemMatch[1]);
      return await handleItems(url.searchParams);
    }

    // /Items/:id/Images/:type
    const imageMatch = apiPath.match(/^\/Items\/([^/]+)\/Images/i);
    if (imageMatch) {
      return await handleImage(imageMatch[1]);
    }

    // /Items/:id
    const itemByIdMatch = apiPath.match(/^\/Items\/([^/]+)\/?$/i);
    if (itemByIdMatch) {
      return await handleItemById(itemByIdMatch[1]);
    }

    // /Items
    if (apiPath.match(/^\/Items\/?$/i) || apiPath.match(/^\/Items\?/i)) {
      return await handleItems(url.searchParams);
    }

    // /Audio/:id/universal or /Audio/:id/stream
    const audioMatch = apiPath.match(/^\/Audio\/([^/]+)\/(universal|stream)/i);
    if (audioMatch) {
      return await handleAudioStream(audioMatch[1]);
    }

    // /Search/Hints
    if (apiPath.match(/^\/Search\/Hints/i)) {
      const searchTerm = url.searchParams.get("SearchTerm") || url.searchParams.get("searchTerm") || "";
      const sb = getSupabase();
      const q = `%${searchTerm}%`;
      const { data: songs } = await sb
        .from("custom_songs")
        .select("*")
        .or(`title.ilike.${q},artist.ilike.${q}`)
        .limit(20);

      const hints = (songs || []).map((s: any) => ({
        ItemId: s.id,
        Id: s.id,
        Name: s.title,
        Album: s.album || "",
        AlbumArtist: s.artist,
        Artists: [s.artist],
        Type: "Audio",
        MediaType: "Audio",
        RunTimeTicks: (s.duration || 0) * 10_000_000,
      }));

      return json({ SearchHints: hints, TotalRecordCount: hints.length });
    }

    // /Library/VirtualFolders
    if (apiPath.match(/^\/Library\/VirtualFolders/i)) {
      return handleVirtualFolders();
    }

    // /Library/MediaFolders
    if (apiPath.match(/^\/Library\/MediaFolders/i)) {
      return handleMediaFolders();
    }

    // /Branding/Configuration
    if (apiPath.match(/^\/Branding/i)) {
      return json({ LoginDisclaimer: "", CustomCss: "", SplashscreenEnabled: false });
    }

    // /Playback/Info (for some clients)
    if (apiPath.match(/^\/MediaInfo/i) || apiPath.match(/^\/Playback/i)) {
      const idMatch = apiPath.match(/\/([0-9a-f-]{36})/i);
      if (idMatch) return await handleItemById(idMatch[1]);
    }

    // Root / status
    if (apiPath === "/" || apiPath === "") {
      return handleSystemInfoPublic();
    }

    // Fallback — return empty success to avoid client errors
    return json({});
  } catch (e) {
    console.error("jellyfin-server error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});
