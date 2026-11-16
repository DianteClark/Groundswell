// Procedural hero animator (HEROES lead).
// poseRig(rig, anim, time, moving) — same signature as before. Everything else is derived:
//   dt               from successive `time` values (renderer passes its hitstop-scaled clock)
//   speed / turning  from rig.root.parent (the view group the renderer moves & rotates)
//   attack timing    from anim.dur (period) and anim.windup (or the sim formula 0.3/attackSpeed)
//   cast slot        from rig.st.castSlot (set by CombatFx on 'cast' events) or the entity's anim.slot
//   statuses         from rig.st.ent (entity ref set by CombatFx) — stun, recall, airborne...
// Poses are data: { bone:[rx,ry,rz], 'bone@p':[x,y,z], 'bone@s':[sx,sy,sz] } blended additively.
import * as THREE from 'three';
import { WeaponTrail } from './trail.js';
import { vfxFor } from '../fx/registry.js';

const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sat = (v) => clamp(v, 0, 1);
const ease = (t) => { t = sat(t); return t * t * (3 - 2 * t); };
const easeOut = (t) => { t = sat(t); return 1 - (1 - t) * (1 - t) * (1 - t); };
const easeIn = (t) => { t = sat(t); return t * t * t; };
const back = (t) => { t = sat(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

function reset(b) {
  for (const k in b) { const r = b[k].userData.rest; if (!r) continue; b[k].position.copy(r.p); b[k].rotation.copy(r.r); b[k].scale.copy(r.s); }
}
// apply a pose dict with weight w
export function applyPose(b, pose, w) {
  if (!pose || w === 0) return;
  for (const key in pose) {
    const v = pose[key]; const at = key.indexOf('@');
    if (at < 0) { const bn = b[key]; if (!bn) continue; bn.rotation.x += v[0] * w; bn.rotation.y += v[1] * w; bn.rotation.z += v[2] * w; }
    else {
      const bn = b[key.slice(0, at)]; if (!bn) continue; const kind = key[at + 1];
      if (kind === 'p') { bn.position.x += v[0] * w; bn.position.y += v[1] * w; bn.position.z += v[2] * w; }
      else if (kind === 's') { bn.scale.x *= 1 + (v[0] - 1) * w; bn.scale.y *= 1 + (v[1] - 1) * w; bn.scale.z *= 1 + (v[2] - 1) * w; }
    }
  }
}
const R = (b, n, x, y, z) => { const bn = b[n]; if (bn) { bn.rotation.x += x; bn.rotation.y += y; bn.rotation.z += z; } };
const P = (b, n, x, y, z) => { const bn = b[n]; if (bn) { bn.position.x += x; bn.position.y += y; bn.position.z += z; } };

function hasStatus(e, k) { return !!e?.statuses && e.statuses.some((s) => s.key === k); }

export function rigState(rig) { return state(rig); }
function state(rig) {
  return rig.st || (rig.st = { last: null, speed: 0, turn: 0, phase: Math.random() * TAU, px: null, pz: null, prot: null, run: 0, act: null, flinch: 0, fdir: 0, squash: 0, deadT: 0, wasDead: false, rise: 0, idleT: Math.random() * 5, fidget: -1, atkN: 0, prevState: null, prevT: 0, lastAnimObj: null, chan: 0, stun: 0, air: 0 });
}

/** Start an action clip on a rig (used for casts/attacks; CombatFx may call this directly). */
export function playAction(rig, kind, o = {}) {
  const st = state(rig); const d = rig.def;
  if (kind === 'attack') {
    st.atkN++;
    const list = d.attacks || [];
    const clip = list.length ? list[st.atkN % list.length] : null;
    const period = clamp(o.period || 1.2, 0.25, 3);
    const windup = clamp(o.windup || Math.max(0.08, Math.min(0.4, 0.3 * period)), 0.06, 0.6);
    st.act = { kind, clip, t: o.t || 0, windup, rec: Math.min(0.42, Math.max(0.16, period - windup)), struck: false, n: st.atkN };
  } else if (kind === 'cast') {
    const slot = o.slot || 'q';
    const clip = (d.casts && (d.casts[slot] || d.casts.q)) || null;
    st.act = { kind, clip, slot, t: o.t || 0, windup: clip?.wind ?? 0.08, hold: clip?.hold ?? 0.25, rec: clip?.rec ?? 0.35, struck: false };
  }
}
/** Hit reaction: dir = world angle the hit came FROM (radians, three XZ), heavy = bigger squash */
export function flinch(rig, heavy = false, dirAngle = null) {
  const st = state(rig); st.flinch = Math.min(1.4, st.flinch + (heavy ? 1.2 : 0.7)); if (heavy) st.squash = 1;
  if (dirAngle != null) st.fdir = dirAngle;
}

export function poseRig(rig, anim, time, moving) {
  const b = rig.bones, d = rig.def || {}; const st = state(rig);
  reset(b);
  // ── timing
  let dt = st.last == null ? 1 / 60 : time - st.last; st.last = time; dt = clamp(dt, 0, 0.1);
  const ent = st.ent;
  // ── kinematics from the view group
  const g = rig.root.parent;
  let measured = 0;
  if (g && dt > 0) {
    if (st.px != null) {
      const dx = g.position.x - st.px, dz = g.position.z - st.pz; const dist = Math.hypot(dx, dz);
      measured = dist > 4 ? 0 : dist / dt;
      let dr = g.rotation.y - st.prot; dr = ((dr + PI) % TAU + TAU) % TAU - PI;
      st.turn += (clamp(dr / dt, -12, 12) - st.turn) * (1 - Math.exp(-dt * 10));
    }
    st.px = g.position.x; st.pz = g.position.z; st.prot = g.rotation.y;
  }
  let targetSpeed = measured;
  const animState = anim?.state || 'idle'; const at = anim?.t || 0;
  if (moving && targetSpeed < 1) targetSpeed = d.previewSpeed || 9; // preview / testbed "run"
  if (!moving && animState !== 'dash') targetSpeed = Math.min(targetSpeed, measured);
  st.speed += (targetSpeed - st.speed) * (1 - Math.exp(-dt * 14));
  const dead = animState === 'dead';
  // ── detect action starts from the anim stream
  if (!dead) {
    const fresh = animState !== st.prevState || at + 1e-4 < st.prevT;
    const kindNow = animState === 'attack' ? 'attack' : animState === 'cast' ? 'cast' : null;
    const dup = st.act && st.act.kind === kindNow && st.act.t < 0.2;
    if (fresh && at < 0.25 && !dup) {
      if (animState === 'attack') playAction(rig, 'attack', { period: anim.dur, windup: anim.windup, t: at });
      else if (animState === 'cast') { const slot = st.castSlot || (typeof anim.slot === 'string' ? anim.slot : null) || (typeof ent?.anim?.slot === 'string' ? ent.anim.slot : null) || 'q'; st.castSlot = null; playAction(rig, 'cast', { slot, t: at }); }
    }
  }
  st.prevState = animState; st.prevT = at;

  // ── base stance
  const runW = dead ? 0 : ease(st.speed / 4.5);
  st.run = runW;
  if (d.rest) applyPose(b, d.rest, 1);
  // ── action envelope (computed first so locomotion can yield the arms)
  let actW = 0, act = st.act, upper = 1;
  if (act && !dead) {
    act.t += dt;
    const A = act; const c = A.clip;
    let w, s, r;
    if (A.kind === 'attack') {
      const wEnd = A.windup * 0.78, sEnd = A.windup + 0.05;
      w = easeIn(A.t / wEnd) ; s = A.t < wEnd ? 0 : easeOut((A.t - wEnd) / (sEnd - wEnd)); r = A.t < sEnd + 0.04 ? 0 : ease((A.t - sEnd - 0.04) / A.rec);
      if (!A.struck && A.t >= A.windup) { A.struck = true; onStrike(rig, A); }
    } else {
      w = ease(A.t / Math.max(0.01, A.windup)); const sEnd = A.windup + 0.08; s = A.t < A.windup ? 0 : back((A.t - A.windup) / 0.08);
      const holdEnd = sEnd + A.hold; r = A.t < holdEnd ? 0 : ease((A.t - holdEnd) / A.rec);
      if (!A.struck && A.t >= A.windup) { A.struck = true; onStrike(rig, A); }
    }
    actW = 1 - r;
    if (c) { applyPose(b, c.W, w * (1 - s) * (1 - r)); applyPose(b, c.S, s * (1 - r)); if (c.fn) c.fn(b, A, w, s, r, time); }
    if (r >= 1) st.act = null;
    upper = 1 - actW * 0.85;
  }
  // trail activity
  const trailOn = act && actW > 0.2 && (act.kind === 'attack' ? (act.t > act.windup * 0.55 && act.t < act.windup + 0.2) : (act.t < act.windup + 0.3));

  // ── locomotion
  const speedN = st.speed / 10;
  if (!dead) {
    if (d.loco) d.loco(b, st, dt, runW, upper, time);
    else if (d.float) floatLoco(b, d, st, dt, runW, upper, time);
    else bipedLoco(b, d, st, dt, runW, upper, time, speedN);
    // bank into turns + lean
    const bank = clamp(-st.turn * speedN * 0.09, -0.32, 0.32);
    R(b, 'root', 0, 0, bank * runW);
    if (b.chest) R(b, 'chest', 0, 0, bank * 0.3 * runW);
  }
  // dash / stagger overlays
  if (animState === 'dash' && !dead) { applyPose(b, d.dash || DEFAULT_DASH, 1); trailWorld(rig, true); }
  if (animState === 'stagger' && !dead) applyPose(b, STAGGER, 1);

  // ── statuses
  const stunned = !dead && ent && (hasStatus(ent, 'stun') || hasStatus(ent, 'knockup'));
  st.stun += ((stunned ? 1 : 0) - st.stun) * (1 - Math.exp(-dt * 8));
  if (st.stun > 0.01) {
    const s = st.stun; R(b, 'chest', Math.sin(time * 5) * 0.08 * s + 0.12 * s, 0, Math.cos(time * 5) * 0.1 * s); R(b, 'head', 0.25 * s + Math.sin(time * 7) * 0.08 * s, Math.cos(time * 4) * 0.2 * s, Math.sin(time * 5) * 0.15 * s);
    R(b, 'armL', 0.2 * s, 0, 0.25 * s); R(b, 'armR', 0.2 * s, 0, -0.25 * s); P(b, 'hips', 0, -0.06 * s, 0);
  }
  const recalling = !dead && ent?.recalling;
  st.chan += ((recalling ? 1 : 0) - st.chan) * (1 - Math.exp(-dt * 5));
  if (st.chan > 0.01) applyPose(b, d.recall || RECALL, st.chan * (1 - runW));
  // flinch + heavy squash
  if (st.flinch > 0.001) {
    const f = Math.min(1, st.flinch); const fx = -f * 0.28;
    R(b, 'chest', fx, 0, Math.sin(st.fdir || 0) * f * 0.1); R(b, 'head', fx * 0.8, 0, 0); R(b, 'spine', fx * 0.5, 0, 0);
    R(b, 'armL', -f * 0.25, 0, f * 0.3); R(b, 'armR', -f * 0.25, 0, -f * 0.3);
    st.flinch = Math.max(0, st.flinch - dt * 4.5);
  }
  if (st.squash > 0.001) {
    const k = st.squash; const osc = Math.cos((1 - k) * 16) * k; // springy
    if (b.hips) { b.hips.scale.y *= 1 - 0.16 * osc; b.hips.scale.x *= 1 + 0.1 * osc; b.hips.scale.z *= 1 + 0.1 * osc; }
    st.squash = Math.max(0, st.squash - dt * 3.2);
  }
  // ── death collapse + dissolve, respawn rise
  const u = rig.mat?.userData?.u;
  if (dead) {
    st.wasDead = true;
    const k = easeOut(at / 0.55), kneel = ease(at / 0.25);
    applyPose(b, d.death || DEATH, k);
    P(b, 'hips', 0, -0.25 * kneel, 0);
    R(b, 'thighL', -0.6 * kneel * (1 - k), 0, 0); R(b, 'thighR', -0.6 * kneel * (1 - k), 0, 0);
    const bounce = at > 0.55 ? Math.sin(Math.min(1, (at - 0.55) / 0.25) * PI) * 0.06 : 0;
    P(b, 'root', 0, bounce, 0);
    if (u) u.dissolve.value = at < 1.15 ? 0 : sat((at - 1.15) / 1.0) * 1.02;
  } else {
    if (st.wasDead) { st.wasDead = false; st.rise = 1; }
    if (st.rise > 0) {
      st.rise = Math.max(0, st.rise - dt / 0.75); const k = 1 - st.rise;
      if (u) u.dissolve.value = (1 - ease(k / 0.85)) * 0.98;
      P(b, 'root', 0, -0.4 * (1 - easeOut(k)), 0); if (b.root) { const s = 0.85 + 0.15 * back(k); b.root.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s)); }
    } else if (u && u.dissolve.value !== 0) u.dissolve.value = 0;
  }
  if (d.extra) d.extra(b, st, time, dt, runW, dead, ent);
  // ── weapon trails (world space)
  if (d.trails) updateTrails(rig, trailOn, dt);
}

// ───────────────────────────── locomotion ─────────────────────────────
function bipedLoco(b, d, st, dt, runW, upper, time, speedN) {
  // phase advances by distance / stride (foot plant sync)
  const stride = d.stride || 3.2;
  st.phase += (st.speed * dt / stride) * TAU;
  const ph = st.phase, s = Math.sin(ph), c = Math.cos(ph);
  const A = (d.legSwing ?? 0.75) * clamp(0.55 + speedN * 0.5, 0.5, 1.15);
  if (runW > 0.001) {
    const w = runW;
    // legs
    R(b, 'thighL', -s * A * w, 0, 0); R(b, 'thighR', s * A * w, 0, 0);
    const kL = Math.max(0, c) * 1.25 + 0.15, kR = Math.max(0, -c) * 1.25 + 0.15;
    R(b, 'shinL', kL * w, 0, 0); R(b, 'shinR', kR * w, 0, 0);
    R(b, 'footL', (s * A * 0.6 - kL * 0.55) * w, 0, 0); R(b, 'footR', (-s * A * 0.6 - kR * 0.55) * w, 0, 0);
    // hips bob / sway / twist
    P(b, 'hips', 0, (Math.abs(c) * 0.12 - 0.1) * w * (d.bob ?? 1), 0);
    R(b, 'hips', 0, s * 0.18 * w, s * 0.05 * w);
    R(b, 'chest', 0, -s * 0.28 * w, 0);
    R(b, 'spine', (d.lean ?? 0.18) * w * clamp(speedN, 0.5, 1.3), 0, 0);
    R(b, 'head', -(d.lean ?? 0.18) * 0.6 * w, s * 0.1 * w, 0);
    // arms swing opposite to legs (yield to actions)
    const aw = w * upper * (d.armSwing ?? 0.7);
    R(b, 'armL', s * aw, 0, 0.1 * w * upper); R(b, 'armR', -s * aw, 0, -0.1 * w * upper);
    R(b, 'foreL', -(0.55 + Math.max(0, s) * 0.5) * w * upper, 0, 0); R(b, 'foreR', -(0.55 + Math.max(0, -s) * 0.5) * w * upper, 0, 0);
    if (d.runPose) applyPose(b, d.runPose, w);
    if (b.cape) R(b, 'cape', (0.35 + Math.sin(ph * 2) * 0.08) * w, 0, s * 0.06 * w);
    if (b.coatL) { R(b, 'coatL', (0.45 + Math.sin(ph * 2 + 1) * 0.12) * w, 0, 0); R(b, 'coatR', (0.45 + Math.sin(ph * 2) * 0.12) * w, 0, 0); }
    if (b.tail) R(b, 'tail', 0.5 * w + Math.sin(ph * 2) * 0.12 * w, s * 0.2 * w, 0);
    if (b.hair) R(b, 'hair', (0.5 + Math.sin(ph * 2) * 0.1) * w, s * 0.15 * w, 0);
    if (b.scarf) R(b, 'scarf', (0.9 + Math.sin(ph * 2 + 0.5) * 0.15) * w, s * 0.2 * w, 0);
    if (b.skirt) R(b, 'skirt', 0.15 * w, 0, 0);
  }
  if (runW < 0.999) idleLayer(b, d, st, dt, 1 - runW, upper, time);
}

function floatLoco(b, d, st, dt, runW, upper, time) {
  st.phase += dt * (2.2 + runW * 3);
  const s = Math.sin(st.phase);
  P(b, 'hips', 0, (d.hover ?? 0.35) + Math.sin(time * 2.1) * 0.12, 0);
  if (runW > 0.001) {
    R(b, 'spine', 0.28 * runW, 0, 0); R(b, 'head', -0.18 * runW, 0, 0);
    R(b, 'skirt', 0.55 * runW + s * 0.08 * runW, 0, s * 0.05);
    R(b, 'cape', 0.7 * runW + Math.sin(st.phase * 2) * 0.1 * runW, 0, 0);
    R(b, 'armL', 0.5 * runW * upper, 0, 0.35 * runW * upper); R(b, 'armR', 0.35 * runW * upper, 0, -0.25 * runW * upper);
    R(b, 'hair', 0.5 * runW, 0, 0);
  }
  if (runW < 0.999) idleLayer(b, d, st, dt, 1 - runW, upper, time);
}

function idleLayer(b, d, st, dt, w, upper, time) {
  const br = Math.sin(time * 1.9); // breathing
  R(b, 'chest', -br * 0.035 * w, 0, 0); if (b.chest) { b.chest.scale.x *= 1 + br * 0.015 * w; b.chest.scale.z *= 1 + br * 0.02 * w; }
  P(b, 'hips', Math.sin(time * 0.7) * 0.03 * w, br * 0.015 * w, 0);
  R(b, 'hips', 0, 0, Math.sin(time * 0.7) * 0.03 * w);
  R(b, 'head', Math.sin(time * 1.3) * 0.03 * w, Math.sin(time * 0.53) * 0.22 * w, 0);
  R(b, 'armL', br * 0.03 * w * upper, 0, (0.08 + br * 0.03) * w * upper); R(b, 'armR', br * 0.03 * w * upper, 0, -(0.08 + br * 0.03) * w * upper);
  R(b, 'foreL', -0.15 * w * upper, 0, 0); R(b, 'foreR', -0.15 * w * upper, 0, 0);
  if (b.cape) R(b, 'cape', 0.06 + Math.sin(time * 1.6) * 0.04, 0, Math.sin(time * 1.1) * 0.03);
  if (b.coatL) { R(b, 'coatL', 0.05 + Math.sin(time * 1.7) * 0.03, 0, 0); R(b, 'coatR', 0.05 + Math.sin(time * 1.7 + 1) * 0.03, 0, 0); }
  if (b.tail) R(b, 'tail', Math.sin(time * 1.4) * 0.1, Math.sin(time * 1.1) * 0.25, 0);
  if (b.hair) R(b, 'hair', 0.08 + Math.sin(time * 1.5) * 0.06, Math.sin(time * 1.2) * 0.08, 0);
  if (b.scarf) R(b, 'scarf', 0.3 + Math.sin(time * 1.8) * 0.12, Math.sin(time * 1.3) * 0.2, 0);
  if (d.idlePose) applyPose(b, d.idlePose, w);
  // occasional fidget
  st.idleT += dt * w;
  if (d.fidget && w > 0.9 && !st.act) {
    if (st.fidget < 0 && st.idleT > 6.5) { st.fidget = 0; st.idleT = Math.random() * 2; }
    if (st.fidget >= 0) { st.fidget += dt; const k = st.fidget / (d.fidget.dur || 1.4); const env = Math.sin(sat(k) * PI); applyPose(b, d.fidget.pose, env * w); if (d.fidget.fn) d.fidget.fn(b, k, env); if (k >= 1) st.fidget = -1; }
  } else if (st.fidget >= 0 && w < 0.5) st.fidget = -1;
}

// ───────────────────────────── strike → fx ─────────────────────────────
function onStrike(rig, A) {
  const d = rig.def; const fx = vfxFor(rig.root); if (!fx) return;
  const tipName = A.kind === 'attack' ? (d.muzzle || null) : (d.castFrom?.[A.slot] ?? d.muzzle ?? null);
  if (!tipName) return;
  const bone = rig.bones[tipName]; if (!bone) return;
  bone.updateWorldMatrix(true, false); bone.getWorldPosition(_v);
  const col = rig.colors?.vfx || '#ffffff', col2 = rig.colors?.vfx2 || '#ffffff';
  const g = rig.root.parent; const ang = g ? PI / 2 - g.rotation.y : 0;
  if (d.style === 'rifle' && A.kind === 'attack') fx.muzzleFlash?.(_v.x, _v.y, _v.z, ang, col, col2, 1);
  else if (A.kind === 'attack') fx.castSpark?.(_v.x, _v.y, _v.z, col, col2, 0.6);
  else fx.castSpark?.(_v.x, _v.y, _v.z, col, col2, A.slot === 'r' ? 1.6 : 1);
}

// ───────────────────────────── trails ─────────────────────────────
function updateTrails(rig, on, dt) {
  const d = rig.def; const T = rig.trails || (rig.trails = d.trails.map((t) => new WeaponTrail(rig, t)));
  const g = rig.root.parent; if (g && on) g.updateMatrixWorld(true);
  for (const t of T) t.update(on, dt);
}
function trailWorld(rig, on) { if (rig.def.trails && rig.st) rig.st.dashTrail = on; }

// ───────────────────────────── defaults ─────────────────────────────
const DEFAULT_DASH = { spine: [0.45, 0, 0], head: [-0.3, 0, 0], armL: [0.9, 0, 0.3], armR: [0.9, 0, -0.3], thighL: [-0.6, 0, 0], shinL: [0.9, 0, 0], thighR: [0.5, 0, 0], shinR: [0.6, 0, 0], cape: [1.0, 0, 0], 'hips@p': [0, -0.15, 0] };
const STAGGER = { spine: [-0.35, 0, 0], head: [0.2, 0, 0], armL: [-0.8, 0, 0.6], armR: [-0.8, 0, -0.6], thighL: [-0.3, 0, 0], shinL: [0.4, 0, 0] };
const RECALL = { spine: [0.15, 0, 0], head: [0.35, 0, 0], armL: [-0.9, -0.4, -0.3], armR: [-0.9, 0.4, 0.3], foreL: [-0.9, 0, 0], foreR: [-0.9, 0, 0], 'hips@p': [0, 0.1, 0] };
const DEATH = { 'root@p': [0, 0.18, -0.2], root: [-1.42, 0, 0.12], spine: [-0.15, 0, 0], head: [-0.3, 0.4, 0], armL: [-0.4, 0, 1.3], armR: [-0.6, 0, -1.1], foreL: [-0.3, 0, 0], thighL: [-0.3, 0, 0.15], thighR: [-0.1, 0, -0.2], shinL: [0.6, 0, 0], shinR: [0.3, 0, 0] };
