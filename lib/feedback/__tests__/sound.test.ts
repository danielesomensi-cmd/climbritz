import {
  SOUND_STORAGE_KEY,
  cueDuration,
  getCueSteps,
  isMuted,
  isSoundEnabled,
  playCue,
  setSoundEnabled,
  unlockAudio,
  __resetAudioForTests,
  type SoundCue,
} from '../sound';

const CUES: SoundCue[] = ['turn', 'sent', 'fell', 'winner', 'tick'];

describe('sound cues (pure)', () => {
  it.each(CUES)('%s has at least one well-formed step', (cue) => {
    const steps = getCueSteps(cue);
    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) {
      expect(s.freq).toBeGreaterThan(20);
      expect(s.at).toBeGreaterThanOrEqual(0);
      expect(s.dur).toBeGreaterThan(0);
      expect(s.gain).toBeGreaterThan(0);
      expect(s.gain).toBeLessThanOrEqual(0.3);
    }
  });

  it('tick is the shortest cue and winner the longest', () => {
    const durations = CUES.map(cueDuration);
    expect(Math.min(...durations)).toBe(cueDuration('tick'));
    expect(Math.max(...durations)).toBe(cueDuration('winner'));
    expect(cueDuration('winner')).toBeLessThan(1);
  });
});

describe('mute state', () => {
  beforeEach(() => window.localStorage.clear());

  it('is muted by default', () => {
    expect(isSoundEnabled()).toBe(false);
    expect(isMuted()).toBe(true);
  });

  it('persists enabled/disabled per device', () => {
    setSoundEnabled(true);
    expect(window.localStorage.getItem(SOUND_STORAGE_KEY)).toBe('1');
    expect(isSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(window.localStorage.getItem(SOUND_STORAGE_KEY)).toBeNull();
    expect(isMuted()).toBe(true);
  });

  it('treats a throwing storage as muted and never throws', () => {
    const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(isSoundEnabled()).toBe(false);
    expect(() => setSoundEnabled(true)).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });
});

describe('playback without Web Audio', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetAudioForTests();
  });

  it('unlockAudio and playCue are safe no-ops when AudioContext is missing', () => {
    setSoundEnabled(true);
    expect(() => unlockAudio()).not.toThrow();
    expect(() => playCue('sent')).not.toThrow();
  });

  it('does not create oscillators when muted', () => {
    const createOscillator = jest.fn();
    const Ctor = jest.fn().mockImplementation(() => ({
      state: 'running',
      currentTime: 0,
      destination: {},
      createBuffer: jest.fn(() => ({})),
      createBufferSource: jest.fn(() => ({ connect: jest.fn(), start: jest.fn() })),
      createOscillator,
      createGain: jest.fn(),
    }));
    (window as unknown as { AudioContext: unknown }).AudioContext = Ctor;
    playCue('turn');
    expect(createOscillator).not.toHaveBeenCalled();
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  });

  it('schedules one oscillator per step when enabled', () => {
    setSoundEnabled(true);
    const param = () => ({
      setValueAtTime: jest.fn(),
      exponentialRampToValueAtTime: jest.fn(),
    });
    const createOscillator = jest.fn(() => ({
      type: 'sine',
      frequency: param(),
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    }));
    const Ctor = jest.fn().mockImplementation(() => ({
      state: 'running',
      currentTime: 0,
      destination: {},
      createBuffer: jest.fn(() => ({})),
      createBufferSource: jest.fn(() => ({ connect: jest.fn(), start: jest.fn() })),
      createOscillator,
      createGain: jest.fn(() => ({ gain: param(), connect: jest.fn() })),
    }));
    (window as unknown as { AudioContext: unknown }).AudioContext = Ctor;
    playCue('sent');
    expect(createOscillator).toHaveBeenCalledTimes(getCueSteps('sent').length);
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  });
});
