import { create } from "zustand";
import { Song, Playlist } from "@/data/mockData";
import { musicDb } from "@/lib/musicDb";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";



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
  crossfadeDuration: number;
  _seekTime: number | null;
  bassBoost: number;
  trebleBoost: number;
  nextPreloaded: boolean;
  audioDuration: number;

  setUserId: (id: string | null) => void;
  setCrossfadeEnabled: (enabled: boolean) => void;
  setCrossfadeDuration: (duration: number) => void;
  setBassBoost: (db: number) => void;
  setTrebleBoost: (db: number) => void;
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

// Safe localStorage getter with fallback
function safeLocalGet<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}
// Debounced save to backend
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveAudioSettings(userId: string, partial: Record<string, unknown>) {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    try {
      await supabase
        .from("user_audio_settings")
        .upsert({ user_id: userId, ...partial, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    } catch (e) {
      console.error("Failed to save audio settings:", e);
    }
  }, 500);
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
  crossfadeEnabled: safeLocalGet("crossfadeEnabled", true),
  crossfadeDuration: safeLocalGet("crossfadeDuration", 2),
  _seekTime: null,
  bassBoost: safeLocalGet("bassBoost", 0),
  trebleBoost: safeLocalGet("trebleBoost", 0),
  nextPreloaded: false,
  audioDuration: 0,

  setUserId: (id) => set({ userId: id }),
  setCrossfadeEnabled: (enabled) => {
    try { localStorage.setItem("crossfadeEnabled", JSON.stringify(enabled)); } catch {}
    set({ crossfadeEnabled: enabled });
    const userId = get().userId;
    if (userId) saveAudioSettings(userId, { crossfade_enabled: enabled });
  },
  setCrossfadeDuration: (duration) => {
    try { localStorage.setItem("crossfadeDuration", JSON.stringify(duration)); } catch {}
    set({ crossfadeDuration: duration });
    const userId = get().userId;
    if (userId) saveAudioSettings(userId, { crossfade_duration: duration });
  },
  setBassBoost: (db) => {
    try { localStorage.setItem("bassBoost", JSON.stringify(db)); } catch {}
    set({ bassBoost: db });
    const userId = get().userId;
    if (userId) saveAudioSettings(userId, { bass_boost: db });
  },
  setTrebleBoost: (db) => {
    try { localStorage.setItem("trebleBoost", JSON.stringify(db)); } catch {}
    set({ trebleBoost: db });
    const userId = get().userId;
    if (userId) saveAudioSettings(userId, { treble_boost: db });
  },

  loadUserData: async (userId) => {
    try {
      const [liked, playlists, recent, audioSettings] = await Promise.all([
        musicDb.getLikedSongs(userId),
        musicDb.getPlaylists(userId),
        musicDb.getRecentlyPlayed(userId),
        supabase.from("user_audio_settings").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      const settings = audioSettings.data;
      set({
        likedSongs: liked,
        playlists,
        recentlyPlayed: recent,
        userId,
        ...(settings ? {
          crossfadeEnabled: settings.crossfade_enabled,
          crossfadeDuration: Number(settings.crossfade_duration),
          bassBoost: Number(settings.bass_boost),
          trebleBoost: Number(settings.treble_boost),
        } : {}),
      });
    } catch (e) {
      console.error("Failed to load user data:", e);
      toast.error("Erreur lors du chargement de vos données");
    }
  },

  play: (song) => {
    const { userId, currentSong } = get();
    // Skip if already playing the same song
    if (currentSong?.id === song.id && get().isPlaying) return;
    // Validate song has a playable source
    if (!song.streamUrl && !song.id) {
      console.warn("[play] Song has no stream URL:", song.title);
      toast.error("Ce morceau n'est pas disponible");
      return;
    }
    set((state) => ({
      currentSong: song,
      isPlaying: true,
      progress: 0,
      audioDuration: 0,
      recentlyPlayed: [song, ...state.recentlyPlayed.filter((s) => s.id !== song.id)].slice(0, 30),
    }));
    if (userId) {
      musicDb.addRecentlyPlayed(userId, song).catch((e) => {
        console.error("Failed to save recently played:", e);
      });
    }
  },

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  next: () => {
    const { queue, currentSong, shuffle, repeat } = get();
    if (!currentSong || queue.length === 0) return;
    const idx = queue.findIndex((s) => s.id === currentSong.id);

    // If repeat one, restart current
    if (repeat === "one") {
      set({ progress: 0, _seekTime: 0 });
      return;
    }

    let nextIdx: number;
    if (shuffle) {
      if (queue.length <= 1) { nextIdx = 0; }
      else {
        do { nextIdx = Math.floor(Math.random() * queue.length); } while (nextIdx === idx);
      }
    } else {
      nextIdx = (idx + 1) % queue.length;
      // If repeat is off and we've wrapped around, stop
      if (repeat === "off" && nextIdx === 0 && idx === queue.length - 1) {
        set({ isPlaying: false });
        return;
      }
    }
    get().play(queue[nextIdx]);
  },

  previous: () => {
    const { queue, currentSong, shuffle, progress } = get();
    if (!currentSong || queue.length === 0) return;

    // If we're more than 3 seconds into the track, restart it instead
    if (progress > 3) {
      set({ progress: 0, _seekTime: 0 });
      return;
    }

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
  closePlayer: () => set({ currentSong: null, isPlaying: false, progress: 0, fullScreen: false, queue: [], audioDuration: 0 }),

  toggleLike: (song) => {
    const { userId } = get();
    const exists = get().likedSongs.some((ls) => ls.id === song.id);

    // Optimistic update
    set((s) => ({
      likedSongs: exists
        ? s.likedSongs.filter((ls) => ls.id !== song.id)
        : [...s.likedSongs, { ...song, liked: true }],
    }));

    if (userId) {
      const operation = exists
        ? musicDb.unlikeSong(userId, song.id)
        : musicDb.likeSong(userId, song);

      operation.catch((e) => {
        console.error("Like operation failed:", e);
        // Rollback on failure
        set((s) => ({
          likedSongs: exists
            ? [...s.likedSongs, { ...song, liked: true }]
            : s.likedSongs.filter((ls) => ls.id !== song.id),
        }));
        toast.error(exists ? "Erreur lors de la suppression du favori" : "Erreur lors de l'ajout aux favoris");
      });
    }
  },

  isLiked: (songId) => get().likedSongs.some((s) => s.id === songId),

  setQueue: (songs) => set({ queue: songs }),

  createPlaylist: async (name) => {
    const { userId } = get();
    if (!userId) {
      toast.error("Connectez-vous pour créer une playlist");
      return;
    }
    try {
      const pl = await musicDb.createPlaylist(userId, name);
      set((s) => ({ playlists: [pl, ...s.playlists] }));
      toast.success(`Playlist "${name}" créée`);
    } catch (e) {
      console.error("Failed to create playlist:", e);
      toast.error("Erreur lors de la création de la playlist");
    }
  },

  deletePlaylist: async (id) => {
    const { playlists } = get();
    const playlist = playlists.find((p) => p.id === id);
    try {
      await musicDb.deletePlaylist(id);
      set((s) => {
        const { [id]: _, ...rest } = s.playlistSongs;
        return { playlists: s.playlists.filter((p) => p.id !== id), playlistSongs: rest };
      });
      toast.success(playlist ? `Playlist "${playlist.name}" supprimée` : "Playlist supprimée");
    } catch (e) {
      console.error("Failed to delete playlist:", e);
      toast.error("Erreur lors de la suppression de la playlist");
    }
  },

  addSongToPlaylist: async (playlistId, song) => {
    const current = get().playlistSongs[playlistId] || [];
    // Prevent duplicates
    if (current.some((s) => s.id === song.id)) {
      toast("Ce morceau est déjà dans la playlist");
      return;
    }
    try {
      await musicDb.addSongToPlaylist(playlistId, song, current.length);
      set((s) => ({
        playlistSongs: {
          ...s.playlistSongs,
          [playlistId]: [...current, song],
        },
      }));
      toast.success("Morceau ajouté à la playlist");
    } catch (e) {
      console.error("Failed to add song to playlist:", e);
      toast.error("Erreur lors de l'ajout du morceau");
    }
  },

  removeSongFromPlaylist: async (playlistId, songId) => {
    const current = get().playlistSongs[playlistId] || [];
    // Optimistic update
    set((s) => ({
      playlistSongs: {
        ...s.playlistSongs,
        [playlistId]: current.filter((x) => x.id !== songId),
      },
    }));
    try {
      await musicDb.removeSongFromPlaylist(playlistId, songId);
    } catch (e) {
      console.error("Failed to remove song from playlist:", e);
      // Rollback
      set((s) => ({
        playlistSongs: { ...s.playlistSongs, [playlistId]: current },
      }));
      toast.error("Erreur lors de la suppression du morceau");
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
    try {
      await musicDb.clearRecentlyPlayed(userId);
      toast.success("Historique effacé");
    } catch (e) {
      console.error("Failed to clear recently played:", e);
      toast.error("Erreur lors de la suppression de l'historique");
    }
  },
}));
