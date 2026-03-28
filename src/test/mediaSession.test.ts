import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePlayerStore } from "@/stores/playerStore";

// Mock Media Session API
const mockHandlers: Record<string, Function | null> = {};
const mockMediaSession = {
  metadata: null as any,
  playbackState: "none" as string,
  setActionHandler: vi.fn((action: string, handler: Function | null) => {
    mockHandlers[action] = handler;
  }),
  setPositionState: vi.fn(),
};

// @ts-ignore
Object.defineProperty(navigator, "mediaSession", {
  value: mockMediaSession,
  writable: true,
  configurable: true,
});

describe("Player Store — Media Session coherence", () => {
  beforeEach(() => {
    // Reset store to initial state
    usePlayerStore.setState({
      currentSong: null,
      queue: [],
      isPlaying: false,
      progress: 0,
      volume: 0.8,
      shuffle: false,
      repeat: "off",
      fullScreen: false,
      likedSongs: [],
      recentlyPlayed: [],
      userId: null,
      audioDuration: 0,
    });
    vi.clearAllMocks();
    Object.keys(mockHandlers).forEach(k => { mockHandlers[k] = null; });
  });

  const mockSong = {
    id: "test-1",
    title: "Test Song",
    artist: "Test Artist",
    album: "Test Album",
    duration: 240,
    coverUrl: "https://example.com/cover.jpg",
    streamUrl: "https://example.com/song.mp3",
    liked: false,
  };

  const mockRadio = {
    id: "radio-1",
    title: "Test Radio",
    artist: "Radio Genre",
    album: "",
    duration: 0, // Radio = live stream
    coverUrl: "https://example.com/radio.jpg",
    streamUrl: "https://example.com/stream",
    liked: false,
  };

  it("play() sets isPlaying to true and adds to recently played", () => {
    usePlayerStore.getState().play(mockSong);
    const state = usePlayerStore.getState();
    expect(state.isPlaying).toBe(true);
    expect(state.currentSong?.id).toBe("test-1");
    expect(state.recentlyPlayed[0]?.id).toBe("test-1");
  });

  it("togglePlay() flips isPlaying state", () => {
    usePlayerStore.getState().play(mockSong);
    expect(usePlayerStore.getState().isPlaying).toBe(true);
    usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
    usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it("next() with repeat off stops at end of queue", () => {
    usePlayerStore.setState({ queue: [mockSong], currentSong: mockSong, isPlaying: true });
    usePlayerStore.getState().next();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it("next() with repeat all wraps around", () => {
    const song2 = { ...mockSong, id: "test-2", title: "Song 2" };
    usePlayerStore.setState({ queue: [mockSong, song2], currentSong: song2, isPlaying: true, repeat: "all" });
    usePlayerStore.getState().next();
    expect(usePlayerStore.getState().currentSong?.id).toBe("test-1");
  });

  it("next() with repeat one restarts current song", () => {
    usePlayerStore.setState({ queue: [mockSong], currentSong: mockSong, isPlaying: true, repeat: "one" });
    usePlayerStore.getState().next();
    expect(usePlayerStore.getState().progress).toBe(0);
    expect(usePlayerStore.getState().currentSong?.id).toBe("test-1");
  });

  it("previous() restarts song if progress > 3s", () => {
    const song2 = { ...mockSong, id: "test-2" };
    usePlayerStore.setState({ queue: [mockSong, song2], currentSong: song2, isPlaying: true, progress: 5 });
    usePlayerStore.getState().previous();
    expect(usePlayerStore.getState().progress).toBe(0);
    expect(usePlayerStore.getState().currentSong?.id).toBe("test-2"); // stays on same
  });

  it("previous() goes to previous track if progress <= 3s", () => {
    const song2 = { ...mockSong, id: "test-2" };
    usePlayerStore.setState({ queue: [mockSong, song2], currentSong: song2, isPlaying: true, progress: 1 });
    usePlayerStore.getState().previous();
    expect(usePlayerStore.getState().currentSong?.id).toBe("test-1");
  });

  it("closePlayer() resets all player state", () => {
    usePlayerStore.getState().play(mockSong);
    usePlayerStore.getState().closePlayer();
    const state = usePlayerStore.getState();
    expect(state.currentSong).toBeNull();
    expect(state.isPlaying).toBe(false);
    expect(state.progress).toBe(0);
    expect(state.fullScreen).toBe(false);
    expect(state.queue).toEqual([]);
  });

  it("setQueue() updates queue", () => {
    const song2 = { ...mockSong, id: "test-2" };
    usePlayerStore.getState().setQueue([mockSong, song2]);
    expect(usePlayerStore.getState().queue).toHaveLength(2);
  });

  it("seekTo() updates progress and _seekTime", () => {
    usePlayerStore.getState().play(mockSong);
    usePlayerStore.getState().seekTo(120);
    expect(usePlayerStore.getState().progress).toBe(120);
    expect(usePlayerStore.getState()._seekTime).toBe(120);
  });

  it("isLive detection: duration 0 = radio", () => {
    expect(mockRadio.duration).toBe(0);
    expect(mockSong.duration).toBeGreaterThan(0);
  });

  it("play() skips if same song is already playing", () => {
    usePlayerStore.getState().play(mockSong);
    usePlayerStore.setState({ progress: 50 });
    usePlayerStore.getState().play(mockSong); // should not reset
    expect(usePlayerStore.getState().progress).toBe(50); // unchanged
  });

  it("cycleRepeat() cycles through off → all → one → off", () => {
    expect(usePlayerStore.getState().repeat).toBe("off");
    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe("all");
    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe("one");
    usePlayerStore.getState().cycleRepeat();
    expect(usePlayerStore.getState().repeat).toBe("off");
  });

  it("toggleShuffle() flips shuffle state", () => {
    expect(usePlayerStore.getState().shuffle).toBe(false);
    usePlayerStore.getState().toggleShuffle();
    expect(usePlayerStore.getState().shuffle).toBe(true);
  });
});
