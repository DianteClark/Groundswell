// Non-hero models: minions (instanced), towers, core, monsters, summons.
import * as THREE from 'three';
import { Rig, G, prep, mergeColored } from './builder.js';
import { makeToonMat, makeGlowMat, teamColor, ease, clamp, glowTexture } from '../util.js';
import { buildHero, poseRig } from './heroes.js';

const PI = Math.PI;
export const ELEMENT_COLORS = { ember: '#ff6a2a', tide: '#2fb0ff', gale: '#9ff5d8', stone: '#c9a46a', none: '#c080ff' };

// ───────────────────────────── MINIONS → ./minions.js (GPU-animated instancer)
export { MinionInstancer } from './minions.js';
const _m4 = new THREE.Matrix4();

// ───────────────────────────── TOWER / CORE ─────────────────────────────
export function buildTower(team) {
  const tc = new THREE.Color(teamColor(team)).getStyle();
  const R = new Rig();
  R.bone('base'); R.bone('crystal', 'root', [0, 6.4, 0]);
  const stone = '#a8a29a', stone2 = '#8a847c', dark = '#5a554e';
  R.add('base', G.cyl(2.2, 2.5, 0.6, 8), stone2, { p: [0, 0.3, 0] });
  R.add('base', G.cyl(1.6, 2.0, 2.4, 8), stone, { p: [0, 1.8, 0] });
  R.add('base', G.cyl(1.9, 1.7, 0.4, 8), stone2, { p: [0, 3.15, 0] });
  R.add('base', G.cyl(1.3, 1.5, 1.6, 8), stone, { p: [0, 4.1, 0] });
  for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; R.add('base', G.box(0.5, 2.2, 0.5), dark, { p: [Math.cos(a) * 1.45, 4.3, Math.sin(a) * 1.45], r: [Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15] }); R.add('base', G.cone(0.3, 0.6, 4), tc, { p: [Math.cos(a) * 1.65, 5.6, Math.sin(a) * 1.65] }); }
  R.add('base', G.cyl(1.0, 1.2, 0.3, 8), tc, { p: [0, 4.95, 0] });
  R.add('base', G.box(0.9, 0.9, 0.12), tc, { p: [0, 2.2, 1.75], r: [0.1, 0, 0] });
  R.add('base', G.box(0.4, 0.4, 0.13), '#ffffff', { p: [0, 2.2, 1.79], r: [0.1, 0, PI / 4], glow: true });
  R.add('crystal', G.oct(0.9), tc, { s: [0.8, 1.6, 0.8], glow: true });
  R.add('crystal', G.oct(0.45), '#ffffff', { s: [0.7, 1.4, 0.7], glow: true });
  for (let i = 0; i < 3; i++) R.add('crystal', G.oct(0.22), tc, { p: [Math.cos(i * 2.1) * 1.3, -0.3, Math.sin(i * 2.1) * 1.3], s: [0.7, 1.4, 0.7], glow: true });
  const rig = R.build({ rim: tc, rimStrength: 0.3 });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: teamColor(team), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(4.5, 4.5, 1); rig.bones.crystal.add(glow);
  rig.height = 8;
  return rig;
}

export function buildCore(team) {
  const tc = new THREE.Color(teamColor(team)).getStyle();
  const R = new Rig();
  R.bone('base'); R.bone('crystal', 'root', [0, 5.5, 0]); R.bone('ring', 'root', [0, 5.5, 0]);
  const stone = '#b0aaa0', stone2 = '#8a847c';
  R.add('base', G.cyl(5.2, 5.8, 1.0, 10), stone2, { p: [0, 0.5, 0] });
  R.add('base', G.cyl(4.2, 4.8, 1.0, 10), stone, { p: [0, 1.5, 0] });
  R.add('base', G.cyl(3.6, 3.6, 0.15, 10), tc, { p: [0, 2.05, 0], glow: true });
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; R.add('base', G.box(0.7, 4.0, 0.7), stone, { p: [Math.cos(a) * 4.2, 3.0, Math.sin(a) * 4.2], r: [Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2] }); R.add('base', G.oct(0.45), tc, { p: [Math.cos(a) * 4.6, 5.3, Math.sin(a) * 4.6], s: [0.7, 1.4, 0.7], glow: true }); }
  R.add('crystal', G.oct(2.0), tc, { s: [0.85, 1.7, 0.85], glow: true });
  R.add('crystal', G.oct(1.1), '#ffffff', { s: [0.8, 1.6, 0.8], glow: true });
  for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; R.add('crystal', G.oct(0.8), tc, { p: [Math.cos(a) * 1.6, -2.1, Math.sin(a) * 1.6], r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5], s: [0.6, 1.6, 0.6], glow: true }); }
  R.add('ring', G.torus(3.3, 0.1, 3, 24), tc, { r: [PI / 2, 0, 0], glow: true });
  R.add('ring', G.torus(2.7, 0.07, 3, 24), '#ffffff', { r: [PI / 2 + 0.3, 0, 0], glow: true });
  const rig = R.build({ rim: tc, rimStrength: 0.3 });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: teamColor(team), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(11, 11, 1); rig.bones.crystal.add(glow);
  rig.height = 10;
  return rig;
}

export function buildRubble(scale = 1, tint = '#8a847c') {
  const parts = [];
  for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.5 + (i % 3) * 0.6; parts.push(prep(G.dodec(0.45 + (i % 4) * 0.15), i % 2 ? tint : '#a8a29a', { p: [Math.cos(a) * r, 0.2, Math.sin(a) * r], r: [i, i * 2, 0] })); }
  const m = new THREE.Mesh(mergeColored(parts), makeToonMat({ rimStrength: 0.15 })); m.scale.setScalar(scale); m.receiveShadow = true; m.castShadow = true;
  return m;
}

// ───────────────────────────── MONSTERS ─────────────────────────────
function campSmall() { // mossy frog-beetle
  const R = new Rig();
  R.bone('hips', 'root', [0, 0.6, 0]); R.bone('torso', 'hips'); R.bone('head', 'torso', [0, 0.25, 0.55]);
  for (const [n, x, z] of [['legFL', 0.45, 0.3], ['legFR', -0.45, 0.3], ['legBL', 0.45, -0.3], ['legBR', -0.45, -0.3]]) { R.bone(n, 'hips', [x, 0, z]); R.add(n, G.cyl(0.09, 0.07, 0.6, 4), '#4a5a2a', { p: [0, -0.3, 0], r: [0, 0, x > 0 ? -0.4 : 0.4] }); }
  R.add('torso', G.ico(0.7, 0), '#6a8a3a', { s: [1, 0.7, 1.2] });
  R.add('torso', G.ico(0.55, 0), '#3a6a3a', { p: [0, 0.35, -0.1], s: [1, 0.6, 1.1] });
  R.add('torso', G.cone(0.15, 0.4, 4), '#c8b88a', { p: [0.2, 0.7, -0.1] }); R.add('torso', G.cone(0.12, 0.3, 4), '#c8b88a', { p: [-0.25, 0.62, 0.1] });
  R.add('head', G.ico(0.4, 0), '#7a9a4a', { s: [1.1, 0.8, 1] });
  for (const sx of [1, -1]) { R.add('head', G.ico(0.13, 0), '#ffe880', { p: [sx * 0.22, 0.22, 0.2], glow: true }); R.add('head', G.ico(0.06, 0), '#202020', { p: [sx * 0.24, 0.24, 0.31] }); }
  return { R, height: 1.8 };
}
function campBig() { // stoneback boar
  const R = new Rig();
  R.bone('hips', 'root', [0, 1.2, 0]); R.bone('torso', 'hips'); R.bone('head', 'torso', [0, 0.1, 1.3]);
  for (const [n, x, z] of [['legFL', 0.6, 0.7], ['legFR', -0.6, 0.7], ['legBL', 0.6, -0.7], ['legBR', -0.6, -0.7]]) { R.bone(n, 'hips', [x, 0, z]); R.add(n, G.cyl(0.22, 0.16, 1.2, 5), '#5a3a2a', { p: [0, -0.6, 0] }); R.add(n, G.box(0.3, 0.15, 0.35), '#2a2020', { p: [0, -1.15, 0.05] }); }
  R.add('torso', G.ico(1.0, 0), '#7a4a32', { s: [1.1, 0.95, 1.6] });
  for (let i = 0; i < 5; i++) R.add('torso', G.dodec(0.45 + (i % 2) * 0.15), '#8a8a90', { p: [(i % 2 ? 0.3 : -0.3), 0.85 - Math.abs(i - 2) * 0.08, -0.9 + i * 0.45], r: [i, i, 0] });
  R.add('torso', G.oct(0.25), '#7affc8', { p: [0, 1.25, 0], s: [0.6, 1.5, 0.6], glow: true });
  R.add('head', G.ico(0.65, 0), '#6a3a2a', { s: [1, 0.9, 1.1] });
  R.add('head', G.box(0.55, 0.45, 0.6), '#8a5a42', { p: [0, -0.15, 0.55] });
  R.add('head', G.box(0.4, 0.25, 0.1), '#3a2020', { p: [0, -0.15, 0.86] });
  for (const sx of [1, -1]) { R.add('head', G.cone(0.1, 0.65, 4), '#f0e8d0', { p: [sx * 0.33, -0.15, 0.7], r: [-0.9, 0, -sx * 0.3] }); R.add('head', G.box(0.12, 0.08, 0.05), '#ff6a3a', { p: [sx * 0.25, 0.15, 0.55], glow: true }); R.add('head', G.cone(0.14, 0.35, 3), '#6a3a2a', { p: [sx * 0.38, 0.55, -0.1], r: [0, 0, -sx * 0.4] }); }
  return { R, height: 3.2 };
}
function wyrm(element) {
  const ec = ELEMENT_COLORS[element] || ELEMENT_COLORS.none;
  const C = (x) => new THREE.Color(x);
  const body = C(ec).multiplyScalar(0.16).lerp(C('#2a2630'), 0.3).getStyle();
  const body2 = C(ec).multiplyScalar(0.3).getStyle();
  const belly = C(ec).lerp(C('#fff2d0'), 0.6).getStyle();
  const horn = '#efe6d2';
  const R = new Rig();
  R.bone('hips', 'root', [0, 2.3, -0.4]); R.bone('torso', 'hips', [0, 0.1, 1.2]);
  R.bone('neck', 'torso', [0, 0.6, 1.2], [0.35, 0, 0]); R.bone('neck2', 'neck', [0, 1.1, 0.7], [0.25, 0, 0]); R.bone('head', 'neck2', [0, 0.8, 0.6], [-0.55, 0, 0]); R.bone('jaw', 'head', [0, -0.3, 0.3]);
  R.bone('wingL', 'torso', [0.85, 0.85, 0.1]); R.bone('wingR', 'torso', [-0.85, 0.85, 0.1]); R.bone('wingL2', 'wingL', [2.4, 0.9, -0.3]); R.bone('wingR2', 'wingR', [-2.4, 0.9, -0.3]);
  R.bone('tail', 'hips', [0, 0, -1.2]); R.bone('tail2', 'tail', [0, -0.2, -1.8]); R.bone('tail3', 'tail2', [0, -0.15, -1.6]);
  for (const [n, par, x, z] of [['legFL', 'torso', 0.95, 0.5], ['legFR', 'torso', -0.95, 0.5], ['legBL', 'hips', 1.0, -0.2], ['legBR', 'hips', -1.0, -0.2]]) {
    R.bone(n, par, [x, -0.2, z]); R.bone(n + 'b', n, [0, -1.1, 0.15]);
    R.add(n, G.tprism(0.55, 0.6, 0.75, 0.8, 1.3, 7), body2, { p: [0, -0.5, 0] });
    R.add(n + 'b', G.tprism(0.38, 0.42, 0.45, 0.48, 1.0, 6), body, { p: [0, -0.45, 0] });
    R.add(n + 'b', G.cbox(0.62, 0.22, 0.78, 0.06), body, { p: [0, -1.0, 0.18] });
    for (let i = -1; i <= 1; i++) R.add(n + 'b', G.cone(0.07, 0.35, 4), horn, { p: [i * 0.2, -1.05, 0.62], r: [PI / 2, 0, 0] });
  }
  R.add('hips', G.ico(1.15, 1), body, { s: [1.05, 0.95, 1.2] });
  R.add('torso', G.ico(1.35, 1), body, { s: [1.0, 0.95, 1.25] });
  R.add('torso', G.ico(1.05, 1), belly, { p: [0, -0.45, 0.3], s: [0.85, 0.6, 1.25] });
  for (let i = 0; i < 9; i++) R.add(i < 5 ? 'torso' : 'hips', G.gem(0.2, 0.75 - Math.abs(i - 4) * 0.05, 4), ec, { p: [0, i < 5 ? 1.3 - Math.abs(i - 2) * 0.05 : 1.05, i < 5 ? 0.9 - i * 0.45 : 0.5 - (i - 5) * 0.4], r: [-0.4, 0, 0], glow: 1.1 });
  R.add('neck', G.tprism(1.0, 1.0, 0.8, 0.8, 1.4, 7), body, { p: [0, 0.55, 0.3], r: [0.55, 0, 0] });
  R.add('neck', G.tprism(0.55, 0.4, 0.45, 0.35, 1.3, 7), belly, { p: [0, 0.45, 0.62], r: [0.55, 0, 0] });
  R.add('neck2', G.tprism(0.78, 0.78, 0.66, 0.66, 1.1, 7), body, { p: [0, 0.4, 0.25], r: [0.6, 0, 0] });
  for (let i = 0; i < 3; i++) R.add(i < 2 ? 'neck' : 'neck2', G.gem(0.14, 0.5, 4), ec, { p: [0, 0.9 - i * 0.2, -0.05], r: [-0.6, 0, 0], glow: 1.1 });
  // head
  R.bone('headS', 'head', [0, 0, 0]);
  R.add('head', G.cbox(1.15, 0.8, 1.25, 0.15), body, { p: [0, 0.05, 0.1] });
  R.add('head', G.tbox(0.9, 0.8, 0.6, 0.5, 1.0), body2, { p: [0, 0.0, 0.95], r: [PI / 2, 0, 0] });
  R.add('head', G.cbox(0.75, 0.12, 0.85, 0.04), belly, { p: [0, -0.28, 0.95] });
  R.sym('head', G.cbox(0.24, 0.12, 0.08, 0.03), ec, { p: [0.36, 0.2, 0.6], r: [0, 0.4, -0.3], glow: 2.2 });
  R.sym('head', G.horn(1.4, 0.13, 0.55, 5, 5), horn, { p: [0.36, 0.3, -0.3], r: [-1.2, 0, -0.35] });
  R.sym('head', G.horn(0.7, 0.08, 0.5, 4, 4), horn, { p: [0.5, 0.0, -0.2], r: [-1.5, 0, -0.9] });
  for (let i = 0; i < 4; i++) R.sym('head', G.cone(0.05, 0.22, 3), '#ffffff', { p: [0.3 - i * 0.02, -0.28, 0.6 + i * 0.25], r: [PI, 0, 0] });
  R.add('jaw', G.tbox(0.75, 0.75, 0.5, 0.45, 1.1), body2, { p: [0, -0.05, 0.7], r: [PI / 2, 0, 0] });
  R.add('jaw', G.cbox(0.6, 0.06, 0.9, 0.02), C(ec).lerp(C('#ffffff'), 0.4).getStyle(), { p: [0, 0.18, 0.75], glow: 1.4 });
  // wings: bones + membranes
  const memb = C(ec).multiplyScalar(0.45).getStyle();
  for (const [w, w2, sx] of [['wingL', 'wingL2', 1], ['wingR', 'wingR2', -1]]) {
    R.add(w, G.tube([[0, 0, 0], [sx * 1.3, 0.6, -0.1], [sx * 2.4, 0.9, -0.3]], 0.2, 0.12, 5, 4), body, {});
    R.add(w, G.fan([[0, 0, -0.2], [sx * 2.4, 0.9, -0.3], [sx * 2.1, 0.3, -1.3], [sx * 1.2, 0.0, -1.7], [sx * 0.3, -0.1, -1.4]]), memb, { glow: 0.2, rough: 0.6 });
    R.add(w2, G.tube([[0, 0, 0], [sx * 1.4, 0.5, -0.2], [sx * 2.7, 0.2, -0.6]], 0.12, 0.05, 5, 4), body, {});
    R.add(w2, G.fan([[0, 0, 0], [sx * 2.7, 0.2, -0.6], [sx * 2.2, -0.2, -1.5], [sx * 1.2, -0.5, -1.9], [sx * -0.3, -0.9, -1.0]]), memb, { glow: 0.2, rough: 0.6 });
    R.add(w2, G.cone(0.09, 0.55, 4), horn, { p: [sx * 2.7, 0.2, -0.6], r: [0, 0, -sx * 1.3] });
  }
  R.add('tail', G.tprism(1.0, 1.0, 0.7, 0.7, 1.9, 7), body, { p: [0, -0.1, -0.9], r: [-PI / 2 - 0.1, 0, 0] });
  R.add('tail2', G.tprism(0.66, 0.66, 0.4, 0.4, 1.7, 6), body, { p: [0, -0.07, -0.8], r: [-PI / 2 - 0.1, 0, 0] });
  R.add('tail3', G.tprism(0.38, 0.38, 0.12, 0.12, 1.5, 6), body, { p: [0, 0, -0.7], r: [-PI / 2, 0, 0] });
  R.add('tail3', G.gem(0.45, 1.2, 4, 0.4), ec, { p: [0, 0, -1.5], r: [-PI / 2, 0, 0], s: [0.4, 1, 1], glow: 1.4 });
  R.bone('mouth', 'head', [0, -0.2, 1.5]);
  return { R, height: 8.5, scale: 1.25, rim: ec, kind: 'wyrm' };
}
function colossus() {
  const R = new Rig();
  const rock = '#7a7088', rock2 = '#5a5268', moss = '#6a8a4a', glow = '#c07aff';
  R.bone('hips', 'root', [0, 3.2, 0]); R.bone('spine', 'hips', [0, 0.3, 0]); R.bone('torso', 'spine', [0, 0.6, 0]); R.bone('head', 'torso', [0, 3.0, 0.9]);
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    R.bone('arm' + s, 'torso', [sx * 2.6, 2.5, 0]); R.bone('fore' + s, 'arm' + s, [sx * 0.2, -2.0, 0.2]); R.bone('fist' + s, 'fore' + s, [0, -1.8, 0.3]);
    R.bone('leg' + s, 'hips', [sx * 1.1, 0, 0]); R.bone('shin' + s, 'leg' + s, [0, -1.6, 0.1]);
  }
  R.add('hips', G.dodec(1.5), rock2, { s: [1.3, 0.8, 1.0] });
  R.add('torso', G.dodec(2.3), rock, { p: [0, 1.5, 0], s: [1.2, 1.0, 0.85] });
  R.add('torso', G.dodec(1.4), rock2, { p: [0, 2.8, -0.6] });
  R.add('torso', G.ico(1.6, 1), moss, { p: [0, 3.3, -0.4], s: [1.6, 0.4, 1.2] });
  R.add('torso', G.gem(0.75, 1.8, 6, 0.5), glow, { p: [0, 1.6, 1.85], s: [1, 1, 0.5], glow: 1.6 });
  for (let i = 0; i < 6; i++) { const a = i * 1.1 - 2.7; R.add('torso', G.cbox(0.12, 1.2 + (i % 2) * 0.5, 0.1, 0.02), glow, { p: [Math.sin(a) * 2.2, 1.3 + (i % 3) * 0.4, Math.cos(a) * 1.7], r: [0, a, 0.5 * ((i % 3) - 1)], glow: 1.3 }); }
  for (let i = 0; i < 5; i++) R.add('torso', G.gem(0.35, 1.4 + (i % 2) * 0.6, 5, 0.3), glow, { p: [Math.cos(i * 1.4) * 1.6, 3.2 + (i % 2) * 0.3, -0.9 - Math.sin(i * 1.4) * 0.4], r: [-0.3, 0, Math.cos(i * 1.4) * 0.4], glow: 1.2 });
  for (const sx of [1, -1]) R.add('torso', G.dodec(1.1), rock2, { p: [sx * 2.3, 2.9, 0] });
  R.add('head', G.dodec(0.9), rock, { s: [1.15, 0.85, 1.05] });
  R.add('head', G.cbox(1.3, 0.28, 0.5, 0.08), rock2, { p: [0, 0.3, 0.55] });
  R.sym('head', G.cbox(0.28, 0.14, 0.08, 0.03), glow, { p: [0.3, 0.05, 0.85], glow: 2.4 });
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    R.add('arm' + s, G.dodec(0.85), rock2, { p: [sx * 0.15, -1.0, 0] });
    R.add('fore' + s, G.dodec(0.95), rock, { p: [0, -0.9, 0.1] });
    R.add('fore' + s, G.gem(0.25, 0.8, 4), glow, { p: [sx * 0.6, -0.9, 0.5], glow: 1.4 });
    R.add('fist' + s, G.dodec(1.15), rock2, { s: [1.1, 1, 1.1] });
    for (let k = -1; k <= 1; k++) R.add('fist' + s, G.cbox(0.4, 0.4, 0.4, 0.08), rock, { p: [k * 0.45, -0.7, 0.6] });
    R.add('leg' + s, G.dodec(0.95), rock2, { p: [0, -0.8, 0] });
    R.add('shin' + s, G.cbox(1.5, 1.0, 1.9, 0.2), rock, { p: [0, -1.1, 0.25] });
  }
  R.bone('slamL', 'fistL', [0, -1, 0]);
  return { R, height: 10.5, scale: 1.0, rim: glow, kind: 'colossus' };
}
const MONSTERS = { camp_small: campSmall, camp_big: campBig, wyrm, colossus };

export function buildMonster(model, element) {
  const f = MONSTERS[model] || campSmall;
  const def = f(element);
  const rig = def.R.build({ rim: def.rim || '#ffffff', rimStrength: 0.4 });
  rig.def = { style: 'monster', height: def.height * (def.scale || 1), kind: def.kind || model };
  if (def.scale) { const outer = new THREE.Group(); outer.add(rig.root); outer.scale.setScalar(def.scale); rig.outer = outer; }
  return rig;
}

export function poseMonster(rig, anim, time, moving) {
  const b = rig.bones;
  for (const k in b) { const r = b[k].userData.rest; if (!r) continue; b[k].position.copy(r.p); b[k].rotation.copy(r.r); b[k].scale.copy(r.s); }
  let st = anim?.state || 'idle'; const at = anim?.t || 0; if (st === 'idle' && moving) st = 'run';
  const legs = ['legFL', 'legFR', 'legBL', 'legBR'].filter((n) => b[n]);
  if (b.tail2) { b.tail2.rotation.y = Math.sin(time * 1.1) * 0.25; b.tail3.rotation.y = Math.sin(time * 1.1 - 0.6) * 0.35; }
  if (b.wingL2) { const f = st === 'attack' ? 6 : 1.4; b.wingL2.rotation.z = Math.sin(time * f - 0.5) * 0.3; b.wingR2.rotation.z = -Math.sin(time * f - 0.5) * 0.3; }
  if (b.wingL) { const f = st === 'attack' || st === 'cast' ? 6 : 1.6; b.wingL.rotation.z = Math.sin(time * f) * 0.35 + 0.1; b.wingR.rotation.z = -Math.sin(time * f) * 0.35 - 0.1; }
  if (b.tail) b.tail.rotation.y = Math.sin(time * 1.3) * 0.3;
  if (st === 'run') {
    const ph = time * 8, s = Math.sin(ph);
    legs.forEach((n, i) => { b[n].rotation.x = (i === 0 || i === 3 ? s : -s) * 0.6; });
    if (b.legL) { b.legL.rotation.x = s * 0.5; b.legR.rotation.x = -s * 0.5; b.armL.rotation.x = -s * 0.4; b.armR.rotation.x = s * 0.4; }
    b.hips.position.y += Math.abs(Math.cos(ph)) * 0.1;
  } else if (st === 'attack') {
    const kind = rig.def.kind; const per = Math.max(0.5, Math.min(2.5, anim?.dur || 1)); const wind = Math.max(0.12, Math.min(0.6, per * 0.35));
    const w = ease(at / wind), sk = ease((at - wind) / 0.1), rec = ease((at - wind - 0.15) / 0.4); const env = (1 - rec);
    if (kind === 'wyrm') { // rear back, then breathe
      const up = w * (1 - sk); const out = sk * env;
      b.neck.rotation.x += -0.5 * up + 0.35 * out; b.neck2.rotation.x += -0.4 * up + 0.3 * out; b.head.rotation.x += 0.3 * up - 0.25 * out; b.jaw.rotation.x += 0.15 * up + 0.75 * out;
      b.torso.rotation.x += -0.15 * up + 0.06 * out; b.hips.position.y += 0.3 * up; if (b.wingL) { b.wingL.rotation.z += 0.6 * up; b.wingR.rotation.z -= 0.6 * up; }
    } else if (kind === 'colossus') { // double-fist overhead slam
      const up = w * (1 - sk); const down = sk * env;
      for (const [s2, sx] of [['L', 1], ['R', -1]]) { b['arm' + s2].rotation.x += -2.6 * up - 0.9 * down; b['arm' + s2].rotation.z += -sx * 0.5 * up; b['fore' + s2].rotation.x += -0.6 * up; }
      b.torso.rotation.x += -0.25 * up + 0.45 * down; b.hips.position.y += -0.6 * down; b.head.rotation.x += -0.2 * up;
    } else {
      const r = Math.sin(clamp(at / per, 0, 1) * PI);
      b.hips.position.z += (w * (1 - sk) * -0.3 + sk * env * 0.6); b.torso.rotation.x = -0.25 * w * (1 - sk) + 0.2 * sk * env;
      if (b.head) b.head.rotation.x = -0.4 * w * (1 - sk) + 0.4 * sk * env;
      legs.forEach((n, i) => { if (i < 2) b[n].rotation.x += -0.7 * sk * env; });
    }
  } else if (st === 'dead') {
    const k = ease(at / 0.8);
    b.hips.position.y *= 1 - 0.55 * k; b.torso.rotation.z = 0.35 * k; legs.forEach((n, i) => { b[n].rotation.z = (i % 2 ? -1 : 1) * 0.9 * k; });
    if (b.legL) { b.root.rotation.x = -1.2 * k; }
  } else {
    const br = Math.sin(time * 1.6);
    b.torso.position.y += br * 0.05; b.torso.scale.set(1 + br * 0.015, 1 - br * 0.01, 1 + br * 0.015);
    if (b.head) b.head.rotation.y = Math.sin(time * 0.5) * 0.25;
    if (b.armL) { b.armL.rotation.z = 0.15 + br * 0.04; b.armR.rotation.z = -0.15 - br * 0.04; }
  }
}

// ───────────────────────────── SUMMONS ─────────────────────────────
export function buildSummon(model, team, colors, skinId) {
  const tc = new THREE.Color(teamColor(team)).getStyle();
  const c = colors || {};
  const vfx = c.vfx || tc, glow = c.glow || tc;
  if (/_wolf/.test(model)) { const rig = buildHero('garrok_wolf', skinId || 'garrok_default'); rig.isWolf = true; if (/alpha/.test(model)) { rig.root.scale.setScalar(1.5); rig.mat.userData.u.rimStrength.value = 1.2; rig.alpha = true; } return rig; }
  const R = new Rig(); R.bone('body');
  let height = 2.5, spin = null;
  if (model === 'bram_wall') { // living-bark wall segment (~r 1.45): twisted trunks, roots, leaves, rune
    const bark = c.primary || '#6b4a2b', bark2 = c.secondary || '#8a6238', leaf = c.accent || '#6fbf3f';
    R.add('body', G.dodec(1.0), bark2, { p: [0, 0.15, 0], s: [1.4, 0.45, 1.3] });
    for (let i = 0; i < 5; i++) { const a = i * 1.26, rr = i ? 0.62 : 0; R.add('body', G.tube([[Math.cos(a) * rr, 0, Math.sin(a) * rr], [Math.cos(a + 0.6) * rr * 0.7, 1.3, Math.sin(a + 0.6) * rr * 0.7], [Math.cos(a + 1.2) * rr * 0.5, 2.5 - i * 0.2, Math.sin(a + 1.2) * rr * 0.5]], 0.36 - i * 0.03, 0.12, 6, 5), i % 2 ? bark2 : bark, {}); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; R.add('body', G.cone(0.14, 0.9, 5), bark, { p: [Math.cos(a) * 0.95, 0.12, Math.sin(a) * 0.95], r: [Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3] }); }
    R.add('body', G.ico(0.5, 1), leaf, { p: [0.15, 2.6, 0.05], s: [1.2, 0.8, 1.1] }); R.add('body', G.ico(0.36, 1), leaf, { p: [-0.45, 2.1, 0.3] }); R.add('body', G.ico(0.3, 1), leaf, { p: [0.5, 1.8, -0.3] });
    R.add('body', G.gem(0.12, 0.5, 4), glow, { p: [0, 1.3, 0.62], glow: 1.4 }); R.add('body', G.cbox(0.06, 0.6, 0.04, 0.01), glow, { p: [0.15, 0.9, 0.6], r: [0, 0, 0.5], glow: 1.1 });
    height = 3;
  } else if (model === 'mire_totem') { // carved hex totem: stacked faces, skull crown, charms
    const wood = c.wood || '#5a3e28', moss = c.secondary || '#7a9a3a';
    R.add('body', G.dodec(0.6), moss, { p: [0, 0.2, 0], s: [1.6, 0.5, 1.6] });
    R.add('body', G.tprism(0.7, 0.7, 0.55, 0.55, 2.3, 7), wood, { p: [0, 1.2, 0] });
    for (const y of [0.75, 1.55]) { R.add('body', G.cbox(0.5, 0.12, 0.1, 0.03), '#2a1a10', { p: [0, y, 0.33] }); R.sym('body', G.cbox(0.12, 0.1, 0.08, 0.02), glow, { p: [0.14, y + 0.2, 0.33], glow: 1.6 }); }
    R.add('body', G.band(0.37, 0.06, 0.12, 8), moss, { p: [0, 1.15, 0] });
    R.add('body', G.sph(0.45, 8, 6), '#ece4cc', { p: [0, 2.65, 0], s: [1, 1.05, 1.1] });
    R.add('body', G.cbox(0.4, 0.2, 0.3, 0.05), '#ece4cc', { p: [0, 2.42, 0.22] });
    R.sym('body', G.cbox(0.13, 0.11, 0.06, 0.02), glow, { p: [0.15, 2.7, 0.42], glow: 2.2 });
    R.sym('body', G.horn(0.75, 0.08, 0.5, 5, 4), '#ece4cc', { p: [0.38, 2.85, -0.05], r: [-0.3, 0, -1.0] });
    for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + 0.4; R.add('body', G.cyl(0.01, 0.01, 0.5, 3), '#3a3028', { p: [Math.cos(a) * 0.48, 1.85, Math.sin(a) * 0.48] }); R.add('body', G.gem(0.08, 0.2, 4), vfx, { p: [Math.cos(a) * 0.48, 1.55, Math.sin(a) * 0.48], glow: 1.6 }); }
    height = 3.4;
  } else if (model === 'lumi_mark') { // floating star mark with orbit rings
    R.bone('spin', 'body', [0, 1.4, 0]);
    R.add('spin', G.star(0.75, 0.3, 0.16), vfx, { glow: 1.6 });
    R.add('spin', G.star(0.42, 0.17, 0.2), c.vfx2 || '#ffffff', { glow: 2.2 });
    R.add('spin', G.torus(1.0, 0.035, 3, 20), c.vfx2 || '#ffffff', { r: [PI / 2 - 0.3, 0, 0], glow: 1.8 });
    R.add('spin', G.torus(0.85, 0.03, 3, 20), vfx, { r: [PI / 2 + 0.5, 0.4, 0], glow: 1.8 });
    R.add('body', G.cyl(0.6, 0.6, 0.04, 16), vfx, { p: [0, 0.06, 0], glow: 0.8 });
    spin = 'spin'; height = 2.2;
  } else if (/lantern|ward/.test(model)) {
    R.add('body', G.cyl(0.08, 0.1, 2.2, 5), '#5a4030', { p: [0, 1.1, 0] });
    R.add('body', G.box(0.7, 0.08, 0.08), '#5a4030', { p: [0.3, 2.1, 0] });
    R.bone('spin', 'body', [0.6, 1.75, 0]);
    R.add('spin', G.box(0.36, 0.44, 0.36), '#3a3028', {}); R.add('spin', G.ico(0.2, 0), glow, { glow: true }); R.add('spin', G.cone(0.28, 0.2, 4), '#3a3028', { p: [0, 0.3, 0], r: [0, PI / 4, 0] });
    height = 2.6;
  } else if (model.startsWith('pip')) {
    R.add('body', G.cyl(0.5, 0.7, 0.6, 6), c.mech2 || '#3a3f4a', { p: [0, 0.3, 0] });
    R.add('body', G.box(0.7, 0.55, 0.7), c.mech || '#f2c230', { p: [0, 0.85, 0] });
    R.add('body', G.cyl(0.12, 0.12, 0.9, 6), c.metal || '#9aa4ae', { p: [0, 0.95, 0.55], r: [PI / 2, 0, 0] });
    R.add('body', G.box(0.4, 0.12, 0.05), glow, { p: [0, 1.0, 0.36], glow: true });
    height = 1.6;
  } else { // generic summon: crystal obelisk
    R.add('body', G.cyl(0.6, 0.8, 0.3, 6), '#7a7a80', { p: [0, 0.15, 0] });
    R.add('body', G.oct(0.6), vfx, { p: [0, 1.4, 0], s: [0.7, 1.6, 0.7], glow: true });
    height = 2.4;
  }
  const rig = R.build({ rim: vfx, rimStrength: 0.5 });
  rig.def = { style: 'summon', height, spin };
  return rig;
}
