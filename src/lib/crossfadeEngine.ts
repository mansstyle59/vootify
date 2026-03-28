/**
 * Crossfade Engine — manages smooth audio transitions between tracks.
 * Creates a temporary secondary Audio element that fades out the old track
 * while the main audio fades in with the new track.
 */

const FADE_STEPS = 30; // Number of volume steps during fade
const FADE_INTERVAL_MS = 50; // ms between each step

let _fadeOutAudio: HTMLAudioElement | null = null;
let _fadeTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start a crossfade transition from the current track to a new one.
 * - Captures the current audio state into a temporary element (fade-out)
 * - The main audio element is set to the new source (fade-in)
 *
 * @param mainAudio - The main HTMLAudioElement (audioManager.audio)
 * @param newSrc - URL of the new track to play
 * @param crossfadeDuration - Duration in seconds for the crossfade
 * @param mainVolume - Target volume for the main audio (user's volume setting)
 * @returns Promise that resolves when the fade-in is complete
 */
export function startCrossfade(
  mainAudio: HTMLAudioElement,
  newSrc: string,
  crossfadeDuration: number,
  mainVolume: number
): Promise<void> {
  return new Promise((resolve) => {
    // Clean up any previous crossfade
    cleanupCrossfade();

    const fadeDurationMs = crossfadeDuration * 1000;
    const stepInterval = Math.max(fadeDurationMs / FADE_STEPS, FADE_INTERVAL_MS);
    const totalSteps = Math.ceil(fadeDurationMs / stepInterval);

    // Capture current playback into a fade-out audio element
    const fadeOut = new Audio();
    fadeOut.src = mainAudio.src;
    fadeOut.currentTime = mainAudio.currentTime;
    fadeOut.volume = mainAudio.volume;
    fadeOut.setAttribute("playsinline", "true");
    _fadeOutAudio = fadeOut;

    // Start the fade-out audio (continues old track)
    fadeOut.play().catch(() => {});

    // Set up the main audio with the new track
    mainAudio.src = newSrc;
    mainAudio.volume = 0; // Start silent
    mainAudio.play().catch(() => {});

    // Animate volumes
    let step = 0;
    _fadeTimer = setInterval(() => {
      step++;
      const progress = Math.min(step / totalSteps, 1);

      // Ease-in-out curve for smoother transition
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Fade in main, fade out old
      mainAudio.volume = Math.min(eased * mainVolume, mainVolume);
      fadeOut.volume = Math.max((1 - eased) * mainVolume, 0);

      if (step >= totalSteps) {
        // Ensure final volumes
        mainAudio.volume = mainVolume;
        cleanupCrossfade();
        resolve();
      }
    }, stepInterval);
  });
}

/**
 * Check if a crossfade should be triggered based on current playback position.
 * Returns true if we're within the crossfade window before track end.
 */
export function shouldStartCrossfade(
  currentTime: number,
  duration: number,
  crossfadeDuration: number
): boolean {
  if (!isFinite(duration) || duration <= 0) return false;
  if (duration <= crossfadeDuration * 2) return false; // Track too short for crossfade
  const timeRemaining = duration - currentTime;
  return timeRemaining <= crossfadeDuration && timeRemaining > 0;
}

/**
 * Check if a crossfade is currently in progress
 */
export function isCrossfading(): boolean {
  return _fadeOutAudio !== null;
}

/**
 * Clean up crossfade resources
 */
export function cleanupCrossfade(): void {
  if (_fadeTimer) {
    clearInterval(_fadeTimer);
    _fadeTimer = null;
  }
  if (_fadeOutAudio) {
    try {
      _fadeOutAudio.pause();
      _fadeOutAudio.removeAttribute("src");
      _fadeOutAudio.load();
    } catch {}
    _fadeOutAudio = null;
  }
}
