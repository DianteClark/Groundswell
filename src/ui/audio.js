// Tiny WebAudio synth SFX. No assets. Volume from settings (master * sfx).
let ctx = null, master = null, vol = 0.6, unlocked = false;
const last = {};

function ensure() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try { ctx = new AC(); master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination); } catch (e) { ctx = null; }
  return ctx;
}
export function unlockAudio() {
  if (unlocked) return; const c = ensure(); if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  unlocked = true;
}
if (typeof window !== 'undefined') {
  const u = () => { unlockAudio(); window.removeEventListener('pointerdown', u, true); window.removeEventListener('keydown', u, true); };
  window.addEventListener('pointerdown', u, true); window.addEventListener('keydown', u, true);
}
export function setVolume(v) { vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = vol; }

function tone({ type = 'sine', f = 440, f2 = null, t = 0.15, a = 0.005, g = 0.3, delay = 0, q = null, filter = null }) {
  const c = ctx; const t0 = c.currentTime + delay;
  const o = c.createOscillator(); const gn = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + t);
  gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(g, t0 + a); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  let node = o;
  if (filter) { const fl = c.createBiquadFilter(); fl.type = filter; fl.frequency.value = q || 1200; o.connect(fl); node = fl; }
  node.connect(gn); gn.connect(master); o.start(t0); o.stop(t0 + t + 0.05);
}
function noise({ t = 0.2, g = 0.3, f = 1000, f2 = null, type = 'bandpass', delay = 0, Q = 1 }) {
  const c = ctx; const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * t); const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = Q; fl.frequency.setValueAtTime(f, t0); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + t);
  const gn = c.createGain(); gn.gain.setValueAtTime(g, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  src.connect(fl); fl.connect(gn); gn.connect(master); src.start(t0);
}

const SFX = {
  click: () => { tone({ type: 'triangle', f: 900, f2: 600, t: 0.06, g: 0.15 }); },
  hover: () => { tone({ type: 'sine', f: 1400, t: 0.03, g: 0.04 }); },
  tab: () => { tone({ type: 'triangle', f: 520, f2: 780, t: 0.08, g: 0.12 }); },
  purchase: () => { [880, 1320, 1760].forEach((f, i) => tone({ type: 'triangle', f, t: 0.18, g: 0.16, delay: i * 0.06 })); noise({ t: 0.25, g: 0.05, f: 6000, type: 'highpass' }); },
  error: () => { tone({ type: 'square', f: 180, f2: 120, t: 0.18, g: 0.08, filter: 'lowpass', q: 900 }); },
  levelup: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, t: 0.3, g: 0.16, delay: i * 0.08 })); tone({ type: 'sine', f: 2093, t: 0.6, g: 0.06, delay: 0.32 }); },
  cast: () => { noise({ t: 0.22, g: 0.18, f: 400, f2: 2400, Q: 2 }); },
  hit: () => { tone({ type: 'sine', f: 140, f2: 50, t: 0.12, g: 0.25 }); noise({ t: 0.06, g: 0.1, f: 1500, type: 'lowpass' }); },
  coin: () => { tone({ type: 'square', f: 1320, t: 0.05, g: 0.05, filter: 'lowpass', q: 3000 }); tone({ type: 'square', f: 1760, t: 0.12, g: 0.05, delay: 0.05, filter: 'lowpass', q: 3000 }); },
  tick: () => { tone({ type: 'triangle', f: 1800, t: 0.025, g: 0.05 }); },
  reward: () => { [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'sine', f, t: 0.5, g: 0.12, delay: i * 0.05 })); noise({ t: 0.6, g: 0.04, f: 8000, type: 'highpass' }); },
  kill: () => { tone({ type: 'sawtooth', f: 220, f2: 440, t: 0.2, g: 0.08, filter: 'lowpass', q: 1600 }); tone({ type: 'triangle', f: 660, t: 0.25, g: 0.1, delay: 0.08 }); },
  death: () => { tone({ type: 'sawtooth', f: 300, f2: 60, t: 0.8, g: 0.1, filter: 'lowpass', q: 900 }); },
  objective: () => { tone({ type: 'sawtooth', f: 110, t: 0.9, g: 0.12, filter: 'lowpass', q: 700 }); tone({ type: 'triangle', f: 330, t: 0.7, g: 0.08, delay: 0.1 }); tone({ type: 'triangle', f: 494, t: 0.7, g: 0.07, delay: 0.25 }); },
  victory: () => { [392, 523, 659, 784].forEach((f, i) => tone({ type: 'triangle', f, t: 0.5, g: 0.15, delay: i * 0.12 })); [523, 659, 784, 1047].forEach(f => tone({ type: 'sine', f, t: 1.6, g: 0.07, delay: 0.5 })); },
  defeat: () => { [392, 349, 311, 262].forEach((f, i) => tone({ type: 'triangle', f, t: 0.6, g: 0.13, delay: i * 0.18 })); tone({ type: 'sawtooth', f: 131, t: 1.6, g: 0.06, delay: 0.7, filter: 'lowpass', q: 500 }); },
  whoosh: () => { noise({ t: 0.35, g: 0.12, f: 300, f2: 3000, Q: 1.5 }); },
};

export function sfx(name, minGap = 0.04) {
  const c = ensure(); if (!c || !unlocked || vol <= 0) return;
  const tnow = c.currentTime; if (last[name] && tnow - last[name] < minGap) return; last[name] = tnow;
  try { (SFX[name] || SFX.click)(); } catch (e) { /* ignore */ }
}
export default { sfx, setVolume, unlockAudio };
