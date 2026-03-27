import { create } from "zustand";
import { Song, Playlist } from "@/data/mockData";
import { musicDb } from "@/lib/musicDb";



interface PlayerState {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  progress: number;
  volume: number;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  fullScreen: boolean;
  likedSongs: Song[];
  playlists: Array<{ id: string; name: string; cover_url: string | null; created_at: string }>;
  recentlyPlayed: Song[];
  playlistSongs: Record<string, Song[]>;
  userId: string | null;
  crossfadeEnabled: boolean;
  crossfadeDuration: number; // in seconds
  _seekTime: number | null;
  resolveStep: string | null;
  nextPreloaded: boolean;
  audioDuration: number; // real audio element duration (overrides metadata)
  

  setUserId: (id: string | null) => void;
  setCrossfadeEnabled: (enabled: boolean) => void;
  setCrossfadeDuration: (duration: number) => void;
  loadUserData: (userId: string) => Promise<void>;
  play: (song: Song) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  setProgress: (p: number) => void;
  seekTo: (time: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleFullScreen: () => void;
  closePlayer: () => void;
  toggleLike: (song: Song) => void;
  isLiked: (songId: string) => boolean;
  setQueue: (songs: Song[]) => void;
  createPlaylist: (name: string) => void;
  deletePlaylist: (id: string) => void;
  addSongToPlaylist: (playlistId: string, song: Song) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  loadPlaylistSongs: (playlistId: string) => Promise<void>;
  clearRecentlyPlayed: () => Promise<void>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  queue: [],
  isPlaying: false,
  progress: 0,
  volume: 0.8,
  shuffle: false,
  repeat: "off",
  fullScreen: false,
  likedSongs: [],
  playlists: [],
  recentlyPlayed: [],
  playlistSongs: {},
  userId: null,
  crossfadeEnabled: JSON.parse(localStorage.getItem("crossfadeEnabled") ?? "false"),
  crossfadeDuration: JSON.parse(localStorage.getItem("crossfadeDuration") ?? "12"),
  _seekTime: null,
  resolveStep: null,
  nextPreloaded: false,
  audioDuration: 0,

  setUserId: (id) => set({ userId: id }),
  setCrossfadeEnabled: (enabled) => { localStorage.setItem("crossfadeEnabled", JSON.stringify(enabled)); set({ crossfadeEnabled: enabled }); },
  setCrossfadeDuration: (duration) => { localStorage.setItem("crossfadeDuration", JSON.stringify(duration)); set({ crossfadeDuration: duration }); },



  loadUserData: async (userId) => {
    try {
      const [liked, playlists, recent] = await Promise.all([
        musicDb.getLikedSongs(userId),
        musicDb.getPlaylists(userId),
        musicDb.getRecentlyPlayed(userId),
      ]);
      set({ likedSongs: liked, playlists, recentlyPlayed: recent, userId });
    } catch (e) {
      console.error("Failed to load user data:", e);
    }
  },

  play: (song) => {
    const { userId, currentSong } = get();
    // Skip if already playing the same song (prevents re-trigger)
    if (currentSong?.id === song.id && get().isPlaying) return;
    set((state) => ({
      currentSong: song,
      isPlaying: true,
      progress: 0,
      recentlyPlayed: [song, ...state.recentlyPlayed.filter((s) => s.id !== song.id)].slice(0, 30),
    }));
    if (userId) {
      musicDb.addRecentlyPlayed(userId, song).catch(console.error);
    }
  },

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  next: () => {
    const { queue, currentSong, shuffle } = get();
    if (!currentSong || queue.length === 0) return;
    const idx = queue.findIndex((s) => s.id === currentSong.id);
    let nextIdx: number;
    if (shuffle) {
      // Pick random but never the same track (unless queue has only 1)
      if (queue.length <= 1) { nextIdx = 0; }
      else {
        do { nextIdx = Math.floor(Math.random() * queue.length); } while (nextIdx === idx);
      }
    } else {
      nextIdx = (idx + 1) % queue.length;
    }
    get().play(queue[nextIdx]);
  },

  previous: () => {
    const { queue, currentSong, shuffle } = get();
    if (!currentSong || queue.length === 0) return;
    const idx = queue.findIndex((s) => s.id === currentSong.id);
    let prevIdx: number;
    if (shuffle) {
      if (queue.length <= 1) { prevIdx = 0; }
      else {
        do { prevIdx = Math.floor(Math.random() * queue.length); } while (prevIdx === idx);
      }
    } else {
      prevIdx = (idx - 1 + queue.length) % queue.length;
    }
    get().play(queue[prevIdx]);
  },

  setProgress: (p) => set({ progress: p }),
  seekTo: (time) => set({ progress: time, _seekTime: time }),
  setVolume: (v) => set({ volume: v }),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () =>
    set((s) => ({
      repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off",
    })),
  toggleFullScreen: () => set((s) => ({ fullScreen: !s.fullScreen })),
  closePlayer: () => set({ currentSong: null, isPlaying: false, progress: 0, fullScreen: false, queue: [] }),

  toggleLike: (song) => {
    const { userId } = get();
    const exists = get().likedSongs.some((ls) => ls.id === song.id);

    set((s) => ({
      likedSongs: exists
        ? s.likedSongs.filter((ls) => ls.id !== song.id)
        : [...s.likedSongs, song],
    }));

    if (userId) {
      if (exists) {
        musicDb.unlikeSong(userId, song.id).catch(console.error);
      } else {
        musicDb.likeSong(userId, song).catch(console.error);
      }
    }
  },

  isLiked: (songId) => get().likedSongs.some((s) => s.id === songId),

  setQueue: (songs) => set({ queue: songs }),

  createPlaylist: async (name) => {
    const { userId } = get();
    if (!userId) return;
    try {
      const pl = await musicDb.createPlaylist(userId, name);
      set((s) => ({ playlists: [pl, ...s.playlists] }));
    } catch (e) {
      console.error("Failed to create playlist:", e);
    }
  },

  deletePlaylist: async (id) => {
    try {
      await musicDb.deletePlaylist(id);
      set((s) => {
        const { [id]: _, ...rest } = s.playlistSongs;
        return { playlists: s.playlists.filter((p) => p.id !== id), playlistSongs: rest };
      });
    } catch (e) {
      console.error("Failed to delete playlist:", e);
    }
  },

  addSongToPlaylist: async (playlistId, song) => {
    const current = get().playlistSongs[playlistId] || [];
    try {
      await musicDb.addSongToPlaylist(playlistId, song, current.length);
      set((s) => ({
        playlistSongs: {
          ...s.playlistSongs,
          [playlistId]: [...current.filter((x) => x.id !== song.id), song],
        },
      }));
    } catch (e) {
      console.error("Failed to add song to playlist:", e);
    }
  },

  removeSongFromPlaylist: async (playlistId, songId) => {
    try {
      await musicDb.removeSongFromPlaylist(playlistId, songId);
      set((s) => ({
        playlistSongs: {
          ...s.playlistSongs,
          [playlistId]: (s.playlistSongs[playlistId] || []).filter((x) => x.id !== songId),
        },
      }));
    } catch (e) {
      console.error("Failed to remove song from playlist:", e);
    }
  },

  loadPlaylistSongs: async (playlistId) => {
    try {
      const songs = await musicDb.getPlaylistSongs(playlistId);
      set((s) => ({
        playlistSongs: { ...s.playlistSongs, [playlistId]: songs },
      }));
    } catch (e) {
      console.error("Failed to load playlist songs:", e);
    }
  },

  clearRecentlyPlayed: async () => {
    const userId = get().userId;
    if (!userId) return;
    set({ recentlyPlayed: [] });
    await musicDb.clearRecentlyPlayed(userId);
  },
}));
