// Hero model recipes (HEROES lead). Each recipe authors parts on a humanoid (or custom) bone rig,
// baked into ONE skinned mesh by Rig.build(). Animation data (attack/cast clips, rest pose, trails)
// lives in the returned def and is consumed by ../anim/animator.js.
import * as THREE from 'three';
import { Rig, G } from './builder.js';
import { skeleton, legs, arms, head, belt } from './kit.js';
import { getSkin } from '../../data/skins.js';
import { poseRig as animPose, playAction, flinch } from '../anim/animator.js';
import { buildPipSeat, pipBits } from './pip.js';
import { buildWolfRecipe, buildBoltRecipe } from './beasts.js';

const PI = Math.PI;
const mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const dark = (a, k = 0.6) => '#' + new THREE.Color(a).multiplyScalar(k).getHexString();
const GOLD = '#e8b84a';
export const HERO_SCALE = 1.15; // global in-game readability scale

// ═════════════════════════════════════════════════════════════ BRAM — tree-golem tank
function bram(c, p) {
  const R = new Rig();
  const d = skeleton(R, { hipY: 1.55, spineH: 0.62, chestH: 1.25, neck: 0.16, neckZ: 0.34, headR: 0.5, shoulderX: 1.28, shoulderY: 0.95, upper: 0.92, fore: 0.86, hipX: 0.5, footH: 0.2 });
  const bark = c.primary, bark2 = c.secondary, moss = c.accent, stone = c.metal, glow = c.glow, core = c.skin;
  // pelvis & bark skirt
  R.add('hips', G.tprism(1.35, 1.0, 1.55, 1.1, 0.55, 8), bark2, { p: [0, -0.05, 0] });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2 + 0.2; R.add('hips', G.cbox(0.42, 0.62 - (i % 2) * 0.14, 0.14, 0.04), i % 2 ? bark : bark2, { p: [Math.sin(a) * 0.78, -0.3, Math.cos(a) * 0.58], r: [Math.cos(a) * 0.25, a, -Math.sin(a) * 0.25] }); }
  // belly + barrel chest (trunk)
  R.add('spine', G.tprism(1.5, 1.1, 1.9, 1.35, 0.7, 8), bark, { p: [0, 0.32, 0] });
  R.add('chest', G.tprism(2.05, 1.45, 2.35, 1.55, 1.3, 8), bark, { p: [0, 0.62, 0] });
  R.add('chest', G.tprism(2.2, 1.5, 1.6, 1.05, 0.35, 8), bark2, { p: [0, 1.4, -0.02] });
  // vertical bark planks / ridges
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2 + 0.13; const fr = Math.cos(a) > 0.2; R.add('chest', G.cbox(0.3, 1.0 + (i % 3) * 0.18, 0.16, 0.05), i % 2 ? bark2 : dark(bark, 0.85), { p: [Math.sin(a) * 1.13, 0.6 + (i % 3) * 0.05, Math.cos(a) * 0.78], r: [fr ? -0.08 : 0.06, a, 0] }); }
  // glowing heartwood cracks (core rune)
  R.add('chest', G.gem(0.24, 0.62, 4), glow, { p: [0, 0.72, 0.8], r: [0, PI / 4, 0], glow: 0.9 });
  for (const [x, y, r, l] of [[0.24, 0.98, 0.7, 0.42], [-0.26, 0.95, -0.75, 0.38], [0.18, 0.45, -0.6, 0.34], [-0.2, 0.42, 0.65, 0.3], [0.5, 1.2, 1.2, 0.3], [-0.5, 1.16, -1.1, 0.3]]) R.add('chest', G.cbox(0.07, l, 0.05, 0.01), glow, { p: [x, y, 0.81], r: [0, 0, r], glow: 0.7 });
  if (p.shield === 'magma') for (let i = 0; i < 7; i++) { const a = i * 0.9 - 2.7; R.add('chest', G.cbox(0.06, 0.55, 0.05, 0.01), glow, { p: [Math.sin(a) * 1.1, 0.4 + (i % 3) * 0.3, Math.cos(a) * 0.76], r: [0, a, 0.4 * ((i % 3) - 1)], glow: 1.2 }); }
  // moss mantle over shoulders/back
  R.add('chest', G.ico(0.95, 1), moss, { p: [0, 1.36, -0.35], s: [1.35, 0.4, 0.85] });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; R.add('chest', G.cone(0.13, 0.42, 4), dark(moss, 0.8), { p: [Math.sin(a) * 1.05, 1.15, Math.cos(a) * 0.55 - 0.2], r: [PI, 0, 0] }); }
  // back branches with leaf / crystal clusters
  for (const sx of [1, -1]) {
    R.add('chest', G.tube([[sx * 0.4, 1.3, -0.6], [sx * 0.75, 2.0, -0.95], [sx * 0.95, 2.65, -0.85]], 0.17, 0.05, 5, 5), bark, {});
    R.add('chest', G.tube([[sx * 0.75, 2.0, -0.95], [sx * 1.25, 2.25, -1.1]], 0.08, 0.03, 4, 2), bark, {});
    const leafC = p.crown === 'horns' ? glow : p.crown === 'icicles' ? moss : moss;
    if (p.crown === 'icicles') { for (let k = 0; k < 3; k++) R.add('chest', G.gem(0.16, 0.7, 5), leafC, { p: [sx * (0.95 + k * 0.15), 2.75 + k * 0.1, -0.85 - k * 0.1], r: [0, 0, sx * k * 0.3], glow: 0.35 }); }
    else if (p.crown === 'horns') { R.add('chest', G.dodec(0.28), dark(bark, 0.7), { p: [sx * 0.95, 2.7, -0.85] }); R.add('chest', G.gem(0.12, 0.5, 4), glow, { p: [sx * 0.95, 2.95, -0.85], glow: 1.5 }); }
    else { R.add('chest', G.ico(0.42, 0), leafC, { p: [sx * 0.95, 2.78, -0.85], s: [1.1, 0.8, 1] }); R.add('chest', G.ico(0.3, 0), mix(leafC, '#ffffff', 0.15), { p: [sx * 1.3, 2.32, -1.1] }); if (p.crown === 'blossom') { for (let k = 0; k < 3; k++) R.add('chest', G.ico(0.1, 0), '#fff4fa', { p: [sx * (0.85 + k * 0.15), 3.05, -0.75 - k * 0.12], glow: 0.3 }); } }
  }
  // boulder pauldrons
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    R.add('shoulder' + s, G.dodec(0.66), stone, { p: [sx * 0.05, 0.12, 0], s: [1.15, 0.85, 1.05], rough: 0.85 });
    R.add('shoulder' + s, G.ico(0.48, 1), moss, { p: [sx * 0.08, 0.48, -0.05], s: [1.25, 0.45, 1.15] });
    R.add('shoulder' + s, G.gem(0.1, 0.4, 4), glow, { p: [sx * 0.42, 0.3, 0.42], glow: 1.2 });
  }
  // head: sunk bark stump with glowing eyes + mossy beard
  R.add('head', G.tprism(0.95, 0.85, 0.8, 0.72, 0.78, 7), bark2, { p: [0, 0.32, 0] });
  R.add('head', G.cbox(1.0, 0.2, 0.42, 0.06), bark, { p: [0, 0.5, 0.3], r: [0.2, 0, 0] }); // brow ridge
  R.sym('head', G.cbox(0.2, 0.1, 0.06, 0.02), glow, { p: [0.2, 0.36, 0.45], r: [0, 0.2, -0.18], glow: 2 });
  R.add('head', G.cbox(0.34, 0.06, 0.06, 0.02), dark(core, 0.5), { p: [0, 0.12, 0.44] }); // mouth crack
  R.add('head', G.tbox(0.2, 0.16, 0.12, 0.12, 0.26), bark, { p: [0, 0.27, 0.48], r: [PI / 2 + 0.35, 0, 0] }); // knot nose
  for (let i = 0; i < 5; i++) R.add('head', G.cone(0.12, 0.5 - Math.abs(i - 2) * 0.08, 4), p.crown === 'icicles' ? moss : mix(moss, bark, 0.3), { p: [(i - 2) * 0.17, -0.12, 0.38], r: [PI - 0.25, 0, (i - 2) * 0.12] });
  // crown
  if (p.crown === 'icicles') for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2; R.add('head', G.gem(0.1, 0.7 + (i % 3) * 0.22, 5), moss, { p: [Math.sin(a) * 0.36, 0.95, Math.cos(a) * 0.3], r: [Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35], glow: 0.4 }); }
  else if (p.crown === 'horns') for (const sx of [1, -1]) { R.add('head', G.horn(1.0, 0.13, 0.5, 5, 5), dark(bark, 0.8), { p: [sx * 0.38, 0.62, 0.05], r: [-0.4, 0, -sx * 0.55] }); R.add('head', G.gem(0.07, 0.3, 4), glow, { p: [sx * 0.68, 1.4, -0.32], glow: 1.5 }); }
  else { const n = p.crown === 'blossom' ? 7 : 6; for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2; R.add('head', G.ico(0.27, 0), i % 2 ? moss : mix(moss, '#ffffff', 0.12), { p: [Math.sin(a) * 0.34, 0.82 + (i % 2) * 0.12, Math.cos(a) * 0.3] }); } if (p.crown === 'blossom') for (let i = 0; i < 5; i++) R.add('head', G.ico(0.1, 0), '#fff4fa', { p: [Math.sin(i * 1.3) * 0.42, 1.05, Math.cos(i * 1.3) * 0.36], glow: 0.3 }); }
  // arms: thick bark with stone fists
  arms(R, d, { upperW: 0.58, foreW: 0.68, hand: 0.36, sleeve: bark, forearm: bark2, bracer: bark, skin: core, glove: core });
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    R.add('fore' + s, G.cbox(0.5, 0.2, 0.5, 0.06), stone, { p: [0, -d.fore * 0.95, 0], rough: 0.8 });
    R.add('hand' + s, G.dodec(0.42), stone, { p: [0, -0.32, 0.06], s: [1.1, 1.0, 1.1], rough: 0.85 });
    for (let k = -1; k <= 1; k++) R.add('hand' + s, G.cbox(0.16, 0.16, 0.16, 0.04), dark(stone, 0.8), { p: [k * 0.17, -0.55, 0.26] });
    R.add('arm' + s, G.ico(0.18, 0), moss, { p: [sx * 0.2, -0.2, -0.1], s: [1, 0.6, 1] });
  }
  R.bone('fistTipR', 'handR', [0, -0.75, 0.15]);
  // shield (left forearm)
  R.bone('shield', 'foreL', [0.42, -d.fore * 0.55, 0.12], [0, 0, 0]);
  if (p.shield === 'crystal') { R.add('shield', G.gem(0.85, 2.2, 6, 0.5), stone, { r: [0, 0, 0], s: [0.38, 1, 1], metal: 0.3, rough: 0.2, glow: 0.15 }); R.add('shield', G.gem(0.35, 1.1, 6, 0.5), glow, { p: [0.18, 0, 0], s: [0.4, 1, 1], glow: 1.4 }); }
  else if (p.shield === 'flower') { R.add('shield', G.cyl(0.85, 0.85, 0.16, 10), stone, { r: [0, 0, PI / 2] }); for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; R.add('shield', G.leaf(0.6, 0.3, 0.08), moss, { p: [0.12, Math.sin(a) * 0.35, Math.cos(a) * 0.35], r: [-a, PI / 2, 0], rough: 0.6 }); } R.add('shield', G.ico(0.24, 1), glow, { p: [0.18, 0, 0], glow: 1.3 }); }
  else {
    R.add('shield', G.cbox(0.24, 1.55, 1.25, 0.1), stone, { rough: 0.85 });
    R.add('shield', G.cbox(0.12, 1.2, 0.95, 0.05), dark(stone, 0.75), { p: [0.1, 0, 0] });
    R.add('shield', G.cbox(0.08, 0.95, 0.12, 0.02), glow, { p: [0.17, 0, 0], glow: 0.9 });
    R.add('shield', G.cbox(0.08, 0.12, 0.65, 0.02), glow, { p: [0.17, 0.18, 0], glow: 0.9 });
    R.add('shield', G.ico(0.28, 0), moss, { p: [0.12, 0.72, -0.3], s: [0.8, 0.5, 1.2] });
  }
  // legs: stumpy roots
  legs(R, d, { thighW: 0.62, shinW: 0.66, pants: bark2, boot: bark, toe: 'root', bootH: 0.7, knee: stone });
  const def = {
    R, height: 4.9, style: 'smash', stride: 3.6, lean: 0.12, legSwing: 0.55, armSwing: 0.45, bob: 1.3,
    rest: { spine: [0.12, 0, 0], neck: [-0.1, 0, 0], armL: [0.05, 0, 0.18], armR: [0.05, 0, -0.18], foreL: [-0.3, 0, 0], foreR: [-0.2, 0, 0], thighL: [0, 0, 0.06], thighR: [0, 0, -0.06], shinL: [0, 0, -0.06], shinR: [0, 0, 0.06] },
    attacks: [
      { W: { armR: [-2.7, 0, -0.25], foreR: [-0.5, 0, 0], chest: [-0.2, 0.35, 0], spine: [-0.08, 0, 0], 'hips@p': [0, 0.05, -0.1] }, S: { armR: [-0.85, 0, 0.15], foreR: [-0.2, 0, 0], chest: [0.35, -0.28, 0], spine: [0.22, 0, 0], 'hips@p': [0, -0.2, 0.25], thighL: [-0.4, 0, 0], shinL: [0.5, 0, 0] } },
      { W: { armL: [-0.5, 0.6, 0.7], chest: [0, -0.55, 0], 'hips@p': [0, 0, -0.1] }, S: { armL: [-1.45, -0.3, 0], foreL: [-0.4, 0, 0], chest: [0.15, 0.45, 0], spine: [0.15, 0, 0], 'hips@p': [0, -0.1, 0.35], thighR: [0.3, 0, 0] } },
    ],
    casts: {
      q: { wind: 0.06, hold: 0.25, rec: 0.3, W: { armL: [-1.2, 0, 0.2], chest: [0.25, 0.4, 0], spine: [0.2, 0, 0] }, S: { armL: [-1.55, -0.25, 0], foreL: [-0.3, 0, 0], spine: [0.45, 0, 0], chest: [0.1, 0.35, 0], armR: [0.6, 0, -0.3], 'hips@p': [0, -0.15, 0.2] } },
      w: { wind: 0.12, hold: 0.2, rec: 0.35, W: { armL: [-2.8, 0, 0.35], armR: [-2.8, 0, -0.35], spine: [-0.25, 0, 0], 'hips@p': [0, 0.1, 0] }, S: { armL: [-1.1, 0, 0.25], armR: [-1.1, 0, -0.25], spine: [0.55, 0, 0], 'hips@p': [0, -0.4, 0], thighL: [-0.6, 0, 0], shinL: [0.8, 0, 0], thighR: [0.3, 0, 0], shinR: [0.6, 0, 0] } },
      r: { wind: 0.2, hold: 0.55, rec: 0.4, W: { armL: [-0.5, 0, 1.2], armR: [-0.5, 0, -1.2], spine: [0.3, 0, 0], 'hips@p': [0, -0.2, 0] }, S: { armL: [-2.9, 0, 0.6], armR: [-2.9, 0, -0.6], spine: [-0.3, 0, 0], head: [-0.5, 0, 0], 'hips@p': [0, 0.12, 0] } },
    },
    castFrom: { w: 'fistTipR', r: 'head' },
    dash: { spine: [0.5, 0, 0], armL: [-1.4, -0.3, 0], armR: [0.7, 0, -0.3], thighL: [-0.7, 0, 0], shinL: [0.6, 0, 0], thighR: [0.6, 0, 0], shinR: [0.5, 0, 0] },
    fidget: { dur: 1.6, pose: { armR: [-0.6, 0.6, -0.4], foreR: [-1.2, 0, 0], head: [0.2, -0.35, 0], chest: [0, 0.2, 0] } },
    trails: [{ base: 'handR', tip: 'fistTipR', life: 0.2, inner: 0.1 }],
  };
  return def;
}

// ═════════════════════════════════════════════════════════════ KAELA — flame duelist
function kaela(c, p) {
  const R = new Rig();
  const d = skeleton(R, { hipY: 1.6, spineH: 0.32, chestH: 0.62, neck: 0.12, headR: 0.42, shoulderX: 0.44, shoulderY: 0.52, upper: 0.56, fore: 0.5, hipX: 0.18, footH: 0.14 });
  const pri = c.primary, sec = c.secondary, metal = c.metal, glow = c.glow, skin = c.skin, hair = c.hair;
  // hips + tassets + belt
  R.add('hips', G.tprism(0.6, 0.4, 0.56, 0.38, 0.32, 8), sec, { p: [0, -0.06, 0] });
  belt(R, 'hips', 0.08, 0.3, 0.21, dark(sec, 0.7), GOLD, { buckleGlow: 0.3 });
  R.add('hips', G.tbox(0.3, 0.06, 0.4, 0.06, 0.62), pri, { p: [0, -0.32, 0.22], r: [-0.12, 0, 0] });
  R.add('hips', G.tbox(0.36, 0.06, 0.46, 0.06, 0.7), pri, { p: [0, -0.34, -0.22], r: [0.15, 0, 0] });
  R.sym('hips', G.tbox(0.2, 0.05, 0.26, 0.05, 0.5), metal, { p: [0.3, -0.22, 0.05], r: [0, 0, 0.25], metal: 0.85, rough: 0.3 });
  // sash (flowing)
  R.bone('sash', 'hips', [-0.22, 0.05, -0.15]);
  R.add('sash', G.cbox(0.16, 0.85, 0.05, 0.02), pri, { p: [0, -0.42, 0], r: [0, 0, 0.15] });
  R.add('sash', G.leaf(0.35, 0.12, 0.04), glow, { p: [0.06, -0.85, 0], r: [PI, 0, 0.15], glow: 1.4 });
  // midriff + armoured top
  R.add('spine', G.tprism(0.44, 0.32, 0.5, 0.34, 0.36, 8), skin, { p: [0, 0.16, 0] });
  R.add('chest', G.tprism(0.58, 0.38, 0.72, 0.44, 0.62, 8), pri, { p: [0, 0.3, 0] });
  R.add('chest', G.cbox(0.5, 0.36, 0.12, 0.05), metal, { p: [0, 0.38, 0.2], r: [-0.1, 0, 0], metal: 0.85, rough: 0.3 });
  R.add('chest', G.gem(0.07, 0.2, 4), glow, { p: [0, 0.4, 0.28], glow: 1.6 });
  R.add('chest', G.tprism(0.42, 0.3, 0.36, 0.26, 0.12, 8), sec, { p: [0, 0.65, 0] }); // collar
  // left pauldron (layered) + right wrap
  R.add('shoulderL', G.ico(0.22, 1), metal, { p: [0.06, 0.08, 0], s: [1.25, 0.85, 1.2], metal: 0.85, rough: 0.3 });
  R.add('shoulderL', G.cbox(0.4, 0.08, 0.38, 0.03), pri, { p: [0.12, -0.06, 0], r: [0, 0, -0.5] });
  R.add('shoulderL', G.cbox(0.36, 0.05, 0.34, 0.02), glow, { p: [0.16, -0.12, 0], r: [0, 0, -0.55], glow: 1.0 });
  for (let i = 0; i < 3; i++) R.add('shoulderL', G.cone(0.05, 0.22, 4), metal, { p: [0.05 + i * 0.08, 0.24, -0.08 + i * 0.06], r: [0, 0, -0.5], metal: 0.85, rough: 0.3 });
  R.add('shoulderR', G.ico(0.17, 1), sec, { p: [-0.04, 0.03, 0], s: [1.2, 0.8, 1.1] });
  // head + hair
  head(R, { r: d.headR, skin, mood: 'fierce', brow: dark(hair, 0.55), eye: '#3a1a10', mouthCol: '#8a3a3a' });
  R.add('head', G.sph(d.headR * 1.05, 9, 6), hair, { p: [0, d.headR * 1.05, -0.05], s: [1.04, 0.92, 1.05] });
  for (let i = 0; i < 5; i++) R.add('head', G.leaf(0.36, 0.14, 0.06), hair, { p: [(i - 2) * 0.13, d.headR * 1.5, 0.28], r: [-0.4 - Math.abs(i - 2) * 0.1, 0, (i - 2) * 0.35 + 0.2] });
  R.sym('head', G.leaf(0.42, 0.13, 0.05), hair, { p: [0.36, d.headR * 0.8, 0.1], r: [PI - 0.1, 0, 0.15] });
  R.sym('head', G.oct(0.045), glow, { p: [0.42, d.headR * 0.65, 0.02], glow: 1.5 }); // earrings
  R.bone('hair', 'head', [0, d.headR * 1.35, -0.32]);
  if (p.hair === 'bun') { R.add('head', G.ico(0.22, 1), hair, { p: [0, d.headR * 1.75, -0.22] }); R.add('head', G.cyl(0.02, 0.02, 0.7, 4), GOLD, { p: [0, d.headR * 1.78, -0.22], r: [0, 0, 1.3], metal: 0.9, rough: 0.3 }); R.add('head', G.oct(0.06), glow, { p: [0.34, d.headR * 1.86, -0.22], glow: 1.5 }); R.add('hair', G.leaf(0.4, 0.1, 0.04), hair, { p: [0, -0.2, 0], r: [PI, 0, 0] }); }
  else if (p.hair === 'crown') {
    for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.2; R.add('head', G.gem(0.06, 0.42 - Math.abs(i - 3) * 0.06, 4), glow, { p: [Math.sin(a) * 0.36, d.headR * 1.75 + Math.cos(a) * 0.08, Math.cos(a) * 0.1 - 0.04], r: [0, 0, -a * 0.55], glow: 1.4 }); }
    R.add('head', G.band(0.4, 0.06, 0.08, 12), GOLD, { p: [0, d.headR * 1.5, -0.04], r: [-0.15, 0, 0], metal: 0.95, rough: 0.25 });
    R.add('hair', G.tube([[0, 0, 0], [0, -0.4, -0.25], [0, -0.95, -0.3]], 0.2, 0.06, 6, 5), hair, {});
    R.add('hair', G.leaf(0.5, 0.18, 0.05), glow, { p: [0, -0.95, -0.3], r: [PI, 0, 0], glow: 1.1 });
  } else {
    R.add('head', G.band(0.13, 0.05, 0.1, 8), GOLD, { p: [0, d.headR * 1.4, -0.3], r: [1.2, 0, 0], metal: 0.95, rough: 0.25 });
    R.add('hair', G.tube([[0, 0, 0], [0, -0.1, -0.35], [0, -0.55, -0.55], [0, -1.0, -0.5]], 0.17, 0.06, 6, 6), hair, {});
    R.add('hair', G.leaf(0.55, 0.2, 0.05), glow, { p: [0, -0.98, -0.5], r: [PI + 0.2, 0, 0], glow: 1.2 });
    R.add('hair', G.leaf(0.4, 0.13, 0.05), mix(glow, '#ffffff', 0.4), { p: [0, -1.05, -0.48], r: [PI + 0.25, 0, 0], glow: 1.6 });
  }
  arms(R, d, { upperW: 0.25, foreW: 0.23, hand: 0.2, sleeve: skin, forearm: skin, bracer: metal, bracerMetal: 0.85, bracerTrim: glow, glove: sec, skin });
  if (p.blades === 'sun') { R.bone('sunHalo', 'chest', [0, 0.85, -0.45]); R.add('sunHalo', G.torus(0.62, 0.05, 4, 20), GOLD, { metal: 1, rough: 0.2, glow: 0.5 }); for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; R.add('sunHalo', G.gem(0.06, 0.34 + (i % 2) * 0.18, 4), glow, { p: [Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0], r: [0, 0, a - PI / 2], glow: 1.5 }); } }
  legs(R, d, { thighW: 0.36, shinW: 0.29, pants: sec, boot: pri, knee: metal, kneeMetal: 0.85, toe: 'pointy', cuff: GOLD, cuffMetal: 0.9 });
  // twin blades
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const W = 'blade' + s; R.bone(W, 'hand' + s, [0, -0.13, 0.06]);
    R.add(W, G.cyl(0.04, 0.04, 0.3, 6), dark(sec, 0.6), { r: [PI / 2, 0, 0], p: [0, 0, -0.04] });
    R.add(W, G.ico(0.06, 0), GOLD, { p: [0, 0, -0.22], metal: 0.9, rough: 0.3 });
    if (p.blades === 'katana') {
      R.add(W, G.cyl(0.12, 0.12, 0.04, 8), GOLD, { p: [0, 0, 0.13], r: [PI / 2, 0, 0], metal: 0.9, rough: 0.3 });
      R.add(W, G.blade(1.55, 0.12, 0.05, 0.08 * sx), metal, { p: [0, 0, 0.15], r: [PI / 2, 0, 0], metal: 0.95, rough: 0.2 });
      R.add(W, G.blade(1.35, 0.04, 0.06, 0.06 * sx), glow, { p: [0, 0.035, 0.2], r: [PI / 2, 0, 0], glow: 1.6 });
    } else if (p.blades === 'sun') {
      R.add(W, G.torus(0.17, 0.035, 4, 12), GOLD, { p: [0, 0, 0.14], metal: 0.95, rough: 0.25 });
      R.add(W, G.blade(1.35, 0.3, 0.06, 0.16 * sx), metal, { p: [0, 0, 0.14], r: [PI / 2, 0, 0], metal: 0.9, rough: 0.25 });
      R.add(W, G.blade(1.15, 0.12, 0.08, 0.1 * sx), glow, { p: [0, 0, 0.2], r: [PI / 2, 0, 0], glow: 1.7 });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; R.add(W, G.gem(0.035, 0.18, 4), glow, { p: [Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.14], r: [0, 0, a - PI / 2], glow: 1.5 }); }
    } else {
      R.add(W, G.cbox(0.34, 0.06, 0.08, 0.02), GOLD, { p: [0, 0, 0.12], metal: 0.9, rough: 0.3 });
      R.add(W, G.blade(1.6, 0.3, 0.06, 0.24 * sx), metal, { p: [0, 0, 0.14], r: [PI / 2, 0, 0], metal: 0.95, rough: 0.2 });
      R.add(W, G.blade(1.35, 0.1, 0.08, 0.17 * sx), glow, { p: [sx * 0.02, 0, 0.2], r: [PI / 2, 0, 0], glow: 1.1 });
    }
    R.bone('tip' + s, W, [0, 0, 1.7]);
  }
  return {
    R, height: 3.75, style: 'dual', stride: 3.4, lean: 0.28, legSwing: 0.85,
    rest: { armL: [-0.15, 0, 0.3], armR: [-0.15, 0, -0.3], foreL: [-0.45, 0, 0], foreR: [-0.45, 0, 0], handL: [0.5, 0.5, 0], handR: [0.5, -0.5, 0], thighL: [-0.08, 0, 0.06], thighR: [0.05, 0, -0.06], chest: [0, 0.12, 0] },
    runPose: { armL: [0.55, 0, 0.35], armR: [0.55, 0, -0.35], handL: [0.6, 0, 0], handR: [0.6, 0, 0] },
    attacks: [
      { W: { armR: [-1.3, 0.9, -1.0], foreR: [-0.5, 0, 0], chest: [0, 0.55, 0], 'hips@p': [0, 0, -0.05] }, S: { armR: [-1.35, -1.0, 0.25], foreR: [-0.2, 0, 0], chest: [0.12, -0.6, 0], 'hips@p': [0, -0.08, 0.3], thighL: [-0.5, 0, 0], shinL: [0.5, 0, 0] } },
      { W: { armL: [-1.3, -0.9, 1.0], foreL: [-0.5, 0, 0], chest: [0, -0.55, 0], 'hips@p': [0, 0, -0.05] }, S: { armL: [-1.35, 1.0, -0.25], foreL: [-0.2, 0, 0], chest: [0.12, 0.6, 0], 'hips@p': [0, -0.08, 0.3], thighR: [-0.5, 0, 0], shinR: [0.5, 0, 0] } },
      { W: { armL: [-2.7, 0, 0.45], armR: [-2.7, 0, -0.45], spine: [-0.2, 0, 0] }, S: { armL: [-0.9, 0, -0.35], armR: [-0.9, 0, 0.35], spine: [0.35, 0, 0], 'hips@p': [0, -0.2, 0.3], thighL: [-0.6, 0, 0], shinL: [0.7, 0, 0] } },
    ],
    casts: {
      q: { wind: 0.05, hold: 0.2, rec: 0.3, W: { spine: [0.3, 0, 0], 'hips@p': [0, -0.15, 0] }, S: { armL: [-1.55, 0, -0.25], armR: [-1.55, 0, 0.25], foreL: [0, 0, 0], spine: [0.5, 0, 0], thighL: [-0.85, 0, 0], shinL: [0.6, 0, 0], thighR: [0.65, 0, 0], shinR: [0.3, 0, 0], 'hips@p': [0, -0.28, 0.3], hair: [1.0, 0, 0] } },
      w: { wind: 0.05, hold: 0.6, rec: 0.3, W: {}, S: { armL: [-1.35, -0.55, -0.35], armR: [-1.35, 0.55, 0.35], foreL: [-0.9, 0, 0], foreR: [-0.9, 0, 0], handL: [-0.4, 0, 0], handR: [-0.4, 0, 0], spine: [-0.1, 0, 0], thighL: [-0.3, 0, 0.25], thighR: [0.2, 0, -0.25], shinL: [0.4, 0, 0], 'hips@p': [0, -0.15, 0] } },
      r: { wind: 0.16, hold: 0.5, rec: 0.4, W: { armL: [-1.0, -0.5, -0.4], armR: [-1.0, 0.5, 0.4], spine: [0.4, 0, 0], 'hips@p': [0, -0.25, 0] }, S: { armL: [-0.5, 0, 1.6], armR: [-0.5, 0, -1.6], spine: [-0.35, 0, 0], head: [-0.45, 0, 0], 'hips@p': [0, 0.18, 0], hair: [-0.6, 0, 0] } },
    },
    castFrom: { q: 'tipR', w: 'chest', r: 'chest' },
    extra: (b, st, time) => { if (b.sunHalo) b.sunHalo.rotation.z = time * 0.6; },
    dash: { spine: [0.6, 0, 0], head: [-0.35, 0, 0], armL: [1.0, 0, 0.5], armR: [1.0, 0, -0.5], thighL: [-0.8, 0, 0], shinL: [0.9, 0, 0], thighR: [0.6, 0, 0], shinR: [0.7, 0, 0], hair: [1.2, 0, 0], 'hips@p': [0, -0.2, 0] },
    fidget: { dur: 1.3, pose: { armR: [-1.6, -0.4, 0.2], foreR: [-0.3, 0, 0], handR: [0, 2.5, 0], head: [0, -0.4, 0] } },
    trails: [{ base: 'bladeR', tip: 'tipR' }, { base: 'bladeL', tip: 'tipL' }],
  };
}

// ═════════════════════════════════════════════════════════════ LUMI — floating star mage
function lumi(c, p) {
  const R = new Rig();
  const d = skeleton(R, { hipY: 1.45, spineH: 0.3, chestH: 0.56, neck: 0.12, headR: 0.44, shoulderX: 0.36, shoulderY: 0.48, upper: 0.5, fore: 0.46, noLegs: true });
  const pri = c.primary, sec = c.secondary, metal = c.metal, glow = c.glow, skin = c.skin, hair = c.hair, v2 = c.vfx2;
  // gown (skirt bone so it can flutter)
  R.bone('skirt', 'hips', [0, 0, 0]);
  R.add('skirt', G.lathe([[0.3, 0.05], [0.42, -0.35], [0.66, -0.85], [0.88, -1.25], [0.78, -1.32]], 10), sec, {});
  R.add('skirt', G.lathe([[0.32, 0.0], [0.5, -0.4], [0.78, -0.9], [0.98, -1.18], [0.9, -1.22]], 10), pri, { p: [0, 0, -0.04], s: [1, 1, 0.9] });
  R.add('skirt', G.band(0.95, 0.06, 0.07, 14), glow, { p: [0, -1.2, -0.03], s: [1, 1, 0.9], glow: 0.7 });
  for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2; R.add('skirt', G.star(0.07, 0.03, 0.02), v2, { p: [Math.sin(a) * 0.75, -0.75 - (i % 3) * 0.12, Math.cos(a) * 0.65], r: [0, a, 0], glow: 1.4 }); }
  R.add('skirt', G.cone(0.42, 1.1, 8), mix(glow, c.primary, 0.35), { p: [0, -1.75, 0], r: [PI, 0, 0], glow: 0.3 }); // comet tail
  R.add('skirt', G.cone(0.2, 0.7, 6), glow, { p: [0, -1.6, 0], r: [PI, 0, 0], glow: 0.6 });
  // bodice
  R.add('spine', G.tprism(0.44, 0.32, 0.5, 0.36, 0.34, 8), pri, { p: [0, 0.15, 0] });
  belt(R, 'spine', 0.02, 0.27, 0.2, metal, glow, { h: 0.1, buckleGlow: 1.2, bw: 0.12, bh: 0.12 });
  R.add('chest', G.tprism(0.56, 0.38, 0.64, 0.4, 0.56, 8), pri, { p: [0, 0.28, 0] });
  R.add('chest', G.tbox(0.24, 0.08, 0.34, 0.08, 0.5), sec, { p: [0, 0.3, 0.17] });
  R.add('chest', G.band(0.3, 0.07, 0.12, 10), metal, { p: [0, 0.6, 0], metal: 0.9, rough: 0.25 });
  R.add('chest', G.star(0.11, 0.045, 0.05), glow, { p: [0, 0.48, 0.24], glow: 1.8 });
  // cape with star field
  R.bone('cape', 'chest', [0, 0.58, -0.2]);
  R.add('cape', G.shape([[-0.32, 0], [0.32, 0], [0.62, -1.75], [0.25, -1.95], [0, -1.8], [-0.25, -1.95], [-0.62, -1.75]], 0.05), dark(pri, 0.75), { p: [0, 0, -0.04] });
  R.add('cape', G.shape([[-0.3, -0.02], [0.3, -0.02], [0.58, -1.7], [0.24, -1.88], [0, -1.74], [-0.24, -1.88], [-0.58, -1.7]], 0.03), sec, { p: [0, 0, 0.0] });
  for (let i = 0; i < 9; i++) R.add('cape', G.oct(0.04 + (i % 3) * 0.015), v2, { p: [Math.sin(i * 2.3) * 0.38, -0.35 - i * 0.15, -0.08], glow: 1.6 });
  // sleeves (bell) + arms
  arms(R, d, { upperW: 0.16, foreW: 0.14, hand: 0.14, sleeve: pri, forearm: skin, bracer: skin, glove: skin, skin });
  for (const s of ['L', 'R']) { R.add('fore' + s, G.lathe([[0.1, 0.05], [0.18, -0.2], [0.27, -0.42], [0.25, -0.45]], 8), sec, { p: [0, 0, 0] }); R.add('fore' + s, G.band(0.27, 0.04, 0.05, 8), glow, { p: [0, -0.43, 0], glow: 1.1 }); }
  R.add('shoulderL', G.ico(0.15, 1), pri, { s: [1.2, 0.9, 1.1] }); R.add('shoulderR', G.ico(0.15, 1), pri, { s: [1.2, 0.9, 1.1] });
  // head + hair
  head(R, { r: d.headR, skin, mood: 'kind', brow: dark(hair, 0.7), eye: '#4a2a8a', mouthCol: '#b05a6a' });
  R.add('head', G.sph(d.headR * 1.07, 9, 6), hair, { p: [0, d.headR * 1.05, -0.06], s: [1.05, 0.95, 1.08] });
  for (let i = 0; i < 4; i++) R.add('head', G.leaf(0.34, 0.15, 0.05), hair, { p: [(i - 1.5) * 0.17, d.headR * 1.5, 0.3], r: [-0.55, 0, (i - 1.5) * 0.3] });
  R.bone('hair', 'head', [0, d.headR * 1.1, -0.3]);
  R.add('hair', G.shape([[-0.38, 0], [0.38, 0], [0.45, -0.9], [0.15, -1.05], [0, -0.92], [-0.15, -1.05], [-0.45, -0.9]], 0.12), hair, { p: [0, 0, -0.06] });
  R.sym('head', G.leaf(0.6, 0.12, 0.05), hair, { p: [0.4, d.headR * 0.85, 0.12], r: [PI - 0.06, 0, 0.12] });
  if (p.hat === 'tiara') { R.add('head', G.torus(0.42, 0.03, 4, 14, PI), metal, { p: [0, d.headR * 1.55, 0.03], r: [-0.3, 0, 0], metal: 0.9, rough: 0.25 }); R.add('head', G.gem(0.08, 0.26, 4), glow, { p: [0, d.headR * 1.9, 0.18], glow: 1.8 }); R.sym('head', G.gem(0.05, 0.16, 4), v2, { p: [0.24, d.headR * 1.8, 0.15], glow: 1.5 }); }
  else if (p.hat === 'halo') { R.add('head', G.torus(0.55, 0.04, 4, 18), glow, { p: [0, d.headR * 2.2, -0.15], r: [PI / 2 - 0.35, 0, 0], glow: 1.8 }); R.add('head', G.star(0.14, 0.05, 0.03), glow, { p: [0, d.headR * 1.75, 0.3], glow: 1.8 }); for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; R.add('head', G.star(0.06, 0.025, 0.02), v2, { p: [Math.cos(a) * 0.55, d.headR * 2.2 + Math.sin(a) * 0.19, -0.15 + Math.sin(a) * 0.52], glow: 1.8 }); } }
  else {
    // big wizard hat with a bent tip and a star
    R.add('head', G.cyl(0.78, 0.82, 0.07, 14), pri, { p: [0, d.headR * 1.55, -0.04], r: [0.12, 0, 0] });
    R.add('head', G.band(0.47, 0.06, 0.14, 12), glow, { p: [0, d.headR * 1.68, -0.05], glow: 1.0 });
    R.add('head', G.tube([[0, d.headR * 1.6, -0.05], [0, d.headR * 2.4, -0.15], [0, d.headR * 3.0, -0.38], [0, d.headR * 3.1, -0.75]], 0.46, 0.04, 8, 7), pri, {});
    R.add('head', G.star(0.16, 0.065, 0.05), glow, { p: [0, d.headR * 3.08, -0.82], glow: 2 });
    for (let i = 0; i < 4; i++) R.add('head', G.oct(0.035), v2, { p: [Math.sin(i * 1.7) * 0.3, d.headR * (1.9 + i * 0.2), 0.12 - i * 0.07], glow: 1.6 });
  }
  // staff in right hand
  R.bone('staff', 'handR', [0, -0.14, 0.05]);
  R.add('staff', G.cyl(0.045, 0.06, 3.0, 6), metal, { p: [0, 0.6, 0], metal: 0.6, rough: 0.35 });
  R.add('staff', G.band(0.07, 0.04, 0.12, 6), glow, { p: [0, 1.4, 0], glow: 1 });
  R.add('staff', G.gem(0.08, 0.25, 4), glow, { p: [0, -0.95, 0], r: [PI, 0, 0], glow: 1.2 });
  R.bone('staffTop', 'staff', [0, 2.25, 0]);
  if (p.staff === 'moon') { R.add('staffTop', G.torus(0.36, 0.08, 4, 14, PI * 1.35), glow, { r: [0, 0, 0.45], glow: 1.6 }); R.add('staffTop', G.oct(0.12), v2, { glow: 2 }); }
  else if (p.staff === 'tristar') { for (let i = 0; i < 3; i++) R.add('staffTop', G.star(0.22, 0.09, 0.06), i ? v2 : glow, { p: [Math.sin(i * 2.1) * 0.28, Math.cos(i * 2.1) * 0.28, 0], glow: 1.8 }); R.add('staffTop', G.torus(0.3, 0.03, 3, 12), metal, { metal: 0.9, rough: 0.25 }); }
  else if (p.staff === 'galaxy') { R.add('staffTop', G.torus(0.45, 0.035, 3, 16), v2, { r: [PI / 2 - 0.4, 0, 0], glow: 1.8 }); R.add('staffTop', G.torus(0.36, 0.03, 3, 16), glow, { r: [PI / 2 + 0.6, 0.4, 0], glow: 1.8 }); R.add('staffTop', G.star(0.3, 0.12, 0.08), glow, { glow: 2 }); R.add('staffTop', G.ico(0.12, 1), '#ffffff', { glow: 2 }); }
  else { R.add('staffTop', G.star(0.34, 0.14, 0.1), glow, { glow: 1.2 }); R.add('staffTop', G.torus(0.22, 0.035, 4, 10), metal, { p: [0, -0.38, 0], r: [PI / 2, 0, 0], metal: 0.9, rough: 0.25 }); R.sym('staffTop', G.leaf(0.4, 0.12, 0.04), metal, { p: [0.12, -0.42, 0], r: [0, 0, -0.9], metal: 0.9, rough: 0.25 }); }
  if (p.hat === 'halo') { R.bone('starRing', 'hips', [0, 0.3, 0]); for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2; R.add('starRing', G.star(0.11, 0.045, 0.03), i % 2 ? glow : v2, { p: [Math.cos(a) * 1.25, Math.sin(a * 2) * 0.12, Math.sin(a) * 1.25], r: [0, -a, 0], glow: 1.8 }); } }
  R.bone('orbit', 'staffTop', [0, 0, 0]);
  R.add('orbit', G.star(0.12, 0.05, 0.04), v2, { p: [0.6, 0, 0], glow: 2 });
  R.add('orbit', G.oct(0.06), glow, { p: [-0.45, 0.2, 0.3], glow: 2 });
  // floating orb in the left hand
  R.bone('orb', 'handL', [0, -0.3, 0.18]);
  R.add('orb', G.ico(0.13, 1), v2, { glow: 1.1 });
  return {
    R, height: 4.2, style: 'staff', float: true, hover: 0.42, stride: 3, lean: 0.2,
    rest: { armL: [-0.35, 0, 0.3], foreL: [-0.6, 0, 0], armR: [-0.12, 0, -0.2], foreR: [-0.35, 0, 0], handR: [0.35, 0, 0] },
    attacks: [
      { W: { armR: [-0.4, 0.2, -0.45], foreR: [-0.6, 0, 0], chest: [0, 0.35, 0] }, S: { armR: [-1.45, -0.1, 0.1], foreR: [-0.1, 0, 0], handR: [-0.8, 0, 0], chest: [0.08, -0.3, 0], 'hips@p': [0, 0, 0.15] } },
      { W: { armL: [-0.3, 0, 0.8], chest: [0, -0.3, 0] }, S: { armL: [-1.5, 0, 0], foreL: [0, 0, 0], chest: [0.05, 0.3, 0], 'hips@p': [0, 0, 0.12] } },
    ],
    casts: {
      q: { wind: 0.06, hold: 0.2, rec: 0.3, W: { armR: [-0.3, 0, -0.5], chest: [0, 0.4, 0] }, S: { armR: [-1.55, -0.15, 0.15], foreR: [0, 0, 0], handR: [-1.0, 0, 0], chest: [0.1, -0.35, 0], 'hips@p': [0, 0, 0.2], cape: [0.4, 0, 0] } },
      w: { wind: 0.1, hold: 0.45, rec: 0.35, W: { armR: [-1.2, 0, -0.3] }, S: { armR: [-2.85, 0, -0.15], foreR: [0, 0, 0], armL: [-1.3, 0, 0.6], spine: [-0.2, 0, 0], head: [-0.3, 0, 0], 'hips@p': [0, 0.25, 0] } },
      r: { wind: 0.15, hold: 0.65, rec: 0.4, W: { armL: [-0.8, 0.5, -0.3], armR: [-0.8, -0.5, 0.3], spine: [0.3, 0, 0], 'hips@p': [0, -0.1, 0] }, S: { armL: [-2.6, 0, 0.8], armR: [-2.6, 0, -0.8], foreL: [0, 0, 0], foreR: [0, 0, 0], spine: [-0.32, 0, 0], head: [-0.45, 0, 0], 'hips@p': [0, 0.45, 0], cape: [0.6, 0, 0], skirt: [0.2, 0, 0] } },
    },
    muzzle: 'staffTop', castFrom: { q: 'staffTop', w: 'staffTop', r: 'staffTop' },
    dash: { spine: [0.5, 0, 0], cape: [1.0, 0, 0], skirt: [0.7, 0, 0], armL: [0.6, 0, 0.4] },
    recall: { armL: [-0.6, 0, 0.9], armR: [-0.6, 0, -0.9], head: [0.3, 0, 0], 'hips@p': [0, 0.3, 0], skirt: [0, 0, 0] },
    death: { 'root@p': [0, -0.6, -0.1], root: [-1.35, 0, 0.1], head: [-0.3, 0.4, 0], armL: [-0.4, 0, 1.3], armR: [-0.6, 0, -1.1] },
    fidget: { dur: 1.8, pose: { armL: [-1.4, 0.4, 0.2], foreL: [-0.6, 0, 0], head: [0.25, 0.4, 0] } },
    extra: (b, st, time) => { if (b.starRing) b.starRing.rotation.y = -time * 0.7; if (b.orbit) { b.orbit.rotation.y = time * 2.6; b.orbit.rotation.z = 0.35; } if (b.orb) { b.orb.position.y += Math.sin(time * 3) * 0.05; b.orb.rotation.y = time; } if (b.staffTop) b.staffTop.rotation.y = time * 0.8; },
    trails: [{ base: 'staff', tip: 'staffTop', life: 0.14, inner: 0.7 }],
  };
}

// ═════════════════════════════════════════════════════════════ VEX — long-rifle marksman
function vex(c, p) {
  const R = new Rig();
  const d = skeleton(R, { hipY: 1.6, spineH: 0.32, chestH: 0.62, neck: 0.12, headR: 0.41, shoulderX: 0.45, shoulderY: 0.52, upper: 0.56, fore: 0.5, hipX: 0.19, footH: 0.15 });
  const pri = c.primary, sec = c.secondary, metal = c.metal, glow = c.glow, skin = c.skin, hair = c.hair, wood = c.wood;
  const leather = '#4a3428', shirt = '#e8dcc8';
  // hips/coat skirt
  R.add('hips', G.tprism(0.6, 0.4, 0.56, 0.38, 0.3, 8), '#3a3036', { p: [0, -0.06, 0] });
  belt(R, 'hips', 0.08, 0.31, 0.22, leather, GOLD, { buckleGlow: 0.2 });
  R.sym('hips', G.cbox(0.16, 0.2, 0.12, 0.03), leather, { p: [0.3, -0.05, 0.12] });
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    R.bone('coat' + s, 'hips', [sx * 0.16, 0.1, -0.12]);
    R.add('coat' + s, G.shape([[-0.17, 0], [0.17, 0], [0.24, -1.05], [-0.15, -1.2]].map(([x, y]) => [x * sx, y]), 0.05), pri, { p: [0, -0.02, -0.08], r: [0.12, 0, 0] });
    R.add('coat' + s, G.shape([[-0.15, -0.05], [0.15, -0.05], [0.21, -1.0], [-0.13, -1.13]].map(([x, y]) => [x * sx, y]), 0.03), sec, { p: [0, -0.02, -0.03], r: [0.12, 0, 0] });
  }
  R.sym('hips', G.shape([[0, 0], [0.22, 0], [0.24, -0.6], [0.04, -0.66]], 0.04), pri, { p: [0.06, -0.02, 0.24] });
  // torso: coat + shirt + lapels + bandolier
  R.add('spine', G.tprism(0.46, 0.32, 0.52, 0.36, 0.36, 8), shirt, { p: [0, 0.16, 0] });
  R.add('chest', G.tprism(0.6, 0.4, 0.74, 0.46, 0.62, 8), pri, { p: [0, 0.3, 0] });
  R.add('chest', G.tbox(0.22, 0.06, 0.28, 0.06, 0.58), shirt, { p: [0, 0.32, 0.2] });
  R.sym('chest', G.shape([[0, 0], [0.16, 0.02], [0.08, -0.48], [0, -0.52]], 0.04), sec, { p: [0.1, 0.62, 0.22], r: [0.08, 0, 0] });
  R.add('chest', G.cbox(0.11, 0.98, 0.05, 0.02), leather, { p: [0, 0.32, 0.25], r: [0, 0, 0.65] });
  for (let i = 0; i < 5; i++) R.add('chest', G.cyl(0.035, 0.035, 0.13, 6), GOLD, { p: [-0.24 + i * 0.12, 0.08 + i * 0.105, 0.29], r: [0, 0, 0.65], metal: 0.95, rough: 0.25 });
  for (const s of ['L', 'R']) R.add('shoulder' + s, G.ico(0.18, 1), pri, { s: [1.25, 0.8, 1.15] });
  // scarf
  R.add('chest', G.torus(0.22, 0.1, 5, 10), sec, { p: [0, 0.66, 0], r: [PI / 2, 0, 0] });
  R.bone('scarf', 'chest', [0.08, 0.6, -0.2]);
  R.add('scarf', G.shape([[-0.08, 0], [0.08, 0], [0.1, -0.85], [-0.02, -0.95]], 0.04), sec, { r: [0, 0, 0.1] });
  R.add('scarf', G.shape([[-0.08, 0], [0.07, 0], [0.04, -0.62], [-0.08, -0.7]], 0.04), dark(sec, 0.85), { p: [-0.12, 0, 0.02], r: [0, 0, -0.12] });
  // head
  head(R, { r: d.headR, skin, mood: 'smirk', brow: dark(hair, 0.8), eye: '#2a3a3a', mouthCol: '#7a3a30' });
  R.add('head', G.sph(d.headR * 1.04, 9, 6), hair, { p: [0, d.headR * 1.08, -0.07], s: [1.03, 0.9, 1.05] });
  R.add('head', G.tube([[0, d.headR * 1.2, -0.35], [0, d.headR * 0.6, -0.55], [0, d.headR * 0.1, -0.5]], 0.12, 0.05, 5, 4), hair, {});
  if (p.hat === 'visor') {
    R.add('head', G.cbox(0.82, 0.13, 0.2, 0.05), glow, { p: [0, d.headR * 1.05, d.headR * 0.85], r: [-0.05, 0, 0], glow: 1.8 });
    R.add('head', G.cbox(0.88, 0.2, 0.2, 0.05), metal, { p: [0, d.headR * 1.05, d.headR * 0.72], metal: 0.8, rough: 0.3 });
    for (let i = 0; i < 5; i++) R.add('head', G.cone(0.1, 0.55, 4), hair, { p: [(i - 2) * 0.13, d.headR * 1.8, -0.08 - Math.abs(i - 2) * 0.04], r: [-0.65, 0, (i - 2) * 0.22], glow: 0.25 });
  } else if (p.hat === 'wide') {
    R.add('head', G.cyl(0.9, 0.95, 0.06, 14), pri, { p: [0, d.headR * 1.6, 0], r: [0.08, 0, 0] });
    R.add('head', G.tprism(0.6, 0.6, 0.48, 0.48, 0.38, 10), pri, { p: [0, d.headR * 1.88, 0] });
    R.add('head', G.band(0.31, 0.04, 0.1, 10), sec, { p: [0, d.headR * 1.72, 0] });
    R.add('head', G.leaf(0.4, 0.08, 0.03), '#f0e0c0', { p: [-0.25, d.headR * 1.9, -0.1], r: [-0.3, 0, 0.7] });
  } else if (p.hat === 'dragon') {
    R.add('head', G.tprism(0.82, 0.82, 0.7, 0.7, 0.3, 8), wood, { p: [0, d.headR * 1.65, 0], rough: 0.6 });
    R.sym('head', G.horn(0.9, 0.08, 0.6, 5, 5), wood, { p: [0.28, d.headR * 1.8, -0.1], r: [-0.9, 0, -0.45] });
    R.add('head', G.cone(0.2, 0.42, 5), wood, { p: [0, d.headR * 1.55, 0.45], r: [PI / 2, 0, 0] });
    R.add('head', G.cbox(0.5, 0.06, 0.05, 0.02), glow, { p: [0, d.headR * 1.5, 0.4], glow: 1.8 });
  } else {
    // tricorn
    R.add('head', G.cyl(0.78, 0.82, 0.07, 3), pri, { p: [0, d.headR * 1.62, 0.02], r: [0, PI, 0] });
    R.add('head', G.lathe([[0.42, 0], [0.4, 0.2], [0.28, 0.38], [0.0, 0.42]], 9), pri, { p: [0, d.headR * 1.62, 0] });
    R.add('head', G.band(0.42, 0.05, 0.09, 9), sec, { p: [0, d.headR * 1.7, 0] });
    R.add('head', G.leaf(0.65, 0.12, 0.03), '#d84a3a', { p: [-0.3, d.headR * 1.85, -0.15], r: [-0.5, 0, 0.8] });
    R.add('head', G.cbox(0.16, 0.16, 0.05, 0.02), GOLD, { p: [0.0, d.headR * 1.75, 0.45], r: [0, 0, PI / 4], metal: 0.9, rough: 0.25 });
  }
  arms(R, d, { upperW: 0.2, foreW: 0.19, hand: 0.15, sleeve: pri, forearm: pri, bracer: leather, bracerTrim: GOLD, glove: leather, skin });
  for (const s of ['L', 'R']) R.add('fore' + s, G.tprism(0.28, 0.28, 0.24, 0.24, 0.1, 8), sec, { p: [0, -d.fore * 0.45, 0] });
  legs(R, d, { thighW: 0.27, shinW: 0.23, pants: '#3a3036', boot: leather, cuff: dark(leather, 0.7), knee: dark(leather, 0.8), toe: 'round', bootH: 0.75 });
  // rifle (held at the chest)
  R.bone('gun', 'chest', [-0.2, 0.22, 0.42]);
  const mz = (z) => R.bone('muzzle', 'gun', [0, 0.06, z]);
  if (p.rifle === 'neon') {
    R.add('gun', G.cbox(0.18, 0.26, 1.05, 0.05), wood, { p: [0, -0.02, 0.0] });
    R.add('gun', G.cbox(0.14, 0.14, 1.7, 0.04), metal, { p: [0, 0.06, 1.25], metal: 0.8, rough: 0.3 });
    R.add('gun', G.cbox(0.04, 0.04, 2.1, 0.01), glow, { p: [0.08, 0.08, 0.95], glow: 1.8 });
    R.add('gun', G.cbox(0.04, 0.04, 2.1, 0.01), c.vfx2, { p: [-0.08, 0.08, 0.95], glow: 1.8 });
    R.add('gun', G.cyl(0.09, 0.09, 0.55, 8), metal, { p: [0, 0.25, 0.45], r: [PI / 2, 0, 0], metal: 0.8, rough: 0.3 });
    R.add('gun', G.cyl(0.07, 0.07, 0.03, 8), glow, { p: [0, 0.25, 0.74], r: [PI / 2, 0, 0], glow: 2 });
    R.add('gun', G.cbox(0.06, 0.3, 0.12, 0.02), metal, { p: [0, -0.2, 0.25], r: [0.3, 0, 0] });
    mz(2.15);
  } else if (p.rifle === 'dragon') {
    R.add('gun', G.cbox(0.2, 0.28, 0.95, 0.06), wood, { p: [0, -0.02, 0] });
    R.add('gun', G.cyl(0.07, 0.11, 1.7, 7), wood, { p: [0, 0.05, 1.25], r: [PI / 2, 0, 0] });
    for (let i = 0; i < 6; i++) R.add('gun', G.cone(0.05, 0.24, 4), wood, { p: [0, 0.18, 0.55 + i * 0.27], r: [-0.45, 0, 0] });
    R.add('gun', G.cone(0.2, 0.5, 6), metal, { p: [0, 0.05, 2.2], r: [PI / 2, 0, 0], metal: 0.6, rough: 0.4 });
    R.add('gun', G.ico(0.11, 0), glow, { p: [0, 0.05, 2.12], glow: 2 });
    R.sym('gun', G.horn(0.4, 0.05, 0.4, 4, 3), wood, { p: [0.12, 0.15, 1.95], r: [-0.9, 0, -0.4] });
    R.add('gun', G.cyl(0.07, 0.07, 0.45, 7), metal, { p: [0, 0.24, 0.5], r: [PI / 2, 0, 0], metal: 0.6, rough: 0.35 });
    mz(2.45);
  } else {
    R.add('gun', G.cbox(0.17, 0.25, 1.0, 0.05), wood, { p: [0, -0.03, 0.02] });
    R.add('gun', G.cbox(0.2, 0.2, 0.42, 0.04), metal, { p: [0, 0.04, 0.5], metal: 0.8, rough: 0.35 });
    R.add('gun', G.cyl(0.055, 0.055, 2.1, 7), metal, { p: [0, 0.07, 1.62], r: [PI / 2, 0, 0], metal: 0.85, rough: 0.3 });
    R.add('gun', G.cyl(0.085, 0.085, 0.2, 7), metal, { p: [0, 0.07, 2.6], r: [PI / 2, 0, 0], metal: 0.85, rough: 0.3 });
    R.add('gun', G.cbox(0.13, 0.12, 0.7, 0.03), wood, { p: [0, -0.02, 1.05] });
    R.add('gun', G.cyl(0.075, 0.075, 0.58, 8), dark(metal, 0.8), { p: [0, 0.27, 0.58], r: [PI / 2, 0, 0], metal: 0.8, rough: 0.3 });
    R.add('gun', G.cyl(0.06, 0.06, 0.03, 8), glow, { p: [0, 0.27, 0.88], r: [PI / 2, 0, 0], glow: 2 });
    R.add('gun', G.band(0.07, 0.025, 0.05, 8), GOLD, { p: [0, 0.07, 2.0], r: [PI / 2, 0, 0], metal: 0.95, rough: 0.25 });
    R.add('gun', G.cbox(0.06, 0.06, 0.2, 0.02), sec, { p: [0, -0.15, 0.6] });
    mz(2.72);
  }
  return {
    R, height: 3.85, style: 'rifle', stride: 3.3, lean: 0.2, legSwing: 0.78,
    rest: { armR: [-0.95, 0.35, 0.15], foreR: [-0.9, 0, 0], armL: [-1.25, -0.55, -0.35], foreL: [-0.55, 0, 0], chest: [0, -0.1, 0], head: [0, 0.1, 0] },
    runPose: { gun: [0.25, 0, 0], armR: [0.25, 0, 0], armL: [0.25, 0, 0] }, armSwing: 0.12,
    attacks: [
      { W: { chest: [0.05, 0, 0], head: [0.06, 0, 0], gun: [-0.02, 0, 0] }, S: { 'gun@p': [0, 0.06, -0.4], gun: [-0.25, 0, 0], chest: [-0.16, 0, 0], head: [-0.1, 0, 0], 'hips@p': [0, 0, -0.12], armL: [0.15, 0, 0], armR: [0.25, 0, 0] } },
    ],
    casts: {
      q: { wind: 0.05, hold: 0.15, rec: 0.3, W: { chest: [0, 0.35, 0] }, S: { 'gun@p': [0, 0.08, -0.45], gun: [-0.35, 0, 0], chest: [-0.2, -0.25, 0], 'hips@p': [0, 0, -0.15] } },
      w: { wind: 0.02, hold: 0.25, rec: 0.25, W: {}, S: { 'hips@p': [0, -0.6, 0], spine: [0.7, 0, 0], thighL: [-1.4, 0, 0], shinL: [1.9, 0, 0], thighR: [-1.2, 0, 0], shinR: [1.9, 0, 0], head: [0.4, 0, 0], coatL: [1.2, 0, 0], coatR: [1.2, 0, 0] }, fn: (b, A) => { const k = Math.min(1, A.t / 0.32); b.root.rotation.x += k < 1 ? Math.sin(k * PI) * 0.0 + k * PI * 2 : 0; b.root.position.y += Math.sin(Math.min(1, k) * PI) * 0.5; } },
      r: { wind: 0.12, hold: 1.15, rec: 0.35, W: { 'hips@p': [0, -0.55, 0], thighL: [-1.3, 0, 0], shinL: [1.3, 0, 0], thighR: [0.15, 0, 0], shinR: [1.6, 0, 0], footR: [0.5, 0, 0], spine: [0.15, 0, 0] }, S: { 'hips@p': [0, -0.55, 0], thighL: [-1.3, 0, 0], shinL: [1.3, 0, 0], thighR: [0.15, 0, 0], shinR: [1.6, 0, 0], footR: [0.5, 0, 0], spine: [0.15, 0, 0], head: [0.15, 0, 0], gun: [-0.03, 0, 0] }, fn: (b, A) => { const t = A.t - 1.2; if (t > 0 && t < 0.4) { const k = Math.sin(Math.min(1, t / 0.4) * PI); b.gun.position.z -= 0.6 * k; b.gun.rotation.x -= 0.5 * k; b.chest.rotation.x -= 0.3 * k; } } },
    },
    muzzle: 'muzzle', castFrom: { q: 'muzzle', w: null, r: 'muzzle' },
    fidget: { dur: 1.6, pose: { head: [0, 0.6, 0], chest: [0, 0.2, 0] }, fn: (b, k) => { if (b.gun) b.gun.rotation.z += Math.sin(Math.min(1, k) * PI) * 0.4; } },
    trails: null,
  };
}

// ═════════════════════════════════════════════════════════════ NYX — hooded shadow assassin
function nyx(c, p) {
  const R = new Rig();
  const d = skeleton(R, { hipY: 1.5, spineH: 0.3, chestH: 0.56, neck: 0.12, headR: 0.38, shoulderX: 0.4, shoulderY: 0.48, upper: 0.54, fore: 0.5, hipX: 0.17, footH: 0.14 });
  const pri = c.primary, sec = c.secondary, metal = c.metal, glow = c.glow, skin = c.skin;
  const black = '#120e18';
  R.add('hips', G.tprism(0.52, 0.36, 0.5, 0.34, 0.3, 8), pri, { p: [0, -0.06, 0] });
  belt(R, 'hips', 0.06, 0.27, 0.19, sec, metal, { h: 0.08 });
  R.add('hips', G.shape([[-0.18, 0], [0.18, 0], [0.12, -0.62], [0, -0.75], [-0.12, -0.62]], 0.04), sec, { p: [0, -0.05, 0.2] });
  R.add('spine', G.tprism(0.4, 0.3, 0.48, 0.34, 0.34, 8), pri, { p: [0, 0.15, 0] });
  R.add('chest', G.tprism(0.54, 0.36, 0.66, 0.42, 0.56, 8), pri, { p: [0, 0.28, 0] });
  R.add('chest', G.cbox(0.08, 0.72, 0.06, 0.02), sec, { p: [0.06, 0.3, 0.22], r: [0, 0, 0.6] });
  R.add('chest', G.cbox(0.08, 0.72, 0.06, 0.02), sec, { p: [-0.06, 0.3, 0.22], r: [0, 0, -0.6] });
  R.add('chest', G.gem(0.06, 0.18, 4), glow, { p: [0, 0.3, 0.27], glow: 2 });
  for (const s of ['L', 'R']) { R.add('shoulder' + s, G.ico(0.17, 1), sec, { s: [1.25, 0.8, 1.15] }); R.add('shoulder' + s, G.cbox(0.3, 0.05, 0.26, 0.02), metal, { p: [0, 0.1, 0], r: [0, 0, s === 'L' ? -0.4 : 0.4], metal: 0.8, rough: 0.3 }); }
  // tattered cloak
  R.bone('cape', 'chest', [0, 0.56, -0.2]);
  const rag = [[-0.32, 0], [0.32, 0], [0.62, -1.3], [0.48, -1.55], [0.36, -1.35], [0.22, -1.62], [0.08, -1.4], [-0.06, -1.66], [-0.2, -1.38], [-0.34, -1.58], [-0.46, -1.32], [-0.62, -1.42]];
  R.add('cape', G.shape(rag, 0.05), pri, { p: [0, 0, -0.03] });
  R.add('cape', G.shape(rag.map(([x, y]) => [x * 0.92, y * 0.95]), 0.03), dark(sec, 0.6), { p: [0, 0, 0.01] });
  // hood + mask
  R.add('head', G.sph(d.headR * 0.9, 9, 7), black, { p: [0, d.headR * 0.95, 0.0] });
  R.add('head', G.cbox(0.62, 0.32, 0.12, 0.05), black, { p: [0, d.headR * 0.62, d.headR * 0.78] });
  R.sym('head', G.cbox(0.16, 0.05, 0.05, 0.015), glow, { p: [0.13, d.headR * 1.02, d.headR * 0.9], r: [0, 0.25, -0.3], glow: 2.4 });
  R.add('head', G.lathe([[0.0, 1.05], [0.32, 0.98], [0.52, 0.66], [0.56, 0.2], [0.5, -0.12], [0.42, -0.2]], 9), pri, { p: [0, d.headR * 0.55, -0.07], s: [1.05, 1.05, 1.12] });
  R.add('head', G.tube([[0, d.headR * 1.45, -0.15], [0, d.headR * 1.7, -0.45], [0, d.headR * 1.55, -0.8]], 0.2, 0.03, 6, 5), pri, {});
  R.add('head', G.torus(0.42, 0.06, 4, 12, PI * 1.1), dark(pri, 0.7), { p: [0, d.headR * 0.85, 0.12], r: [0.2, 0, -PI * 0.05] , s: [1, 1.15, 1] });
  if (p.hood === 'horns') { R.sym('head', G.horn(0.75, 0.07, 0.5, 5, 5), sec, { p: [0.28, d.headR * 1.4, 0.05], r: [-0.4, 0, -0.5] }); R.sym('head', G.gem(0.05, 0.16, 4), glow, { p: [0.56, d.headR * 2.4, -0.38], glow: 2 }); }
  if (p.hood === 'moon') R.add('head', G.torus(0.22, 0.05, 4, 10, PI * 1.25), glow, { p: [0, d.headR * 1.8, 0.1], r: [0, 0, -0.65], glow: 1.8 });
  arms(R, d, { upperW: 0.17, foreW: 0.16, hand: 0.14, sleeve: pri, forearm: sec, bracer: metal, bracerMetal: 0.8, glove: black, skin });
  legs(R, d, { thighW: 0.25, shinW: 0.21, pants: pri, boot: sec, knee: metal, kneeMetal: 0.8, toe: 'pointy', bootH: 0.7 });
  // daggers (reverse grip: blade runs back along the forearm then flips forward on strikes)
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const W = 'blade' + s; R.bone(W, 'hand' + s, [0, -0.13, 0.04], [0.4, 0, 0]);
    R.add(W, G.cyl(0.035, 0.035, 0.22, 6), black, { r: [PI / 2, 0, 0] });
    R.add(W, G.cbox(0.24, 0.05, 0.06, 0.02), metal, { p: [0, 0, 0.1], metal: 0.85, rough: 0.3 });
    if (p.blades === 'crescent') { R.add(W, G.torus(0.42, 0.05, 4, 12, PI * 0.9), metal, { p: [0, 0.38, 0.12], r: [0, PI / 2, -PI / 2 - 0.1], metal: 0.95, rough: 0.2 }); R.add(W, G.torus(0.42, 0.018, 3, 12, PI * 0.9), glow, { p: [sx * 0.03, 0.38, 0.12], r: [0, PI / 2, -PI / 2 - 0.1], glow: 1.8 }); }
    else if (p.blades === 'void') { R.add(W, G.blade(1.05, 0.26, 0.06, 0.12 * sx), glow, { p: [0, 0, 0.1], r: [PI / 2, 0, 0], glow: 1.4 }); R.add(W, G.blade(0.9, 0.1, 0.08, 0.08 * sx), '#ffffff', { p: [0, 0, 0.14], r: [PI / 2, 0, 0], glow: 1.6 }); R.add(W, G.oct(0.09), c.vfx2, { glow: 2 }); }
    else { R.add(W, G.blade(0.9, 0.18, 0.05, 0.05 * sx), metal, { p: [0, 0, 0.1], r: [PI / 2, 0, 0], metal: 0.95, rough: 0.2 }); R.add(W, G.cbox(0.02, 0.025, 0.66, 0.005), glow, { p: [0, 0.035, 0.42], glow: 2 }); }
    R.bone('tip' + s, W, [0, 0, p.blades === 'crescent' ? 0.5 : 1.0]);
  }
  R.bone('wisps', 'root', [0, 1.6, 0]);
  for (let i = 0; i < 3; i++) R.add('wisps', G.gem(0.08, 0.26, 4), glow, { p: [Math.cos(i * 2.1) * 0.95, (i - 1) * 0.3, Math.sin(i * 2.1) * 0.95], glow: 2 });
  return {
    R, height: 3.45, style: 'dagger', stride: 3.4, lean: 0.42, legSwing: 0.9,
    rest: { 'hips@p': [0, -0.14, 0], spine: [0.22, 0, 0], head: [-0.12, 0, 0], thighL: [-0.35, 0, 0.1], thighR: [-0.1, 0, -0.1], shinL: [0.5, 0, 0], shinR: [0.35, 0, 0], footL: [-0.15, 0, 0], footR: [-0.2, 0, 0], armL: [-0.3, 0, 0.35], armR: [-0.1, 0, -0.35], foreL: [-0.6, 0, 0], foreR: [-0.4, 0, 0] },
    runPose: { armL: [0.9, 0, 0.3], armR: [0.9, 0, -0.3], foreL: [0.2, 0, 0], foreR: [0.2, 0, 0], spine: [0.15, 0, 0] }, armSwing: 0.3,
    attacks: [
      { W: { armR: [-0.2, 0.5, -0.65], foreR: [-0.9, 0, 0], chest: [0, 0.45, 0] }, S: { armR: [-1.65, -0.35, 0.35], foreR: [-0.05, 0, 0], bladeR: [0.9, 0, 0], chest: [0.12, -0.5, 0], 'hips@p': [0, -0.05, 0.35], thighL: [-0.45, 0, 0] } },
      { W: { armL: [-0.2, -0.5, 0.65], foreL: [-0.9, 0, 0], chest: [0, -0.45, 0] }, S: { armL: [-1.65, 0.35, -0.35], foreL: [-0.05, 0, 0], bladeL: [0.9, 0, 0], chest: [0.12, 0.5, 0], 'hips@p': [0, -0.05, 0.35], thighR: [-0.45, 0, 0] } },
    ],
    casts: {
      q: { wind: 0.04, hold: 0.25, rec: 0.25, W: { spine: [0.3, 0, 0], 'hips@p': [0, -0.15, 0] }, S: { spine: [0.6, 0, 0], armL: [1.2, 0, 0.5], armR: [1.2, 0, -0.5], cape: [1.1, 0, 0], thighL: [-0.9, 0, 0], shinL: [0.8, 0, 0], thighR: [0.7, 0, 0], shinR: [0.8, 0, 0], 'hips@p': [0, -0.2, 0] } },
      w: { wind: 0.08, hold: 0.15, rec: 0.3, W: { armL: [-2.5, 0.3, -0.4], armR: [-2.5, -0.3, 0.4], spine: [-0.15, 0, 0] }, S: { armL: [-0.6, -0.6, 0.9], armR: [-0.6, 0.6, -0.9], bladeL: [1.0, 0, 0], bladeR: [1.0, 0, 0], spine: [0.45, 0, 0], 'hips@p': [0, -0.2, 0.35] } },
      r: { wind: 0.15, hold: 0.45, rec: 0.35, W: { 'hips@p': [0, -0.45, 0], spine: [0.6, 0, 0], armL: [0.4, 0, 0.5], armR: [0.4, 0, -0.5], thighL: [-1.0, 0, 0], shinL: [1.4, 0, 0], thighR: [-0.6, 0, 0], shinR: [1.5, 0, 0] }, S: { armL: [-0.3, 0, 1.4], armR: [-0.3, 0, -1.4], spine: [-0.2, 0, 0], head: [-0.4, 0, 0], 'hips@p': [0, 0.25, 0], cape: [0.8, 0, 0] }, fn: (b, A, w, s) => { b.root.rotation.y += s * Math.min(1, (A.t - A.windup) / 0.35) * PI * 2; } },
    },
    castFrom: { w: 'tipR', r: 'chest' },
    dash: { spine: [0.7, 0, 0], head: [-0.4, 0, 0], armL: [1.3, 0, 0.4], armR: [1.3, 0, -0.4], cape: [1.3, 0, 0], thighL: [-0.9, 0, 0], shinL: [1.0, 0, 0], thighR: [0.8, 0, 0], shinR: [0.9, 0, 0], 'hips@p': [0, -0.3, 0] },
    fidget: { dur: 1.2, pose: {}, fn: (b, k) => { if (b.bladeR) b.bladeR.rotation.y += Math.sin(Math.min(1, k) * PI) * PI * 2; } },
    extra: (b, st, time) => { if (b.wisps) { b.wisps.rotation.y = time * 1.7; b.wisps.position.y += Math.sin(time * 3) * 0.12; } },
    trails: [{ base: 'bladeR', tip: 'tipR', life: 0.13 }, { base: 'bladeL', tip: 'tipL', life: 0.13 }],
  };
}

// ═════════════════════════════════════════════════════════════ PIP — gnome tinker (on foot)
function pipPilot(c, p) {
  const R = new Rig();
  const d = skeleton(R, { hipY: 0.82, spineH: 0.26, chestH: 0.5, neck: 0.06, headR: 0.56, shoulderX: 0.38, shoulderY: 0.4, upper: 0.36, fore: 0.32, hipX: 0.16, footH: 0.12 });
  const B = pipBits(c, p);
  // overalls + shirt
  R.add('hips', G.tprism(0.62, 0.48, 0.66, 0.5, 0.32, 8), B.overall, { p: [0, -0.04, 0] });
  R.add('spine', G.tprism(0.68, 0.52, 0.72, 0.54, 0.3, 8), B.overall, { p: [0, 0.14, 0] });
  R.add('chest', G.tprism(0.7, 0.52, 0.66, 0.5, 0.5, 8), B.shirt, { p: [0, 0.24, 0] });
  R.add('chest', G.cbox(0.44, 0.32, 0.08, 0.03), B.overall, { p: [0, 0.1, 0.27] });
  R.add('chest', G.cbox(0.16, 0.12, 0.04, 0.02), B.overallDark, { p: [0.08, 0.12, 0.31] });
  R.sym('chest', G.cbox(0.08, 0.56, 0.05, 0.02), B.overall, { p: [0.18, 0.3, 0.27] });
  R.sym('chest', G.ico(0.04, 0), GOLD, { p: [0.18, 0.42, 0.31], metal: 0.9, rough: 0.3 });
  belt(R, 'hips', 0.12, 0.34, 0.27, '#5a3a20', GOLD, {});
  R.add('hips', G.cbox(0.12, 0.2, 0.1, 0.03), B.metal, { p: [0.3, -0.02, 0.2], metal: 0.8, rough: 0.35 });
  R.add('hips', G.cyl(0.03, 0.03, 0.28, 5), B.metal, { p: [-0.28, -0.02, 0.22], metal: 0.8, rough: 0.3 });
  // backpack with antenna + exhaust
  R.add('chest', G.cbox(0.56, 0.6, 0.32, 0.06), B.mech, { p: [0, 0.3, -0.42], metal: 0.3, rough: 0.5 });
  R.add('chest', G.cbox(0.42, 0.18, 0.06, 0.02), B.glow, { p: [0, 0.38, -0.6], glow: 1.4 });
  R.sym('chest', G.cyl(0.07, 0.09, 0.3, 7), B.mech2, { p: [0.18, 0.08, -0.6], metal: 0.6, rough: 0.4 });
  R.add('chest', G.cyl(0.02, 0.02, 0.7, 4), B.metal, { p: [0.2, 0.95, -0.42], metal: 0.8 });
  R.add('chest', G.ico(0.07, 1), B.glow, { p: [0.2, 1.32, -0.42], glow: 2 });
  for (const s of ['L', 'R']) R.add('shoulder' + s, G.ico(0.16, 1), B.shirt, { s: [1.15, 0.85, 1.05] });
  // head: big gnome head, big nose, sideburns, hat/goggles
  head(R, { r: d.headR, skin: c.skin, mood: 'kind', brow: B.hair, eye: '#2a3a5a', noseL: 0.5, noseCol: mix(c.skin, '#ff8a7a', 0.25), mouthCol: '#9a4a4a', ears: 'pointy' });
  R.sym('head', G.ico(0.17, 0), B.hair, { p: [0.45, d.headR * 0.55, 0.2], s: [0.7, 1.2, 1] });
  R.add('head', G.ico(0.22, 0), B.hair, { p: [0, d.headR * 0.32, 0.38], s: [1.6, 0.6, 0.9] }); // moustache
  buildPipSeat.hat(R, 'head', d.headR, c, p, B);
  arms(R, d, { upperW: 0.17, foreW: 0.16, hand: 0.17, sleeve: B.shirt, forearm: c.skin, bracer: B.glove, glove: B.glove, skin: c.skin });
  legs(R, d, { thighW: 0.24, shinW: 0.22, pants: B.overall, boot: '#5a3a24', toe: 'round', bootH: 0.6, cuff: B.overallDark, footL: 0.62 });
  // big wrench
  R.bone('wrench', 'handR', [0, -0.14, 0.04]);
  R.add('wrench', G.cbox(0.09, 0.07, 0.9, 0.02), B.metal, { p: [0, 0, 0.36], metal: 0.9, rough: 0.3 });
  R.add('wrench', G.torus(0.15, 0.06, 4, 8, PI * 1.45), B.metal, { p: [0, 0, 0.92], r: [PI / 2, 0, PI * 0.78], metal: 0.9, rough: 0.3 });
  R.add('wrench', G.cbox(0.12, 0.1, 0.2, 0.03), '#c84a2a', { p: [0, 0, 0.0] });
  R.add('wrench', G.band(0.07, 0.03, 0.05, 6), B.glow, { p: [0, 0, 0.62], r: [PI / 2, 0, 0], glow: 1.6 });
  R.bone('wrenchTip', 'wrench', [0, 0, 1.0]);
  return {
    R, height: 2.75, style: 'wrench', stride: 2.3, lean: 0.22, legSwing: 0.95, bob: 1.2,
    rest: { armL: [0, 0, 0.3], armR: [-0.2, 0, -0.3], foreR: [-0.6, 0, 0], foreL: [-0.2, 0, 0] },
    attacks: [{ W: { armR: [-2.6, 0, -0.35], foreR: [-0.6, 0, 0], chest: [-0.1, 0.35, 0] }, S: { armR: [-0.9, 0, 0.2], foreR: [-0.1, 0, 0], chest: [0.2, -0.3, 0], 'hips@p': [0, 0, 0.15] } }],
    casts: {
      q: { wind: 0.06, hold: 0.15, rec: 0.3, W: { armR: [-2.8, 0, -0.3], chest: [-0.15, 0.4, 0] }, S: { armR: [-0.7, 0, 0.3], chest: [0.25, -0.4, 0], 'hips@p': [0, 0, 0.2], thighL: [-0.5, 0, 0] } },
      w: { wind: 0.06, hold: 0.5, rec: 0.3, W: {}, S: { armL: [-1.6, 0, 0.1], foreL: [0, 0, 0], armR: [0.1, 0.4, -0.6], foreR: [-1.5, 0, 0], chest: [0, 0.25, 0], head: [-0.1, 0, 0] } },
      r: { wind: 0.12, hold: 0.45, rec: 0.35, W: { 'hips@p': [0, -0.2, 0], thighL: [-0.6, 0, 0], shinL: [0.9, 0, 0], thighR: [-0.6, 0, 0], shinR: [0.9, 0, 0] }, S: { 'hips@p': [0, 0.35, 0], armL: [-2.9, 0, 0.45], armR: [-2.9, 0, -0.45], head: [-0.4, 0, 0], thighL: [0.3, 0, 0], shinL: [0.6, 0, 0] } },
    },
    muzzle: 'wrenchTip', castFrom: { q: 'wrenchTip', w: 'handL', r: 'wrenchTip' },
    fidget: { dur: 1.4, pose: { armR: [-1.0, 0, 0], foreR: [-1.4, 0, 0], head: [0.35, -0.2, 0] }, fn: (b, k) => { if (b.wrench) b.wrench.rotation.y += Math.sin(Math.min(1, k) * PI) * 3; } },
    trails: [{ base: 'wrench', tip: 'wrenchTip', life: 0.15, inner: 0.5 }],
  };
}

// ═════════════════════════════════════════════════════════════ MIRE — hunched bog witch
function mire(c, p) {
  const R = new Rig();
  const d = skeleton(R, { hipY: 1.25, spineH: 0.32, chestH: 0.55, neck: 0.1, neckZ: 0.12, headR: 0.42, shoulderX: 0.42, shoulderY: 0.46, upper: 0.55, fore: 0.52, noLegs: true });
  const pri = c.primary, sec = c.secondary, skin = c.skin, glow = c.glow, wood = c.wood;
  const grey = '#c8c4b0';
  R.bone('skirt', 'hips', [0, 0, 0]);
  R.add('skirt', G.lathe([[0.36, 0.05], [0.5, -0.4], [0.72, -0.95], [0.82, -1.18], [0.7, -1.22]], 10), pri, {});
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; R.add('skirt', G.cone(0.12, 0.38, 4), i % 3 ? pri : dark(pri, 0.75), { p: [Math.sin(a) * 0.74, -1.25, Math.cos(a) * 0.74], r: [PI + Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25] }); }
  R.add('skirt', G.lathe([[0.4, -0.5], [0.66, -1.0], [0.74, -1.15]], 10), sec, { p: [0, 0, 0.02], s: [1.02, 1, 1.02] }); // patch layer
  belt(R, 'hips', 0.0, 0.38, 0.32, '#4a3424', '#7a7a6a', {});
  // potion bottles
  for (const [x, z, col] of [[0.3, 0.22, glow], [-0.18, 0.32, c.vfx], [0.38, -0.05, c.vfx2]]) { R.add('hips', G.ico(0.1, 1), col, { p: [x, -0.14, z], glow: 1.4 }); R.add('hips', G.cyl(0.035, 0.04, 0.1, 5), '#8a6a4a', { p: [x, -0.02, z] }); }
  R.add('hips', G.ico(0.16, 0), '#6a4a30', { p: [-0.38, -0.12, 0.12], s: [1, 1.2, 0.8] });
  R.add('spine', G.tprism(0.6, 0.48, 0.62, 0.5, 0.34, 8), pri, { p: [0, 0.16, 0] });
  R.add('chest', G.tprism(0.66, 0.5, 0.72, 0.52, 0.55, 8), pri, { p: [0, 0.27, 0] });
  R.add('chest', G.ico(0.42, 1), dark(pri, 0.85), { p: [0.05, 0.38, -0.3], s: [1.1, 1.15, 0.85] }); // hump
  // mossy shawl
  R.add('chest', G.ico(0.62, 1), sec, { p: [0, 0.52, -0.04], s: [1.12, 0.45, 0.98] });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; R.add('chest', G.cone(0.1, 0.32, 4), dark(sec, 0.8), { p: [Math.sin(a) * 0.58, 0.3, Math.cos(a) * 0.5], r: [PI, 0, 0] }); }
  R.add('chest', G.gem(0.07, 0.2, 5), glow, { p: [0, 0.3, 0.42], glow: 2 });
  // toad familiar on the left shoulder
  R.add('shoulderL', G.ico(0.17, 1), '#6a9a3a', { p: [0.06, 0.22, -0.02], s: [1.2, 0.8, 1.1] });
  R.add('shoulderL', G.sym ? G.ico(0.06, 0) : G.ico(0.06, 0), '#ffe060', { p: [0.12, 0.33, 0.12], glow: 1.2 });
  R.add('shoulderL', G.ico(0.06, 0), '#ffe060', { p: [-0.0, 0.33, 0.12], glow: 1.2 });
  R.add('shoulderR', G.ico(0.17, 1), sec, { s: [1.2, 0.8, 1.1] });
  // head: long nose, warts, grin, stringy hair
  head(R, { r: d.headR, skin, mood: 'smirk', brow: grey, eye: '#d8a020', noseL: 0.85, mouthCol: '#3a2a1a', ears: 'pointy', jaw: true });
  R.add('head', G.ico(0.04, 0), dark(skin, 0.8), { p: [0.06, d.headR * 0.6, d.headR * 1.55] });
  R.add('head', G.ico(0.035, 0), dark(skin, 0.8), { p: [-0.25, d.headR * 1.2, d.headR * 0.8] });
  R.add('head', G.cone(0.045, 0.1, 4), '#fff8e0', { p: [0.1, d.headR * 0.48, d.headR * 0.85], r: [PI, 0, 0] }); // snaggletooth
  for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.6; R.add('head', G.cone(0.1, 0.75 + (i % 2) * 0.2, 4), grey, { p: [Math.sin(a) * 0.42, d.headR * 0.85, Math.cos(a) * 0.38 - 0.2], r: [PI - 0.15 - Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15] }); }
  if (p.hat === 'coral') {
    R.add('head', G.ico(0.42, 1), pri, { p: [0, d.headR * 1.55, -0.02], s: [1.2, 0.5, 1.2] });
    for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2; R.add('head', G.tube([[Math.sin(a) * 0.25, d.headR * 1.6, Math.cos(a) * 0.25], [Math.sin(a) * 0.4, d.headR * 2.2, Math.cos(a) * 0.4], [Math.sin(a + 0.4) * 0.45, d.headR * 2.6, Math.cos(a + 0.4) * 0.45]], 0.07, 0.03, 5, 3), sec, {}); R.add('head', G.ico(0.07, 0), glow, { p: [Math.sin(a + 0.4) * 0.45, d.headR * 2.65, Math.cos(a + 0.4) * 0.45], glow: 1.6 }); }
  } else {
    R.add('head', G.cyl(0.84, 0.86, 0.06, 12), pri, { p: [0, d.headR * 1.62, -0.04], r: [-0.12, 0, 0.06] });
    R.add('head', G.tube([[0, d.headR * 1.62, -0.04], [0, d.headR * 2.4, -0.14], [0.05, d.headR * 3.0, -0.36], [0.3, d.headR * 3.25, -0.6]], 0.48, 0.04, 8, 7), pri, {});
    R.add('head', G.band(0.46, 0.05, 0.15, 10), sec, { p: [0, d.headR * 1.74, -0.04] });
    R.add('head', G.cbox(0.16, 0.16, 0.05, 0.02), '#c8b060', { p: [0, d.headR * 1.75, 0.44], metal: 0.8, rough: 0.35 });
    if (p.hat === 'eclipse') R.add('head', G.torus(0.16, 0.04, 4, 10, PI * 1.25), glow, { p: [0.2, d.headR * 2.4, 0.2], r: [0, 0, 0.5], glow: 2 });
    if (p.hat === 'pumpkin' || p.lantern === 'pumpkin') R.add('head', G.leaf(0.3, 0.1, 0.03), '#5a8a3a', { p: [0.3, d.headR * 3.15, -0.55], r: [0, 0, -1] });
  }
  arms(R, d, { upperW: 0.17, foreW: 0.15, hand: 0.15, sleeve: pri, forearm: pri, bracer: dark(pri, 0.8), glove: skin, skin });
  for (const s of ['L', 'R']) R.add('fore' + s, G.lathe([[0.1, 0.0], [0.17, -0.25], [0.24, -0.45], [0.22, -0.48]], 7), dark(pri, 0.85), {});
  R.sym('handL', G.cone(0.03, 0.18, 4), '#e8e0c0', { p: [0.06, -0.3, 0.1], r: [0.4, 0, 0] });
  // crooked staff + lantern
  R.bone('staff', 'handR', [0, -0.12, 0.05]);
  R.add('staff', G.tube([[0, -1.05, 0], [0.05, 0, 0.02], [-0.04, 0.9, 0.0], [0.04, 1.6, 0.1], [0.0, 2.05, 0.38]], 0.07, 0.045, 5, 8), wood, {});
  R.add('staff', G.ico(0.1, 0), sec, { p: [0.05, 0.75, 0.03], s: [1.6, 0.7, 1.6] });
  R.add('staff', G.leaf(0.25, 0.08, 0.03), sec, { p: [0.04, 1.3, 0.08], r: [0, 0, -0.8] });
  R.bone('lantern', 'staff', [0, 2.0, 0.42]);
  R.add('lantern', G.cyl(0.012, 0.012, 0.2, 3), '#333333', { p: [0, -0.1, 0] });
  if (p.lantern === 'pumpkin') { R.add('lantern', G.ico(0.26, 1), sec, { p: [0, -0.42, 0], s: [1.25, 0.9, 1.25] }); R.add('lantern', G.shape([[-0.12, 0], [0.12, 0], [0, -0.07]], 0.04), glow, { p: [0, -0.44, 0.27], glow: 2 }); R.sym('lantern', G.shape([[-0.05, 0], [0.05, 0], [0, 0.07]], 0.04), glow, { p: [0.09, -0.34, 0.25], glow: 2 }); R.add('lantern', G.cyl(0.025, 0.035, 0.12, 5), '#3a5a2a', { p: [0, -0.18, 0] }); }
  else if (p.lantern === 'shell') { R.add('lantern', G.lathe([[0.02, 0], [0.2, -0.15], [0.24, -0.4], [0.1, -0.55], [0.0, -0.58]], 8), sec, { p: [0, -0.12, 0] }); R.add('lantern', G.ico(0.13, 1), glow, { p: [0, -0.38, 0], glow: 2 }); }
  else if (p.lantern === 'moon') { R.add('lantern', G.torus(0.22, 0.07, 4, 12, PI * 1.35), glow, { p: [0, -0.42, 0], r: [0, 0, -0.2], glow: 1.8 }); R.add('lantern', G.oct(0.08), c.vfx2, { p: [0.05, -0.42, 0], glow: 2 }); }
  else { R.add('lantern', G.cbox(0.3, 0.38, 0.3, 0.04), '#3a3028', { p: [0, -0.42, 0], metal: 0.6, rough: 0.5 }); R.add('lantern', G.cbox(0.24, 0.3, 0.32, 0.02), glow, { p: [0, -0.42, 0], glow: 1.6 }); R.add('lantern', G.cone(0.24, 0.16, 4), '#3a3028', { p: [0, -0.18, 0], r: [0, PI / 4, 0], metal: 0.6 }); }
  R.bone('lanternCore', 'lantern', [0, -0.42, 0]);
  return {
    R, height: 3.7, style: 'lantern', float: true, hover: 0.0, stride: 2.6,
    loco: (b, st, dt, runW, upper, time) => {
      st.phase += (st.speed * dt / 2.4) * PI * 2; const s = Math.sin(st.phase);
      P0(b, 'hips', 0, Math.abs(Math.cos(st.phase)) * 0.1 * runW + Math.sin(time * 1.7) * 0.02, 0);
      if (runW > 0) { R0(b, 'hips', 0, s * 0.12 * runW, s * 0.08 * runW); R0(b, 'skirt', 0.18 * runW, 0, -s * 0.1 * runW); R0(b, 'spine', 0.15 * runW, 0, 0); R0(b, 'armL', s * 0.5 * runW * upper, 0, 0.2 * runW); R0(b, 'armR', -s * 0.25 * runW * upper, 0, 0); }
      const w = 1 - runW; const br = Math.sin(time * 1.6);
      R0(b, 'chest', -br * 0.04 * w, 0, 0); R0(b, 'head', Math.sin(time * 1.1) * 0.06 * w, Math.sin(time * 0.6) * 0.3 * w, Math.sin(time * 0.8) * 0.08 * w);
      R0(b, 'armL', 0, 0, 0.1 * w);
    },
    rest: { spine: [0.42, 0, 0], neck: [-0.3, 0, 0], head: [-0.32, 0, 0], armR: [-0.55, 0, -0.15], foreR: [-0.45, 0, 0], handR: [0.55, 0, 0], armL: [-0.35, 0, 0.3], foreL: [-0.9, 0, 0] },
    attacks: [{ W: { armR: [-0.1, 0, -0.45], chest: [0, 0.3, 0] }, S: { armR: [-1.5, 0, 0.05], handR: [-0.4, 0, 0], chest: [0.1, -0.3, 0], 'hips@p': [0, 0, 0.18] } }],
    casts: {
      q: { wind: 0.08, hold: 0.15, rec: 0.35, W: { armR: [-2.4, 0, -0.25], chest: [-0.2, 0.3, 0] }, S: { armR: [-1.2, 0, 0.1], chest: [0.25, -0.35, 0], 'hips@p': [0, 0, 0.2] } },
      w: { wind: 0.06, hold: 0.4, rec: 0.35, W: { armR: [-1.0, 0, 0] }, S: { armR: [-0.85, 0, 0.25], handR: [-0.2, 0, 0], spine: [0.25, 0, 0], 'hips@p': [0, -0.2, 0], armL: [-1.4, 0, 0.6], foreL: [-0.2, 0, 0] } },
      r: { wind: 0.18, hold: 0.7, rec: 0.4, W: { spine: [0.6, 0, 0], armL: [0.3, 0, 0.3] }, S: { armL: [-2.7, 0, 0.6], foreL: [0, 0, 0], armR: [-2.9, 0, -0.3], spine: [-0.25, 0, 0], neck: [-0.2, 0, 0], head: [-0.55, 0, 0], 'hips@p': [0, 0.2, 0] } },
    },
    muzzle: 'lanternCore', castFrom: { q: 'lanternCore', w: 'lanternCore', r: 'lanternCore' },
    recall: { armR: [-0.4, 0, 0], armL: [-1.3, 0, -0.4], head: [0.3, 0, 0] },
    death: { 'root@p': [0, -0.2, -0.1], root: [-1.35, 0, 0.1], head: [-0.3, 0.4, 0], armL: [-0.4, 0, 1.3], armR: [-0.6, 0, -1.1] },
    fidget: { dur: 1.8, pose: { head: [-0.1, -0.6, 0.2], armL: [-0.9, 0, 0], foreL: [-1.0, 0, 0] } },
    extra: (b, st, time) => { if (b.lantern) { b.lantern.rotation.z += Math.sin(time * 2.4) * 0.22 - st.turn * 0.04; b.lantern.rotation.x += Math.sin(time * 1.7) * 0.15 + st.run * 0.3; } },
    trails: null,
  };
}
const R0 = (b, n, x, y, z) => { const bn = b[n]; if (bn) { bn.rotation.x += x; bn.rotation.y += y; bn.rotation.z += z; } };
const P0 = (b, n, x, y, z) => { const bn = b[n]; if (bn) { bn.position.x += x; bn.position.y += y; bn.position.z += z; } };

// ═════════════════════════════════════════════════════════════ GARROK — antlered beast hunter
function garrok(c, p) {
  const R = new Rig();
  const d = skeleton(R, { hipY: 1.7, spineH: 0.45, chestH: 0.92, neck: 0.18, neckZ: 0.12, headR: 0.42, shoulderX: 0.74, shoulderY: 0.78, upper: 0.72, fore: 0.66, hipX: 0.26, footH: 0.16 });
  const pri = c.primary, fur = c.fur, skin = c.skin, antler = c.antler, metal = c.metal, glow = c.glow;
  const leather = '#4a3020', paint = c.vfx;
  const glowA = p.helm === 'spirit' || p.helm === 'thunder';
  // fur kilt + belt
  R.add('hips', G.tprism(0.8, 0.56, 0.74, 0.52, 0.34, 8), leather, { p: [0, -0.04, 0] });
  for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2; R.add('hips', G.tbox(0.24, 0.08, 0.16, 0.06, 0.6), i % 2 ? fur : dark(fur, 0.85), { p: [Math.sin(a) * 0.42, -0.35, Math.cos(a) * 0.32], r: [Math.cos(a) * 0.2, a, -Math.sin(a) * 0.2] }); }
  belt(R, 'hips', 0.1, 0.42, 0.3, leather, metal, { bw: 0.24, bh: 0.18, h: 0.16 });
  R.add('hips', G.cbox(0.2, 0.24, 0.12, 0.04), leather, { p: [0.36, -0.08, 0.2] });
  // bare muscular torso with war paint
  R.add('spine', G.tprism(0.74, 0.5, 0.86, 0.56, 0.48, 8), skin, { p: [0, 0.22, 0] });
  R.add('chest', G.tprism(0.95, 0.6, 1.2, 0.7, 0.92, 8), skin, { p: [0, 0.42, 0] });
  R.sym('chest', G.ico(0.28, 1), skin, { p: [0.22, 0.62, 0.22], s: [1.1, 0.7, 0.55] });
  for (let i = 0; i < 3; i++) R.sym('spine', G.cbox(0.16, 0.12, 0.08, 0.03), dark(skin, 0.93), { p: [0.1, 0.05 + i * 0.15, 0.27] });
  R.sym('chest', G.cbox(0.06, 0.4, 0.04, 0.01), paint, { p: [0.18, 0.55, 0.36], r: [0, 0.3, 0.4], glow: glowA ? 1.4 : 0.3 });
  R.sym('chest', G.cbox(0.06, 0.3, 0.04, 0.01), paint, { p: [0.32, 0.5, 0.31], r: [0, 0.5, 0.4], glow: glowA ? 1.4 : 0.3 });
  R.add('chest', G.cbox(0.12, 1.15, 0.06, 0.02), leather, { p: [0, 0.48, 0.34], r: [0, 0, 0.62] });
  for (let i = 0; i < 5; i++) R.add('chest', G.cone(0.045, 0.2, 4), antler, { p: [-0.28 + i * 0.14, 0.82 - Math.abs(i - 2) * 0.04, 0.36], r: [PI - 0.1, 0, 0] });
  // fur mantle
  R.add('chest', G.ico(0.85, 1), dark(fur, 0.8), { p: [0, 0.82, -0.25], s: [1.3, 0.42, 0.85] });
  for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2; R.add('chest', G.cone(0.13, 0.42, 4), i % 2 ? dark(fur, 0.8) : fur, { p: [Math.sin(a) * 0.95, 0.62, Math.cos(a) * 0.62 - 0.22], r: [PI + Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3] }); }
  for (const s of ['L', 'R']) R.add('shoulder' + s, G.ico(0.32, 1), fur, { p: [0, 0.12, 0], s: [1.2, 0.8, 1.15] });
  // head: beard + skull helm + antlers
  head(R, { r: d.headR, skin, mood: 'grumpy', brow: '#3a2414', eye: '#2a1a10', mouthCol: '#5a2a20', jaw: true });
  R.add('head', G.ico(0.3, 1), '#4a3020', { p: [0, d.headR * 0.18, d.headR * 0.62], s: [1.15, 0.8, 0.6] });
  R.add('head', G.tube([[0, d.headR * 0.1, d.headR * 0.72], [0, -0.12, d.headR * 0.72], [0, -0.3, d.headR * 0.6]], 0.11, 0.05, 5, 3), '#4a3020', {});
  R.add('head', G.band(0.08, 0.03, 0.06, 6), GOLD, { p: [0, -0.16, d.headR * 0.7], r: [0.5, 0, 0], metal: 0.9, rough: 0.3 });
  const helm = p.helm === 'snow' ? mix(fur, '#ffffff', 0.4) : p.helm === 'spirit' ? mix(antler, '#ffffff', 0.5) : '#ece0c4';
  R.add('head', G.sph(d.headR * 1.12, 9, 6, 0), helm, { p: [0, d.headR * 1.42, -0.05], s: [1.05, 0.68, 1.12] });
  R.add('head', G.tbox(0.42, 0.3, 0.26, 0.2, 0.22), helm, { p: [0, d.headR * 1.62, d.headR * 0.92], r: [PI / 2 - 0.35, 0, 0] }); // snout
  R.sym('head', G.cbox(0.13, 0.09, 0.06, 0.02), glowA ? glow : '#1a1210', { p: [0.15, d.headR * 1.45, d.headR * 0.98], glow: glowA ? 2 : 0 });
  R.sym('head', G.cone(0.04, 0.16, 4), helm, { p: [0.12, d.headR * 1.3, d.headR * 1.3], r: [PI, 0, 0] }); // fangs
  for (const sx of [1, -1]) {
    const gl = { glow: glowA ? 1.3 : 0, rough: 0.6 };
    R.add('head', G.horn(1.05, 0.1, 0.25, 5, 5), antler, { p: [sx * 0.34, d.headR * 1.6, -0.05], r: [-0.25, 0, -sx * 0.75], ...gl });
    R.add('head', G.horn(0.7, 0.07, 0.3, 4, 4), antler, { p: [sx * 0.95, d.headR * 2.85, -0.25], r: [-0.4, 0, -sx * 0.1], ...gl });
    R.add('head', G.horn(0.5, 0.06, 0.5, 4, 4), antler, { p: [sx * 0.7, d.headR * 2.4, -0.15], r: [0.5, 0, -sx * 0.25], ...gl });
    R.add('head', G.horn(0.5, 0.06, 0.3, 4, 4), antler, { p: [sx * 1.0, d.headR * 2.5, -0.2], r: [0, 0, -sx * 1.0], ...gl });
  }
  arms(R, d, { upperW: 0.3, foreW: 0.28, hand: 0.22, sleeve: skin, forearm: skin, bracer: fur, glove: leather, skin });
  for (const s of ['L', 'R']) R.sym('arm' + s, G.ico(0.16, 1), skin, { p: [0.0, -0.28, 0.08], s: [1, 1.3, 0.9] });
  legs(R, d, { thighW: 0.36, shinW: 0.32, pants: leather, boot: fur, toe: 'claw', claw: antler, bootH: 0.7, cuff: mix(fur, '#ffffff', 0.15), knee: dark(leather, 0.8) });
  // spear (vertical, right hand)
  R.bone('spear', 'handR', [0, -0.18, 0.06]);
  R.add('spear', G.cyl(0.055, 0.06, 3.6, 6), '#6a4a2a', { p: [0, 0.5, 0] });
  R.add('spear', G.cyl(0.075, 0.075, 0.3, 6), leather, { p: [0, 1.95, 0] });
  R.add('spear', G.leaf(0.4, 0.1, 0.03), '#c03a2a', { p: [0.08, 1.85, 0], r: [PI, 0, 0.3] });
  R.add('spear', G.leaf(0.36, 0.09, 0.03), mix(fur, '#ffffff', 0.4), { p: [-0.08, 1.85, 0], r: [PI, 0, -0.3] });
  if (p.spear === 'ice') R.add('spear', G.gem(0.24, 1.0, 5, 0.3), metal, { p: [0, 2.6, 0], glow: 0.5, metal: 0.4, rough: 0.15 });
  else if (p.spear === 'spirit') { R.add('spear', G.gem(0.22, 1.0, 4, 0.3), glow, { p: [0, 2.6, 0], glow: 1.6 }); }
  else if (p.spear === 'thunder') { R.add('spear', G.cbox(0.12, 0.45, 0.07, 0.02), metal, { p: [0.08, 2.35, 0], r: [0, 0, 0.55], glow: 1.4, metal: 0.8 }); R.add('spear', G.cbox(0.12, 0.45, 0.07, 0.02), metal, { p: [-0.02, 2.7, 0], r: [0, 0, -0.55], glow: 1.4, metal: 0.8 }); R.add('spear', G.cone(0.12, 0.4, 4), metal, { p: [0.06, 3.08, 0], glow: 1.4, metal: 0.8 }); }
  else { R.add('spear', G.gem(0.2, 0.95, 4, 0.25), metal, { p: [0, 2.55, 0], s: [1, 1, 0.35], metal: 0.85, rough: 0.3 }); R.add('spear', G.cbox(0.04, 0.6, 0.03, 0.01), glow, { p: [0, 2.6, 0.04], glow: 0.8 }); }
  R.bone('spearTip', 'spear', [0, 3.0, 0]);
  return {
    R, height: 4.6, style: 'spear', stride: 3.6, lean: 0.24, legSwing: 0.8, bob: 1.2,
    rest: { armL: [0, 0, 0.22], armR: [-0.15, 0, -0.22], foreR: [-0.35, 0, 0], foreL: [-0.2, 0, 0], chest: [0.05, 0, 0], neck: [0.1, 0, 0] },
    runPose: { armR: [0.15, 0, 0], spear: [0.5, 0, 0] },
    attacks: [
      { W: { armR: [-0.25, 0, -0.35], foreR: [-1.3, 0, 0], spear: [3.07, 0, 0], chest: [0, 0.45, 0], 'hips@p': [0, 0, -0.15] }, S: { armR: [-1.45, 0, 0.05], foreR: [-0.05, 0, 0], spear: [3.07, 0, 0], chest: [0.1, -0.35, 0], 'hips@p': [0, -0.1, 0.4], thighL: [-0.5, 0, 0], shinL: [0.5, 0, 0], armL: [0.6, 0, 0.3] } },
      { W: { armR: [-2.6, 0, -0.3], foreR: [-0.3, 0, 0], spear: [-0.6, 0, 0], chest: [-0.15, 0.3, 0] }, S: { armR: [-0.7, 0, 0.3], foreR: [-0.2, 0, 0], spear: [1.6, 0, 0], chest: [0.3, -0.3, 0], spine: [0.15, 0, 0], 'hips@p': [0, -0.15, 0.3] } },
    ],
    casts: {
      q: { wind: 0.08, hold: 0.35, rec: 0.3, W: { 'hips@p': [0, -0.4, 0], thighL: [-1.0, 0, 0], shinL: [1.4, 0, 0], thighR: [-0.8, 0, 0], shinR: [1.4, 0, 0], armL: [0.8, 0, 0.2], armR: [0.8, 0, -0.2], spine: [0.4, 0, 0] }, S: { armL: [-2.6, 0, 0.5], armR: [-2.7, 0, -0.3], spear: [0.6, 0, 0], thighL: [-0.9, 0, 0], shinL: [1.2, 0, 0], thighR: [0.4, 0, 0], shinR: [0.8, 0, 0], spine: [-0.15, 0, 0] } },
      w: { wind: 0.1, hold: 0.55, rec: 0.35, W: { spine: [0.35, 0, 0], armL: [-0.6, 0, -0.2], armR: [-0.6, 0, 0.2] }, S: { armL: [-0.3, 0, 1.3], armR: [-0.3, 0, -1.3], foreL: [-0.8, 0, 0], foreR: [-0.8, 0, 0], chest: [-0.35, 0, 0], neck: [-0.3, 0, 0], head: [-0.5, 0, 0], 'hips@p': [0, -0.15, 0], thighL: [-0.2, 0, 0.3], thighR: [0, 0, -0.3] }, fn: (b, A, w, s) => { if (s > 0 && b.head) b.head.rotation.y += Math.sin(A.t * 40) * 0.05 * s; } },
      r: { wind: 0.1, hold: 0.4, rec: 0.35, W: { armR: [-0.2, 0, -0.4], foreR: [-1.2, 0, 0], spear: [3.07, 0, 0], chest: [0, 0.5, 0] }, S: { armR: [-1.75, 0, 0], foreR: [0, 0, 0], spear: [3.27, 0, 0], armL: [-1.4, 0, -0.1], chest: [0, -0.3, 0], head: [-0.1, 0, 0] } },
    },
    castFrom: { q: 'spearTip', w: 'head', r: 'spearTip' },
    dash: { spine: [0.45, 0, 0], armL: [1.0, 0, 0.4], armR: [-2.6, 0, -0.3], thighL: [-1.0, 0, 0], shinL: [1.3, 0, 0], thighR: [0.5, 0, 0], shinR: [1.0, 0, 0] },
    fidget: { dur: 1.6, pose: { armR: [-0.5, 0, -0.2], spear: [-0.4, 0, 0], neck: [-0.2, 0, 0], head: [-0.2, 0.5, 0] } },
    trails: [{ base: 'spear', tip: 'spearTip', life: 0.15, inner: 0.75 }],
  };
}

// ═════════════════════════════════════════════════════════════ PIP & BOLT (menu duo) + variants
function pip(c, p, variant) {
  if (variant === 'pilot') return pipPilot(c, p);
  return buildBoltRecipe(c, p, variant === 'mech' ? null : (R, bone) => buildPipSeat(R, bone, c, p));
}

export const HERO_RECIPES = { bram, kaela, lumi, vex, nyx, pip, mire, garrok, garrok_wolf: (c, p, v) => buildWolfRecipe(c, p, v) };

const FALLBACK_COLORS = { primary: '#7a7aa0', secondary: '#4a4a6a', accent: '#a0d0ff', metal: '#c0c0c8', skin: '#e0b090', hair: '#3a2a1a', glow: '#a0e0ff', vfx: '#a0e0ff', vfx2: '#ffffff', wood: '#6a4a2a', mech: '#c0a040', mech2: '#404050', fur: '#8a6a4a', antler: '#e0d0b0', wolf: '#7a6a5a' };

export function buildHero(heroId, skinId, opts = {}) {
  const skin = getSkin(heroId === 'garrok_wolf' ? 'garrok' : heroId, skinId);
  const colors = { ...FALLBACK_COLORS, ...(skin?.colors || {}) };
  const parts = skin?.parts || {};
  const recipe = HERO_RECIPES[heroId] || kaela;
  const def = recipe(colors, parts, opts.variant);
  const rig = def.R.build({ rim: colors.vfx || colors.glow, rimStrength: opts.rimStrength ?? 0.42, shadow: opts.shadow });
  def.R = null;
  rig.def = def; rig.colors = colors; rig.skin = skin; rig.heroId = heroId;
  const sc = (def.scale || 1) * (opts.scale ?? HERO_SCALE);
  rig.root.scale.setScalar(sc); def.baseHeight = def.height; def.height = def.height * sc; def.scale = sc;
  return rig;
}

export const poseRig = animPose;
export { playAction, flinch };
