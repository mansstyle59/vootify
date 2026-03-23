import { supabase } from "@/integrations/supabase/client";
import type { Song } from "@/data/mockData";

function songToRow(song: Song, userId: string) {
  return {
    user_id: userId,
    song_id: song.id,
    title: song.title,
    artist: song.artist,
    album: song.album,
    duration: song.duration,
    cover_url: song.coverUrl,
    stream_url: song.streamUrl,
  };
}

function rowToSong(row: any): Song {
  return {
    id: row.song_id,
    title: row.title,
    artist: row.artist,
    album: row.album || "",
    duration: row.duration,
    coverUrl: row.cover_url || "",
    streamUrl: row.stream_url || "",
    liked: true,
  };
}

export const musicDb = {
  // Liked songs
  async getLikedSongs(userId: string): Promise<Song[]> {
    const { data, error } = await supabase
      .from("liked_songs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToSong);
  },

  async likeSong(userId: string, song: Song): Promise<void> {
    const { error } = await supabase
      .from("liked_songs")
      .upsert(songToRow(song, userId), { onConflict: "user_id,song_id" });
    if (error) throw error;
  },

  async unlikeSong(userId: string, songId: string): Promise<void> {
    const { error } = await supabase
      .from("liked_songs")
      .delete()
      .eq("user_id", userId)
      .eq("song_id", songId);
    if (error) throw error;
  },

  // Playlists
  async getPlaylists(userId: string) {
    const { data, error } = await supabase
      .from("playlists")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createPlaylist(userId: string, name: string) {
    const { data, error } = await supabase
      .from("playlists")
      .insert({ user_id: userId, name })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deletePlaylist(playlistId: string) {
    const { error } = await supabase
      .from("playlists")
      .delete()
      .eq("id", playlistId);
    if (error) throw error;
  },

  async getPlaylistSongs(playlistId: string): Promise<Song[]> {
    const { data, error } = await supabase
      .from("playlist_songs")
      .select("*")
      .eq("playlist_id", playlistId)
      .order("position");
    if (error) throw error;
    return (data || []).map(rowToSong);
  },

  async addSongToPlaylist(playlistId: string, song: Song, position: number) {
    const { error } = await supabase
      .from("playlist_songs")
      .upsert({
        playlist_id: playlistId,
        song_id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: song.duration,
        cover_url: song.coverUrl,
        stream_url: song.streamUrl,
        position,
      }, { onConflict: "playlist_id,song_id" });
    if (error) throw error;
  },

  async removeSongFromPlaylist(playlistId: string, songId: string) {
    const { error } = await supabase
      .from("playlist_songs")
      .delete()
      .eq("playlist_id", playlistId)
      .eq("song_id", songId);
    if (error) throw error;
  },

  // Recently played
  async addRecentlyPlayed(userId: string, song: Song) {
    const { error } = await supabase
      .from("recently_played")
      .insert(songToRow(song, userId));
    if (error) console.error("Failed to save recently played:", error);
  },

  async getRecentlyPlayed(userId: string, limit = 30): Promise<Song[]> {
    const { data, error } = await supabase
      .from("recently_played")
      .select("*")
      .eq("user_id", userId)
      .order("played_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map((r) => ({ ...rowToSong(r), liked: false }));
  },
};
