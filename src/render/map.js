// Map look: painted ground, diorama slab, river, obstacles (rocks/trees), brush, bases, fountains, pits, decor.
import * as THREE from 'three';
import { G, prep, mergeColored } from './models/builder.js';
import { makeToonMat, makeFlatMat, makeGlowMat, teamColor, mkRand, glowTexture } from './util.js';
import { ELEMENT_COLORS } from './models/units.js';

const PI = Math.PI;
const PAD = 26; // ground beyond map edges

// ───────────────────────── water shader ─────────────────────────
export function makeWaterMat(mode, p) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uMode: { value: mode === 'river' ? 0 : 1 }, uA: { value: new THREE.Vector4(p.cx, p.y0 ?? 0, p.y1 ?? 0, p.w ?? p.r) },
      uDeep: { value: new THREE.Color(p.deep ?? '#1b5a8e') }, uShallow: { value: new THREE.Color(p.shallow ?? '#46a8c0') }, uFoam: { value: new THREE.Color('#e8fbff') },
      uCz: { value: p.cz ?? 0 }, uRise: { value: 1 }, uAlpha: { value: p.alpha ?? 0.92 },
      uPits: { value: (p.pits || []).concat([{ x: -999, y: -999, r: 0 }, { x: -999, y: -999, r: 0 }]).slice(0, 2).map((q) => new THREE.Vector3(q.x, q.y, q.r)) },
    },
    vertexShader: `varying vec2 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime; uniform float uMode; uniform vec4 uA; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform float uCz; uniform float uRise; uniform float uAlpha; uniform vec3 uPits[2]; varying vec2 vW;
      float wob(float y){ return sin(y*0.35)*0.7 + sin(y*0.11+2.0)*0.9; }
      void main(){
        float d;
        if (uMode < 0.5) { float w = uA.w + wob(vW.y); float yy = clamp(vW.y, uA.y + uA.w, uA.z - uA.w); d = length(vec2(vW.x - uA.x, vW.y - yy)) - w; for (int i = 0; i < 2; i++) { if (uPits[i].z <= 0.0) continue; float pd = length(vW - uPits[i].xy); d = min(d, pd - (uPits[i].z + 3.2 + 0.5*sin(atan(vW.y-uPits[i].y, vW.x-uPits[i].x)*5.0))); d = max(d, uPits[i].z - pd); } }
        else { vec2 q = vW - vec2(uA.x, uCz); float an = atan(q.y, q.x); d = length(q) - uA.w * uRise * (1.0 + 0.04*sin(an*5.0 + uTime*0.6) + 0.03*sin(an*9.0)); }
        if (d > 0.0) discard;
        float depth = clamp(-d / 5.0, 0.0, 1.0);
        vec3 c = mix(uShallow, uDeep, depth);
        float r1 = sin(vW.x*0.9 + uTime*1.3 + sin(vW.y*0.5)) * sin(vW.y*0.8 - uTime*0.9 + sin(vW.x*0.4));
        float r2 = sin((vW.x + vW.y)*0.5 + uTime*0.7);
        c += smoothstep(0.8, 0.98, r1) * 0.1 + r2*0.02;
        float foam = smoothstep(-0.9, -0.1, d) * 0.9 + smoothstep(-2.3, -2.0, d) * (1.0 - smoothstep(-2.0, -1.7, d)) * (0.3 + 0.3*sin(uTime*2.0 + vW.y + vW.x));
        c = mix(c, uFoam, clamp(foam, 0.0, 1.0) * 0.85);
        gl_FragColor = vec4(c, uAlpha);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
  });
}

function riverParams(river, pits) {
  if (!river) return null;
  let x0 = river.x0, x1 = river.x1, y0 = river.y0, y1 = river.y1;
  const pts = river.polygon || river.points;
  if (pts && pts.length) { x0 = Math.min(...pts.map((p) => p.x)); x1 = Math.max(...pts.map((p) => p.x)); y0 = Math.min(...pts.map((p) => p.y)); y1 = Math.max(...pts.map((p) => p.y)); }
  if (x0 == null) return null;
  const pl = []; for (const k in pits || {}) { const p = pits[k]; if (p && Math.abs(p.x - (x0 + x1) / 2) < (x1 - x0) / 2 + p.r + 3) pl.push({ x: p.x, y: p.y, r: p.r + 2.8 }); }
  return { cx: (x0 + x1) / 2, w: (x1 - x0) / 2, y0, y1, pits: pl };
}
function riverSdf(rp, x, y) { const w = rp.w + Math.sin(y * 0.35) * 0.7 + Math.sin(y * 0.11 + 2) * 0.9; const yy = Math.min(Math.max(y, rp.y0 + rp.w), rp.y1 - rp.w); let d = Math.hypot(x - rp.cx, y - yy) - w; for (const p of rp.pits || []) { const pd = Math.hypot(x - p.x, y - p.y); d = Math.min(d, pd - (p.r + 3.2 + 0.5 * Math.sin(Math.atan2(y - p.y, x - p.x) * 5))); d = Math.max(d, p.r - pd); } return d; }

function distSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; const l = dx * dx + dy * dy || 1; let t = ((px - ax) * dx + (py - ay) * dy) / l; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - dx * t, py - ay - dy * t); }

// ───────────────────────── geometry recipes ─────────────────────────
function pineGeo() { return mergeColored([prep(G.cyl(0.18, 0.28, 1.4, 5), '#6a4a30', { p: [0, 0.7, 0] }), prep(G.cone(1.5, 2.0, 7), '#3f8a46', { p: [0, 2.0, 0] }), prep(G.cone(1.15, 1.7, 7), '#4a9a4e', { p: [0, 2.9, 0] }), prep(G.cone(0.75, 1.4, 7), '#58ab58', { p: [0, 3.7, 0] })]); }
function roundTreeGeo() { return mergeColored([prep(G.cyl(0.2, 0.32, 1.8, 5), '#7a5234', { p: [0, 0.9, 0] }), prep(G.ico(1.5, 0), '#5aa64a', { p: [0, 2.6, 0] }), prep(G.ico(1.0, 0), '#6ab854', { p: [0.7, 3.2, 0.3] }), prep(G.ico(0.95, 0), '#4e9a44', { p: [-0.6, 3.0, -0.4] })]); }
function rockGeo() { return mergeColored([prep(G.dodec(1), '#9a948c', {})]); }
function tuftGeo() { const l = []; for (let i = 0; i < 4; i++) { const a = i * 1.7; l.push(prep(G.cone(0.08, 0.6 + (i % 2) * 0.25, 3), '#6aae4a', { p: [Math.cos(a) * 0.15, 0.3, Math.sin(a) * 0.15], r: [Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3] })); } return mergeColored(l); }
function brushGeo() { const l = []; for (let i = 0; i < 9; i++) { const a = i * 2.39, r = 0.2 + (i % 3) * 0.25; l.push(prep(G.cone(0.16, 1.6 + (i % 3) * 0.5, 3), i % 2 ? '#2f7a5a' : '#3a8a62', { p: [Math.cos(a) * r, 0.8 + (i % 3) * 0.25, Math.sin(a) * r], r: [Math.sin(a) * 0.35, a, Math.cos(a) * 0.35] })); } return mergeColored(l); }
function flowerGeo() { return mergeColored([prep(G.cyl(0.03, 0.03, 0.4, 3), '#4a8a3a', { p: [0, 0.2, 0] }), prep(G.ico(0.14, 0), '#ffffff', { p: [0, 0.45, 0] })]); }
function mushroomGeo() { return mergeColored([prep(G.cyl(0.08, 0.1, 0.35, 5), '#f0e8d8', { p: [0, 0.17, 0] }), prep(G.cone(0.26, 0.2, 6), '#ffffff', { p: [0, 0.42, 0] })]); }

function instanced(geo, mat, list, shadow = true, chunk = 48) {
  // split into spatial chunks so frustum culling works
  const groups = new Map();
  for (const it of list) { const k = Math.floor(it.x / chunk) + ',' + Math.floor(it.z / chunk); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
  const root = new THREE.Group();
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const items of groups.values()) {
    const m = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((it, i) => {
      q.setFromEuler(e.set(it.rx || 0, it.ry || 0, it.rz || 0));
      mx.compose(v.set(it.x, it.y || 0, it.z), q, sc.set(it.sx ?? it.s, it.sy ?? it.s, it.sz ?? it.s));
      m.setMatrixAt(i, mx); m.setColorAt(i, c.set(it.c ?? 0xffffff));
    });
    m.castShadow = shadow; m.receiveShadow = false; m.computeBoundingSphere(); root.add(m);
  }
  return root;
}

// ───────────────────────── MapView ─────────────────────────
export class MapView {
  constructor(map, quality = 'med') {
    this.map = map || {}; this.group = new THREE.Group(); this.quality = quality; this.updatables = [];
    this.decor = new THREE.Group(); this.group.add(this.decor);
    const W = this.map.width || 240, H = this.map.height || 160; this.W = W; this.H = H;
    this.rp = riverParams(this.map.river, this.map.pits);
    this.rand = mkRand(1337);
    this.lanes = (this.map.lanes || []).filter((l) => l.points && l.points.length > 1);
    this._buildGround();
    this._buildSlab();
    this._buildRiver();
    this._buildObstacles();
    this._buildBrush();
    this._buildBases();
    this._buildPits();
    this._buildDecor();
  }
  laneDist(x, y) { let d = 1e9; for (const l of this.lanes) for (let i = 0; i < l.points.length - 1; i++) { const a = l.points[i], b = l.points[i + 1]; d = Math.min(d, distSeg(x, y, a.x, a.y, b.x, b.y)); } return d; }
  blockedDecor(x, y, margin = 1) {
    if (this.laneDist(x, y) < 6.5 + margin) return true;
    if (this.rp && riverSdf(this.rp, x, y) < 1.5 + margin) return true;
    for (const b of this.map.bases || []) if (Math.hypot(x - b.x, y - b.y) < (b.r ?? 20) * 0.85) return true;
    for (const o of this.map.obstacles || []) if (o.type !== 'rect' && Math.hypot(x - o.x, y - o.y) < o.r + margin) return true;
    for (const b of this.map.brush || []) if (Math.hypot(x - b.x, y - b.y) < b.r + 1) return true;
    const pits = this.map.pits || {}; for (const k in pits) { const p = pits[k]; if (Math.hypot(x - p.x, y - p.y) < p.r + 3) return true; }
    for (const c of this.map.camps || []) if (Math.hypot(x - c.x, y - c.y) < 5) return true;
    return false;
  }

  _buildGround() {
    const W = this.W, H = this.H, Wt = W + PAD * 2, Ht = H + PAD * 2;
    const res = this.quality === 'low' ? 1024 : 2048;
    const S = res / Wt; const cw = res, ch = Math.round(Ht * S);
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const g = cv.getContext('2d');
    const X = (x) => (x + PAD) * S, Y = (y) => (y + PAD) * S;
    const R = this.rand;
    // base grass
    g.fillStyle = '#5f9e48'; g.fillRect(0, 0, cw, ch);
    // large tonal patches
    for (let i = 0; i < 260; i++) { const x = R() * Wt - PAD, y = R() * Ht - PAD, r = 4 + R() * 14; g.fillStyle = `hsla(${95 + R() * 25},${38 + R() * 15}%,${30 + R() * 14}%,0.18)`; g.beginPath(); g.ellipse(X(x), Y(y), r * S, r * S * (0.6 + R() * 0.5), R() * PI, 0, PI * 2); g.fill(); }
    // jungle darker toward center band (between lanes)
    const jg = g.createRadialGradient(X(W / 2), Y(H / 2), 10 * S, X(W / 2), Y(H / 2), 85 * S);
    jg.addColorStop(0, 'rgba(30,70,40,0.32)'); jg.addColorStop(1, 'rgba(30,70,40,0)'); g.fillStyle = jg; g.fillRect(0, 0, cw, ch);
    // outside-map darker
    g.fillStyle = 'rgba(25,55,30,0.35)'; g.fillRect(0, 0, cw, Y(0)); g.fillRect(0, Y(H), cw, ch - Y(H)); g.fillRect(0, 0, X(0), ch); g.fillRect(X(W), 0, cw - X(W), ch);
    // tiny grass speckle
    for (let i = 0; i < 9000; i++) { const x = R() * cw, y = R() * ch; g.fillStyle = R() < 0.5 ? 'rgba(140,200,90,0.25)' : 'rgba(40,90,40,0.25)'; g.fillRect(x, y, 2 + R() * 2, 2 + R() * 2); }
    // obstacle soil
    for (const o of this.map.obstacles || []) { if (o.type === 'rect') continue; const gr = g.createRadialGradient(X(o.x), Y(o.y), 0, X(o.x), Y(o.y), (o.r + 2.5) * S); gr.addColorStop(0, 'rgba(60,70,40,0.65)'); gr.addColorStop(0.75, 'rgba(60,70,40,0.4)'); gr.addColorStop(1, 'rgba(60,70,40,0)'); g.fillStyle = gr; g.beginPath(); g.arc(X(o.x), Y(o.y), (o.r + 2.5) * S, 0, PI * 2); g.fill(); }
    // bases: stone plaza
    for (const b of this.map.bases || []) {
      const tc = '#' + new THREE.Color(teamColor(b.team)).getHexString(); const r = (b.r ?? 22) * 0.9;
      g.save(); g.beginPath(); g.arc(X(b.x), Y(b.y), r * S, 0, PI * 2); g.clip();
      g.fillStyle = '#b9ad98'; g.fillRect(X(b.x - r), Y(b.y - r), r * 2 * S, r * 2 * S);
      for (let ring = 1; ring < r; ring += 2.4) for (let a = 0; a < PI * 2; a += 2.2 / ring) { g.fillStyle = `hsl(${35 + R() * 10},${12 + R() * 8}%,${60 + R() * 14}%)`; g.save(); g.translate(X(b.x + Math.cos(a) * ring), Y(b.y + Math.sin(a) * ring)); g.rotate(a); g.fillRect(-1.0 * S, -1.05 * S, 2.0 * S, 2.1 * S); g.restore(); }
      g.restore();
      g.lineWidth = 1.2 * S; g.strokeStyle = tc; g.globalAlpha = 0.85; g.beginPath(); g.arc(X(b.x), Y(b.y), r * S, 0, PI * 2); g.stroke();
      g.lineWidth = 0.4 * S; g.beginPath(); g.arc(X(b.x), Y(b.y), (r - 1.6) * S, 0, PI * 2); g.stroke(); g.globalAlpha = 1;
      const tg = g.createRadialGradient(X(b.x), Y(b.y), r * 0.4 * S, X(b.x), Y(b.y), r * S); tg.addColorStop(0, 'rgba(0,0,0,0)'); tg.addColorStop(1, tc + '40'); g.fillStyle = tg; g.beginPath(); g.arc(X(b.x), Y(b.y), r * S, 0, PI * 2); g.fill();
    }
    // lanes: worn dirt path with soft edges + wheel ruts + pebbles
    const strokeLane = (pts, w, style, alpha = 1) => { g.globalAlpha = alpha; g.strokeStyle = style; g.lineWidth = w * S; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y)))); g.stroke(); g.globalAlpha = 1; };
    for (const l of this.lanes) {
      const pts = smoothPts(l.points);
      strokeLane(pts, 13, '#4f7a38', 0.45); strokeLane(pts, 10.5, '#9a7a4a', 0.55); strokeLane(pts, 9, '#b8925a'); strokeLane(pts, 7, '#c6a46a', 0.8);
      for (const off of [-1.6, 1.6]) { const sh = offsetPts(pts, off); strokeLane(sh, 0.5, '#a07a48', 0.6); }
    }
    for (const l of this.lanes) { for (let i = 0; i < 500; i++) { const seg = Math.floor(R() * (l.points.length - 1)); const a = l.points[seg], b = l.points[seg + 1]; const t = R(); const x = a.x + (b.x - a.x) * t + (R() - 0.5) * 9, y = a.y + (b.y - a.y) * t + (R() - 0.5) * 9; if (this.laneDist(x, y) > 4.5) continue; g.fillStyle = R() < 0.5 ? 'rgba(120,90,55,0.6)' : 'rgba(225,200,150,0.5)'; g.beginPath(); g.arc(X(x), Y(y), (0.15 + R() * 0.35) * S, 0, PI * 2); g.fill(); } }
    // river bed (per-pixel SDF for clean banks)
    if (this.rp) {
      const rp = this.rp; const ext = Math.max(rp.w + 3, ...(rp.pits || []).map((p) => p.r + 5)) + 4;
      const px0 = Math.max(0, Math.floor(X(rp.cx - ext))), px1 = Math.min(cw, Math.ceil(X(rp.cx + ext))), py0 = Math.max(0, Math.floor(Y(rp.y0 - 6))), py1 = Math.min(ch, Math.ceil(Y(rp.y1 + 6)));
      const img = g.getImageData(px0, py0, px1 - px0, py1 - py0); const D = img.data; const iw = px1 - px0;
      for (let j = 0; j < py1 - py0; j++) for (let i = 0; i < iw; i++) {
        const wx = (px0 + i + 0.5) / S - PAD, wy = (py0 + j + 0.5) / S - PAD; const d = riverSdf(rp, wx, wy); if (d > 3) continue;
        const k = (j * iw + i) * 4; let r, gg, b, a;
        if (d < -0.6) { r = 58; gg = 106; b = 106; a = 1; } else if (d < 0) { r = 190; gg = 176; b = 128; a = 1; } else { const n = (Math.sin(wx * 3.1) * Math.sin(wy * 2.7)) * 6; r = 214 + n; gg = 196 + n; b = 140 + n; a = d < 1.6 ? 1 : 1 - (d - 1.6) / 1.4; }
        D[k] = D[k] * (1 - a) + r * a; D[k + 1] = D[k + 1] * (1 - a) + gg * a; D[k + 2] = D[k + 2] * (1 - a) + b * a;
      }
      g.putImageData(img, px0, py0);
    }
    // pits
    const pits = this.map.pits || {};
    for (const k in pits) { const p = pits[k]; const gr = g.createRadialGradient(X(p.x), Y(p.y), 0, X(p.x), Y(p.y), (p.r + 2) * S); gr.addColorStop(0, '#5a5048'); gr.addColorStop(0.8, '#6e6458'); gr.addColorStop(0.9, '#8a8070'); gr.addColorStop(1, 'rgba(80,90,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(X(p.x), Y(p.y), (p.r + 2) * S, 0, PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 0.3 * S; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(X(p.x), Y(p.y), (p.r * (0.35 + i * 0.22)) * S, 0, PI * 2); g.stroke(); } }
    // camps
    for (const c of this.map.camps || []) { g.fillStyle = 'rgba(90,75,55,0.55)'; g.beginPath(); g.ellipse(X(c.x), Y(c.y), 4.5 * S, 3.8 * S, 0, 0, PI * 2); g.fill(); g.strokeStyle = 'rgba(230,210,150,0.35)'; g.lineWidth = 0.25 * S; g.beginPath(); g.arc(X(c.x), Y(c.y), 3.2 * S, 0, PI * 2); g.stroke(); }
    // brush shadow patches
    for (const b of this.map.brush || []) { g.fillStyle = 'rgba(20,60,40,0.55)'; g.beginPath(); g.arc(X(b.x), Y(b.y), (b.r + 0.6) * S, 0, PI * 2); g.fill(); }
    // vignette at map border
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(Wt, Ht); geo.rotateX(-PI / 2); geo.translate(W / 2, 0, H / 2);
    this.groundMat = new THREE.MeshLambertMaterial({ map: tex });
    const m = new THREE.Mesh(geo, this.groundMat); m.receiveShadow = true; m.name = 'ground'; this.group.add(m); this.ground = m;
    this.groundTex = tex;
  }
  _buildSlab() {
    const W = this.W, H = this.H, Wt = W + PAD * 2, Ht = H + PAD * 2, D = 9;
    const geo = new THREE.BoxGeometry(Wt, D, Ht, 1, 4, 1); geo.translate(W / 2, -D / 2 - 0.02, H / 2);
    const pos = geo.attributes.position; const cols = new Float32Array(pos.count * 3); const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); const t = -y / D; c.set(t < 0.08 ? '#4f8a3c' : t < 0.4 ? '#7a5a3a' : t < 0.7 ? '#634a32' : '#4a3828'); cols.set([c.r, c.g, c.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); this.group.add(m);
  }
  _buildRiver() {
    if (!this.rp) return; const rp = this.rp;
    const ext = Math.max(rp.w + 3, ...(rp.pits || []).map((p) => p.r + 5)); const geo = new THREE.PlaneGeometry(ext * 2, rp.y1 - rp.y0 + 6); geo.rotateX(-PI / 2); geo.translate(rp.cx, 0.06, (rp.y0 + rp.y1) / 2);
    this.waterMat = makeWaterMat('river', { cx: rp.cx, y0: rp.y0, y1: rp.y1, w: rp.w, pits: rp.pits });
    const m = new THREE.Mesh(geo, this.waterMat); m.renderOrder = 2; this.group.add(m);
    this.updatables.push((t) => { this.waterMat.uniforms.uTime.value = t; });
    // lily pads + bank stones
    const R = this.rand, pads = [], stones = [];
    for (let i = 0; i < 26; i++) { const y = rp.y0 + 4 + R() * (rp.y1 - rp.y0 - 8), x = rp.cx + (R() - 0.5) * rp.w * 1.6; if (riverSdf(rp, x, y) > -1.5) continue; pads.push({ x, y: 0.1, z: y, s: 0.6 + R() * 0.6, ry: R() * 6, c: new THREE.Color().setHSL(0.28 + R() * 0.06, 0.5, 0.42) }); }
    for (let i = 0; i < 50; i++) { const y = rp.y0 + R() * (rp.y1 - rp.y0); const side = R() < 0.5 ? -1 : 1; const x = rp.cx + side * (rp.w + 0.8 + R() * 1.2); stones.push({ x, y: 0.05, z: y, s: 0.3 + R() * 0.5, sy: 0.5, rx: R(), ry: R() * 6, c: new THREE.Color().setHSL(0.08, 0.08, 0.55 + R() * 0.2) }); }
    const padGeo = mergeColored([prep(new THREE.CylinderGeometry(1, 1, 0.06, 9, 1, false, 0.4, PI * 1.8), '#ffffff', {})]);
    this.decor.add(instanced(padGeo, makeFlatMat(0xffffff), pads, false));
    this.decor.add(instanced(rockGeo(), makeFlatMat(0xffffff), stones, false));
  }
  _buildObstacles() {
    const R = this.rand, trees = [], rounds = [], rocks = [];
    const W = this.W, H = this.H;
    const tc = () => new THREE.Color().setHSL(0.27 + R() * 0.08, 0.35 + R() * 0.2, 0.42 + R() * 0.16).multiplyScalar(2.0);
    const addTree = (x, y, s) => { const c = new THREE.Color(1, 1, 1).lerp(new THREE.Color().setHSL(0.15 + R() * 0.2, 0.6, 0.6), 0.25); (R() < 0.55 ? trees : rounds).push({ x, z: y, s, ry: R() * 6, c }); };
    for (const o of this.map.obstacles || []) {
      if (o.type === 'rect') { // rocky wall
        const n = Math.max(2, Math.round(Math.max(o.w, o.h) / 2.2)); const rot = o.rot || 0;
        for (let i = 0; i < n; i++) { const t = (i + 0.5) / n - 0.5; const lx = o.w >= o.h ? t * o.w : 0, ly = o.w >= o.h ? 0 : t * o.h; const x = o.x + lx * Math.cos(rot) - ly * Math.sin(rot), y = o.y + lx * Math.sin(rot) + ly * Math.cos(rot); const s = Math.min(o.w, o.h) * 0.6 + R() * 0.6; rocks.push({ x, y: s * 0.3, z: y, s, sy: s * 1.3, rx: R(), ry: R() * 6, c: new THREE.Color().setHSL(0.08, 0.06, 0.5 + R() * 0.15) }); }
        continue;
      }
      const r = o.r;
      if (r >= 10) { // forest mass with cliff rocks at rim
        for (let y = o.y - r; y <= o.y + r; y += 3.2) for (let x = o.x - r; x <= o.x + r; x += 3.2) {
          const jx = x + (R() - 0.5) * 2, jy = y + (R() - 0.5) * 2; const d = Math.hypot(jx - o.x, jy - o.y);
          if (d > r - 0.5 || jx < -PAD + 2 || jy < -PAD + 2 || jx > W + PAD - 2 || jy > H + PAD - 2) continue;
          addTree(jx, jy, 0.95 + R() * 0.5);
        }
        const n = Math.round(r * 1.1); for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2 + R() * 0.2; const rr = r - 0.6; const x = o.x + Math.cos(a) * rr, y = o.y + Math.sin(a) * rr; if (x < -2 || y < -2 || x > W + 2 || y > H + 2) continue; const s = 1.1 + R() * 0.9; rocks.push({ x, y: s * 0.2, z: y, s, sy: s * (0.8 + R() * 0.6), rx: R(), ry: R() * 6, c: new THREE.Color().setHSL(0.08, 0.07, 0.5 + R() * 0.15) }); }
      } else {
        // boulder cluster core + ring of trees
        const nb = r > 5 ? 3 : 2;
        for (let i = 0; i < nb; i++) { const a = i * 2.1 + R(); const rr = r * 0.3 * (i ? 1 : 0); const s = r * (i ? 0.42 : 0.6) * (0.85 + R() * 0.3); rocks.push({ x: o.x + Math.cos(a) * rr, y: s * 0.25, z: o.y + Math.sin(a) * rr, s, sy: s * (0.8 + R() * 0.4), rx: R(), ry: R() * 6, c: new THREE.Color().setHSL(0.07 + R() * 0.03, 0.08, 0.5 + R() * 0.15) }); }
        const nt = Math.round(r * 1.2); for (let i = 0; i < nt; i++) { const a = (i / nt) * PI * 2 + R() * 0.4; const rr = r * (0.55 + R() * 0.35); addTree(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr, 0.75 + R() * 0.45); }
      }
    }
    // edge forest ring (outside nav-walkable border)
    const edge = (x, y) => { if (R() < 0.15) return; addTree(x + (R() - 0.5) * 1.5, y + (R() - 0.5) * 1.5, 1.0 + R() * 0.6); };
    for (let x = -PAD + 3; x <= W + PAD - 3; x += 3.4) { for (let y = -PAD + 3; y < 1.5; y += 3.6) edge(x, y); for (let y = H - 1.5; y < H + PAD - 3; y += 3.6) edge(x, y); }
    for (let y = 2; y <= H - 2; y += 3.4) { for (let x = -PAD + 3; x < 0.5; x += 3.6) edge(x, y); for (let x = W - 0.5; x < W + PAD - 3; x += 3.6) edge(x, y); }
    const mat = makeToonMat({ rim: 0xd8ffb0, rimStrength: 0.25 }); mat.userData.shared = false;
    this.treeMat = mat;
    this.group.add(instanced(pineGeo(), mat, trees)); this.group.add(instanced(roundTreeGeo(), mat, rounds));
    const rm = makeToonMat({ rimStrength: 0.2 });
    this.group.add(instanced(rockGeo(), rm, rocks));
  }
  _buildBrush() {
    const R = this.rand, list = [];
    for (const b of this.map.brush || []) {
      const n = Math.round(b.r * b.r * 1.3);
      for (let i = 0; i < n; i++) { const a = R() * PI * 2, rr = Math.sqrt(R()) * b.r; list.push({ x: b.x + Math.cos(a) * rr, z: b.y + Math.sin(a) * rr, s: 0.8 + R() * 0.5, ry: R() * 6, c: new THREE.Color().setHSL(0.4 + R() * 0.05, 0.4, 0.5 + R() * 0.15).multiplyScalar(1.6) }); }
    }
    if (!list.length) return;
    this.brushMat = makeToonMat({ rim: 0xb0ffd8, rimStrength: 0.35 });
    this.brushMat.transparent = false;
    this.brushMesh = instanced(brushGeo(), this.brushMat, list, false);
    this.group.add(this.brushMesh);
    // gentle sway via vertex shader
    const u = { uTime: { value: 0 } }; const prev = this.brushMat.onBeforeCompile;
    this.brushMat.onBeforeCompile = (sh) => { prev(sh); sh.uniforms.uTime = u.uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\n float sw = position.y * 0.12; transformed.x += sin(uTime*1.7 + instanceMatrix[3].x*0.5) * sw; transformed.z += cos(uTime*1.3 + instanceMatrix[3].z*0.5) * sw;'); };
    this.brushMat.customProgramCacheKey = () => 'brushsway';
    this.updatables.push((t) => { u.uTime.value = t; });
  }
  _buildBases() {
    const fountains = this.map.fountains || (this.map.bases || []).map((b) => ({ team: b.team, x: b.x - 9 * (b.team === 0 ? 1 : -1), y: b.y }));
    const stone = '#b8b0a2', stone2 = '#8e877c';
    for (const f of fountains) {
      const tc = new THREE.Color(teamColor(f.team)).getStyle();
      const l = [];
      for (let i = 0; i < 14; i++) { const a = i / 14 * PI * 2; l.push(prep(G.box(1.9, 0.45, 0.8), i % 2 ? stone : stone2, { p: [Math.cos(a) * 6, 0.22, Math.sin(a) * 6], r: [0, -a + PI / 2, 0] })); }
      // back spire (towards map edge)
      const bx = f.team === 0 ? -6.5 : 6.5;
      l.push(prep(G.cyl(1.4, 1.9, 1.2, 8), stone2, { p: [bx, 0.6, 0] })); l.push(prep(G.cyl(0.7, 1.1, 5.5, 6), stone, { p: [bx, 3.5, 0] }));
      for (const s of [-1, 1]) { l.push(prep(G.box(1.2, 7, 1.2), stone, { p: [bx * 0.7, 3.5, s * 9] })); l.push(prep(G.box(1.6, 0.6, 1.6), stone2, { p: [bx * 0.7, 7.2, s * 9] })); l.push(prep(G.box(0.12, 2.6, 1.6), tc, { p: [bx * 0.7 + (f.team === 0 ? 0.65 : -0.65), 5.0, s * 9] })); }
      const m = new THREE.Mesh(mergeColored(l), makeToonMat({ rimStrength: 0.2 })); m.position.set(f.x, 0, f.y); m.castShadow = true; m.receiveShadow = true; this.group.add(m);
      // glowing pool
      const pool = new THREE.Mesh(new THREE.CircleGeometry(5.7, 24).rotateX(-PI / 2), makeWaterMat('disc', { cx: f.x, cz: f.y, r: 5.6, deep: new THREE.Color(teamColor(f.team)).multiplyScalar(0.5), shallow: new THREE.Color(teamColor(f.team)).lerp(new THREE.Color(1, 1, 1), 0.12), alpha: 0.9 }));
      pool.position.set(f.x, 0.08, f.y); pool.renderOrder = 2; this.group.add(pool);
      pool.material.uniforms.uA.value.x = f.x;
      this.updatables.push((t) => { pool.material.uniforms.uTime.value = t; });
      const cr = new THREE.Mesh(G.oct(1.0), makeGlowMat(teamColor(f.team))); cr.scale.set(0.8, 1.6, 0.8); cr.position.set(f.x + bx, 7.6, f.y); this.group.add(cr);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: teamColor(f.team), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); gl.scale.set(6, 6, 1); gl.position.copy(cr.position); this.group.add(gl);
      this.updatables.push((t) => { cr.rotation.y = t * 0.8; cr.position.y = 7.6 + Math.sin(t * 1.5) * 0.3; gl.position.y = cr.position.y; });
      this.fountainFx = this.fountainFx || []; this.fountainFx.push({ x: f.x, y: f.y, color: teamColor(f.team) });
    }
    // perimeter banners on bases
    for (const b of this.map.bases || []) {
      const tc = new THREE.Color(teamColor(b.team)).getStyle(); const l = [];
      const r = (b.r ?? 22) * 0.92;
      for (const a0 of [-1.0, -0.55, 0.55, 1.0]) { const a = (b.team === 0 ? PI : 0) + a0 * 1.0; const x = Math.cos(a) * r, z = Math.sin(a) * r; l.push(prep(G.cyl(0.14, 0.18, 5, 5), '#6a5a48', { p: [x, 2.5, z] })); l.push(prep(G.box(0.08, 2.2, 1.3), tc, { p: [x, 3.6, z + 0.7] })); l.push(prep(G.cone(0.25, 0.5, 4), '#e8d088', { p: [x, 5.2, z] })); l.push(prep(G.cyl(0.6, 0.8, 0.5, 6), stone2, { p: [x, 0.25, z] })); }
      const m = new THREE.Mesh(mergeColored(l), makeToonMat({ rimStrength: 0.2 })); m.position.set(b.x, 0, b.y); m.castShadow = true; this.group.add(m);
    }
  }
  _buildPits() {
    const pits = this.map.pits || {}; this.pitGlow = {};
    for (const k in pits) {
      const p = pits[k]; const l = []; const n = 12;
      for (let i = 0; i < n; i++) { const a = i / n * PI * 2 + 0.13; const h = 1.6 + (i % 3) * 0.7; l.push(prep(G.box(1.1, h, 0.9), i % 2 ? '#8e8678' : '#a49a8a', { p: [Math.cos(a) * (p.r + 1.6), h / 2 - 0.1, Math.sin(a) * (p.r + 1.6)], r: [0, -a, (i % 2 - 0.5) * 0.12] })); }
      const m = new THREE.Mesh(mergeColored(l), makeToonMat({ rimStrength: 0.2 })); m.position.set(p.x, 0, p.y); m.castShadow = true; this.group.add(m);
      // rune glow ring
      const ringGeo = new THREE.RingGeometry(p.r - 0.6, p.r, 48); ringGeo.rotateX(-PI / 2);
      const col = k === 'wyrm' ? ELEMENT_COLORS.none : '#c07aff';
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      ring.position.set(p.x, 0.1, p.y); ring.renderOrder = 4; this.group.add(ring);
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(p.r * 2.4, p.r * 2.4).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture(), color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      inner.position.set(p.x, 0.09, p.y); inner.renderOrder = 4; this.group.add(inner);
      this.pitGlow[k] = { ring, inner, p, color: new THREE.Color(col) };
    }
  }
  _buildDecor() {
    const R = this.rand; const W = this.W, H = this.H;
    const nT = this.quality === 'low' ? 250 : this.quality === 'high' ? 1400 : 800;
    const tufts = [], flowers = [], shrooms = [], pebbles = [];
    const fc = ['#ffe066', '#ff8ac8', '#ffffff', '#9fd0ff', '#ff9a5a'];
    let guard = 0;
    while (tufts.length < nT && guard++ < nT * 6) { const x = R() * W, y = R() * H; if (this.blockedDecor(x, y, 0.5)) continue; tufts.push({ x, z: y, s: 0.7 + R() * 0.7, ry: R() * 6, c: new THREE.Color().setHSL(0.24 + R() * 0.08, 0.5, 0.5 + R() * 0.2).multiplyScalar(1.5) }); }
    guard = 0; while (flowers.length < nT * 0.3 && guard++ < nT * 3) { const x = R() * W, y = R() * H; if (this.blockedDecor(x, y, 1)) continue; for (let k = 0; k < 3; k++) flowers.push({ x: x + (R() - 0.5) * 1.5, z: y + (R() - 0.5) * 1.5, s: 0.8 + R() * 0.5, c: new THREE.Color(fc[Math.floor(R() * fc.length)]) }); }
    guard = 0; while (shrooms.length < nT * 0.06 && guard++ < nT) { const x = R() * W, y = R() * H; if (this.blockedDecor(x, y, 1)) continue; shrooms.push({ x, z: y, s: 0.8 + R() * 0.8, ry: R() * 6, c: new THREE.Color(R() < 0.5 ? '#e0503a' : '#c07aff') }); }
    guard = 0; while (pebbles.length < nT * 0.12 && guard++ < nT) { const x = R() * W, y = R() * H; if (this.blockedDecor(x, y, 0)) continue; const s = 0.25 + R() * 0.5; pebbles.push({ x, y: 0.05, z: y, s, sy: s * 0.6, rx: R(), ry: R() * 6, c: new THREE.Color().setHSL(0.08, 0.05, 0.6 + R() * 0.2) }); }
    const mat = makeFlatMat(0xffffff);
    this.decor.add(instanced(tuftGeo(), mat, tufts, false));
    this.decor.add(instanced(flowerGeo(), mat, flowers, false));
    this.decor.add(instanced(mushroomGeo(), mat, shrooms, false));
    this.decor.add(instanced(rockGeo(), mat, pebbles, false));
  }
  setQuality(q) { this.decor.visible = q !== 'low' || true; }

  update(time, dt, match, vfx) {
    for (const f of this.updatables) f(time);
    // pit glow by wyrm element
    const wy = match?.objectives?.wyrm;
    if (this.pitGlow?.wyrm) {
      const el = wy ? (wy.alive ? wy.element : wy.nextElement) || wy.element : null;
      const tgt = new THREE.Color(ELEMENT_COLORS[el] || ELEMENT_COLORS.none);
      const g = this.pitGlow.wyrm; g.color.lerp(tgt, Math.min(1, dt * 2));
      g.ring.material.color.copy(g.color); g.inner.material.color.copy(g.color);
      const pulse = 0.5 + 0.2 * Math.sin(time * 2); g.ring.material.opacity = (wy?.alive ? 0.85 : 0.45) * pulse + 0.2; g.inner.material.opacity = (wy?.alive ? 0.45 : 0.2) * pulse;
      if (vfx && wy?.alive && Math.random() < dt * 8) { const a = Math.random() * PI * 2, r = Math.random() * g.p.r; vfx.trail(g.p.x + Math.cos(a) * r, 0.3, g.p.y + Math.sin(a) * r, '#' + g.color.getHexString(), { vy: 1.5, life: 1.4, size: 0.5, style: 'embers' }); }
    }
    if (this.pitGlow?.colossus) { const g = this.pitGlow.colossus; const al = match?.objectives?.colossus?.alive; g.ring.material.opacity = (al ? 0.8 : 0.4) * (0.6 + 0.3 * Math.sin(time * 1.4)); g.inner.material.opacity = al ? 0.4 : 0.15; }
    if (vfx && this.fountainFx) for (const f of this.fountainFx) if (Math.random() < dt * 10) { const a = Math.random() * PI * 2, r = Math.random() * 5; vfx.trail(f.x + Math.cos(a) * r, 0.2, f.y + Math.sin(a) * r, f.color, { vy: 2.5, life: 1.3, size: 0.5, style: 'stars', shape: 2 }); }
  }
  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map && m.map !== glowTexture()) m.map.dispose(); m.dispose(); }); } });
  }
}

function smoothPts(pts) { // Catmull-Rom resample for curvy lanes
  if (pts.length < 3) return pts;
  const v = pts.map((p) => new THREE.Vector2(p.x, p.y));
  const curve = new THREE.SplineCurve(v); return curve.getPoints(pts.length * 12).map((p) => ({ x: p.x, y: p.y }));
}
function offsetPts(pts, off) {
  return pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy) || 1; return { x: p.x - dy / l * off, y: p.y + dx / l * off }; });
}
