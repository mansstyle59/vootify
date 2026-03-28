/**
 * Global Audio Singleton — persists across all React renders and navigation.
 * NEVER recreate this instance. Always reuse it via `getGlobalAudio()`.
 */

const globalAudio = new Audio();
globalAudio.preload = "auto";
globalAudio.setAttribute("playsinline", "true");
// @ts-ignore — webkit iOS attributes
globalAudio.setAttribute("webkit-playsinline", "");
globalAudio.setAttribute("x-webkit-airplay", "allow");

// Expose on window for debugging (optional)
(window as any).__globalAudio = globalAudio;

export function getGlobalAudio(): HTMLAudioElement {
  return globalAudio;
}
