import { create } from "zustand";
import { Song, songs, defaultPlaylists, Playlist } from "@/data/mockData";

interface PlayerState {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  progress: number;
  volume: number;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  fullScreen: boolean;
  likedSongIds: Set<string>;
  playlists: Playlist[];
  recentlyPlayed: string[];

  play: (song: Song) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  setProgress: (p: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleFullScreen: () => void;
  toggleLike: (songId: string) => void;
  setQueue: (songs: Song[]) => void;
  createPlaylist: (name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, songId: string) => void;
  removeFromPlaylist: (playlistId: string, songId: string) => void;
}

const likedIds = new Set(songs.filter((s) => s.liked).map((s) => s.id));

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  queue: songs,
  isPlaying: false,
  progress: 0,
  volume: 0.8,
  shuffle: false,
  repeat: "off",
  fullScreen: false,
  likedSongIds: likedIds,
  playlists: defaultPlaylists,
  recentlyPlayed: [],

  play: (song) =>
    set((state) => ({
      currentSong: song,
      isPlaying: true,
      progress: 0,
      recentlyPlayed: [song.id, ...state.recentlyPlayed.filter((id) => id !== song.id)].slice(0, 20),
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
  toggleLike: (songId) =>
    set((s) => {
      const next = new Set(s.likedSongIds);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return { likedSongIds: next };
    }),
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
  deletePlaylist: (id) => set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),
  addToPlaylist: (playlistId, songId) =>
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId && !p.songIds.includes(songId)
          ? { ...p, songIds: [...p.songIds, songId] }
          : p
      ),
    })),
  removeFromPlaylist: (playlistId, songId) =>
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId ? { ...p, songIds: p.songIds.filter((id) => id !== songId) } : p
      ),
    })),
}));
