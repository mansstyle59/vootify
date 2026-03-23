import { supabase } from "@/integrations/supabase/client";
import type { Song, Album } from "@/data/mockData";

interface JioSaavnSong {
  id: string;
  name: string;
  duration: number;
  artists?: { primary?: Array<{ name: string; image?: Array<{ url: string }> }> };
  image?: Array<{ url: string }>;
  album?: { id?: string; name?: string; url?: string };
  downloadUrl?: Array<{ url: string; quality: string }>;
}

interface JioSaavnAlbum {
  id: string;
  name: string;
  image?: Array<{ url: string }>;
  year?: string;
  artists?: { primary?: Array<{ name: string }> };
  songs?: JioSaavnSong[];
}

async function callJioSaavn(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("jiosaavn-proxy", { body });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || "JioSaavn error");
  return data.data;
}

function getBestImage(images?: Array<{ url: string }>): string {
  if (!images || images.length === 0) return "";
  return images[images.length - 1]?.url || images[0]?.url || "";
}

function getBestDownloadUrl(urls?: Array<{ url: string; quality: string }>): string {
  if (!urls || urls.length === 0) return "";
  // Prefer 320kbps > 160kbps > 96kbps > any
  const preferred = ["320kbps", "160kbps", "96kbps"];
  for (const q of preferred) {
    const match = urls.find((u) => u.quality === q);
    if (match) return match.url;
  }
  return urls[urls.length - 1]?.url || "";
}

function mapSong(song: JioSaavnSong): Song {
  const artistName = song.artists?.primary?.[0]?.name || "Artiste inconnu";
  return {
    id: `js-${song.id}`,
    title: song.name,
    artist: artistName,
    album: song.album?.name || "",
    duration: song.duration || 0,
    coverUrl: getBestImage(song.image),
    streamUrl: getBestDownloadUrl(song.downloadUrl),
    liked: false,
  };
}

function mapAlbum(album: JioSaavnAlbum): Album {
  return {
    id: `js-album-${album.id}`,
    title: album.name,
    artist: album.artists?.primary?.[0]?.name || "Artiste inconnu",
    coverUrl: getBestImage(album.image),
    year: album.year ? parseInt(album.year) : 2024,
    songs: (album.songs || []).map((s) => `js-${s.id}`),
  };
}

export const jiosaavnApi = {
  async search(query: string, limit = 20): Promise<Song[]> {
    const data = await callJioSaavn({ action: "search", query, limit });
    const results = data?.results || data || [];
    return (Array.isArray(results) ? results : []).map(mapSong);
  },

  async getCharts(limit = 20): Promise<Song[]> {
    const data = await callJioSaavn({ action: "charts", limit });
    const songs = data?.songs || data || [];
    return (Array.isArray(songs) ? songs : []).map(mapSong);
  },

  async getAlbum(albumId: string): Promise<{ album: Album; tracks: Song[] }> {
    const id = albumId.replace("js-album-", "");
    const data = await callJioSaavn({ action: "album", id });
    const album = mapAlbum(data);
    const tracks = (data.songs || []).map(mapSong);
    return { album, tracks };
  },

  async searchAlbums(query: string, limit = 12): Promise<Album[]> {
    const data = await callJioSaavn({ action: "search_albums", query, limit });
    const results = data?.results || data || [];
    return (Array.isArray(results) ? results : []).map(mapAlbum);
  },
};
