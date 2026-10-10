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

export type SoundCue = 'turn' | 'sent' | 'fell' | 'winner' | 'eliminated' | 'tick';

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
  /** Optional pitch glide target (Hz) reached at the end of the step. */
  endFreq?: number;
  /** Attack time in seconds (default 0.01). */
  attack?: number;
  /**
   * Sustained note: hold the peak and release over the last `release`
   * seconds (default: percussive exponential decay over the whole step).
   */
  release?: number;
  /** Optional vibrato (Hz rate, Hz depth) — the trombone wobble. */
  vibrato?: { rate: number; depth: number };
  /** Optional low-pass "wah": cutoff sweeps from → to (Hz) over the step. */
  wah?: { from: number; to: number };
}

export const SOUND_STORAGE_KEY = 'climbritz.sound.enabled';

// Note frequencies (equal temperament).
const N = {
  C3: 130.81,
  G3: 196.0,
  Ab3: 207.65,
  A3: 220.0,
  Bb3: 233.08,
  G4: 392.0,
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
  C6: 1046.5,
  E6: 1318.51,
  G6: 1567.98,
  C7: 2093.0,
};

/** GAME-002 winner fanfare: pickup arpeggio → sustained C-major chord + sparkle (~1.8s). */
const WINNER: ToneStep[] = [
  // Pickup arpeggio (triangle lead, soft square an octave below for brass body).
  ...[N.G4, N.C5, N.E5, N.G5].flatMap((f, i): ToneStep[] => [
    { freq: f, at: i * 0.11, dur: 0.13, type: 'triangle', gain: 0.16 },
    { freq: f / 2, at: i * 0.11, dur: 0.13, type: 'square', gain: 0.03 },
  ]),
  // Big sustained chord on the downbeat.
  { freq: N.C6, at: 0.46, dur: 1.3, type: 'triangle', gain: 0.12, attack: 0.02, release: 0.6 },
  { freq: N.G5, at: 0.46, dur: 1.3, type: 'triangle', gain: 0.08, attack: 0.02, release: 0.6 },
  { freq: N.E5, at: 0.46, dur: 1.3, type: 'triangle', gain: 0.08, attack: 0.02, release: 0.6 },
  { freq: N.C5, at: 0.46, dur: 1.3, type: 'sawtooth', gain: 0.025, attack: 0.03, release: 0.6, wah: { from: 2400, to: 900 } },
  { freq: N.C3, at: 0.46, dur: 1.3, type: 'sine', gain: 0.14, attack: 0.02, release: 0.7 },
  // Sparkle on top.
  { freq: N.E6, at: 0.62, dur: 0.18, type: 'sine', gain: 0.05 },
  { freq: N.G6, at: 0.74, dur: 0.18, type: 'sine', gain: 0.05 },
  { freq: N.C7, at: 0.86, dur: 0.5, type: 'sine', gain: 0.05 },
];

/** GAME-002 sad trombone "wah-wah-wah-waaah" (~1.2s). */
const ELIMINATED: ToneStep[] = [
  ...[N.Bb3, N.A3, N.Ab3].map(
    (f, i): ToneStep => ({
      freq: f,
      endFreq: f * 0.98,
      at: i * 0.24,
      dur: 0.22,
      type: 'sawtooth',
      gain: 0.12,
      attack: 0.03,
      release: 0.08,
      wah: { from: 350, to: 1400 },
    }),
  ),
  {
    freq: N.G3,
    endFreq: N.G3 * 0.94,
    at: 0.72,
    dur: 0.55,
    type: 'sawtooth',
    gain: 0.12,
    attack: 0.03,
    release: 0.25,
    vibrato: { rate: 6, depth: 5 },
    wah: { from: 1400, to: 300 },
  },
];

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
  // Falling buzz — short (a life lost, not the end).
  fell: [
    { freq: 311.13, at: 0, dur: 0.14, type: 'sawtooth', gain: 0.12 },
    { freq: 207.65, at: 0.13, dur: 0.24, type: 'sawtooth', gain: 0.12 },
  ],
  winner: WINNER,
  eliminated: ELIMINATED,
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

/**
 * Shared output bus: master gain → compressor → speakers, so stacked chord
 * voices never clip. Falls back to the destination if a node is missing.
 */
let bus: AudioNode | null = null;

function getBus(c: AudioContext): AudioNode {
  if (bus) return bus;
  try {
    const master = c.createGain();
    master.gain.value = 0.9;
    if (typeof c.createDynamicsCompressor === 'function') {
      const comp = c.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(c.destination);
    } else {
      master.connect(c.destination);
    }
    bus = master;
  } catch {
    bus = c.destination;
  }
  return bus;
}

function scheduleStep(c: AudioContext, out: AudioNode, t0: number, step: ToneStep): void {
  const start = t0 + step.at;
  const end = start + step.dur;
  const attack = Math.min(step.attack ?? 0.01, step.dur / 2);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = step.type;
  osc.frequency.setValueAtTime(step.freq, start);
  if (step.endFreq) osc.frequency.exponentialRampToValueAtTime(step.endFreq, end);

  // Envelope (exponential ramps can't touch 0 → 0.0001 floor).
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(step.gain, start + attack);
  if (step.release !== undefined) {
    const releaseAt = Math.max(start + attack, end - step.release);
    gain.gain.setValueAtTime(step.gain, releaseAt);
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  let node: AudioNode = osc;
  if (step.wah && typeof c.createBiquadFilter === 'function') {
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(step.wah.from, start);
    filter.frequency.exponentialRampToValueAtTime(step.wah.to, end);
    osc.connect(filter);
    node = filter;
  }
  node.connect(gain);
  gain.connect(out);

  if (step.vibrato) {
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = step.vibrato.rate;
    depth.gain.value = step.vibrato.depth;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(start);
    lfo.stop(end + 0.02);
  }
  osc.start(start);
  osc.stop(end + 0.02);
}

/** Play a cue if sound is enabled and audio was unlocked. Never throws. */
export function playCue(cue: SoundCue): void {
  if (!isSoundEnabled()) return;
  try {
    if (!ctx) unlockAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    const out = getBus(ctx);
    for (const step of getCueSteps(cue)) scheduleStep(ctx, out, t0, step);
  } catch {
    // Ignore — feedback is best effort.
  }
}

/** Test-only: drop the cached AudioContext. */
export function __resetAudioForTests(): void {
  ctx = null;
  bus = null;
}
