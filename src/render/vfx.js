// Pooled VFX: GPU point particles (additive + normal), ground decals, beams, pillars, slashes, floating text.
import * as THREE from 'three';
import { ringTexture, thinRingTexture, glowTexture, clamp, ease, lerp } from './util.js';

const PI = Math.PI;
const _c = new THREE.Color(), _c2 = new THREE.Color();

// ───────────────────────────── particles ─────────────────────────────
export class Particles {
  constructor(scene, cap, additive = true) {
    this.cap = cap; this.cursor = 0; this.additive = additive;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4); this.size = new Float32Array(cap); this.shape = new Float32Array(cap);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('shape', new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage));
    this.v = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap);
    this.s0 = new Float32Array(cap); this.s1 = new Float32Array(cap); this.c0 = new Float32Array(cap * 3); this.c1 = new Float32Array(cap * 3);
    this.a0 = new Float32Array(cap); this.grav = new Float32Array(cap); this.drag = new Float32Array(cap); this.swirl = new Float32Array(cap * 3); this.flick = new Float32Array(cap);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: `attribute float size; attribute vec4 pcolor; attribute float shape; varying vec4 vC; varying float vS; uniform float uScale;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / max(0.1,-mv.z); gl_Position = projectionMatrix * mv; vC = pcolor; vS = shape; }`,
      fragmentShader: `varying vec4 vC; varying float vS;
        void main(){ vec2 p = gl_PointCoord*2.0-1.0; float a;
          if (vS < 0.5) { float d = length(p); a = smoothstep(1.0, 0.0, d); a *= a; }
          else if (vS < 1.5) { a = step(abs(p.x),0.62)*step(abs(p.y),0.62); }
          else if (vS < 2.5) { float cx = smoothstep(0.22,0.0,abs(p.x))*(1.0-abs(p.y)); float cy = smoothstep(0.22,0.0,abs(p.y))*(1.0-abs(p.x)); a = max(cx,cy) + smoothstep(0.5,0.0,length(p))*0.6; }
          else { float d = length(p); a = smoothstep(1.0,0.75,d) * (0.35 + smoothstep(0.55,0.95,d)); }
          a *= vC.a; if (a < 0.01) discard;
          ${additive ? 'gl_FragColor = vec4(vC.rgb * a, a);' : 'gl_FragColor = vec4(vC.rgb, a);'} }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 20 : 10;
    scene.add(this.points); this.geo = g; this.active = 0;
  }
  // o: {x,y,z, vx,vy,vz, life, size, size1, color, color1, alpha, grav, drag, shape, swirl:[cx,cz,rate], flicker}
  emit(o) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.cap;
    const i3 = i * 3;
    this.pos[i3] = o.x; this.pos[i3 + 1] = o.y; this.pos[i3 + 2] = o.z;
    this.v[i3] = o.vx || 0; this.v[i3 + 1] = o.vy || 0; this.v[i3 + 2] = o.vz || 0;
    this.life[i] = o.life || 1; this.max[i] = o.life || 1;
    this.s0[i] = o.size ?? 0.5; this.s1[i] = o.size1 ?? (o.size ?? 0.5) * 0.2;
    _c.set(o.color ?? 0xffffff); _c2.set(o.color1 ?? o.color ?? 0xffffff);
    this.c0[i3] = _c.r; this.c0[i3 + 1] = _c.g; this.c0[i3 + 2] = _c.b; this.c1[i3] = _c2.r; this.c1[i3 + 1] = _c2.g; this.c1[i3 + 2] = _c2.b;
    this.a0[i] = o.alpha ?? 1; this.grav[i] = o.grav ?? 0; this.drag[i] = o.drag ?? 1.5; this.shape[i] = o.shape ?? 0; this.flick[i] = o.flicker ?? 0;
    if (o.swirl) { this.swirl[i3] = o.swirl[0]; this.swirl[i3 + 1] = o.swirl[1]; this.swirl[i3 + 2] = o.swirl[2]; } else this.swirl[i3 + 2] = 0;
  }
  update(dt, time) {
    const { pos, v, life, max, col, size } = this;
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      if (life[i] <= 0) { if (size[i] !== 0) { size[i] = 0; col[i * 4 + 3] = 0; any = true; } continue; }
      any = true;
      life[i] -= dt; const i3 = i * 3;
      const k = 1 - clamp(life[i] / max[i], 0, 1);
      const dr = Math.exp(-this.drag[i] * dt);
      v[i3] *= dr; v[i3 + 2] *= dr; v[i3 + 1] = v[i3 + 1] * dr - this.grav[i] * dt;
      const sw = this.swirl[i3 + 2];
      if (sw) { const dx = pos[i3] - this.swirl[i3], dz = pos[i3 + 2] - this.swirl[i3 + 1]; const a = sw * dt, c = Math.cos(a), s = Math.sin(a); pos[i3] = this.swirl[i3] + dx * c - dz * s; pos[i3 + 2] = this.swirl[i3 + 1] + dx * s + dz * c; }
      pos[i3] += v[i3] * dt; pos[i3 + 1] += v[i3 + 1] * dt; pos[i3 + 2] += v[i3 + 2] * dt;
      size[i] = lerp(this.s0[i], this.s1[i], k);
      const fade = k < 0.1 ? k / 0.1 : 1 - Math.pow((k - 0.1) / 0.9, 2);
      let a = this.a0[i] * fade; if (this.flick[i]) a *= 0.6 + 0.4 * Math.sin(time * 30 + i);
      col[i * 4] = lerp(this.c0[i3], this.c1[i3], k); col[i * 4 + 1] = lerp(this.c0[i3 + 1], this.c1[i3 + 1], k); col[i * 4 + 2] = lerp(this.c0[i3 + 2], this.c1[i3 + 2], k); col[i * 4 + 3] = a;
      if (life[i] <= 0) { size[i] = 0; col[i * 4 + 3] = 0; }
    }
    if (any) for (const n of ['position', 'pcolor', 'size', 'shape']) this.geo.attributes[n].needsUpdate = true;
  }
  clear() { this.life.fill(0); }
  dispose() { this.points.parent?.remove(this.points); this.geo.dispose(); this.mat.dispose(); }
}

// ───────────────────────────── particle style presets ─────────────────────────────
// emit "n" particles in a style around (x,y,z)
export const FX_STYLES = {
  sparks: { shape: 2, grav: 6, drag: 2, up: 4, spread: 7, life: 0.5, size: 0.55 },
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
  lightning: { shape: 2, grav: 0, drag: 4, up: 1, spread: 10, life: 0.35, size: 0.8 },
  dust: { shape: 0, grav: -0.5, drag: 3, up: 2, spread: 5, life: 0.9, size: 1.2, normal: true },
};

// ───────────────────────────── text ─────────────────────────────
class TextPool {
  constructor(scene, n = 28) {
    this.items = [];
    for (let i = 0; i < n; i++) {
      const cv = document.createElement('canvas'); cv.width = 192; cv.height = 64;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
      sp.renderOrder = 1000; sp.visible = false; scene.add(sp);
      this.items.push({ cv, tex, sp, t: 0, dur: 1, active: false, vx: 0 });
    }
    this.i = 0;
  }
  spawn(text, x, y, z, o = {}) {
    const it = this.items[this.i]; this.i = (this.i + 1) % this.items.length;
    const g = it.cv.getContext('2d'); g.clearRect(0, 0, 192, 64);
    g.font = `900 ${o.big ? 44 : 34}px system-ui, -apple-system, "Segoe UI", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.strokeStyle = 'rgba(20,14,30,0.9)'; g.strokeText(text, 96, 34);
    g.fillStyle = o.color || '#ffffff'; g.fillText(text, 96, 34);
    it.tex.needsUpdate = true;
    it.sp.position.set(x, y, z); it.base = it.sp.position.clone(); it.t = 0; it.dur = o.dur || 1.0; it.active = true; it.sp.visible = true;
    it.scale = (o.scale || 1) * (o.big ? 1.25 : 1); it.vx = (Math.random() - 0.5) * 1.5; it.rise = o.rise ?? 2.2;
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.active) continue;
      it.t += dt; const k = it.t / it.dur;
      if (k >= 1) { it.active = false; it.sp.visible = false; continue; }
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.6 : 1.2 - Math.min(0.2, (k - 0.12) * 1.0);
      it.sp.scale.set(3.6 * it.scale * pop, 1.2 * it.scale * pop, 1);
      it.sp.position.set(it.base.x + it.vx * k, it.base.y + it.rise * ease(k), it.base.z);
      it.sp.material.opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
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
  else if (k === 'slash') { g = new THREE.RingGeometry(0.75, 1, 18, 1, -PI * 0.45, PI * 0.9); g.rotateX(-PI / 2); }
  else if (k === 'cone') { g = new THREE.RingGeometry(0.05, 1, 16, 1, -PI / 7, PI * 2 / 7); g.rotateX(-PI / 2); }
  else if (k === 'sphere') g = new THREE.IcosahedronGeometry(1, 2);
  else if (k === 'dome') g = new THREE.SphereGeometry(1, 24, 10, 0, PI * 2, 0, PI / 2);
  else if (k === 'spike') { g = new THREE.ConeGeometry(0.35, 1, 4, 1); g.translate(0, 0.5, 0); }
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

// ───────────────────────────── VFX manager ─────────────────────────────
export class Vfx {
  constructor(scene, quality = 'med') {
    this.scene = scene; this.fx = []; this.time = 0;
    const cap = quality === 'low' ? 900 : quality === 'high' ? 4000 : 2400;
    this.add = new Particles(scene, cap, true);
    this.norm = new Particles(scene, Math.floor(cap / 3), false);
    this.texts = new TextPool(scene);
    this.pools = {}; this.density = quality === 'low' ? 0.45 : quality === 'high' ? 1 : 0.75;
  }
  setQuality(q) { this.density = q === 'low' ? 0.45 : q === 'high' ? 1 : 0.75; }
  _get(kind) {
    const pool = (this.pools[kind] ||= []);
    let m = pool.find((o) => !o.visible);
    if (m) return m;
    let mat;
    if (kind === 'ring' || kind === 'disc') mat = new THREE.MeshBasicMaterial({ map: kind === 'ring' ? ringTexture() : glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
    else if (kind === 'pillar') mat = new THREE.MeshBasicMaterial({ map: pillarTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    else if (kind === 'sprite') { m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); }
    else if (kind === 'bubble' || kind === 'dome') mat = makeBubbleMat(0xffffff);
    else if (kind === 'spike') mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0x000000 });
    else mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    if (!m) m = new THREE.Mesh(geo(kind === 'ring' || kind === 'disc' ? 'plane' : kind === 'bubble' ? 'sphere' : kind), mat);
    if (kind === 'spike') m.castShadow = true;
    m.renderOrder = kind === 'ring' || kind === 'disc' ? 5 : 15; m.frustumCulled = false;
    pool.push(m); this.scene.add(m); return m;
  }
  _run(obj, dur, update) { obj.visible = true; const e = { obj, t: 0, dur, update }; this.fx.push(e); update(e, 0); return e; }

  // ---- primitives ----
  ring(x, z, o = {}) { // expanding ground ring
    const r1x = o.r1 ?? 4; const m = this._get('ring'); const tx = (o.thin || Math.max(r1x, o.r0 ?? 0) > 9) ? thinRingTexture() : ringTexture(); if (m.material.map !== tx) { m.material.map = tx; m.material.needsUpdate = true; } m.material.color.set(o.color ?? 0xffffff); m.position.set(x, (o.y ?? 0.1), z);
    const r0 = o.r0 ?? 0.5, r1 = o.r1 ?? 4, a = o.alpha ?? 1;
    return this._run(m, o.dur ?? 0.5, (e, k) => { const r = lerp(r0, r1, o.easeIn ? k : 1 - Math.pow(1 - k, 2.5)); m.scale.set(r * 2, 1, r * 2); m.material.opacity = a * (o.hold ? (k < 0.8 ? 1 : (1 - k) / 0.2) : 1 - k); });
  }
  disc(x, z, o = {}) { // soft glow on ground
    const m = this._get('disc'); m.material.color.set(o.color ?? 0xffffff); m.position.set(x, o.y ?? 0.12, z);
    const r = o.r ?? 3, a = (o.alpha ?? 1) * 0.6;
    return this._run(m, o.dur ?? 0.5, (e, k) => { const s = r * 2 * (o.grow ? 0.5 + k * 0.5 : 1); m.scale.set(s, 1, s); m.material.opacity = a * (1 - k) * (o.pulse ? 0.7 + 0.3 * Math.sin(k * 30) : 1); });
  }
  flash(x, y, z, o = {}) {
    const m = this._get('sprite'); m.material.color.set(o.color ?? 0xffffff); m.position.set(x, y, z);
    const s = o.size ?? 3, a = (o.alpha ?? 1) * 0.75;
    return this._run(m, o.dur ?? 0.25, (e, k) => { const q = s * (0.6 + 0.6 * ease(k * 2)); m.scale.set(q, q, 1); m.material.opacity = a * (1 - k); });
  }
  pillar(x, z, o = {}) {
    const m = this._get('pillar'); m.material.color.set(o.color ?? 0xffffff); m.position.set(x, 0, z);
    const r = o.r ?? 1.5, h = o.h ?? 10, a = (o.alpha ?? 1) * 0.55;
    return this._run(m, o.dur ?? 0.8, (e, k) => { m.scale.set(r * (1 - 0.5 * k), h * (0.3 + 0.7 * ease(k * 3)), r * (1 - 0.5 * k)); m.material.opacity = a * (1 - k); m.rotation.y = k * 3; });
  }
  beam(x0, y0, z0, x1, y1, z1, o = {}) {
    const m = this._get('beam'); m.material.color.set(o.color ?? 0xffffff); m.position.set(x0, y0, z0);
    const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0); m.lookAt(x1, y1, z1);
    const w = o.width ?? 0.25, a = o.alpha ?? 1;
    return this._run(m, o.dur ?? 0.2, (e, k) => { m.scale.set(w * (1 - k * 0.7), w * (1 - k * 0.7), len); m.material.opacity = a * (1 - k); });
  }
  slash(x, y, z, angle, o = {}) {
    const m = this._get('slash'); m.material.color.set(o.color ?? 0xffffff); m.position.set(x, y, z);
    const r = o.r ?? 2.2, a = o.alpha ?? 1, dir = o.flip ? -1 : 1;
    m.rotation.set(0, PI / 2 - angle, 0); // ring centered on +x in local; geometry arc around -x..+x? we orient via rotation
    return this._run(m, o.dur ?? 0.22, (e, k) => { m.scale.set(r * (0.7 + 0.4 * k), 1, r * (0.7 + 0.4 * k)); m.rotation.y = -angle + PI / 2 - PI / 2 + dir * (k - 0.5) * 1.2; m.rotation.z = (o.tilt ?? 0.3) * dir; m.material.opacity = a * (1 - k * k); });
  }
  cone(x, z, angle, o = {}) {
    const m = this._get('cone'); m.material.color.set(o.color ?? 0xffffff); m.position.set(x, 0.2, z);
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
      this._run(m, dur, (e, k) => { const kk = Math.max(0, k - d); const up = kk < 0.2 ? ease(kk / 0.2) : kk > 0.7 ? 1 - ease((kk - 0.7) / 0.3) : 1; m.scale.set(0.9 + hh * 0.2, Math.max(0.01, hh * up), 0.9 + hh * 0.2); });
    }
  }
  dome(x, z, o = {}) {
    const m = this._get('dome'); m.material.uniforms.uColor.value.set(o.color ?? 0xffffff); m.position.set(x, 0, z);
    const r = o.r ?? 5, dur = o.dur ?? 2, a = o.alpha ?? 1;
    return this._run(m, dur, (e, k) => { const t = e.t; const g = ease(t / 0.3); m.scale.set(r * g, r * 0.6 * g, r * g); m.material.uniforms.uAlpha.value = a * (k > 0.85 ? (1 - k) / 0.15 : 1); if (o.follow) { const p = o.follow(); if (!p) e.t = e.dur; else m.position.set(p.x, 0, p.z); } });
  }
  arc(x0, z0, x1, z1, o = {}) { // lobbed glob / leap arc with trail
    const m = this._get('sprite'); m.material.color.set(o.color ?? 0xffffff); const s = o.size ?? 2; m.scale.set(s, s, 1);
    const h = o.h ?? 4, dur = o.dur ?? 0.4;
    return this._run(m, dur, (e, k) => { const x = lerp(x0, x1, k), z = lerp(z0, z1, k), y = 1 + Math.sin(k * PI) * h; m.position.set(x, y, z); m.material.opacity = 1; this.trail(x, y, z, o.color ?? '#fff', { style: o.style || 'wisps', size: s * 0.4, life: 0.4, color1: o.color1 }); if (k >= 1 && o.onLand) { o.onLand(); o.onLand = null; } });
  }
  tether(getA, getB, o = {}) { // beam that tracks two moving points
    const m = this._get('beam'); m.material.color.set(o.color ?? 0xffffff); const w = o.width ?? 0.15;
    return this._run(m, o.dur ?? 1, (e, k) => { const a = getA(), b = getB(); if (!a || !b) { e.t = e.dur; m.scale.set(0.001, 0.001, 0.001); return; } m.position.set(a.x, a.y, a.z); m.lookAt(b.x, b.y, b.z); const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); const pulse = 1 + 0.35 * Math.sin(this.time * 14); m.scale.set(w * pulse, w * pulse, len); m.material.opacity = (o.alpha ?? 0.9) * (k > 0.9 ? (1 - k) / 0.1 : 1); if (Math.random() < 0.4) { const t = Math.random(); this.trail(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t), o.color ?? '#fff', { style: o.style || 'sparks', size: 0.4, life: 0.3, vy: 0.2 }); } });
  }
  follow(getPos, o = {}) { // ground aura following a unit
    const m = this._get('ring'); if (m.material.map !== ringTexture()) { m.material.map = ringTexture(); m.material.needsUpdate = true; } m.material.color.set(o.color ?? 0xffffff);
    const r = o.r ?? 2, a = o.alpha ?? 0.8;
    return this._run(m, o.dur ?? 2, (e, k) => { const p = getPos(); if (!p) { e.t = e.dur; m.material.opacity = 0; return; } m.position.set(p.x, 0.12, p.z); const pulse = 1 + 0.08 * Math.sin(this.time * 8); m.scale.set(r * 2 * pulse, 1, r * 2 * pulse); m.material.opacity = a * (k < 0.08 ? k / 0.08 : k > 0.88 ? (1 - k) / 0.12 : 1);
      if (o.style && Math.random() < (o.rate ?? 0.4)) this.trail(p.x + (Math.random() - 0.5) * r, (o.y0 ?? 0.3) + Math.random() * (o.yr ?? 1.6), p.z + (Math.random() - 0.5) * r, o.pcolor ?? o.color, { style: o.style, vy: o.vy ?? 1.2, life: 0.6, size: o.psize ?? 0.5, color1: o.color1 }); });
  }
  icon(getPos, o = {}) { // floating overhead glyph (marks)
    const m = this._get('star'); m.material.color.set(o.color ?? 0xffffff); m.material.side = THREE.DoubleSide;
    return this._run(m, o.dur ?? 2, (e, k) => { const p = getPos(); if (!p) { e.t = e.dur; return; } m.position.set(p.x, (o.y ?? 3.6) + Math.sin(this.time * 4) * 0.15, p.z); m.quaternion.copy(o.cam.quaternion); const s = (o.size ?? 0.6) * (k < 0.1 ? ease(k / 0.1) * 1.4 : 1); m.scale.set(s, s, s); m.material.opacity = k > 0.9 ? (1 - k) / 0.1 : 1; });
  }
  // style particles
  burst(x, y, z, color, n, o = {}) {
    const st = FX_STYLES[o.style || 'sparks'] || FX_STYLES.sparks;
    const P = st.normal ? this.norm : this.add; const sp = (o.speed ?? 1) * st.spread, up = (o.up ?? 1) * st.up;
    n = Math.max(1, Math.round(n * this.density * (o.intensity ?? 1)));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * PI * 2, s = (0.3 + Math.random() * 0.7) * sp, r = (o.radius ?? 0) * Math.sqrt(Math.random());
      P.emit({ x: x + Math.cos(a) * r, y: y + (o.yJitter ? Math.random() * o.yJitter : 0), z: z + Math.sin(a) * r, vx: Math.cos(a) * s, vy: up * (0.4 + Math.random() * 0.8), vz: Math.sin(a) * s,
        life: st.life * (o.life ?? 1) * (0.6 + Math.random() * 0.6), size: st.size * (o.size ?? 1) * (0.7 + Math.random() * 0.6), size1: st.size * (o.size ?? 1) * 0.15,
        color, color1: o.color1 ?? color, alpha: o.alpha ?? 1, grav: st.grav, drag: st.drag, shape: st.shape, flicker: st.flicker, swirl: o.swirl });
    }
  }
  trail(x, y, z, color, o = {}) { // single trailing particle
    if (Math.random() > this.density + 0.2) return;
    const st = FX_STYLES[o.style || 'wisps'] || FX_STYLES.wisps; const P = st.normal ? this.norm : this.add;
    P.emit({ x: x + (Math.random() - 0.5) * 0.3, y: y + (Math.random() - 0.5) * 0.3, z: z + (Math.random() - 0.5) * 0.3, vx: (Math.random() - 0.5) * (o.spread ?? 0.8), vy: (o.vy ?? 0.4) + Math.random() * 0.4, vz: (Math.random() - 0.5) * (o.spread ?? 0.8),
      life: o.life ?? 0.45, size: o.size ?? 0.7, size1: 0.05, color, color1: o.color1 ?? color, alpha: o.alpha ?? 0.9, grav: o.grav ?? 0, drag: 2, shape: o.shape ?? st.shape, flicker: st.flicker });
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
    for (const k in this.pools) for (const m of this.pools[k]) { this.scene.remove(m); m.material.dispose(); }
  }
}
