import { describe, it, expect, afterEach } from 'vitest';
import { getAudioContextClass, createAudioContext } from '../lib/audioContext';

describe('audioContext helper', () => {
  const originalAudioContext = window.AudioContext;
  const originalWebkitAudioContext = (window as any).webkitAudioContext;

  afterEach(() => {
    window.AudioContext = originalAudioContext;
    (window as any).webkitAudioContext = originalWebkitAudioContext;
  });

  it('retrieves standard AudioContext when available', () => {
    class MockAudioContext {}
    window.AudioContext = MockAudioContext as any;
    delete (window as any).webkitAudioContext;

    const cls = getAudioContextClass();
    expect(cls).toBe(MockAudioContext);
  });

  it('falls back to webkitAudioContext when standard AudioContext is absent', () => {
    class MockWebkitAudioContext {}
    delete (window as any).AudioContext;
    (window as any).webkitAudioContext = MockWebkitAudioContext;

    const cls = getAudioContextClass();
    expect(cls).toBe(MockWebkitAudioContext);
  });

  it('throws descriptive error if Web Audio API is unsupported', () => {
    delete (window as any).AudioContext;
    delete (window as any).webkitAudioContext;

    expect(() => getAudioContextClass()).toThrow(
      'Web Audio API (AudioContext) is not supported in this browser.'
    );
  });

  it('creates an AudioContext instance with options', () => {
    class MockAudioContext {
      public options: any;
      constructor(opts?: any) {
        this.options = opts;
      }
    }
    window.AudioContext = MockAudioContext as any;

    const ctx = createAudioContext({ sampleRate: 48000 }) as unknown as MockAudioContext;
    expect(ctx).toBeInstanceOf(MockAudioContext);
    expect(ctx.options).toEqual({ sampleRate: 48000 });
  });
});
