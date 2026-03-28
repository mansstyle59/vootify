/**
 * AudioManager — singleton class managing the global audio element,
 * media session, and playback state. Persists across all navigation.
 */

export interface TrackInfo {
  title: string;
  artist: string;
  cover?: string;
  album?: string;
  url: string;
  isLive?: boolean;
}

class AudioManager {
  audio: HTMLAudioElement;
  currentTrack: TrackInfo | null = null;
  isPlaying = false;

  constructor() {
    if ((window as any).__audioManager) return (window as any).__audioManager;

    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.setAttribute("playsinline", "true");
    // @ts-ignore — webkit iOS
    this.audio.setAttribute("webkit-playsinline", "");
    this.audio.setAttribute("x-webkit-airplay", "allow");

    this.audio.addEventListener("play", () => { this.isPlaying = true; });
    this.audio.addEventListener("pause", () => { this.isPlaying = false; });
    this.audio.addEventListener("ended", () => this.next());

    (window as any).__audioManager = this;
    // Keep backward compat
    (window as any).__globalAudio = this.audio;
  }

  play(track?: TrackInfo) {
    const t = track || this.currentTrack;
    if (!t) return;

    if (!this.currentTrack || this.currentTrack.url !== t.url) {
      this.audio.src = t.url;
      this.currentTrack = t;
      this.updateMediaSession(t);
    }

    this.audio.play().catch(() => {});
  }

  pause() {
    this.audio.pause();
  }

  toggle() {
    if (this.audio.paused) {
      this.audio.play().catch(() => {});
    } else {
      this.audio.pause();
    }
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.currentTrack = null;
  }

  next() {
    window.dispatchEvent(new Event("audio-next"));
  }

  prev() {
    window.dispatchEvent(new Event("audio-prev"));
  }

  updateMediaSession(track: TrackInfo) {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;

    ms.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || (track.isLive ? "Radio" : ""),
      artwork: track.cover
        ? [{ src: track.cover, sizes: "512x512", type: "image/png" }]
        : [],
    });

    ms.setActionHandler("play", () => this.play());
    ms.setActionHandler("pause", () => this.pause());
    ms.setActionHandler("nexttrack", () => this.next());
    ms.setActionHandler("previoustrack", () => this.prev());

    // Disable seek on iOS PWA for stability
    try {
      ms.setActionHandler("seekforward", null);
      ms.setActionHandler("seekbackward", null);
    } catch { /* unsupported */ }
  }

  updateMetadata(partial: Partial<TrackInfo>) {
    if (!this.currentTrack) return;
    Object.assign(this.currentTrack, partial);
    this.updateMediaSession(this.currentTrack);
  }
}

export const audioManager = new AudioManager();

/** @deprecated Use audioManager.audio instead */
export function getGlobalAudio(): HTMLAudioElement {
  return audioManager.audio;
}
