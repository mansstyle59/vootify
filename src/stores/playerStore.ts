import { create } from "zustand";
import { Song, Playlist } from "@/data/mockData";

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
  playlists: Playlist[];
  recentlyPlayed: Song[];
  playlistSongs: Record<string, Song[]>;

  play: (song: Song) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  setProgress: (p: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleFullScreen: () => void;
  toggleLike: (song: Song) => void;
  isLiked: (songId: string) => boolean;
  setQueue: (songs: Song[]) => void;
  createPlaylist: (name: string) => void;
  deletePlaylist: (id: string) => void;
  addSongToPlaylist: (playlistId: string, song: Song) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
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

  play: (song) =>
    set((state) => ({
      currentSong: song,
      isPlaying: true,
      progress: 0,
      recentlyPlayed: [song, ...state.recentlyPlayed.filter((s) => s.id !== song.id)].slice(0, 30),
    })),

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  next: () => {
    const { queue, currentSong, shuffle } = get();
    if (!currentSong || queue.length === 0) return;
    const idx = queue.findIndex((s) => s.id === currentSong.id);
    let nextIdx: number;
    if (shuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
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
      prevIdx = Math.floor(Math.random() * queue.length);
    } else {
      prevIdx = (idx - 1 + queue.length) % queue.length;
    }
    get().play(queue[prevIdx]);
  },

  setProgress: (p) => set({ progress: p }),
  setVolume: (v) => set({ volume: v }),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () =>
    set((s) => ({
      repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off",
    })),
  toggleFullScreen: () => set((s) => ({ fullScreen: !s.fullScreen })),

  toggleLike: (song) =>
    set((s) => {
      const exists = s.likedSongs.some((ls) => ls.id === song.id);
      return {
        likedSongs: exists
          ? s.likedSongs.filter((ls) => ls.id !== song.id)
          : [...s.likedSongs, song],
      };
    }),

  isLiked: (songId) => get().likedSongs.some((s) => s.id === songId),

  setQueue: (songs) => set({ queue: songs }),

  createPlaylist: (name) =>
    set((s) => ({
      playlists: [
        ...s.playlists,
        {
          id: `p${Date.now()}`,
          name,
          coverUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
          songIds: [],
          createdAt: new Date().toISOString().split("T")[0],
        },
      ],
    })),

  deletePlaylist: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.playlistSongs;
      return { playlists: s.playlists.filter((p) => p.id !== id), playlistSongs: rest };
    }),

  addSongToPlaylist: (playlistId, song) =>
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId && !p.songIds.includes(song.id)
          ? { ...p, songIds: [...p.songIds, song.id] }
          : p
      ),
      playlistSongs: {
        ...s.playlistSongs,
        [playlistId]: [...(s.playlistSongs[playlistId] || []).filter((x) => x.id !== song.id), song],
      },
    })),

  removeSongFromPlaylist: (playlistId, songId) =>
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId ? { ...p, songIds: p.songIds.filter((id) => id !== songId) } : p
      ),
      playlistSongs: {
        ...s.playlistSongs,
        [playlistId]: (s.playlistSongs[playlistId] || []).filter((x) => x.id !== songId),
      },
    })),
}));
