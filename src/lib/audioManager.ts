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

  /** True when the user explicitly paused (vs OS interrupt) */
  private _explicitPause = false;

  private _stalledTimer: ReturnType<typeof setTimeout> | null = null;
  private _stalledRetries = 0;
  private static readonly MAX_STALLED_RETRIES = 4;
  private _keepaliveInterval: ReturnType<typeof setInterval> | null = null;
  private _interruptRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private _webLock: any = null;

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
      this._explicitPause = false;
      this._acquireWakeLock();
    });
    this.audio.addEventListener("pause", () => {
      this.isPlaying = false;
      if (this._explicitPause) {
        this._releaseWakeLock();
      }
    });
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
    this.audio.addEventListener("pause", () => {
      if (!this._explicitPause) {
        this._scheduleInterruptRecovery();
      }
    });
    this.audio.addEventListener("play", () => this._cancelInterruptRecovery());

    // ── Background keepalive ──
    this._setupKeepalive();

    // ── Visibility change — resume on foreground return ──
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.currentTrack && !this._explicitPause) {
        if (this.audio.paused && this.audio.src) {
          this.audio.play().catch(() => {});
        }
      }
    });

    (window as any).__audioManager = this;
    (window as any).__globalAudio = this.audio;
  }

  play(track?: TrackInfo) {
    const t = track || this.currentTrack;
    if (!t) return;

    this._explicitPause = false;

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
    this._explicitPause = true;
    this._cancelInterruptRecovery();
    this.audio.pause();
  }

  toggle() {
    if (this.audio.paused) {
      this._explicitPause = false;
      this.audio.play().catch(() => {});
    } else {
      this.pause();
    }
  }

  stop() {
    this._explicitPause = true;
    this._cancelInterruptRecovery();
    this.audio.pause();
    this.audio.currentTime = 0;
    this.currentTrack = null;
    this.isBuffering = false;
    this._releaseWakeLock();
  }

  next() {
    window.dispatchEvent(new Event("audio-next"));
  }

  prev() {
    window.dispatchEvent(new Event("audio-prev"));
  }

  /** Was the last pause an explicit user action? */
  get wasExplicitlyPaused(): boolean {
    return this._explicitPause;
  }

  /**
   * Handle stalled events with exponential backoff retry.
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
   * or Siri, detect the unwanted pause and try to resume.
   * Only runs if user hasn't explicitly paused.
   */
  private _scheduleInterruptRecovery() {
    if (!this.currentTrack || this._explicitPause) return;

    this._cancelInterruptRecovery();

    // Progressive retry: 2s, 4s, 8s
    let attempt = 0;
    const tryResume = () => {
      if (this._explicitPause || !this.currentTrack) return;
      if (this.audio.paused && this.audio.src) {
        this.audio.play().then(() => {
          if ("mediaSession" in navigator) {
            navigator.mediaSession.playbackState = "playing";
          }
          console.log(`[AudioManager] Recovered from interrupt (attempt ${attempt + 1})`);
        }).catch(() => {
          attempt++;
          if (attempt < 3) {
            this._interruptRecoveryTimer = setTimeout(tryResume, 2000 * Math.pow(2, attempt));
          }
        });
      }
    };

    // Initial grace period before first attempt
    this._interruptRecoveryTimer = setTimeout(tryResume, 2000);
  }

  private _cancelInterruptRecovery() {
    if (this._interruptRecoveryTimer) {
      clearTimeout(this._interruptRecoveryTimer);
      this._interruptRecoveryTimer = null;
    }
  }

  /**
   * Keepalive ping — prevents iOS from suspending the audio context
   * when the PWA is in background.
   */
  private _setupKeepalive() {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isPwa = window.matchMedia("(display-mode: standalone)").matches;

    // Run on iOS PWA or any standalone PWA
    if (!isIos && !isPwa) return;

    // More aggressive keepalive (5s) for iOS background resilience
    this._keepaliveInterval = setInterval(() => {
      if (!this.currentTrack || this._explicitPause) return;

      if (this.audio.paused && this.audio.src) {
        // Audio got silently paused by OS — try to resume
        this.audio.play().catch(() => {});
      }

      // Touch the media session to keep it alive
      if ("mediaSession" in navigator && this.isPlaying) {
        navigator.mediaSession.playbackState = "playing";
      }
    }, 5000);
  }

  /**
   * Acquire a Web Lock to hint to the browser that work is ongoing
   * (helps prevent suspension on some browsers)
   */
  private _acquireWakeLock() {
    if (this._webLock || typeof navigator.locks === "undefined") return;
    try {
      navigator.locks.request("audio-playback-lock", { mode: "exclusive" }, () => {
        return new Promise<void>((resolve) => {
          this._webLock = resolve;
        });
      }).catch(() => {});
    } catch {}
  }

  private _releaseWakeLock() {
    if (this._webLock) {
      this._webLock();
      this._webLock = null;
    }
  }

  updateMediaSession(track: TrackInfo) {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;

    // Multiple artwork sizes for optimal display on iOS lock screen & Control Center
    const artwork: MediaImage[] = track.cover
      ? [
          { src: track.cover, sizes: "96x96", type: "image/jpeg" },
          { src: track.cover, sizes: "128x128", type: "image/jpeg" },
          { src: track.cover, sizes: "256x256", type: "image/jpeg" },
          { src: track.cover, sizes: "512x512", type: "image/jpeg" },
        ]
      : [];

    ms.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album || (track.isLive ? "Radio" : ""),
      artwork,
    });

    ms.setActionHandler("play", () => this.play());
    ms.setActionHandler("pause", () => this.pause());
    ms.setActionHandler("nexttrack", () => this.next());
    ms.setActionHandler("previoustrack", () => this.prev());

    // ── Seek on lock screen: disabled for all tracks on iOS for clean UX ──
    // iOS shows a scrubber that can cause sync issues — disable it.
    // On other platforms, enable seek for non-live tracks.
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (!track.isLive && !isIos) {
      try {
        ms.setActionHandler("seekto", (details) => {
          if (details.seekTime != null && isFinite(details.seekTime)) {
            this.audio.currentTime = details.seekTime;
            window.dispatchEvent(new CustomEvent("audio-seeked", { detail: details.seekTime }));
          }
        });
        ms.setActionHandler("seekforward", (details) => {
          const skip = details.seekOffset || 10;
          this.audio.currentTime = Math.min(this.audio.currentTime + skip, this.audio.duration || Infinity);
        });
        ms.setActionHandler("seekbackward", (details) => {
          const skip = details.seekOffset || 10;
          this.audio.currentTime = Math.max(this.audio.currentTime - skip, 0);
        });
      } catch { /* unsupported */ }
    } else {
      // Disable seek for live/radio or iOS
      try {
        ms.setActionHandler("seekforward", null);
        ms.setActionHandler("seekbackward", null);
        ms.setActionHandler("seekto", null);
      } catch { /* unsupported */ }
    }

    // ── Update position state for lock screen progress bar (non-iOS) ──
    if (!track.isLive && !isIos) {
      this._updatePositionState();
    }
  }

  /** Sync lock screen progress bar position */
  private _updatePositionState() {
    if (!("mediaSession" in navigator) || !this.audio.duration || !isFinite(this.audio.duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: this.audio.duration,
        playbackRate: this.audio.playbackRate,
        position: Math.min(this.audio.currentTime, this.audio.duration),
      });
    } catch {}
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
