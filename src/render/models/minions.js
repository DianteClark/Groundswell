// Minions (HEROES lead): one InstancedMesh per type (1 draw call each + shadow). Limb animation
// (march cycle synced to ground speed, weapon wind-up/strike, death fall) runs in the vertex shader from
// per-instance attributes, so hundreds of minions stay cheap. Team colour per instance on team parts.
import * as THREE from 'three';
import { G, prep } from './builder.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { teamColor } from '../util.js';

const PI = Math.PI;
const TYPES = ['minion_melee', 'minion_caster', 'minion_siege'];
const MINION_TEAM = { 0: '#2f7dff', 1: '#ff2e2e' }; // deeper red: plain team red reads pink under ACES
// part ids: 0 body, 1 legL/wheelsF, 2 legR/wheelsB, 3 weapon arm / cannon, 4 off arm / flag, 5 head
const PIV = {
  minion_melee: [[0, 0, 0], [0.2, 0.62, 0], [-0.2, 0.62, 0], [-0.46, 1.32, 0], [0.46, 1.32, 0], [0, 1.5, 0]],
  minion_caster: [[0, 0, 0], [0.16, 0.42, 0], [-0.16, 0.42, 0], [-0.42, 1.28, 0], [0.42, 1.28, 0], [0, 1.5, 0]],
  minion_siege: [[0, 0, 0], [0, 0.38, 0.5], [0, 0.38, -0.5], [0, 1.05, 0.0], [0.45, 1.2, -0.6], [0, 1.2, 0]],
};

function parts(type) {
  const L = []; const W = '#ffffff';
  const add = (part, team, geo, color, o = {}) => { const g = prep(geo, color, o); const n = g.attributes.position.count; g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1)); g.setAttribute('aTeam', new THREE.BufferAttribute(new Float32Array(n).fill(team ? 1 : 0), 1)); g.deleteAttribute('aGlow'); L.push(g); };
  const metal = '#c8ccd4', dark = '#3a3640', skin = '#f0c8a0', leather = '#6a4a32', wood = '#7a5232';
  if (type === 'minion_melee') {
    add(0, 1, G.tprism(0.62, 0.48, 0.74, 0.54, 0.62, 8), W, { p: [0, 0.95, 0] }); // tunic
    add(0, 0, G.tprism(0.76, 0.56, 0.72, 0.52, 0.14, 8), leather, { p: [0, 0.72, 0] }); // belt
    add(0, 0, G.cbox(0.12, 0.1, 0.05, 0.02), '#e8c050', { p: [0, 0.72, 0.28], metal: 0.9, rough: 0.3 });
    add(0, 0, G.tprism(0.72, 0.5, 0.66, 0.46, 0.2, 8), metal, { p: [0, 1.3, 0], metal: 0.8, rough: 0.35 }); // collar plate
    for (const [p, sx] of [[1, 1], [2, -1]]) { add(p, 0, G.tprism(0.2, 0.2, 0.24, 0.24, 0.42, 6), dark, { p: [sx * 0.2, 0.42, 0] }); add(p, 0, G.cbox(0.24, 0.16, 0.36, 0.04), leather, { p: [sx * 0.2, 0.1, 0.05] }); }
    // head + helmet + plume
    add(5, 0, G.sph(0.3, 8, 6), skin, { p: [0, 1.68, 0.02] });
    add(5, 0, G.sph(0.34, 8, 5), metal, { p: [0, 1.78, -0.02], s: [1.05, 0.85, 1.05], metal: 0.85, rough: 0.3 });
    add(5, 0, G.cbox(0.5, 0.08, 0.1, 0.02), dark, { p: [0, 1.64, 0.3] });
    add(5, 1, G.tube([[0, 2.0, 0.05], [0, 2.22, -0.12], [0, 2.1, -0.45]], 0.09, 0.03, 5, 4), W, {});
    // sword arm (right, -x)
    add(3, 1, G.tprism(0.18, 0.18, 0.2, 0.2, 0.42, 6), W, { p: [-0.46, 1.1, 0] });
    add(3, 0, G.cbox(0.18, 0.18, 0.18, 0.04), skin, { p: [-0.46, 0.85, 0.02] });
    add(3, 0, G.blade(0.95, 0.16, 0.05, 0), metal, { p: [-0.46, 0.82, 0.08], r: [PI / 2, 0, 0], metal: 0.9, rough: 0.25 });
    add(3, 0, G.cbox(0.32, 0.06, 0.08, 0.02), '#e8c050', { p: [-0.46, 0.82, 0.08], metal: 0.9, rough: 0.3 });
    // shield arm (left, +x)
    add(4, 1, G.tprism(0.18, 0.18, 0.2, 0.2, 0.42, 6), W, { p: [0.46, 1.1, 0] });
    add(4, 1, G.cyl(0.36, 0.36, 0.1, 8), W, { p: [0.58, 0.95, 0.1], r: [0, 0, PI / 2] });
    add(4, 0, G.band(0.36, 0.06, 0.12, 8), metal, { p: [0.58, 0.95, 0.1], r: [0, 0, PI / 2], metal: 0.85, rough: 0.3 });
    add(4, 0, G.cyl(0.12, 0.12, 0.13, 6), '#e8c050', { p: [0.6, 0.95, 0.1], r: [0, 0, PI / 2], metal: 0.9, rough: 0.3 });
  } else if (type === 'minion_caster') {
    add(0, 1, G.lathe([[0.2, 1.38], [0.32, 1.1], [0.5, 0.55], [0.58, 0.28], [0.52, 0.25]], 8), W, {}); // robe
    add(0, 0, G.lathe([[0.48, 0.5], [0.56, 0.3], [0.5, 0.28]], 8), '#e8dcc0', {}); // hem trim
    add(0, 0, G.band(0.33, 0.05, 0.1, 8), '#e8c050', { p: [0, 0.95, 0], metal: 0.8, rough: 0.35 });
    for (const [p, sx] of [[1, 1], [2, -1]]) add(p, 0, G.cbox(0.2, 0.14, 0.32, 0.04), leather, { p: [sx * 0.16, 0.08, 0.1] });
    add(5, 0, G.sph(0.3, 8, 6), skin, { p: [0, 1.6, 0.02] });
    add(5, 0, G.sph(0.08, 5, 4), '#2a1a20', { p: [0.1, 1.64, 0.28], jitter: false }); add(5, 0, G.sph(0.08, 5, 4), '#2a1a20', { p: [-0.1, 1.64, 0.28], jitter: false });
    add(5, 1, G.cyl(0.52, 0.55, 0.05, 10), W, { p: [0, 1.8, 0] });
    add(5, 1, G.tube([[0, 1.8, 0], [0, 2.25, -0.05], [0, 2.55, -0.25], [0, 2.6, -0.5]], 0.3, 0.03, 7, 5), W, {});
    add(5, 0, G.band(0.3, 0.04, 0.08, 8), '#e8c050', { p: [0, 1.86, 0], metal: 0.8 });
    add(3, 1, G.lathe([[0.08, 0.05], [0.14, -0.25], [0.2, -0.42]], 6), W, { p: [-0.42, 1.28, 0] });
    add(3, 0, G.cyl(0.04, 0.05, 1.7, 5), wood, { p: [-0.48, 1.1, 0.12] });
    add(3, 1, G.ico(0.17, 1), W, { p: [-0.48, 2.0, 0.12], glow: 1.4 });
    add(3, 0, G.torus(0.17, 0.03, 3, 8), '#e8c050', { p: [-0.48, 1.86, 0.12], r: [PI / 2, 0, 0], metal: 0.9 });
    add(4, 1, G.lathe([[0.08, 0.05], [0.14, -0.25], [0.2, -0.42]], 6), W, { p: [0.42, 1.28, 0] });
    add(4, 0, G.cbox(0.16, 0.22, 0.12, 0.03), '#c8a878', { p: [0.48, 0.82, 0.12] }); // book
  } else {
    add(0, 0, G.cbox(1.2, 0.5, 1.5, 0.08), wood, { p: [0, 0.65, 0] });
    add(0, 1, G.cbox(1.26, 0.12, 1.56, 0.03), W, { p: [0, 0.92, 0] });
    for (let i = -1; i <= 1; i++) add(0, 0, G.cbox(1.24, 0.06, 0.06, 0.01), '#5a3a22', { p: [0, 0.5, i * 0.5] });
    for (const [p, z] of [[1, 0.5], [2, -0.5]]) for (const x of [0.66, -0.66]) { add(p, 0, G.cyl(0.36, 0.36, 0.14, 10), '#4a3a2a', { p: [x, 0.38, z], r: [0, 0, PI / 2] }); add(p, 0, G.band(0.36, 0.05, 0.16, 10), metal, { p: [x, 0.38, z], r: [0, 0, PI / 2], metal: 0.85, rough: 0.35 }); for (let k = 0; k < 3; k++) add(p, 0, G.cbox(0.05, 0.62, 0.06, 0.01), '#6a5a48', { p: [x, 0.38, z], r: [k * PI / 3, 0, 0] }); }
    add(3, 0, G.cyl(0.26, 0.34, 1.3, 9), '#4a4a55', { p: [0, 1.15, 0.35], r: [PI / 2 - 0.3, 0, 0], metal: 0.7, rough: 0.35 });
    add(3, 0, G.band(0.32, 0.06, 0.14, 9), '#e8c050', { p: [0, 1.32, 0.88], r: [PI / 2 - 0.3, 0, 0], metal: 0.9 });
    add(3, 1, G.cyl(0.2, 0.2, 0.05, 9), W, { p: [0, 1.36, 0.98], r: [PI / 2 - 0.3, 0, 0], glow: 1.2 });
    add(3, 0, G.dodec(0.3), '#4a4a55', { p: [0, 1.0, -0.15], metal: 0.6, rough: 0.4 });
    add(4, 0, G.cyl(0.03, 0.03, 1.1, 4), '#5a3a22', { p: [0.45, 1.5, -0.6] });
    add(4, 1, G.shape([[0, 0], [0.55, -0.12], [0, -0.38]], 0.03), W, { p: [0.47, 1.95, -0.6] });
  }
  const g = mergeGeometries(L, false); L.forEach((x) => x.dispose()); g.computeBoundingSphere(); return g;
}

function makeMinionMat(type) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 1 });
  const piv = PIV[type].map((p) => new THREE.Vector3(...p));
  const u = { uPiv: { value: piv }, uSiege: { value: type === 'minion_siege' ? 1 : 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute float aPart; attribute float aTeam; attribute vec3 aMat; attribute vec4 aAnim; attribute vec3 aTeamCol; attribute float aFlash;
      uniform vec3 uPiv[6]; uniform float uSiege; varying vec3 vMat; varying float vFlash;
      mat3 rx(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }`)
      .replace('#include <color_vertex>', `#include <color_vertex>
      vColor.rgb = mix(vColor.rgb, vColor.rgb * aTeamCol, aTeam); vMat = aMat; vFlash = aFlash;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      int gsPart = int(aPart + 0.5); float ph = aAnim.x, mv = aAnim.y, arm = aAnim.z, die = aAnim.w; float pa = 0.0;
      if (uSiege < 0.5) {
        if (gsPart == 1) pa = sin(ph) * 0.75 * mv; else if (gsPart == 2) pa = -sin(ph) * 0.75 * mv;
        else if (gsPart == 3) pa = -sin(ph) * 0.4 * mv + arm; else if (gsPart == 4) pa = sin(ph) * 0.4 * mv - arm * 0.15; else if (gsPart == 5) pa = -arm * 0.08;
      } else { if (gsPart == 1 || gsPart == 2) pa = ph * 1.6; else if (gsPart == 3) pa = arm * 0.25; else if (gsPart == 4) pa = sin(ph * 0.5) * 0.2 * mv; }
      mat3 gsR = rx(pa); mat3 gsW = rx(0.12 * mv * (1.0 - uSiege) - die * 1.45);
      objectNormal = gsW * (gsR * objectNormal);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 gsP = uPiv[gsPart]; transformed = gsR * (transformed - gsP) + gsP;
      transformed.y += abs(cos(ph)) * 0.1 * mv * (1.0 - uSiege) - die * 0.25;
      transformed = gsW * transformed; transformed.z -= die * 0.1;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMat; varying float vFlash;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(vMat.z, 0.05, 1.0);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = clamp(vMat.y, 0.0, 1.0);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * (vMat.x * 1.6 + 0.06);')
      .replace('#include <opaque_fragment>', `{ vec3 gsV = normalize(vViewPosition); float fr = 1.0 - clamp(dot(gsV, normal), 0.0, 1.0); outgoingLight += vec3(1.0, 0.95, 0.9) * pow(fr, 3.0) * 0.35; }
        outgoingLight = mix(outgoingLight, vec3(1.6), vFlash);
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'gsMinion';
  return m;
}

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const ease = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

export class MinionInstancer {
  constructor(scene) {
    this.scene = scene; this.types = {}; this.track = new Map(); this.frame = 0; this.time = 0; this.last = performance.now();
    for (const t of TYPES) {
      const geo = parts(t); const mat = makeMinionMat(t); mat.userData.shared = true;
      const T = { geo, mat, cap: 0, n: 0, mesh: null };
      this._alloc(T, 48); this.types[t] = T;
    }
  }
  _alloc(T, cap) {
    const old = T.mesh;
    const m = new THREE.InstancedMesh(T.geo, T.mat, cap); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.castShadow = true;
    const A = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    const C = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3).setUsage(THREE.DynamicDrawUsage);
    const F = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
    // InstancedMesh shares geometry; per-instance attributes must live on a geometry clone per mesh
    const g = T.geo.clone(); g.setAttribute('aAnim', A); g.setAttribute('aTeamCol', C); g.setAttribute('aFlash', F); m.geometry = g;
    if (old) { this.scene.remove(old); old.geometry.dispose(); old.dispose(); }
    this.scene.add(m); T.mesh = m; T.cap = cap; T.A = A; T.C = C; T.F = F;
  }
  begin() { for (const t in this.types) this.types[t].n = 0; this.frame++; const now = performance.now(); this.dt = Math.min(0.1, (now - this.last) / 1000); this.last = now; }
  // o: {x,z,rot,scale,lift,ground,flash,team,id,moving,state,at, tilt,tiltX}
  push(type, o) {
    const T = this.types[type] || this.types.minion_melee;
    if (T.n >= T.cap) { const n = T.n; this._alloc(T, T.cap * 2); T.n = n; }
    const i = T.n++;
    let ph = 0, mv = o.moving ? 1 : 0, arm = 0, die = 0;
    const animated = o.state !== undefined || o.id !== undefined;
    if (o.id != null) {
      let tr = this.track.get(o.id); if (!tr) { tr = { ph: Math.random() * 6, x: o.x, z: o.z, mv: 0 }; this.track.set(o.id, tr); }
      const d = Math.hypot(o.x - tr.x, o.z - tr.z); if (d < 3) tr.ph += d / (type === 'minion_siege' ? 1.2 : 2.0) * PI * 2; tr.x = o.x; tr.z = o.z; tr.f = this.frame;
      tr.mv += ((o.moving ? 1 : 0) - tr.mv) * Math.min(1, (this.dt || 0.016) * 10); ph = tr.ph; mv = tr.mv;
    }
    const at = o.at || 0;
    if (o.state === 'attack') { const k = Math.min(1, at / 0.5); arm = k < 0.45 ? -2.3 * ease(k / 0.45) : k < 0.62 ? -2.3 + 2.7 * ease((k - 0.45) / 0.17) : 0.4 * (1 - ease((k - 0.62) / 0.38)); if (type === 'minion_siege') arm = k < 0.2 ? -ease(k / 0.2) : -(1 - ease((k - 0.2) / 0.5)); }
    if (o.state === 'dead') die = ease(at / 0.6);
    const y = o.ground ?? o.lift ?? 0;
    _e.set(animated ? 0 : (o.tiltX || 0), o.rot, animated ? 0 : (o.tilt || 0), 'YXZ'); _q.setFromEuler(_e);
    const sc = (o.scale ?? 1) * 1.12;
    _m4.compose(_p.set(o.x, y, o.z), _q, _s.setScalar(sc));
    T.mesh.setMatrixAt(i, _m4);
    T.A.setXYZW(i, ph, mv, arm, die);
    _c.set(MINION_TEAM[o.team] ?? teamColor(o.team)); T.C.setXYZ(i, _c.r, _c.g, _c.b);
    T.F.setX(i, Math.min(1, (o.flash || 0) * 0.8));
  }
  end() {
    for (const t in this.types) { const T = this.types[t]; const m = T.mesh; m.count = T.n; m.instanceMatrix.needsUpdate = true; T.A.needsUpdate = true; T.C.needsUpdate = true; T.F.needsUpdate = true; }
    if (this.frame % 120 === 0) for (const [id, tr] of this.track) if (this.frame - tr.f > 60) this.track.delete(id);
  }
  setShadows(on) { for (const t in this.types) this.types[t].mesh.castShadow = on; }
  dispose() { for (const t in this.types) { const T = this.types[t]; this.scene.remove(T.mesh); T.mesh.geometry.dispose(); T.mesh.dispose(); T.geo.dispose(); T.mat.dispose(); } }
}
