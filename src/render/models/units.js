// Non-hero models: minions (instanced), towers, core, monsters, summons.
import * as THREE from 'three';
import { Rig, G, prep, mergeColored } from './builder.js';
import { makeToonMat, makeGlowMat, teamColor, ease, clamp, glowTexture } from '../util.js';
import { buildHero, poseRig } from './heroes.js';

const PI = Math.PI;
export const ELEMENT_COLORS = { ember: '#ff6a2a', tide: '#2fb0ff', gale: '#9ff5d8', stone: '#c9a46a', none: '#c080ff' };

// ───────────────────────────── MINIONS (instanced) ─────────────────────────────
function minionParts(type) {
  const body = [], team = [], glow = [];
  const metal = '#b8bec8', dark = '#3a3a44', skin = '#e8c09a', wood = '#7a5232';
  if (type === 'minion_melee') {
    team.push(prep(G.cyl(0.42, 0.5, 0.7, 6), '#ffffff', { p: [0, 0.75, 0] }));
    body.push(prep(G.box(0.7, 0.12, 0.5), dark, { p: [0, 0.48, 0] }));
    body.push(prep(G.ico(0.32, 0), skin, { p: [0, 1.3, 0.02] }));
    body.push(prep(G.cyl(0.36, 0.36, 0.3, 7), metal, { p: [0, 1.42, 0] }));
    body.push(prep(G.box(0.5, 0.06, 0.08), dark, { p: [0, 1.34, 0.32] }));
    team.push(prep(G.cone(0.1, 0.4, 4), '#ffffff', { p: [0, 1.75, -0.05], r: [-0.3, 0, 0] }));
    body.push(prep(G.cyl(0.12, 0.1, 0.45, 5), dark, { p: [0.18, 0.22, 0] }));
    body.push(prep(G.cyl(0.12, 0.1, 0.45, 5), dark, { p: [-0.18, 0.22, 0] }));
    body.push(prep(G.box(0.08, 0.9, 0.16), metal, { p: [-0.5, 1.0, 0.35], r: [0.6, 0, 0] }));
    body.push(prep(G.box(0.3, 0.06, 0.1), dark, { p: [-0.5, 0.7, 0.12], r: [0.6, 0, 0] }));
    team.push(prep(G.cyl(0.32, 0.32, 0.08, 6), '#ffffff', { p: [0.5, 0.85, 0.15], r: [0, 0, PI / 2] }));
    body.push(prep(G.cyl(0.12, 0.12, 0.1, 6), metal, { p: [0.56, 0.85, 0.15], r: [0, 0, PI / 2] }));
  } else if (type === 'minion_caster') {
    team.push(prep(G.cone(0.48, 1.1, 6), '#ffffff', { p: [0, 0.6, 0] }));
    body.push(prep(G.ico(0.28, 0), skin, { p: [0, 1.2, 0.02] }));
    team.push(prep(G.cone(0.38, 0.65, 5), '#ffffff', { p: [0, 1.6, -0.05], r: [-0.25, 0, 0] }));
    body.push(prep(G.cyl(0.46, 0.46, 0.05, 7), dark, { p: [0, 1.36, 0] }));
    body.push(prep(G.box(0.4, 0.12, 0.3), '#d8d0c0', { p: [0, 1.05, 0.12] }));
    body.push(prep(G.cyl(0.035, 0.04, 1.5, 4), wood, { p: [-0.42, 0.85, 0.1] }));
    glow.push(prep(G.ico(0.16, 0), '#ffffff', { p: [-0.42, 1.68, 0.1] }));
  } else {
    body.push(prep(G.box(1.1, 0.5, 1.4), wood, { p: [0, 0.6, 0] }));
    for (const [x, z] of [[0.62, 0.45], [-0.62, 0.45], [0.62, -0.45], [-0.62, -0.45]]) body.push(prep(G.cyl(0.32, 0.32, 0.14, 8), dark, { p: [x, 0.32, z], r: [0, 0, PI / 2] }));
    body.push(prep(G.cyl(0.28, 0.36, 1.2, 7), '#4a4a55', { p: [0, 1.05, 0.35], r: [PI / 2 - 0.35, 0, 0] }));
    body.push(prep(G.torus(0.3, 0.06, 4, 8), metal, { p: [0, 1.25, 0.9], r: [-0.35, 0, 0] }));
    team.push(prep(G.box(0.04, 0.9, 0.04), '#ffffff', { p: [0.4, 1.3, -0.55] }));
    team.push(prep(G.box(0.5, 0.35, 0.03), '#ffffff', { p: [0.15, 1.55, -0.55] }));
    team.push(prep(G.box(1.15, 0.1, 1.45), '#ffffff', { p: [0, 0.88, 0] }));
    glow.push(prep(G.cyl(0.2, 0.2, 0.05, 7), '#ffffff', { p: [0, 1.28, 0.92], r: [PI / 2 - 0.35, 0, 0] }));
  }
  return { body: mergeColored(body), team: mergeColored(team), glow: glow.length ? mergeColored(glow) : null };
}

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

export class MinionInstancer {
  constructor(scene) {
    this.scene = scene; this.types = {};
    this.mat = makeToonMat({ rim: 0xffffff, rimStrength: 0.35 }); this.mat.userData.shared = true;
    this.glowMat = makeGlowMat(0xffffff, { vertexColors: true }); this.glowMat.userData.shared = true;
    for (const t of ['minion_melee', 'minion_caster', 'minion_siege']) {
      const parts = minionParts(t); const cap = 48; const ms = {};
      for (const k of ['body', 'team', 'glow']) {
        if (!parts[k]) continue;
        const m = new THREE.InstancedMesh(parts[k], k === 'glow' ? this.glowMat : this.mat, cap);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false;
        m.castShadow = k !== 'glow'; m.setColorAt(0, _c.set(1, 1, 1)); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
        scene.add(m); ms[k] = m;
      }
      this.types[t] = { ms, cap, n: 0, parts };
    }
  }
  begin() { for (const t in this.types) this.types[t].n = 0; }
  // o: {x,z,rot,scale,tilt,lift,flash,team, alpha}
  push(type, o) {
    const T = this.types[type] || this.types.minion_melee;
    if (T.n >= T.cap) this._grow(T);
    const i = T.n++;
    _e.set(o.tiltX || 0, o.rot, o.tilt || 0, 'YXZ'); _q.setFromEuler(_e);
    _m4.compose(_p.set(o.x, o.lift || 0, o.z), _q, _s.setScalar(o.scale ?? 1));
    const tc = _c.set(teamColor(o.team));
    for (const k in T.ms) {
      const m = T.ms[k]; m.setMatrixAt(i, _m4);
      if (k === 'body') { const f = 1 + (o.flash || 0) * 1.5; m.setColorAt(i, _c.setRGB(f, f, f)); }
      else if (k === 'team') { _c.set(teamColor(o.team)); _c.multiplyScalar(1 + (o.flash || 0)); m.setColorAt(i, _c); }
      else { _c.set(teamColor(o.team)).lerp(new THREE.Color(1, 1, 1), 0.35).multiplyScalar(1.4); m.setColorAt(i, _c); }
    }
  }
  end() {
    for (const t in this.types) {
      const T = this.types[t];
      for (const k in T.ms) { const m = T.ms[k]; m.count = T.n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    }
  }
  _grow(T) {
    const cap = T.cap * 2;
    for (const k in T.ms) {
      const old = T.ms[k]; const m = new THREE.InstancedMesh(old.geometry, old.material, cap);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.castShadow = old.castShadow;
      m.setColorAt(0, _c.set(1, 1, 1));
      for (let i = 0; i < T.cap; i++) { old.getMatrixAt(i, _m4); m.setMatrixAt(i, _m4); old.getColorAt(i, _c); m.setColorAt(i, _c); }
      this.scene.remove(old); old.dispose(); this.scene.add(m); T.ms[k] = m;
    }
    T.cap = cap;
  }
  setShadows(on) { for (const t in this.types) for (const k in this.types[t].ms) if (k !== 'glow') this.types[t].ms[k].castShadow = on; }
  dispose() { for (const t in this.types) for (const k in this.types[t].ms) { const m = this.types[t].ms[k]; this.scene.remove(m); m.geometry.dispose(); m.dispose(); } this.mat.dispose(); this.glowMat.dispose(); }
}

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
  const body = new THREE.Color(ec).multiplyScalar(0.55).getStyle();
  const belly = new THREE.Color(ec).lerp(new THREE.Color('#fff2d0'), 0.55).getStyle();
  const R = new Rig();
  R.bone('hips', 'root', [0, 2.2, 0]); R.bone('torso', 'hips'); R.bone('neck', 'torso', [0, 0.6, 1.6]); R.bone('head', 'neck', [0, 1.4, 1.0]);
  R.bone('wingL', 'torso', [0.9, 0.8, 0.2]); R.bone('wingR', 'torso', [-0.9, 0.8, 0.2]); R.bone('tail', 'torso', [0, 0, -1.8]);
  for (const [n, x, z] of [['legFL', 0.9, 0.9], ['legFR', -0.9, 0.9], ['legBL', 0.9, -0.9], ['legBR', -0.9, -0.9]]) { R.bone(n, 'hips', [x, 0, z]); R.add(n, G.cyl(0.32, 0.22, 2.0, 5), body, { p: [0, -1.0, 0] }); R.add(n, G.box(0.5, 0.2, 0.6), body, { p: [0, -2.05, 0.15] }); }
  R.add('torso', G.ico(1.4, 0), body, { s: [1.0, 0.85, 1.6] });
  R.add('torso', G.ico(1.1, 0), belly, { p: [0, -0.35, 0.2], s: [0.9, 0.6, 1.4] });
  for (let i = 0; i < 5; i++) R.add('torso', G.cone(0.22, 0.6, 4), ec, { p: [0, 1.2 - Math.abs(i - 2) * 0.1, -1.2 + i * 0.6], r: [-0.3, 0, 0], glow: true });
  R.add('neck', G.cyl(0.45, 0.65, 1.8, 6), body, { p: [0, 0.6, 0.4], r: [0.6, 0, 0] });
  R.add('head', G.ico(0.7, 0), body, { s: [0.9, 0.75, 1.1] });
  R.add('head', G.box(0.8, 0.45, 1.0), body, { p: [0, -0.15, 0.75] });
  R.add('head', G.box(0.7, 0.18, 0.9), belly, { p: [0, -0.42, 0.7] });
  for (const sx of [1, -1]) { R.add('head', G.cone(0.14, 1.1, 4), '#f0e8d0', { p: [sx * 0.35, 0.55, -0.4], r: [-1.0, 0, -sx * 0.3] }); R.add('head', G.box(0.2, 0.1, 0.1), ec, { p: [sx * 0.3, 0.12, 0.5], glow: true }); }
  for (const [w, sx] of [['wingL', 1], ['wingR', -1]]) {
    R.add(w, G.cyl(0.08, 0.12, 2.6, 4), body, { p: [sx * 1.2, 0.6, 0], r: [0, 0, -sx * 1.1] });
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(sx * 2.6, 1.3); sh.lineTo(sx * 3.0, -0.6); sh.lineTo(sx * 1.6, -0.9); sh.lineTo(sx * 0.4, -0.5);
    const g = new THREE.ShapeGeometry(sh); g.rotateX(PI / 2);
    R.add(w, g, ec, { p: [0, 0.4, 0], r: [0, 0, 0] });
    R.add(w, g.clone(), ec, { p: [0, 0.38, 0], r: [PI, 0, 0] });
  }
  R.add('tail', G.cone(0.6, 3.2, 6), body, { p: [0, 0, -1.4], r: [-PI / 2 - 0.15, 0, 0] });
  R.add('tail', G.oct(0.4), ec, { p: [0, -0.5, -3.0], s: [0.5, 1, 1.4], glow: true });
  return { R, height: 7.5, scale: 1.4, rim: ec };
}
function colossus() {
  const R = new Rig();
  const rock = '#7a7088', rock2 = '#5a5268', glow = '#c07aff';
  R.bone('hips', 'root', [0, 3.0, 0]); R.bone('torso', 'hips'); R.bone('head', 'torso', [0, 3.0, 0.6]);
  R.bone('armL', 'torso', [2.4, 2.6, 0]); R.bone('armR', 'torso', [-2.4, 2.6, 0]);
  R.bone('legL', 'hips', [1.0, 0, 0]); R.bone('legR', 'hips', [-1.0, 0, 0]);
  R.add('torso', G.dodec(2.2), rock, { p: [0, 1.6, 0], s: [1.15, 1.0, 0.85] });
  R.add('torso', G.dodec(1.3), rock2, { p: [0, 2.9, -0.5] });
  R.add('torso', G.oct(0.7), glow, { p: [0, 1.7, 1.6], s: [0.7, 1, 0.5], glow: true });
  for (let i = 0; i < 4; i++) R.add('torso', G.oct(0.35), glow, { p: [Math.cos(i * 1.6) * 1.8, 2.8 + (i % 2) * 0.4, -0.8], s: [0.6, 1.6, 0.6], glow: true });
  for (const sx of [1, -1]) R.add('torso', G.dodec(1.0), rock2, { p: [sx * 2.1, 2.9, 0] });
  R.add('head', G.dodec(0.8), rock, { s: [1.1, 0.8, 1] });
  R.add('head', G.box(0.9, 0.15, 0.1), glow, { p: [0, 0.05, 0.72], glow: true });
  for (const [a, sx] of [['armL', 1], ['armR', -1]]) { R.add(a, G.dodec(0.75), rock2, { p: [sx * 0.2, -1.0, 0] }); R.add(a, G.dodec(0.85), rock, { p: [sx * 0.3, -2.4, 0.2] }); R.add(a, G.dodec(1.05), rock2, { p: [sx * 0.3, -3.6, 0.3] }); R.add(a, G.oct(0.25), glow, { p: [sx * 0.6, -2.4, 0.6], glow: true }); }
  for (const l of ['legL', 'legR']) { R.add(l, G.dodec(0.85), rock2, { p: [0, -1.2, 0] }); R.add(l, G.box(1.3, 0.8, 1.6), rock, { p: [0, -2.6, 0.2] }); }
  return { R, height: 8.5, rim: glow };
}
const MONSTERS = { camp_small: campSmall, camp_big: campBig, wyrm, colossus };

export function buildMonster(model, element) {
  const f = MONSTERS[model] || campSmall;
  const def = f(element);
  const rig = def.R.build({ rim: def.rim || '#ffffff', rimStrength: 0.4 });
  rig.def = { style: 'monster', height: def.height };
  if (def.scale) { const outer = new THREE.Group(); outer.add(rig.root); outer.scale.setScalar(def.scale); rig.outer = outer; }
  return rig;
}

export function poseMonster(rig, anim, time, moving) {
  const b = rig.bones;
  for (const k in b) { const r = b[k].userData.rest; if (!r) continue; b[k].position.copy(r.p); b[k].rotation.copy(r.r); b[k].scale.copy(r.s); }
  let st = anim?.state || 'idle'; const at = anim?.t || 0; if (st === 'idle' && moving) st = 'run';
  const legs = ['legFL', 'legFR', 'legBL', 'legBR'].filter((n) => b[n]);
  if (b.wingL) { const f = st === 'attack' || st === 'cast' ? 6 : 1.6; b.wingL.rotation.z = Math.sin(time * f) * 0.35 + 0.1; b.wingR.rotation.z = -Math.sin(time * f) * 0.35 - 0.1; }
  if (b.tail) b.tail.rotation.y = Math.sin(time * 1.3) * 0.3;
  if (st === 'run') {
    const ph = time * 8, s = Math.sin(ph);
    legs.forEach((n, i) => { b[n].rotation.x = (i === 0 || i === 3 ? s : -s) * 0.6; });
    if (b.legL) { b.legL.rotation.x = s * 0.5; b.legR.rotation.x = -s * 0.5; b.armL.rotation.x = -s * 0.4; b.armR.rotation.x = s * 0.4; }
    b.hips.position.y += Math.abs(Math.cos(ph)) * 0.1;
  } else if (st === 'attack') {
    const k = clamp(at / 0.5, 0, 1), r = Math.sin(k * PI);
    b.hips.position.z += r * 0.5; b.torso.rotation.x = -r * 0.2 + ease((k - 0.5) * 2) * 0.3 * (1 - ease((k - 0.8) * 5));
    if (b.head) b.head.rotation.x = -0.4 * r + 0.3 * ease((k - 0.5) * 2) * (1 - k);
    if (b.neck) b.neck.rotation.x = -0.3 * r + 0.5 * ease((k - 0.45) * 3) * (1 - ease((k - 0.8) * 5));
    if (b.armL) { const up = k < 0.5 ? ease(k * 2) : 1 - ease((k - 0.5) * 3); b.armL.rotation.x = -2.4 * up; b.armR.rotation.x = -2.4 * up; }
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
  if (model === 'bram_wall') { // one living-bark wall segment (~r 1.45)
    for (let i = 0; i < 4; i++) { const a = i * 1.7, rr = i ? 0.7 : 0; R.add('body', G.cone(0.7 - i * 0.08, 2.8 - i * 0.35, 5), i % 2 ? c.secondary || '#8a6238' : c.primary || '#6b4a2b', { p: [Math.cos(a) * rr, 1.4 - i * 0.15, Math.sin(a) * rr], r: [Math.sin(a) * 0.2, a, Math.cos(a) * 0.2] }); }
    R.add('body', G.ico(0.45, 0), c.accent || '#6fbf3f', { p: [0.2, 2.5, 0.1] }); R.add('body', G.ico(0.32, 0), c.accent || '#6fbf3f', { p: [-0.5, 1.9, 0.3] });
    R.add('body', G.dodec(0.9), c.secondary || '#8a6238', { p: [0, 0.2, 0], s: [1.3, 0.4, 1.3] });
    R.add('body', G.box(0.08, 0.9, 0.05), glow, { p: [0, 1.2, 0.62], glow: true });
    height = 3;
  } else if (model === 'mire_totem') {
    R.add('body', G.cyl(0.32, 0.4, 2.4, 6), c.wood || '#5a3e28', { p: [0, 1.2, 0] });
    R.add('body', G.ico(0.45, 0), c.secondary || '#7a9a3a', { p: [0, 0.3, 0], s: [1.5, 0.5, 1.5] });
    R.add('body', G.ico(0.42, 0), '#e8e0c8', { p: [0, 2.6, 0], s: [1, 1.1, 1] });
    R.add('body', G.box(0.12, 0.1, 0.05), glow, { p: [0.15, 2.65, 0.38], glow: true }); R.add('body', G.box(0.12, 0.1, 0.05), glow, { p: [-0.15, 2.65, 0.38], glow: true });
    R.add('body', G.cone(0.08, 0.5, 4), '#e8e0c8', { p: [0.4, 3.0, 0], r: [0, 0, -0.8] }); R.add('body', G.cone(0.08, 0.5, 4), '#e8e0c8', { p: [-0.4, 3.0, 0], r: [0, 0, 0.8] });
    for (let i = 0; i < 3; i++) R.add('body', G.oct(0.1), vfx, { p: [Math.cos(i * 2.1) * 0.45, 1.6 - i * 0.3, Math.sin(i * 2.1) * 0.45], glow: true });
    height = 3.3;
  } else if (model === 'lumi_mark') {
    R.bone('spin', 'body', [0, 1.4, 0]);
    R.add('spin', G.star(0.7, 0.28, 0.12), vfx, { glow: true });
    R.add('spin', G.torus(0.95, 0.04, 3, 16), c.vfx2 || '#ffffff', { glow: true });
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
