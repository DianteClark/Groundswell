// Groundswell audio engine — procedural WebAudio: buses, reverb, positional SFX, generative music. No assets.
let ctx = null, out = null, sfxBus = null, musicBus = null, verbIn = null, unlocked = false, noiseBuf = null;
let sfxVol = 0.6, musVol = 0.4;
const last = {};

function makeIR(c, secs = 2.4, decay = 2.6) {
  const len = Math.floor(c.sampleRate * secs); const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return ir;
}
function ensure() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    out = ctx.createGain(); out.gain.value = 0.9; out.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(out);
    musicBus = ctx.createGain(); musicBus.gain.value = musVol; musicBus.connect(out);
    const verb = ctx.createConvolver(); verb.buffer = makeIR(ctx); verbIn = ctx.createGain(); verbIn.gain.value = 0.35; verbIn.connect(verb); verb.connect(out);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; }
  return ctx;
}
export function unlockAudio() {
  const c = ensure(); if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  if (!unlocked) { unlocked = true; Music.start(); }
}
if (typeof window !== 'undefined') {
  const u = () => { unlockAudio(); };
  window.addEventListener('pointerdown', u, true); window.addEventListener('keydown', u, true); window.addEventListener('touchend', u, true);
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend?.(); else if (unlocked) ctx.resume?.(); });
}
export function setVolume(v) { sfxVol = Math.max(0, Math.min(1, v)); if (sfxBus) sfxBus.gain.value = sfxVol; }
export function setMusicVolume(v) { musVol = Math.max(0, Math.min(1, v)) * 0.8; if (musicBus) musicBus.gain.setTargetAtTime(musVol, ctx.currentTime, 0.2); }

// ---------- voices
function dest(bus, pan, wet) {
  let node = bus;
  if (pan) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(bus); node = p; }
  if (wet) { const s = ctx.createGain(); s.gain.value = wet; s.connect(verbIn); return [node, s]; }
  return [node];
}
function tone({ type = 'sine', f = 440, f2 = null, t = 0.15, a = 0.005, g = 0.3, delay = 0, lp = null, lp2 = null, Q = 0.7, pan = 0, wet = 0, bus = null, detune = 0, curve = 'exp' }) {
  const c = ctx; const t0 = c.currentTime + delay;
  const o = c.createOscillator(); const gn = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); if (detune) o.detune.value = detune;
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + t * 0.9);
  gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(g, t0 + a);
  if (curve === 'lin') gn.gain.linearRampToValueAtTime(0.0001, t0 + t); else gn.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  let node = o;
  if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = Q; fl.frequency.setValueAtTime(lp, t0); if (lp2) fl.frequency.exponentialRampToValueAtTime(lp2, t0 + t); o.connect(fl); node = fl; }
  node.connect(gn); for (const d of dest(bus || sfxBus, pan, wet)) gn.connect(d);
  o.start(t0); o.stop(t0 + t + 0.05);
}
function noise({ t = 0.2, g = 0.3, f = 1000, f2 = null, type = 'bandpass', delay = 0, Q = 1, a = 0.002, pan = 0, wet = 0, bus = null }) {
  const c = ctx; const t0 = c.currentTime + delay;
  const src = c.createBufferSource(); src.buffer = noiseBuf; const off = Math.random() * 1.5;
  const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = Q; fl.frequency.setValueAtTime(f, t0); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + t);
  const gn = c.createGain(); gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(g, t0 + a); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  src.connect(fl); fl.connect(gn); for (const d of dest(bus || sfxBus, pan, wet)) gn.connect(d);
  src.start(t0, off, t + 0.05);
}
const ch = (fs, o) => fs.forEach((f, i) => tone({ ...o, f, delay: (o.delay || 0) + i * (o.step || 0) }));

// ---------- SFX library. Each takes (o) = { pan, g (gain scale), heavy }
const S = {
  // UI
  click: () => { tone({ type: 'triangle', f: 1100, f2: 700, t: 0.05, g: 0.12 }); noise({ t: 0.02, g: 0.04, f: 5000, type: 'highpass' }); },
  hover: () => { tone({ type: 'sine', f: 1600, t: 0.025, g: 0.03 }); },
  tab: () => { tone({ type: 'triangle', f: 520, f2: 820, t: 0.08, g: 0.11 }); noise({ t: 0.06, g: 0.03, f: 3000, f2: 7000 }); },
  purchase: () => { ch([988, 1319, 1976], { type: 'triangle', t: 0.22, g: 0.13, step: 0.05, wet: 0.3 }); noise({ t: 0.3, g: 0.05, f: 7000, type: 'highpass' }); tone({ type: 'sine', f: 2637, t: 0.5, g: 0.04, delay: 0.12, wet: 0.5 }); },
  error: () => { tone({ type: 'square', f: 196, f2: 140, t: 0.16, g: 0.07, lp: 900 }); tone({ type: 'square', f: 147, t: 0.16, g: 0.06, lp: 800, delay: 0.09 }); },
  levelup: () => { ch([523, 659, 784, 1047], { type: 'triangle', t: 0.35, g: 0.14, step: 0.07, wet: 0.4 }); ch([1568, 2093], { type: 'sine', t: 0.9, g: 0.05, delay: 0.3, step: 0.05, wet: 0.6 }); noise({ t: 0.7, g: 0.05, f: 2000, f2: 9000, delay: 0.1, wet: 0.4 }); },
  coin: (o = {}) => { tone({ type: 'square', f: 1568, t: 0.05, g: 0.04 * (o.g ?? 1), lp: 4000, pan: o.pan }); tone({ type: 'square', f: 2093, t: 0.14, g: 0.04 * (o.g ?? 1), delay: 0.05, lp: 4000, pan: o.pan, wet: 0.2 }); },
  tick: () => { tone({ type: 'triangle', f: 1900, t: 0.02, g: 0.04 }); },
  reward: () => { ch([784, 988, 1175, 1568], { type: 'sine', t: 0.6, g: 0.11, step: 0.05, wet: 0.5 }); noise({ t: 0.8, g: 0.04, f: 8000, type: 'highpass', wet: 0.5 }); },
  whoosh: (o = {}) => { noise({ t: 0.3, g: 0.11 * (o.g ?? 1), f: 300, f2: 2600, Q: 1.4, pan: o.pan }); },
  victory: () => { ch([392, 523, 659, 784], { type: 'sawtooth', t: 0.45, g: 0.07, step: 0.13, lp: 2400, wet: 0.4 }); ch([523, 659, 784, 1047], { type: 'triangle', t: 2.4, g: 0.08, delay: 0.55, wet: 0.6 }); tone({ type: 'sine', f: 65, t: 2.2, g: 0.18, delay: 0.55 }); noise({ t: 1.6, g: 0.06, f: 6000, type: 'highpass', delay: 0.55, wet: 0.6 }); },
  defeat: () => { ch([392, 349, 311, 262], { type: 'triangle', t: 0.7, g: 0.12, step: 0.2, wet: 0.5 }); tone({ type: 'sawtooth', f: 65, t: 2.4, g: 0.08, delay: 0.8, lp: 400, wet: 0.4 }); },
  // match: generic
  hitLight: (o = {}) => { tone({ type: 'sine', f: 180, f2: 70, t: 0.09, g: 0.2 * (o.g ?? 1), pan: o.pan }); noise({ t: 0.05, g: 0.08 * (o.g ?? 1), f: 2200, type: 'bandpass', Q: 0.8, pan: o.pan }); },
  hitHeavy: (o = {}) => { tone({ type: 'sine', f: 120, f2: 38, t: 0.28, g: 0.34 * (o.g ?? 1), pan: o.pan }); noise({ t: 0.18, g: 0.16 * (o.g ?? 1), f: 900, f2: 250, type: 'lowpass', pan: o.pan, wet: 0.2 }); noise({ t: 0.05, g: 0.1 * (o.g ?? 1), f: 5000, type: 'highpass', pan: o.pan }); },
  slash: (o = {}) => { noise({ t: 0.14, g: 0.12 * (o.g ?? 1), f: 1400, f2: 5200, Q: 2.4, pan: o.pan }); },
  swing: (o = {}) => { noise({ t: 0.2, g: 0.09 * (o.g ?? 1), f: 500, f2: 1800, Q: 1.2, pan: o.pan }); },
  gun: (o = {}) => { noise({ t: 0.12, g: 0.22 * (o.g ?? 1), f: 3200, f2: 700, type: 'lowpass', pan: o.pan, wet: 0.25 }); tone({ type: 'square', f: 220, f2: 60, t: 0.08, g: 0.1 * (o.g ?? 1), lp: 1400, pan: o.pan }); noise({ t: 0.03, g: 0.12 * (o.g ?? 1), f: 7000, type: 'highpass', pan: o.pan }); },
  zap: (o = {}) => { tone({ type: 'sawtooth', f: 1400, f2: 500, t: 0.12, g: 0.06 * (o.g ?? 1), lp: 3200, pan: o.pan }); tone({ type: 'sine', f: 2200, f2: 1600, t: 0.1, g: 0.05 * (o.g ?? 1), pan: o.pan, wet: 0.2 }); },
  chime: (o = {}) => { ch([1319, 1976], { type: 'sine', t: 0.35, g: 0.06 * (o.g ?? 1), step: 0.04, pan: o.pan, wet: 0.5 }); },
  clank: (o = {}) => { tone({ type: 'square', f: 420, f2: 380, t: 0.12, g: 0.07 * (o.g ?? 1), lp: 2500, Q: 6, pan: o.pan }); tone({ type: 'square', f: 633, t: 0.09, g: 0.05 * (o.g ?? 1), lp: 2600, Q: 6, pan: o.pan }); noise({ t: 0.04, g: 0.06 * (o.g ?? 1), f: 4000, pan: o.pan }); },
  bubble: (o = {}) => { tone({ type: 'sine', f: 300, f2: 900, t: 0.12, g: 0.09 * (o.g ?? 1), pan: o.pan }); tone({ type: 'sine', f: 500, f2: 1200, t: 0.1, g: 0.06 * (o.g ?? 1), delay: 0.06, pan: o.pan }); },
  thump: (o = {}) => { tone({ type: 'sine', f: 110, f2: 45, t: 0.2, g: 0.28 * (o.g ?? 1), pan: o.pan }); noise({ t: 0.12, g: 0.1 * (o.g ?? 1), f: 600, type: 'lowpass', pan: o.pan }); },
  bite: (o = {}) => { noise({ t: 0.08, g: 0.12 * (o.g ?? 1), f: 1800, f2: 900, Q: 3, pan: o.pan }); tone({ type: 'sawtooth', f: 160, f2: 90, t: 0.1, g: 0.06 * (o.g ?? 1), lp: 900, pan: o.pan }); },
  fire: (o = {}) => { noise({ t: 0.45, g: 0.16 * (o.g ?? 1), f: 600, f2: 2400, Q: 0.7, pan: o.pan, wet: 0.2 }); tone({ type: 'sawtooth', f: 90, f2: 160, t: 0.4, g: 0.06 * (o.g ?? 1), lp: 700, pan: o.pan }); },
  star: (o = {}) => { ch([1760, 2349, 2637], { type: 'sine', t: 0.5, g: 0.06 * (o.g ?? 1), step: 0.035, pan: o.pan, wet: 0.6 }); noise({ t: 0.35, g: 0.05 * (o.g ?? 1), f: 6000, f2: 10000, pan: o.pan, wet: 0.5 }); },
  shadow: (o = {}) => { noise({ t: 0.35, g: 0.12 * (o.g ?? 1), f: 2600, f2: 400, Q: 1.6, pan: o.pan, wet: 0.3 }); tone({ type: 'sine', f: 220, f2: 110, t: 0.3, g: 0.06 * (o.g ?? 1), pan: o.pan }); },
  mech: (o = {}) => { tone({ type: 'sawtooth', f: 90, f2: 180, t: 0.3, g: 0.08 * (o.g ?? 1), lp: 1200, pan: o.pan }); S.clank(o); },
  sludge: (o = {}) => { noise({ t: 0.4, g: 0.14 * (o.g ?? 1), f: 300, f2: 150, type: 'lowpass', Q: 4, pan: o.pan }); S.bubble(o); },
  roar: (o = {}) => { tone({ type: 'sawtooth', f: 140, f2: 70, t: 0.7, g: 0.14 * (o.g ?? 1), lp: 900, lp2: 300, Q: 2, pan: o.pan, wet: 0.3 }); noise({ t: 0.7, g: 0.12 * (o.g ?? 1), f: 700, f2: 300, Q: 1.5, pan: o.pan, wet: 0.3 }); },
  earth: (o = {}) => { tone({ type: 'sine', f: 70, f2: 35, t: 0.6, g: 0.32 * (o.g ?? 1), pan: o.pan }); noise({ t: 0.5, g: 0.16 * (o.g ?? 1), f: 500, f2: 120, type: 'lowpass', pan: o.pan, wet: 0.35 }); },
  shieldUp: (o = {}) => { tone({ type: 'triangle', f: 440, f2: 880, t: 0.3, g: 0.07 * (o.g ?? 1), pan: o.pan, wet: 0.5 }); },
  heal: (o = {}) => { ch([659, 988, 1319], { type: 'sine', t: 0.4, g: 0.05 * (o.g ?? 1), step: 0.05, pan: o.pan, wet: 0.6 }); },
  blink: (o = {}) => { tone({ type: 'sine', f: 400, f2: 2400, t: 0.18, g: 0.08 * (o.g ?? 1), pan: o.pan, wet: 0.4 }); noise({ t: 0.18, g: 0.06 * (o.g ?? 1), f: 8000, type: 'highpass', pan: o.pan }); },
  ult: (o = {}) => { tone({ type: 'sawtooth', f: 55, f2: 110, t: 0.9, g: 0.12 * (o.g ?? 1), lp: 600, lp2: 2400, pan: o.pan, wet: 0.5 }); noise({ t: 0.9, g: 0.08 * (o.g ?? 1), f: 200, f2: 4000, pan: o.pan, wet: 0.5 }); },
  towerCharge: (o = {}) => { tone({ type: 'sine', f: 300, f2: 900, t: 0.2, g: 0.05 * (o.g ?? 1), pan: o.pan }); },
  towerShot: (o = {}) => { tone({ type: 'sawtooth', f: 900, f2: 120, t: 0.35, g: 0.1 * (o.g ?? 1), lp: 2600, pan: o.pan, wet: 0.35 }); noise({ t: 0.25, g: 0.08 * (o.g ?? 1), f: 3000, f2: 500, pan: o.pan }); },
  crumble: (o = {}) => { S.earth(o); noise({ t: 1.2, g: 0.12 * (o.g ?? 1), f: 1200, f2: 200, type: 'lowpass', delay: 0.1, pan: o.pan, wet: 0.4 }); },
  minionDie: (o = {}) => { tone({ type: 'triangle', f: 500, f2: 180, t: 0.12, g: 0.03 * (o.g ?? 1), pan: o.pan }); },
  heroDie: (o = {}) => { tone({ type: 'sawtooth', f: 330, f2: 70, t: 0.9, g: 0.08 * (o.g ?? 1), lp: 1400, lp2: 300, pan: o.pan, wet: 0.5 }); noise({ t: 0.6, g: 0.06 * (o.g ?? 1), f: 1500, f2: 200, pan: o.pan, wet: 0.4 }); },
  kill: () => { tone({ type: 'sawtooth', f: 220, f2: 440, t: 0.22, g: 0.07, lp: 2000 }); ch([660, 880], { type: 'triangle', t: 0.35, g: 0.09, delay: 0.08, step: 0.07, wet: 0.4 }); S.hitHeavy({ g: 0.6 }); },
  death: () => { tone({ type: 'sawtooth', f: 300, f2: 55, t: 1.1, g: 0.09, lp: 900, wet: 0.5 }); tone({ type: 'sine', f: 82, t: 1.4, g: 0.12 }); },
  objective: () => { tone({ type: 'sawtooth', f: 110, t: 1.2, g: 0.1, lp: 800, wet: 0.5 }); ch([330, 494, 659], { type: 'triangle', t: 1.0, g: 0.07, delay: 0.1, step: 0.15, wet: 0.6 }); S.earth({ g: 0.6 }); },
  wyrmRoar: (o = {}) => { S.roar({ ...o, g: 1.4 }); tone({ type: 'sawtooth', f: 90, f2: 45, t: 1.4, g: 0.12, lp: 600, pan: o.pan, wet: 0.6 }); },
  swell: () => { tone({ type: 'sawtooth', f: 40, f2: 80, t: 3.2, a: 1.2, g: 0.16, lp: 300, lp2: 1200, wet: 0.6, curve: 'lin' }); noise({ t: 3.0, a: 1.0, g: 0.12, f: 120, f2: 900, type: 'lowpass', wet: 0.6 }); tone({ type: 'sine', f: 30, t: 3.4, a: 0.8, g: 0.3 }); },
  recall: (o = {}) => { ch([523, 784, 1047, 1568], { type: 'sine', t: 1.2, g: 0.03 * (o.g ?? 1), step: 0.4, pan: o.pan, wet: 0.7 }); },
  respawn: () => { ch([392, 523, 784], { type: 'triangle', t: 0.6, g: 0.08, step: 0.08, wet: 0.6 }); },
  ping: () => { tone({ type: 'sine', f: 1047, t: 0.2, g: 0.08, wet: 0.4 }); tone({ type: 'sine', f: 1568, t: 0.3, g: 0.06, delay: 0.1, wet: 0.5 }); },
};
export function sfx(name, minGap = 0.04, opts) {
  const c = ensure(); if (!c || !unlocked || sfxVol <= 0) return;
  const tnow = c.currentTime; const k = name + (opts?.key || ''); if (last[k] && tnow - last[k] < minGap) return; last[k] = tnow;
  try { (S[name] || S.click)(opts || {}); } catch (e) { /* ignore */ }
}

// ---------- generative music
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const PROG_MATCH = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 64], [50, 53, 57, 62], [52, 56, 59, 64]]; // Am F C G Am F Dm E
const PROG_MENU = [[57, 60, 64, 71], [53, 57, 60, 64], [48, 52, 55, 62], [52, 55, 59, 64]]; // Am9 Fmaj7 Cadd9 Em
export const Music = {
  mode: 'menu', intensity: 0.15, target: 0.15, step: 0, nextT: 0, timer: null, bpm: 96,
  start() { if (!ctx || this.timer) return; this.nextT = ctx.currentTime + 0.1; this.timer = setInterval(() => this._sched(), 30); },
  setMode(mode) { this.mode = mode; this.bpm = mode === 'menu' ? 84 : 100; this.target = mode === 'menu' ? 0.15 : 0.35; },
  setIntensity(v) { this.target = Math.max(0, Math.min(1, v)); },
  _sched() {
    if (!ctx || ctx.state !== 'running' || musVol <= 0.001) { if (ctx) this.nextT = Math.max(this.nextT, ctx.currentTime + 0.05); return; }
    const sd = 60 / this.bpm / 4; // 16th
    while (this.nextT < ctx.currentTime + 0.15) { this._play(this.step, this.nextT, sd); this.nextT += sd; this.step++; }
    this.intensity += (this.target - this.intensity) * 0.02;
  },
  _play(step, t, sd) {
    const prog = this.mode === 'menu' ? PROG_MENU : PROG_MATCH; const bar = Math.floor(step / 16) % prog.length; const s = step % 16; const chord = prog[bar];
    const I = this.intensity; const d = t - ctx.currentTime;
    const v = (o) => ({ ...o, delay: Math.max(0, d), bus: musicBus });
    if (s === 0) { // pad
      for (const n of chord) { tone(v({ type: 'sawtooth', f: NOTE(n - 12), t: sd * 16 * 1.1, a: 0.6, g: 0.022, lp: 700 + I * 900, Q: 0.8, detune: -7, wet: 0.5, curve: 'lin' })); tone(v({ type: 'sawtooth', f: NOTE(n - 12), t: sd * 16 * 1.1, a: 0.6, g: 0.02, lp: 700 + I * 900, detune: 7, wet: 0.5, curve: 'lin' })); }
      if (this.mode !== 'menu' && I > 0.6) tone(v({ type: 'sawtooth', f: NOTE(chord[0] - 12), t: 0.4, a: 0.01, g: 0.05, lp: 2200, lp2: 500, wet: 0.4 })); // brass stab
    }
    // bass
    const root = NOTE(chord[0] - 24);
    if (s % 8 === 0 || (I > 0.45 && s % 4 === 2) || (I > 0.75 && s % 2 === 1 && s % 4 !== 3)) tone(v({ type: 'triangle', f: root, t: sd * 1.8, a: 0.005, g: 0.09 + I * 0.05, lp: 500 }));
    // arp / pluck
    if (I > 0.22 && (s % 2 === 0 || I > 0.6)) { const pat = [0, 2, 1, 3, 2, 1, 3, 0]; const n = chord[pat[(s >> (I > 0.6 ? 0 : 1)) % 8]] + (s >= 8 ? 12 : 0); tone(v({ type: 'square', f: NOTE(n), t: sd * 1.5, a: 0.003, g: 0.016 + I * 0.012, lp: 1600 + I * 1600, lp2: 600, wet: 0.35 })); }
    // menu bells
    if (this.mode === 'menu' && (s === 6 || s === 14) && Math.random() < 0.55) tone(v({ type: 'sine', f: NOTE(chord[Math.floor(Math.random() * 4)] + 24), t: 1.4, g: 0.018, wet: 0.8 }));
    // drums
    if (I > 0.4) {
      if (s % 8 === 0 || (I > 0.7 && s === 10)) { tone(v({ type: 'sine', f: 120, f2: 40, t: 0.22, g: 0.22 * I })); }
      if (s % 8 === 4) noise(v({ t: 0.16, g: 0.07 * I, f: 1800, Q: 0.6, wet: 0.3 }));
      if (I > 0.55 && s % 2 === 1) noise(v({ t: 0.04, g: 0.025 * I, f: 8000, type: 'highpass' }));
    }
  },
};

export default { sfx, setVolume, setMusicVolume, unlockAudio, Music };
