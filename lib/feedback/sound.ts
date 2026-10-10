// NATIVE-001 — synthesized sound cues (no asset files).
//
// Cues are tiny oscillator sequences rendered with the Web Audio API.
// iOS/WKWebView only lets an AudioContext produce sound after a user
// gesture, so callers must invoke `unlockAudio()` from a tap handler
// (e.g. "Start game") before the first `playCue()`.
//
// Sounds are DEFAULT MUTED. The mute flag is per device (localStorage),
// every storage access is wrapped in try/catch (private mode, cleared site
// data), and a failure always resolves to "muted".

export type SoundCue = 'turn' | 'sent' | 'fell' | 'winner' | 'tick';

export interface ToneStep {
  /** Frequency in Hz. */
  freq: number;
  /** Start offset from the cue start, in seconds. */
  at: number;
  /** Duration in seconds. */
  dur: number;
  type: OscillatorType;
  /** Peak gain 0..1 (kept low — this is a gym, not a concert). */
  gain: number;
}

export const SOUND_STORAGE_KEY = 'climbritz.sound.enabled';

const CUES: Record<SoundCue, ToneStep[]> = {
  // Short two-note "your turn" chime.
  turn: [
    { freq: 660, at: 0, dur: 0.09, type: 'sine', gain: 0.18 },
    { freq: 880, at: 0.1, dur: 0.12, type: 'sine', gain: 0.18 },
  ],
  // Rising major arpeggio.
  sent: [
    { freq: 523.25, at: 0, dur: 0.1, type: 'triangle', gain: 0.2 },
    { freq: 659.25, at: 0.09, dur: 0.1, type: 'triangle', gain: 0.2 },
    { freq: 783.99, at: 0.18, dur: 0.18, type: 'triangle', gain: 0.2 },
  ],
  // Falling buzz.
  fell: [
    { freq: 311.13, at: 0, dur: 0.14, type: 'sawtooth', gain: 0.12 },
    { freq: 207.65, at: 0.13, dur: 0.24, type: 'sawtooth', gain: 0.12 },
  ],
  // Little fanfare.
  winner: [
    { freq: 523.25, at: 0, dur: 0.12, type: 'square', gain: 0.1 },
    { freq: 659.25, at: 0.12, dur: 0.12, type: 'square', gain: 0.1 },
    { freq: 783.99, at: 0.24, dur: 0.12, type: 'square', gain: 0.1 },
    { freq: 1046.5, at: 0.36, dur: 0.35, type: 'square', gain: 0.1 },
  ],
  // Discreet click.
  tick: [{ freq: 1200, at: 0, dur: 0.03, type: 'sine', gain: 0.08 }],
};

/** Pure: the tone sequence for a cue. */
export function getCueSteps(cue: SoundCue): ToneStep[] {
  return CUES[cue];
}

/** Pure: total length of a cue in seconds. */
export function cueDuration(cue: SoundCue): number {
  return CUES[cue].reduce((max, s) => Math.max(max, s.at + s.dur), 0);
}

// ---- mute state -----------------------------------------------------------

export function isSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return !isSoundEnabled();
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      window.localStorage.setItem(SOUND_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(SOUND_STORAGE_KEY);
    }
  } catch {
    // Storage unavailable — the toggle just won't persist.
  }
}

// ---- audio context --------------------------------------------------------

type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;

function getAudioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Create/resume the AudioContext. Call from a user tap handler. */
export function unlockAudio(): void {
  try {
    const Ctor = getAudioCtor();
    if (!Ctor) return;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    // Play a silent 1-sample buffer: the canonical iOS unlock.
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    // No Web Audio — sounds simply stay silent.
  }
}

/** Play a cue if sound is enabled and audio was unlocked. Never throws. */
export function playCue(cue: SoundCue): void {
  if (!isSoundEnabled()) return;
  try {
    if (!ctx) unlockAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    for (const step of getCueSteps(cue)) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = step.type;
      osc.frequency.setValueAtTime(step.freq, t0 + step.at);
      // Short attack/release envelope to avoid clicks.
      gain.gain.setValueAtTime(0.0001, t0 + step.at);
      gain.gain.exponentialRampToValueAtTime(step.gain, t0 + step.at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + step.at + step.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + step.at);
      osc.stop(t0 + step.at + step.dur + 0.02);
    }
  } catch {
    // Ignore — feedback is best effort.
  }
}

/** Test-only: drop the cached AudioContext. */
export function __resetAudioForTests(): void {
  ctx = null;
}
