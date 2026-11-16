// Low-poly rig builder (HEROES lead).
// Parts are authored per bone (bone-local coords). build() bakes everything into ONE rigidly-skinned
// SkinnedMesh (1 draw call + 1 shadow call per character) driven by a THREE.Bone hierarchy, so the
// procedural animator just rotates/translates bones. Per-vertex material params (glow/metal/rough)
// feed makeHeroMat (MeshStandardMaterial). prep()/mergeColored()/G stay backward compatible for map.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeHeroMat } from '../fx/materials.js';

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const PI = Math.PI;

function extrude(shape, depth, bevel = 0, curveSegments = 3) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments });
  g.translate(0, 0, -depth / 2); return g;
}
function poly(pts) { const sh = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); sh.closePath(); return sh; }

export const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg, 1),
  cone: (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg, 1),
  ico: (r, d = 0) => new THREE.IcosahedronGeometry(r, d),
  oct: (r) => new THREE.OctahedronGeometry(r, 0),
  dodec: (r) => new THREE.DodecahedronGeometry(r, 0),
  tet: (r) => new THREE.TetrahedronGeometry(r, 0),
  sph: (r, w = 7, h = 5) => new THREE.SphereGeometry(r, w, h),
  torus: (R, r, rs = 5, ts = 10, arc = PI * 2) => new THREE.TorusGeometry(R, r, rs, ts, arc),
  star: (ro, ri, depth, points = 5) => {
    const pts = []; for (let i = 0; i < points * 2; i++) { const a = (i / (points * 2)) * PI * 2 + PI / 2; const r = i % 2 ? ri : ro; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    return extrude(poly(pts), depth, 0);
  },
  blade: (len, w, t = 0.06, curve = 0) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.quadraticCurveTo(w / 2 + curve, len * 0.6, 0, len); sh.quadraticCurveTo(-w / 2 + curve * 0.3, len * 0.6, -w / 2, 0);
    return extrude(sh, t, 0);
  },
  // ── new chunky primitives ──
  // chamfered box (bevelled edges catch the light)
  cbox: (w, h, d, c = 0.08) => { c = Math.min(c, w * 0.3, h * 0.3, d * 0.3); const g = extrude(poly([[-w / 2 + c, -h / 2 + c], [w / 2 - c, -h / 2 + c], [w / 2 - c, h / 2 - c], [-w / 2 + c, h / 2 - c]]), Math.max(0.001, d - 2 * c), c, 1); return g; },
  // tapered box: bottom w0×d0, top w1×d1 (great for torsos, limbs, armour plates)
  tbox: (w0, d0, w1, d1, h, c = 0) => {
    const g = new THREE.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2, h, 4, 1); g.rotateY(PI / 4);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const top = p.getY(i) > 0; p.setX(i, p.getX(i) * (top ? w1 : w0)); p.setZ(i, p.getZ(i) * (top ? d1 : d0)); }
    g.computeVertexNormals(); return g;
  },
  // octagonal prism (bevelled-looking column), w×h×d
  prism: (w, h, d, seg = 8) => { const g = new THREE.CylinderGeometry(0.5, 0.5, h, seg, 1); g.rotateY(PI / seg); g.scale(w, 1, d); return g; },
  // tapered octagonal prism
  tprism: (w0, d0, w1, d1, h, seg = 8) => { const g = new THREE.CylinderGeometry(0.5, 0.5, h, seg, 1); g.rotateY(PI / seg); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const top = p.getY(i) > 0; p.setX(i, p.getX(i) * (top ? w1 : w0)); p.setZ(i, p.getZ(i) * (top ? d1 : d0)); } return g; },
  // lathe from [[r,y],...] profile
  lathe: (pts, seg = 8) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), seg),
  // flat extruded polygon in XY (thickness along Z)
  shape: (pts, depth = 0.08, bevel = 0) => extrude(poly(pts), depth, bevel, 2),
  // gem: double pyramid with n sides
  gem: (r, h, n = 6, mid = 0.35) => G.lathe([[0, -h * mid], [r, 0], [0, h * (1 - mid)]], n),
  // leaf / petal / flame tongue (pointed lens in XY, thickness t)
  leaf: (len, w, t = 0.05) => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(w, len * 0.4, 0, len); sh.quadraticCurveTo(-w, len * 0.4, 0, 0); return extrude(sh, t, 0); },
  // horn / tusk: curved cone along a quadratic arc in YZ plane
  horn: (len, r, bend = 0.4, seg = 5, rings = 5) => {
    const pts = []; for (let i = 0; i <= rings; i++) { const t = i / rings; pts.push(new THREE.Vector3(0, t * len, Math.sin(t * PI * 0.5) * bend * len)); }
    const curve = new THREE.CatmullRomCurve3(pts); const g = new THREE.TubeGeometry(curve, rings, r, seg, false);
    const p = g.attributes.position; const n = (seg + 1);
    for (let i = 0; i <= rings; i++) { const k = 1 - i / rings * 0.92; const c = curve.getPoint(i / rings); for (let j = 0; j < n; j++) { const idx = i * n + j; p.setXYZ(idx, c.x + (p.getX(idx) - c.x) * k, c.y + (p.getY(idx) - c.y) * k, c.z + (p.getZ(idx) - c.z) * k); } }
    return g;
  },
  // swept tube through points with radius r0 → r1
  tube: (pts, r0, r1 = r0, seg = 5, rings = 6) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, rings, 1, seg, false); const p = g.attributes.position; const n = seg + 1;
    for (let i = 0; i <= rings; i++) { const r = r0 + (r1 - r0) * (i / rings); const c = curve.getPoint(i / rings); for (let j = 0; j < n; j++) { const idx = i * n + j; p.setXYZ(idx, c.x + (p.getX(idx) - c.x) * r, c.y + (p.getY(idx) - c.y) * r, c.z + (p.getZ(idx) - c.z) * r); } }
    return g;
  },
  // double-sided triangle fan through 3D points (wing membranes, capes); first point is the hub
  fan: (pts) => { const pos = []; const P0 = pts[0]; for (let i = 1; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; pos.push(...P0, ...a, ...b, ...P0, ...b, ...a); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g; },
  // ring band (flat washer) of radius R, width w, height h
  band: (R, w, h, seg = 10) => G.lathe([[R - w, -h / 2], [R, -h / 2], [R, h / 2], [R - w, h / 2], [R - w, -h / 2]], seg),
};

// Prepare a geometry: non-indexed, transformed, vertex colors (+ per-face shade jitter), aMat.
export function prep(geom, color, o = {}) {
  let g = geom.index ? geom.toNonIndexed() : geom;
  if (g !== geom) geom.dispose();
  if (g.attributes.uv) g.deleteAttribute('uv'); if (g.attributes.uv1) g.deleteAttribute('uv1');
  _e.set(...(o.r || [0, 0, 0]));
  _q.setFromEuler(_e);
  const s = o.s === undefined ? [1, 1, 1] : typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s;
  _m.compose(_v.set(...(o.p || [0, 0, 0])), _q, _s.set(...s));
  g.applyMatrix4(_m);
  g.computeVertexNormals();
  const n = g.attributes.position.count; const arr = new Float32Array(n * 3);
  _c.set(color);
  const jAmt = o.jitter === false ? 0 : (o.jitter ?? 0.07);
  const nrm = g.attributes.normal;
  for (let i = 0; i < n; i += 3) {
    // facet shading: slight jitter + a touch of up-facing brightening (hand-painted look)
    const ny = nrm ? nrm.getY(i) : 0;
    const j = 1 - jAmt * 0.5 + (((i * 7919) % 13) / 13) * jAmt + (o.grad === false ? 0 : ny * 0.04);
    for (let k = 0; k < 3 && i + k < n; k++) { arr[(i + k) * 3] = _c.r * j; arr[(i + k) * 3 + 1] = _c.g * j; arr[(i + k) * 3 + 2] = _c.b * j; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  const glow = o.glow === true ? 1 : o.glow || 0;
  const mat = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { mat[i * 3] = glow; mat[i * 3 + 1] = o.metal ?? 0; mat[i * 3 + 2] = o.rough ?? (o.metal ? 0.35 : 0.78); }
  g.setAttribute('aMat', new THREE.BufferAttribute(mat, 3));
  // legacy attribute for the old toon material (map.js etc.)
  g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(glow ? 1 : 0), 1));
  return g;
}

export class Rig {
  constructor() { this.defs = { root: { parent: null, p: [0, 0, 0] } }; this.parts = {}; this.order = ['root']; }
  bone(name, parent = 'root', p = [0, 0, 0], r = null) { if (!this.defs[name]) this.order.push(name); this.defs[name] = { parent, p, r }; return this; }
  add(bone, geom, color, o = {}) {
    if (!this.defs[bone]) this.bone(bone);
    (this.parts[bone] ||= []).push(prep(geom, color, o));
    return this;
  }
  // mirrored add: parts authored for the LEFT (+x) side, mirrored onto bone pair
  addLR(boneL, boneR, geom, color, o = {}) {
    const p = o.p || [0, 0, 0], r = o.r || [0, 0, 0];
    this.add(boneL, geom.clone(), color, o);
    this.add(boneR, geom, color, { ...o, p: [-p[0], p[1], p[2]], r: [r[0], -r[1], -r[2]] });
    return this;
  }
  // symmetric add on one bone (x and -x)
  sym(bone, geom, color, o = {}) {
    const p = o.p || [0, 0, 0], r = o.r || [0, 0, 0];
    this.add(bone, geom.clone(), color, o);
    this.add(bone, geom, color, { ...o, p: [-p[0], p[1], p[2]], r: [r[0], -r[1], -r[2]] });
    return this;
  }
  build(opts = {}) {
    const mat = opts.mat || makeHeroMat({ rim: opts.rim ?? 0xffffff, rimStrength: opts.rimStrength ?? 0.5, glowBoost: opts.glowBoost });
    const bones = {}; const list = [];
    const root = new THREE.Group(); root.name = 'rigRoot';
    for (const name of this.order) {
      const d = this.defs[name]; const b = new THREE.Bone(); b.name = name; b.position.set(...d.p); if (d.r) b.rotation.set(...d.r);
      bones[name] = b; list.push(b);
    }
    for (const name of this.order) { const d = this.defs[name]; if (d.parent) (bones[d.parent] || bones.root).add(bones[name]); }
    root.add(bones.root);
    root.updateMatrixWorld(true);
    const geos = [];
    let tris = 0;
    list.forEach((b, bi) => {
      const parts = this.parts[b.name]; if (!parts) return;
      for (const g of parts) {
        g.applyMatrix4(b.matrixWorld);
        const n = g.attributes.position.count; tris += n / 3;
        const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
        g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
        if (g.attributes.aGlow) g.deleteAttribute('aGlow');
        geos.push(g);
      }
    });
    const geo = geos.length ? mergeGeometries(geos, false) : new THREE.BufferGeometry();
    geos.forEach((g) => g.dispose());
    geo.computeBoundingSphere(); if (geo.boundingSphere) geo.boundingSphere.radius *= 1.6;
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.castShadow = opts.shadow !== false; mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.name = 'rigMesh';
    root.add(mesh);
    const skel = new THREE.Skeleton(list);
    mesh.bind(skel);
    for (const name in bones) { const b = bones[name]; b.userData.rest = { p: b.position.clone(), r: b.rotation.clone(), s: b.scale.clone() }; }
    return { root, bones, mat, glowMat: mat, mesh, skeleton: skel, tris: Math.round(tris) };
  }
}

// Merge a list of prepared geometries into a single static geometry (for map/instancing)
export function mergeColored(list) {
  const g = mergeGeometries(list, false); list.forEach((x) => x.dispose()); g.computeBoundingSphere(); return g;
}
