// Hero model recipes (procedural low-poly) + procedural animation.
import * as THREE from 'three';
import { Rig, G } from './builder.js';
import { ease, clamp, lerp } from '../util.js';
import { getSkin } from '../../data/skins.js';

const PI = Math.PI;

function humanoid(R, o) {
  R.bone('hips', 'root', [0, o.hipY, 0]);
  R.bone('torso', 'hips', [0, 0.02, 0]);
  R.bone('head', 'torso', [0, o.torsoH + (o.neck ?? 0.05), 0]);
  R.bone('armL', 'torso', [o.shoulderX, o.torsoH * 0.9, 0]);
  R.bone('armR', 'torso', [-o.shoulderX, o.torsoH * 0.9, 0]);
  if (!o.noLegs) { R.bone('legL', 'hips', [o.hipX, 0, 0]); R.bone('legR', 'hips', [-o.hipX, 0, 0]); }
}
function limbs(R, c, o) {
  // arms hanging along -Y, legs hanging along -Y
  const al = o.armLen, ar = o.armR;
  for (const s of ['armL', 'armR']) {
    R.add(s, G.cyl(ar, ar * 0.85, al * 0.55, 5), o.sleeve ?? o.body, { p: [0, -al * 0.27, 0] });
    R.add(s, G.cyl(ar * 0.85, ar * 0.75, al * 0.5, 5), o.forearm ?? o.skin, { p: [0, -al * 0.72, 0] });
    R.add(s, G.ico(ar * 1.15, 0), o.hand ?? o.skin, { p: [0, -al, 0] });
  }
  if (o.noLegs) return;
  const ll = o.hipY, lr = o.legR;
  for (const s of ['legL', 'legR']) {
    R.add(s, G.cyl(lr, lr * 0.8, ll * 0.6, 5), o.legs ?? o.body, { p: [0, -ll * 0.3, 0] });
    R.add(s, G.cyl(lr * 0.85, lr * 0.9, ll * 0.45, 5), o.boots ?? o.legs ?? o.body, { p: [0, -ll * 0.75, 0] });
    R.add(s, G.box(lr * 2.1, lr * 1.1, lr * 3), o.boots ?? o.legs ?? o.body, { p: [0, -ll + lr * 0.5, lr * 0.6] });
  }
}

// ───────────────────────────────────────────────── BRAM
function bram(c, p) {
  const R = new Rig();
  const o = { hipY: 1.25, torsoH: 1.55, shoulderX: 1.15, hipX: 0.5, armLen: 1.7, armR: 0.3, legR: 0.36, body: c.primary, skin: c.skin, legs: c.secondary, boots: c.skin, sleeve: c.primary, forearm: c.secondary, hand: c.skin };
  humanoid(R, o); limbs(R, c, o);
  // trunk torso
  R.add('torso', G.cyl(1.0, 0.72, o.torsoH, 7), c.primary, { p: [0, o.torsoH / 2, 0] });
  R.add('torso', G.cyl(0.78, 0.62, 0.35, 7), c.secondary, { p: [0, 0.05, 0] });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + 0.3; R.add('torso', G.box(0.32, 1.0 - (i % 2) * 0.3, 0.18), c.secondary, { p: [Math.sin(a) * 0.9, 0.85, Math.cos(a) * 0.9], r: [0.1, a, 0.05 * (i - 3)] }); }
  // moss belly / runes
  R.add('torso', G.ico(0.42, 0), c.accent, { p: [0.45, o.torsoH - 0.05, 0.55], s: [1, 0.5, 1] });
  R.add('torso', G.box(0.12, 0.5, 0.05), c.glow, { p: [0, 0.9, 0.98], glow: true });
  R.add('torso', G.box(0.4, 0.1, 0.05), c.glow, { p: [0, 1.05, 0.97], glow: true });
  if (p.shield === 'magma') for (let i = 0; i < 5; i++) R.add('torso', G.box(0.08, 0.6, 0.05), c.glow, { p: [Math.sin(i * 1.3) * 0.75, 0.55 + (i % 2) * 0.4, Math.cos(i * 1.3) * 0.75], r: [0, i * 1.3, 0.4 * (i % 3 - 1)], glow: true });
  // pauldrons (mossy boulders)
  for (const sx of [1, -1]) {
    R.add('torso', G.dodec(0.62), c.metal, { p: [sx * 1.05, o.torsoH - 0.05, 0], s: [1.1, 0.75, 1] });
    R.add('torso', G.ico(0.38, 0), c.accent, { p: [sx * 1.1, o.torsoH + 0.3, -0.05], s: [1.2, 0.6, 1.1] });
  }
  // head: stump with glowing eyes, sunk in shoulders
  R.add('head', G.cyl(0.42, 0.5, 0.65, 6), c.secondary, { p: [0, 0.15, 0.2] });
  R.add('head', G.box(0.7, 0.18, 0.35), c.primary, { p: [0, 0.35, 0.42] });
  R.add('head', G.box(0.14, 0.09, 0.05), c.glow, { p: [0.16, 0.2, 0.68], glow: true });
  R.add('head', G.box(0.14, 0.09, 0.05), c.glow, { p: [-0.16, 0.2, 0.68], glow: true });
  R.add('head', G.cone(0.25, 0.35, 5), c.secondary, { p: [0, -0.05, 0.62], r: [1.9, 0, 0] }); // beard-root
  // crown
  if (p.crown === 'icicles') for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2; R.add('head', G.cone(0.1, 0.6 + (i % 3) * 0.2, 4), c.accent, { p: [Math.sin(a) * 0.35, 0.65, Math.cos(a) * 0.35 + 0.2], r: [Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4] }); }
  else if (p.crown === 'horns') for (const sx of [1, -1]) { R.add('head', G.cone(0.14, 0.9, 5), c.primary, { p: [sx * 0.42, 0.6, 0.15], r: [-0.3, 0, -sx * 0.6] }); R.add('head', G.cone(0.07, 0.4, 4), c.glow, { p: [sx * 0.62, 1.0, 0.05], r: [-0.3, 0, -sx * 0.6], glow: true }); }
  else {
    const n = p.crown === 'blossom' ? 6 : 5;
    for (let i = 0; i < n; i++) { const a = i / n * PI * 2; R.add('head', G.ico(0.3, 0), c.accent, { p: [Math.sin(a) * 0.32, 0.62 + (i % 2) * 0.12, Math.cos(a) * 0.32 + 0.1] }); }
    if (p.crown === 'blossom') for (let i = 0; i < 4; i++) R.add('head', G.ico(0.12, 0), '#ffffff', { p: [Math.sin(i * 1.7) * 0.4, 0.85, Math.cos(i * 1.7) * 0.4 + 0.1] });
  }
  // back branches
  for (const sx of [1, -1]) {
    R.add('torso', G.cyl(0.06, 0.12, 1.1, 4), c.primary, { p: [sx * 0.5, o.torsoH + 0.35, -0.55], r: [-0.4, 0, -sx * 0.35] });
    R.add('torso', G.ico(0.3, 0), p.crown === 'horns' ? c.glow : c.accent, { p: [sx * 0.72, o.torsoH + 0.9, -0.8], glow: p.crown === 'horns' });
  }
  // big fists
  for (const s of ['armL', 'armR']) R.add(s, G.dodec(0.42), c.skin, { p: [0, -o.armLen - 0.1, 0] });
  // shield on left arm
  const sp = { p: [0.32, -1.05, 0.15], r: [0, PI / 2, 0] };
  if (p.shield === 'crystal') { R.add('armL', G.oct(0.85), c.metal, { ...sp, s: [0.35, 1.2, 1] }); R.add('armL', G.oct(0.35), c.glow, { p: [0.55, -1.05, 0.15], glow: true, s: [0.4, 1, 1] }); }
  else if (p.shield === 'flower') { R.add('armL', G.cyl(0.8, 0.8, 0.14, 8), c.metal, { p: [0.36, -1.05, 0.15], r: [0, 0, PI / 2] }); for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; R.add('armL', G.ico(0.3, 0), c.accent, { p: [0.46, -1.05 + Math.sin(a) * 0.55, 0.15 + Math.cos(a) * 0.55], s: [0.4, 1, 1] }); } R.add('armL', G.ico(0.22, 0), c.glow, { p: [0.5, -1.05, 0.15], glow: true }); }
  else { // stone / magma slab
    R.add('armL', G.dodec(0.85), c.metal, { ...sp, s: [1, 1.25, 0.32] });
    R.add('armL', G.box(0.1, 0.7, 0.1), c.glow, { p: [0.62, -1.05, 0.15], glow: true });
    R.add('armL', G.box(0.1, 0.1, 0.5), c.glow, { p: [0.62, -0.95, 0.15], glow: true });
    R.add('armL', G.ico(0.25, 0), c.accent, { p: [0.45, -0.4, 0.2], s: [1, 0.5, 1] });
  }
  return { R, scale: 1.0, height: 3.9, style: 'smash', runFreq: 7, lean: 0.12 };
}

// ───────────────────────────────────────────────── KAELA
function kaela(c, p) {
  const R = new Rig();
  const o = { hipY: 1.05, torsoH: 0.85, shoulderX: 0.4, hipX: 0.18, armLen: 0.9, armR: 0.1, legR: 0.13, body: c.primary, skin: c.skin, legs: c.secondary, boots: c.secondary, sleeve: c.skin, forearm: c.primary };
  humanoid(R, o); limbs(R, c, o);
  R.add('torso', G.cyl(0.32, 0.24, o.torsoH, 6), c.primary, { p: [0, o.torsoH / 2, 0], s: [1, 1, 0.75] });
  R.add('torso', G.cyl(0.27, 0.3, 0.18, 6), c.secondary, { p: [0, 0.05, 0] });
  R.add('hips', G.cone(0.42, 0.55, 6), c.primary, { p: [0, -0.15, 0], r: [PI, 0, 0] });
  R.add('torso', G.box(0.12, 0.7, 0.06), p.blades === 'sun' ? c.secondary : c.hair, { p: [0.15, 0.08, -0.25], r: [0, 0, 0.2] }); // sash tail
  for (const sx of [1, -1]) R.add('torso', G.ico(0.17, 0), c.metal, { p: [sx * 0.38, o.torsoH - 0.02, 0], s: [1.2, 0.8, 1] });
  // head
  R.add('head', G.ico(0.28, 1), c.skin, { p: [0, 0.22, 0] });
  R.add('head', G.ico(0.3, 0), c.hair, { p: [0, 0.32, -0.06], s: [1.05, 0.9, 1.05] });
  R.add('head', G.box(0.07, 0.05, 0.02), '#2a1a1a', { p: [0.1, 0.24, 0.26] });
  R.add('head', G.box(0.07, 0.05, 0.02), '#2a1a1a', { p: [-0.1, 0.24, 0.26] });
  if (p.hair === 'bun') { R.add('head', G.ico(0.15, 0), c.hair, { p: [0, 0.6, -0.08] }); R.add('head', G.cyl(0.015, 0.015, 0.5, 3), c.metal, { p: [0, 0.6, -0.08], r: [0, 0, 1.3] }); }
  else if (p.hair === 'crown') { R.add('head', G.cone(0.16, 0.8, 5), c.hair, { p: [0, 0.2, -0.38], r: [-2.4, 0, 0] }); for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.2; R.add('head', G.cone(0.05, 0.38 - Math.abs(i - 3) * 0.05, 3), c.glow, { p: [Math.sin(a) * 0.3, 0.55 + Math.cos(a) * 0.12, Math.cos(a) * 0.05 - 0.05], r: [0, 0, -a * 0.6], glow: true }); } }
  else { R.add('head', G.cone(0.14, 0.9, 5), c.hair, { p: [0, 0.25, -0.42], r: [-2.5, 0, 0] }); R.add('head', G.cone(0.08, 0.35, 4), c.glow, { p: [0, 0.0, -0.7], r: [-2.8, 0, 0], glow: true }); }
  // blades in each hand, pointing forward
  for (const [s, sx] of [['armL', 1], ['armR', -1]]) {
    const h = { p: [0, -o.armLen - 0.02, 0.08], r: [PI / 2, 0, 0] };
    R.add(s, G.cyl(0.04, 0.04, 0.28, 4), c.secondary, { p: [0, -o.armLen, 0], r: [PI / 2, 0, 0] });
    if (p.blades === 'katana') { R.add(s, G.box(0.05, 1.5, 0.12), c.metal, { p: [0, -o.armLen, 0.85], r: [PI / 2, 0, 0] }); R.add(s, G.box(0.02, 1.3, 0.05), c.glow, { p: [0, -o.armLen + 0.06, 0.85], r: [PI / 2, 0, 0], glow: true }); R.add(s, G.cyl(0.1, 0.1, 0.04, 6), c.secondary, { p: [0, -o.armLen, 0.15], r: [PI / 2, 0, 0] }); }
    else if (p.blades === 'sun') { R.add(s, G.blade(1.2, 0.26, 0.06, 0.12), c.metal, { p: h.p, r: [PI / 2, 0, 0] }); R.add(s, G.torus(0.16, 0.04, 3, 8), c.glow, { p: [0, -o.armLen, 0.14], glow: true }); R.add(s, G.blade(1.0, 0.1, 0.07, 0.08), c.glow, { p: [0, -o.armLen + 0.02, 0.18], r: [PI / 2, 0, 0], glow: true }); }
    else { R.add(s, G.blade(1.05, 0.22, 0.05, 0.18 * sx), c.metal, { p: h.p, r: [PI / 2, 0, 0] }); R.add(s, G.blade(0.9, 0.12, 0.07, 0.12 * sx), c.glow, { p: [0, -o.armLen + 0.04, 0.12], r: [PI / 2, 0, 0], glow: true }); }
  }
  return { R, scale: 1.0, height: 2.7, style: 'dual', runFreq: 11, lean: 0.25 };
}

// ───────────────────────────────────────────────── LUMI
function lumi(c, p) {
  const R = new Rig();
  const o = { hipY: 1.35, torsoH: 0.75, shoulderX: 0.34, hipX: 0.15, armLen: 0.8, armR: 0.09, noLegs: true, body: c.primary, skin: c.skin, sleeve: c.primary, forearm: c.secondary };
  humanoid(R, o); limbs(R, c, o);
  // flowing gown (no legs) + open cloak
  R.add('hips', G.cone(0.6, 1.35, 7), c.secondary, { p: [0, -0.55, 0], r: [PI, 0, 0] });
  R.add('hips', G.cone(0.25, 0.4, 7), c.glow, { p: [0, -1.25, 0], r: [PI, 0, 0], glow: true });
  R.add('torso', G.cyl(0.26, 0.22, o.torsoH, 6), c.secondary, { p: [0, o.torsoH / 2, 0] });
  R.add('torso', G.cone(0.75, 1.9, 7, 1), c.primary, { p: [0, -0.15, -0.18], s: [1, 1, 0.55] });
  R.add('torso', G.torus(0.3, 0.07, 3, 8), c.metal, { p: [0, o.torsoH - 0.05, 0], r: [PI / 2, 0, 0] });
  R.add('torso', G.oct(0.09), c.glow, { p: [0, o.torsoH - 0.12, 0.28], glow: true });
  // head
  R.add('head', G.ico(0.27, 1), c.skin, { p: [0, 0.2, 0] });
  R.add('head', G.ico(0.33, 0), c.hair, { p: [0, 0.28, -0.1], s: [1.05, 1, 1.1] });
  R.add('head', G.cone(0.22, 0.75, 5), c.hair, { p: [0, -0.1, -0.25], r: [-0.2, 0, 0] });
  R.add('head', G.box(0.07, 0.07, 0.02), '#2a2050', { p: [0.1, 0.22, 0.25] });
  R.add('head', G.box(0.07, 0.07, 0.02), '#2a2050', { p: [-0.1, 0.22, 0.25] });
  if (p.hat === 'tiara') { R.add('head', G.torus(0.28, 0.03, 3, 10, PI), c.metal, { p: [0, 0.35, 0.03], r: [-0.4, 0, 0] }); R.add('head', G.oct(0.07), c.glow, { p: [0, 0.6, 0.15], glow: true }); }
  else if (p.hat === 'halo') { R.add('head', G.torus(0.42, 0.035, 3, 14), c.glow, { p: [0, 0.75, -0.1], r: [PI / 2 - 0.3, 0, 0], glow: true }); R.add('head', G.star(0.13, 0.05, 0.03), c.glow, { p: [0, 0.48, 0.24], glow: true }); }
  else { R.add('head', G.cone(0.42, 0.75, 6), c.primary, { p: [0, 0.6, -0.12], r: [-0.35, 0, 0] }); R.add('head', G.oct(0.07), c.glow, { p: [0, 1.0, -0.3], glow: true }); }
  // staff in right hand (vertical)
  R.bone('staff', 'armR', [0, -o.armLen, 0.05]);
  R.add('staff', G.cyl(0.04, 0.05, 2.6, 5), c.metal, { p: [0, 0.4, 0] });
  R.bone('staffTop', 'staff', [0, 1.85, 0]);
  if (p.staff === 'moon') { R.add('staffTop', G.torus(0.3, 0.07, 3, 10, PI * 1.3), c.glow, { r: [0, 0, 0.4], glow: true }); }
  else if (p.staff === 'tristar') { for (let i = 0; i < 3; i++) R.add('staffTop', G.star(0.18, 0.07, 0.06), c.glow, { p: [Math.sin(i * 2.1) * 0.25, Math.cos(i * 2.1) * 0.25, 0], glow: true }); }
  else if (p.staff === 'galaxy') { R.add('staffTop', G.torus(0.38, 0.03, 3, 14), c.vfx2, { r: [PI / 2 - 0.4, 0, 0], glow: true }); R.add('staffTop', G.star(0.26, 0.1, 0.08), c.glow, { glow: true }); R.add('staffTop', G.ico(0.1, 0), c.vfx2, { glow: true }); }
  else { R.add('staffTop', G.star(0.3, 0.12, 0.1), c.glow, { glow: true }); R.add('staffTop', G.torus(0.18, 0.03, 3, 8), c.metal, { p: [0, -0.35, 0], r: [PI / 2, 0, 0] }); }
  // orbiting star
  R.bone('orbit', 'staffTop', [0, 0, 0]);
  R.add('orbit', G.star(0.12, 0.05, 0.05), c.vfx2 || c.glow, { p: [0.55, 0, 0], glow: true });
  return { R, scale: 1.0, height: 3.0, style: 'staff', float: true, runFreq: 6, lean: 0.15 };
}

// ───────────────────────────────────────────────── VEX
function vex(c, p) {
  const R = new Rig();
  const o = { hipY: 1.1, torsoH: 0.85, shoulderX: 0.38, hipX: 0.17, armLen: 0.85, armR: 0.1, legR: 0.13, body: c.primary, skin: c.skin, legs: '#3a3030', boots: '#2a2020', sleeve: c.primary, forearm: c.primary };
  humanoid(R, o); limbs(R, c, o);
  R.add('torso', G.cyl(0.32, 0.27, o.torsoH, 6), c.primary, { p: [0, o.torsoH / 2, 0], s: [1, 1, 0.8] });
  R.add('hips', G.cone(0.45, 0.85, 6), c.primary, { p: [0, -0.3, -0.05], r: [PI, 0, 0], s: [1, 1, 0.8] }); // coat tails
  R.add('torso', G.box(0.62, 0.08, 0.5), c.wood, { p: [0, 0.1, 0] }); // belt
  R.add('torso', G.box(0.1, 0.1, 0.05), c.glow, { p: [0, 0.1, 0.26], glow: true });
  // scarf
  R.add('torso', G.torus(0.2, 0.1, 4, 8), c.secondary, { p: [0, o.torsoH, 0], r: [PI / 2, 0, 0] });
  R.add('torso', G.box(0.16, 0.7, 0.05), c.secondary, { p: [0.15, o.torsoH - 0.3, -0.28], r: [-0.4, 0, 0.15] });
  R.add('torso', G.box(0.14, 0.55, 0.05), c.secondary, { p: [0.0, o.torsoH - 0.3, -0.3], r: [-0.5, 0, -0.1] });
  // head
  R.add('head', G.ico(0.27, 1), c.skin, { p: [0, 0.2, 0] });
  R.add('head', G.ico(0.29, 0), c.hair, { p: [0, 0.27, -0.07], s: [1, 0.9, 1] });
  R.add('head', G.cone(0.13, 0.55, 4), c.hair, { p: [0, 0.05, -0.3], r: [-2.7, 0, 0] });
  if (p.hat === 'visor') {
    R.add('head', G.box(0.55, 0.1, 0.12), c.glow, { p: [0, 0.24, 0.2], glow: true });
    for (let i = 0; i < 4; i++) R.add('head', G.cone(0.1, 0.45, 4), c.hair, { p: [(i - 1.5) * 0.12, 0.5, -0.05 - i * 0.03], r: [-0.6, 0, (i - 1.5) * 0.2] });
  } else {
    R.add('head', G.box(0.06, 0.05, 0.02), '#1a1010', { p: [0.1, 0.22, 0.26] });
    R.add('head', G.box(0.06, 0.05, 0.02), '#1a1010', { p: [-0.1, 0.22, 0.26] });
    if (p.hat === 'wide') { R.add('head', G.cyl(0.7, 0.7, 0.05, 9), c.primary, { p: [0, 0.42, 0] }); R.add('head', G.cyl(0.25, 0.3, 0.3, 7), c.primary, { p: [0, 0.58, 0] }); R.add('head', G.cyl(0.3, 0.3, 0.07, 7), c.secondary, { p: [0, 0.47, 0] }); }
    else if (p.hat === 'dragon') { R.add('head', G.cyl(0.3, 0.33, 0.25, 6), c.wood, { p: [0, 0.45, 0] }); for (const sx of [1, -1]) { R.add('head', G.cone(0.09, 0.7, 4), c.wood, { p: [sx * 0.25, 0.75, -0.15], r: [-0.7, 0, -sx * 0.4] }); } R.add('head', G.cone(0.15, 0.3, 4), c.wood, { p: [0, 0.42, 0.32], r: [PI / 2, 0, 0] }); R.add('head', G.box(0.4, 0.06, 0.05), c.glow, { p: [0, 0.38, 0.29], glow: true }); }
    else { R.add('head', G.cyl(0.55, 0.55, 0.06, 3), c.primary, { p: [0, 0.42, 0], r: [0, PI / 6 + PI, 0] }); R.add('head', G.cyl(0.25, 0.3, 0.32, 6), c.primary, { p: [0, 0.6, 0] }); R.add('head', G.box(0.3, 0.06, 0.06), c.metal, { p: [0, 0.5, 0.28] }); R.add('head', G.cone(0.06, 0.4, 3), c.secondary, { p: [-0.2, 0.75, -0.1], r: [-0.4, 0, 0.6] }); }
  }
  // rifle held at chest
  R.bone('gun', 'torso', [-0.15, o.torsoH * 0.55, 0.3]);
  if (p.rifle === 'neon') {
    R.add('gun', G.box(0.16, 0.22, 1.0), c.wood, { p: [0, 0, 0.1] });
    R.add('gun', G.box(0.1, 0.1, 1.5), c.metal, { p: [0, 0.03, 1.2] });
    R.add('gun', G.box(0.04, 0.04, 2.0), c.glow, { p: [0.07, 0.05, 0.9], glow: true });
    R.add('gun', G.box(0.04, 0.04, 2.0), c.vfx2, { p: [-0.07, 0.05, 0.9], glow: true });
    R.add('gun', G.cyl(0.08, 0.08, 0.5, 6), c.metal, { p: [0, 0.2, 0.5], r: [PI / 2, 0, 0] });
    R.add('gun', G.cyl(0.06, 0.06, 0.03, 6), c.glow, { p: [0, 0.2, 0.76], r: [PI / 2, 0, 0], glow: true });
  } else if (p.rifle === 'dragon') {
    R.add('gun', G.box(0.18, 0.25, 0.9), c.wood, { p: [0, -0.02, 0] });
    R.add('gun', G.cyl(0.07, 0.11, 1.6, 6), c.wood, { p: [0, 0.03, 1.2], r: [PI / 2, 0, 0] });
    for (let i = 0; i < 5; i++) R.add('gun', G.cone(0.05, 0.22, 3), c.wood, { p: [0, 0.16, 0.6 + i * 0.28], r: [-0.4, 0, 0] });
    R.add('gun', G.cone(0.18, 0.45, 5), c.metal, { p: [0, 0.03, 2.1], r: [PI / 2, 0, 0] });
    R.add('gun', G.ico(0.1, 0), c.glow, { p: [0, 0.03, 2.05], glow: true });
    R.add('gun', G.cone(0.05, 0.3, 3), c.wood, { p: [0.12, 0.15, 1.9], r: [-0.8, 0, -0.5] });
    R.add('gun', G.cone(0.05, 0.3, 3), c.wood, { p: [-0.12, 0.15, 1.9], r: [-0.8, 0, 0.5] });
  } else {
    R.add('gun', G.box(0.16, 0.22, 0.95), c.wood, { p: [0, -0.02, 0.05] });
    R.add('gun', G.cyl(0.055, 0.055, 2.0, 5), c.metal, { p: [0, 0.05, 1.4], r: [PI / 2, 0, 0] });
    R.add('gun', G.cyl(0.08, 0.08, 0.15, 5), c.metal, { p: [0, 0.05, 2.35], r: [PI / 2, 0, 0] });
    R.add('gun', G.cyl(0.07, 0.07, 0.55, 6), c.metal, { p: [0, 0.22, 0.55], r: [PI / 2, 0, 0] });
    R.add('gun', G.cyl(0.05, 0.05, 0.02, 6), c.glow, { p: [0, 0.22, 0.83], r: [PI / 2, 0, 0], glow: true });
    R.add('gun', G.box(0.06, 0.06, 0.2), c.secondary, { p: [0, -0.1, 0.6] });
  }
  return { R, scale: 1.0, height: 2.8, style: 'shoot', runFreq: 10, lean: 0.18, armsRest: { armR: [-1.2, 0, 0.3], armL: [-1.25, 0, -0.55] } };
}

// ───────────────────────────────────────────────── NYX
function nyx(c, p) {
  const R = new Rig();
  const o = { hipY: 1.0, torsoH: 0.8, shoulderX: 0.34, hipX: 0.16, armLen: 0.85, armR: 0.09, legR: 0.12, body: c.primary, skin: c.skin, legs: c.primary, boots: c.secondary, sleeve: c.primary, forearm: c.secondary };
  humanoid(R, o); limbs(R, c, o);
  R.add('torso', G.cyl(0.29, 0.22, o.torsoH, 6), c.primary, { p: [0, o.torsoH / 2, 0], s: [1, 1, 0.8] });
  R.add('torso', G.box(0.5, 0.06, 0.38), c.secondary, { p: [0, 0.3, 0], r: [0, 0, 0.3] });
  // tattered cloak
  R.add('torso', G.cone(0.6, 1.5, 6, 1), c.primary, { p: [0, 0.05, -0.2], s: [1, 1, 0.5] });
  for (let i = 0; i < 5; i++) R.add('torso', G.tet(0.16), c.primary, { p: [(i - 2) * 0.22, -0.75, -0.3 - Math.abs(i - 2) * 0.03], r: [0.3, i, 0.6] });
  R.add('torso', G.box(0.06, 0.8, 0.04), c.glow, { p: [0, 0.3, 0.24], glow: true });
  // hood
  R.add('head', G.ico(0.26, 1), c.skin, { p: [0, 0.2, 0.02] });
  R.add('head', G.cone(0.4, 0.85, 6), c.primary, { p: [0, 0.42, -0.08], r: [-0.25, 0, 0] });
  R.add('head', G.box(0.42, 0.2, 0.06), c.secondary, { p: [0, 0.12, 0.27] }); // mask
  R.add('head', G.box(0.1, 0.04, 0.03), c.glow, { p: [0.09, 0.25, 0.27], glow: true });
  R.add('head', G.box(0.1, 0.04, 0.03), c.glow, { p: [-0.09, 0.25, 0.27], glow: true });
  if (p.hood === 'horns') for (const sx of [1, -1]) { R.add('head', G.cone(0.08, 0.7, 4), c.secondary, { p: [sx * 0.25, 0.55, -0.05], r: [-0.5, 0, -sx * 0.5] }); R.add('head', G.oct(0.06), c.glow, { p: [sx * 0.45, 0.85, -0.2], glow: true }); }
  if (p.hood === 'moon') R.add('head', G.torus(0.18, 0.04, 3, 8, PI * 1.2), c.glow, { p: [0, 0.65, 0.05], r: [0, 0, -0.6], glow: true });
  // daggers, reverse grip pointing down/back
  for (const [s, sx] of [['armL', 1], ['armR', -1]]) {
    R.add(s, G.cyl(0.035, 0.035, 0.22, 4), c.secondary, { p: [0, -o.armLen, 0.02], r: [PI / 2, 0, 0] });
    if (p.blades === 'crescent') { R.add(s, G.torus(0.38, 0.05, 3, 10, PI * 0.9), c.metal, { p: [0, -o.armLen - 0.05, 0.25], r: [0, PI / 2, -PI / 2] }); R.add(s, G.torus(0.38, 0.015, 3, 10, PI * 0.9), c.glow, { p: [sx * 0.04, -o.armLen - 0.05, 0.25], r: [0, PI / 2, -PI / 2], glow: true }); }
    else if (p.blades === 'void') { R.add(s, G.blade(0.95, 0.24, 0.06, 0.1), c.glow, { p: [0, -o.armLen, 0.12], r: [PI / 2 + 0.5, 0, 0], glow: true }); R.add(s, G.oct(0.09), c.vfx2, { p: [0, -o.armLen, 0.02], glow: true }); }
    else { R.add(s, G.blade(0.75, 0.16, 0.05, 0.05), c.metal, { p: [0, -o.armLen, 0.12], r: [PI / 2 + 0.5, 0, 0] }); R.add(s, G.box(0.02, 0.5, 0.02), c.glow, { p: [0, -o.armLen - 0.2, 0.42], r: [PI / 2 + 0.5, 0, 0], glow: true }); }
  }
  // shadow wisps
  R.bone('wisps', 'root', [0, 1.3, 0]);
  for (let i = 0; i < 3; i++) R.add('wisps', G.ico(0.09, 0), c.glow, { p: [Math.cos(i * 2.1) * 0.75, (i - 1) * 0.3, Math.sin(i * 2.1) * 0.75], glow: true });
  return { R, scale: 1.0, height: 2.6, style: 'dual', runFreq: 12, lean: 0.38, crouch: 0.12 };
}

// ───────────────────────────────────────────────── PIP & BOLT
function pipHat(R, c, p) {
  if (p.hat === 'helmet') { R.add('head', G.ico(0.45, 1), '#bff4ff', { p: [0, 0.12, 0], s: [1, 1, 1] }); R.add('head', G.torus(0.42, 0.06, 4, 10), c.primary, { p: [0, -0.15, 0], r: [PI / 2, 0, 0] }); R.add('head', G.ico(0.06, 0), c.glow, { p: [0.3, 0.45, 0], glow: true }); }
  else if (p.hat === 'beanie') { R.add('head', G.ico(0.3, 0), c.primary, { p: [0, 0.28, -0.03], s: [1.05, 0.75, 1.05] }); R.add('head', G.ico(0.12, 0), '#ffffff', { p: [0, 0.55, -0.03] }); R.add('head', G.box(0.32, 0.08, 0.05), c.glow, { p: [0, 0.2, 0.27], glow: true }); }
  else { R.add('head', G.cone(0.32, 0.65, 6), c.hair, { p: [0, 0.48, -0.08], r: [-0.25, 0, 0] }); R.add('head', G.torus(0.22, 0.06, 4, 8), c.metal, { p: [0, 0.28, 0.08], r: [0.3, 0, 0] }); R.add('head', G.cyl(0.08, 0.08, 0.06, 6), c.glow, { p: [0.11, 0.33, 0.27], r: [PI / 2 - 0.3, 0, 0], glow: true }); R.add('head', G.cyl(0.08, 0.08, 0.06, 6), c.glow, { p: [-0.11, 0.33, 0.27], r: [PI / 2 - 0.3, 0, 0], glow: true }); }
}
// Pip on foot (in-game: Bolt is a separate summon)
function pipPilot(c, p) {
  const R = new Rig();
  const o = { hipY: 0.6, torsoH: 0.55, shoulderX: 0.3, hipX: 0.13, armLen: 0.5, armR: 0.08, legR: 0.1, body: c.primary, skin: c.skin, legs: c.mech2, boots: '#3a2a20', sleeve: c.primary, forearm: c.skin };
  humanoid(R, o); limbs(R, c, o);
  R.add('torso', G.cyl(0.3, 0.34, o.torsoH, 7), c.primary, { p: [0, o.torsoH / 2, 0] });
  R.add('torso', G.box(0.62, 0.08, 0.5), '#5a3a20', { p: [0, 0.08, 0] });
  R.add('torso', G.box(0.4, 0.42, 0.26), c.mech, { p: [0, 0.32, -0.32] });
  R.add('torso', G.cyl(0.02, 0.02, 0.55, 4), c.metal, { p: [0.12, 0.75, -0.36] });
  R.add('torso', G.ico(0.07, 0), c.glow, { p: [0.12, 1.04, -0.36], glow: true });
  R.add('head', G.ico(0.34, 1), c.skin, { p: [0, 0.18, 0] });
  R.add('head', G.cone(0.08, 0.16, 4), c.skin, { p: [0, 0.14, 0.34], r: [PI / 2, 0, 0] });
  R.add('head', G.ico(0.22, 0), c.hair, { p: [0, -0.02, 0.14], s: [1.4, 0.75, 1] });
  pipHat({ add: (b, g, col, oo) => { const pp = oo.p || [0, 0, 0]; const sc = oo.s === undefined ? [1, 1, 1] : typeof oo.s === 'number' ? [oo.s, oo.s, oo.s] : oo.s; R.add('head', g, col, { ...oo, p: [pp[0] * 1.1, pp[1] * 1.1 + 0.08, pp[2] * 1.1], s: sc.map((v) => v * 1.1) }); } }, c, p);
  R.add('armR', G.cyl(0.04, 0.04, 0.7, 4), c.metal, { p: [0, -o.armLen, 0.3], r: [PI / 2, 0, 0] });
  R.add('armR', G.torus(0.13, 0.05, 3, 8, PI * 1.4), c.metal, { p: [0, -o.armLen, 0.7], r: [0, PI / 2, 0.7] });
  return { R, scale: 1.35, height: 2.3, style: 'staff', runFreq: 13, lean: 0.2 };
}
function pip(c, p, variant) {
  if (variant === 'pilot') return pipPilot(c, p);
  const mechOnly = variant === 'mech';
  const R = new Rig();
  R.bone('hips', 'root', [0, 0.95, 0]);
  R.bone('torso', 'hips', [0, 0, 0]);
  R.bone('legL', 'hips', [0.5, 0, 0]); R.bone('legR', 'hips', [-0.5, 0, 0]);
  R.bone('armL', 'torso', [0.95, 1.05, 0.05]); R.bone('armR', 'torso', [-0.95, 1.05, 0.05]);
  R.bone('pip', 'torso', [0, 1.55, -0.1]);
  const sleek = p.mech === 'sleek', rusty = p.mech === 'rusty';
  if (sleek) { R.add('torso', G.ico(0.85, 1), c.mech, { p: [0, 0.75, 0], s: [1.05, 0.9, 0.9] }); R.add('torso', G.cyl(0.55, 0.65, 0.2, 10), c.mech2, { p: [0, 1.45, -0.1] }); }
  else { R.add('torso', G.box(1.55, 1.25, 1.25), c.mech, { p: [0, 0.75, 0] }); R.add('torso', G.box(1.35, 0.2, 1.1), c.mech2, { p: [0, 1.45, -0.05] }); R.add('torso', G.box(1.6, 0.15, 1.3), c.mech2, { p: [0, 0.2, 0] }); }
  R.add('torso', G.box(0.8, 0.22, 0.1), c.glow, { p: [0, 0.95, sleek ? 0.82 : 0.64], glow: true });
  R.add('torso', G.cyl(0.18, 0.18, 0.1, 8), c.metal, { p: [0.45, 0.45, sleek ? 0.75 : 0.64], r: [PI / 2, 0, 0] });
  if (rusty) { R.add('torso', G.box(0.4, 0.35, 0.05), '#8a8a7a', { p: [-0.4, 0.4, 0.64], r: [0, 0, 0.2] }); R.add('torso', G.box(0.3, 0.06, 0.06), '#d8c8a0', { p: [0.3, 1.2, 0.64], r: [0, 0, -0.4] }); }
  R.add('torso', G.cyl(0.03, 0.03, 0.7, 4), c.metal, { p: [0.55, 1.8, -0.4] });
  R.add('torso', G.ico(0.09, 0), c.glow, { p: [0.55, 2.18, -0.4], glow: true });
  R.add('torso', G.box(0.5, 0.5, 0.4), c.mech2, { p: [0, 0.8, -0.75] });
  R.add('torso', G.cyl(0.12, 0.16, 0.3, 6), c.metal, { p: [0.18, 1.15, -0.85] });
  R.add('torso', G.cyl(0.12, 0.16, 0.3, 6), c.metal, { p: [-0.18, 1.15, -0.85] });
  for (const s of ['legL', 'legR']) { R.add(s, G.box(0.38, 0.6, 0.42), c.mech2, { p: [0, -0.35, 0] }); R.add(s, G.box(0.55, 0.3, 0.75), c.mech, { p: [0, -0.8, 0.1] }); }
  R.add('armL', G.ico(0.32, 0), c.mech2, {});
  R.add('armL', G.box(0.38, 0.75, 0.38), c.mech, { p: [0.05, -0.45, 0] });
  R.add('armL', G.cyl(0.2, 0.24, 0.65, 7), c.metal, { p: [0.05, -0.85, 0.25], r: [PI / 2, 0, 0] });
  R.add('armL', G.cyl(0.13, 0.13, 0.05, 7), c.glow, { p: [0.05, -0.85, 0.58], r: [PI / 2, 0, 0], glow: true });
  R.add('armR', G.ico(0.32, 0), c.mech2, {});
  R.add('armR', G.box(0.38, 0.75, 0.38), c.mech, { p: [-0.05, -0.45, 0] });
  R.add('armR', G.box(0.12, 0.4, 0.12), c.metal, { p: [0.1, -1.0, 0.1], r: [0.3, 0, 0.3] });
  R.add('armR', G.box(0.12, 0.4, 0.12), c.metal, { p: [-0.18, -1.0, 0.1], r: [0.3, 0, -0.3] });
  if (mechOnly) { R.add('pip', G.box(0.6, 0.12, 0.5), c.mech2, { p: [0, 0.05, 0] }); R.add('pip', G.ico(0.14, 0), c.glow, { p: [0, 0.2, 0], glow: true }); return { R, scale: 1.0, height: 2.4, style: 'mech', runFreq: 7.5, lean: 0.08 }; }
  R.bone('head', 'pip', [0, 0.55, 0]);
  R.bone('pipArm', 'pip', [-0.22, 0.38, 0]);
  R.add('pip', G.cyl(0.2, 0.24, 0.45, 6), c.primary, { p: [0, 0.22, 0] });
  R.add('pipArm', G.cyl(0.05, 0.05, 0.3, 4), c.primary, { p: [0, -0.15, 0] });
  R.add('pipArm', G.box(0.06, 0.25, 0.06), c.metal, { p: [0, -0.32, 0.08], r: [0.8, 0, 0] });
  R.add('pip', G.cyl(0.05, 0.05, 0.3, 4), c.primary, { p: [0.22, 0.25, 0.05], r: [0.3, 0, -0.4] });
  R.add('head', G.ico(0.3, 1), c.skin, { p: [0, 0.1, 0] });
  R.add('head', G.cone(0.08, 0.15, 4), c.skin, { p: [0, 0.08, 0.3], r: [PI / 2, 0, 0] });
  R.add('head', G.ico(0.2, 0), c.hair, { p: [0, -0.08, 0.12], s: [1.4, 0.7, 1] });
  pipHat(R, c, p);
  return { R, scale: 1.0, height: 3.4, style: 'mech', runFreq: 7.5, lean: 0.08 };
}

// ───────────────────────────────────────────────── MIRE
function mire(c, p) {
  const R = new Rig();
  const o = { hipY: 0.95, torsoH: 0.75, shoulderX: 0.36, hipX: 0.15, armLen: 0.85, armR: 0.09, noLegs: true, body: c.primary, skin: c.skin, sleeve: c.primary, forearm: c.primary };
  humanoid(R, o); limbs(R, c, o);
  R.add('hips', G.cone(0.75, 1.15, 7), c.primary, { p: [0, -0.45, 0], r: [PI, 0, 0] });
  for (let i = 0; i < 6; i++) R.add('hips', G.ico(0.2, 0), c.secondary, { p: [Math.sin(i) * 0.65, -0.95, Math.cos(i) * 0.65], s: [1.3, 0.6, 1.3] });
  R.add('torso', G.cyl(0.3, 0.35, o.torsoH, 6), c.primary, { p: [0, o.torsoH / 2, 0] });
  R.add('torso', G.ico(0.5, 0), c.secondary, { p: [0, o.torsoH - 0.05, -0.08], s: [1.15, 0.5, 1.0] }); // moss shawl
  R.add('torso', G.ico(0.3, 0), c.secondary, { p: [0.1, o.torsoH - 0.2, -0.35], s: [1, 1.2, 0.8] }); // hump
  for (let i = 0; i < 3; i++) R.add('torso', G.oct(0.07), c.glow, { p: [-0.2 + i * 0.2, 0.2, 0.3], glow: true }); // charm beads
  // head (hunched forward)
  R.add('head', G.ico(0.28, 1), c.skin, { p: [0, 0.12, 0.12] });
  R.add('head', G.cone(0.08, 0.35, 4), c.skin, { p: [0, 0.05, 0.48], r: [PI / 2 + 0.4, 0, 0] });
  R.add('head', G.box(0.07, 0.05, 0.02), c.glow, { p: [0.1, 0.18, 0.38], glow: true });
  R.add('head', G.box(0.07, 0.05, 0.02), c.glow, { p: [-0.1, 0.18, 0.38], glow: true });
  R.add('head', G.cone(0.3, 0.7, 5), '#c8c8b0', { p: [0, -0.05, -0.12], r: [0.1, 0, 0] }); // straggly hair
  if (p.hat === 'coral') { for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; R.add('head', G.cyl(0.03, 0.06, 0.6, 4), c.secondary, { p: [Math.sin(a) * 0.2, 0.55, Math.cos(a) * 0.2], r: [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5] }); R.add('head', G.ico(0.07, 0), c.secondary, { p: [Math.sin(a) * 0.36, 0.83, Math.cos(a) * 0.36] }); } R.add('head', G.ico(0.3, 0), c.primary, { p: [0, 0.35, 0], s: [1.2, 0.5, 1.2] }); }
  else {
    const hc = p.hat === 'eclipse' ? c.primary : p.hat === 'pumpkin' ? c.primary : c.primary;
    R.add('head', G.cyl(0.7, 0.7, 0.05, 9), hc, { p: [0, 0.38, 0.03], r: [0.12, 0, 0] });
    R.add('head', G.cyl(0.18, 0.33, 0.5, 7), hc, { p: [0, 0.65, -0.03], r: [-0.15, 0, 0] });
    R.add('head', G.cone(0.18, 0.5, 6), hc, { p: [0, 1.05, -0.2], r: [-0.9, 0, 0] });
    R.add('head', G.cyl(0.34, 0.34, 0.08, 7), c.secondary, { p: [0, 0.45, 0.01] });
    if (p.hat === 'eclipse') R.add('head', G.torus(0.13, 0.03, 3, 8, PI * 1.2), c.glow, { p: [0, 0.65, 0.3], r: [0, 0, 0.5], glow: true });
  }
  // crooked staff + lantern
  R.bone('staff', 'armR', [0, -o.armLen, 0.05]);
  R.add('staff', G.cyl(0.04, 0.06, 1.3, 5), c.wood, { p: [0, 0.05, 0], r: [0, 0, 0.05] });
  R.add('staff', G.cyl(0.04, 0.05, 0.9, 5), c.wood, { p: [0.05, 1.05, 0.04], r: [0.15, 0, -0.12] });
  R.add('staff', G.cyl(0.035, 0.04, 0.5, 5), c.wood, { p: [0.0, 1.6, 0.25], r: [1.1, 0, 0] });
  R.add('staff', G.ico(0.1, 0), c.secondary, { p: [0.05, 0.7, 0.03], s: [1.4, 0.7, 1.4] });
  R.bone('lantern', 'staff', [0, 1.7, 0.5]);
  R.add('lantern', G.cyl(0.01, 0.01, 0.2, 3), '#333333', { p: [0, -0.1, 0] });
  if (p.lantern === 'pumpkin') { R.add('lantern', G.ico(0.22, 1), c.secondary, { p: [0, -0.38, 0], s: [1.2, 0.9, 1.2] }); R.add('lantern', G.box(0.18, 0.08, 0.05), c.glow, { p: [0, -0.4, 0.22], glow: true }); R.add('lantern', G.cyl(0.02, 0.03, 0.1, 4), '#3a5a2a', { p: [0, -0.16, 0] }); }
  else if (p.lantern === 'shell') { R.add('lantern', G.cone(0.18, 0.45, 6), c.secondary, { p: [0, -0.4, 0], r: [PI, 0, 0] }); R.add('lantern', G.ico(0.12, 0), c.glow, { p: [0, -0.3, 0], glow: true }); }
  else if (p.lantern === 'moon') { R.add('lantern', G.torus(0.2, 0.06, 3, 10, PI * 1.35), c.glow, { p: [0, -0.4, 0], r: [0, 0, -0.2], glow: true }); R.add('lantern', G.oct(0.07), c.vfx2, { p: [0.05, -0.4, 0], glow: true }); }
  else { R.add('lantern', G.box(0.26, 0.32, 0.26), '#3a3028', { p: [0, -0.38, 0] }); R.add('lantern', G.ico(0.13, 0), c.glow, { p: [0, -0.38, 0], glow: true }); R.add('lantern', G.cone(0.2, 0.12, 4), '#3a3028', { p: [0, -0.18, 0], r: [0, PI / 4, 0] }); }
  return { R, scale: 1.0, height: 2.7, style: 'staff', runFreq: 8, lean: 0.1, hunch: 0.35 };
}

// ───────────────────────────────────────────────── GARROK
function garrok(c, p) {
  const R = new Rig();
  const o = { hipY: 1.3, torsoH: 1.1, shoulderX: 0.62, hipX: 0.26, armLen: 1.15, armR: 0.17, legR: 0.2, body: c.primary, skin: c.skin, legs: c.primary, boots: c.fur, sleeve: c.skin, forearm: c.primary };
  humanoid(R, o); limbs(R, c, o);
  R.add('torso', G.cyl(0.55, 0.4, o.torsoH, 6), c.primary, { p: [0, o.torsoH / 2, 0], s: [1, 1, 0.75] });
  R.add('torso', G.box(0.95, 0.12, 0.62), '#3a2a1a', { p: [0, 0.12, 0] });
  R.add('torso', G.box(0.1, 0.9, 0.05), '#3a2a1a', { p: [0, 0.6, 0.38], r: [0, 0, 0.6] });
  R.add('torso', G.ico(0.75, 0), c.fur, { p: [0, o.torsoH - 0.05, -0.05], s: [1.25, 0.45, 0.9] }); // fur mantle
  for (let i = 0; i < 3; i++) R.add('torso', G.cone(0.05, 0.18, 3), c.antler, { p: [-0.25 + i * 0.25, o.torsoH - 0.25, 0.42], r: [PI, 0, 0] }); // tooth necklace
  R.add('hips', G.box(0.85, 0.5, 0.5), c.fur, { p: [0, -0.15, 0] });
  // head + beard
  R.add('head', G.ico(0.32, 1), c.skin, { p: [0, 0.22, 0.05] });
  R.add('head', G.cone(0.28, 0.45, 5), '#4a3020', { p: [0, 0.02, 0.2], r: [PI + 0.4, 0, 0] });
  R.add('head', G.box(0.08, 0.05, 0.02), c.glow, { p: [0.12, 0.28, 0.34], glow: true });
  R.add('head', G.box(0.08, 0.05, 0.02), c.glow, { p: [-0.12, 0.28, 0.34], glow: true });
  // skull helm + antlers
  const helmCol = p.helm === 'snow' ? c.fur : p.helm === 'spirit' ? c.fur : '#e8dcc0';
  R.add('head', G.ico(0.36, 0), helmCol, { p: [0, 0.42, 0.02], s: [1.05, 0.7, 1.15] });
  R.add('head', G.box(0.3, 0.14, 0.3), helmCol, { p: [0, 0.4, 0.33] });
  const glowA = p.helm === 'spirit' || p.helm === 'thunder';
  for (const sx of [1, -1]) {
    const ac = c.antler; const gl = { glow: glowA };
    R.add('head', G.cyl(0.04, 0.07, 0.7, 4), ac, { p: [sx * 0.42, 0.75, -0.05], r: [-0.2, 0, -sx * 0.7], ...gl });
    R.add('head', G.cyl(0.03, 0.05, 0.55, 4), ac, { p: [sx * 0.7, 1.15, -0.1], r: [-0.3, 0, -sx * 0.15], ...gl });
    R.add('head', G.cyl(0.025, 0.04, 0.35, 4), ac, { p: [sx * 0.55, 1.1, 0.12], r: [0.6, 0, -sx * 0.2], ...gl });
    R.add('head', G.cyl(0.025, 0.04, 0.35, 4), ac, { p: [sx * 0.9, 1.0, -0.05], r: [0, 0, -sx * 1.0], ...gl });
  }
  // spear (vertical, right hand)
  R.bone('spear', 'armR', [0, -o.armLen, 0.05]);
  R.add('spear', G.cyl(0.05, 0.05, 3.2, 5), '#6a4a2a', { p: [0, 0.6, 0] });
  R.add('spear', G.cyl(0.07, 0.07, 0.25, 5), '#3a2a1a', { p: [0, 1.95, 0] });
  if (p.spear === 'ice') R.add('spear', G.oct(0.22), c.metal, { p: [0, 2.45, 0], s: [0.5, 2, 0.5] });
  else if (p.spear === 'spirit') R.add('spear', G.cone(0.18, 0.8, 4), c.glow, { p: [0, 2.45, 0], glow: true });
  else if (p.spear === 'thunder') { R.add('spear', G.box(0.1, 0.35, 0.06), c.metal, { p: [0.05, 2.2, 0], r: [0, 0, 0.5], glow: true }); R.add('spear', G.box(0.1, 0.35, 0.06), c.metal, { p: [-0.02, 2.48, 0], r: [0, 0, -0.5], glow: true }); R.add('spear', G.cone(0.1, 0.3, 4), c.metal, { p: [0.04, 2.75, 0], glow: true }); }
  else { R.add('spear', G.cone(0.16, 0.7, 4), c.metal, { p: [0, 2.4, 0] }); R.add('spear', G.box(0.05, 0.3, 0.05), '#b03a2a', { p: [0.1, 1.9, 0], r: [0, 0, 0.3] }); }
  return { R, scale: 1.0, height: 3.6, style: 'spear', runFreq: 9, lean: 0.2 };
}

// ───────────────────────────────────────────────── WOLF (garrok summon)
function wolf(c) {
  const R = new Rig();
  const wc = c.wolf || '#7a6a5a', g = c.glow || '#ffcf5a';
  R.bone('hips', 'root', [0, 0.85, 0]);
  R.bone('torso', 'hips', [0, 0, 0]);
  R.bone('head', 'torso', [0, 0.2, 0.75]);
  R.bone('tail', 'torso', [0, 0.15, -0.7]);
  for (const [n, x, z] of [['legFL', 0.25, 0.5], ['legFR', -0.25, 0.5], ['legBL', 0.25, -0.5], ['legBR', -0.25, -0.5]]) { R.bone(n, 'hips', [x, 0, z]); R.add(n, G.cyl(0.09, 0.07, 0.85, 4), wc, { p: [0, -0.42, 0] }); R.add(n, G.box(0.14, 0.08, 0.2), wc, { p: [0, -0.82, 0.05] }); }
  R.add('torso', G.ico(0.5, 0), wc, { s: [0.8, 0.75, 1.6] });
  R.add('torso', G.ico(0.45, 0), wc, { p: [0, 0.12, 0.4], s: [1, 1, 1] }); // chest fur
  R.add('head', G.ico(0.3, 0), wc, {});
  R.add('head', G.box(0.22, 0.2, 0.4), wc, { p: [0, -0.06, 0.3] });
  R.add('head', G.box(0.1, 0.08, 0.08), '#222222', { p: [0, -0.02, 0.52] });
  for (const sx of [1, -1]) { R.add('head', G.cone(0.08, 0.25, 3), wc, { p: [sx * 0.16, 0.3, -0.05] }); R.add('head', G.box(0.07, 0.04, 0.02), g, { p: [sx * 0.12, 0.06, 0.27], glow: true }); }
  R.add('tail', G.cone(0.12, 0.7, 4), wc, { p: [0, 0.1, -0.3], r: [-2.2, 0, 0] });
  return { R, scale: 1.0, height: 1.6, style: 'beast', quad: true, runFreq: 12 };
}

export const HERO_RECIPES = { bram, kaela, lumi, vex, nyx, pip, mire, garrok, garrok_wolf: wolf };

// Default color fallback for unknown hero ids
const FALLBACK_COLORS = { primary: '#7a7aa0', secondary: '#4a4a6a', accent: '#a0d0ff', metal: '#c0c0c8', skin: '#e0b090', hair: '#3a2a1a', glow: '#a0e0ff', vfx: '#a0e0ff', vfx2: '#ffffff', wood: '#6a4a2a', mech: '#c0a040', mech2: '#404050', fur: '#8a6a4a', antler: '#e0d0b0', wolf: '#7a6a5a' };

export function buildHero(heroId, skinId, opts = {}) {
  const skin = getSkin(heroId, skinId);
  const colors = { ...FALLBACK_COLORS, ...(skin?.colors || {}) };
  const parts = skin?.parts || {};
  const recipe = HERO_RECIPES[heroId] || kaela;
  const def = recipe(colors, parts, opts.variant);
  const rig = def.R.build({ rim: colors.glow, rimStrength: opts.rimStrength ?? 0.45, shadow: opts.shadow });
  rig.def = def; rig.colors = colors; rig.skin = skin; rig.heroId = heroId;
  rig.root.scale.setScalar(def.scale || 1);
  return rig;
}

// ───────────────────────────────────────────────── animation
function reset(b) {
  for (const k in b) { const r = b[k].userData.rest; if (!r) continue; b[k].position.copy(r.p); b[k].rotation.copy(r.r); if (k !== 'root') b[k].scale.copy(r.s); }
}

export function poseRig(rig, anim, time, moving) {
  const b = rig.bones, d = rig.def; reset(b);
  let st = anim?.state || 'idle'; const at = anim?.t || 0;
  if (st === 'idle' && moving) st = 'run';
  const ph = time * (d.runFreq || 9);
  const ar = d.armsRest;
  if (ar) for (const k in ar) if (b[k]) { b[k].rotation.x += ar[k][0]; b[k].rotation.y += ar[k][1]; b[k].rotation.z += ar[k][2]; }
  if (d.hunch && b.torso) b.torso.rotation.x += d.hunch;
  if (d.crouch && b.hips) { b.hips.position.y -= d.crouch; b.torso.rotation.x += 0.2; }

  if (d.quad) return poseQuad(rig, st, at, time, ph);
  if (d.style === 'mech') return poseMech(rig, st, at, time, ph);

  // float bob for floating characters
  if (d.float) { b.hips.position.y += 0.25 + Math.sin(time * 2.2) * 0.12; }
  if (b.orbit) { b.orbit.rotation.y = time * 2.5; b.orbit.rotation.z = 0.4; }
  if (b.wisps) { b.wisps.rotation.y = time * 1.6; b.wisps.position.y += Math.sin(time * 3) * 0.12; }
  if (b.lantern) { b.lantern.rotation.z = Math.sin(time * 2.4) * 0.25; b.lantern.rotation.x = Math.sin(time * 1.7) * 0.15; }

  switch (st) {
    case 'run': {
      const s = Math.sin(ph);
      if (b.legL) { b.legL.rotation.x = s * 0.85; b.legR.rotation.x = -s * 0.85; b.hips.position.y += Math.abs(Math.cos(ph)) * 0.1; }
      const armAmp = d.armsRest ? 0.12 : 0.65;
      b.armL.rotation.x += -s * armAmp; b.armR.rotation.x += s * armAmp;
      b.torso.rotation.x += d.lean ?? 0.18; b.torso.rotation.y = s * 0.12;
      if (d.style === 'dual') { b.armL.rotation.x += 0.5; b.armR.rotation.x += 0.5; b.armL.rotation.z -= 0.25; b.armR.rotation.z += 0.25; } // blades trailing back
      break;
    }
    case 'attack': {
      const dur = 0.4, k = clamp(at / dur, 0, 1);
      const wind = ease(k / 0.45), strike = ease((k - 0.45) / 0.3), back = ease((k - 0.8) / 0.2);
      const lunge = Math.sin(clamp(k, 0, 1) * PI);
      if (d.style === 'shoot') { const r = Math.max(0, 1 - at / 0.25); b.gun.position.z -= r * 0.3; b.torso.rotation.x -= r * 0.15; b.head.rotation.x += 0.1; }
      else if (d.style === 'smash') { const up = k < 0.45 ? wind : 1 - strike; b.armR.rotation.x -= up * 2.8 - (1 - back) * strike * 0.2; b.armL.rotation.x -= up * 1.2; b.torso.rotation.x += (k > 0.45 ? strike * 0.3 * (1 - back) : -wind * 0.2); b.hips.position.z += lunge * 0.3; }
      else if (d.style === 'dual') { const alt = (Math.floor((anim.slot ?? at * 10) || 0) % 2) ? 1 : 0; const A = alt ? b.armL : b.armR, B = alt ? b.armR : b.armL; A.rotation.x -= (k < 0.45 ? wind * 2.2 : 2.2 - strike * 2.6) * (1 - back); A.rotation.z += (alt ? -1 : 1) * strike * 0.7 * (1 - back); B.rotation.x -= 0.6 * lunge; b.torso.rotation.y += (alt ? -1 : 1) * (strike - wind * 0.5) * 0.5 * (1 - back); b.hips.position.z += lunge * 0.45; }
      else if (d.style === 'spear') { b.armR.rotation.x -= (k < 0.45 ? wind * 0.9 : 0.9 + strike * 0.9) * (1 - back); b.armR.position.z += strike * 0.4 * (1 - back); b.torso.rotation.y -= wind * 0.35 * (1 - strike); b.hips.position.z += lunge * 0.4; }
      else { b.armR.rotation.x -= (k < 0.45 ? wind * 1.7 : 1.7 - strike * 0.6) * (1 - back); b.torso.rotation.x -= wind * 0.12 * (1 - back); }
      break;
    }
    case 'cast': {
      const k = ease(at / 0.2), rel = ease((at - 0.45) / 0.3), a = k * (1 - rel);
      b.armR.rotation.x -= 2.0 * a; b.armL.rotation.x -= 1.6 * a; b.armL.rotation.z += 0.4 * a; b.armR.rotation.z -= 0.3 * a;
      b.torso.rotation.x -= 0.18 * a; b.head.rotation.x -= 0.2 * a;
      if (d.float) b.hips.position.y += 0.3 * a;
      break;
    }
    case 'dead': {
      const k = ease(at / 0.7);
      b.root.rotation.x = -PI / 2 * 0.95 * k; b.root.position.y = 0.25 * k;
      b.armL.rotation.z += 0.8 * k; b.armR.rotation.z -= 0.8 * k;
      if (d.float) b.hips.position.y -= 0.25 * k;
      break;
    }
    default: { // idle
      b.torso.position.y += Math.sin(time * 2) * 0.03; b.torso.rotation.x += Math.sin(time * 2) * 0.02;
      b.armL.rotation.z += 0.08 + Math.sin(time * 2) * 0.03; b.armR.rotation.z -= 0.08 + Math.sin(time * 2) * 0.03;
      b.head.rotation.y = Math.sin(time * 0.6) * 0.15;
    }
  }
}

function poseMech(rig, st, at, time, ph) {
  const b = rig.bones;
  if (st === 'run') { const s = Math.sin(ph); b.legL.rotation.x = s * 0.6; b.legR.rotation.x = -s * 0.6; b.hips.position.y += Math.abs(Math.cos(ph)) * 0.12; b.torso.rotation.z = s * 0.06; b.armL.rotation.x = -s * 0.4; b.armR.rotation.x = s * 0.4; if (b.pip) b.pip.rotation.z = -s * 0.1; b.torso.rotation.x = 0.1; }
  else if (st === 'attack') { const k = clamp(at / 0.35, 0, 1); const r = Math.sin(k * PI); b.armL.rotation.x = -1.4 * ease(k / 0.3) * (1 - ease((k - 0.7) / 0.3)); b.armL.position.z -= r * 0.15; b.torso.rotation.x -= r * 0.08; if (b.pipArm) b.pipArm.rotation.x = -1.5 * r; }
  else if (st === 'cast') { const a = ease(at / 0.2) * (1 - ease((at - 0.45) / 0.3)); b.armR.rotation.x = -2.0 * a; b.armL.rotation.x = -1.5 * a; if (b.pipArm) { b.pipArm.rotation.x = -2.6 * a; b.pip.position.y += 0.15 * a; } b.torso.rotation.x = -0.12 * a; }
  else if (st === 'dead') { const k = ease(at / 0.7); b.hips.position.y -= 0.55 * k; b.torso.rotation.z = 0.45 * k; b.torso.rotation.x = 0.3 * k; if (b.pipArm) { b.pip.rotation.z = -1.2 * k; b.pip.position.x += 0.6 * k; } b.armL.rotation.z = 0.8 * k; b.armR.rotation.z = -0.6 * k; }
  else { b.torso.position.y += Math.sin(time * 1.8) * 0.03; if (b.pipArm) { b.pip.rotation.y = Math.sin(time * 0.7) * 0.4; b.pipArm.rotation.x = Math.sin(time * 3) * 0.2; } b.armL.rotation.x = Math.sin(time * 1.8) * 0.05; }
}

function poseQuad(rig, st, at, time, ph) {
  const b = rig.bones;
  if (st === 'run') { const s = Math.sin(ph), c2 = Math.cos(ph); b.legFL.rotation.x = s * 0.8; b.legBR.rotation.x = s * 0.7; b.legFR.rotation.x = -s * 0.8; b.legBL.rotation.x = -s * 0.7; b.hips.position.y += Math.abs(c2) * 0.1; b.torso.rotation.x = s * 0.06; b.tail.rotation.x = 0.4 + c2 * 0.2; }
  else if (st === 'attack') { const k = clamp(at / 0.35, 0, 1), r = Math.sin(k * PI); b.hips.position.z += r * 0.5; b.head.rotation.x = -0.5 * r + 0.3 * ease((k - 0.5) * 2); b.legFL.rotation.x = -r * 0.8; b.legFR.rotation.x = -r * 0.8; b.torso.rotation.x = -r * 0.25; }
  else if (st === 'dead') { const k = ease(at / 0.6); b.root.rotation.z = PI / 2 * k; b.root.position.y = 0.3 * k; }
  else { b.torso.position.y += Math.sin(time * 3) * 0.02; b.tail.rotation.y = Math.sin(time * 4) * 0.4; b.head.rotation.y = Math.sin(time * 0.8) * 0.3; }
}
