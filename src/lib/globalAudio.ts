/**
 * Global Audio Singleton — delegates to AudioManager.
 * This file exists for backward compatibility only.
 * @deprecated Import audioManager from "@/lib/audioManager" instead.
 */

import { audioManager } from "@/lib/audioManager";

export function getGlobalAudio(): HTMLAudioElement {
  return audioManager.audio;
}
