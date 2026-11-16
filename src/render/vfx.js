// Pooled VFX (HEROES lead): GPU point particles (additive + normal, incl. velocity-stretched streaks,
// coins, smoke), soft & spiky sprites, ground decals, beams, pillars, crescent slashes, floating text.
// API kept from v0.2 (ring/disc/flash/pillar/beam/slash/cone/bubble/spikes/dome/arc/tether/follow/icon/
// burst/trail/text + add/norm particle pools) and extended with impact/muzzleFlash/castSpark/coinPop/
// killBurst/shockwave/telegraph/crack/debris.
import * as THREE from 'three';
import { ringTexture, thinRingTexture, glowTexture, clamp, ease, lerp } from './util.js';
import { registerVfx } from './fx/registry.js';

const PI = Math.PI;
const HDR = 1.7; // additive VFX colours are pushed above 1.0 so WORLD's bloom (threshold ~1) catches them
const _c = new THREE.Color(), _c2 = new THREE.Color();

// ───────────────────────────── textures ─────────────────────────────
const TEX = {};
function canvasTex(key, size, draw) {
  if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; TEX[key] = t; return t;
}
export function spikeTexture() { // juicy impact star
  return canvasTex('spike', 128, (g, N) => {
    const c = N / 2; g.translate(c, c);
    const rad = g.createRadialGradient(0, 0, 0, 0, 0, c); rad.addColorStop(0, 'rgba(255,255,255,1)'); rad.addColorStop(0.18, 'rgba(255,255,255,0.9)'); rad.addColorStop(0.4, 'rgba(255,255,255,0.15)'); rad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rad; g.beginPath(); g.arc(0, 0, c, 0, PI * 2); g.fill();
    const n = 8; g.fillStyle = '#fff';
    for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2 + (i % 2) * 0.2; const L = (i % 2 ? 0.62 : 0.98) * c; const w = (i % 2 ? 0.07 : 0.1) * c; g.save(); g.rotate(a); g.beginPath(); g.moveTo(0, -w); g.lineTo(L, 0); g.lineTo(0, w); g.closePath(); g.fill(); g.restore(); }
  });
}
export function crackTexture() { // ground crack decal (alpha)
  return canvasTex('crack', 256, (g, N) => {
    const c = N / 2; g.translate(c, c); g.strokeStyle = 'rgba(255,255,255,1)'; g.lineCap = 'round';
    let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 9; i++) { let a = (i / 9) * PI * 2 + rnd() * 0.5, r = c * 0.12, x = Math.cos(a) * r, y = Math.sin(a) * r; g.lineWidth = 7; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { a += (rnd() - 0.5) * 0.7; r += c * (0.1 + rnd() * 0.08); x = Math.cos(a) * r; y = Math.sin(a) * r; g.lineWidth = Math.max(1.5, 7 - k * 1.1); g.lineTo(x, y); }
      g.stroke(); }
    const rad = g.createRadialGradient(0, 0, 0, 0, 0, c * 0.3); rad.addColorStop(0, 'rgba(255,255,255,0.9)'); rad.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rad; g.beginPath(); g.arc(0, 0, c * 0.3, 0, PI * 2); g.fill();
  });
}
export function telegraphTexture() { // filled disc with bold edge + inner hatch ring
  return canvasTex('teleg', 256, (g, N) => {
    const c = N / 2; const rad = g.createRadialGradient(c, c, 0, c, c, c); rad.addColorStop(0, 'rgba(255,255,255,0.10)'); rad.addColorStop(0.82, 'rgba(255,255,255,0.28)'); rad.addColorStop(0.9, 'rgba(255,255,255,0.55)'); rad.addColorStop(0.94, 'rgba(255,255,255,1)'); rad.addColorStop(0.985, 'rgba(255,255,255,1)'); rad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rad; g.fillRect(0, 0, N, N);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; for (let i = 0; i < 24; i++) { const a = (i / 24) * PI * 2; g.beginPath(); g.moveTo(c + Math.cos(a) * c * 0.78, c + Math.sin(a) * c * 0.78); g.lineTo(c + Math.cos(a + 0.12) * c * 0.86, c + Math.sin(a + 0.12) * c * 0.86); g.stroke(); }
  });
}

// ───────────────────────────── particles ─────────────────────────────
// shapes: 0 soft dot, 1 square chip, 2 sparkle cross, 3 bubble ring, 4 velocity streak, 5 coin, 6 smoke puff
export class Particles {
  constructor(scene, cap, additive = true) {
    this.cap = cap; this.cursor = 0; this.additive = additive;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4); this.size = new Float32Array(cap); this.shape = new Float32Array(cap); this.vel = new Float32Array(cap * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('shape', new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('vel', new THREE.BufferAttribute(this.vel, 3).setUsage(THREE.DynamicDrawUsage));
    this.v = this.vel; this.life = new Float32Array(cap); this.max = new Float32Array(cap);
    this.s0 = new Float32Array(cap); this.s1 = new Float32Array(cap); this.c0 = new Float32Array(cap * 3); this.c1 = new Float32Array(cap * 3);
    this.a0 = new Float32Array(cap); this.grav = new Float32Array(cap); this.drag = new Float32Array(cap); this.swirl = new Float32Array(cap * 3); this.flick = new Float32Array(cap); this.bounce = new Uint8Array(cap);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: `attribute float size; attribute vec4 pcolor; attribute float shape; attribute vec3 vel; varying vec4 vC; varying float vS; varying vec2 vDir; varying float vStretch; uniform float uScale;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); float ps = size * uScale / max(0.1,-mv.z);
          vS = shape; vC = pcolor; vDir = vec2(1.0,0.0); vStretch = 1.0;
          if (shape > 3.5 && shape < 4.5) { vec4 a = projectionMatrix * mv; vec4 b = projectionMatrix * (modelViewMatrix * vec4(position + vel * 0.06, 1.0));
            vec2 d = (b.xy / b.w - a.xy / a.w); float L = length(d) * 0.5 * uScale * 1.2; vDir = L > 0.0001 ? normalize(d) : vec2(1.0,0.0); vStretch = clamp(L / max(ps,0.5) * 3.0 + 1.0, 1.0, 6.0); ps *= vStretch; }
          gl_PointSize = ps; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vC; varying float vS; varying vec2 vDir; varying float vStretch;
        void main(){ vec2 p = gl_PointCoord*2.0-1.0; p.y = -p.y; float a; vec3 col = vC.rgb;
          if (vS < 0.5) { float d = length(p); a = smoothstep(1.0, 0.0, d); a *= a; }
          else if (vS < 1.5) { a = step(abs(p.x),0.62)*step(abs(p.y),0.62); }
          else if (vS < 2.5) { float cx = smoothstep(0.22,0.0,abs(p.x))*(1.0-abs(p.y)); float cy = smoothstep(0.22,0.0,abs(p.y))*(1.0-abs(p.x)); a = max(cx,cy) + smoothstep(0.5,0.0,length(p))*0.6; }
          else if (vS < 3.5) { float d = length(p); a = smoothstep(1.0,0.75,d) * (0.35 + smoothstep(0.55,0.95,d)); }
          else if (vS < 4.5) { vec2 q = vec2(dot(p, vDir), dot(p, vec2(-vDir.y, vDir.x))); q.y *= vStretch; float d = length(q); a = smoothstep(1.0, 0.0, d); a = pow(a, 1.5) * 1.6; col = mix(col, vec3(1.0), smoothstep(0.5, 0.0, d) * 0.7); }
          else if (vS < 5.5) { float d = length(p); a = smoothstep(1.0, 0.85, d); float rim = smoothstep(0.6, 0.85, d); col = col * (1.0 - rim * 0.45) + vec3(0.25) * smoothstep(0.3, 0.0, length(p - vec2(-0.3, 0.3))); }
          else { float d = length(p); a = smoothstep(1.0, 0.2, d) * 0.85; col *= 0.85 + 0.25 * (p.y * 0.5 + 0.5); }
          a *= vC.a; if (a < 0.01) discard;
          ${additive ? 'gl_FragColor = vec4(col * a * 1.8, a);' : 'gl_FragColor = vec4(col, a);'} }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 20 : 10;
    scene.add(this.points); this.geo = g; this.active = 0; this.hi = 0;
  }
  // o: {x,y,z, vx,vy,vz, life, size, size1, color, color1, alpha, grav, drag, shape, swirl:[cx,cz,rate], flicker, bounce}
  emit(o) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.cap; if (i + 1 > this.hi) this.hi = i + 1;
    const i3 = i * 3;
    this.pos[i3] = o.x; this.pos[i3 + 1] = o.y; this.pos[i3 + 2] = o.z;
    this.v[i3] = o.vx || 0; this.v[i3 + 1] = o.vy || 0; this.v[i3 + 2] = o.vz || 0;
    this.life[i] = o.life || 1; this.max[i] = o.life || 1;
    this.s0[i] = o.size ?? 0.5; this.s1[i] = o.size1 ?? (o.size ?? 0.5) * 0.2;
    _c.set(o.color ?? 0xffffff); _c2.set(o.color1 ?? o.color ?? 0xffffff);
    this.c0[i3] = _c.r; this.c0[i3 + 1] = _c.g; this.c0[i3 + 2] = _c.b; this.c1[i3] = _c2.r; this.c1[i3 + 1] = _c2.g; this.c1[i3 + 2] = _c2.b;
    this.a0[i] = o.alpha ?? 1; this.grav[i] = o.grav ?? 0; this.drag[i] = o.drag ?? 1.5; this.shape[i] = o.shape ?? 0; this.flick[i] = o.flicker ?? 0; this.bounce[i] = o.bounce ? 1 : 0;
    if (o.swirl) { this.swirl[i3] = o.swirl[0]; this.swirl[i3 + 1] = o.swirl[1]; this.swirl[i3 + 2] = o.swirl[2]; } else this.swirl[i3 + 2] = 0;
  }
  update(dt, time) {
    const { pos, v, life, max, col, size } = this;
    let any = false; const n = this.hi;
    for (let i = 0; i < n; i++) {
      if (life[i] <= 0) { if (size[i] !== 0) { size[i] = 0; col[i * 4 + 3] = 0; any = true; } continue; }
      any = true;
      life[i] -= dt; const i3 = i * 3;
      const k = 1 - clamp(life[i] / max[i], 0, 1);
      const dr = Math.exp(-this.drag[i] * dt);
      v[i3] *= dr; v[i3 + 2] *= dr; v[i3 + 1] = v[i3 + 1] * dr - this.grav[i] * dt;
      const sw = this.swirl[i3 + 2];
      if (sw) { const dx = pos[i3] - this.swirl[i3], dz = pos[i3 + 2] - this.swirl[i3 + 1]; const a = sw * dt, c = Math.cos(a), s = Math.sin(a); pos[i3] = this.swirl[i3] + dx * c - dz * s; pos[i3 + 2] = this.swirl[i3 + 1] + dx * s + dz * c; }
      pos[i3] += v[i3] * dt; pos[i3 + 1] += v[i3 + 1] * dt; pos[i3 + 2] += v[i3 + 2] * dt;
      if (this.bounce[i] && pos[i3 + 1] < 0.05 && v[i3 + 1] < 0) { pos[i3 + 1] = 0.05; v[i3 + 1] *= -0.35; v[i3] *= 0.5; v[i3 + 2] *= 0.5; }
      size[i] = lerp(this.s0[i], this.s1[i], k);
      const fade = k < 0.08 ? k / 0.08 : 1 - Math.pow((k - 0.08) / 0.92, 2);
      let a = this.a0[i] * fade; if (this.flick[i]) a *= 0.6 + 0.4 * Math.sin(time * 30 + i);
      col[i * 4] = lerp(this.c0[i3], this.c1[i3], k); col[i * 4 + 1] = lerp(this.c0[i3 + 1], this.c1[i3 + 1], k); col[i * 4 + 2] = lerp(this.c0[i3 + 2], this.c1[i3 + 2], k); col[i * 4 + 3] = a;
      if (life[i] <= 0) { size[i] = 0; col[i * 4 + 3] = 0; }
    }
    this.geo.setDrawRange(0, n);
    if (any) for (const nm of ['position', 'pcolor', 'size', 'shape', 'vel']) { const at = this.geo.attributes[nm]; at.needsUpdate = true; at.clearUpdateRanges?.(); at.addUpdateRange?.(0, n * at.itemSize); }
  }
  clear() { this.life.fill(0); }
  dispose() { this.points.parent?.remove(this.points); this.geo.dispose(); this.mat.dispose(); }
}

// ───────────────────────────── particle style presets ─────────────────────────────
export const FX_STYLES = {
  sparks: { shape: 4, grav: 9, drag: 2.6, up: 4, spread: 9, life: 0.42, size: 0.42 },
  embers: { shape: 0, grav: -3, drag: 1.2, up: 3, spread: 3, life: 1.0, size: 0.45, flicker: 1 },
  leaves: { shape: 1, grav: 1.5, drag: 2.5, up: 4, spread: 4, life: 1.2, size: 0.35, normal: true },
  petals: { shape: 1, grav: 1.0, drag: 2.5, up: 3, spread: 5, life: 1.4, size: 0.3, normal: true },
  snow: { shape: 2, grav: 1.2, drag: 3, up: 2, spread: 3, life: 1.3, size: 0.4 },
  bluefire: { shape: 0, grav: -4, drag: 1.5, up: 3, spread: 3, life: 0.8, size: 0.6, flicker: 1 },
  sunfire: { shape: 2, grav: -2, drag: 1.5, up: 4, spread: 5, life: 0.9, size: 0.7 },
  stars: { shape: 2, grav: 0, drag: 2, up: 2, spread: 5, life: 1.0, size: 0.6 },
  nebula: { shape: 0, grav: -0.5, drag: 1.5, up: 1, spread: 4, life: 1.4, size: 1.0 },
  constellation: { shape: 2, grav: -0.5, drag: 2.5, up: 2, spread: 6, life: 1.6, size: 0.7 },
  pixels: { shape: 1, grav: 2, drag: 3, up: 3, spread: 6, life: 0.7, size: 0.35 },
  wisps: { shape: 0, grav: -2, drag: 1.0, up: 1.5, spread: 2, life: 1.1, size: 0.7 },
  moonmotes: { shape: 2, grav: -1, drag: 2, up: 1.5, spread: 4, life: 1.2, size: 0.45 },
  void: { shape: 3, grav: 0, drag: 3, up: 0.5, spread: 5, life: 0.9, size: 0.9 },
  bubbles: { shape: 3, grav: -2.5, drag: 2, up: 1, spread: 3, life: 1.2, size: 0.55 },
  bats: { shape: 1, grav: -3, drag: 1, up: 4, spread: 6, life: 1.0, size: 0.35 },
  lightning: { shape: 4, grav: 0, drag: 5, up: 1, spread: 14, life: 0.3, size: 0.5 },
  dust: { shape: 6, grav: -0.5, drag: 3, up: 2, spread: 5, life: 0.9, size: 1.2, normal: true },
  debris: { shape: 1, grav: 18, drag: 0.8, up: 7, spread: 5, life: 1.1, size: 0.35, normal: true, bounce: true },
  smoke: { shape: 6, grav: -1.2, drag: 2.2, up: 1.2, spread: 1.5, life: 1.0, size: 1.1, normal: true },
};

// ───────────────────────────── text ─────────────────────────────
// o: {color, big, scale, dur, rise, kind:'dmg'|'crit'|'heavy'|'ability'|'taken'|'heal'|'gold'|'info', key (stack id)}
class TextPool {
  constructor(scene, n = 40) {
    this.items = []; this.stacks = new Map();
    for (let i = 0; i < n; i++) {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 80;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
      sp.renderOrder = 1000; sp.visible = false; scene.add(sp);
      this.items.push({ cv, tex, sp, t: 0, dur: 1, active: false, vx: 0 });
    }
    this.i = 0; this.time = 0;
  }
  spawn(text, x, y, z, o = {}) {
    // pick the oldest free item, otherwise round-robin
    let it = null; for (let k = 0; k < this.items.length; k++) { const c = this.items[(this.i + k) % this.items.length]; if (!c.active) { it = c; this.i = (this.i + k + 1) % this.items.length; break; } }
    if (!it) { it = this.items[this.i]; this.i = (this.i + 1) % this.items.length; }
    const kind = o.kind || (o.big ? 'crit' : 'dmg');
    const g = it.cv.getContext('2d'); g.clearRect(0, 0, 256, 80);
    const big = kind === 'crit' || kind === 'heavy' || o.big;
    const fs = big ? 52 : kind === 'taken' ? 34 : kind === 'gold' ? 36 : 38;
    g.font = `italic 900 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const col = o.color || '#ffffff';
    g.lineJoin = 'round'; g.lineWidth = big ? 10 : 8; g.strokeStyle = 'rgba(16,10,24,0.92)'; g.strokeText(text, 128, 42);
    const gr = g.createLinearGradient(0, 42 - fs / 2, 0, 42 + fs / 2); _c.set(col); const top = _c.clone().lerp(new THREE.Color(1, 1, 1), 0.55); const bot = _c.clone().multiplyScalar(0.85);
    gr.addColorStop(0, '#' + top.getHexString()); gr.addColorStop(0.55, col); gr.addColorStop(1, '#' + bot.getHexString());
    g.fillStyle = gr; g.fillText(text, 128, 42);
    it.tex.needsUpdate = true;
    // stacking: consecutive numbers on the same key climb instead of overlapping
    let lane = 0; if (o.key != null) { const st = this.stacks.get(o.key); lane = st && this.time - st.t < 0.45 ? (st.lane + 1) % 4 : 0; this.stacks.set(o.key, { t: this.time, lane }); }
    it.sp.position.set(x, y + lane * 0.55, z); it.base = it.sp.position.clone(); it.t = 0; it.dur = o.dur || (big ? 1.1 : 0.85); it.active = true; it.sp.visible = true;
    it.scale = (o.scale || 1) * (big ? 1.25 : 1); it.vx = (o.vx ?? (Math.random() - 0.5) * 1.2) + (kind === 'taken' ? 0.6 : 0); it.rise = o.rise ?? (big ? 1.6 : 1.9); it.kind = kind; it.big = big;
  }
  update(dt) {
    this.time += dt;
    for (const it of this.items) {
      if (!it.active) continue;
      it.t += dt; const k = it.t / it.dur;
      if (k >= 1) { it.active = false; it.sp.visible = false; continue; }
      // punchy pop: overshoot then settle, then shrink out
      const pop = k < 0.1 ? 0.4 + (k / 0.1) * (it.big ? 1.15 : 0.85) : k < 0.22 ? (it.big ? 1.55 : 1.25) - (k - 0.1) / 0.12 * (it.big ? 0.45 : 0.25) : 1.0 - Math.max(0, k - 0.75) * 1.2;
      it.sp.scale.set(4.2 * it.scale * pop, 1.31 * it.scale * pop, 1);
      const rise = it.rise * (1 - Math.pow(1 - Math.min(1, k * 1.4), 3));
      it.sp.position.set(it.base.x + it.vx * k, it.base.y + rise, it.base.z);
      it.sp.material.opacity = k > 0.72 ? 1 - (k - 0.72) / 0.28 : 1;
    }
  }
  dispose() { for (const it of this.items) { it.sp.parent?.remove(it.sp); it.tex.dispose(); it.sp.material.dispose(); } }
}

// ───────────────────────────── shared geometries ─────────────────────────────
const GEO = {};
function geo(k) {
  if (GEO[k]) return GEO[k];
  let g;
  if (k === 'plane') { g = new THREE.PlaneGeometry(1, 1); g.rotateX(-PI / 2); }
  else if (k === 'pillar') { g = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true); g.translate(0, 0.5, 0); }
  else if (k === 'beam') { g = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); g.rotateX(PI / 2); g.translate(0, 0, 0.5); }
  else if (k === 'slash') { g = new THREE.RingGeometry(0.55, 1, 24, 1, -PI * 0.5, PI); g.rotateX(-PI / 2); }
  else if (k === 'cone') { g = new THREE.RingGeometry(0.05, 1, 16, 1, -PI / 7, PI * 2 / 7); g.rotateX(-PI / 2); }
  else if (k === 'sphere') g = new THREE.IcosahedronGeometry(1, 2);
  else if (k === 'dome') g = new THREE.SphereGeometry(1, 24, 10, 0, PI * 2, 0, PI / 2);
  else if (k === 'spike') { g = new THREE.ConeGeometry(0.35, 1, 5, 1); g.translate(0, 0.5, 0); }
  else if (k === 'star') { const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2 + PI / 2, r = i % 2 ? 0.4 : 1; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g = new THREE.ShapeGeometry(sh); }
  g.userData.shared = true; GEO[k] = g; return g;
}
let _pillarTex = null;
function pillarTexture() {
  if (_pillarTex) return _pillarTex;
  const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 64); _pillarTex = new THREE.CanvasTexture(c); return _pillarTex;
}

// Fresnel bubble (shield) material
export function makeBubbleMat(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 1 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uAlpha; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); float hex = 0.5+0.5*sin(vP.y*14.0 + uTime*3.0); float a = (f*0.9 + 0.06 + hex*f*0.25) * uAlpha; gl_FragColor = vec4(uColor * a * 1.4, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}
// crescent slash: bright leading edge, tail fades (uses ring UVs)
function makeSlashMat() {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(1, 1, 1) }, opacity: { value: 1 }, head: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 color; uniform float opacity; uniform float head; varying vec2 vUv;
      void main(){ vec2 p = vUv*2.0-1.0; float r = length(p); float ang = atan(p.y, p.x); float t = clamp((ang + 1.5708) / 3.14159, 0.0, 1.0);
        float lead = smoothstep(head - 0.65, head, t) * (1.0 - smoothstep(head, head + 0.04, t));
        float band = smoothstep(0.55, 0.9, r) * (1.0 - smoothstep(0.96, 1.0, r));
        float core = smoothstep(0.82, 0.93, r) * (1.0 - smoothstep(0.95, 0.99, r));
        float a = (band * 0.75 + core * 1.2) * lead * opacity; if (a < 0.01) discard;
        vec3 c = mix(color, vec3(1.0), core * 0.7 * lead); gl_FragColor = vec4(c * a * 2.4, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// ───────────────────────────── VFX manager ─────────────────────────────
export class Vfx {
  constructor(scene, quality = 'med') {
    this.scene = scene; this.fx = []; this.time = 0;
    const cap = quality === 'low' ? 1200 : quality === 'high' ? 4500 : 3000;
    this.add = new Particles(scene, cap, true);
    this.norm = new Particles(scene, Math.floor(cap / 3), false);
    this.texts = new TextPool(scene);
    this.pools = {}; this.density = quality === 'low' ? 0.45 : quality === 'high' ? 1 : 0.75;
    registerVfx(scene, this);
  }
  setQuality(q) { this.density = q === 'low' ? 0.45 : q === 'high' ? 1 : 0.75; }
  // Move floating text to another scene (e.g. the renderer's un-graded overlay)
  setTextScene(sc) { for (const it of this.texts.items) { it.sp.parent?.remove(it.sp); sc.add(it.sp); } }
  _get(kind) {
    const pool = (this.pools[kind] ||= []);
    let m = pool.find((o) => !o.visible);
    if (m) return m;
    let mat;
    if (kind === 'ring' || kind === 'disc' || kind === 'crack' || kind === 'teleg') mat = new THREE.MeshBasicMaterial({ map: kind === 'ring' ? ringTexture() : kind === 'crack' ? crackTexture() : kind === 'teleg' ? telegraphTexture() : glowTexture(), transparent: true, depthWrite: false, blending: kind === 'crack' ? THREE.NormalBlending : THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
    else if (kind === 'pillar') mat = new THREE.MeshBasicMaterial({ map: pillarTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    else if (kind === 'sprite' || kind === 'spikeS' || kind === 'smokeS') { m = new THREE.Sprite(new THREE.SpriteMaterial({ map: kind === 'spikeS' ? spikeTexture() : glowTexture(), transparent: true, depthWrite: false, blending: kind === 'smokeS' ? THREE.NormalBlending : THREE.AdditiveBlending, toneMapped: false })); }
    else if (kind === 'bubble' || kind === 'dome') mat = makeBubbleMat(0xffffff);
    else if (kind === 'slash') mat = makeSlashMat();
    else if (kind === 'spike') mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, emissive: 0x000000, roughness: 0.8 });
    else mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    if (!m) m = new THREE.Mesh(geo(kind === 'ring' || kind === 'disc' || kind === 'crack' || kind === 'teleg' ? 'plane' : kind === 'bubble' ? 'sphere' : kind), mat);
    if (kind === 'spike') m.castShadow = true;
    m.renderOrder = kind === 'crack' ? 4 : kind === 'ring' || kind === 'disc' || kind === 'teleg' ? 5 : 15; m.frustumCulled = false;
    pool.push(m); this.scene.add(m); return m;
  }
  _run(obj, dur, update) { obj.visible = true; const e = { obj, t: 0, dur, update }; this.fx.push(e); update(e, 0); return e; }
  _col(m, c) { if (m.material.uniforms?.color) m.material.uniforms.color.value.set(c); else m.material.color.set(c); }

  // ---- primitives ----
  ring(x, z, o = {}) { // expanding ground ring
    const r1x = o.r1 ?? 4; const m = this._get('ring'); const tx = (o.thin || Math.max(r1x, o.r0 ?? 0) > 9) ? thinRingTexture() : ringTexture(); if (m.material.map !== tx) { m.material.map = tx; m.material.needsUpdate = true; } m.material.color.set(o.color ?? 0xffffff).multiplyScalar(HDR); m.position.set(x, (o.y ?? 0.1), z);
    const r0 = o.r0 ?? 0.5, r1 = o.r1 ?? 4, a = o.alpha ?? 1;
    return this._run(m, o.dur ?? 0.5, (e, k) => { const r = lerp(r0, r1, o.easeIn ? k : 1 - Math.pow(1 - k, 2.5)); m.scale.set(r * 2, 1, r * 2); m.material.opacity = a * (o.hold ? (k < 0.8 ? 1 : (1 - k) / 0.2) : 1 - k); });
  }
  disc(x, z, o = {}) { // soft glow on ground
    const m = this._get('disc'); m.material.color.set(o.color ?? 0xffffff).multiplyScalar(HDR); m.position.set(x, o.y ?? 0.12, z);
    const r = o.r ?? 3, a = (o.alpha ?? 1) * 0.6;
    return this._run(m, o.dur ?? 0.5, (e, k) => { const s = r * 2 * (o.grow ? 0.5 + k * 0.5 : 1); m.scale.set(s, 1, s); m.material.opacity = a * (1 - k) * (o.pulse ? 0.7 + 0.3 * Math.sin(k * 30) : 1); });
  }
  flash(x, y, z, o = {}) {
    const m = this._get('sprite'); m.material.color.set(o.color ?? 0xffffff).multiplyScalar(HDR); m.position.set(x, y, z);
    const s = o.size ?? 3, a = (o.alpha ?? 1) * 0.8;
    return this._run(m, o.dur ?? 0.25, (e, k) => { const q = s * (0.6 + 0.6 * ease(k * 2)); m.scale.set(q, q, 1); m.material.opacity = a * (1 - k); });
  }
  star(x, y, z, o = {}) { // spiky impact star sprite (pops, spins, fades)
    const m = this._get('spikeS'); m.material.color.set(o.color ?? 0xffffff).multiplyScalar(HDR); m.position.set(x, y, z); m.material.rotation = Math.random() * PI;
    const s = o.size ?? 2.4, a = o.alpha ?? 1, rot = (Math.random() - 0.5) * 3;
    return this._run(m, o.dur ?? 0.16, (e, k) => { const q = s * (k < 0.3 ? 0.5 + 1.8 * k : 1.04 - (k - 0.3) * 0.6); m.scale.set(q * (o.sx ?? 1), q * (o.sy ?? 1), 1); m.material.rotation += rot * 0.016; m.material.opacity = a * (1 - k * k); });
  }
  pillar(x, z, o = {}) {
    const m = this._get('pillar'); m.material.color.set(o.color ?? 0xffffff).multiplyScalar(HDR); m.position.set(x, 0, z);
    const r = o.r ?? 1.5, h = o.h ?? 10, a = (o.alpha ?? 1) * 0.55;
    return this._run(m, o.dur ?? 0.8, (e, k) => { m.scale.set(r * (1 - 0.5 * k), h * (0.3 + 0.7 * ease(k * 3)), r * (1 - 0.5 * k)); m.material.opacity = a * (1 - k); m.rotation.y = k * 3; });
  }
  beam(x0, y0, z0, x1, y1, z1, o = {}) {
    const m = this._get('beam'); m.material.color.set(o.color ?? 0xffffff).multiplyScalar(HDR); m.position.set(x0, y0, z0);
    const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0); m.lookAt(x1, y1, z1);
    const w = o.width ?? 0.25, a = o.alpha ?? 1;
    return this._run(m, o.dur ?? 0.2, (e, k) => { m.scale.set(w * (1 - k * 0.7), w * (1 - k * 0.7), len); m.material.opacity = a * (1 - k); });
  }
  slash(x, y, z, angle, o = {}) { // crescent arc sweeping across `angle` (world XZ angle of the swing direction)
    const m = this._get('slash'); m.material.uniforms.color.value.set(o.color ?? 0xffffff); m.position.set(x, y, z);
    const r = o.r ?? 2.2, a = o.alpha ?? 1, dir = o.flip ? -1 : 1;
    return this._run(m, o.dur ?? 0.22, (e, k) => { const s = r * (0.85 + 0.25 * k); m.scale.set(s, 1, s * dir); m.rotation.set(0, -angle, (o.tilt ?? 0.3) * dir); m.material.uniforms.head.value = 0.25 + ease(k * 1.6) * 0.9; m.material.uniforms.opacity.value = a * (1 - k * k); });
  }
  cone(x, z, angle, o = {}) {
    const m = this._get('cone'); m.material.color.set(o.color ?? 0xffffff).multiplyScalar(HDR); m.position.set(x, o.y ?? 0.2, z);
    const r = o.r ?? 8, a = o.alpha ?? 0.8; m.rotation.set(0, -angle, 0);
    return this._run(m, o.dur ?? 0.5, (e, k) => { const s = r * ease(k * 2.5); m.scale.set(s, 1, s); m.material.opacity = a * (1 - k); });
  }
  bubble(x, y, z, o = {}) {
    const m = this._get('bubble'); m.material.uniforms.uColor.value.set(o.color ?? 0xffffff); m.position.set(x, y, z);
    const r = o.r ?? 1.5;
    return this._run(m, o.dur ?? 0.4, (e, k) => { const s = r * (o.pop ? 1 + k * 0.6 : 0.5 + 0.5 * ease(k * 3)); m.scale.setScalar(s); m.material.uniforms.uAlpha.value = o.pop ? 1 - k : 1 - k * k; });
  }
  spikes(x, z, o = {}) { // ring of thorns/rocks erupting from the ground
    const n = Math.round((o.n ?? 8) * (0.6 + 0.4 * this.density)); const r = o.r ?? 2, h = o.h ?? 2, dur = o.dur ?? 0.9;
    for (let i = 0; i < n; i++) {
      const m = this._get('spike'); m.material.color.set(o.color ?? '#8a7a68'); m.material.emissive.set(o.emissive ?? 0x000000);
      const a = (i / n) * PI * 2 + Math.random() * 0.4, rr = r * (o.fill ? Math.sqrt(Math.random()) : 0.85 + Math.random() * 0.3);
      m.position.set(x + Math.cos(a) * rr, 0, z + Math.sin(a) * rr); m.rotation.set(Math.sin(a) * (o.tilt ?? 0.35), Math.random() * 3, -Math.cos(a) * (o.tilt ?? 0.35));
      const hh = h * (0.6 + Math.random() * 0.6), d = Math.random() * 0.1;
      this._run(m, dur, (e, k) => { const kk = Math.max(0, k - d); const up = kk < 0.15 ? ease(kk / 0.15) * 1.1 : kk < 0.25 ? 1.1 - (kk - 0.15) : kk > 0.7 ? 1 - ease((kk - 0.7) / 0.3) : 1; m.scale.set(0.9 + hh * 0.2, Math.max(0.01, hh * up), 0.9 + hh * 0.2); });
    }
  }
  dome(x, z, o = {}) {
    const m = this._get('dome'); m.material.uniforms.uColor.value.set(o.color ?? 0xffffff); m.position.set(x, 0, z);
    const r = o.r ?? 5, dur = o.dur ?? 2, a = o.alpha ?? 1;
    return this._run(m, dur, (e, k) => { const t = e.t; const g = ease(t / 0.3); m.scale.set(r * g, r * 0.6 * g, r * g); m.material.uniforms.uAlpha.value = a * (k > 0.85 ? (1 - k) / 0.15 : 1); if (o.follow) { const p = o.follow(); if (!p) e.t = e.dur; else m.position.set(p.x, 0, p.z); } });
  }
  arc(x0, z0, x1, z1, o = {}) { // lobbed glob / leap arc with trail
    const m = this._get('sprite'); m.material.color.set(o.color ?? 0xffffff).multiplyScalar(HDR); const s = o.size ?? 2; m.scale.set(s, s, 1);
    const h = o.h ?? 4, dur = o.dur ?? 0.4;
    return this._run(m, dur, (e, k) => { const x = lerp(x0, x1, k), z = lerp(z0, z1, k), y = 1 + Math.sin(k * PI) * h; m.position.set(x, y, z); m.material.opacity = 1; this.trail(x, y, z, o.color ?? '#fff', { style: o.style || 'wisps', size: s * 0.4, life: 0.4, color1: o.color1 }); if (k >= 1 && o.onLand) { o.onLand(); o.onLand = null; } });
  }
  tether(getA, getB, o = {}) { // beam that tracks two moving points
    const m = this._get('beam'); m.material.color.set(o.color ?? 0xffffff).multiplyScalar(HDR); const w = o.width ?? 0.15;
    return this._run(m, o.dur ?? 1, (e, k) => { const a = getA(), b = getB(); if (!a || !b) { e.t = e.dur; m.scale.set(0.001, 0.001, 0.001); return; } m.position.set(a.x, a.y, a.z); m.lookAt(b.x, b.y, b.z); const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); const pulse = 1 + 0.35 * Math.sin(this.time * 14); m.scale.set(w * pulse, w * pulse, len); m.material.opacity = (o.alpha ?? 0.9) * (k > 0.9 ? (1 - k) / 0.1 : 1); if (Math.random() < 0.4) { const t = Math.random(); this.trail(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t), o.color ?? '#fff', { style: o.style || 'sparks', size: 0.4, life: 0.3, vy: 0.2 }); } });
  }
  follow(getPos, o = {}) { // ground aura following a unit
    const m = this._get('ring'); if (m.material.map !== ringTexture()) { m.material.map = ringTexture(); m.material.needsUpdate = true; } m.material.color.set(o.color ?? 0xffffff).multiplyScalar(HDR);
    const r = o.r ?? 2, a = o.alpha ?? 0.8;
    return this._run(m, o.dur ?? 2, (e, k) => { const p = getPos(); if (!p) { e.t = e.dur; m.material.opacity = 0; return; } m.position.set(p.x, 0.12, p.z); const pulse = 1 + 0.08 * Math.sin(this.time * 8); m.scale.set(r * 2 * pulse, 1, r * 2 * pulse); m.material.opacity = a * (k < 0.08 ? k / 0.08 : k > 0.88 ? (1 - k) / 0.12 : 1);
      if (o.style && Math.random() < (o.rate ?? 0.4)) this.trail(p.x + (Math.random() - 0.5) * r, (o.y0 ?? 0.3) + Math.random() * (o.yr ?? 1.6), p.z + (Math.random() - 0.5) * r, o.pcolor ?? o.color, { style: o.style, vy: o.vy ?? 1.2, life: 0.6, size: o.psize ?? 0.5, color1: o.color1 }); });
  }
  icon(getPos, o = {}) { // floating overhead glyph (marks)
    const m = this._get('star'); m.material.color.set(o.color ?? 0xffffff).multiplyScalar(HDR); m.material.side = THREE.DoubleSide;
    return this._run(m, o.dur ?? 2, (e, k) => { const p = getPos(); if (!p) { e.t = e.dur; return; } m.position.set(p.x, (o.y ?? 3.6) + Math.sin(this.time * 4) * 0.15, p.z); m.quaternion.copy(o.cam.quaternion); const s = (o.size ?? 0.6) * (k < 0.1 ? ease(k / 0.1) * 1.4 : 1); m.scale.set(s, s, s); m.material.opacity = k > 0.9 ? (1 - k) / 0.1 : 1; });
  }
  crack(x, z, o = {}) { // dark ground crack decal (slams)
    const m = this._get('crack'); m.material.color.set(o.color ?? '#1a120c'); m.position.set(x, 0.07, z); m.rotation.y = Math.random() * PI * 2;
    const r = o.r ?? 3, dur = o.dur ?? 1.6, a = o.alpha ?? 0.75;
    return this._run(m, dur, (e, k) => { const s = r * 2 * (0.7 + 0.3 * ease(k * 8)); m.scale.set(s, 1, s); m.material.opacity = a * (k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1); });
  }
  telegraph(x, z, o = {}) { // readable delayed-blast indicator: filling disc + bold rim (red-tinted for enemies)
    const r = o.r ?? 3, dur = o.dur ?? 1, col = o.enemy ? mixCol(o.color ?? '#ff3a3a', '#ff2a2a', 0.65) : (o.color ?? '#ffffff');
    const rim = this._get('teleg'); rim.material.color.set(col).multiplyScalar(HDR); rim.position.set(x, 0.11, z);
    const fill = this._get('disc'); fill.material.color.set(col).multiplyScalar(1.2); fill.position.set(x, 0.12, z);
    this._run(fill, dur, (e, k) => { const s = r * 2 * ease(k) * 0.98; fill.scale.set(s, 1, s); fill.material.opacity = (o.enemy ? 0.55 : 0.4) * (k < 0.95 ? 1 : (1 - k) / 0.05); if (o.follow) { const p = o.follow(); if (p) fill.position.set(p.x, 0.12, p.z); } });
    return this._run(rim, dur, (e, k) => { const pulse = 1 + 0.03 * Math.sin(this.time * 14); rim.scale.set(r * 2 * pulse, 1, r * 2 * pulse); rim.material.opacity = (k < 0.1 ? k / 0.1 : 1) * (o.enemy ? 0.95 : 0.7) * (k < 0.95 ? 1 : (1 - k) / 0.05); if (o.follow) { const p = o.follow(); if (p) rim.position.set(p.x, 0.11, p.z); } });
  }
  shockwave(x, z, o = {}) { // fast double ring + ground disc flash
    const r = o.r ?? 4; const col = o.color ?? '#ffffff';
    this.ring(x, z, { color: col, r0: r * 0.15, r1: r, dur: o.dur ?? 0.35, alpha: o.alpha ?? 1 });
    this.ring(x, z, { color: o.color2 ?? '#ffffff', r0: r * 0.1, r1: r * 0.75, dur: (o.dur ?? 0.35) * 0.7, alpha: 0.8, thin: true });
    this.disc(x, z, { color: col, r: r * 0.8, dur: (o.dur ?? 0.35) * 0.8, alpha: 0.6 });
  }
  debris(x, y, z, color, n = 8, o = {}) { this.burst(x, y, z, color, n, { style: 'debris', ...o }); }

  // ---- composite combat effects ----
  // dir: world XZ angle the hit travels (from attacker to victim); strength ~1 normal, 2 heavy
  impact(x, y, z, o = {}) {
    const col = o.color ?? '#ffffff', col2 = o.color2 ?? '#ffffff', s = o.strength ?? 1, dir = o.dir;
    this.star(x, y, z, { color: col2, size: 1.6 + s * 0.9, dur: 0.12 + s * 0.04 });
    this.flash(x, y, z, { color: col, size: 2.2 + s * 1.2, dur: 0.16 + s * 0.04, alpha: 0.9 });
    const n = Math.round((5 + s * 6) * this.density);
    for (let i = 0; i < n; i++) {
      const a = dir != null ? dir + (Math.random() - 0.5) * 1.9 : Math.random() * PI * 2; const sp = (7 + Math.random() * 9) * (0.8 + s * 0.25);
      this.add.emit({ x, y, z, vx: Math.cos(a) * sp, vy: (Math.random() * 0.9 + 0.1) * sp * 0.55, vz: Math.sin(a) * sp, life: 0.18 + Math.random() * 0.2, size: 0.22 + s * 0.06, size1: 0.05, color: '#ffffff', color1: col, alpha: 1, grav: 14, drag: 4.5, shape: 4 });
    }
    if (s >= 1.6) { this.debris(x, 0.4, z, o.debris ?? '#8a7a68', 6 * s, { speed: 0.7, size: 1.2 }); this.ring(x, z, { color: col, r0: 0.3, r1: 1.8 + s * 0.6, dur: 0.3 }); }
  }
  muzzleFlash(x, y, z, ang, col, col2, s = 1) {
    const dx = Math.cos(ang), dz = Math.sin(ang);
    this.star(x, y, z, { color: col2 ?? '#fff6c0', size: 1.5 * s, dur: 0.08 });
    this.flash(x + dx * 0.4, y, z + dz * 0.4, { color: col ?? '#ffcf40', size: 2.4 * s, dur: 0.1 });
    this.cone(x - dx * 0.2, z - dz * 0.2, ang, { color: col ?? '#ffcf40', r: 1.6 * s, dur: 0.09, alpha: 0.9, y });
    for (let i = 0; i < 4 * s; i++) { const a = ang + (Math.random() - 0.5) * 0.5, sp = 14 + Math.random() * 10; this.add.emit({ x, y, z, vx: Math.cos(a) * sp, vy: (Math.random() - 0.3) * 2, vz: Math.sin(a) * sp, life: 0.12, size: 0.25, size1: 0.05, color: '#ffffff', color1: col, shape: 4, drag: 6 }); }
    for (let i = 0; i < 2; i++) this.norm.emit({ x: x + dx * 0.3, y, z: z + dz * 0.3, vx: dx * 2 + (Math.random() - 0.5), vy: 0.8, vz: dz * 2 + (Math.random() - 0.5), life: 0.6, size: 0.5, size1: 1.3, color: '#d8d2c8', color1: '#a8a29a', alpha: 0.45, drag: 3, shape: 6 });
    // brass shell casing ejected to the right
    const rx = Math.cos(ang - PI / 2), rz = Math.sin(ang - PI / 2);
    this.norm.emit({ x: x - dx * 1.6, y: y + 0.1, z: z - dz * 1.6, vx: rx * 3 + (Math.random() - 0.5), vy: 4 + Math.random() * 2, vz: rz * 3 + (Math.random() - 0.5), life: 0.9, size: 0.22, size1: 0.2, color: '#ffd166', color1: '#c89a3a', alpha: 1, grav: 16, drag: 0.6, shape: 1, bounce: true });
  }
  castSpark(x, y, z, col, col2, s = 1) {
    this.star(x, y, z, { color: col2 ?? '#ffffff', size: 1.4 * s, dur: 0.14 });
    this.flash(x, y, z, { color: col, size: 2.6 * s, dur: 0.22 });
    this.burst(x, y, z, col, 6 * s, { style: 'stars', speed: 0.6, color1: col2 });
  }
  coinPop(x, y, z, n = 5, o = {}) {
    n = Math.max(2, Math.round(n));
    for (let i = 0; i < n; i++) { const a = Math.random() * PI * 2, sp = 1.5 + Math.random() * 2; this.norm.emit({ x, y, z, vx: Math.cos(a) * sp, vy: 7 + Math.random() * 3, vz: Math.sin(a) * sp, life: 0.75 + Math.random() * 0.2, size: 0.55, size1: 0.45, color: '#ffd34a', color1: '#ffb81a', alpha: 1, grav: 22, drag: 0.5, shape: 5, bounce: true }); }
    this.burst(x, y + 0.5, z, '#ffe27a', 6, { style: 'stars', speed: 0.6, up: 1.5, color1: '#fff6c8' });
    this.flash(x, y, z, { color: '#ffd34a', size: 2.2, dur: 0.2 });
  }
  killBurst(x, z, col, col2, s = 1) {
    this.star(x, 1.6, z, { color: col2 ?? '#ffffff', size: 4.2 * s, dur: 0.2 });
    this.flash(x, 1.5, z, { color: col, size: 7 * s, dur: 0.35 });
    this.shockwave(x, z, { r: 6 * s, color: col, color2: col2, dur: 0.5 });
    this.pillar(x, z, { color: col, r: 1.8 * s, h: 14, dur: 0.9 });
    for (let i = 0; i < 18 * this.density * s; i++) { const a = Math.random() * PI * 2, sp = 6 + Math.random() * 10; this.add.emit({ x, y: 1.4, z, vx: Math.cos(a) * sp, vy: 3 + Math.random() * 8, vz: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.3, size: 0.35, size1: 0.05, color: '#ffffff', color1: col, shape: 4, grav: 10, drag: 2.5 }); }
    this.burst(x, 1.2, z, col, 20 * s, { style: 'wisps', up: 3, radius: 0.8, color1: col2 });
  }
  // style particles
  burst(x, y, z, color, n, o = {}) {
    const st = FX_STYLES[o.style || 'sparks'] || FX_STYLES.sparks;
    const P = st.normal ? this.norm : this.add; const sp = (o.speed ?? 1) * st.spread, up = (o.up ?? 1) * st.up;
    n = Math.max(1, Math.round(n * this.density * (o.intensity ?? 1)));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * PI * 2, s = (0.3 + Math.random() * 0.7) * sp, r = (o.radius ?? 0) * Math.sqrt(Math.random());
      P.emit({ x: x + Math.cos(a) * r, y: y + (o.yJitter ? Math.random() * o.yJitter : 0), z: z + Math.sin(a) * r, vx: Math.cos(a) * s, vy: up * (0.4 + Math.random() * 0.8), vz: Math.sin(a) * s,
        life: st.life * (o.life ?? 1) * (0.6 + Math.random() * 0.6), size: st.size * (o.size ?? 1) * (0.7 + Math.random() * 0.6), size1: st.size * (o.size ?? 1) * (st.shape === 6 ? 1.6 : 0.15),
        color, color1: o.color1 ?? color, alpha: o.alpha ?? (st.shape === 6 ? 0.55 : 1), grav: st.grav, drag: st.drag, shape: st.shape, flicker: st.flicker, swirl: o.swirl, bounce: st.bounce });
    }
  }
  trail(x, y, z, color, o = {}) { // single trailing particle
    if (Math.random() > this.density + 0.2) return;
    const st = FX_STYLES[o.style || 'wisps'] || FX_STYLES.wisps; const P = st.normal ? this.norm : this.add;
    const shape = o.shape ?? (st.shape === 4 ? 0 : st.shape);
    P.emit({ x: x + (Math.random() - 0.5) * 0.3, y: y + (Math.random() - 0.5) * 0.3, z: z + (Math.random() - 0.5) * 0.3, vx: (Math.random() - 0.5) * (o.spread ?? 0.8), vy: (o.vy ?? 0.4) + Math.random() * 0.4, vz: (Math.random() - 0.5) * (o.spread ?? 0.8),
      life: o.life ?? 0.45, size: o.size ?? 0.7, size1: shape === 6 ? (o.size ?? 0.7) * 1.6 : 0.05, color, color1: o.color1 ?? color, alpha: o.alpha ?? (shape === 6 ? 0.5 : 0.9), grav: o.grav ?? 0, drag: 2, shape, flicker: st.flicker });
  }
  text(str, x, y, z, o) { this.texts.spawn(str, x, y, z, o); }

  update(dt) {
    this.time += dt;
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const e = this.fx[i]; e.t += dt; const k = Math.min(1, e.t / e.dur);
      e.update(e, k);
      if (k >= 1) { e.obj.visible = false; this.fx.splice(i, 1); }
    }
    if (this.pools.bubble) for (const b of this.pools.bubble) b.material.uniforms.uTime.value = this.time;
    this.add.update(dt, this.time); this.norm.update(dt, this.time); this.texts.update(dt);
  }
  setPointScale(s) { this.add.mat.uniforms.uScale.value = s; this.norm.mat.uniforms.uScale.value = s; }
  clear() { for (const e of this.fx) e.obj.visible = false; this.fx = []; this.add.clear(); this.norm.clear(); }
  dispose() {
    this.add.dispose(); this.norm.dispose(); this.texts.dispose();
    for (const k in this.pools) for (const m of this.pools[k]) { m.parent?.remove(m); m.material.dispose(); }
  }
}
function mixCol(a, b, t) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString(); }
