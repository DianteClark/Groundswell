// Terrain: faceted heightfield (flat walkable floor, carved river bed, rising forested border),
// procedural ground shader (grass tones, worn dirt lanes w/ cobbles, plazas, sand banks, rock slopes,
// wet river bed with caustics, final-swell glowing cracks) and shared analytic helpers (riverSdf, heightAt).
import * as THREE from 'three';
import { mkRand, WORLD } from '../util.js';

const PI = Math.PI;
export const PAD = 46;
export const CELL = 2;

// ───────────────────────── noise helpers ─────────────────────────
export function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (hash2(xi, yi) * (1 - u) + hash2(xi + 1, yi) * u) * (1 - v) + (hash2(xi, yi + 1) * (1 - u) + hash2(xi + 1, yi + 1) * u) * v;
}
export function fbm(x, y) { return vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 5.2, y * 2.1 + 1.3) * 0.3 + vnoise(x * 4.3 + 9.1, y * 4.3 + 7.7) * 0.15; }
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ───────────────────────── river ─────────────────────────
export function riverParams(map) {
  const river = map.river; if (!river) return null;
  let x0 = river.x0, x1 = river.x1, y0 = river.y0, y1 = river.y1;
  const pts = river.polygon || river.points;
  if (pts && pts.length) { x0 = Math.min(...pts.map((p) => p.x)); x1 = Math.max(...pts.map((p) => p.x)); y0 = Math.min(...pts.map((p) => p.y)); y1 = Math.max(...pts.map((p) => p.y)); }
  if (x0 == null) return null;
  const cx = (x0 + x1) / 2, w = (x1 - x0) / 2;
  const pl = []; for (const k in map.pits || {}) { const p = map.pits[k]; if (p && Math.abs(p.x - cx) < w + p.r + 3) pl.push({ x: p.x, y: p.y, r: p.r + 2.8 }); }
  const islands = (map.obstacles || []).filter((o) => o.type !== 'rect' && Math.abs(o.x - cx) < w && o.y > y0 && o.y < y1);
  return { cx, w, y0, y1, pits: pl, islands, H: map.height || 160, sw: 3.3 };
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
/** signed distance to the water (negative = in water). Main river + narrow stream running off-map both ways. */
export function riverSdf(rp, x, y) {
  const w = rp.w + Math.sin(y * 0.35) * 0.7 + Math.sin(y * 0.11 + 2) * 0.9;
  const yy = Math.min(Math.max(y, rp.y0 + rp.w), rp.y1 - rp.w);
  let d = Math.hypot(x - rp.cx, y - yy) - w;
  const sx = rp.cx + Math.sin(y * 0.09) * 1.3; const sd = Math.abs(x - sx) - (rp.sw + Math.sin(y * 0.27) * 0.4);
  d = smin(d, sd, 4);
  for (const p of rp.pits) { const pd = Math.hypot(x - p.x, y - p.y); d = Math.min(d, pd - (p.r + 3.2 + 0.5 * Math.sin(Math.atan2(y - p.y, x - p.x) * 5))); d = Math.max(d, p.r - pd); }
  return d;
}
export const RIVER_GLSL = `
float smin1(float a, float b, float k){ float h = max(k - abs(a-b), 0.0)/k; return min(a,b) - h*h*k*0.25; }
float riverSdf(vec2 p){
  float w = uRiv.w + sin(p.y*0.35)*0.7 + sin(p.y*0.11+2.0)*0.9;
  float yy = clamp(p.y, uRiv.y + uRiv.w, uRiv.z - uRiv.w);
  float d = length(vec2(p.x - uRiv.x, p.y - yy)) - w;
  float sx = uRiv.x + sin(p.y*0.09)*1.3; float sd = abs(p.x - sx) - (uRivSW + sin(p.y*0.27)*0.4);
  d = smin1(d, sd, 4.0);
  for (int i = 0; i < 2; i++) { if (uPits[i].z <= 0.0) continue; float pd = length(p - uPits[i].xy);
    d = min(d, pd - (uPits[i].z + 3.2 + 0.5*sin(atan(p.y-uPits[i].y, p.x-uPits[i].x)*5.0))); d = max(d, uPits[i].z - pd); }
  return d;
}`;
export function riverUniforms(rp) {
  const pits = rp.pits.concat([{ x: -999, y: -999, r: 0 }, { x: -999, y: -999, r: 0 }]).slice(0, 2);
  return { uRiv: { value: new THREE.Vector4(rp.cx, rp.y0, rp.y1, rp.w) }, uRivSW: { value: rp.sw }, uPits: { value: pits.map((q) => new THREE.Vector3(q.x, q.y, q.r)) } };
}

// ───────────────────────── detail texture ─────────────────────────
// R: tileable fbm   G: voronoi stones (1 inside, 0 on mortar)   B: per-cell random   A: fine grain
let _detail = null;
export function detailTexture() {
  if (_detail) return _detail;
  const N = 256, R = mkRand(77);
  const L = 8; const lat = new Float32Array(L * L); for (let i = 0; i < lat.length; i++) lat[i] = R();
  const vn = (x, y, per) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const h = (a, b) => lat[(((a % per) + per) % per) + (((b % per) + per) % per) * L];
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v; };
  const G = 8; const pts = []; for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) pts.push([0.12 + R() * 0.76, 0.12 + R() * 0.76, R()]);
  const fine = new Float32Array(64 * 64); for (let i = 0; i < fine.length; i++) fine[i] = R();
  const fn = (x, y) => { const X = x * 64, Y = y * 64; const xi = Math.floor(X), yi = Math.floor(Y), xf = X - xi, yf = Y - yi; const h = (a, b) => fine[((a & 63) + (b & 63) * 64)];
    return (h(xi, yi) * (1 - xf) + h(xi + 1, yi) * xf) * (1 - yf) + (h(xi, yi + 1) * (1 - xf) + h(xi + 1, yi + 1) * xf) * yf; };
  const d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    let a = 0, amp = 0.5, per = 2, s = 0; for (let o = 0; o < 3; o++) { a += vn(u * per, v * per, per) * amp; s += amp; amp *= 0.5; per *= 2; }
    a /= s;
    let f1 = 9, f2 = 9, id = 0; const ci = Math.floor(u * G), cj = Math.floor(v * G);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ((ci + di) % G + G) % G, jj = ((cj + dj) % G + G) % G; const p = pts[jj * G + ii];
      const dd = Math.hypot(u * G - (ci + di + p[0]), v * G - (cj + dj + p[1]));
      if (dd < f1) { f2 = f1; f1 = dd; id = p[2]; } else if (dd < f2) f2 = dd;
    }
    const edge = f2 - f1; const i4 = (y * N + x) * 4;
    d[i4] = a * 255; d[i4 + 1] = smooth(0.04, 0.22, edge) * 255; d[i4 + 2] = id * 255; d[i4 + 3] = (fn(u, v) * 0.6 + fn(u * 2, v * 2) * 0.4) * 255;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  _detail = t; return t;
}

function distSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; const l = dx * dx + dy * dy || 1; let t = ((px - ax) * dx + (py - ay) * dy) / l; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - dx * t, py - ay - dy * t); }
export function smoothPts(pts, k = 12) {
  if (pts.length < 3) return pts;
  const curve = new THREE.SplineCurve(pts.map((p) => new THREE.Vector2(p.x, p.y))); return curve.getPoints(pts.length * k).map((p) => ({ x: p.x, y: p.y }));
}

// ───────────────────────── Terrain ─────────────────────────
export class Terrain {
  constructor(map, opts = {}) {
    this.map = map; this.W = map.width || 240; this.H = map.height || 160;
    this.x0 = -PAD; this.z0 = -PAD; this.x1 = this.W + PAD; this.z1 = this.H + PAD;
    this.rp = riverParams(map);
    this.lanes = (map.lanes || []).filter((l) => l.points && l.points.length > 1).map((l) => ({ name: l.name, pts: smoothPts(l.points, 8) }));
    this.trails = opts.trails || [];
    this.aoSources = opts.aoSources || [];
    this.group = new THREE.Group(); this.group.name = 'terrain';
    this.uniforms = {
      uMask: { value: null }, uDetail: { value: detailTexture() }, uDom: { value: new THREE.Vector4(this.x0, this.z0, 1 / (this.x1 - this.x0), 1 / (this.z1 - this.z0)) },
      uTime: WORLD.uTime, uSwell: { value: 0 },
      uGrassLight: { value: new THREE.Color('#b6cc72') }, uGrassDeep: { value: new THREE.Color('#5f8f4c') }, uJungleDeep: { value: new THREE.Color('#3d6a4c') }, uJungleLight: { value: new THREE.Color('#62935a') },
      uDirtLight: { value: new THREE.Color('#e2bd84') }, uDirtMid: { value: new THREE.Color('#bf9259') }, uCobA: { value: new THREE.Color('#c9bba0') }, uCobB: { value: new THREE.Color('#9c8f7c') },
      uSand: { value: new THREE.Color('#ead7a0') }, uBed: { value: new THREE.Color('#5d8a7a') }, uPlazaA: { value: new THREE.Color('#cfc3aa') }, uPlazaB: { value: new THREE.Color('#ab9d86') },
      uRock: { value: new THREE.Color('#a39280') }, uRockDark: { value: new THREE.Color('#6d6157') }, uCrack: { value: new THREE.Color('#ff5a1a') },
    };
    this._buildMask();
    this._buildMesh(opts.quality || 'med');
  }
  laneDist(x, y) { let d = 1e9; for (const l of this.lanes) { const p = l.pts; for (let i = 0; i < p.length - 1; i++) d = Math.min(d, distSeg(x, y, p[i].x, p[i].y, p[i + 1].x, p[i + 1].y)); } return d; }
  /** distance outside the walkable rectangle (0 inside) */
  outside(x, z) { const ox = Math.max(3 - x, x - (this.W - 3), 0), oz = Math.max(4 - z, z - (this.H - 4), 0); return Math.hypot(ox, oz); }
  /** base terrain height, no river carve */
  _land(x, z) {
    const out = this.outside(x, z); if (out <= 0) return 0;
    const n = fbm(x * 0.06, z * 0.06);
    return 4.4 * smooth(0.4, 3.6, out) + (n - 0.4) * 2.6 * smooth(2, 8, out) + Math.max(0, out - 9) * 0.12 + fbm(x * 0.21 + 3, z * 0.21) * 0.6 * smooth(1, 4, out);
  }
  waterLevel(x, z) { // the stream sits up on the northern plateau before tumbling down the waterfall
    if (!this.rp) return -0.25; if (z < -1.2 && Math.abs(x - this.rp.cx) < 9) return 3.95; return -0.25;
  }
  heightAt(x, z) {
    let h = this._land(x, z);
    if (this.rp) {
      const d = riverSdf(this.rp, x, z);
      if (d < 1.2) {
        const wl = this.waterLevel(x, z); const bed = wl - 0.2 - 0.75 * smooth(0.0, -2.6, d);
        const k = smooth(1.2, -0.2, d); h = Math.min(h, h * (1 - k) + bed * k);
        if (z < -1.2 && z > -4 && Math.abs(x - this.rp.cx) < 6) h = Math.max(h, wl - 0.6); // lip of the waterfall
      }
    }
    return h;
  }
  /** height used to place units (feet) — clamped so they wade instead of sinking */
  unitHeight(x, z) { if (!this.rp) return 0; const d = riverSdf(this.rp, x, z); if (d > 1.2) return 0; return Math.max(-0.5, Math.min(0, this.heightAt(x, z))); }

  _buildMask() {
    const x0 = this.x0, z0 = this.z0, Wd = this.x1 - x0, Hd = this.z1 - z0;
    const cw = 1024, ch = Math.round(cw * Hd / Wd); const S = cw / Wd;
    this.maskSize = [cw, ch];
    const X = (x) => (x - x0) * S, Y = (z) => (z - z0) * S;
    const mk = (fill = '#000') => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d'); g.fillStyle = fill; g.fillRect(0, 0, cw, ch); g.lineCap = 'round'; g.lineJoin = 'round'; return g; };
    const stroke = (g, pts, w, style, alpha) => { g.globalAlpha = alpha; g.strokeStyle = style; g.lineWidth = w * S; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y)))); g.stroke(); g.globalAlpha = 1; };
    const disc = (g, x, z, r0, r1, style = '255,255,255', a = 1) => { const gr = g.createRadialGradient(X(x), Y(z), r0 * S, X(x), Y(z), r1 * S); gr.addColorStop(0, `rgba(${style},${a})`); gr.addColorStop(1, `rgba(${style},0)`); g.fillStyle = gr; g.beginPath(); g.arc(X(x), Y(z), r1 * S, 0, PI * 2); g.fill(); };
    const map = this.map;
    // R: dirt (lanes, trails, camps)
    const gR = mk();
    for (const l of this.lanes) { stroke(gR, l.pts, 12.5, '#fff', 0.22); stroke(gR, l.pts, 10.5, '#fff', 0.45); stroke(gR, l.pts, 9.0, '#fff', 1); }
    for (const t of this.trails) { const p = smoothPts(t, 10); stroke(gR, p, 3.0, '#fff', 0.3); stroke(gR, p, 1.8, '#fff', 0.62); }
    for (const c of map.camps || []) disc(gR, c.x, c.y, 2.5, 6.5, '255,255,255', 0.75);
    // G: plaza
    const gG = mk();
    for (const b of map.bases || []) disc(gG, b.x, b.y, (b.r ?? 24) * 0.8, (b.r ?? 24) * 0.92);
    for (const k in map.pits || {}) { const p = map.pits[k]; disc(gG, p.x, p.y, p.r + 0.6, p.r + 1.8); }
    for (const t of map.towers || []) disc(gG, t.x, t.y, 3.0, 4.4);
    // B: jungle lushness (far from lanes & bases)
    const gB = mk('#fff');
    for (const l of this.lanes) for (const [w, a] of [[46, 0.12], [38, 0.14], [30, 0.16], [22, 0.2], [14, 0.3]]) stroke(gB, l.pts, w, '#000', a);
    for (const b of map.bases || []) disc(gB, b.x, b.y, 10, (b.r ?? 24) + 8, '0,0,0', 1);
    // compose + per-pixel sand (river SDF) + noise into one RGBA
    const iR = gR.getImageData(0, 0, cw, ch).data, iG = gG.getImageData(0, 0, cw, ch).data, iB = gB.getImageData(0, 0, cw, ch).data;
    const out = new Uint8Array(cw * ch * 4); const rp = this.rp;
    // canopy mask (for dappled light) → stored on the fog texture by the caller; here we keep sand in A
    for (let j = 0; j < ch; j++) {
      const wz = z0 + (j + 0.5) / S;
      for (let i = 0; i < cw; i++) {
        const k = (j * cw + i) * 4; const wx = x0 + (i + 0.5) / S;
        out[k] = iR[k]; out[k + 1] = iG[k]; out[k + 2] = iB[k];
        let a = 0;
        if (rp && Math.abs(wx - rp.cx) < rp.w + 20) { const d = riverSdf(rp, wx, wz); a = d < 0.6 ? 1 : 1 - smooth(0.6, 2.4 + vnoise(wx * 0.4, wz * 0.4) * 1.2, d); }
        out[k + 3] = a * 255;
      }
    }
    const tex = new THREE.DataTexture(out, cw, ch, THREE.RGBAFormat); tex.flipY = false; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
    this.uniforms.uMask.value = tex; this.maskTex = tex;
  }

  _aoAt(x, z) {
    let ao = 1;
    for (const o of this.map.obstacles || []) { if (o.type === 'rect') continue; const dd = Math.hypot(x - o.x, z - o.y) - o.r; if (dd < 4) ao *= 1 - 0.5 * Math.exp(-Math.max(dd, 0) / 1.5); }
    for (const s of this.aoSources) { const dd = Math.hypot(x - s.x, z - s.z) - s.r; if (dd < 3) ao *= 1 - (s.k ?? 0.35) * Math.exp(-Math.max(dd, 0) / 1.2); }
    const out = this.outside(x, z); if (out > 0 && out < 3) ao *= 0.78 + 0.22 * smooth(0, 3, out); else if (out <= 0) { const inn = Math.min(x - 3, this.W - 3 - x, z - 4, this.H - 4 - z); if (inn < 3) ao *= 0.72 + 0.28 * smooth(0, 3, inn); }
    return Math.max(0.35, ao);
  }

  _buildMesh(quality) {
    const x0 = this.x0, z0 = this.z0; const nx = Math.ceil((this.x1 - x0) / CELL), nz = Math.ceil((this.z1 - z0) / CELL);
    const R = mkRand(911);
    // jittered vertex lattice
    const vx = new Float32Array((nx + 1) * (nz + 1)), vz = new Float32Array((nx + 1) * (nz + 1)), vy = new Float32Array((nx + 1) * (nz + 1)), vao = new Float32Array((nx + 1) * (nz + 1));
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const id = j * (nx + 1) + i; const edge = i === 0 || j === 0 || i === nx || j === nz;
      const x = x0 + i * CELL + (edge ? 0 : (R() - 0.5) * CELL * 0.55), z = z0 + j * CELL + (edge ? 0 : (R() - 0.5) * CELL * 0.55);
      vx[id] = x; vz[id] = z; vy[id] = this.heightAt(x, z); vao[id] = this._aoAt(x, z);
    }
    const CH = 24; // cells per chunk
    const mat = this.material = this._makeMaterial();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    for (let cj = 0; cj < nz; cj += CH) for (let ci = 0; ci < nx; ci += CH) {
      const pos = [], nor = [], aos = [];
      for (let j = cj; j < Math.min(nz, cj + CH); j++) for (let i = ci; i < Math.min(nx, ci + CH); i++) {
        const i00 = j * (nx + 1) + i, i10 = i00 + 1, i01 = i00 + nx + 1, i11 = i01 + 1;
        const tris = ((i + j) & 1) ? [[i00, i01, i10], [i10, i01, i11]] : [[i00, i01, i11], [i00, i11, i10]];
        for (const t of tris) {
          a.set(vx[t[0]], vy[t[0]], vz[t[0]]); b.set(vx[t[1]], vy[t[1]], vz[t[1]]); c.set(vx[t[2]], vy[t[2]], vz[t[2]]);
          n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).normalize(); if (n.y < 0) n.negate();
          const flat = Math.abs(a.y) + Math.abs(b.y) + Math.abs(c.y) < 0.01;
          const jt = flat ? 0.16 : 0.1; n.x += (R() - 0.5) * jt; n.z += (R() - 0.5) * jt; n.normalize();
          for (const p of [a, b, c]) { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); }
          aos.push(vao[t[0]], vao[t[1]], vao[t[2]]);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('aAO', new THREE.Float32BufferAttribute(aos, 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.name = 'ground'; this.group.add(m);
    }
  }

  _makeMaterial() {
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const U = this.uniforms; const rpU = this.rp ? riverUniforms(this.rp) : null;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U); if (rpU) Object.assign(sh.uniforms, rpU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aAO; varying float vAO; varying vec3 vW; varying vec3 vWN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAO = aAO; vW = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform sampler2D uMask; uniform sampler2D uDetail; uniform vec4 uDom; uniform float uTime; uniform float uSwell;
        uniform vec3 uGrassLight, uGrassDeep, uJungleDeep, uJungleLight, uDirtLight, uDirtMid, uCobA, uCobB, uSand, uBed, uPlazaA, uPlazaB, uRock, uRockDark, uCrack;
        varying float vAO; varying vec3 vW; varying vec3 vWN; float gCaus; float gUw;`)
        .replace('#include <map_fragment>', `
        vec2 wxz = vW.xz;
        vec4 M = texture2D(uMask, (wxz - uDom.xy) * uDom.zw);
        float n1 = texture2D(uDetail, wxz * 0.017).r;
        float n2 = texture2D(uDetail, wxz * 0.043 + 0.37).r;
        float n3 = texture2D(uDetail, wxz * 0.27).a;
        float gt = clamp(n1 * 1.25 + n2 * 0.55 - 0.55, 0.0, 1.0);
        vec3 grass = mix(uGrassDeep, uGrassLight, smoothstep(0.22, 0.78, gt));
        vec3 jung = mix(uJungleDeep, uJungleLight, smoothstep(0.3, 0.75, n2));
        grass = mix(grass, jung, smoothstep(0.35, 0.85, M.b + (n1 - 0.5) * 0.4) * 0.8);
        grass *= 0.9 + 0.2 * n3;
        vec3 col = grass;
        float edgeN = (n2 - 0.5) * 0.45 + (n3 - 0.5) * 0.18;
        float dm = smoothstep(0.43, 0.5, M.r + edgeN);
        vec3 dirt = mix(uDirtMid, uDirtLight, smoothstep(0.3, 0.75, n2)) * (0.9 + 0.18 * n3);
        vec4 cb = texture2D(uDetail, wxz * 0.21);
        float cobM = smoothstep(0.52, 0.62, n1 + (M.r - 0.85) * 0.6) * smoothstep(0.75, 0.95, M.r);
        vec3 cob = mix(uCobA, uCobB, cb.b) * mix(0.62, 1.0, smoothstep(0.05, 0.3, cb.g));
        dirt = mix(dirt, cob, cobM);
        float rimD = smoothstep(0.33, 0.43, M.r + edgeN) * (1.0 - dm);
        col = mix(col, col * vec3(0.8, 0.78, 0.7), rimD);
        col = mix(col, dirt, dm);
        float sm = smoothstep(0.45, 0.56, M.a + edgeN * 0.7);
        col = mix(col, uSand * (0.88 + 0.16 * n3), sm);
        float pm = smoothstep(0.45, 0.52, M.g + edgeN * 0.35);
        vec4 pt = texture2D(uDetail, wxz * 0.16 + 0.5);
        vec3 plaza = mix(uPlazaA, uPlazaB, pt.b * 0.7) * mix(0.72, 1.0, smoothstep(0.03, 0.16, pt.g)) * (0.93 + 0.12 * n3);
        plaza = mix(plaza, plaza * vec3(0.62, 0.66, 0.6), smoothstep(0.5, 0.9, M.b));
        col = mix(col, plaza, pm);
        float slope = 1.0 - clamp(vWN.y, 0.0, 1.0);
        float rk = smoothstep(0.3, 0.5, slope + (n2 - 0.5) * 0.25);
        vec3 rock = mix(uRockDark, uRock, 0.35 + 0.5 * fract(vW.y * 0.8 + n2 * 0.6));
        col = mix(col, rock, rk);
        // wet river bed + caustics
        gUw = smoothstep(-0.15, -0.45, vW.y) * (1.0 - step(2.0, vW.y));
        vec3 bed = mix(uBed, uSand * 0.75, smoothstep(0.3, 0.8, n2));
        float c1 = texture2D(uDetail, wxz * 0.19 + vec2(0.0, uTime * 0.045)).g; float c2 = texture2D(uDetail, wxz * 0.15 - vec2(uTime * 0.03, uTime * 0.05)).g;
        gCaus = pow(max(1.0 - c1, 1.0 - c2), 4.0);
        col = mix(col, bed, gUw);
        float wet = smoothstep(0.3, -0.15, vW.y) * smoothstep(0.5, 0.9, M.a);
        col *= 1.0 - wet * 0.3;
        diffuseColor.rgb *= col * vAO;
        `)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += gCaus * gUw * smoothstep(-0.3, -0.8, vW.y) * vec3(0.55, 0.85, 0.9) * 0.22;
        if (uSwell > 0.001) { float ck = texture2D(uDetail, wxz * 0.026 + 0.21).g; float ck2 = texture2D(uDetail, wxz * 0.061 + 0.6).g;
          float area = smoothstep(0.42, 0.64, texture2D(uDetail, wxz * 0.008 + 0.3).r + texture2D(uDetail, wxz * 0.021).r * 0.25 - 0.1);
          float crack = (1.0 - smoothstep(0.02, 0.09, ck)) * area + (1.0 - smoothstep(0.02, 0.06, ck2)) * area * 0.5;
          crack *= (1.0 - gUw) * (1.0 - dm * 0.75) * (1.0 - pm * 0.6);
          float dc = length(wxz - vec2(120.0, 80.0)); float wave = pow(max(0.5 + 0.5 * sin(uTime * 2.4 - dc * 0.11), 0.0), 3.0);
          totalEmissiveRadiance += uCrack * crack * uSwell * (0.5 + 3.0 * wave);
          diffuseColor.rgb *= 1.0 - uSwell * 0.25 * area; }`);
    };
    m.customProgramCacheKey = () => 'terrain3';
    return m;
  }
  setSwell(k) { this.uniforms.uSwell.value = k; }
  dispose() { this.group.traverse((o) => { o.geometry?.dispose(); }); this.material.dispose(); this.maskTex.dispose(); }
}
