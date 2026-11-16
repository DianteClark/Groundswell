// Procedural low-poly prefabs + chunked static batching + foliage material (wind sway, unit push, brush & occluder fade).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD, makeWorldMat, mkRand } from '../util.js';

const PI = Math.PI;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _n3 = new THREE.Matrix3();

// ───────────────────────── prefab building ─────────────────────────
/** transform + non-indexed + face normals + vertex colours with vertical gradient (fake AO / sky light) */
export function P(geom, color, o = {}) {
  let g = geom.index ? geom.toNonIndexed() : geom; if (g !== geom) geom.dispose();
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  if (o.jit) { const p = g.attributes.position; const R = o.R || Math.random; const map = new Map();
    for (let i = 0; i < p.count; i++) { const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`; let d = map.get(key); if (!d) { d = [(R() - 0.5) * o.jit, (R() - 0.5) * o.jit * (o.jitY ?? 1), (R() - 0.5) * o.jit]; map.set(key, d); } p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]); } }
  _e.set(...(o.r || [0, 0, 0])); _q.setFromEuler(_e);
  const s = o.s === undefined ? [1, 1, 1] : typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s;
  _m.compose(_v.set(...(o.p || [0, 0, 0])), _q, _s.set(...s)); g.applyMatrix4(_m);
  if (o.bend) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + o.bend[0] * y * y); p.setZ(i, p.getZ(i) + o.bend[1] * y * y); } }
  g.computeVertexNormals();
  const n = g.attributes.position.count; const col = new Float32Array(n * 3); const base = new THREE.Color(color);
  const pos = g.attributes.position; let y0 = Infinity, y1 = -Infinity; for (let i = 0; i < n; i++) { y0 = Math.min(y0, pos.getY(i)); y1 = Math.max(y1, pos.getY(i)); }
  const gr = o.grad || [1, 1]; const fj = o.fj ?? 0.08; const top = o.top ? new THREE.Color(o.top) : null;
  for (let i = 0; i < n; i += 3) {
    const jf = 1 - fj / 2 + ((i * 7919 + n) % 17) / 17 * fj;
    for (let k = 0; k < 3; k++) {
      const t = y1 > y0 ? (pos.getY(i + k) - y0) / (y1 - y0) : 1; const gm = (gr[0] + (gr[1] - gr[0]) * t) * jf;
      _c.copy(base); if (top) _c.lerp(top, t);
      col[(i + k) * 3] = _c.r * gm; col[(i + k) * 3 + 1] = _c.g * gm; col[(i + k) * 3 + 2] = _c.b * gm;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
export function merge(list) { const g = mergeGeometries(list, false); list.forEach((x) => x.dispose()); g.computeBoundingBox(); g.userData.h = g.boundingBox.max.y; return g; }

const cyl = (rt, rb, h, seg = 6, hs = 1) => new THREE.CylinderGeometry(rt, rb, h, seg, hs);
const cone = (r, h, seg = 7) => new THREE.ConeGeometry(r, h, seg, 1);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const dodec = (r) => new THREE.DodecahedronGeometry(r, 0);
const oct = (r) => new THREE.OctahedronGeometry(r, 0);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// gem: hexagonal bipyramid-ish crystal pointing +y
export function gemGeo(r, h, seg = 6) { const g = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(r, h * 0.12), new THREE.Vector2(r * 0.92, h * 0.72), new THREE.Vector2(0, h)], seg); return g; }

export const PREFAB = {
  broadTree(R, hue = 0, lo = false) {
    const l = [];
    const th = 1.8 + R() * 0.7; const lean = (R() - 0.5) * 0.15;
    l.push(P(cyl(0.2, 0.34, th, 6), '#7a5236', { p: [0, th / 2, 0], r: [lean, 0, lean], grad: [0.55, 1] }));
    l.push(P(cone(0.6, 0.6, 6), '#6a4630', { p: [0, 0.25, 0], grad: [0.5, 0.8] }));
    const leaf = new THREE.Color().setHSL(0.28 + hue + (R() - 0.5) * 0.03, 0.6 + R() * 0.12, 0.3 + R() * 0.05);
    const top = leaf.clone().offsetHSL(-0.045, 0.06, 0.1);
    const blobs = lo ? [[0, th + 0.9, 0, 1.8], [0.6, th + 1.8, 0.2, 1.2], [-0.5, th + 1.7, -0.3, 1.1]] : [[0, th + 0.9, 0, 1.75], [0.8, th + 1.7, 0.3, 1.15], [-0.7, th + 1.6, -0.4, 1.1], [0.1, th + 2.4, -0.1, 0.9]];
    for (const [x, y, z, r] of blobs) { const rr = r * (0.9 + R() * 0.25); l.push(P(ico(rr, lo ? 0 : 1), leaf, { p: [x, y, z], s: [1, 0.78, 1], jit: rr * (lo ? 0.2 : 0.28), R, grad: [0.5, 1.0], top, fj: 0.14 })); }
    return merge(l);
  },
  pineTree(R) {
    const l = []; const th = 1.0 + R() * 0.5;
    l.push(P(cyl(0.16, 0.26, th + 0.6, 5), '#6a4a30', { p: [0, (th + 0.6) / 2, 0], grad: [0.55, 1] }));
    const leaf = new THREE.Color().setHSL(0.38 + (R() - 0.5) * 0.03, 0.45, 0.24 + R() * 0.04); const top = leaf.clone().offsetHSL(-0.05, 0.05, 0.1);
    const tiers = 4; let y = th, r = 1.7 + R() * 0.3;
    for (let i = 0; i < tiers; i++) { const h = 1.7 - i * 0.18; l.push(P(cone(r, h, 8), leaf, { p: [0, y + h / 2, 0], r: [0, R() * 3, 0], jit: 0.22, R, grad: [0.45, 1.05], top, fj: 0.12 })); y += h * 0.55; r *= 0.74; }
    return merge(l);
  },
  blossomTree(R) {
    const l = []; const th = 1.6 + R() * 0.6;
    l.push(P(cyl(0.16, 0.3, th, 6), '#6b4a3a', { p: [0, th / 2, 0], grad: [0.55, 1] }));
    l.push(P(cyl(0.08, 0.12, 1.2, 4), '#6b4a3a', { p: [0.4, th + 0.2, 0], r: [0, 0, -0.8] }));
    const leaf = new THREE.Color().setHSL(0.93 + (R() - 0.5) * 0.04, 0.62, 0.62); const top = new THREE.Color('#ffd0e6');
    for (const [x, y, z, r] of [[0, th + 0.9, 0, 1.45], [0.9, th + 1.3, 0.2, 1.0], [-0.6, th + 1.5, -0.3, 0.95]]) l.push(P(ico(r, 1), leaf, { p: [x, y, z], s: [1, 0.75, 1], jit: r * 0.3, R, grad: [0.6, 1.08], top, fj: 0.12 }));
    return merge(l);
  },
  autumnTree(R, lo = false) {
    const l = []; const th = 1.8 + R() * 0.5;
    l.push(P(cyl(0.2, 0.32, th, 6), '#6e4a32', { p: [0, th / 2, 0], grad: [0.55, 1] }));
    const leaf = new THREE.Color().setHSL(0.08 + R() * 0.04, 0.78, 0.42); const top = new THREE.Color('#ffc060');
    for (const [x, y, z, r] of [[0, th + 0.9, 0, 1.6], [0.7, th + 1.7, 0.2, 1.05], [-0.6, th + 1.6, -0.3, 1.0]]) l.push(P(ico(r, lo ? 0 : 1), leaf, { p: [x, y, z], s: [1, 0.8, 1], jit: r * 0.28, R, grad: [0.5, 1.08], top, fj: 0.12 }));
    return merge(l);
  },
  bush(R, hue = 0) {
    const l = []; const leaf = new THREE.Color().setHSL(0.28 + hue + (R() - 0.5) * 0.04, 0.5, 0.33 + R() * 0.06); const top = leaf.clone().offsetHSL(-0.03, 0.04, 0.15);
    const n = 2 + Math.floor(R() * 2);
    for (let i = 0; i < n; i++) { const a = i * 2.3 + R(), r = 0.55 + R() * 0.35; l.push(P(ico(r, 0), leaf, { p: [Math.cos(a) * 0.45 * (i ? 1 : 0), r * 0.7, Math.sin(a) * 0.45 * (i ? 1 : 0)], s: [1, 0.85, 1], jit: 0.18, R, grad: [0.45, 1.1], top })); }
    if (R() < 0.4) { const bc = R() < 0.5 ? '#ff5a6a' : '#ffd23a'; for (let i = 0; i < 4; i++) { const a = R() * PI * 2; l.push(P(oct(0.09), bc, { p: [Math.cos(a) * 0.6, 0.6 + R() * 0.5, Math.sin(a) * 0.6], fj: 0 })); } }
    return merge(l);
  },
  fern(R) {
    const l = []; const c = new THREE.Color().setHSL(0.3 + (R() - 0.5) * 0.04, 0.55, 0.32); const top = c.clone().offsetHSL(-0.04, 0.05, 0.2);
    const n = 6 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) { const a = i / n * PI * 2 + R() * 0.4; const len = 0.9 + R() * 0.5;
      const g = new THREE.PlaneGeometry(0.34, len, 1, 3); g.translate(0, len / 2, 0);
      const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k) / len; p.setX(k, p.getX(k) * (1 - y * 0.85)); p.setZ(k, y * y * len * 0.75); }
      l.push(P(g, c, { r: [0.5, a, 0], grad: [0.5, 1.15], top })); }
    return merge(l);
  },
  tuft(R, dry = 0) {
    const l = []; const c = new THREE.Color().setHSL(0.27 - dry * 0.04 + (R() - 0.5) * 0.04, 0.5, 0.27 + dry * 0.05); const top = new THREE.Color().setHSL(0.24 - dry * 0.04, 0.55, 0.42);
    const n = 7 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) { const a = i / n * PI * 2 + R(); const h = 0.28 + R() * 0.32; const g = new THREE.BufferGeometry(); const w = 0.08 + R() * 0.05;
      g.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, 0, h, 0], 3));
      l.push(P(g, c, { p: [Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18], r: [Math.sin(a) * 0.5, a + PI / 2, Math.cos(a) * 0.5], grad: [0.6, 1.05], top, fj: 0.05 })); }
    return merge(l);
  },
  flowers(R) {
    const l = []; const pal = ['#ffe066', '#ff8ac8', '#ffffff', '#9fd0ff', '#ff9a5a', '#c99aff'];
    const pc = pal[Math.floor(R() * pal.length)];
    const n = 3 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) { const a = R() * PI * 2, r = R() * 0.5, h = 0.3 + R() * 0.3; const x = Math.cos(a) * r, z = Math.sin(a) * r;
      l.push(P(cyl(0.02, 0.025, h, 3), '#4a8a3a', { p: [x, h / 2, z], fj: 0 }));
      l.push(P(oct(0.11 + R() * 0.05), pc, { p: [x, h + 0.04, z], s: [1, 0.55, 1], fj: 0.1 }));
      l.push(P(oct(0.04), '#ffd84a', { p: [x, h + 0.09, z], fj: 0 })); }
    return merge(l);
  },
  mushroom(R, glow = false) {
    const l = []; const n = 1 + Math.floor(R() * 3);
    const cap = glow ? (R() < 0.5 ? '#7af0ff' : '#d08aff') : (R() < 0.6 ? '#e0503a' : '#f0b050');
    for (let i = 0; i < n; i++) { const a = R() * PI * 2, r = i ? 0.25 + R() * 0.2 : 0, s = (i ? 0.6 : 1) * (0.8 + R() * 0.5); const x = Math.cos(a) * r, z = Math.sin(a) * r;
      l.push(P(cyl(0.07 * s, 0.1 * s, 0.4 * s, 5), '#efe6d2', { p: [x, 0.2 * s, z], fj: 0.05 }));
      l.push(P(new THREE.SphereGeometry(0.28 * s, 7, 3, 0, PI * 2, 0, PI / 2), cap, { p: [x, 0.36 * s, z], s: [1, 0.75, 1], fj: 0.1 })); }
    return merge(l);
  },
  rock(R, size = 1, tint = '#9a9184') {
    const c = new THREE.Color(tint).offsetHSL((R() - 0.5) * 0.02, 0, (R() - 0.5) * 0.08);
    return merge([P(dodec(size), c, { jit: size * 0.35, R, s: [1, 0.6 + R() * 0.4, 1], grad: [0.55, 1.12], fj: 0.16 })]);
  },
  crystal(R, color = '#9a6aff') {
    const l = []; const n = 3 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) { const a = R() * PI * 2, r = i ? 0.3 + R() * 0.3 : 0, h = (i ? 0.7 : 1.4) * (0.7 + R() * 0.6);
      l.push(P(gemGeo(0.18 + h * 0.1, h, 6), color, { p: [Math.cos(a) * r, -0.05, Math.sin(a) * r], r: [Math.sin(a) * 0.4 * (i ? 1 : 0.2), R() * 3, -Math.cos(a) * 0.4 * (i ? 1 : 0.2)], grad: [0.7, 1.3], top: '#ffffff', fj: 0.15 })); }
    return merge(l);
  },
  edgeStone(R) { return merge([P(dodec(0.32 + R() * 0.2), new THREE.Color('#b3a997').offsetHSL(0, 0, (R() - 0.5) * 0.1), { s: [1.3, 0.45, 1], jit: 0.12, R, grad: [0.6, 1.1], fj: 0.15 })]); },
  column(R, h = 3, broken = true) {
    const l = []; const st = '#c9bfae';
    l.push(P(box(1.3, 0.35, 1.3), '#a99f8e', { p: [0, 0.17, 0], fj: 0.1 }));
    const segs = Math.max(1, Math.round(h / 0.9));
    for (let i = 0; i < segs; i++) { const hh = h / segs; l.push(P(cyl(0.45, 0.48, hh * 0.96, 8), st, { p: [(R() - 0.5) * 0.06, 0.35 + hh * (i + 0.5), (R() - 0.5) * 0.06], r: [0, R(), 0], grad: [0.8, 1.05], fj: 0.1 })); }
    if (broken) l.push(P(cone(0.48, 0.5, 8), st, { p: [0, 0.35 + h + 0.15, 0], r: [0.3, 0, 0.2], jit: 0.2, R }));
    else l.push(P(box(1.2, 0.3, 1.2), '#a99f8e', { p: [0, 0.35 + h + 0.15, 0] }));
    return merge(l);
  },
  arch(R) {
    const l = []; const st = '#c4baa8';
    for (const x of [-1.6, 1.6]) { l.push(P(box(0.8, 3.4, 0.8), st, { p: [x, 1.7, 0], grad: [0.75, 1.05], jit: 0.08, R })); }
    l.push(P(box(4.2, 0.6, 0.9), '#b0a693', { p: [0.2, 3.65, 0], r: [0, 0, 0.06], jit: 0.1, R }));
    l.push(P(box(0.7, 0.5, 0.7), st, { p: [2.2, 0.25, 1.2], r: [0.3, 0.6, 0.2] }));
    return merge(l);
  },
  slab(R) { return merge([P(box(1.6 + R(), 0.3, 1.0 + R() * 0.6), '#b8ae9c', { r: [0, R() * 3, (R() - 0.5) * 0.2], jit: 0.1, R, fj: 0.12 })]); },
  lanternPost() {
    const l = []; const wood = '#5e4430';
    l.push(P(cyl(0.09, 0.12, 2.6, 5), wood, { p: [0, 1.3, 0], grad: [0.6, 1] }));
    l.push(P(box(0.9, 0.1, 0.1), wood, { p: [0.35, 2.5, 0] }));
    l.push(P(box(0.32, 0.06, 0.32), '#3a2c22', { p: [0.7, 2.18, 0] }));
    l.push(P(box(0.32, 0.06, 0.32), '#3a2c22', { p: [0.7, 1.8, 0] }));
    l.push(P(cone(0.24, 0.2, 4), '#3a2c22', { p: [0.7, 2.3, 0], r: [0, PI / 4, 0] }));
    l.push(P(cyl(0.12, 0.25, 0.3, 6), '#7a6a58', { p: [0, 0.15, 0] }));
    return merge(l);
  },
  lanternGlow() { return merge([P(box(0.22, 0.32, 0.22), '#ffc870', { p: [0.7, 1.99, 0], fj: 0 })]); },
  bannerPole() { const l = []; l.push(P(cyl(0.08, 0.1, 4.4, 5), '#5a4636', { p: [0, 2.2, 0] })); l.push(P(cone(0.16, 0.4, 4), '#e8c870', { p: [0, 4.6, 0] })); l.push(P(box(1.4, 0.08, 0.08), '#5a4636', { p: [0.65, 4.1, 0] })); l.push(P(cyl(0.3, 0.4, 0.3, 6), '#8e877c', { p: [0, 0.15, 0] })); return merge(l); },
  bannerCloth(color) {
    const g = new THREE.PlaneGeometry(1.2, 2.4, 2, 6); g.translate(0.65, 4.05 - 1.2, 0.0);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 1.8) { const x = p.getX(i); p.setY(i, y + Math.abs(x - 0.65) * 0.5 * (y < 1.7 ? 1 : 0)); } }
    const c = P(g, color, { grad: [0.65, 1.05], fj: 0.06 });
    // trim
    const t = P(box(1.24, 0.12, 0.04), '#ffe08a', { p: [0.65, 3.95, 0.01] });
    return merge([c, t]);
  },
};

// ───────────────────────── foliage material ─────────────────────────
export const FOLIAGE_U = {
  uPush: { value: Array.from({ length: 8 }, () => new THREE.Vector4(-999, -999, 1, 0)) },
  uWindDir: { value: new THREE.Vector2(0.8, 0.5) }, uWindAmp: { value: 0.11 },
  uFocus: { value: Array.from({ length: 4 }, () => new THREE.Vector4(-9999, -9999, 0, 0)) },
  uBrushA: { value: new Array(16).fill(0) },
};
/** opts: { fade: occluder fade near focus points, brush: per-brush fade, translucency } */
export function makeFoliageMat(opts = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: opts.double ? THREE.DoubleSide : THREE.FrontSide });
  m.defaultAttributeValues = { color: [1, 1, 1], aWind: [0, 0], aBrush: -1 };
  const key = 'fol' + (opts.fade ? 'F' : '') + (opts.brush ? 'B' : '');
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, FOLIAGE_U); sh.uniforms.uTime = WORLD.uTime; sh.uniforms.uGlowBoost = WORLD.uGlowBoost; sh.uniforms.uSunDirV = WORLD.uSunDirV;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute vec2 aWind; attribute float aBrush; uniform float uTime; uniform vec4 uPush[8]; uniform vec2 uWindDir; uniform float uWindAmp;
      varying float vDepth; varying float vBrush; varying float vWindW;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz; float ph = aWind.y + uTime;
        float gust = 0.55 + 0.45 * sin(uTime * 0.63 + wp.x * 0.045 + wp.z * 0.03);
        vec2 sway = uWindDir * (sin(ph * 1.7) * 0.65 + sin(ph * 2.9 + 1.3) * 0.25) * gust * uWindAmp * 10.0;
        vec2 push = vec2(0.0);
        for (int i = 0; i < 8; i++) { vec2 d = wp.xz - uPush[i].xy; float l = length(d); float k = clamp(1.0 - l / uPush[i].z, 0.0, 1.0); push += (d / (l + 1e-3)) * k * k * uPush[i].w; }
        transformed.xz += (sway + push * 1.3) * aWind.x;
        transformed.y -= length(push) * aWind.x * 0.55; vBrush = aBrush; vWindW = aWind.x; }`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvDepth = -mvPosition.z;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec4 uFocus[4]; uniform float uBrushA[16]; uniform vec3 uSunDirV; varying float vDepth; varying float vBrush; varying float vWindW;
      float bayer4(vec2 p){ vec2 q = mod(floor(p), 4.0); float a = mod(q.x + q.y * 2.0, 4.0); float b = mod(q.x, 2.0) * 2.0 + mod(q.y, 2.0); return (a * 4.0 + b + 0.5) / 16.0; }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      { float fade = 0.0;
        ${opts.fade ? `for (int i = 0; i < 4; i++) { if (uFocus[i].w <= 0.0) continue; float d = length(gl_FragCoord.xy - uFocus[i].xy) / uFocus[i].w; if (vDepth < uFocus[i].z) fade = max(fade, (1.0 - smoothstep(0.5, 1.0, d)) * 0.62); }` : ''}
        ${opts.brush ? `if (vBrush >= 0.0) { int bi = int(vBrush + 0.5); for (int i = 0; i < 16; i++) { if (i == bi) fade = max(fade, uBrushA[i]); } }` : ''}
        if (fade > 0.0 && bayer4(gl_FragCoord.xy) < fade) discard; }`)
      .replace('#include <opaque_fragment>', `{ vec3 vv = normalize(vViewPosition); vec3 nn = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
        float back = clamp(dot(-vv, uSunDirV), 0.0, 1.0); float fr = 1.0 - clamp(abs(dot(nn, vv)), 0.0, 1.0);
        outgoingLight += diffuseColor.rgb * (fr * fr * 0.12 + back * 0.1) * vec3(1.0, 0.95, 0.7) * min(vWindW * 4.0 + 0.3, 1.0); }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => key;
  return m;
}

// ───────────────────────── chunked batches ─────────────────────────
class Batch {
  constructor(layer) { this.layer = layer; this.pos = []; this.nor = []; this.col = []; this.wind = []; this.brush = []; this.glow = []; }
  add(geo, mtx, o) {
    const p = geo.attributes.position, n = geo.attributes.normal, c = geo.attributes.color; const N = p.count;
    _n3.getNormalMatrix(mtx); const tint = o.tint; const h = geo.userData.h || 1;
    for (let i = 0; i < N; i++) {
      _v.set(p.getX(i), p.getY(i), p.getZ(i)); const ly = _v.y; _v.applyMatrix4(mtx); this.pos.push(_v.x, _v.y, _v.z);
      _v.set(n.getX(i), n.getY(i), n.getZ(i)).applyMatrix3(_n3).normalize(); this.nor.push(_v.x, _v.y, _v.z);
      let r = c.getX(i), g = c.getY(i), b = c.getZ(i); if (tint) { r *= tint.r; g *= tint.g; b *= tint.b; } this.col.push(r, g, b);
      if (this.layer.wind) { const t = Math.max(0, ly / h); this.wind.push((o.wind ?? 0) * Math.pow(t, o.windPow ?? 1.6), o.phase ?? 0); this.brush.push(o.brush ?? -1); }
      if (this.layer.glowAttr) this.glow.push(o.glow ?? 0);
    }
  }
  build() {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.layer.wind) { g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.wind, 2)); g.setAttribute('aBrush', new THREE.Float32BufferAttribute(this.brush, 1)); }
    if (this.layer.glowAttr) g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 1));
    g.computeBoundingSphere(); g.computeBoundingBox(); this.pos = this.nor = this.col = this.wind = this.brush = this.glow = null; return g;
  }
}

export class StaticWorld {
  /** layers: name → { mat, shadow, receive, wind, glowAttr } */
  constructor(chunk = 48) { this.chunk = chunk; this.layers = {}; this.batches = new Map(); this.group = new THREE.Group(); this.group.name = 'static'; this.tris = 0; }
  layer(name, def) { this.layers[name] = def; return this; }
  add(layer, geo, x, y, z, o = {}) {
    const L = this.layers[layer]; const key = layer + ':' + Math.floor(x / this.chunk) + ',' + Math.floor(z / this.chunk);
    let b = this.batches.get(key); if (!b) { b = new Batch(L); b.name = layer; this.batches.set(key, b); }
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0); _q.setFromEuler(_e);
    const s = o.s ?? 1; _m.compose(_v.set(x, y, z), _q, _s.set(o.sx ?? s, o.sy ?? s, o.sz ?? s));
    b.add(geo, _m, o);
  }
  build() {
    for (const [key, b] of this.batches) {
      const g = b.build(); if (!g) continue; const L = this.layers[b.name];
      const m = new THREE.Mesh(g, L.mat); m.castShadow = !!L.shadow; m.receiveShadow = L.receive !== false; m.name = key; m.renderOrder = L.order ?? 0;
      this.group.add(m); this.tris += g.attributes.position.count / 3;
    }
    this.batches.clear();
    return this.group;
  }
}

export { makeWorldMat, mkRand };
