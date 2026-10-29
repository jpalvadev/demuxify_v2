/**
 * Web Audio API AudioContext helper with cross-browser fallback support
 * and SSR / non-browser environment safety.
 */

export function getAudioContextClass(): typeof AudioContext {
  if (typeof window === 'undefined' && typeof globalThis === 'undefined') {
    throw new Error('Web Audio API (AudioContext) is not available in this environment.');
  }

  const globalScope = (typeof window !== 'undefined' ? window : globalThis) as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };

  const AudioContextClass = globalScope.AudioContext || globalScope.webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error('Web Audio API (AudioContext) is not supported in this browser.');
  }

  return AudioContextClass;
}

export function createAudioContext(options?: AudioContextOptions): AudioContext {
  const AudioContextClass = getAudioContextClass();
  return new AudioContextClass(options);
}
