// Deliberate, per-ability VFX for the keys Agent A emits (see src/data/heroes/VFX_KEYS.md).
// handleAbilityFx(renderer, ev, c, I) -> true if handled. c = caster colors {vfx, vfx2, fx}, I = intensity (local loud).
import { teamColor } from './util.js';

const PI = Math.PI;

export function handleAbilityFx(R, ev, c, I) {
  const f = FX[ev.key];
  if (!f) return false;
  f(R, R.vfx, ev, c, I);
  return true;
}

// helpers
const posOf = (R, id) => () => { const e = R._ent(id); if (!e || e.alive === false) return null; const p = R._ipos(e); return { x: p.x, y: 1.3, z: p.z }; };
const at = (R, ev) => { if (ev.targetId != null) { const e = R._ent(ev.targetId); if (e) { const p = R._ipos(e); return { x: p.x, z: p.z }; } } return { x: ev.x, z: ev.y }; };
const lineParticles = (V, ev, color, n, o = {}) => { const dx = ev.tx - ev.x, dy = ev.ty - ev.y; for (let i = 0; i < n; i++) { const t = i / n; V.burst(ev.x + dx * t, o.y ?? 0.6, ev.y + dy * t, color, o.k ?? 0.7, { style: o.style || 'dust', speed: o.speed ?? 0.5, up: o.up ?? 0.6, intensity: o.I ?? 1, color1: o.color1, size: o.size }); } };
const impact = (V, x, z, c, I, s = 1) => { V.flash(x, 1.3, z, { color: c.vfx, size: 3.5 * s, dur: 0.25 }); V.ring(x, z, { color: c.vfx2, r0: 0.3, r1: 2.2 * s, dur: 0.3 }); V.burst(x, 1.2, z, c.vfx, 12 * s, { style: c.fx, intensity: I + 0.2, color1: c.vfx2 }); };
const shakeNear = (R, x, z, amt, local) => { if (local || (Math.abs(x - R.camT.x) < 25 && Math.abs(z - R.camT.z) < 20)) R.shake = Math.max(R.shake || 0, amt * (local ? 1 : 0.5)); };
const dur = (ev, d, max = 12) => Math.min(max, ev.duration || d);

const FX = {
  // ───── Bram: bark, roots, stone
  bram_q: (R, V, ev, c, I) => { V.beam(ev.x, 0.4, ev.y, ev.tx, 0.4, ev.ty, { color: c.vfx, width: 1.0, dur: 0.35, alpha: 0.5 }); lineParticles(V, ev, '#a08a6a', 10, { style: 'dust', size: 1.2 }); lineParticles(V, ev, c.vfx, 8, { style: c.fx, I }); },
  bram_q_hit: (R, V, ev, c, I) => { const p = at(R, ev); impact(V, p.x, p.z, c, I, 1.2); V.spikes(p.x, p.z, { r: 1.6, n: 7, h: 1.6, color: '#8a7a68', dur: 0.7 }); V.burst(p.x, 0.4, p.z, '#b8a888', 10, { style: 'dust', size: 1.4 }); shakeNear(R, p.x, p.z, 0.5, c.local); },
  bram_w: (R, V, ev, c, I) => { const a = ev.angle ?? 0, L = ev.radius ?? 4; for (let i = -3; i <= 3; i++) { const t = i / 3; const x = ev.x + Math.cos(a) * L * t, z = ev.y + Math.sin(a) * L * t; V.burst(x, 0.3, z, '#a08a6a', 4, { style: 'dust', size: 1.3, up: 2 }); V.burst(x, 0.6, z, c.vfx, 3, { style: c.fx, intensity: I }); } V.spikes(ev.x, ev.y, { r: L * 0.9, n: 6, h: 1.2, color: c.vfx, dur: 0.5, fill: true }); },
  bram_r: (R, V, ev, c, I) => { const r = ev.radius || 7, d = dur(ev, 2); V.ring(ev.x, ev.y, { color: c.vfx, r0: r, r1: r, dur: d, hold: true, alpha: 0.7 }); for (let k = 0; k < 3; k++) R._later(k * d / 3, () => V.ring(ev.x, ev.y, { color: c.vfx2, r0: r, r1: 0.5, dur: d / 3, easeIn: true, alpha: 0.6 })); for (let i = 0; i < 40 * I; i++) { const a = Math.random() * PI * 2, rr = r * (0.6 + Math.random() * 0.4); V.add.emit({ x: ev.x + Math.cos(a) * rr, y: 0.4 + Math.random(), z: ev.y + Math.sin(a) * rr, vx: -Math.cos(a) * 2, vz: -Math.sin(a) * 2, life: d * 0.8, size: 0.5, size1: 0.1, color: c.vfx, color1: c.vfx2, alpha: 0.9, drag: 0.2, swirl: [ev.x, ev.y, 1.2], shape: 1 }); } },
  bram_r_end: (R, V, ev, c, I) => { const r = ev.radius || 7; V.spikes(ev.x, ev.y, { r: r * 0.7, n: 14, h: 2.6, color: '#6b4a2b', emissive: '#1a2a08', dur: 1.1, fill: true }); V.ring(ev.x, ev.y, { color: c.vfx, r0: 1, r1: r, dur: 0.5 }); V.burst(ev.x, 0.5, ev.y, c.vfx, 30, { style: c.fx, radius: r * 0.7, up: 3, intensity: I }); shakeNear(R, ev.x, ev.y, 0.7, c.local); },

  // ───── Kaela: fire
  kaela_q: (R, V, ev, c, I) => kaelaLunge(R, V, ev, c, I),
  kaela_q2: (R, V, ev, c, I) => kaelaLunge(R, V, ev, c, I, true),
  kaela_w: (R, V, ev, c, I) => { const id = ev.targetId ?? ev.srcId; const d = dur(ev, 1.2, 4); V.follow(posOf(R, id), { color: c.vfx, r: 1.8, dur: d, style: c.fx, pcolor: c.vfx, color1: c.vfx2 }); const p = posOf(R, id)(); if (p) V.bubble(p.x, 1.4, p.z, { color: c.vfx2, r: 1.8, dur: 0.4 }); },
  kaela_w_hit: (R, V, ev, c, I) => { const r = ev.radius || 4.5; const col = ev.hot ? '#fff4c0' : c.vfx; V.ring(ev.x, ev.y, { color: col, r0: 0.5, r1: r, dur: 0.4 }); V.disc(ev.x, ev.y, { color: c.vfx, r, dur: 0.35, alpha: 0.6 }); for (let i = 0; i < 3; i++) V.slash(ev.x, 1.2, ev.y, (i / 3) * PI * 2, { color: col, r: r * 0.8, dur: 0.3, tilt: 0.1 }); V.burst(ev.x, 0.8, ev.y, c.vfx, ev.hot ? 36 : 22, { style: 'embers', radius: r * 0.6, up: 2.5, intensity: I, color1: c.vfx2 }); if (ev.hot) shakeNear(R, ev.x, ev.y, 0.5, c.local); },
  kaela_r: (R, V, ev, c, I) => { const id = ev.targetId ?? ev.srcId; const p = posOf(R, id)(); if (p) { V.pillar(p.x, p.z, { color: c.vfx, r: 2.2, h: 12, dur: 0.8 }); V.ring(p.x, p.z, { color: c.vfx2, r0: 1, r1: 7, dur: 0.6 }); V.burst(p.x, 1, p.z, c.vfx, 40, { style: 'embers', up: 4, radius: 1.5, intensity: I + 0.3 }); } V.follow(posOf(R, id), { color: c.vfx, r: 1.6, dur: dur(ev, 8), style: 'embers', pcolor: c.vfx, color1: c.vfx2, rate: 0.7, yr: 2.4 }); shakeNear(R, ev.x, ev.y, 0.6, c.local); },
  kaela_p: (R, V, ev, c, I) => { const id = ev.targetId ?? ev.srcId; V.follow(posOf(R, id), { color: c.vfx2, r: 1.2, dur: dur(ev, 4, 5), style: 'embers', pcolor: c.vfx, rate: 0.35, alpha: 0.5 }); },

  // ───── Lumi: stars
  lumi_q_hit: (R, V, ev, c, I) => { const p = at(R, ev); impact(V, p.x, p.z, c, I); V.burst(p.x, 1.3, p.z, c.vfx2, 10, { style: 'stars', speed: 1.5, intensity: I + 0.3 }); },
  lumi_mark: (R, V, ev, c, I) => { V.pillar(ev.x, ev.y, { color: c.vfx, r: 0.8, h: 6, dur: 0.5 }); V.burst(ev.x, 1.4, ev.y, c.vfx2, 10, { style: 'stars', intensity: I + 0.2 }); },
  lumi_p: (R, V, ev, c, I) => constellation(V, ev, c, false),
  lumi_p_hit: (R, V, ev, c, I) => { constellation(V, ev, c, true); V.burst(ev.x, 1, ev.y, c.vfx2, 24, { style: 'stars', radius: 2.5, up: 3, intensity: I + 0.2 }); },
  lumi_w: (R, V, ev, c, I) => { const r = ev.radius || 4.5, d = dur(ev, 1, 3); V.ring(ev.x, ev.y, { color: c.vfx, r0: r, r1: r, dur: d, hold: true, alpha: 0.7 }); V.ring(ev.x, ev.y, { color: c.vfx2, r0: r * 1.3, r1: 0.3, dur: d, easeIn: true, alpha: 0.6 }); for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; V.add.emit({ x: ev.x + Math.cos(a) * r, y: 4, z: ev.y + Math.sin(a) * r, vx: -Math.cos(a) * r / d, vy: -3 / d, vz: -Math.sin(a) * r / d, life: d, size: 0.8, size1: 0.3, color: c.vfx2, color1: c.vfx, alpha: 1, drag: 0, shape: 2 }); } },
  lumi_w_hit: (R, V, ev, c, I) => { const r = ev.radius || 4.5; V.ring(ev.x, ev.y, { color: c.vfx, r0: r, r1: 0.2, dur: 0.3, easeIn: true }); V.flash(ev.x, 1, ev.y, { color: c.vfx, size: 5, dur: 0.3 }); V.burst(ev.x, 1, ev.y, c.vfx, 26, { style: 'stars', speed: 1.4, up: 2, intensity: I + 0.2, color1: c.vfx2 }); },
  lumi_r: (R, V, ev, c, I) => { const r = ev.radius || 8, d = dur(ev, 0.6, 3); V.ring(ev.x, ev.y, { color: c.vfx, r0: r, r1: r, dur: d, hold: true, alpha: 0.7 }); V.disc(ev.x, ev.y, { color: c.vfx, r, dur: d, alpha: 0.4 }); if (Array.isArray(ev.points)) for (const p of ev.points) { V.arc(p.x, p.y, ev.x, ev.y, { color: c.vfx2, h: 5, dur: d, size: 2.4, style: 'stars' }); } },
  lumi_r_hit: (R, V, ev, c, I) => { const r = ev.radius || 8; V.ring(ev.x, ev.y, { color: c.vfx2, r0: r * 1.1, r1: 0.3, dur: 0.35, easeIn: true }); R._later(0.3, () => { V.ring(ev.x, ev.y, { color: c.vfx, r0: 0.5, r1: r * 1.2, dur: 0.6 }); V.pillar(ev.x, ev.y, { color: c.vfx, r: 2.2, h: 14, dur: 0.9 }); V.flash(ev.x, 2, ev.y, { color: c.vfx2, size: 8, dur: 0.35 }); V.burst(ev.x, 1, ev.y, c.vfx2, 60, { style: 'stars', speed: 2.2, up: 4, radius: 2, intensity: I + 0.3, color1: c.vfx }); shakeNear(R, ev.x, ev.y, 1.0, c.local); }); },

  // ───── Vex: gunpowder & tracers
  vex_p: (R, V, ev, c, I) => { muzzle(V, ev, c); V.beam(ev.x, 1.5, ev.y, ev.tx, 1.5, ev.ty, { color: c.vfx2, width: 0.12, dur: 0.18 }); V.beam(ev.x, 1.5, ev.y, ev.tx, 1.5, ev.ty, { color: c.vfx, width: 0.35, dur: 0.25, alpha: 0.6 }); },
  vex_w: (R, V, ev, c, I) => { lineParticles(V, ev, '#c8b898', 8, { style: 'dust', size: 1.1 }); V.burst(ev.x, 0.5, ev.y, '#c8b898', 8, { style: 'dust', size: 1.3 }); V.ring(ev.tx, ev.ty, { color: c.vfx, r0: 0.5, r1: 2, dur: 0.3 }); },
  vex_w_hit: (R, V, ev, c, I) => { const p = at(R, ev); impact(V, p.x, p.z, c, I, 1.1); V.burst(p.x, 1.3, p.z, c.vfx2, 10, { style: 'sparks', speed: 1.6, intensity: I + 0.3 }); },
  vex_r_charge: (R, V, ev, c, I) => { const d = dur(ev, 1, 3); V.beam(ev.x, 1.5, ev.y, ev.tx, 1.5, ev.ty, { color: '#ff3030', width: 0.05, dur: d, alpha: 1 }); V.beam(ev.x, 1.5, ev.y, ev.tx, 1.5, ev.ty, { color: c.vfx, width: 0.18, dur: d, alpha: 0.35 }); V.follow(posOf(R, ev.srcId), { color: c.vfx, r: 1.5, dur: d, style: 'sparks', pcolor: c.vfx2, rate: 0.5, alpha: 0.7 }); },
  vex_r: (R, V, ev, c, I) => { muzzle(V, ev, c, 2); V.beam(ev.x, 1.5, ev.y, ev.tx, 1.5, ev.ty, { color: c.vfx, width: 1.2, dur: 0.45 }); V.beam(ev.x, 1.5, ev.y, ev.tx, 1.5, ev.ty, { color: '#ffffff', width: 0.3, dur: 0.3 }); lineParticles(V, ev, c.vfx, 26, { style: 'sparks', y: 1.5, I: I + 0.2 }); shakeNear(R, ev.x, ev.y, 0.9, c.local); },
  vex_r_hit: (R, V, ev, c, I) => { const p = at(R, ev); impact(V, p.x, p.z, c, I, 1.7); V.burst(p.x, 0.5, p.z, '#b8a888', 12, { style: 'dust', size: 1.5 }); },

  // ───── Nyx: shadow
  nyx_p: (R, V, ev, c, I) => { const id = ev.targetId ?? ev.srcId; V.follow(posOf(R, id), { color: c.vfx, r: 1.1, dur: dur(ev, 1.5, 6), style: 'void', pcolor: c.vfx, rate: 0.25, alpha: 0.5 }); },
  nyx_p_hit: (R, V, ev, c, I) => { const p = at(R, ev); crossSlash(V, p, c, 1); V.burst(p.x, 1.2, p.z, c.vfx, 10, { style: 'void', intensity: I + 0.2, color1: c.vfx2 }); },
  nyx_q: (R, V, ev, c, I) => { lineParticles(V, ev, c.vfx, 16, { style: 'void', y: 1.2, I: I + 0.2, color1: c.vfx2 }); V.beam(ev.x, 1.0, ev.y, ev.tx, 1.0, ev.ty, { color: c.vfx, width: 0.6, dur: 0.3, alpha: 0.5 }); V.flash(ev.x, 1.2, ev.y, { color: c.vfx, size: 3, dur: 0.3 }); },
  nyx_q_swap: (R, V, ev, c, I) => { for (const [x, z] of [[ev.x, ev.y], [ev.tx, ev.ty]]) { V.flash(x, 1.3, z, { color: c.vfx, size: 4, dur: 0.35 }); V.burst(x, 1.2, z, c.vfx, 14, { style: 'void', intensity: I + 0.2, color1: c.vfx2 }); V.ring(x, z, { color: c.vfx2, r0: 2.5, r1: 0.3, dur: 0.3, easeIn: true }); } },
  nyx_w: (R, V, ev, c, I) => { const p = at(R, ev); crossSlash(V, p, c, 1.2); V.burst(p.x, 1.2, p.z, c.vfx, 12, { style: 'void', intensity: I + 0.2, color1: c.vfx2 }); },
  nyx_w_iso: (R, V, ev, c, I) => { const p = at(R, ev); crossSlash(V, p, c, 1.7); V.ring(p.x, p.z, { color: c.vfx2, r0: 0.5, r1: 3.5, dur: 0.4 }); V.flash(p.x, 1.4, p.z, { color: c.vfx2, size: 5, dur: 0.3 }); V.burst(p.x, 1.2, p.z, c.vfx, 24, { style: 'void', speed: 1.4, intensity: I + 0.3, color1: c.vfx2 }); shakeNear(R, p.x, p.z, 0.4, c.local); },
  nyx_r: (R, V, ev, c, I) => { const r = ev.radius || 7.5; V.ring(ev.x, ev.y, { color: c.vfx, r0: 0.5, r1: r, dur: 0.4 }); V.burst(ev.x, 1, ev.y, c.vfx, 30, { style: 'void', radius: r * 0.8, intensity: I }); },

  // ───── Pip & Bolt: tech
  pip_p: (R, V, ev, c, I) => { const p = at(R, ev); V.bubble(p.x, 1.4, p.z, { color: c.vfx, r: 1.8, dur: 0.45, pop: true }); V.burst(p.x, 1.4, p.z, c.vfx, 8, { style: 'lightning', intensity: I }); },
  pip_q: (R, V, ev, c, I) => { V.flash(ev.x, 1.6, ev.y, { color: c.vfx, size: 2.5, dur: 0.2 }); },
  pip_q_hit: (R, V, ev, c, I) => { const p = at(R, ev); impact(V, p.x, p.z, c, I); V.burst(p.x, 1.3, p.z, c.vfx2, 8, { style: 'lightning', intensity: I + 0.2 }); },
  pip_q_heal: (R, V, ev, c, I) => { const p = at(R, ev); V.ring(p.x, p.z, { color: '#6dff8a', r0: 0.3, r1: 2, dur: 0.4 }); V.burst(p.x, 0.6, p.z, '#7dff9a', 14, { style: 'stars', up: 2.5, radius: 0.8, intensity: I + 0.3 }); },
  pip_w: (R, V, ev, c, I) => { const d = dur(ev, 2, 8); V.tether(posOf(R, ev.srcId), posOf(R, ev.targetId), { color: c.vfx, dur: d, width: 0.14, style: 'lightning' }); V.follow(posOf(R, ev.targetId), { color: c.vfx, r: 1.4, dur: d, style: 'sparks', pcolor: c.vfx2, rate: 0.3, alpha: 0.6 }); },
  pip_r: (R, V, ev, c, I) => { const r = ev.radius || 4.5, d = dur(ev, 0.8, 3); const p = at(R, ev); V.ring(p.x, p.z, { color: c.vfx, r0: r, r1: r, dur: d, hold: true, alpha: 0.7 }); V.ring(p.x, p.z, { color: '#ff4040', r0: r, r1: 0.4, dur: d, easeIn: true, alpha: 0.5 }); },
  pip_r_hit: (R, V, ev, c, I) => { const r = ev.radius || 4.5; V.ring(ev.x, ev.y, { color: c.vfx, r0: 0.5, r1: r, dur: 0.45 }); V.ring(ev.x, ev.y, { color: '#ffffff', r0: 0.3, r1: r * 0.7, dur: 0.3 }); V.spikes(ev.x, ev.y, { r: r * 0.7, n: 10, h: 1.5, color: '#7a7a80', dur: 0.8 }); V.burst(ev.x, 0.4, ev.y, '#b8b0a0', 20, { style: 'dust', radius: r * 0.6, size: 1.4, up: 2 }); V.burst(ev.x, 1, ev.y, c.vfx, 18, { style: 'lightning', radius: r * 0.5, intensity: I + 0.2 }); shakeNear(R, ev.x, ev.y, 0.9, c.local); },

  // ───── Mire: bog
  mire_q: (R, V, ev, c, I) => { V.arc(ev.x, ev.y, ev.tx ?? ev.x, ev.ty ?? ev.y, { color: c.vfx, h: 3.5, dur: dur(ev, 0.35, 1), size: 1.6, style: 'bubbles', onLand: () => { V.ring(ev.tx, ev.ty, { color: c.vfx, r0: 0.5, r1: 3, dur: 0.35 }); V.burst(ev.tx, 0.4, ev.ty, c.vfx, 14, { style: 'bubbles', radius: 1.5, up: 2, intensity: I + 0.2 }); } }); },
  mire_w: (R, V, ev, c, I) => { V.burst(ev.x, 0.5, ev.y, '#5a7a3a', 12, { style: 'dust', size: 1.4 }); V.burst(ev.x, 1.5, ev.y, c.vfx, 10, { style: 'bubbles', intensity: I }); V.ring(ev.x, ev.y, { color: c.vfx, r0: 0.5, r1: 2.5, dur: 0.4 }); },
  mire_w_root: (R, V, ev, c, I) => { const p = at(R, ev); V.spikes(p.x, p.z, { r: 1.1, n: 6, h: 1.6, color: '#3d5a2a', emissive: '#102008', dur: 1.2, tilt: -0.3 }); V.ring(p.x, p.z, { color: c.vfx, r0: 2.2, r1: 0.6, dur: 0.35, easeIn: true }); V.burst(p.x, 0.5, p.z, c.vfx, 8, { style: 'leaves' }); },
  mire_r: (R, V, ev, c, I) => { const z = ev.zone || { x: ev.x, y: ev.y, r: ev.radius || 13 }; if (ev.phase === 'end') { V.burst(z.x, 0.3, z.y, c.vfx, 30, { style: 'bubbles', radius: z.r * 0.8, up: 1.5 }); return; } V.ring(z.x, z.y, { color: c.vfx, r0: 1, r1: z.r, dur: 0.8 }); V.burst(z.x, 0.4, z.y, '#5a6a30', 30, { style: 'dust', radius: z.r * 0.8, size: 1.5, up: 2 }); shakeNear(R, z.x, z.y, 0.8, c.local); },
  mire_r_end: (R, V, ev, c, I) => { const z = ev.zone || { x: ev.x, y: ev.y, r: ev.radius || 13 }; V.ring(z.x, z.y, { color: c.vfx, r0: z.r, r1: 0.5, dur: 0.8, easeIn: true, alpha: 0.6 }); V.burst(z.x, 0.3, z.y, c.vfx, 30, { style: 'bubbles', radius: z.r * 0.8, up: 1.5 }); },

  // ───── Garrok: the hunt
  garrok_p: (R, V, ev, c, I) => { const p = at(R, ev); V.burst(p.x, 1.5, p.z, c.vfx, 8, { style: 'stars', up: 2, intensity: I }); V.ring(p.x, p.z, { color: c.vfx, r0: 0.3, r1: 1.8, dur: 0.35 }); },
  garrok_q: (R, V, ev, c, I) => { V.arc(ev.x, ev.y, ev.tx, ev.ty, { color: c.vfx, h: 3, dur: 0.4, size: 1.2, style: c.fx }); V.burst(ev.x, 0.3, ev.y, '#a08a6a', 8, { style: 'dust', size: 1.2 }); },
  garrok_q_hit: (R, V, ev, c, I) => { const r = ev.radius || 3.2; V.ring(ev.x, ev.y, { color: c.vfx, r0: 0.5, r1: r, dur: 0.4 }); V.spikes(ev.x, ev.y, { r: r * 0.8, n: 8, h: 1.2, color: '#8a7a68', dur: 0.7 }); V.burst(ev.x, 0.3, ev.y, '#b8a888', 16, { style: 'dust', radius: r * 0.6, size: 1.4, up: 2 }); shakeNear(R, ev.x, ev.y, 0.5, c.local); },
  garrok_w: (R, V, ev, c, I) => { const r = ev.radius || 6; for (let k = 0; k < 3; k++) R._later(k * 0.12, () => V.ring(ev.x, ev.y, { color: k === 1 ? c.vfx2 : c.vfx, r0: 1, r1: r, dur: 0.5, alpha: 0.8 - k * 0.2 })); V.burst(ev.x, 2, ev.y, c.vfx, 16, { style: c.fx, speed: 2, up: 1, intensity: I }); shakeNear(R, ev.x, ev.y, 0.4, c.local); },
  garrok_r: (R, V, ev, c, I) => { const d = dur(ev, 8); V.follow(posOf(R, ev.targetId), { color: '#ff3a3a', r: 1.8, dur: d, alpha: 0.7 }); V.icon(posOf(R, ev.targetId), { color: '#ff4a3a', dur: d, size: 0.55, cam: R.camera, y: (R.views.get(ev.targetId)?.height || 3) + 1.6 }); const p = at(R, ev); V.flash(p.x, 2, p.z, { color: '#ff4a3a', size: 4, dur: 0.3 }); },
  garrok_wolf_spawn: (R, V, ev, c, I) => { V.burst(ev.x, 0.5, ev.y, '#c8c0b0', 14, { style: 'dust', size: 1.3, up: 2 }); V.burst(ev.x, 1, ev.y, c.vfx, 14, { style: c.fx, up: 2.5, intensity: I + 0.2 }); V.ring(ev.x, ev.y, { color: c.vfx, r0: 0.5, r1: 3, dur: 0.4 }); },

  // ───── Relics
  relic_blink: (R, V, ev, c, I) => { for (const [x, z, s] of [[ev.x, ev.y, 1], [ev.tx, ev.ty, 1.2]]) { V.flash(x, 1.3, z, { color: c.vfx, size: 4 * s, dur: 0.3 }); V.ring(x, z, { color: '#ffffff', r0: s > 1 ? 0.3 : 2.5, r1: s > 1 ? 2.5 : 0.3, dur: 0.3, easeIn: s <= 1 }); V.burst(x, 1, z, c.vfx2, 10, { style: 'stars', intensity: I + 0.2 }); } },
  relic_brand: (R, V, ev, c, I) => { const p = at(R, ev); V.flash(p.x, 1.3, p.z, { color: '#ff8a2a', size: 4, dur: 0.3 }); V.ring(p.x, p.z, { color: '#ff8a2a', r0: 2, r1: 0.5, dur: 0.3, easeIn: true }); V.burst(p.x, 1.2, p.z, '#ff8a2a', 12, { style: 'embers', intensity: I + 0.2 }); },
  relic_barrier: (R, V, ev, c, I) => { const id = ev.targetId ?? ev.srcId; const d = dur(ev, 2.5, 5); V.dome(0, 0, { color: '#bfe6ff', r: 1.9, dur: d, follow: posOf(R, id) }); V.follow(posOf(R, id), { color: '#bfe6ff', r: 1.8, dur: d, alpha: 0.6 }); },
  relic_heal: (R, V, ev, c, I) => { const p = at(R, ev); V.pillar(p.x, p.z, { color: '#6dff8a', r: 1.5, h: 6, dur: 0.6 }); V.ring(p.x, p.z, { color: '#6dff8a', r0: 0.5, r1: 3.5, dur: 0.5 }); V.burst(p.x, 0.5, p.z, '#9dffb0', 20, { style: 'stars', up: 3, radius: 1, intensity: I + 0.2 }); },
  relic_ghost: (R, V, ev, c, I) => { const id = ev.targetId ?? ev.srcId; V.follow(posOf(R, id), { color: '#bff8ff', r: 1.3, dur: dur(ev, 3, 6), style: 'wisps', pcolor: '#dffcff', rate: 0.6, alpha: 0.5, vy: 0.5 }); },
  relic_purify: (R, V, ev, c, I) => { const p = at(R, ev); V.ring(p.x, p.z, { color: '#ffffff', r0: 0.5, r1: 3, dur: 0.4 }); V.pillar(p.x, p.z, { color: '#fff6c8', r: 1.2, h: 6, dur: 0.5 }); V.burst(p.x, 0.5, p.z, '#ffffff', 16, { style: 'sparks', up: 3, intensity: I + 0.2 }); },
  relic_ignite: (R, V, ev, c, I) => { const d = dur(ev, 3, 6); V.follow(posOf(R, ev.targetId), { color: '#ff5a1a', r: 1.3, dur: d, style: 'embers', pcolor: '#ff7a2a', color1: '#ff2a0a', rate: 0.7, alpha: 0.6 }); const p = at(R, ev); V.flash(p.x, 1.3, p.z, { color: '#ff5a1a', size: 3.5, dur: 0.3 }); },
  relic_lantern: (R, V, ev, c, I) => { V.flash(ev.x, 1.8, ev.y, { color: '#ffd06a', size: 4, dur: 0.4 }); V.ring(ev.x, ev.y, { color: '#ffd06a', r0: 0.5, r1: 4, dur: 0.5 }); V.burst(ev.x, 1.8, ev.y, '#ffd06a', 10, { style: 'embers', intensity: I }); },
};

function kaelaLunge(R, V, ev, c, I, second) {
  const col = ev.hot ? '#fff0b0' : c.vfx;
  V.beam(ev.x, 1.1, ev.y, ev.tx, 1.1, ev.ty, { color: col, width: ev.hot ? 0.9 : 0.6, dur: 0.3 });
  V.beam(ev.x, 0.2, ev.y, ev.tx, 0.2, ev.ty, { color: c.vfx, width: 1.2, dur: 0.6, alpha: 0.4 });
  lineParticles(V, ev, c.vfx, ev.hot ? 22 : 14, { style: 'embers', y: 1, I: I + 0.2, color1: c.vfx2 });
  V.slash(ev.tx, 1.2, ev.ty, Math.atan2(ev.ty - ev.y, ev.tx - ev.x), { color: col, r: 2.4, flip: !!second, dur: 0.25 });
}
function constellation(V, ev, c, hit) {
  const pts = ev.points || []; if (pts.length < 2) return;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; V.beam(a.x, 1.0, a.y, b.x, 1.0, b.y, { color: hit ? c.vfx2 : c.vfx, width: hit ? 0.45 : 0.12, dur: hit ? 0.4 : (ev.duration || 0.5) }); V.flash(a.x, 1.0, a.y, { color: c.vfx2, size: hit ? 3.5 : 2, dur: hit ? 0.35 : (ev.duration || 0.5) }); }
}
function muzzle(V, ev, c, s = 1) {
  const a = Math.atan2(ev.ty - ev.y, ev.tx - ev.x); const mx = ev.x + Math.cos(a) * 2.4, mz = ev.y + Math.sin(a) * 2.4;
  V.flash(mx, 1.5, mz, { color: c.vfx2, size: 2.5 * s, dur: 0.12 }); V.cone(mx, mz, a, { color: c.vfx, r: 2.5 * s, dur: 0.15, alpha: 0.7 });
  V.burst(mx, 1.5, mz, '#d8d0c0', 4 * s, { style: 'dust', size: 0.7 });
}
function crossSlash(V, p, c, s) {
  V.slash(p.x, 1.3, p.z, PI / 4, { color: c.vfx, r: 1.6 * s, dur: 0.22, tilt: 0.8 });
  V.slash(p.x, 1.3, p.z, -PI / 4, { color: c.vfx2, r: 1.6 * s, dur: 0.22, tilt: -0.8, flip: true });
}
