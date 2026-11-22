import * as THREE from 'three';
import { POS } from './render/layout';
import { pace, renderer, toScreen } from './render/scene';
import { loop } from './stage';
import { cards, soundMuted, soundVolume } from './store';

// ---- Audio graph & lifecycle ----
interface Graph {
  ctx: BaseAudioContext;
  out: AudioNode;
  noise: AudioBuffer;
  scale: number;
  now: number;
  track?: (stop: () => void) => void;
}

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51]; // C5..E6
const activeStops = new Set<() => void>();
const lastPlayedAt = new Map<string, number>();

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let hopStepIndex = 0;
let suppressCardSound = false;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const effectiveGain = () => (soundMuted.get() || document.hidden ? 0 : soundVolume.get() ** 2);

function makeNoiseBuffer(audioCtx: BaseAudioContext) {
  const len = Math.max(1, Math.floor(audioCtx.sampleRate));
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  // Deterministic PRNG keeps offline auditioning reproducible while sounding identical to white noise.
  let seed = 0x12345678;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 0xffffffff) * 2 - 1;
  }
  return buf;
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.gain.value = effectiveGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 12;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.12;
  masterGain.connect(comp);
  comp.connect(ctx.destination);
  noiseBuf = makeNoiseBuffer(ctx);
  return ctx;
}

function syncMasterGain() {
  if (!ctx || !masterGain) return;
  masterGain.gain.setTargetAtTime(effectiveGain(), ctx.currentTime, 0.015);
}

function unlock() {
  const c = ensureContext();
  if (c && c.state === 'suspended') void c.resume().catch(() => {});
  syncMasterGain();
}

function gated(bypassPause = false) {
  return soundMuted.get() || soundVolume.get() <= 0 || document.hidden || (!bypassPause && loop.paused) || navigator.webdriver;
}

function cooled(key: string, minGapMs: number) {
  const now = performance.now();
  const prev = lastPlayedAt.get(key) ?? -Infinity;
  if (now - prev < minGapMs) return false;
  lastPlayedAt.set(key, now);
  return true;
}

function panOf(at?: THREE.Vector3 | number): number {
  if (at === undefined || !renderer) return 0;
  const pos = typeof at === 'number' ? POS[at] : at;
  if (!pos) return 0;
  const [fx] = toScreen(pos);
  return Number.isFinite(fx) ? clamp((fx - 0.5) * 1.1, -0.55, 0.55) : 0;
}

function liveGraph(pan = 0, bypassPause = false): Graph | null {
  if (gated(bypassPause)) return null;
  const c = ensureContext();
  if (!c || !masterGain || !noiseBuf || c.state !== 'running') return null;
  let out: AudioNode = masterGain;
  if (pan && typeof c.createStereoPanner === 'function') {
    const panner = c.createStereoPanner();
    panner.pan.value = clamp(pan, -0.6, 0.6);
    panner.connect(masterGain);
    out = panner;
  }
  return {
    ctx: c,
    out,
    noise: noiseBuf,
    scale: 1 / Math.sqrt(Math.max(1, pace.speed)),
    now: c.currentTime,
    track: (stop) => activeStops.add(stop),
  };
}

export function stopActiveSounds() {
  for (const stop of [...activeStops]) {
    activeStops.delete(stop);
    try { stop(); } catch { /* already stopped */ }
  }
  hopStepIndex = 0;
}

export function resetHopChain() {
  hopStepIndex = 0;
}

// ---- Synthesis primitives ----
interface ToneOpts {
  type?: OscillatorType;
  freq: number;
  freqEnd?: number;
  delay?: number;
  dur: number;
  gain: number;
  attack?: number;
  filterFreq?: number;
  filterQ?: number;
}

function tone(g: Graph, o: ToneOpts) {
  const t0 = g.now + (o.delay ?? 0) * g.scale;
  const dur = Math.max(0.012, o.dur * g.scale);
  const atk = Math.min(dur * 0.35, o.attack ?? 0.004);
  const osc = g.ctx.createOscillator();
  const env = g.ctx.createGain();
  osc.type = o.type ?? 'triangle';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t0 + dur);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(o.gain, t0 + atk);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  let tail: AudioNode = osc;
  if (o.filterFreq) {
    const flt = g.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(o.filterFreq, t0);
    if (o.filterQ) flt.Q.value = o.filterQ;
    osc.connect(flt);
    tail = flt;
  }
  tail.connect(env);
  env.connect(g.out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.015);
  return osc;
}

interface NoiseOpts {
  filterType: BiquadFilterType;
  freq: number;
  freqEnd?: number;
  q?: number;
  delay?: number;
  dur: number;
  gain: number;
  attack?: number;
}

function noise(g: Graph, o: NoiseOpts) {
  const t0 = g.now + (o.delay ?? 0) * g.scale;
  const dur = Math.max(0.006, o.dur * g.scale);
  const atk = Math.min(dur * 0.35, o.attack ?? 0.002);
  const src = g.ctx.createBufferSource();
  src.buffer = g.noise;
  src.loop = true;
  const flt = g.ctx.createBiquadFilter();
  flt.type = o.filterType;
  flt.frequency.setValueAtTime(o.freq, t0);
  if (o.freqEnd !== undefined) flt.frequency.exponentialRampToValueAtTime(Math.max(40, o.freqEnd), t0 + dur);
  if (o.q !== undefined) flt.Q.value = o.q;
  const env = g.ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(o.gain, t0 + atk);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(flt);
  flt.connect(env);
  env.connect(g.out);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.015);
  return src;
}

function trackStop(g: Graph, nodes: AudioScheduledSourceNode[], endDelaySec: number) {
  if (!g.track) return;
  const stop = () => { for (const n of nodes) { try { n.stop(); } catch { /* already ended */ } } };
  g.track(stop);
  setTimeout(() => activeStops.delete(stop), Math.ceil(endDelaySec * g.scale * 1000) + 120);
}

// ---- Sound recipes ----
function synthUiClick(g: Graph) {
  noise(g, { filterType: 'highpass', freq: 2400, dur: 0.01, gain: 0.24, attack: 0.001 });
  tone(g, { type: 'triangle', freq: 500, freqEnd: 290, dur: 0.044, gain: 0.34, attack: 0.002 });
}

function synthUiPrimary(g: Graph) {
  noise(g, { filterType: 'highpass', freq: 2800, dur: 0.008, gain: 0.14, attack: 0.001 });
  tone(g, { type: 'triangle', freq: 523.25, dur: 0.06, gain: 0.24, attack: 0.003 });
  tone(g, { type: 'sine', freq: 523.25, dur: 0.065, gain: 0.18, attack: 0.003 });
  tone(g, { type: 'triangle', freq: 698.46, delay: 0.036, dur: 0.095, gain: 0.27, attack: 0.003 });
  tone(g, { type: 'sine', freq: 1396.91, delay: 0.036, dur: 0.075, gain: 0.08, attack: 0.003 });
}

function synthUiDanger(g: Graph) {
  tone(g, { type: 'triangle', freq: 311.13, dur: 0.06, gain: 0.27, attack: 0.003, filterFreq: 1150 });
  tone(g, { type: 'triangle', freq: 293.66, delay: 0.038, dur: 0.095, gain: 0.3, attack: 0.003, filterFreq: 950 });
}

function synthUiStep(g: Graph, up: boolean) {
  const f = up ? 660 : 480;
  noise(g, { filterType: 'bandpass', freq: up ? 2300 : 1650, q: 2.2, dur: 0.012, gain: 0.2, attack: 0.001 });
  tone(g, { type: 'triangle', freq: f, freqEnd: f * (up ? 1.06 : 0.92), dur: 0.038, gain: 0.3, attack: 0.002 });
}

function synthTileHover(g: Graph) {
  tone(g, { type: 'sine', freq: 880, freqEnd: 920, dur: 0.022, gain: 0.11, attack: 0.003 });
}

function synthTileSelect(g: Graph) {
  tone(g, { type: 'sine', freq: 580, freqEnd: 780, dur: 0.052, gain: 0.28, attack: 0.003 });
  tone(g, { type: 'triangle', freq: 1160, dur: 0.036, gain: 0.1, attack: 0.002 });
}

function synthCardOpen(g: Graph) {
  noise(g, { filterType: 'bandpass', freq: 950, freqEnd: 2700, q: 1.3, dur: 0.075, gain: 0.18, attack: 0.006 });
  tone(g, { type: 'sine', freq: 440, freqEnd: 587.33, dur: 0.08, gain: 0.2, attack: 0.006 });
}

function synthCardClose(g: Graph) {
  noise(g, { filterType: 'lowpass', freq: 1700, freqEnd: 420, dur: 0.06, gain: 0.17, attack: 0.003 });
  tone(g, { type: 'triangle', freq: 460, freqEnd: 300, dur: 0.065, gain: 0.2, attack: 0.003, filterFreq: 1300 });
}

function synthVolumePreview(g: Graph) {
  tone(g, { type: 'sine', freq: 783.99, dur: 0.09, gain: 0.34, attack: 0.003 });
  tone(g, { type: 'triangle', freq: 1567.98, dur: 0.045, gain: 0.11, attack: 0.002 });
}

function synthDiceBounce(g: Graph, bounceIndex: number, jitter = 1) {
  const weights = [1, 0.65, 0.4];
  const w = weights[clamp(bounceIndex, 0, 2)];
  const center = (2400 + bounceIndex * 360) * jitter;
  // Twin-die micro-stagger for authentic tabletop wooden clack
  noise(g, { filterType: 'bandpass', freq: center, q: 2.0, dur: 0.024, gain: 0.38 * w, attack: 0.001 });
  tone(g, { type: 'triangle', freq: 520 * jitter, freqEnd: 230 * jitter, dur: 0.036, gain: 0.3 * w, attack: 0.001, filterFreq: 1600 });
  noise(g, { filterType: 'bandpass', freq: center * 1.12, q: 2.2, delay: 0.018, dur: 0.02, gain: 0.24 * w, attack: 0.001 });
  tone(g, { type: 'triangle', freq: 460 * jitter, freqEnd: 210 * jitter, delay: 0.018, dur: 0.03, gain: 0.18 * w, attack: 0.001, filterFreq: 1400 });
}

function synthDiceDoubles(g: Graph) {
  tone(g, { type: 'sine', freq: 783.99, dur: 0.17, gain: 0.24, attack: 0.004 });
  tone(g, { type: 'triangle', freq: 1174.66, delay: 0.045, dur: 0.21, gain: 0.22, attack: 0.004 });
  tone(g, { type: 'sine', freq: 1567.98, delay: 0.08, dur: 0.24, gain: 0.12, attack: 0.005 });
}

function synthTokenHop(g: Graph, step: number) {
  const note = PENTATONIC[step % PENTATONIC.length];
  // Takeoff soft chirp + landing soft wooden pop
  tone(g, { type: 'sine', freq: note * 0.72, freqEnd: note * 0.92, dur: 0.048, gain: 0.13, attack: 0.004 });
  tone(g, { type: 'triangle', freq: note, freqEnd: note * 0.96, delay: 0.075, dur: 0.08, gain: 0.2, attack: 0.003, filterFreq: 1900 });
  tone(g, { type: 'sine', freq: 185, freqEnd: 110, delay: 0.075, dur: 0.048, gain: 0.18, attack: 0.002 });
}

function synthTokenTeleport(g: Graph, phase: 'out' | 'in') {
  if (phase === 'out') {
    noise(g, { filterType: 'bandpass', freq: 800, freqEnd: 3200, q: 2.2, dur: 0.2, gain: 0.16, attack: 0.01 });
    tone(g, { type: 'sine', freq: 360, freqEnd: 1180, dur: 0.21, gain: 0.2, attack: 0.008 });
  } else {
    noise(g, { filterType: 'bandpass', freq: 2600, freqEnd: 650, q: 2.0, dur: 0.18, gain: 0.15, attack: 0.006 });
    tone(g, { type: 'sine', freq: 1080, freqEnd: 523.25, dur: 0.19, gain: 0.22, attack: 0.005 });
    tone(g, { type: 'triangle', freq: 783.99, delay: 0.09, dur: 0.16, gain: 0.12, attack: 0.005 });
  }
}

function synthLotBuy(g: Graph) {
  // Flag-plant thud + C5 -> E5 chime
  noise(g, { filterType: 'lowpass', freq: 1100, dur: 0.032, gain: 0.22, attack: 0.001 });
  tone(g, { type: 'triangle', freq: 200, freqEnd: 95, dur: 0.055, gain: 0.28, attack: 0.002 });
  tone(g, { type: 'triangle', freq: 523.25, delay: 0.03, dur: 0.12, gain: 0.23, attack: 0.003 });
  tone(g, { type: 'sine', freq: 659.25, delay: 0.095, dur: 0.19, gain: 0.26, attack: 0.004 });
}

function synthLotUpgrade(g: Graph, level: number) {
  const lv = clamp(level, 1, 3);
  const notes = lv === 1 ? [523.25, 659.25] : lv === 2 ? [523.25, 659.25, 783.99] : [523.25, 659.25, 783.99, 1046.5];
  noise(g, { filterType: 'bandpass', freq: 1900, q: 1.8, dur: 0.025, gain: 0.22, attack: 0.001 });
  tone(g, { type: 'triangle', freq: 250, freqEnd: 120, dur: 0.042, gain: 0.22, attack: 0.002 });
  notes.forEach((f, idx) => {
    const d = 0.025 + idx * 0.06;
    tone(g, { type: 'triangle', freq: f, delay: d, dur: 0.14 + idx * 0.02, gain: 0.22, attack: 0.003 });
    tone(g, { type: 'sine', freq: f * 2, delay: d, dur: 0.095, gain: 0.065, attack: 0.003 });
  });
  if (lv >= 3) {
    tone(g, { type: 'sine', freq: 1567.98, delay: 0.24, dur: 0.28, gain: 0.14, attack: 0.006 });
    tone(g, { type: 'sine', freq: 2093, delay: 0.27, dur: 0.26, gain: 0.1, attack: 0.006 });
  }
}

function synthLotMortgage(g: Graph, mortgaged: boolean) {
  if (mortgaged) {
    // Metallic latch click + heavy bolt lock
    noise(g, { filterType: 'bandpass', freq: 2600, q: 2.8, dur: 0.016, gain: 0.26, attack: 0.001 });
    noise(g, { filterType: 'bandpass', freq: 1350, q: 2.5, delay: 0.04, dur: 0.03, gain: 0.24, attack: 0.001 });
    tone(g, { type: 'triangle', freq: 340, freqEnd: 170, dur: 0.08, gain: 0.24, attack: 0.002, filterFreq: 1100 });
    tone(g, { type: 'triangle', freq: 220, freqEnd: 140, delay: 0.055, dur: 0.095, gain: 0.24, attack: 0.002, filterFreq: 850 });
  } else {
    noise(g, { filterType: 'highpass', freq: 2400, dur: 0.02, gain: 0.18, attack: 0.001 });
    tone(g, { type: 'triangle', freq: 440, delay: 0.012, dur: 0.075, gain: 0.22, attack: 0.002 });
    tone(g, { type: 'sine', freq: 659.25, delay: 0.062, dur: 0.15, gain: 0.24, attack: 0.003 });
  }
}

function synthCashGain(g: Graph, amount: number) {
  const big = amount >= 3000;
  // "Ka-": mechanical register key clack + metallic drawer latch slide
  noise(g, { filterType: 'bandpass', freq: 3100, q: 2.2, dur: 0.016, gain: 0.22, attack: 0.001 });
  tone(g, { type: 'triangle', freq: 1400, freqEnd: 740, dur: 0.022, gain: 0.14, attack: 0.001 });
  noise(g, { filterType: 'bandpass', freq: 2000, freqEnd: 3100, q: 1.7, delay: 0.016, dur: 0.045, gain: 0.15, attack: 0.003 });

  // "-Ching!": bright brass cash-register bell (fundamental + bell partials)
  const bell = (baseFreq: number, delay: number, ringDur: number, gainScale: number) => {
    noise(g, { filterType: 'highpass', freq: 3800, delay, dur: 0.01, gain: 0.13 * gainScale, attack: 0.001 });
    tone(g, { type: 'sine', freq: baseFreq, delay, dur: ringDur, gain: 0.175 * gainScale, attack: 0.002 });
    tone(g, { type: 'sine', freq: baseFreq * 2.0, delay, dur: ringDur * 0.72, gain: 0.088 * gainScale, attack: 0.002 });
    tone(g, { type: 'sine', freq: baseFreq * 2.756, delay, dur: ringDur * 0.55, gain: 0.06 * gainScale, attack: 0.002 });
    tone(g, { type: 'triangle', freq: baseFreq * 3.9, delay, dur: ringDur * 0.3, gain: 0.028 * gainScale, attack: 0.001 });
  };

  bell(1318.51, 0.072, big ? 0.42 : 0.32, 1.0); // E6 brass register bell
  if (big) {
    bell(1567.98, 0.138, 0.44, 0.85); // G6 second ring for large payouts
  }
}

function synthCashLoss(g: Graph) {
  // Mechanical register key press + heavy drawer-shut clunk (no celebratory bell)
  noise(g, { filterType: 'bandpass', freq: 2200, q: 2.2, dur: 0.014, gain: 0.2, attack: 0.001 });
  tone(g, { type: 'triangle', freq: 620, freqEnd: 340, dur: 0.025, gain: 0.14, attack: 0.001, filterFreq: 1600 });
  noise(g, { filterType: 'lowpass', freq: 950, freqEnd: 260, delay: 0.042, dur: 0.085, gain: 0.24, attack: 0.002 });
  tone(g, { type: 'triangle', freq: 270, freqEnd: 135, delay: 0.042, dur: 0.12, gain: 0.26, attack: 0.002, filterFreq: 850 });
  tone(g, { type: 'sine', freq: 185, freqEnd: 110, delay: 0.055, dur: 0.14, gain: 0.18, attack: 0.003 });
}

function synthCashTick(g: Graph) {
  // Crisp miniature mechanical counter-wheel tick
  noise(g, { filterType: 'bandpass', freq: 2900, q: 2.5, dur: 0.008, gain: 0.09, attack: 0.001 });
  tone(g, { type: 'triangle', freq: 1320, freqEnd: 1080, dur: 0.014, gain: 0.075, attack: 0.001 });
}

function synthTurnMine(g: Graph) {
  tone(g, { type: 'sine', freq: 349.23, dur: 0.14, gain: 0.2, attack: 0.004 });
  tone(g, { type: 'triangle', freq: 698.46, dur: 0.09, gain: 0.065, attack: 0.004 });
  tone(g, { type: 'sine', freq: 523.25, delay: 0.095, dur: 0.25, gain: 0.24, attack: 0.004 });
  tone(g, { type: 'triangle', freq: 1046.5, delay: 0.095, dur: 0.16, gain: 0.075, attack: 0.004 });
}

function synthClockWarn(g: Graph, secondsLeft: number) {
  const urgent = secondsLeft <= 3;
  const f = urgent ? 1046.5 : 783.99;
  noise(g, { filterType: 'bandpass', freq: urgent ? 2600 : 1950, q: 3.0, dur: 0.016, gain: urgent ? 0.26 : 0.18, attack: 0.001 });
  tone(g, { type: 'triangle', freq: f, freqEnd: f * 0.92, dur: 0.05, gain: urgent ? 0.34 : 0.24, attack: 0.002, filterFreq: 2600 });
}

function synthStrikeImpact(g: Graph) {
  // Punchy sub-bass drop + layered debris crackle
  const nodes: AudioScheduledSourceNode[] = [];
  nodes.push(tone(g, { type: 'sine', freq: 72, freqEnd: 30, dur: 0.52, gain: 0.58, attack: 0.003 }));
  nodes.push(tone(g, { type: 'triangle', freq: 125, freqEnd: 42, dur: 0.34, gain: 0.36, attack: 0.003, filterFreq: 480 }));
  nodes.push(noise(g, { filterType: 'lowpass', freq: 1900, freqEnd: 200, dur: 0.65, gain: 0.44, attack: 0.002 }));
  nodes.push(noise(g, { filterType: 'bandpass', freq: 2500, freqEnd: 650, q: 1.1, delay: 0.015, dur: 0.4, gain: 0.28, attack: 0.004 }));
  trackStop(g, nodes, 0.7);
}

function synthOrderTick(g: Graph, settled: boolean) {
  if (settled) {
    tone(g, { type: 'triangle', freq: 783.99, dur: 0.095, gain: 0.24, attack: 0.003 });
    tone(g, { type: 'sine', freq: 1046.5, delay: 0.035, dur: 0.13, gain: 0.2, attack: 0.003 });
  } else {
    tone(g, { type: 'triangle', freq: 620 + Math.random() * 140, dur: 0.028, gain: 0.18, attack: 0.002 });
  }
}

function synthOrderReady(g: Graph) {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const nodes: AudioScheduledSourceNode[] = [];
  notes.forEach((f, i) => {
    const d = i * 0.075;
    nodes.push(tone(g, { type: 'triangle', freq: f, delay: d, dur: i === 3 ? 0.34 : 0.14, gain: 0.22, attack: 0.004 }));
    nodes.push(tone(g, { type: 'sine', freq: f * 1.5, delay: d, dur: i === 3 ? 0.26 : 0.09, gain: 0.07, attack: 0.004 }));
  });
  trackStop(g, nodes, 0.62);
}

function synthNewsSpin(g: Graph) {
  const nodes: AudioScheduledSourceNode[] = [];
  nodes.push(noise(g, { filterType: 'bandpass', freq: 650, freqEnd: 2500, q: 1.5, dur: 0.46, gain: 0.2, attack: 0.04 }));
  nodes.push(tone(g, { type: 'sine', freq: 260, freqEnd: 520, dur: 0.42, gain: 0.1, attack: 0.04 }));
  // Paper slap landing at ~0.48s
  nodes.push(noise(g, { filterType: 'bandpass', freq: 1450, q: 1.1, delay: 0.48, dur: 0.075, gain: 0.32, attack: 0.002 }));
  nodes.push(tone(g, { type: 'triangle', freq: 220, freqEnd: 115, delay: 0.48, dur: 0.07, gain: 0.26, attack: 0.002 }));
  trackStop(g, nodes, 0.62);
}

function synthCasinoTick(g: Graph) {
  const f = PENTATONIC[Math.floor(Math.random() * 5)] * 1.5;
  tone(g, { type: 'triangle', freq: f, dur: 0.034, gain: 0.2, attack: 0.002, filterFreq: 2800 });
}

function synthCasinoResult(g: Graph, outcome: 'miss' | 'hit' | 'jackpot' | 'jail') {
  const nodes: AudioScheduledSourceNode[] = [];
  if (outcome === 'jackpot') {
    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    arp.forEach((f, i) => {
      nodes.push(tone(g, { type: 'triangle', freq: f, delay: i * 0.06, dur: i === arp.length - 1 ? 0.36 : 0.15, gain: 0.22, attack: 0.003 }));
      nodes.push(tone(g, { type: 'sine', freq: f * 2, delay: i * 0.06, dur: 0.12, gain: 0.07, attack: 0.003 }));
    });
    trackStop(g, nodes, 0.72);
  } else if (outcome === 'hit') {
    nodes.push(tone(g, { type: 'triangle', freq: 587.33, dur: 0.11, gain: 0.22, attack: 0.003 }));
    nodes.push(tone(g, { type: 'sine', freq: 880, delay: 0.075, dur: 0.2, gain: 0.25, attack: 0.004 }));
    trackStop(g, nodes, 0.32);
  } else if (outcome === 'jail') {
    synthJailClang(g);
  } else {
    nodes.push(tone(g, { type: 'triangle', freq: 392, freqEnd: 293.66, dur: 0.14, gain: 0.22, attack: 0.003, filterFreq: 1200 }));
    nodes.push(tone(g, { type: 'triangle', freq: 293.66, freqEnd: 246.94, delay: 0.09, dur: 0.18, gain: 0.2, attack: 0.003, filterFreq: 900 }));
    trackStop(g, nodes, 0.32);
  }
}

function synthJailClang(g: Graph) {
  // Heavy iron cage slam: sharp metallic impact + inharmonic bar cluster
  const freqs = [285, 431, 672, 1045, 1520, 2180];
  const nodes: AudioScheduledSourceNode[] = [];
  nodes.push(noise(g, { filterType: 'bandpass', freq: 2300, q: 1.6, dur: 0.065, gain: 0.36, attack: 0.001 }));
  nodes.push(tone(g, { type: 'triangle', freq: 165, freqEnd: 82, dur: 0.09, gain: 0.32, attack: 0.002 }));
  freqs.forEach((f, i) => {
    nodes.push(tone(g, { type: i % 2 ? 'sine' : 'triangle', freq: f, freqEnd: f * 0.988, dur: 0.4 - i * 0.045, gain: 0.17 - i * 0.02, attack: 0.002 }));
  });
  trackStop(g, nodes, 0.45);
}

function synthBankruptOut(g: Graph) {
  // Diminished downward glide
  const nodes: AudioScheduledSourceNode[] = [];
  const chord = [392, 311.13, 277.18, 220];
  chord.forEach((f, i) => {
    nodes.push(tone(g, { type: 'triangle', freq: f, freqEnd: f * 0.78, delay: i * 0.09, dur: 0.36, gain: 0.18, attack: 0.006, filterFreq: 1100 }));
  });
  nodes.push(tone(g, { type: 'sine', freq: 110, freqEnd: 65, delay: 0.12, dur: 0.55, gain: 0.24, attack: 0.01 }));
  trackStop(g, nodes, 0.72);
}

function synthGameOver(g: Graph, won: boolean) {
  const nodes: AudioScheduledSourceNode[] = [];
  if (won) {
    // Bright major pentatonic victory fanfare (~1.1s)
    const seq: [number, number, number][] = [
      [523.25, 0, 0.14], [659.25, 0.11, 0.14], [783.99, 0.22, 0.14], [1046.5, 0.34, 0.22],
      [880, 0.52, 0.15], [1046.5, 0.66, 0.48],
    ];
    for (const [f, d, dur] of seq) {
      nodes.push(tone(g, { type: 'triangle', freq: f, delay: d, dur, gain: 0.15, attack: 0.005 }));
      nodes.push(tone(g, { type: 'sine', freq: f * 0.5, delay: d, dur, gain: 0.085, attack: 0.005 }));
    }
    for (const f of [523.25, 659.25, 783.99]) {
      nodes.push(tone(g, { type: 'sine', freq: f, delay: 0.66, dur: 0.52, gain: 0.075, attack: 0.015 }));
    }
    trackStop(g, nodes, 1.25);
  } else {
    // Calm Cmaj7 resolution
    const chord = [261.63, 329.63, 392, 493.88, 523.25];
    chord.forEach((f, i) => {
      nodes.push(tone(g, { type: 'sine', freq: f, delay: i * 0.06, dur: 0.65, gain: 0.14, attack: 0.015 }));
    });
    trackStop(g, nodes, 1.0);
  }
}

// ---- Public trigger API ----
export function playUiClick() {
  if (!cooled('uiClick', 30)) return;
  const g = liveGraph(0, true);
  if (g) synthUiClick(g);
}

export function playUiPrimary() {
  if (!cooled('uiPrimary', 40)) return;
  const g = liveGraph(0, true);
  if (g) synthUiPrimary(g);
}

export function playUiDanger() {
  if (!cooled('uiDanger', 40)) return;
  const g = liveGraph(0, true);
  if (g) synthUiDanger(g);
}

export function playUiStep(up: boolean) {
  if (!cooled('uiStep', 28)) return;
  const g = liveGraph(0, true);
  if (g) synthUiStep(g, up);
}

export function playTileHover(tile?: number) {
  if (!cooled('tileHover', 45)) return;
  const g = liveGraph(panOf(tile));
  if (g) synthTileHover(g);
}

export function playTileSelect(tile?: number) {
  if (!cooled('tileSelect', 40)) return;
  const g = liveGraph(panOf(tile), true);
  if (g) synthTileSelect(g);
}

export function playCardOpen() {
  if (!cooled('cardOpen', 50)) return;
  const g = liveGraph(0, true);
  if (g) synthCardOpen(g);
}

export function playCardClose() {
  if (!cooled('cardClose', 50)) return;
  const g = liveGraph(0, true);
  if (g) synthCardClose(g);
}

export function playVolumePreview() {
  unlock();
  if (!cooled('volumePreview', 90)) return;
  const g = liveGraph(0, true);
  if (g) synthVolumePreview(g);
}

export function playDiceBounce(bounceIndex: number, at?: THREE.Vector3) {
  if (!cooled(`diceBounce:${bounceIndex}`, 30)) return;
  const g = liveGraph(panOf(at));
  if (g) synthDiceBounce(g, bounceIndex, 0.94 + Math.random() * 0.12);
}

export function playDiceDoubles(at?: THREE.Vector3) {
  const g = liveGraph(panOf(at));
  if (g) synthDiceDoubles(g);
}

export function playTokenHop(at?: THREE.Vector3) {
  const g = liveGraph(panOf(at));
  if (g) synthTokenHop(g, hopStepIndex++);
}

export function playTokenTeleport(phase: 'out' | 'in', at?: THREE.Vector3) {
  const g = liveGraph(panOf(at));
  if (g) synthTokenTeleport(g, phase);
}

export function playLotBuy(tile?: number) {
  const g = liveGraph(panOf(tile));
  if (g) synthLotBuy(g);
}

export function playLotUpgrade(level: number, tile?: number) {
  const g = liveGraph(panOf(tile));
  if (g) synthLotUpgrade(g, level);
}

export function playLotMortgage(mortgaged: boolean, tile?: number) {
  const g = liveGraph(panOf(tile));
  if (g) synthLotMortgage(g, mortgaged);
}

export function playCash(delta: number, at?: THREE.Vector3) {
  if (!delta || !cooled('cashEvent', 40)) return;
  const g = liveGraph(panOf(at));
  if (!g) return;
  if (delta > 0) synthCashGain(g, delta);
  else synthCashLoss(g);
}

export function playCashTick() {
  if (!cooled('cashTick', 55)) return;
  const g = liveGraph();
  if (g) synthCashTick(g);
}

export function playTurnMine() {
  const g = liveGraph(0, true);
  if (g) synthTurnMine(g);
}

export function playClockWarn(secondsLeft: number) {
  if (!cooled('clockWarn', 500)) return;
  const g = liveGraph(0, true);
  if (g) synthClockWarn(g, secondsLeft);
}

export interface StrikeFlightAudio {
  update(pos: THREE.Vector3, ignition: number, dive: number): void;
  stop(): void;
}

export function startStrikeFlight(at: THREE.Vector3): StrikeFlightAudio {
  const noop: StrikeFlightAudio = { update() {}, stop() {} };
  const g = liveGraph(0);
  if (!g) return noop;
  const c = g.ctx, t0 = g.now;
  const panner = typeof c.createStereoPanner === 'function' ? c.createStereoPanner() : null;
  if (panner) {
    panner.pan.value = panOf(at);
    panner.connect(g.out);
  }
  const dest = panner ?? g.out;

  // Ignition + flight filtered noise roar
  const roar = c.createBufferSource();
  roar.buffer = g.noise;
  roar.loop = true;
  const roarFlt = c.createBiquadFilter();
  roarFlt.type = 'bandpass';
  roarFlt.frequency.setValueAtTime(320, t0);
  roarFlt.Q.value = 1.2;
  const roarGain = c.createGain();
  roarGain.gain.setValueAtTime(0.0001, t0);
  roarGain.gain.linearRampToValueAtTime(0.16, t0 + 0.14);
  roar.connect(roarFlt);
  roarFlt.connect(roarGain);
  roarGain.connect(dest);

  // Dive whistle oscillator
  const whistle = c.createOscillator();
  whistle.type = 'sine';
  whistle.frequency.setValueAtTime(360, t0);
  const whistleGain = c.createGain();
  whistleGain.gain.setValueAtTime(0.0001, t0);
  whistle.connect(whistleGain);
  whistleGain.connect(dest);

  roar.start(t0);
  whistle.start(t0);

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    activeStops.delete(stop);
    const now = c.currentTime;
    roarGain.gain.cancelScheduledValues(now);
    roarGain.gain.setTargetAtTime(0.0001, now, 0.02);
    whistleGain.gain.cancelScheduledValues(now);
    whistleGain.gain.setTargetAtTime(0.0001, now, 0.02);
    try { roar.stop(now + 0.08); } catch { /* already stopped */ }
    try { whistle.stop(now + 0.08); } catch { /* already stopped */ }
  };
  g.track?.(stop);

  return {
    update(pos, ignition, dive) {
      if (stopped) return;
      const now = c.currentTime;
      if (panner) panner.pan.setTargetAtTime(panOf(pos), now, 0.03);
      roarFlt.frequency.setTargetAtTime(280 + ignition * 550 + dive * 1100, now, 0.04);
      roarGain.gain.setTargetAtTime(0.08 + ignition * 0.1 + dive * 0.08, now, 0.04);
      whistle.frequency.setTargetAtTime(520 + dive * 540 - dive * dive * 380, now, 0.04);
      whistleGain.gain.setTargetAtTime(dive > 0.05 ? 0.09 * dive : 0.0001, now, 0.04);
    },
    stop,
  };
}

export function playStrikeImpact(at?: THREE.Vector3) {
  const g = liveGraph(panOf(at));
  if (g) synthStrikeImpact(g);
}

export function playOrderTick(settled = false) {
  if (!settled && !cooled('orderTick', 35)) return;
  const g = liveGraph();
  if (g) synthOrderTick(g, settled);
}

export function playOrderReady() {
  const g = liveGraph();
  if (g) synthOrderReady(g);
}

export function playNewsSpin() {
  suppressCardSound = true;
  const g = liveGraph(0, true);
  if (g) synthNewsSpin(g);
}

export function playCasinoTick() {
  if (!cooled('casinoTick', 35)) return;
  const g = liveGraph(0, true);
  if (g) synthCasinoTick(g);
}

export function playCasinoResult(outcome: 'miss' | 'hit' | 'jackpot' | 'jail') {
  const g = liveGraph(0, true);
  if (g) synthCasinoResult(g, outcome);
}

export function playJailClang(at?: THREE.Vector3) {
  const g = liveGraph(panOf(at));
  if (g) synthJailClang(g);
}

export function playBankruptOut(at?: THREE.Vector3) {
  const g = liveGraph(panOf(at));
  if (g) synthBankruptOut(g);
}

export function playGameOver(won: boolean) {
  suppressCardSound = true;
  const g = liveGraph(0, true);
  if (g) synthGameOver(g, won);
}

// ---- Audition catalog (for ?dev=1 panel & offline inspection) ----
export const AUDIO_AUDITIONS: [label: string, durSec: number, play: (g: Graph) => void][] = [
  ['CLICK', 0.12, synthUiClick],
  ['PRIMARY', 0.18, synthUiPrimary],
  ['DANGER', 0.18, synthUiDanger],
  ['STEP+', 0.1, (g) => synthUiStep(g, true)],
  ['STEP-', 0.1, (g) => synthUiStep(g, false)],
  ['HOVER', 0.08, synthTileHover],
  ['SELECT', 0.12, synthTileSelect],
  ['CARD+', 0.15, synthCardOpen],
  ['CARD-', 0.15, synthCardClose],
  ['VOL', 0.15, synthVolumePreview],
  ['DICE', 0.45, (g) => {
    synthDiceBounce(g, 0, 1);
    synthDiceBounce({ ...g, now: g.now + 0.16 }, 1, 1.04);
    synthDiceBounce({ ...g, now: g.now + 0.28 }, 2, 0.96);
  }],
  ['DOUBLES', 0.38, synthDiceDoubles],
  ['HOP', 0.24, (g) => synthTokenHop(g, hopStepIndex++ % 5)],
  ['TELE', 0.55, (g) => {
    synthTokenTeleport(g, 'out');
    synthTokenTeleport({ ...g, now: g.now + 0.25 }, 'in');
  }],
  ['BUY', 0.35, synthLotBuy],
  ['UP1', 0.35, (g) => synthLotUpgrade(g, 1)],
  ['UP3', 0.65, (g) => synthLotUpgrade(g, 3)],
  ['MORT', 0.25, (g) => synthLotMortgage(g, true)],
  ['REDEEM', 0.28, (g) => synthLotMortgage(g, false)],
  ['GAIN', 0.62, (g) => synthCashGain(g, 3500)],
  ['LOSS', 0.28, synthCashLoss],
  ['TURN', 0.42, synthTurnMine],
  ['WARN', 0.14, (g) => synthClockWarn(g, 3)],
  ['IMPACT', 0.7, synthStrikeImpact],
  ['NEWS', 0.7, synthNewsSpin],
  ['JACKPOT', 0.8, (g) => synthCasinoResult(g, 'jackpot')],
  ['JAIL', 0.48, synthJailClang],
  ['OUT', 0.8, synthBankruptOut],
  ['WIN', 1.35, (g) => synthGameOver(g, true)],
  ['END', 1.05, (g) => synthGameOver(g, false)],
];

export function auditionSound(label: string) {
  unlock();
  const entry = AUDIO_AUDITIONS.find(([k]) => k === label);
  if (!entry) return;
  const g = liveGraph(0, true);
  if (g) entry[2](g);
}

/** Render a named audition recipe offline via OfflineAudioContext (used for acoustic inspection). */
export async function renderAuditionPcm(label: string, sampleRate = 44100): Promise<Float32Array | null> {
  const entry = AUDIO_AUDITIONS.find(([k]) => k === label);
  if (!entry) return null;
  const frames = Math.ceil(entry[1] * sampleRate);
  const off = new OfflineAudioContext(1, frames, sampleRate);
  const comp = off.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 12;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.12;
  comp.connect(off.destination);
  const g: Graph = { ctx: off, out: comp, noise: makeNoiseBuffer(off), scale: 1, now: 0.01 };
  entry[2](g);
  const rendered = await off.startRendering();
  return rendered.getChannelData(0);
}

// ---- Initialization & global DOM delegation ----
export function initAudio() {
  const off = new AbortController();
  const onGesture = () => unlock();
  window.addEventListener('pointerdown', onGesture, { capture: true, signal: off.signal });
  window.addEventListener('keydown', onGesture, { capture: true, signal: off.signal });

  // Global DOM UI click delegation (capture phase reads state before React mutates classes/DOM)
  document.addEventListener('click', (e) => {
    const target = e.target as Element | null;
    if (!target) return;
    const el = target.closest('button, .item');
    if (!el || el.hasAttribute('disabled') || el.getAttribute('data-audio') === 'none' || el.id === 'btn-sound') return;
    if (el.closest('.stepper') && el.classList.contains('btn')) {
      const up = el.textContent?.includes('MAX') || el.textContent?.includes('ALL IN') || !!el.querySelector('svg') && el === el.closest('.stepper')?.querySelectorAll('.btn')[1];
      playUiStep(up);
      return;
    }
    if (el.classList.contains('item')) {
      playUiStep(!el.classList.contains('sel'));
      return;
    }
    if (el.classList.contains('danger')) { playUiDanger(); return; }
    if (el.classList.contains('primary')) { playUiPrimary(); return; }
    if (el.classList.contains('btn') || el.closest('.tabs, .seg')) playUiClick();
  }, { capture: true, signal: off.signal });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopActiveSounds();
    syncMasterGain();
  }, { signal: off.signal });

  const unsubVol = soundVolume.sub(syncMasterGain);
  const unsubMute = soundMuted.sub(syncMasterGain);

  let prevCards = cards.get().length;
  const unsubCards = cards.sub(() => {
    const next = cards.get().length;
    if (next > prevCards) {
      if (suppressCardSound) suppressCardSound = false;
      else playCardOpen();
    } else if (next < prevCards) {
      if (suppressCardSound) suppressCardSound = false;
      else playCardClose();
    }
    prevCards = next;
  });

  return () => {
    off.abort();
    unsubVol();
    unsubMute();
    unsubCards();
    stopActiveSounds();
    if (ctx) {
      const closing = ctx;
      ctx = null;
      masterGain = null;
      noiseBuf = null;
      void closing.close().catch(() => {});
    }
  };
}
