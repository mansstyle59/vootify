import { create } from "zustand";
import { Song, Playlist } from "@/data/mockData";
import { musicDb } from "@/lib/musicDb";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { offlineCache } from "@/lib/offlineCache";

type StoredPlaylist = {
  id: string;
  name: string;
  cover_url: string | null;
  created_at: string;
};

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
  playlists: StoredPlaylist[];
  recentlyPlayed: Song[];
  playlistSongs: Record<string, Song[]>;
  userId: string | null;
  _seekTime: number | null;
  audioDuration: number;

  setUserId: (id: string | null) => void;
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
  createPlaylist: (name: string) => Promise<StoredPlaylist | null>;
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
  _seekTime: null,
  audioDuration: 0,

  setUserId: (id) => set({ userId: id }),

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
      toast.error("Erreur lors du chargement de vos données");
    }
  },

  play: (song) => {
    const { userId, currentSong } = get();
    if (currentSong?.id === song.id && get().isPlaying) return;
    if (!song.streamUrl && !song.id) {
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

    // Resolve cached audio URL
    const rawId = song.id.startsWith("custom-") ? song.id.slice(7) : song.id;
    offlineCache.getCachedUrl(rawId).then((cachedUrl) => {
      const current = get().currentSong;
      if (current?.id === song.id && cachedUrl) {
        set({ currentSong: { ...current, streamUrl: cachedUrl } });
      }
    }).catch(() => {});

    offlineCache.getCachedCoverUrl(rawId).then((cachedCover) => {
      if (cachedCover) {
        const current = get().currentSong;
        if (current?.id === song.id && !current.coverUrl?.startsWith("blob:")) {
          set({ currentSong: { ...current, coverUrl: cachedCover } });
        }
      }
    }).catch(() => {});

    if (userId && song.album !== "Radio en direct") {
      musicDb.addRecentlyPlayed(userId, song).catch(console.error);
    }
  },

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  next: () => {
    const { queue, currentSong, shuffle, repeat } = get();
    if (!currentSong || queue.length === 0) return;
    const idx = queue.findIndex((s) => s.id === currentSong.id);
    if (repeat === "one") { set({ progress: 0, _seekTime: 0 }); return; }
    let nextIdx: number;
    if (shuffle) {
      if (queue.length <= 1) nextIdx = 0;
      else { do { nextIdx = Math.floor(Math.random() * queue.length); } while (nextIdx === idx); }
    } else {
      nextIdx = (idx + 1) % queue.length;
      if (repeat === "off" && nextIdx === 0 && idx === queue.length - 1) { set({ isPlaying: false }); return; }
    }
    get().play(queue[nextIdx]);
  },

  previous: () => {
    const { queue, currentSong, shuffle, progress } = get();
    if (!currentSong || queue.length === 0) return;
    if (progress > 3) { set({ progress: 0, _seekTime: 0 }); return; }
    const idx = queue.findIndex((s) => s.id === currentSong.id);
    let prevIdx: number;
    if (shuffle) {
      if (queue.length <= 1) prevIdx = 0;
      else { do { prevIdx = Math.floor(Math.random() * queue.length); } while (prevIdx === idx); }
    } else {
      prevIdx = (idx - 1 + queue.length) % queue.length;
    }
    get().play(queue[prevIdx]);
  },

  setProgress: (p) => set({ progress: p }),
  seekTo: (time) => set({ progress: time, _seekTime: time }),
  setVolume: (v) => set({ volume: v }),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () => set((s) => ({ repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off" })),
  toggleFullScreen: () => set((s) => ({ fullScreen: !s.fullScreen })),

  closePlayer: () => {
    import("@/lib/audioManager").then(({ audioManager }) => audioManager.stop());
    set({ currentSong: null, isPlaying: false, progress: 0, fullScreen: false, queue: [], audioDuration: 0 });
  },

  toggleLike: (song) => {
    const { userId } = get();
    const exists = get().likedSongs.some((ls) => ls.id === song.id);
    if (!userId) { toast.error("Connectez-vous pour ajouter à votre bibliothèque"); return; }
    set((s) => ({
      likedSongs: exists ? s.likedSongs.filter((ls) => ls.id !== song.id) : [...s.likedSongs, { ...song, liked: true }],
    }));
    const operation = exists ? musicDb.unlikeSong(userId, song.id) : musicDb.likeSong(userId, song);
    operation
      .then(() => toast.success(exists ? "Retiré de la bibliothèque" : "Ajouté à la bibliothèque", { duration: 2000 }))
      .catch(() => {
        set((s) => ({
          likedSongs: exists ? [...s.likedSongs, { ...song, liked: true }] : s.likedSongs.filter((ls) => ls.id !== song.id),
        }));
        toast.error(exists ? "Erreur lors du retrait" : "Erreur lors de l'ajout");
      });
  },

  isLiked: (songId) => get().likedSongs.some((s) => s.id === songId),

  setQueue: (songs) => set({ queue: songs }),

  createPlaylist: async (name) => {
    const { userId } = get();
    if (!userId) { toast.error("Connectez-vous pour créer une playlist"); return null; }
    try {
      const pl = await musicDb.createPlaylist(userId, name);
      set((s) => ({ playlists: [pl, ...s.playlists] }));
      toast.success(`Playlist "${name}" créée`);
      return pl;
    } catch {
      toast.error("Erreur lors de la création de la playlist");
      return null;
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
    } catch {
      toast.error("Erreur lors de la suppression de la playlist");
    }
  },

  addSongToPlaylist: async (playlistId, song) => {
    const current = get().playlistSongs[playlistId] || [];
    if (current.some((s) => s.id === song.id)) { toast("Ce morceau est déjà dans la playlist"); return; }
    try {
      await musicDb.addSongToPlaylist(playlistId, song, current.length);
      set((s) => ({ playlistSongs: { ...s.playlistSongs, [playlistId]: [...current, song] } }));
      toast.success("Morceau ajouté à la playlist");
    } catch {
      toast.error("Erreur lors de l'ajout du morceau");
    }
  },

  removeSongFromPlaylist: async (playlistId, songId) => {
    const current = get().playlistSongs[playlistId] || [];
    set((s) => ({ playlistSongs: { ...s.playlistSongs, [playlistId]: current.filter((x) => x.id !== songId) } }));
    try {
      await musicDb.removeSongFromPlaylist(playlistId, songId);
    } catch {
      set((s) => ({ playlistSongs: { ...s.playlistSongs, [playlistId]: current } }));
      toast.error("Erreur lors de la suppression du morceau");
    }
  },

  loadPlaylistSongs: async (playlistId) => {
    try {
      const songs = await musicDb.getPlaylistSongs(playlistId);
      set((s) => ({ playlistSongs: { ...s.playlistSongs, [playlistId]: songs } }));
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
    } catch {
      toast.error("Erreur lors de la suppression de l'historique");
    }
  },
}));
