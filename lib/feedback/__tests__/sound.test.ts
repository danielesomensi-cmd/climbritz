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

const CUES: SoundCue[] = ['turn', 'sent', 'fell', 'winner', 'eliminated', 'tick'];

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
  });

  it('winner is a rich ~1.5–2s fanfare with a sustained multi-voice chord', () => {
    const d = cueDuration('winner');
    expect(d).toBeGreaterThanOrEqual(1.5);
    expect(d).toBeLessThanOrEqual(2.1);
    const steps = getCueSteps('winner');
    // Chord: ≥3 voices starting together and sustained (release envelope).
    const byStart = new Map<number, number>();
    for (const st of steps) byStart.set(st.at, (byStart.get(st.at) ?? 0) + 1);
    expect(Math.max(...byStart.values())).toBeGreaterThanOrEqual(3);
    expect(steps.some((st) => st.release !== undefined && st.dur >= 1)).toBe(true);
    // Rising arpeggio before the chord.
    const lead = steps.filter((st) => st.type === 'triangle' && st.at < 0.45).map((st) => st.freq);
    expect(lead).toEqual([...lead].sort((a, b) => a - b));
    // Summed peak gain stays sane (compressor + low per-voice gains).
    const peakAtChord = steps.filter((st) => st.at === 0.46).reduce((s, st) => s + st.gain, 0);
    expect(peakAtChord).toBeLessThan(0.6);
  });

  it('eliminated is a ~1s descending sad-trombone cue, distinct from fell', () => {
    const d = cueDuration('eliminated');
    expect(d).toBeGreaterThanOrEqual(0.9);
    expect(d).toBeLessThanOrEqual(1.4);
    const freqs = getCueSteps('eliminated').map((st) => st.freq);
    expect(freqs).toEqual([...freqs].sort((a, b) => b - a));
    expect(getCueSteps('eliminated').some((st) => st.vibrato)).toBe(true);
    expect(cueDuration('fell')).toBeLessThan(0.5);
    expect(getCueSteps('eliminated')).not.toEqual(getCueSteps('fell'));
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

  it('schedules the winner/eliminated cues with filters, vibrato and a compressor bus', () => {
    setSoundEnabled(true);
    const param = () => ({
      value: 0,
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
    const createBiquadFilter = jest.fn(() => ({
      type: 'lowpass',
      Q: param(),
      frequency: param(),
      connect: jest.fn(),
    }));
    const createDynamicsCompressor = jest.fn(() => ({ connect: jest.fn() }));
    const Ctor = jest.fn().mockImplementation(() => ({
      state: 'running',
      currentTime: 0,
      destination: {},
      createBuffer: jest.fn(() => ({})),
      createBufferSource: jest.fn(() => ({ connect: jest.fn(), start: jest.fn() })),
      createOscillator,
      createBiquadFilter,
      createDynamicsCompressor,
      createGain: jest.fn(() => ({ gain: param(), connect: jest.fn() })),
    }));
    (window as unknown as { AudioContext: unknown }).AudioContext = Ctor;
    playCue('winner');
    expect(createOscillator).toHaveBeenCalledTimes(getCueSteps('winner').length);
    expect(createDynamicsCompressor).toHaveBeenCalledTimes(1);
    createOscillator.mockClear();
    playCue('eliminated');
    const steps = getCueSteps('eliminated');
    const lfos = steps.filter((st) => st.vibrato).length;
    expect(createOscillator).toHaveBeenCalledTimes(steps.length + lfos);
    expect(createBiquadFilter).toHaveBeenCalled();
    // Bus is reused, not rebuilt per cue.
    expect(createDynamicsCompressor).toHaveBeenCalledTimes(1);
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  });
  it('resumes a suspended/interrupted context before playing (iOS after background)', () => {
    setSoundEnabled(true);
    const param = () => ({ setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() });
    const resume = jest.fn(() => Promise.resolve());
    const Ctor = jest.fn().mockImplementation(() => ({
      state: 'interrupted',
      currentTime: 0,
      destination: {},
      resume,
      createBuffer: jest.fn(() => ({})),
      createBufferSource: jest.fn(() => ({ connect: jest.fn(), start: jest.fn() })),
      createOscillator: jest.fn(() => ({
        type: 'sine',
        frequency: param(),
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
      })),
      createGain: jest.fn(() => ({ gain: param(), connect: jest.fn() })),
    }));
    (window as unknown as { AudioContext: unknown }).AudioContext = Ctor;
    expect(() => playCue('sent')).not.toThrow();
    expect(resume).toHaveBeenCalled();
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  });
});
