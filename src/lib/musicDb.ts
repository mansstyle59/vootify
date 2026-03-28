import { supabase } from "@/integrations/supabase/client";
import type { Song } from "@/data/mockData";
import { ANONYMOUS_USER_ID } from "@/lib/constants";

/** Throws if userId is missing or is the anonymous placeholder */
function assertValidUserId(userId: string): asserts userId is string {
  if (!userId || userId === ANONYMOUS_USER_ID) {
    throw new Error("Cannot perform DB operation with anonymous user ID. User must be authenticated.");
  }
}

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
    year: row.year || undefined,
    genre: row.genre || undefined,
  };
}

export const musicDb = {
  // Liked songs
  async getLikedSongs(userId: string): Promise<Song[]> {
    const PAGE = 1000;
    let all: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("liked_songs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) { console.error("getLikedSongs error:", error); return all.map(rowToSong); }
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all.map(rowToSong);
  },

  async likeSong(userId: string, song: Song): Promise<void> {
    assertValidUserId(userId);
    const { error } = await supabase
      .from("liked_songs")
      .upsert(songToRow(song, userId), { onConflict: "user_id,song_id" });
    if (error) throw error;
  },

  async unlikeSong(userId: string, songId: string): Promise<void> {
    assertValidUserId(userId);
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
    if (error) { console.error("getPlaylists error:", error); return []; }
    return data || [];
  },

  async createPlaylist(userId: string, name: string) {
    assertValidUserId(userId);
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
    assertValidUserId(userId);
    try {
      // Remove previous entry for same song to avoid duplicates
      await supabase
        .from("recently_played")
        .delete()
        .eq("user_id", userId)
        .eq("song_id", song.id);

      const { error } = await supabase
        .from("recently_played")
        .insert(songToRow(song, userId));
      if (error) throw error;
    } catch (e) {
      console.error("Failed to save recently played:", e);
    }
  },

  async getRecentlyPlayed(userId: string, limit = 30): Promise<Song[]> {
    const { data, error } = await supabase
      .from("recently_played")
      .select("*")
      .eq("user_id", userId)
      .order("played_at", { ascending: false })
      .limit(limit);
    if (error) { console.error("getRecentlyPlayed error:", error); return []; }
    return (data || []).map((r) => ({ ...rowToSong(r), liked: false }));
  },

  async clearRecentlyPlayed(userId: string) {
    assertValidUserId(userId);
    const { error } = await supabase
      .from("recently_played")
      .delete()
      .eq("user_id", userId);
    if (error) throw error;
  },

  // Search history
  async getSearchHistory(userId: string, limit = 8): Promise<string[]> {
    const { data, error } = await supabase
      .from("search_history")
      .select("query")
      .eq("user_id", userId)
      .order("searched_at", { ascending: false })
      .limit(limit);
    if (error) { console.error("getSearchHistory error:", error); return []; }
    return (data || []).map((r) => r.query);
  },

  async saveSearchQuery(userId: string, query: string): Promise<void> {
    assertValidUserId(userId);
    const { error } = await supabase
      .from("search_history")
      .upsert(
        { user_id: userId, query, searched_at: new Date().toISOString() },
        { onConflict: "user_id,query" }
      );
    if (error) console.error("saveSearchQuery error:", error);
  },

  async removeSearchQuery(userId: string, query: string): Promise<void> {
    const { error } = await supabase
      .from("search_history")
      .delete()
      .eq("user_id", userId)
      .eq("query", query);
    if (error) console.error("removeSearchQuery error:", error);
  },

  async clearSearchHistory(userId: string): Promise<void> {
    const { error } = await supabase
      .from("search_history")
      .delete()
      .eq("user_id", userId);
    if (error) console.error("clearSearchHistory error:", error);
  },
};
