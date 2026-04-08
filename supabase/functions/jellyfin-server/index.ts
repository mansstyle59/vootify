import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-emby-authorization, x-mediabrowser-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
};

const SERVER_NAME = "Vootify";
const SERVER_ID = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
const SERVER_VERSION = "10.9.11";
const FAKE_USER_ID = "f0e1d2c3b4a5f0e1d2c3b4a5f0e1d2c3";
const FAKE_USER_NAME = "vootify";
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

/* ── Helpers ── */
function slugify(s: string) { return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""); }

/* ── /web/ Login page for Fintunes/Jellyfin clients ── */
function handleWebLogin(serverBaseUrl: string) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Vootify – Sign In</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.card{background:#1a1a1a;border-radius:16px;padding:40px 32px;width:100%;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.4)}
h1{font-size:24px;font-weight:700;text-align:center;margin-bottom:8px}
.sub{text-align:center;color:#888;font-size:14px;margin-bottom:32px}
label{display:block;font-size:13px;color:#aaa;margin-bottom:6px;margin-top:16px}
input{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #333;background:#111;color:#fff;font-size:16px;outline:none;transition:border .2s}
input:focus{border-color:#e94560}
button{width:100%;margin-top:28px;padding:14px;border:none;border-radius:10px;background:linear-gradient(135deg,#e94560,#c73a54);color:#fff;font-size:16px;font-weight:600;cursor:pointer;transition:opacity .2s}
button:disabled{opacity:.5;cursor:not-allowed}
.error{color:#e94560;font-size:13px;margin-top:12px;text-align:center;display:none}
.spinner{display:none;text-align:center;margin-top:12px;color:#888}
</style>
</head>
<body>
<div class="card">
<h1>🎵 Vootify</h1>
<p class="sub">Connectez-vous à votre bibliothèque musicale</p>
<form id="loginForm">
<label>Nom d'utilisateur</label>
<input id="username" type="text" value="vootify" autocomplete="username" autocapitalize="off"/>
<label>Mot de passe</label>
<input id="password" type="password" value="vootify" autocomplete="current-password"/>
<button type="submit" id="btn">Se connecter</button>
<div class="spinner" id="spinner">Connexion…</div>
<div class="error" id="error"></div>
</form>
</div>
<script>
const SERVER = "${serverBaseUrl}";
const SERVER_ID = "${SERVER_ID}";
const FAKE_USER_ID = "${FAKE_USER_ID}";

function generateDeviceId(){
  let id = localStorage.getItem('_deviceId2');
  if(!id){id='fintunes_'+Math.random().toString(36).substr(2,16);localStorage.setItem('_deviceId2',id)}
  return id;
}

document.getElementById('loginForm').addEventListener('submit', async(e)=>{
  e.preventDefault();
  const btn=document.getElementById('btn');
  const spinner=document.getElementById('spinner');
  const error=document.getElementById('error');
  btn.disabled=true; spinner.style.display='block'; error.style.display='none';
  
  try{
    const username=document.getElementById('username').value;
    const pw=document.getElementById('password').value;
    const deviceId=generateDeviceId();
    
    const res=await fetch(SERVER+'/Users/AuthenticateByName',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-Emby-Authorization':'MediaBrowser Client="Fintunes", Device="Web", DeviceId="'+deviceId+'", Version="1.0.0"'
      },
      body:JSON.stringify({Username:username,Pw:pw})
    });
    
    if(!res.ok) throw new Error('Identifiants invalides');
    const data=await res.json();
    
    // Store credentials in the format Fintunes expects (jellyfin format)
    const creds={
      Servers:[{
        ManualAddress:SERVER,
        manualAddressOnly:true,
        DateLastAccessed:Date.now(),
        LastConnectionMode:2,
        Name:"${SERVER_NAME}",
        Id:SERVER_ID,
        UserId:data.User?.Id||FAKE_USER_ID,
        AccessToken:data.AccessToken||"${API_KEY}",
        LocalAddress:SERVER
      }]
    };
    localStorage.setItem('jellyfin_credentials',JSON.stringify(creds));
    localStorage.setItem('_deviceId2',deviceId);
    
    // Also set Emby format just in case
    const embyCreds={
      Servers:[{
        ManualAddress:SERVER,
        ManualAddressOnly:true,
        IsLocalServer:false,
        DateLastAccessed:Date.now(),
        LastConnectionMode:2,
        Type:"jellyfin",
        Name:"${SERVER_NAME}",
        Id:SERVER_ID,
        UserId:data.User?.Id||FAKE_USER_ID,
        AccessToken:data.AccessToken||"${API_KEY}",
        Users:[{UserId:data.User?.Id||FAKE_USER_ID,AccessToken:data.AccessToken||"${API_KEY}"}],
        LocalAddress:SERVER,
        RemoteAddress:SERVER
      }]
    };
    localStorage.setItem('servercredentials3',JSON.stringify(embyCreds));
    
    spinner.textContent='✅ Connecté ! Redirection…';
  }catch(err){
    error.textContent=err.message||'Erreur de connexion';
    error.style.display='block';
    btn.disabled=false; spinner.style.display='none';
  }
});
</script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xhtml+xml; charset=utf-8",
    },
  });
}

/* ── /System/Info ── */
function handleSystemInfo() {
  return json({
    LocalAddress: "", ServerName: SERVER_NAME, Version: SERVER_VERSION,
    ProductName: "Jellyfin Server", Id: SERVER_ID,
    StartupWizardCompleted: true, OperatingSystem: "Linux",
    HasPendingRestart: false, HasUpdateAvailable: false, SupportsLibraryMonitor: true,
  });
}

function handleSystemInfoPublic() {
  return json({
    LocalAddress: "", ServerName: SERVER_NAME, Version: SERVER_VERSION,
    ProductName: "Jellyfin Server", Id: SERVER_ID, StartupWizardCompleted: true,
  });
}

/* ── Auth ── */
function handleAuth() {
  return json({
    User: {
      Name: FAKE_USER_NAME, ServerId: SERVER_ID, Id: FAKE_USER_ID,
      HasPassword: true, HasConfiguredPassword: true, HasConfiguredEasyPassword: false,
      Policy: { IsAdministrator: true, IsHidden: false, IsDisabled: false, EnableAllFolders: true, EnableMediaPlayback: true, EnableAudioPlaybackTranscoding: false, EnableVideoPlaybackTranscoding: false, EnableContentDeletion: false },
      Configuration: { PlayDefaultAudioTrack: true, DisplayMissingEpisodes: false, SubtitleMode: "Default" },
    },
    AccessToken: API_KEY, ServerId: SERVER_ID,
  });
}

function handleUsers() {
  return json([{ Name: FAKE_USER_NAME, ServerId: SERVER_ID, Id: FAKE_USER_ID, HasPassword: true, HasConfiguredPassword: true, Policy: { IsAdministrator: true } }]);
}

/* ── Map DB → Jellyfin ── */
function toJellyfinItem(song: any, index?: number): any {
  const ticks = (song.duration || 0) * 10_000_000;
  const genres = song.genre ? [song.genre] : [];
  const albumId = song.album ? slugify(song.album) : undefined;
  const artistId = slugify(song.artist || "");
  return {
    Name: song.title,
    ServerId: SERVER_ID,
    Id: song.id,
    Type: "Audio",
    MediaType: "Audio",
    RunTimeTicks: ticks,
    Album: song.album || "",
    AlbumId: albumId,
    AlbumArtist: song.artist,
    AlbumArtists: [{ Name: song.artist, Id: artistId }],
    ArtistItems: [{ Name: song.artist, Id: artistId }],
    Artists: [song.artist],
    AlbumPrimaryImageTag: song.cover_url ? "cover" : undefined,
    ImageTags: song.cover_url ? { Primary: "cover" } : {},
    ImageBlurHashes: {},
    BackdropImageTags: [],
    Genres: genres,
    GenreItems: genres.map((g: string) => ({ Name: g, Id: slugify(g) })),
    ProductionYear: song.year || undefined,
    PremiereDate: song.year ? `${song.year}-01-01T00:00:00.0000000Z` : undefined,
    SortName: (song.title || "").toLowerCase(),
    IndexNumber: index !== undefined ? index + 1 : undefined,
    ParentIndexNumber: 1,
    IsFolder: false,
    CanDownload: true,
    SupportsMediaProbe: false,
    Container: "mp3",
    DateCreated: song.created_at || undefined,
    UserData: {
      PlaybackPositionTicks: 0,
      PlayCount: 0,
      IsFavorite: false,
      Played: false,
      Key: song.id,
    },
    MediaSources: [{
      Id: song.id,
      Protocol: "Http",
      SupportsDirectPlay: true,
      SupportsDirectStream: true,
      SupportsTranscoding: false,
      Path: song.stream_url || "",
      Type: "Default",
      Container: "mp3",
      Size: 0,
      RunTimeTicks: ticks,
      Bitrate: 320000,
      MediaStreams: [{
        Codec: "mp3",
        Type: "Audio",
        Index: 0,
        IsDefault: true,
        IsForced: false,
        IsExternal: false,
        DisplayTitle: "MP3 stereo",
        Channels: 2,
        SampleRate: 44100,
        BitRate: 320000,
      }],
    }],
  };
}

function toJellyfinAlbum(album: any, songCount: number, genres?: string[]): any {
  const artistId = slugify(album.artist || "");
  return {
    Name: album.title,
    ServerId: SERVER_ID,
    Id: album.id || slugify(album.title),
    Type: "MusicAlbum",
    IsFolder: true,
    AlbumArtist: album.artist,
    AlbumArtists: [{ Name: album.artist, Id: artistId }],
    ArtistItems: [{ Name: album.artist, Id: artistId }],
    Artists: [album.artist],
    ChildCount: songCount,
    ProductionYear: album.year || undefined,
    PremiereDate: album.year ? `${album.year}-01-01T00:00:00.0000000Z` : undefined,
    SortName: (album.title || "").toLowerCase(),
    DateCreated: album.created_at || undefined,
    Genres: genres || [],
    GenreItems: (genres || []).map((g: string) => ({ Name: g, Id: slugify(g) })),
    ImageTags: album.cover_url ? { Primary: "cover" } : {},
    ImageBlurHashes: {},
    BackdropImageTags: [],
    UserData: { PlayCount: 0, IsFavorite: false, Played: false, Key: album.id || slugify(album.title) },
  };
}

function toJellyfinArtist(name: string, imageUrl?: string | null, songCount?: number, albumCount?: number): any {
  const id = slugify(name);
  return {
    Name: name,
    ServerId: SERVER_ID,
    Id: id,
    Type: "MusicArtist",
    IsFolder: true,
    SortName: name.toLowerCase(),
    ChildCount: albumCount || 0,
    SongCount: songCount || 0,
    ImageTags: imageUrl ? { Primary: "artist" } : {},
    ImageBlurHashes: {},
    BackdropImageTags: [],
    UserData: { PlayCount: 0, IsFavorite: false, Played: false, Key: id },
    Overview: "",
  };
}

function toJellyfinPlaylist(pl: any, songCount: number): any {
  return {
    Name: pl.name,
    ServerId: SERVER_ID,
    Id: pl.id,
    Type: "Playlist",
    MediaType: "Audio",
    IsFolder: true,
    ChildCount: songCount,
    DateCreated: pl.created_at || undefined,
    DateLastMediaAdded: pl.updated_at || undefined,
    ImageTags: pl.cover_url ? { Primary: "cover" } : {},
    ImageBlurHashes: {},
    BackdropImageTags: [],
    UserData: { PlayCount: 0, IsFavorite: false, Played: false, Key: pl.id },
  };
}

/* ── /Items/Latest ── */
async function handleLatestItems(params: URLSearchParams) {
  const limit = Math.min(parseInt(params.get("Limit") || "20", 10), 100);
  const parentId = params.get("ParentId") || "";
  const sb = getSupabase();

  // Fetch latest songs ordered by created_at desc
  const { data: songs } = await sb
    .from("custom_songs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  const items = (songs || []).map((s: any, i: number) => toJellyfinItem(s, i));
  return json(items); // /Items/Latest returns a flat array, not wrapped
}

/* ── /Items/Filters ── */
async function handleItemsFilters() {
  const sb = getSupabase();
  const { data: songs } = await sb.from("custom_songs").select("genre, year, artist");

  const genres = new Set<string>();
  const years = new Set<number>();
  const artists = new Set<string>();

  for (const s of songs || []) {
    if (s.genre) genres.add(s.genre);
    if (s.year) years.add(s.year);
    if (s.artist) artists.add(s.artist);
  }

  const sortedYears = [...years].sort((a, b) => b - a);

  return json({
    Genres: [...genres].sort(),
    Years: sortedYears,
    Tags: [],
    OfficialRatings: [],
    Features: [],
    GenreItems: [...genres].sort().map(g => ({ Name: g, Id: slugify(g) })),
    ArtistItems: [...artists].sort().map(a => ({ Name: a, Id: slugify(a) })),
  });
}

/* ── Helpers: parse Jellyfin params (case-insensitive) ── */
function p(params: URLSearchParams, key: string): string {
  return params.get(key) || params.get(key.charAt(0).toLowerCase() + key.slice(1)) || "";
}

/* ── /Items ── */
async function handleItems(params: URLSearchParams) {
  const sb = getSupabase();
  const searchTerm = p(params, "SearchTerm");
  const parentId = p(params, "ParentId");
  const includeItemTypes = p(params, "IncludeItemTypes").split(",").filter(Boolean);
  const limit = parseInt(p(params, "Limit") || "50");
  const startIndex = parseInt(p(params, "StartIndex") || "0");
  const sortByRaw = p(params, "SortBy").split(",").filter(Boolean);
  const sortOrderRaw = p(params, "SortOrder").split(",").filter(Boolean);
  const albumId = p(params, "AlbumIds");
  const artistIds = p(params, "ArtistIds");
  const genres = p(params, "Genres");
  const genreIds = p(params, "GenreIds");
  const years = p(params, "Years");
  const filters = p(params, "Filters");
  const nameStartsWith = p(params, "NameStartsWith");
  const recursive = p(params, "Recursive").toLowerCase() !== "false";

  const sortBy = (sortByRaw[0] || "").toLowerCase();
  const sortOrder = (sortOrderRaw[0] || "ascending").toLowerCase();
  const ascending = sortOrder !== "descending";

  // Songs for a specific album
  if (albumId || (parentId && parentId !== "root" && parentId !== "music-library")) {
    const targetId = albumId || parentId;
    const { data: albumRow } = await sb.from("custom_albums").select("title").eq("id", targetId).maybeSingle();
    let albumFilter = albumRow ? albumRow.title : targetId.replace(/-/g, " ");
    
    let q = sb.from("custom_songs").select("*", { count: "exact" });
    if (albumRow) {
      q = q.eq("album", albumRow.title);
    } else {
      q = q.ilike("album", `%${albumFilter}%`);
    }
    const { data: songs, count } = await q.order("title").range(startIndex, startIndex + limit - 1);
    const items = (songs || []).map((s: any, i: number) => toJellyfinItem(s, startIndex + i));
    return json({ Items: items, TotalRecordCount: count || items.length, StartIndex: startIndex });
  }

  // Songs for a specific artist
  if (artistIds) {
    const artistName = artistIds.replace(/-/g, " ");
    const { data: songs, count } = await sb.from("custom_songs").select("*", { count: "exact" })
      .ilike("artist", `%${artistName}%`)
      .order("album").order("title")
      .range(startIndex, startIndex + limit - 1);
    const items = (songs || []).map(toJellyfinItem);
    return json({ Items: items, TotalRecordCount: count || items.length, StartIndex: startIndex });
  }

  // Search with advanced filters
  if (searchTerm) {
    const q = `%${searchTerm}%`;
    let query = sb.from("custom_songs").select("*", { count: "exact" })
      .or(`title.ilike.${q},artist.ilike.${q},album.ilike.${q}`);
    query = applyFilters(query, { genres, genreIds, years, nameStartsWith });
    query = applySorting(query, sortBy, ascending);
    const { data: songs, count } = await query.range(startIndex, startIndex + limit - 1);
    const items = (songs || []).map(toJellyfinItem);
    return json({ Items: items, TotalRecordCount: count || items.length, StartIndex: startIndex });
  }

  // Browse by type
  if (includeItemTypes.includes("Playlist")) {
    return await handlePlaylistsList(sb, startIndex, limit, sortBy, ascending);
  }

  if (includeItemTypes.includes("MusicAlbum")) {
    return await handleAlbumsList(sb, startIndex, limit, sortBy, ascending, genres || genreIds);
  }

  if (includeItemTypes.includes("MusicArtist") || includeItemTypes.includes("AlbumArtist")) {
    return await handleArtistsList(sb, startIndex, limit, sortBy, ascending);
  }

  // Default: songs with filters and sorting
  let query = sb.from("custom_songs").select("*", { count: "exact" });
  query = applyFilters(query, { genres, genreIds, years, nameStartsWith });
  query = applySorting(query, sortBy, ascending);
  const { data: songs, count } = await query.range(startIndex, startIndex + limit - 1);
  const items = (songs || []).map(toJellyfinItem);
  return json({ Items: items, TotalRecordCount: count || items.length, StartIndex: startIndex });
}

/* ── Filter & Sort helpers ── */
function applyFilters(query: any, opts: { genres?: string; genreIds?: string; years?: string; nameStartsWith?: string }) {
  if (opts.genres) {
    const genreList = opts.genres.split("|").filter(Boolean);
    if (genreList.length === 1) query = query.ilike("genre", `%${genreList[0]}%`);
    else if (genreList.length > 1) query = query.or(genreList.map(g => `genre.ilike.%${g}%`).join(","));
  }
  if (opts.genreIds && !opts.genres) {
    const genreName = opts.genreIds.replace(/-/g, " ");
    query = query.ilike("genre", `%${genreName}%`);
  }
  if (opts.years) {
    const yearList = opts.years.split(",").map(Number).filter(n => !isNaN(n));
    if (yearList.length === 1) query = query.eq("year", yearList[0]);
    else if (yearList.length > 1) query = query.in("year", yearList);
  }
  if (opts.nameStartsWith) {
    query = query.ilike("title", `${opts.nameStartsWith}%`);
  }
  return query;
}

function applySorting(query: any, sortBy: string, ascending: boolean) {
  switch (sortBy) {
    case "name": case "sortname": return query.order("title", { ascending });
    case "artist": case "albumartist": return query.order("artist", { ascending }).order("title", { ascending: true });
    case "album": return query.order("album", { ascending }).order("title", { ascending: true });
    case "productionyear": return query.order("year", { ascending }).order("title", { ascending: true });
    case "datecreated": case "dateadded": return query.order("created_at", { ascending });
    case "random": return query.order("created_at", { ascending: false }); // Supabase can't random, fallback
    case "duration": case "runtime": return query.order("duration", { ascending });
    default: return query.order("created_at", { ascending: false });
  }
}

/* ── Albums list (uses custom_albums + fallback) ── */
async function handleAlbumsList(sb: any, startIndex: number, limit: number, sortBy: string, ascending: boolean, genres: string) {
  // Use custom_albums table for proper album data
  const { data: albums } = await sb.from("custom_albums").select("*").order(
    sortBy === "name" ? "title" : sortBy === "artist" ? "artist" : sortBy === "productionyear" ? "year" : "title",
    { ascending }
  );

  if (albums && albums.length > 0) {
    // Get song counts and genres per album
    const { data: songs } = await sb.from("custom_songs").select("album, genre");
    const countMap = new Map<string, number>();
    const genreMap = new Map<string, Set<string>>();
    for (const s of songs || []) {
      const key = (s.album || "").toLowerCase();
      countMap.set(key, (countMap.get(key) || 0) + 1);
      if (s.genre) {
        if (!genreMap.has(key)) genreMap.set(key, new Set());
        genreMap.get(key)!.add(s.genre);
      }
    }

    let items = albums.map((a: any) => toJellyfinAlbum(
      a, countMap.get(a.title.toLowerCase()) || 0, [...(genreMap.get(a.title.toLowerCase()) || [])]
    ));
    
    // Filter by genre if requested
    if (genres) {
      const genreFilter = genres.toLowerCase();
      const { data: genreSongs } = await sb.from("custom_songs").select("album").ilike("genre", `%${genreFilter}%`);
      const genreAlbums = new Set((genreSongs || []).map((s: any) => (s.album || "").toLowerCase()));
      items = items.filter((a: any) => genreAlbums.has(a.Name.toLowerCase()));
    }

    return json({ Items: items.slice(startIndex, startIndex + limit), TotalRecordCount: items.length, StartIndex: startIndex });
  }

  // Fallback: derive albums from custom_songs
  const { data: songs } = await sb.from("custom_songs").select("*").order("album");
  const albumMap = new Map<string, { artist: string; cover: string | null; year: number | null; count: number }>();
  for (const s of songs || []) {
    const key = s.album || s.title;
    if (!albumMap.has(key)) albumMap.set(key, { artist: s.artist, cover: s.cover_url, year: s.year, count: 0 });
    albumMap.get(key)!.count++;
  }
  const items = [...albumMap.entries()].map(([name, info]) =>
    toJellyfinAlbum({ title: name, artist: info.artist, cover_url: info.cover, year: info.year, id: slugify(name) }, info.count)
  );
  // Sort
  items.sort((a, b) => {
    const cmp = (a.SortName || "").localeCompare(b.SortName || "");
    return ascending ? cmp : -cmp;
  });
  return json({ Items: items.slice(startIndex, startIndex + limit), TotalRecordCount: items.length, StartIndex: startIndex });
}

/* ── Artists list (with images) ── */
async function handleArtistsList(sb: any, startIndex: number, limit: number, sortBy: string, ascending: boolean) {
  const { data: songs } = await sb.from("custom_songs").select("artist, album");
  
  // Count songs and albums per artist
  const artistSongCount = new Map<string, number>();
  const artistAlbums = new Map<string, Set<string>>();
  for (const s of songs || []) {
    if (!s.artist) continue;
    artistSongCount.set(s.artist, (artistSongCount.get(s.artist) || 0) + 1);
    if (!artistAlbums.has(s.artist)) artistAlbums.set(s.artist, new Set());
    if (s.album) artistAlbums.get(s.artist)!.add(s.album);
  }

  const artistNames = [...artistSongCount.keys()].sort((a, b) => {
    if (sortBy === "songcount") return ascending ? (artistSongCount.get(a)! - artistSongCount.get(b)!) : (artistSongCount.get(b)! - artistSongCount.get(a)!);
    const cmp = a.toLowerCase().localeCompare(b.toLowerCase());
    return ascending ? cmp : -cmp;
  });

  // Fetch artist images
  const { data: images } = await sb.from("artist_images").select("artist_name, image_url");
  const imageMap = new Map<string, string>();
  for (const img of images || []) imageMap.set(img.artist_name.toLowerCase(), img.image_url);

  const items = artistNames.map(name => toJellyfinArtist(
    name, imageMap.get(name.toLowerCase()), artistSongCount.get(name), artistAlbums.get(name)?.size
  ));
  return json({ Items: items.slice(startIndex, startIndex + limit), TotalRecordCount: items.length, StartIndex: startIndex });
}

/* ── Playlists ── */
async function handlePlaylistsList(sb: any, startIndex: number, limit: number, sortBy: string, ascending: boolean) {
  const { data: playlists } = await sb.from("playlists").select("*").order(
    sortBy === "name" ? "name" : "created_at", { ascending }
  );
  
  // Count songs per playlist
  const playlistIds = (playlists || []).map((p: any) => p.id);
  let songCounts = new Map<string, number>();
  if (playlistIds.length > 0) {
    const { data: pSongs } = await sb.from("playlist_songs").select("playlist_id").in("playlist_id", playlistIds);
    for (const ps of pSongs || []) {
      songCounts.set(ps.playlist_id, (songCounts.get(ps.playlist_id) || 0) + 1);
    }
  }

  const items = (playlists || []).map((p: any) => toJellyfinPlaylist(p, songCounts.get(p.id) || 0));
  return json({ Items: items.slice(startIndex, startIndex + limit), TotalRecordCount: items.length, StartIndex: startIndex });
}

async function handlePlaylistSongs(playlistId: string, params: URLSearchParams) {
  const sb = getSupabase();
  const limit = parseInt(params.get("Limit") || params.get("limit") || "200");
  const startIndex = parseInt(params.get("StartIndex") || params.get("startIndex") || "0");

  const { data: songs, count } = await sb.from("playlist_songs").select("*", { count: "exact" })
    .eq("playlist_id", playlistId).order("position").range(startIndex, startIndex + limit - 1);

  const items = (songs || []).map((s: any) => ({
    Name: s.title, ServerId: SERVER_ID, Id: s.song_id, Type: "Audio", MediaType: "Audio",
    RunTimeTicks: (s.duration || 0) * 10_000_000,
    Album: s.album || "", AlbumArtist: s.artist, Artists: [s.artist],
    ImageTags: s.cover_url ? { Primary: "cover" } : {},
    BackdropImageTags: [],
    UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false },
    MediaSources: [{ Id: s.song_id, Protocol: "Http", SupportsDirectPlay: true, SupportsDirectStream: true, SupportsTranscoding: false, Path: s.stream_url || "", Type: "Default", Container: "mp3", RunTimeTicks: (s.duration || 0) * 10_000_000 }],
  }));

  return json({ Items: items, TotalRecordCount: count || items.length, StartIndex: startIndex });
}

/* ── /Items/:id ── */
async function handleItemById(itemId: string) {
  const sb = getSupabase();
  
  // Try song
  const { data: song } = await sb.from("custom_songs").select("*").eq("id", itemId).maybeSingle();
  if (song) return json(toJellyfinItem(song));

  // Try album
  const { data: album } = await sb.from("custom_albums").select("*").eq("id", itemId).maybeSingle();
  if (album) {
    const { count } = await sb.from("custom_songs").select("id", { count: "exact", head: true }).eq("album", album.title);
    return json(toJellyfinAlbum(album, count || 0));
  }

  // Try playlist
  const { data: pl } = await sb.from("playlists").select("*").eq("id", itemId).maybeSingle();
  if (pl) {
    const { count } = await sb.from("playlist_songs").select("id", { count: "exact", head: true }).eq("playlist_id", pl.id);
    return json(toJellyfinPlaylist(pl, count || 0));
  }

  // Try as artist slug
  const artistName = itemId.replace(/-/g, " ");
  const { data: artistSongs } = await sb.from("custom_songs").select("artist").ilike("artist", `%${artistName}%`).limit(1);
  if (artistSongs && artistSongs.length > 0) {
    const { data: img } = await sb.from("artist_images").select("image_url").ilike("artist_name", `%${artistName}%`).maybeSingle();
    return json(toJellyfinArtist(artistSongs[0].artist, img?.image_url));
  }

  return json({ error: "Item not found" }, 404);
}

/* ── Audio stream ── */
async function handleAudioStream(itemId: string) {
  const sb = getSupabase();
  // Try custom_songs
  let { data: song } = await sb.from("custom_songs").select("stream_url").eq("id", itemId).maybeSingle();
  if (!song) {
    // Try playlist_songs by song_id
    const { data: ps } = await sb.from("playlist_songs").select("stream_url").eq("song_id", itemId).limit(1).maybeSingle();
    if (ps) song = ps;
  }
  if (!song?.stream_url) return json({ error: "Audio not found" }, 404);
  return new Response(null, { status: 302, headers: { ...corsHeaders, Location: song.stream_url } });
}

/* ── Images ── */
async function handleImage(itemId: string) {
  const sb = getSupabase();
  // Song cover
  const { data: song } = await sb.from("custom_songs").select("cover_url").eq("id", itemId).maybeSingle();
  if (song?.cover_url) return new Response(null, { status: 302, headers: { ...corsHeaders, Location: song.cover_url } });

  // Album cover
  const { data: album } = await sb.from("custom_albums").select("cover_url").eq("id", itemId).maybeSingle();
  if (album?.cover_url) return new Response(null, { status: 302, headers: { ...corsHeaders, Location: album.cover_url } });

  // Playlist cover
  const { data: pl } = await sb.from("playlists").select("cover_url").eq("id", itemId).maybeSingle();
  if (pl?.cover_url) return new Response(null, { status: 302, headers: { ...corsHeaders, Location: pl.cover_url } });

  // Artist image
  const artistName = itemId.replace(/-/g, " ");
  const { data: img } = await sb.from("artist_images").select("image_url").ilike("artist_name", `%${artistName}%`).limit(1).maybeSingle();
  if (img?.image_url) return new Response(null, { status: 302, headers: { ...corsHeaders, Location: img.image_url } });

  // Album slug fallback
  const { data: albumSong } = await sb.from("custom_songs").select("cover_url")
    .ilike("album", `%${artistName}%`).not("cover_url", "is", null).limit(1).maybeSingle();
  if (albumSong?.cover_url) return new Response(null, { status: 302, headers: { ...corsHeaders, Location: albumSong.cover_url } });

  return json({ error: "Image not found" }, 404);
}

/* ── Views / Library ── */
function handleViews() {
  return json({
    Items: [{
      Name: "Music", ServerId: SERVER_ID, Id: "music-library", Etag: "music",
      CollectionType: "music", Type: "CollectionFolder", IsFolder: true,
      UserData: { PlaybackPositionTicks: 0, PlayCount: 0, IsFavorite: false, Played: false, UnplayedItemCount: 0 },
      ImageTags: {}, BackdropImageTags: [], LocationType: "FileSystem", MediaType: "",
    }],
    TotalRecordCount: 1, StartIndex: 0,
  });
}

function handleVirtualFolders() {
  return json([{
    Name: "Music", Locations: ["/music"], CollectionType: "music",
    LibraryOptions: { EnableArchiveMediaFiles: false, EnablePhotos: false, EnableRealtimeMonitor: true, EnableChapterImageExtraction: false, ExtractChapterImagesDuringLibraryScan: false, SaveLocalMetadata: false, EnableInternetProviders: true, AutomaticRefreshIntervalDays: 0, MetadataCountryCode: "FR", PreferredMetadataLanguage: "fr" },
    ItemId: "music-library", PrimaryImageItemId: null,
  }]);
}

function handleMediaFolders() {
  return json({
    Items: [{ Name: "Music", ServerId: SERVER_ID, Id: "music-library", CollectionType: "music", Type: "CollectionFolder", IsFolder: true, ImageTags: {}, BackdropImageTags: [] }],
    TotalRecordCount: 1, StartIndex: 0,
  });
}

/* ── Playback Reporting (Scrobbling) ── */
async function handlePlaybackStart(req: Request) {
  try {
    const body = await req.json();
    const itemId = body.ItemId || body.itemId;
    if (!itemId) return json({ ok: true });

    const sb = getSupabase();
    const { data: song } = await sb.from("custom_songs").select("*").eq("id", itemId).maybeSingle();
    if (!song) return json({ ok: true });

    // Skip radio streams
    if (song.album === "Radio en direct") return json({ ok: true });

    // Get first user to attribute the play (service role, pick first user)
    const userId = song.user_id;

    // Remove previous entry for same song
    await sb.from("recently_played").delete().eq("user_id", userId).eq("song_id", song.id);

    // Insert new entry
    await sb.from("recently_played").insert({
      user_id: userId,
      song_id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album || "",
      duration: song.duration || 0,
      cover_url: song.cover_url || "",
      stream_url: song.stream_url || "",
    });

    console.log(`[scrobble] Started: ${song.artist} - ${song.title}`);
  } catch (e) {
    console.error("Playback report error:", e);
  }
  return json({ ok: true });
}

async function handlePlaybackStopped(req: Request) {
  // Just acknowledge — the start already recorded the play
  try { await req.json(); } catch {}
  return json({ ok: true });
}

/* ── Genres ── */
async function handleGenres() {
  const sb = getSupabase();
  const { data: songs } = await sb.from("custom_songs").select("genre");
  const genreSet = new Set<string>();
  for (const s of songs || []) if (s.genre) genreSet.add(s.genre);
  const items = [...genreSet].sort().map(g => ({
    Name: g, ServerId: SERVER_ID, Id: slugify(g), Type: "MusicGenre",
    ImageTags: {}, BackdropImageTags: [],
  }));
  return json({ Items: items, TotalRecordCount: items.length, StartIndex: 0 });
}

/* ── Statistics ── */
async function handleStats() {
  const sb = getSupabase();
  const [songsRes, albumsRes, artistsRes] = await Promise.all([
    sb.from("custom_songs").select("duration, artist, album", { count: "exact" }),
    sb.from("custom_albums").select("id", { count: "exact", head: true }),
    sb.from("custom_songs").select("artist"),
  ]);

  const songs = songsRes.data || [];
  const totalSongs = songsRes.count || songs.length;
  const totalDurationSeconds = songs.reduce((sum: number, s: any) => sum + (s.duration || 0), 0);

  // Albums: prefer custom_albums count, fallback to distinct from songs
  let totalAlbums = albumsRes.count || 0;
  if (totalAlbums === 0) {
    const albumSet = new Set(songs.map((s: any) => s.album).filter(Boolean));
    totalAlbums = albumSet.size;
  }

  const artistSet = new Set((artistsRes.data || []).map((s: any) => s.artist).filter(Boolean));
  const totalArtists = artistSet.size;

  const hours = Math.floor(totalDurationSeconds / 3600);
  const minutes = Math.floor((totalDurationSeconds % 3600) / 60);

  return json({
    TotalSongs: totalSongs,
    TotalAlbums: totalAlbums,
    TotalArtists: totalArtists,
    TotalDurationSeconds: totalDurationSeconds,
    TotalDurationTicks: totalDurationSeconds * 10_000_000,
    TotalDurationFormatted: `${hours}h ${minutes}m`,
    ServerName: SERVER_NAME,
    ServerVersion: SERVER_VERSION,
  });
}

/* ── Similar Items ── */
async function handleSimilar(itemId: string, params: URLSearchParams) {
  const sb = getSupabase();
  const limit = parseInt(params.get("Limit") || params.get("limit") || "20");

  // Find the source song
  const { data: source } = await sb.from("custom_songs").select("*").eq("id", itemId).maybeSingle();
  if (!source) return json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });

  // Strategy: find songs by same artist OR same genre, excluding the source
  const filters: string[] = [];
  if (source.artist) filters.push(`artist.eq.${source.artist}`);
  if (source.genre) filters.push(`genre.eq.${source.genre}`);
  if (source.album) filters.push(`album.eq.${source.album}`);

  if (filters.length === 0) return json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });

  const { data: candidates } = await sb.from("custom_songs").select("*")
    .or(filters.join(","))
    .neq("id", itemId)
    .limit(200);

  if (!candidates || candidates.length === 0) return json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });

  // Score candidates: same artist=3, same genre=2, same album=1
  const scored = candidates.map((c: any) => {
    let score = 0;
    if (c.artist === source.artist) score += 3;
    if (c.genre && c.genre === source.genre) score += 2;
    if (c.album && c.album === source.album) score += 1;
    return { song: c, score };
  });

  // Sort by score desc, then shuffle within same score for variety
  scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);

  const items = scored.slice(0, limit).map((s, i) => toJellyfinItem(s.song, i));
  return json({ Items: items, TotalRecordCount: items.length, StartIndex: 0 });
}

/* ── Instant Mix ── */
async function handleInstantMix(itemId: string, params: URLSearchParams) {
  const sb = getSupabase();
  const limit = parseInt(params.get("Limit") || params.get("limit") || "50");

  // Find seed song
  const { data: seed } = await sb.from("custom_songs").select("*").eq("id", itemId).maybeSingle();
  if (!seed) return json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });

  // Gather a broad pool: same genre, same artist, same album
  const filters: string[] = [];
  if (seed.genre) filters.push(`genre.eq.${seed.genre}`);
  if (seed.artist) filters.push(`artist.eq.${seed.artist}`);
  if (seed.album) filters.push(`album.eq.${seed.album}`);

  let pool: any[] = [];
  if (filters.length > 0) {
    const { data } = await sb.from("custom_songs").select("*").or(filters.join(",")).neq("id", itemId).limit(500);
    pool = data || [];
  }

  // If pool is too small, pad with random songs
  if (pool.length < limit) {
    const existing = new Set([itemId, ...pool.map((s: any) => s.id)]);
    const { data: extra } = await sb.from("custom_songs").select("*").limit(limit * 2);
    for (const s of extra || []) {
      if (!existing.has(s.id)) { pool.push(s); existing.add(s.id); }
      if (pool.length >= limit * 3) break;
    }
  }

  // Score: same artist+genre=5, same genre=3, same artist=2, same album=1, random bonus
  const scored = pool.map((c: any) => {
    let score = Math.random() * 0.5; // small random for shuffle
    if (c.artist === seed.artist) score += 2;
    if (c.genre && c.genre === seed.genre) score += 3;
    if (c.album && c.album === seed.album) score += 1;
    return { song: c, score };
  });
  scored.sort((a, b) => b.score - a.score);

  // Build mix: seed first, then scored picks
  const mixSongs = [seed, ...scored.slice(0, limit - 1).map(s => s.song)];
  const items = mixSongs.map((s, i) => toJellyfinItem(s, i));
  return json({ Items: items, TotalRecordCount: items.length, StartIndex: 0 });
}

/* ── Main router ── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const fullPath = url.pathname;
    const apiPath = fullPath.replace(/^.*\/jellyfin-server\/?/, "/");

    // Compute server base URL for the web login page (always https)
    const origin = url.origin.replace(/^http:/, "https:");
    const serverBaseUrl = fullPath.includes("/jellyfin-server")
      ? origin + fullPath.substring(0, fullPath.indexOf("/jellyfin-server") + "/jellyfin-server".length)
      : origin;

    // Web UI (login page for Fintunes / Jellyfin clients)
    if (apiPath.match(/^\/web\//i) || apiPath.match(/^\/web$/i)) return handleWebLogin(serverBaseUrl);

    // System
    if (apiPath.match(/^\/System\/Info\/Public/i)) return handleSystemInfoPublic();
    if (apiPath.match(/^\/System\/Info/i)) return handleSystemInfo();
    if (apiPath.match(/^\/System\/Ping/i)) return json("Jellyfin Server");

    // Auth
    if (apiPath.match(/^\/Users\/AuthenticateByName/i)) return handleAuth();
    if (apiPath.match(/^\/Users\/Public/i)) return handleUsers();
    if (apiPath.match(/^\/Users\/?$/i)) return handleUsers();
    if (apiPath.match(/^\/Users\/[^/]+\/Views/i)) return handleViews();

    // Playlists/:id/Items
    const plItemsMatch = apiPath.match(/^\/Playlists\/([^/]+)\/Items/i);
    if (plItemsMatch) return await handlePlaylistSongs(plItemsMatch[1], url.searchParams);

    // Users/:id/Items/:itemId
    const userItemMatch = apiPath.match(/^\/Users\/[^/]+\/Items\/([^/?]+)/i);
    if (userItemMatch) return await handleItemById(userItemMatch[1]);

    // Users/:id/Items
    if (apiPath.match(/^\/Users\/[^/]+\/Items/i)) return await handleItems(url.searchParams);

    // Users/:id
    if (apiPath.match(/^\/Users\/[^/]+\/?$/i)) return handleAuth();

    // Items/Filters (must be before Items/Latest and Items/:id)
    if (apiPath.match(/^\/Items\/Filters/i)) return await handleItemsFilters();

    // Items/Latest (must be before Items/:id)
    if (apiPath.match(/^\/Items\/Latest/i) || apiPath.match(/^\/Users\/[^/]+\/Items\/Latest/i))
      return await handleLatestItems(url.searchParams);

    // Items/:id/InstantMix
    const mixMatch = apiPath.match(/^\/Items\/([^/]+)\/InstantMix/i);
    if (mixMatch) return await handleInstantMix(mixMatch[1], url.searchParams);

    // Items/:id/Similar
    const similarMatch = apiPath.match(/^\/Items\/([^/]+)\/Similar/i);
    if (similarMatch) return await handleSimilar(similarMatch[1], url.searchParams);

    // Items/:id/Images
    const imageMatch = apiPath.match(/^\/Items\/([^/]+)\/Images/i);
    if (imageMatch) return await handleImage(imageMatch[1]);

    // Items/:id
    const itemByIdMatch = apiPath.match(/^\/Items\/([^/]+)\/?$/i);
    if (itemByIdMatch) return await handleItemById(itemByIdMatch[1]);

    // Items
    if (apiPath.match(/^\/Items\/?(\?|$)/i)) return await handleItems(url.searchParams);

    // Audio stream
    const audioMatch = apiPath.match(/^\/Audio\/([^/]+)\/(universal|stream)/i);
    if (audioMatch) return await handleAudioStream(audioMatch[1]);

    // Playback reporting (scrobbling)
    if (apiPath.match(/^\/Sessions\/Playing\/Stopped/i)) return await handlePlaybackStopped(req);
    if (apiPath.match(/^\/Sessions\/Playing\/(Progress)?/i)) return await handlePlaybackStart(req);
    if (apiPath.match(/^\/Sessions\/Playing$/i)) return await handlePlaybackStart(req);

    // Users/:id/PlayedItems/:itemId (mark as played)
    if (apiPath.match(/^\/Users\/[^/]+\/PlayedItems\/([^/]+)/i)) return json({ ok: true });

    // Search/Hints
    if (apiPath.match(/^\/Search\/Hints/i)) {
      const searchTerm = url.searchParams.get("SearchTerm") || url.searchParams.get("searchTerm") || "";
      const searchLimit = parseInt(url.searchParams.get("Limit") || "30");
      const sb = getSupabase();
      const q = `%${searchTerm}%`;

      // Search songs, albums, and artists in parallel
      const [songsRes, albumsRes, artistImgRes] = await Promise.all([
        sb.from("custom_songs").select("*").or(`title.ilike.${q},artist.ilike.${q},album.ilike.${q}`).limit(searchLimit),
        sb.from("custom_albums").select("*").or(`title.ilike.${q},artist.ilike.${q}`).limit(10),
        sb.from("artist_images").select("artist_name, image_url"),
      ]);

      const hints: any[] = [];

      // Song hints
      for (const s of songsRes.data || []) {
        hints.push({
          ItemId: s.id, Id: s.id, Name: s.title, Album: s.album || "",
          AlbumArtist: s.artist, Artists: [s.artist], Type: "Audio", MediaType: "Audio",
          RunTimeTicks: (s.duration || 0) * 10_000_000,
          MatchedTerm: searchTerm,
        });
      }

      // Album hints
      for (const a of albumsRes.data || []) {
        hints.push({
          ItemId: a.id, Id: a.id, Name: a.title,
          AlbumArtist: a.artist, Artists: [a.artist], Type: "MusicAlbum",
          ProductionYear: a.year || undefined,
          MatchedTerm: searchTerm,
        });
      }

      // Artist hints (deduplicated from songs)
      const matchedArtists = new Set<string>();
      for (const s of songsRes.data || []) {
        if (s.artist && s.artist.toLowerCase().includes(searchTerm.toLowerCase())) matchedArtists.add(s.artist);
      }
      const imgMap = new Map<string, string>();
      for (const img of artistImgRes.data || []) imgMap.set(img.artist_name.toLowerCase(), img.image_url);
      for (const name of matchedArtists) {
        hints.push({
          ItemId: slugify(name), Id: slugify(name), Name: name, Type: "MusicArtist",
          MatchedTerm: searchTerm,
        });
      }

      return json({ SearchHints: hints.slice(0, searchLimit), TotalRecordCount: hints.length });
    }

    // Genres
    if (apiPath.match(/^\/MusicGenres/i) || apiPath.match(/^\/Genres/i)) return await handleGenres();

    // Artists
    if (apiPath.match(/^\/Artists/i)) return await handleItems(new URLSearchParams({ IncludeItemTypes: "MusicArtist", ...Object.fromEntries(url.searchParams) }));

    // Library
    if (apiPath.match(/^\/Library\/VirtualFolders/i)) return handleVirtualFolders();
    if (apiPath.match(/^\/Library\/MediaFolders/i)) return handleMediaFolders();

    // Stats
    if (apiPath.match(/^\/Library\/Stats/i) || apiPath.match(/^\/Stats/i)) return await handleStats();

    // Branding
    if (apiPath.match(/^\/Branding/i)) return json({ LoginDisclaimer: "", CustomCss: "", SplashscreenEnabled: false });

    // MediaInfo / Playback
    if (apiPath.match(/^\/MediaInfo/i) || apiPath.match(/^\/Playback/i)) {
      const idMatch = apiPath.match(/\/([0-9a-f-]{36})/i);
      if (idMatch) return await handleItemById(idMatch[1]);
    }

    // Root — serve login page for WebView clients, JSON for API clients
    if (apiPath === "/" || apiPath === "") {
      const accept = req.headers.get("accept") || "";
      if (accept.includes("text/html")) return handleWebLogin(serverBaseUrl);
      return handleSystemInfoPublic();
    }

    // Fallback
    return json({});
  } catch (e) {
    console.error("jellyfin-server error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});
