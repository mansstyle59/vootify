/**
 * AudioManager — singleton class managing the global audio element,
 * media session, playback state, and resilience (stalled recovery,
 * iOS background keepalive, offline fallback).
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
  isBuffering = false;

  private _stalledTimer: ReturnType<typeof setTimeout> | null = null;
  private _stalledRetries = 0;
  private static readonly MAX_STALLED_RETRIES = 4;
  private _keepaliveInterval: ReturnType<typeof setInterval> | null = null;
  private _interruptRecoveryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if ((window as any).__audioManager) return (window as any).__audioManager;

    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.setAttribute("playsinline", "true");
    // @ts-ignore — webkit iOS
    this.audio.setAttribute("webkit-playsinline", "");
    this.audio.setAttribute("x-webkit-airplay", "allow");

    this.audio.addEventListener("play", () => {
      this.isPlaying = true;
      this.isBuffering = false;
      this._stalledRetries = 0;
    });
    this.audio.addEventListener("pause", () => { this.isPlaying = false; });
    this.audio.addEventListener("ended", () => this.next());

    // ── Buffering / Stalled recovery ──
    this.audio.addEventListener("waiting", () => {
      this.isBuffering = true;
      window.dispatchEvent(new Event("audio-buffering"));
    });
    this.audio.addEventListener("canplay", () => {
      this.isBuffering = false;
      window.dispatchEvent(new Event("audio-ready"));
    });
    this.audio.addEventListener("playing", () => {
      this.isBuffering = false;
      this._stalledRetries = 0;
      window.dispatchEvent(new Event("audio-ready"));
    });

    this.audio.addEventListener("stalled", () => this._handleStalled());

    // ── iOS audio interrupt recovery ──
    this.audio.addEventListener("pause", () => this._scheduleInterruptRecovery());
    this.audio.addEventListener("play", () => this._cancelInterruptRecovery());

    // ── iOS background keepalive ──
    this._setupKeepalive();

    (window as any).__audioManager = this;
    (window as any).__globalAudio = this.audio;
  }

  play(track?: TrackInfo) {
    const t = track || this.currentTrack;
    if (!t) return;

    if (!this.currentTrack || this.currentTrack.url !== t.url) {
      this.audio.src = t.url;
      this.currentTrack = t;
      this.isBuffering = true;
      window.dispatchEvent(new Event("audio-buffering"));
      this.updateMediaSession(t);
    }

    this.audio.play().catch(() => {});
  }

  pause() {
    this._cancelInterruptRecovery();
    this.audio.pause();
  }

  toggle() {
    if (this.audio.paused) {
      this.audio.play().catch(() => {});
    } else {
      this.pause();
    }
  }

  stop() {
    this._cancelInterruptRecovery();
    this.audio.pause();
    this.audio.currentTime = 0;
    this.currentTrack = null;
    this.isBuffering = false;
  }

  next() {
    window.dispatchEvent(new Event("audio-next"));
  }

  prev() {
    window.dispatchEvent(new Event("audio-prev"));
  }

  /**
   * Handle stalled events with exponential backoff retry.
   * Tries to recover playback when the network stalls.
   */
  private _handleStalled() {
    if (this._stalledTimer) clearTimeout(this._stalledTimer);
    if (this._stalledRetries >= AudioManager.MAX_STALLED_RETRIES) {
      console.warn("[AudioManager] Max stalled retries reached");
      this.isBuffering = false;
      return;
    }

    this.isBuffering = true;
    window.dispatchEvent(new Event("audio-buffering"));

    const delay = Math.min(1000 * Math.pow(2, this._stalledRetries), 8000);
    this._stalledRetries++;

    this._stalledTimer = setTimeout(() => {
      if (!this.currentTrack || this.audio.paused) return;

      // If still stalled, try seeking slightly forward or reloading
      if (this.audio.readyState < 3) {
        const currentSrc = this.audio.src;
        const currentTime = this.audio.currentTime;

        // Try a micro-seek first
        if (this._stalledRetries <= 2) {
          try {
            this.audio.currentTime = currentTime + 0.1;
          } catch {}
          this.audio.play().catch(() => {});
        } else {
          // Hard reload as last resort
          this.audio.src = currentSrc;
          this.audio.currentTime = currentTime;
          this.audio.play().catch(() => {});
        }

        console.log(`[AudioManager] Stalled recovery attempt ${this._stalledRetries}`);
      }
    }, delay);
  }

  /**
   * iOS audio interrupt recovery — when iOS pauses audio for a phone call
   * or Siri, we detect the unwanted pause and try to resume.
   */
  private _scheduleInterruptRecovery() {
    // Only attempt if we think playback should be active
    if (!this.currentTrack) return;

    // If the page is hidden (background), the pause might be from OS
    // Give a grace period then try to resume
    this._interruptRecoveryTimer = setTimeout(() => {
      if (!this.currentTrack) return;
      // If audio is paused but we haven't explicitly paused, try resuming
      if (this.audio.paused && this.audio.src && document.visibilityState === "hidden") {
        this.audio.play().then(() => {
          if ("mediaSession" in navigator) {
            navigator.mediaSession.playbackState = "playing";
          }
          console.log("[AudioManager] Recovered from audio interrupt");
        }).catch(() => {});
      }
    }, 3000);
  }

  private _cancelInterruptRecovery() {
    if (this._interruptRecoveryTimer) {
      clearTimeout(this._interruptRecoveryTimer);
      this._interruptRecoveryTimer = null;
    }
  }

  /**
   * Keepalive ping — prevents iOS from suspending the audio context
   * when the PWA is in background. Periodically touches the audio
   * element to keep the process alive.
   */
  private _setupKeepalive() {
    // Only on iOS PWA
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isPwa = window.matchMedia("(display-mode: standalone)").matches;
    if (!isIos && !isPwa) return;

    this._keepaliveInterval = setInterval(() => {
      if (!this.isPlaying || !this.currentTrack) return;
      if (this.audio.paused && this.audio.src) {
        // Audio got silently paused by OS — try to resume
        this.audio.play().catch(() => {});
      }
      // Touch the media session to keep it alive
      if ("mediaSession" in navigator && this.currentTrack) {
        navigator.mediaSession.playbackState = "playing";
      }
    }, 10000);
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

    // ── SEEK DISABLED — force track-based navigation on lock screen ──
    try {
      ms.setActionHandler("seekforward", null);
      ms.setActionHandler("seekbackward", null);
      ms.setActionHandler("seekto", null);
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
