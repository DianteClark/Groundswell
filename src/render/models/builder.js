// Low-poly rig builder: accumulate primitives per bone (with vertex colors), merge into one
// mesh per bone (solid toon) + one per bone (unlit glow). Keeps draw calls low.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeToonMat, makeGlowMat } from '../util.js';

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

export const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg, 1),
  cone: (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg, 1),
  ico: (r, d = 0) => new THREE.IcosahedronGeometry(r, d),
  oct: (r) => new THREE.OctahedronGeometry(r, 0),
  dodec: (r) => new THREE.DodecahedronGeometry(r, 0),
  tet: (r) => new THREE.TetrahedronGeometry(r, 0),
  sph: (r, w = 7, h = 5) => new THREE.SphereGeometry(r, w, h),
  torus: (R, r, rs = 5, ts = 10, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, rs, ts, arc),
  // flat star prism (for stars/shuriken)
  star: (ro, ri, depth, points = 5) => {
    const sh = new THREE.Shape();
    for (let i = 0; i < points * 2; i++) {
      const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2; const r = i % 2 ? ri : ro;
      i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g;
  },
  // blade: flat tapered prism along +Y
  blade: (len, w, t = 0.06, curve = 0) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.quadraticCurveTo(w / 2 + curve, len * 0.6, 0, len); sh.quadraticCurveTo(-w / 2 + curve * 0.3, len * 0.6, -w / 2, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false, curveSegments: 3 }); g.translate(0, 0, -t / 2); return g;
  },
};

export function prep(geom, color, o = {}) {
  let g = geom.index ? geom.toNonIndexed() : geom;
  if (g !== geom) geom.dispose();
  g.deleteAttribute('uv'); if (g.attributes.uv1) g.deleteAttribute('uv1');
  _e.set(...(o.r || [0, 0, 0]));
  _q.setFromEuler(_e);
  const s = o.s === undefined ? [1, 1, 1] : typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s;
  _m.compose(_v.set(...(o.p || [0, 0, 0])), _q, _s.set(...s));
  g.applyMatrix4(_m);
  if (o.smooth !== true) g.computeVertexNormals();
  const n = g.attributes.position.count; const arr = new Float32Array(n * 3);
  _c.set(color);
  // slight per-face shade jitter for hand-made feel
  for (let i = 0; i < n; i += 3) {
    const j = o.jitter === false ? 1 : 0.94 + ((i * 7919) % 13) / 13 * 0.1;
    for (let k = 0; k < 3 && i + k < n; k++) { arr[(i + k) * 3] = _c.r * j; arr[(i + k) * 3 + 1] = _c.g * j; arr[(i + k) * 3 + 2] = _c.b * j; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

export class Rig {
  constructor() { this.defs = { root: { parent: null, p: [0, 0, 0] } }; this.parts = {}; }
  bone(name, parent = 'root', p = [0, 0, 0]) { this.defs[name] = { parent, p }; return this; }
  add(bone, geom, color, o = {}) {
    if (!this.defs[bone]) this.bone(bone);
    const key = bone + '#s';
    const g = prep(geom, color, o);
    g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(o.glow ? 1 : 0), 1));
    (this.parts[key] ||= []).push(g);
    return this;
  }
  build(opts = {}) {
    const mat = opts.mat || makeToonMat({ rim: opts.rim ?? 0xffffff, rimStrength: opts.rimStrength ?? 0.5 });
    const glowMat = opts.glowMat || makeGlowMat(0xffffff, { vertexColors: true });
    const bones = {};
    const root = new THREE.Group();
    bones.root = root;
    const order = Object.keys(this.defs);
    for (const name of order) {
      if (name === 'root') continue;
      const g = new THREE.Group(); g.name = name; g.position.set(...this.defs[name].p); bones[name] = g;
    }
    for (const name of order) {
      if (name === 'root') continue;
      const par = bones[this.defs[name].parent] || root; par.add(bones[name]);
    }
    for (const key in this.parts) {
      const [bone, kind] = key.split('#');
      const geo = mergeGeometries(this.parts[key], false);
      this.parts[key].forEach((g) => g.dispose());
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, kind === 'g' ? glowMat : mat);
      if (kind === 's') { mesh.castShadow = opts.shadow !== false; }
      mesh.userData.glow = kind === 'g';
      bones[bone].add(mesh);
    }
    for (const name in bones) {
      const b = bones[name]; b.userData.rest = { p: b.position.clone(), r: b.rotation.clone(), s: b.scale.clone() };
    }
    return { root, bones, mat, glowMat };
  }
}

// Merge a list of prepared geometries into a single static geometry (for map/instancing)
export function mergeColored(list) {
  const g = mergeGeometries(list, false); list.forEach((x) => x.dispose()); g.computeBoundingSphere(); return g;
}
