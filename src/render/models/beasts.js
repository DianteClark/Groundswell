// Garrok's wolves + Pip's mech Bolt (HEROES lead).
import * as THREE from 'three';
import { Rig, G } from './builder.js';

const PI = Math.PI, TAU = PI * 2;
const mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const dark = (a, k = 0.6) => '#' + new THREE.Color(a).multiplyScalar(k).getHexString();
const Rr = (b, n, x, y, z) => { const bn = b[n]; if (bn) { bn.rotation.x += x; bn.rotation.y += y; bn.rotation.z += z; } };
const Pp = (b, n, x, y, z) => { const bn = b[n]; if (bn) { bn.position.x += x; bn.position.y += y; bn.position.z += z; } };

// ═════════════════════════════════════════════════════════════ WOLF
export function buildWolfRecipe(c, p, variant) {
  const R = new Rig();
  const fur = c.wolf || '#7a6a5a', belly = mix(fur, '#f0e8dc', 0.45), dk = dark(fur, 0.6), glow = c.glow || '#ffcf5a';
  const spirit = p.helm === 'spirit' || p.helm === 'thunder';
  R.bone('hips', 'root', [0, 1.05, -0.55]);
  R.bone('chest', 'hips', [0, 0.12, 1.1]);
  R.bone('neck', 'chest', [0, 0.25, 0.45]);
  R.bone('head', 'neck', [0, 0.3, 0.2]);
  R.bone('jaw', 'head', [0, -0.12, 0.15]);
  R.bone('tail', 'hips', [0, 0.15, -0.35]);
  R.bone('tail2', 'tail', [0, 0, -0.55]);
  for (const [n, par, x, z] of [['FL', 'chest', 0.27, 0.1], ['FR', 'chest', -0.27, 0.1], ['BL', 'hips', 0.27, -0.05], ['BR', 'hips', -0.27, -0.05]]) {
    R.bone('up' + n, par, [x, -0.1, z]); R.bone('lo' + n, 'up' + n, [0, -0.5, n[0] === 'B' ? -0.08 : 0.04]); R.bone('paw' + n, 'lo' + n, [0, -0.45, 0]);
    const back = n[0] === 'B';
    R.add('up' + n, back ? G.tprism(0.36, 0.5, 0.2, 0.26, 0.6, 6) : G.tprism(0.26, 0.3, 0.2, 0.22, 0.6, 6), fur, { p: [0, -0.22, back ? 0.05 : 0], r: [back ? 0.2 : 0, 0, 0] });
    R.add('lo' + n, G.tprism(0.13, 0.13, 0.16, 0.16, 0.5, 6), back ? dk : fur, { p: [0, -0.22, 0] });
    R.add('paw' + n, G.cbox(0.2, 0.12, 0.28, 0.04), dk, { p: [0, -0.03, 0.06] });
    for (let i = -1; i <= 1; i++) R.add('paw' + n, G.cone(0.025, 0.1, 3), '#e8e0d0', { p: [i * 0.06, -0.06, 0.22], r: [PI / 2, 0, 0] });
  }
  // body
  R.add('hips', G.ico(0.48, 1), fur, { p: [0, 0, -0.05], s: [0.85, 0.8, 1.05] });
  R.add('chest', G.ico(0.55, 1), fur, { p: [0, 0.05, -0.1], s: [0.95, 0.95, 1.05] });
  R.add('chest', G.ico(0.4, 1), belly, { p: [0, -0.22, 0.12], s: [0.9, 0.8, 1.2] });
  R.add('hips', G.tprism(0.6, 0.75, 0.8, 0.85, 0.8, 7), fur, { p: [0, 0.05, 0.55], r: [PI / 2, 0, 0] });
  // ruff (mane)
  for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2; R.add('chest', G.cone(0.13, 0.42, 4), i % 2 ? fur : mix(fur, '#ffffff', 0.18), { p: [Math.sin(a) * 0.42, 0.18 + Math.cos(a) * 0.38, 0.18], r: [-PI / 2 + 0.3, 0, -a] }); }
  // back ridge fur spikes
  for (let i = 0; i < 4; i++) R.add('hips', G.cone(0.1, 0.32, 4), dk, { p: [0, 0.38, 0.6 - i * 0.28], r: [-0.6, 0, 0] });
  // head
  R.add('neck', G.tprism(0.36, 0.4, 0.32, 0.34, 0.45, 7), fur, { p: [0, 0.12, 0], r: [0.5, 0, 0] });
  R.add('head', G.ico(0.3, 1), fur, { p: [0, 0.02, -0.02], s: [1, 0.9, 1] });
  R.add('head', G.tbox(0.3, 0.28, 0.16, 0.14, 0.42), fur, { p: [0, -0.05, 0.3], r: [PI / 2, 0, 0] }); // snout
  R.add('head', G.cbox(0.1, 0.08, 0.08, 0.02), '#151010', { p: [0, 0.0, 0.52] });
  R.add('jaw', G.tbox(0.24, 0.22, 0.12, 0.12, 0.35), belly, { p: [0, -0.04, 0.17], r: [PI / 2, 0, 0] });
  R.sym('jaw', G.cone(0.025, 0.08, 3), '#ffffff', { p: [0.07, 0.03, 0.3], r: [0, 0, 0] });
  R.sym('head', G.cone(0.1, 0.3, 4), fur, { p: [0.15, 0.3, -0.08], r: [-0.25, 0, -0.2] }); // ears
  R.sym('head', G.cone(0.05, 0.18, 4), '#e8a8a0', { p: [0.15, 0.28, -0.04], r: [-0.25, 0, -0.2] });
  R.sym('head', G.cbox(0.1, 0.05, 0.03, 0.01), glow, { p: [0.12, 0.08, 0.27], r: [0, 0.35, -0.25], glow: 2.2 });
  // tail
  R.add('tail', G.tprism(0.2, 0.2, 0.26, 0.26, 0.55, 6), fur, { p: [0, 0, -0.25], r: [PI / 2, 0, 0] });
  R.add('tail2', G.cone(0.2, 0.7, 6), mix(fur, '#ffffff', 0.25), { p: [0, 0, -0.3], r: [-PI / 2, 0, 0] });
  if (spirit) { R.add('chest', G.gem(0.08, 0.3, 4), glow, { p: [0, 0.6, 0.0], glow: 2 }); R.add('tail2', G.cone(0.12, 0.5, 5), glow, { p: [0, 0, -0.55], r: [-PI / 2, 0, 0], glow: 1.6 }); }
  if (variant === 'alpha') { for (let i = 0; i < 5; i++) R.add('chest', G.gem(0.06, 0.4, 4), glow, { p: [Math.sin(i * 1.3) * 0.3, 0.55, -0.1 - i * 0.12], r: [-0.4, 0, 0], glow: 2 }); }
  return {
    R, height: 1.9, style: 'beast', quad: true,
    loco: wolfLoco,
    rest: {},
    attacks: [
      { W: { chest: [0.25, 0, 0], neck: [-0.5, 0, 0], head: [-0.2, 0, 0], jaw: [0.5, 0, 0], 'hips@p': [0, -0.1, -0.2] }, S: { chest: [-0.2, 0, 0], neck: [0.5, 0, 0], head: [0.3, 0, 0], jaw: [0.05, 0, 0], 'root@p': [0, 0.1, 0.6], upFL: [-0.9, 0, 0], upFR: [-0.9, 0, 0] } },
      { W: { neck: [-0.3, 0.4, 0], jaw: [0.6, 0, 0], 'hips@p': [0, -0.08, -0.15] }, S: { neck: [0.4, -0.5, 0], head: [0.2, 0, 0.3], jaw: [0, 0, 0], 'root@p': [0, 0.05, 0.45] } },
    ],
    casts: { q: { wind: 0.08, hold: 0.3, rec: 0.3, W: { 'hips@p': [0, -0.2, 0] }, S: { upFL: [-1.2, 0, 0], upFR: [-1.2, 0, 0], upBL: [1.0, 0, 0], upBR: [1.0, 0, 0], neck: [-0.3, 0, 0] } } },
    dash: { upFL: [-1.3, 0, 0], loFL: [0.4, 0, 0], upFR: [-1.2, 0, 0], loFR: [0.5, 0, 0], upBL: [1.1, 0, 0], upBR: [1.0, 0, 0], neck: [-0.2, 0, 0], tail: [0.6, 0, 0] },
    death: { root: [0, 0, PI / 2 * 0.95], 'root@p': [0, 0.35, 0], upFL: [-0.6, 0, 0], upBL: [0.6, 0, 0], neck: [0.4, 0, 0], jaw: [0.3, 0, 0] },
    recall: {},
    previewSpeed: 9,
  };
}
function wolfLoco(b, st, dt, runW, upper, time) {
  const stride = 3.2; st.phase += (st.speed * dt / stride) * TAU; const ph = st.phase;
  if (runW > 0.001) {
    const w = runW; const gallop = Math.min(1, st.speed / 9);
    const legs = [['FL', 0], ['BR', 0.15], ['FR', PI], ['BL', PI + 0.15]];
    for (const [n, off] of legs) {
      const s = Math.sin(ph + off * (1 - gallop) + (n[0] === 'B' ? gallop * 0.9 : 0)), c = Math.cos(ph + off * (1 - gallop) + (n[0] === 'B' ? gallop * 0.9 : 0));
      const A = n[0] === 'F' ? 0.7 : 0.6;
      Rr(b, 'up' + n, -s * A * w, 0, 0);
      Rr(b, 'lo' + n, (n[0] === 'F' ? Math.max(0, c) * 0.9 : -Math.max(0, c) * 0.9) * w, 0, 0);
      Rr(b, 'paw' + n, s * 0.3 * w, 0, 0);
    }
    Pp(b, 'hips', 0, Math.abs(Math.sin(ph)) * 0.12 * w, 0);
    Rr(b, 'chest', Math.sin(ph) * 0.12 * gallop * w, 0, 0); Rr(b, 'hips', -Math.sin(ph) * 0.08 * gallop * w, 0, 0);
    Rr(b, 'neck', -0.15 * w + Math.sin(ph) * 0.08 * w, 0, 0);
    Rr(b, 'tail', 0.5 * w, Math.sin(ph) * 0.2 * w, 0); Rr(b, 'tail2', 0.2 * w, 0, 0);
  }
  const iw = 1 - runW; const br = Math.sin(time * 2.4);
  Pp(b, 'chest', 0, br * 0.02 * iw, 0); Rr(b, 'neck', br * 0.03 * iw, Math.sin(time * 0.7) * 0.25 * iw, 0); Rr(b, 'head', 0, 0, Math.sin(time * 0.9) * 0.1 * iw);
  Rr(b, 'tail', 0.1 * iw, Math.sin(time * 5) * 0.3 * iw, 0); Rr(b, 'tail2', 0, Math.sin(time * 5 + 1) * 0.3 * iw, 0);
  Rr(b, 'jaw', (0.15 + Math.sin(time * 6) * 0.05) * iw, 0, 0); // panting
}

// ═════════════════════════════════════════════════════════════ BOLT (mech)
export function buildBoltRecipe(c, p, seat) {
  const R = new Rig();
  const m1 = c.mech, m2 = c.mech2, metal = c.metal, glow = c.glow;
  const sleek = p.mech === 'sleek', rusty = p.mech === 'rusty', rockets = p.hat === 'helmet';
  R.bone('hips', 'root', [0, 1.45, 0]);
  R.bone('spine', 'hips', [0, 0.05, 0]);
  R.bone('chest', 'spine', [0, 0.15, 0]);
  R.bone('head', 'chest', [0, 1.4, 0.45]);
  R.bone('seat', 'chest', [0, 1.45, -0.15]);
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    R.bone('shoulder' + s, 'chest', [sx * 1.0, 1.05, 0]); R.bone('arm' + s, 'shoulder' + s, [sx * 0.15, 0, 0]); R.bone('fore' + s, 'arm' + s, [0, -0.6, 0]); R.bone('hand' + s, 'fore' + s, [0, -0.62, 0]);
    R.bone('thigh' + s, 'hips', [sx * 0.52, -0.05, 0]); R.bone('shin' + s, 'thigh' + s, [0, -0.62, 0.05]); R.bone('foot' + s, 'shin' + s, [0, -0.62, 0]);
  }
  // hull
  if (sleek) {
    R.add('chest', G.ico(0.92, 2), m1, { p: [0, 0.72, 0], s: [1.1, 0.95, 0.95], metal: 0.5, rough: 0.3 });
    R.add('chest', G.band(0.9, 0.12, 0.16, 16), m2, { p: [0, 0.5, 0], metal: 0.6, rough: 0.3 });
  } else {
    R.add('chest', G.cbox(1.7, 1.25, 1.35, 0.14), m1, { p: [0, 0.72, 0], metal: rusty ? 0.2 : 0.45, rough: rusty ? 0.75 : 0.4 });
    R.add('chest', G.cbox(1.45, 0.2, 1.2, 0.05), m2, { p: [0, 1.42, -0.05], metal: 0.6, rough: 0.35 });
    R.add('chest', G.cbox(1.8, 0.16, 1.45, 0.05), m2, { p: [0, 0.12, 0], metal: 0.6, rough: 0.35 });
    for (let i = 0; i < 4; i++) R.add('chest', G.cyl(0.04, 0.04, 0.04, 6), metal, { p: [-0.7 + i * 0.47, 1.2, 0.68], r: [PI / 2, 0, 0], metal: 0.9 });
  }
  R.add('chest', G.cbox(0.9, 0.42, 0.12, 0.05), m2, { p: [0, 0.68, sleek ? 0.85 : 0.68] });
  for (let i = 0; i < 4; i++) R.add('chest', G.cbox(0.7, 0.05, 0.05, 0.01), glow, { p: [0, 0.54 + i * 0.09, sleek ? 0.92 : 0.75], glow: 1.6 });
  R.add('chest', G.cyl(0.18, 0.18, 0.1, 10), metal, { p: [0.55, 0.32, sleek ? 0.82 : 0.68], r: [PI / 2, 0, 0], metal: 0.9, rough: 0.3 });
  if (rusty) { R.add('chest', G.cbox(0.42, 0.36, 0.05, 0.02), '#8a8a7a', { p: [-0.45, 0.35, 0.7], r: [0, 0, 0.2] }); R.add('chest', G.cbox(0.32, 0.07, 0.07, 0.02), '#d8c8a0', { p: [0.35, 1.15, 0.7], r: [0, 0, -0.4] }); R.add('chest', G.cbox(0.32, 0.07, 0.07, 0.02), '#d8c8a0', { p: [0.35, 1.15, 0.7], r: [0, 0, 0.4] }); }
  // back: exhausts / rockets + antenna
  R.add('chest', G.cbox(0.8, 0.8, 0.4, 0.06), m2, { p: [0, 0.8, -0.8], metal: 0.6, rough: 0.35 });
  for (const sx of [1, -1]) {
    if (rockets) { R.add('chest', G.cyl(0.22, 0.26, 0.9, 10), metal, { p: [sx * 0.45, 0.65, -1.0], metal: 0.8, rough: 0.25 }); R.add('chest', G.cone(0.22, 0.35, 10), m1, { p: [sx * 0.45, 1.28, -1.0] }); R.add('chest', G.cyl(0.16, 0.2, 0.06, 10), glow, { p: [sx * 0.45, 0.18, -1.0], glow: 2 }); }
    else { R.add('chest', G.cyl(0.13, 0.17, 0.5, 8), metal, { p: [sx * 0.22, 1.3, -0.9], metal: 0.8, rough: 0.35 }); R.add('chest', G.cyl(0.1, 0.1, 0.04, 8), glow, { p: [sx * 0.22, 1.56, -0.9], glow: 1.4 }); }
  }
  R.add('chest', G.cyl(0.03, 0.03, 0.9, 4), metal, { p: [0.65, 1.8, -0.45], metal: 0.9 });
  R.add('chest', G.ico(0.1, 1), glow, { p: [0.65, 2.27, -0.45], glow: 2.2 });
  // sensor head with visor
  R.add('head', G.cbox(0.7, 0.36, 0.42, 0.08), m1, { metal: 0.45, rough: 0.35 });
  R.add('head', G.cbox(0.58, 0.12, 0.08, 0.03), glow, { p: [0, 0.02, 0.21], glow: 2.2 });
  R.sym('head', G.cyl(0.08, 0.08, 0.1, 8), metal, { p: [0.38, 0, 0], r: [0, 0, PI / 2], metal: 0.9 });
  // seat / cockpit rim
  R.add('seat', G.band(0.42, 0.06, 0.18, 12), m2, { p: [0, 0.05, 0], metal: 0.6, rough: 0.35 });
  R.add('seat', G.cyl(0.38, 0.38, 0.05, 12), dark(m2, 0.7), { p: [0, -0.02, 0] });
  if (seat) seat(R, 'seat');
  // shoulders with hazard stripes
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    R.add('shoulder' + s, G.cbox(0.62, 0.42, 0.7, 0.08), m2, { p: [sx * 0.15, 0.1, 0], metal: 0.6, rough: 0.35 });
    for (let i = 0; i < 3; i++) R.add('shoulder' + s, G.cbox(0.1, 0.06, 0.72, 0.01), i % 2 ? '#1a1a1a' : '#ffd23a', { p: [sx * (0.05 + i * 0.14), 0.33, 0], r: [0, 0, sx * 0.0] });
    R.add('arm' + s, G.cyl(0.22, 0.22, 0.3, 10), metal, { r: [0, 0, PI / 2], metal: 0.85, rough: 0.3 });
    R.add('arm' + s, G.cbox(0.42, 0.62, 0.44, 0.06), m1, { p: [0, -0.32, 0], metal: 0.45, rough: 0.4 });
    R.add('fore' + s, G.cyl(0.17, 0.17, 0.48, 8), metal, { r: [0, 0, PI / 2], metal: 0.85, rough: 0.3 });
    R.add('thigh' + s, G.cyl(0.24, 0.24, 0.42, 10), metal, { r: [0, 0, PI / 2], metal: 0.85, rough: 0.3 });
    R.add('thigh' + s, G.cbox(0.46, 0.62, 0.52, 0.07), m2, { p: [0, -0.3, 0], metal: 0.55, rough: 0.35 });
    R.add('shin' + s, G.cyl(0.2, 0.2, 0.44, 10), metal, { r: [0, 0, PI / 2], metal: 0.85, rough: 0.3 });
    R.add('shin' + s, G.tbox(0.44, 0.48, 0.5, 0.56, 0.62), m1, { p: [0, -0.32, 0], metal: 0.45, rough: 0.4 });
    R.add('shin' + s, G.cbox(0.3, 0.06, 0.05, 0.01), glow, { p: [0, -0.2, 0.29], glow: 1.4 });
    R.add('foot' + s, G.cbox(0.62, 0.24, 0.95, 0.07), m2, { p: [0, -0.1, 0.18], metal: 0.6, rough: 0.35 });
    R.add('foot' + s, G.cbox(0.66, 0.06, 1.0, 0.02), '#2a2a30', { p: [0, -0.22, 0.18] });
  }
  // left: cannon fist ; right: claw
  R.add('foreL', G.cbox(0.52, 0.66, 0.52, 0.07), m1, { p: [0, -0.33, 0.04], metal: 0.45, rough: 0.4 });
  R.add('handL', G.cyl(0.24, 0.3, 0.5, 10), metal, { p: [0, -0.05, 0.25], r: [PI / 2, 0, 0], metal: 0.85, rough: 0.3 });
  R.add('handL', G.band(0.21, 0.06, 0.08, 10), glow, { p: [0, -0.05, 0.5], r: [PI / 2, 0, 0], glow: 2.2 });
  R.bone('cannon', 'handL', [0, -0.05, 0.55]);
  R.add('foreR', G.cbox(0.5, 0.62, 0.5, 0.07), m1, { p: [0, -0.31, 0], metal: 0.45, rough: 0.4 });
  for (const [x, z, rz] of [[0.14, 0.1, 0.35], [-0.14, 0.1, -0.35], [0, -0.16, 0]]) R.add('handR', G.tbox(0.12, 0.14, 0.06, 0.06, 0.5), metal, { p: [x, -0.22, z], r: [0, 0, rz], metal: 0.9, rough: 0.3 });
  R.bone('clawTip', 'handR', [0, -0.55, 0]);
  return {
    R, height: 3.9, bust: seat ? 0.95 : 0.7, style: 'mech', stride: 3.9, lean: 0.06, legSwing: 0.55, armSwing: 0.35, bob: 1.6, previewSpeed: 8,
    rest: { thighL: [-0.35, 0, 0], thighR: [-0.35, 0, 0], shinL: [0.65, 0, 0], shinR: [0.65, 0, 0], footL: [-0.3, 0, 0], footR: [-0.3, 0, 0], armL: [-0.2, 0, 0.12], armR: [-0.1, 0, -0.12], foreL: [-0.5, 0, 0], foreR: [-0.35, 0, 0], 'hips@p': [0, -0.1, 0] },
    attacks: [{ W: { armL: [-1.3, 0, 0.1], foreL: [-0.2, 0, 0], chest: [0, 0.3, 0], pipArm: [-2.3, 0, 0] }, S: { armL: [-1.6, 0, 0], foreL: [0.1, 0, 0], 'armL@p': [0, 0, -0.2], chest: [-0.06, -0.15, 0], pipArm: [-0.8, 0, 0] } }],
    casts: {
      q: { wind: 0.06, hold: 0.15, rec: 0.3, W: { pipArm: [-2.6, 0, 0], seat: [0, 0.4, 0] }, S: { pipArm: [-0.7, 0, 0], seat: [0, -0.2, 0] } },
      w: { wind: 0.06, hold: 0.5, rec: 0.3, W: {}, S: { pipArm: [-1.6, 0, 0], armR: [-1.4, 0, 0], head: [0.1, 0, 0] } },
      r: { wind: 0.12, hold: 0.45, rec: 0.35, W: { 'hips@p': [0, -0.35, 0], thighL: [-0.6, 0, 0], shinL: [0.9, 0, 0], thighR: [-0.6, 0, 0], shinR: [0.9, 0, 0] }, S: { 'hips@p': [0, 0.3, 0], armL: [-2.8, 0, 0.3], armR: [-2.8, 0, -0.3], pipArm: [-2.8, 0, 0] } },
    },
    muzzle: 'cannon', castFrom: { q: 'pipHead', w: 'head', r: 'cannon' },
    death: { 'hips@p': [0, -0.7, 0], chest: [0.35, 0, 0.45], thighL: [-1.2, 0, 0], shinL: [1.6, 0, 0], thighR: [-1.1, 0, 0], shinR: [1.6, 0, 0], armL: [0, 0, 0.8], armR: [0, 0, -0.6], head: [0.4, 0, 0] },
    recall: { head: [0.3, 0, 0], armL: [-0.4, 0, 0], armR: [-0.4, 0, 0] },
    fidget: { dur: 1.8, pose: { head: [0, 0.8, 0], chest: [0, 0.15, 0], pipArm: [-1.2, 0, 0] } },
    extra: (b, st, time) => { if (b.pipHead) b.pipHead.rotation.y += Math.sin(time * 0.8) * 0.35; },
    trails: null,
  };
}
