// Map look (v3): faceted terrain, raised rock plateaus, lush wind-swept foliage, tall-grass brush, river + waterfall,
// grand bases, arenas, lanes with edge stones / lanterns / banners, ruins, crystals, ambient life.
import * as THREE from 'three';
import { makeGlowMat, makeWorldMat, teamColor, mkRand, glowTexture, WORLD } from './util.js';
import { ELEMENT_COLORS } from './models/units.js';
import { Terrain, riverSdf, smoothPts, fbm, PAD } from './env/terrain.js';
import { PREFAB, P, merge, StaticWorld, makeFoliageMat, FOLIAGE_U } from './env/props.js';
import { buildWater } from './env/water.js';
import { buildFountain, buildPit, buildBridge, runeDecal, TEAM_TRIM } from './env/structures.js';
import { Halos, AmbientField, buildMist, buildGodRays } from './env/ambient.js';

const PI = Math.PI;

// ───────────────────────── legacy water shader (fountain pools, flood zones) ─────────────────────────
export function makeWaterMat(mode, p) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uMode: { value: mode === 'river' ? 0 : 1 }, uA: { value: new THREE.Vector4(p.cx, p.y0 ?? 0, p.y1 ?? 0, p.w ?? p.r) },
      uDeep: { value: new THREE.Color(p.deep ?? '#1d5fae') }, uShallow: { value: new THREE.Color(p.shallow ?? '#4fd6d0') }, uFoam: { value: new THREE.Color('#f4feff') },
      uCz: { value: p.cz ?? 0 }, uRise: { value: 1 }, uAlpha: { value: p.alpha ?? 0.92 }, uGlow: { value: p.glow ?? 0 },
      uPits: { value: (p.pits || []).concat([{ x: -999, y: -999, r: 0 }, { x: -999, y: -999, r: 0 }]).slice(0, 2).map((q) => new THREE.Vector3(q.x, q.y, q.r)) },
    },
    vertexShader: `varying vec2 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime; uniform float uMode; uniform vec4 uA; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform float uCz; uniform float uRise; uniform float uAlpha; uniform float uGlow; uniform vec3 uPits[2]; varying vec2 vW;
      void main(){
        vec2 q = vW - vec2(uA.x, uCz); float an = atan(q.y, q.x); float d = length(q) - uA.w * uRise * (1.0 + 0.04*sin(an*5.0 + uTime*0.6) + 0.03*sin(an*9.0));
        if (d > 0.0) discard;
        float depth = clamp(-d / 4.0, 0.0, 1.0);
        vec3 c = mix(uShallow, uDeep, depth);
        float r1 = sin(vW.x*0.9 + uTime*1.3 + sin(vW.y*0.5)) * sin(vW.y*0.8 - uTime*0.9 + sin(vW.x*0.4));
        c += smoothstep(0.75, 0.98, r1) * 0.25;
        float foam = smoothstep(-0.8, -0.1, d) * 0.9 + smoothstep(-2.3, -2.0, d) * (1.0 - smoothstep(-2.0, -1.7, d)) * (0.3 + 0.3*sin(uTime*2.0 + vW.y + vW.x));
        c = mix(c, uFoam, clamp(foam, 0.0, 1.0) * 0.85);
        c *= 1.0 + uGlow * (0.8 + 0.2 * sin(uTime * 2.0 + length(q)));
        gl_FragColor = vec4(c, uAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
  });
}

function distSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; const l = dx * dx + dy * dy || 1; let t = ((px - ax) * dx + (py - ay) * dy) / l; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - dx * t, py - ay - dy * t); }

// jungle trails (mirrored in x and y from one quadrant)
function makeTrails(W, H) {
  const q = [
    [{ x: 44, y: 80 }, { x: 60, y: 79 }, { x: 70, y: 72 }, { x: 86, y: 72 }, { x: 94, y: 80 }],
    [{ x: 72, y: 50 }, { x: 80, y: 60 }, { x: 86, y: 70 }],
    [{ x: 72, y: 50 }, { x: 84, y: 47 }, { x: 102, y: 48 }],
  ];
  const out = [];
  for (const t of q) { out.push(t); out.push(t.map((p) => ({ x: W - p.x, y: p.y }))); out.push(t.map((p) => ({ x: p.x, y: H - p.y }))); out.push(t.map((p) => ({ x: W - p.x, y: H - p.y }))); }
  return out;
}

// raised rock plateau with grass cap (faceted)
function mesaGeo(o, h, R, terrain) {
  const r = o.r; const N = Math.max(10, Math.round(2 * PI * r / 1.65)); const pos = [], col = [];
  const C = (c) => new THREE.Color(c);
  const rockA = C('#6e6052'), rockB = C('#a89580'), rockC = C('#86766a'), grassA = C('#4f8f3e'), grassB = C('#69a84c'), drape = C('#3d6e32');
  const rings = []; const ph = R() * 10;
  const rad = (k, a) => r + k + Math.sin(a * 3 + ph) * 0.25;
  const defs = [[-0.35, 0.45, 0.35], [h * 0.36, 0.2, 0.55], [h * 0.72, 0.02, 0.5], [h - 0.12, 0.22, 0.25], [h + 0.05, -0.42, 0.2]];
  for (let k = 0; k < defs.length; k++) {
    const ring = [];
    for (let i = 0; i < N; i++) { const a = (i + (k % 2) * 0.35 + (R() - 0.5) * 0.3) / N * PI * 2; const rr = rad(defs[k][1], a) + (R() - 0.5) * defs[k][2] * 2;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr; let y = defs[k][0] + (k > 0 ? (R() - 0.5) * 0.3 : 0);
      if (k === 0) y = Math.min(-0.35, terrain.heightAt(o.x + x, o.y + z) - 0.4);
      ring.push([x, y, z]); }
    rings.push(ring);
  }
  const tri = (a, b, c, ca, cb, cc) => { pos.push(...a, ...b, ...c); col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b); };
  const shade = (c, m) => c.clone().multiplyScalar(m);
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k], B = rings[k + 1];
    for (let i = 0; i < N; i++) {
      const i2 = (i + 1) % N; const f = 0.86 + R() * 0.24;
      let ca, cb;
      if (k === 0) { ca = shade(rockA, 0.55 * f); cb = shade(rockC, 0.85 * f); }
      else if (k === 1) { ca = shade(rockC, 0.85 * f); cb = shade(rockB, 0.98 * f); }
      else if (k === 2) { ca = shade(rockB, 0.98 * f); cb = shade(drape, 0.9 * f); }
      else { ca = shade(drape, f); cb = shade(grassA, f); }
      tri(A[i], B[i], A[i2], ca, cb, ca); tri(A[i2], B[i], B[i2], ca, cb, cb);
    }
  }
  // cap: inner ring + centre fan
  const top = rings[rings.length - 1]; const inner = []; const nIn = Math.max(6, Math.round(N / 2));
  for (let i = 0; i < nIn; i++) { const a = (i + 0.5) / nIn * PI * 2; const rr = r * 0.55 * (0.85 + R() * 0.3); inner.push([Math.cos(a) * rr, h + 0.1 + R() * 0.2, Math.sin(a) * rr]); }
  const cen = [0, h + 0.2 + R() * 0.15, 0];
  for (let i = 0; i < N; i++) { const i2 = (i + 1) % N; const j = Math.floor(i / N * nIn) % nIn; const f = 0.9 + R() * 0.2; const g1 = shade(grassA, f), g2 = shade(grassB, f);
    tri(top[i], inner[j], top[i2], g1, g2, g1); const j2 = Math.floor(i2 / N * nIn) % nIn; if (j2 !== j) tri(top[i2], inner[j], inner[j2], g1, g2, g2); }
  for (let j = 0; j < nIn; j++) { const j2 = (j + 1) % nIn; const f = 0.9 + R() * 0.2; tri(inner[j], cen, inner[j2], shade(grassB, f), shade(grassB, f * 1.05), shade(grassB, f)); }
  // fix winding so normals face out/up: compute and flip if needed
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i], ay = pos[i + 1], az = pos[i + 2], bx = pos[i + 3], by = pos[i + 4], bz = pos[i + 5], cx = pos[i + 6], cy = pos[i + 7], cz = pos[i + 8];
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay), ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3;
    if (nx * mx + nz * mz + ny * 0.5 * r < 0) { for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; const tc = col[i + 3 + k]; col[i + 3 + k] = col[i + 6 + k]; col[i + 6 + k] = tc; } }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); g.userData.h = h;
  return g;
}

// ───────────────────────── MapView ─────────────────────────
export class MapView {
  constructor(map, quality = 'med') {
    this.map = map || {}; this.group = new THREE.Group(); this.quality = quality; this.updatables = [];
    this.decor = new THREE.Group(); this.group.add(this.decor);
    const W = this.map.width || 240, H = this.map.height || 160; this.W = W; this.H = H;
    const R = this.rand = mkRand(1337);
    const q = quality === 'high' ? 1 : quality === 'low' ? 0.35 : 0.65; this.q = q;
    // ---- terrain ----
    const aoSources = [];
    for (const t of this.map.towers || []) aoSources.push({ x: t.x, z: t.y, r: 2.6, k: 0.4 });
    for (const c of this.map.cores || []) aoSources.push({ x: c.x, z: c.y, r: 5.6, k: 0.4 });
    this.trails = makeTrails(W, H);
    this.terrain = new Terrain(this.map, { trails: this.trails, aoSources, quality });
    this.group.add(this.terrain.group); this.rp = this.terrain.rp;
    // bridges where lanes cross the stream
    this.bridges = [];
    if (this.rp) for (const l of this.terrain.lanes) { let best = null; for (const p of l.pts) { if (Math.abs(p.x - this.rp.cx) < 0.8 && (p.y < this.rp.y0 || p.y > this.rp.y1)) best = p; } if (best) this.bridges.push({ x: this.rp.cx, z: best.y, len: 12, wid: 10 }); }
    this.terrain.bridges = this.bridges;
    const T = this.terrain; const _uh = T.unitHeight.bind(T);
    T.unitHeight = (x, z) => { for (const b of this.bridges) if (Math.abs(x - b.x) < b.len / 2 + 0.5 && Math.abs(z - b.z) < b.wid / 2 + 0.5) return 0; return _uh(x, z); };
    // ---- static world batches ----
    const world = this.world = new StaticWorld(48);
    this.mats = {
      stone: makeWorldMat({ rimStrength: 0.35, roughness: 0.88 }),
      foliage: makeFoliageMat({ fade: true }),
      cover: makeFoliageMat({ double: true }),
      brush: makeFoliageMat({ brush: true, double: true }),
      glow: makeGlowMat(0xffffff, { vertexColors: true }),
    };
    world.layer('stone', { mat: this.mats.stone, shadow: true }).layer('foliage', { mat: this.mats.foliage, shadow: true, wind: true })
      .layer('cover', { mat: this.mats.cover, shadow: false, wind: true }).layer('brush', { mat: this.mats.brush, shadow: false, wind: true }).layer('glow', { mat: this.mats.glow, shadow: false, receive: false });
    this.halos = new Halos();
    this.canopy = []; this.rays = [];
    this._buildMesas(); this._buildBorderForest(); this._buildBrush(); this._buildLanes(); this._buildBases(); this._buildPits(); this._buildRiverDecor(); this._buildJungle(); this._buildCover();
    this.group.add(world.build());
    this.group.add(this.halos.build());
    // ---- water ----
    const wtr = buildWater(this.terrain); this.water = wtr; this.group.add(wtr.group);
    // ---- ambient ----
    this.ambient = new AmbientField(quality); this.group.add(this.ambient.group);
    const mist = buildMist(this.rp, quality); if (mist) { this.mist = mist; this.group.add(mist); }
    const rays = buildGodRays(this.rays, new THREE.Vector3(-0.62, 0.62, 0.48).normalize()); if (rays) { this.godRays = rays; this.group.add(rays); }
    this.tris = world.tris;
    // legacy compat
    this.ground = this.terrain.group;
  }
  heightAt(x, z) { return this.terrain.heightAt(x, z); }
  unitHeight(x, z) { return this.terrain.unitHeight(x, z); }
  laneDist(x, y) { return this.terrain.laneDist(x, y); }
  inMesa(x, y, m = 0) { for (const o of this.map.obstacles || []) if (o.type !== 'rect' && Math.hypot(x - o.x, y - o.y) < o.r + m) return true; return false; }
  blockedDecor(x, y, margin = 1) {
    if (this.terrain.outside(x, y) > 0) return true;
    if (this.laneDist(x, y) < 5.6 + margin) return true;
    if (this.rp && riverSdf(this.rp, x, y) < 1.8 + margin) return true;
    for (const b of this.map.bases || []) if (Math.hypot(x - b.x, y - b.y) < (b.r ?? 24) * 0.9 + margin) return true;
    if (this.inMesa(x, y, margin)) return true;
    for (const b of this.map.brush || []) if (Math.hypot(x - b.x, y - b.y) < b.r + 0.6 + margin) return true;
    const pits = this.map.pits || {}; for (const k in pits) { const p = pits[k]; if (Math.hypot(x - p.x, y - p.y) < p.r + 3 + margin) return true; }
    for (const c of this.map.camps || []) if (Math.hypot(x - c.x, y - c.y) < 5 + margin) return true;
    for (const t of this.map.towers || []) if (Math.hypot(x - t.x, y - t.y) < 4.2 + margin) return true;
    return false;
  }

  _treeAt(x, z, y, s, kind) {
    const R = this.rand; const V = this._treeVars || (this._treeVars = {
      broad: [0, 1, 2, 3].map(() => PREFAB.broadTree(R)), broadW: [0, 1].map(() => PREFAB.broadTree(R, -0.05)),
      pine: [0, 1, 2].map(() => PREFAB.pineTree(R)), blossom: [0, 1].map(() => PREFAB.blossomTree(R)), autumn: [0, 1].map(() => PREFAB.autumnTree(R)),
      broadL: [0, 1, 2, 3].map(() => PREFAB.broadTree(R, (R() - 0.5) * 0.06, true)), autumnL: [0, 1].map(() => PREFAB.autumnTree(R, true)),
    });
    const list = V[kind] || V.broad; const geo = list[Math.floor(R() * list.length)];
    this.world.add('foliage', geo, x, y, z, { ry: R() * PI * 2, s, wind: 0.16, windPow: 2, phase: R() * 10 });
  }
  _buildMesas() {
    const R = this.rand, T = this.terrain; this.mesas = [];
    for (const o of this.map.obstacles || []) {
      if (o.type === 'rect') continue;
      const big = o.r >= 10; const inRiver = this.rp && riverSdf(this.rp, o.x, o.y) < 0;
      const h = big ? 5.2 : inRiver ? 3.0 : Math.min(4.3, 3.0 + o.r * 0.17) + R() * 0.35;
      this.world.add('stone', mesaGeo(o, h, R, T), o.x, 0, o.y);
      this.mesas.push({ ...o, h });
      this.canopy.push({ x: o.x, z: o.y, r: o.r });
      // trees on top
      const sp = big ? 2.8 : 2.0; const rr = o.r - (big ? 1.6 : 1.3);
      for (let y = o.y - rr; y <= o.y + rr; y += sp) for (let x = o.x - rr; x <= o.x + rr; x += sp) {
        const jx = x + (R() - 0.5) * sp * 0.7, jy = y + (R() - 0.5) * sp * 0.7; if (Math.hypot(jx - o.x, jy - o.y) > rr) continue;
        if (jx < -PAD + 4 || jy < -PAD + 4 || jx > this.W + PAD - 4 || jy > this.H + PAD - 4) continue;
        if (big && T.outside(jx, jy) > 14 && R() < 0.5) continue;
        const kind = inRiver ? (R() < 0.5 ? 'blossom' : 'broad') : big ? (R() < 0.1 ? 'autumnL' : R() < 0.3 ? 'pine' : 'broadL') : R() < 0.12 ? 'autumn' : R() < 0.22 ? 'pine' : 'broad';
        this._treeAt(jx, jy, h + 0.15, (big ? 0.85 : 0.62) + R() * 0.22, kind);
      }
      if (!big) { // rocks & bushes on top, filling the cap rim
        const nb = Math.round(o.r * 2.2); for (let i = 0; i < nb; i++) { const a = i / nb * PI * 2 + R() * 0.4, d = o.r - 0.9 - R() * 0.8; this.world.add('foliage', this._var('bush', () => PREFAB.bush(R)), o.x + Math.cos(a) * d, h + 0.05, o.y + Math.sin(a) * d, { ry: R() * 6, s: 0.8 + R() * 0.5, wind: 0.1, phase: R() * 9 }); }
        for (let i = 0; i < 2; i++) { const a = R() * PI * 2, d = R() * o.r * 0.5; this.world.add('stone', PREFAB.rock(R, 0.6 + R() * 0.4), o.x + Math.cos(a) * d, h + 0.2, o.y + Math.sin(a) * d, { ry: R() * 6 }); }
      }
      // bushes & ferns hugging the cliff base
      const n = Math.round(o.r * 2.2 * (0.6 + this.q * 0.4));
      for (let i = 0; i < n; i++) { const a = R() * PI * 2; const d = o.r + 0.3 + R() * 0.6; const x = o.x + Math.cos(a) * d, z = o.y + Math.sin(a) * d;
        if (T.outside(x, z) > 2) continue; if (this.rp && riverSdf(this.rp, x, z) < 0.5) continue; if (this.laneDist(x, z) < 4.5) continue;
        const y = Math.max(0, T.heightAt(x, z));
        if (R() < 0.55) this.world.add('cover', this._var('bush', () => PREFAB.bush(R)), x, y, z, { ry: R() * 6, s: 0.7 + R() * 0.4, wind: 0.12, phase: R() * 9 });
        else this.world.add('cover', this._var('fern', () => PREFAB.fern(R)), x, y, z, { ry: R() * 6, s: 0.8 + R() * 0.4, wind: 0.3, phase: R() * 9 }); }
      // boulders at the foot
      for (let i = 0; i < Math.round(o.r * 0.5); i++) { const a = R() * PI * 2; const d = o.r + 0.1; const x = o.x + Math.cos(a) * d, z = o.y + Math.sin(a) * d; if (T.outside(x, z) > 2) continue;
        this.world.add('stone', this._var('rockM', () => PREFAB.rock(R, 0.8)), x, T.heightAt(x, z) + 0.1, z, { ry: R() * 6, s: 0.6 + R() * 0.7 }); }
    }
  }
  _var(key, fn, n = 4) { const V = this._vars || (this._vars = {}); const list = V[key] || (V[key] = []); if (list.length < n) { const g = fn(); list.push(g); return g; } return list[Math.floor(this.rand() * list.length)]; }
  _buildBorderForest() {
    const R = this.rand, T = this.terrain; const W = this.W, H = this.H;
    for (let z = -PAD + 3; z < H + PAD - 3; z += 3.0) for (let x = -PAD + 3; x < W + PAD - 3; x += 3.0) {
      const jx = x + (R() - 0.5) * 2.4, jz = z + (R() - 0.5) * 2.4; const out = T.outside(jx, jz); if (out < 1.6) continue;
      if (this.rp && riverSdf(this.rp, jx, jz) < 2.5) continue;
      if (this.inMesa(jx, jz, -1)) continue;
      // fountain gates need room
      let near = false; for (const f of this.map.fountains || []) if (Math.abs(jz - f.y) < 11 && Math.abs(jx - (f.x + (f.team === 0 ? -9.5 : 9.5))) < 5) near = true; if (near) continue;
      const far = out > 16; if (far && R() < 0.7) continue; if (!far && out > 8 && R() < 0.4) continue;
      const clearing = fbm(jx * 0.05, jz * 0.05); if (clearing < 0.32 && out > 4) continue;
      const y = T.heightAt(jx, jz);
      const kind = out > 6 && R() < 0.45 ? 'pine' : R() < 0.07 ? 'autumnL' : out < 5 && R() < 0.06 ? 'blossom' : 'broadL';
      this._treeAt(jx, jz, y - 0.1, 0.95 + R() * 0.55 + Math.min(0.4, out * 0.02), kind);
    }
    this.canopy.push({ x: -10, z: 80, r: 12 }); // border fringe handled by outside() in fog canopy below
  }
  _buildBrush() {
    const R = this.rand; const br = this.map.brush || [];
    const blades = [0, 1, 2, 3, 4, 5].map((i) => { const h = 1.35 + i * 0.14; const g = new THREE.BufferGeometry(); const w = 0.17;
      g.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, w * 0.55, h * 0.55, 0.12, -w, 0, 0, w * 0.55, h * 0.55, 0.12, -w * 0.45, h * 0.55, 0.12, -w * 0.45, h * 0.55, 0.12, w * 0.55, h * 0.55, 0.12, 0.05, h, 0.45], 3));
      return merge([P(g, '#2b7a4e', { grad: [0.5, 1.2], top: '#a6e88a', fj: 0.1 })]); });
    br.forEach((b, bi) => {
      const n = Math.round(PI * b.r * b.r * (14 + 8 * this.q));
      for (let i = 0; i < n; i++) { const a = R() * PI * 2, rr = Math.sqrt(R()) * (b.r + 0.4); const x = b.x + Math.cos(a) * rr, z = b.y + Math.sin(a) * rr;
        const edge = rr / (b.r + 0.4); const s = 1.05 - edge * 0.35 + R() * 0.25;
        this.world.add('brush', blades[Math.floor(R() * blades.length)], x, 0, z, { ry: R() * PI * 2, s, sy: s * (0.85 + R() * 0.3), wind: 0.32, windPow: 1.5, phase: R() * 6, brush: bi, rx: (R() - 0.5) * 0.3 }); }
      // a few flowers poking out
      for (let i = 0; i < 4; i++) { const a = R() * PI * 2; this.world.add('cover', this._var('flowers', () => PREFAB.flowers(R), 6), b.x + Math.cos(a) * (b.r + 0.6), 0, b.y + Math.sin(a) * (b.r + 0.6), { wind: 0.3, phase: R() * 6 }); }
    });
  }
  _buildLanes() {
    const R = this.rand, T = this.terrain; const stone = PREFAB.edgeStone(R), stone2 = PREFAB.edgeStone(R);
    const post = PREFAB.lanternPost(), lglow = PREFAB.lanternGlow();
    const okEdge = (x, z) => !(T.outside(x, z) > 0.5 || (this.rp && riverSdf(this.rp, x, z) < 1.2) || this.inMesa(x, z, 0.4) || (this.map.bases || []).some((b) => Math.hypot(x - b.x, z - b.y) < (b.r ?? 24) * 0.9) || (this.map.towers || []).some((t) => Math.hypot(x - t.x, z - t.y) < 4.5));
    for (const l of T.lanes) {
      const pts = l.pts; let acc = 0, lantAcc = 9, side = 1;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i]; const dx = b.x - a.x, dz = b.y - a.y; const len = Math.hypot(dx, dz); if (len < 1e-3) continue; const nx = -dz / len, nz = dx / len;
        acc += len; lantAcc += len;
        while (acc > 1.7) { acc -= 1.7; const t = 1 - acc / len; const cx = a.x + dx * t, cz = a.y + dz * t;
          for (const s of [-1, 1]) { if (R() < 0.3) continue; const off = 5.0 + R() * 0.7; const x = cx + nx * off * s, z = cz + nz * off * s; if (!okEdge(x, z)) continue;
            this.world.add('stone', R() < 0.5 ? stone : stone2, x, 0.02, z, { ry: R() * 6, s: 0.8 + R() * 0.6 }); } }
        if (lantAcc > 24) { const x = b.x + nx * 6.6 * side, z = b.y + nz * 6.6 * side; if (okEdge(x, z) && !this.inMesa(x, z, 1.5)) { lantAcc = 0; const ry = Math.atan2(-nz * side, nx * side);
          this.world.add('stone', post, x, 0, z, { ry: -ry + PI }); this.world.add('glow', lglow, x, 0, z, { ry: -ry + PI });
          const lx = x + Math.cos(-ry + PI) * 0.7 * 1, lz = z - Math.sin(-ry + PI) * 0.7; this.halos.add(lx, 1.99, lz, '#ffb24a', 2.6, 0.25); side = -side; } }
      }
    }
    // bridges
    for (const b of this.bridges) { buildBridge(this.world, b.x, b.z, b.len, b.wid, R); for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.halos.add(b.x + sx * (b.len / 2 + 0.3) + (sx > 0 ? -0.7 : 0.7), 1.99, b.z + sz * (b.wid / 2 + 0.3), '#ffb24a', 2.6, 0.25); }
    // tower banners flanking each tower
    const pole = PREFAB.bannerPole(); const cloth = [PREFAB.bannerCloth(teamColor(0)), PREFAB.bannerCloth(teamColor(1))];
    for (const t of this.map.towers || []) {
      let bx = 1, bz = 0; let best = 1e9; for (const l of T.lanes) for (let i = 0; i < l.pts.length - 1; i++) { const d = distSeg(t.x, t.y, l.pts[i].x, l.pts[i].y, l.pts[i + 1].x, l.pts[i + 1].y); if (d < best) { best = d; const dx = l.pts[i + 1].x - l.pts[i].x, dz = l.pts[i + 1].y - l.pts[i].y; const L = Math.hypot(dx, dz) || 1; bx = dx / L; bz = dz / L; } }
      if (t.tier === 'base') { bx = 0; bz = 1; }
      for (const s of [-1, 1]) { const x = t.x - bz * 7.0 * s + bx * 2.5, z = t.y + bx * 7.0 * s + bz * 2.5; if (this.inMesa(x, z, 0.5) || T.outside(x, z) > 0) continue;
        const ry = Math.atan2(bz, bx); this.world.add('stone', pole, x, 0, z, { ry: -ry }); this.world.add('cover', cloth[t.team] || cloth[0], x, 0, z, { ry: -ry, wind: 0.45, windPow: 1, phase: x }); }
    }
  }
  _buildBases() {
    const R = this.rand, T = this.terrain; this.fountainFx = []; this.dyn = [];
    for (const f of this.map.fountains || []) {
      const F = buildFountain(this.world, T, f, R); this.group.add(F.group); this.dyn.push(F);
      const tc = teamColor(f.team); const side = f.team === 0 ? 1 : -1;
      for (const a0 of [-1.1, -0.55, 0, 0.55, 1.1]) { const a = (f.team === 0 ? 0 : PI) + a0; this.halos.add(f.x + Math.cos(a) * 9.8, 3.3, f.y + Math.sin(a) * 9.8, TEAM_TRIM[f.team], 3.4, 0.3); }
      // healing pool
      const pool = new THREE.Mesh(new THREE.CircleGeometry(5.8, 40).rotateX(-PI / 2), makeWaterMat('disc', { cx: f.x, cz: f.y, r: 5.7, deep: new THREE.Color(tc).multiplyScalar(0.45), shallow: new THREE.Color(tc).lerp(new THREE.Color(1, 1, 1), 0.35), alpha: 0.85, glow: 0.6 }));
      pool.position.set(f.x, 0.04, f.y); pool.renderOrder = 2; this.group.add(pool); pool.material.uniforms.uA.value.x = f.x;
      this.updatables.push((t) => { pool.material.uniforms.uTime.value = t; F.rune.rotation.y = t * 0.08 * side; F.crystal.position.y = F.gemY + Math.sin(t * 1.2) * 0.4; F.crystal.rotation.y = t * 0.5; });
      this.fountainFx.push({ x: f.x, y: f.y, color: tc });
      // banners around the base rim facing the jungle
      const b = (this.map.bases || []).find((q) => q.team === f.team);
      if (b) { const pole = PREFAB.bannerPole(), cloth = PREFAB.bannerCloth(tc); const r = (b.r ?? 24) * 0.93;
        for (const a0 of [-0.95, -0.6, -0.25, 0.25, 0.6, 0.95]) { const a = (f.team === 0 ? 0 : PI) + a0; const x = b.x + Math.cos(a) * r, z = b.y + Math.sin(a) * r; if (this.laneDist(x, z) < 6 || this.inMesa(x, z, 0.5)) continue;
          this.world.add('stone', pole, x, 0, z, { ry: -a }); this.world.add('cover', cloth, x, 0, z, { ry: -a, wind: 0.45, windPow: 1, phase: a * 3 }); } }
    }
    // core plaza runes are on the core model; lanterns ring around core
  }
  _buildPits() {
    const R = this.rand; this.pitGlow = {}; const pits = this.map.pits || {};
    for (const k in pits) {
      const p = pits[k]; const col = k === 'wyrm' ? ELEMENT_COLORS.none : '#c07aff';
      const D = buildPit(this.world, k, p, R, col); this.group.add(D.group);
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(p.r * 2.4, p.r * 2.4).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture(), color: col, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      inner.position.set(p.x, 0.05, p.y); inner.renderOrder = 4; this.group.add(inner);
      this.pitGlow[k] = { ring: D.rune, inner, p, color: new THREE.Color(col) };
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + 0.4; this.halos.add(p.x + Math.cos(a) * (p.r + 1.2), 0.9, p.y + Math.sin(a) * (p.r + 1.2), col, 2.4, 0.3); }
      this.rays.push({ x: p.x - 3, z: p.y + 2, len: 20, w: 4 });
    }
  }
  _buildRiverDecor() {
    const rp = this.rp; if (!rp) return; const R = this.rand, T = this.terrain;
    const pad = merge([P(new THREE.CylinderGeometry(1, 1, 0.05, 9, 1, false, 0.4, PI * 1.8), '#5d9a45', { grad: [0.9, 1.1], fj: 0.1 })]);
    const flower = merge([P(new THREE.OctahedronGeometry(0.22), '#ffb8d8', { s: [1, 0.6, 1] }), P(new THREE.OctahedronGeometry(0.08), '#ffe066', { p: [0, 0.08, 0] })]);
    for (let i = 0; i < 70; i++) { const z = rp.y0 + 2 + R() * (rp.y1 - rp.y0 - 4), x = rp.cx + (R() - 0.5) * rp.w * 2.2; const d = riverSdf(rp, x, z); if (d > -1.2 || d < -4.5) continue;
      if ((rp.islands || []).some((o) => Math.hypot(x - o.x, z - o.y) < o.r + 2)) continue;
      const s = 0.5 + R() * 0.6; this.world.add('cover', pad, x, -0.23, z, { ry: R() * 6, s, wind: 0.05, windPow: 0, phase: R() * 9 });
      if (R() < 0.25) this.world.add('cover', flower, x + 0.2, -0.2, z, { wind: 0.05, windPow: 0, phase: R() * 9 }); }
    // reeds / cattails along the banks
    const reed = merge([0, 1, 2, 3, 4].map((i) => P(new THREE.CylinderGeometry(0.03, 0.05, 1.6 + i * 0.2, 3), '#5a8a3a', { p: [Math.cos(i * 1.3) * 0.2, (1.6 + i * 0.2) / 2, Math.sin(i * 1.3) * 0.2], r: [Math.sin(i) * 0.15, 0, Math.cos(i) * 0.15], grad: [0.6, 1.1], top: '#a8c860' })).concat([P(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 5), '#7a4a2a', { p: [0.2, 1.75, 0.05] })]));
    for (let i = 0; i < 160; i++) { const z = -10 + R() * (this.H + 20), x = rp.cx + (R() - 0.5) * (rp.w * 2 + 10); const d = riverSdf(rp, x, z); if (d < -0.8 || d > 0.6) continue;
      if (this.laneDist(x, z) < 6 || this.bridges.some((b) => Math.abs(z - b.z) < b.wid / 2 + 1)) continue;
      this.world.add('cover', reed, x, T.heightAt(x, z), z, { ry: R() * 6, s: 0.7 + R() * 0.5, wind: 0.35, phase: R() * 9 }); }
    // rocks in the water (foam handled by the shader near banks)
    for (let i = 0; i < 26; i++) { const z = rp.y0 + R() * (rp.y1 - rp.y0), x = rp.cx + (R() - 0.5) * rp.w * 2.4; const d = riverSdf(rp, x, z); if (d > -0.3 || d < -2.2) continue;
      this.world.add('stone', this._var('rockR', () => PREFAB.rock(R, 0.7, '#8d8a80')), x, -0.45, z, { ry: R() * 6, s: 0.6 + R() * 0.8 }); }
    // waterfall splash + mist glows at the bottom
    this.fallFx = { x: rp.cx, z: 2.6 };
  }
  _buildJungle() {
    const R = this.rand, T = this.terrain;
    // camps: stones, crystal, mushrooms around the clearing
    for (const c of this.map.camps || []) {
      for (let i = 0; i < 5; i++) { const a = R() * PI * 2, d = 6.2 + R() * 1.2; const x = c.x + Math.cos(a) * d, z = c.y + Math.sin(a) * d; if (this.blockedDecor(x, z, -0.5) && !this.inMesa(x, z, 2)) continue;
        if (R() < 0.5) this.world.add('stone', this._var('rockS', () => PREFAB.rock(R, 0.5)), x, 0.05, z, { ry: R() * 6, s: 0.6 + R() * 0.6 });
        else { this.world.add('cover', this._var('shroomG', () => PREFAB.mushroom(R, true)), x, 0, z, { ry: R() * 6, s: 1 + R() * 0.4 }); this.halos.add(x, 0.45, z, R() < 0.5 ? '#7af0ff' : '#d08aff', 1.4, 0.15); } }
      this.rays.push({ x: c.x + 2, z: c.y - 1, len: 18, w: 3.2 });
    }
    // ruins: arches/columns on a few mesa tops + slabs at their feet
    const arch = PREFAB.arch(R), col = PREFAB.column(R, 2.8, true), slab = PREFAB.slab(R);
    const small = (this.mesas || []).filter((o) => o.r < 10 && !(this.rp && riverSdf(this.rp, o.x, o.y) < 0));
    small.forEach((o, i) => {
      if (i % 3 === 0) this.world.add('stone', arch, o.x + 0.5, o.h + 0.2, o.y, { ry: R() * 3, s: 0.8 });
      else if (i % 3 === 1) this.world.add('stone', col, o.x - 0.8, o.h + 0.2, o.y + 0.5, { ry: R() * 3 });
      const a = R() * PI * 2; const x = o.x + Math.cos(a) * (o.r + 0.9), z = o.y + Math.sin(a) * (o.r + 0.9);
      if (!this.blockedDecor(x, z, -0.9) || this.inMesa(x, z, 1.2)) this.world.add('stone', slab, x, 0.1, z, { ry: R() * 6, s: 0.7 });
      // crystals at the foot of every third jungle wall
      if (i % 2 === 0) { const a2 = a + 2; const cx = o.x + Math.cos(a2) * (o.r + 0.5), cz = o.y + Math.sin(a2) * (o.r + 0.5); if (this.laneDist(cx, cz) > 6 && T.outside(cx, cz) === 0) { const cc = i % 4 === 0 ? '#7ad8ff' : '#b78aff'; this.world.add('glow', this._var('crys' + cc, () => PREFAB.crystal(R, cc), 3), cx, 0, cz, { ry: R() * 6, s: 0.8 + R() * 0.4 }); this.halos.add(cx, 0.9, cz, cc, 3.2, 0.12); } }
      if (i % 2 === 1) this.rays.push({ x: o.x + o.r + 2, z: o.y + 2, len: 16, w: 2.6 });
    });
  }
  _buildCover() {
    const R = this.rand, T = this.terrain; const W = this.W, H = this.H; const q = this.q;
    const nT = Math.round(8000 * q);
    let guard = 0, n = 0;
    while (n < nT && guard++ < nT * 4) {
      // clumps: a centre + neighbours, denser along lane borders and wall feet
      const cx = R() * W, cz = R() * H; const ld = this.laneDist(cx, cz);
      const edge = ld > 5.5 && ld < 8.5; const k = edge ? 7 : 3 + Math.floor(R() * 5);
      if (!edge && fbm(cx * 0.08, cz * 0.08) < 0.42) continue;
      for (let j = 0; j < k; j++) { const x = cx + (R() - 0.5) * 2.2, z = cz + (R() - 0.5) * 2.2; if (this.blockedDecor(x, z, 0.2)) continue;
        n++; this.world.add('cover', this._var('tuft', () => PREFAB.tuft(R, R() < 0.15 ? 1 : 0), 6), x, 0, z, { ry: R() * 6, s: 0.7 + R() * 0.7, wind: 0.35, windPow: 1.3, phase: R() * 9 }); }
    }
    // meadow flower patches
    for (let i = 0; i < Math.round(110 * q); i++) { const cx = R() * W, cz = R() * H; if (this.blockedDecor(cx, cz, 0.8)) continue; const k = 2 + Math.floor(R() * 4);
      for (let j = 0; j < k; j++) { const x = cx + (R() - 0.5) * 3, z = cz + (R() - 0.5) * 3; if (this.blockedDecor(x, z, 0.3)) continue; this.world.add('cover', this._var('flowers', () => PREFAB.flowers(R), 6), x, 0, z, { ry: R() * 6, s: 0.9 + R() * 0.4, wind: 0.3, phase: R() * 9 }); } }
    // pebbles / small rocks
    for (let i = 0; i < Math.round(260 * q); i++) { const x = R() * W, z = R() * H; if (this.blockedDecor(x, z, 0)) continue; this.world.add('stone', this._var('peb', () => PREFAB.rock(R, 0.3)), x, 0.02, z, { ry: R() * 6, s: 0.5 + R() * 0.8 }); }
    // ordinary mushrooms near walls
    for (const o of this.mesas || []) { if (o.r >= 10) continue; for (let i = 0; i < 2; i++) { const a = R() * PI * 2, d = o.r + 0.9 + R(); const x = o.x + Math.cos(a) * d, z = o.y + Math.sin(a) * d; if (this.blockedDecor(x, z, -0.8) && !this.inMesa(x, z, 2.2)) continue; this.world.add('cover', this._var('shroom', () => PREFAB.mushroom(R, false)), x, 0, z, { ry: R() * 6, s: 0.9 + R() * 0.5 }); } }
    // grass on the border hills (cheap, near the play area only)
    for (let i = 0; i < Math.round(1600 * q); i++) { const x = -18 + R() * (W + 36), z = -18 + R() * (H + 36); const out = T.outside(x, z); if (out < 0.8 || out > 14) continue; if (this.rp && riverSdf(this.rp, x, z) < 1) continue;
      const y = T.heightAt(x, z); this.world.add('cover', this._var('tuft', () => PREFAB.tuft(R)), x, y - 0.05, z, { ry: R() * 6, s: 1 + R() * 0.8, wind: 0.35, phase: R() * 9 }); }
  }

  setQuality(q) { this.quality = q; }
  get canopyList() {
    const out = this.canopy.slice();
    // edge forest: everything outside the walkable rectangle counts as canopy
    for (let x = 0; x <= this.W; x += 8) { out.push({ x, z: -4, r: 6 }); out.push({ x, z: this.H + 4, r: 6 }); }
    for (let z = 0; z <= this.H; z += 8) { out.push({ x: -4, z, r: 6 }); out.push({ x: this.W + 4, z, r: 6 }); }
    return out;
  }

  update(time, dt, match, vfx, ctx = {}) {
    for (const f of this.updatables) f(time);
    const wy = match?.objectives?.wyrm;
    if (this.pitGlow?.wyrm) {
      const el = wy ? (wy.alive ? wy.element : wy.nextElement) || wy.element : null;
      const tgt = new THREE.Color(ELEMENT_COLORS[el] || ELEMENT_COLORS.none);
      const g = this.pitGlow.wyrm; g.color.lerp(tgt, Math.min(1, dt * 2));
      g.ring.material.color.copy(g.color); g.inner.material.color.copy(g.color);
      const pulse = 0.5 + 0.2 * Math.sin(time * 2); g.ring.material.opacity = (wy?.alive ? 0.85 : 0.45) * pulse + 0.2; g.inner.material.opacity = (wy?.alive ? 0.4 : 0.18) * pulse;
      g.ring.rotation.y = time * 0.05;
      if (vfx && wy?.alive && ctx.near?.(g.p.x, g.p.y) && Math.random() < dt * 8) { const a = Math.random() * PI * 2, r = Math.random() * g.p.r; vfx.trail(g.p.x + Math.cos(a) * r, 0.3, g.p.y + Math.sin(a) * r, '#' + g.color.getHexString(), { vy: 1.5, life: 1.4, size: 0.5, style: 'embers' }); }
    }
    if (this.pitGlow?.colossus) { const g = this.pitGlow.colossus; const al = match?.objectives?.colossus?.alive; g.ring.material.opacity = (al ? 0.8 : 0.4) * (0.6 + 0.3 * Math.sin(time * 1.4)); g.inner.material.opacity = al ? 0.35 : 0.14; g.ring.rotation.y = -time * 0.04; }
    if (vfx && this.fountainFx) for (const f of this.fountainFx) if (ctx.near?.(f.x, f.y) && Math.random() < dt * 10) { const a = Math.random() * PI * 2, r = Math.random() * 5; vfx.trail(f.x + Math.cos(a) * r, 0.2, f.y + Math.sin(a) * r, f.color, { vy: 2.5, life: 1.3, size: 0.5, style: 'stars', shape: 2 }); }
    if (vfx && this.fallFx && ctx.near?.(this.fallFx.x, this.fallFx.z) && Math.random() < dt * 14) { const x = this.fallFx.x + (Math.random() - 0.5) * 7; vfx.norm?.emit?.({ x, y: 0, z: this.fallFx.z + Math.random(), vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 2, vz: 1 + Math.random() * 2, life: 0.9, size: 1.4, size1: 3, color: '#f0fbff', alpha: 0.45, drag: 1.5, grav: 2 }); }
  }
  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map && m.map !== glowTexture() && !m.map.isDataTexture) { /* shared canvas textures are cached */ } m.dispose(); }); } });
    this.terrain.dispose();
  }
}

export { FOLIAGE_U, WORLD };
