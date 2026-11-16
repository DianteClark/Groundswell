// Living-map zone visuals (flood / ember / gale / stone / swamp) + telegraphs.
import * as THREE from 'three';
import { makeWaterMat } from './map.js';
import { ringTexture, thinRingTexture, glowTexture, teamColor, mkRand, WORLD, makeWorldMat } from './util.js';

// vertical energy curtain around a zone border (additive, fades upward, scrolling streaks)
function curtain(r, color, h = 3.2) {
  const g = new THREE.CylinderGeometry(r, r, h, 64, 1, true); g.translate(0, h / 2, 0);
  const m = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color) }, uTime: WORLD.uTime, uA: { value: 0.5 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uTime; uniform float uA; varying vec2 vUv;
      void main(){ float st = 0.6 + 0.4 * sin(vUv.x * 160.0 + uTime * 2.0) * sin(vUv.x * 47.0 - uTime * 1.3);
        float y = clamp(vUv.y, 0.0, 1.0); float a = pow(1.0 - y, 2.2) * st * uA + (1.0 - smoothstep(0.0, 0.06, y)) * uA * 0.6;
        gl_FragColor = vec4(uColor * a * 0.55, a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 13; return mesh;
}

const PI = Math.PI;
export const ZONE_COLORS = { flood: '#3fb8ff', ember: '#ff6a1a', gale: '#bff8e8', stone: '#c9a46a', swamp: '#7aa83a' };

const texCache = {};
function zoneTexture(kind) {
  if (texCache[kind]) return texCache[kind];
  const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'); const R = mkRand(kind.length * 99 + 7);
  const c = N / 2;
  const clipCircle = () => { g.beginPath(); g.arc(c, c, c - 2, 0, PI * 2); g.clip(); };
  if (kind === 'ember') {
    const gr = g.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, 'rgba(30,18,14,0.85)'); gr.addColorStop(0.7, 'rgba(45,28,20,0.7)'); gr.addColorStop(1, 'rgba(45,28,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N);
  } else if (kind === 'stone') {
    g.save(); clipCircle(); g.fillStyle = 'rgba(150,140,125,0.9)'; g.fillRect(0, 0, N, N);
    for (let y = 0; y < N; y += 36) for (let x = (y / 36) % 2 ? 18 : 0; x < N; x += 36) { g.fillStyle = `hsla(35,${8 + R() * 8}%,${48 + R() * 16}%,0.95)`; g.fillRect(x + 2, y + 2, 32, 32); }
    const gr = g.createRadialGradient(c, c, c * 0.75, c, c, c); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); g.restore();
  } else if (kind === 'swamp') {
    const gr = g.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, 'rgba(50,70,30,0.9)'); gr.addColorStop(0.8, 'rgba(60,85,35,0.8)'); gr.addColorStop(1, 'rgba(60,85,35,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${90 + R() * 40},${120 + R() * 40},50,0.4)`; const a = R() * PI * 2, r = R() * c * 0.85; g.beginPath(); g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 4 + R() * 14, 0, PI * 2); g.fill(); }
  } else if (kind === 'ember_cracks') {
    g.lineCap = 'round'; g.lineJoin = 'round';
    const paths = [];
    for (let i = 0; i < 9; i++) { let a = (i / 9) * PI * 2 + R() * 0.4, len = 30; const pts = [[c + Math.cos(a) * len, c + Math.sin(a) * len]]; while (len < c * 0.88) { a += (R() - 0.5) * 0.6; len += 22 + R() * 26; pts.push([c + Math.cos(a) * len, c + Math.sin(a) * len]); } paths.push(pts); }
    for (const [lw, col, blur] of [[14, 'rgba(255,90,20,0.35)', 18], [6, 'rgba(255,150,40,0.9)', 8], [2.5, 'rgba(255,240,180,1)', 0]]) {
      g.strokeStyle = col; g.shadowColor = 'rgba(255,100,20,1)'; g.shadowBlur = blur;
      for (const pts of paths) { g.lineWidth = lw; g.beginPath(); pts.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
    }
    g.shadowBlur = 0;
    for (let i = 0; i < 10; i++) { const a = R() * PI * 2, r = R() * c * 0.75; const gr = g.createRadialGradient(c + Math.cos(a) * r, c + Math.sin(a) * r, 0, c + Math.cos(a) * r, c + Math.sin(a) * r, 18 + R() * 16); gr.addColorStop(0, 'rgba(255,200,90,0.9)'); gr.addColorStop(1, 'rgba(255,80,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); }
  } else if (kind === 'gale') {
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const r = c * (0.2 + 0.75 * R()), a0 = R() * PI * 2; g.lineWidth = 3 + R() * 4; g.beginPath(); g.arc(c, c, r, a0, a0 + 0.8 + R() * 1.4); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; texCache[kind] = t; return t;
}

function decal(tex, size, opts = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: opts.color ?? 0xffffff, opacity: opts.opacity ?? 1, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  m.renderOrder = opts.order ?? 3; return m;
}

export class ZoneFx {
  constructor(kind, x, z, r, team) {
    this.kind = kind; this.x = x; this.z = z; this.r = r; this.t = 0; this.group = new THREE.Group(); this.group.position.set(x, 0, z);
    const col = ZONE_COLORS[kind] || '#ffffff'; this.color = col;
    if (kind === 'flood') {
      this.water = new THREE.Mesh(new THREE.CircleGeometry(r * 1.15, 40).rotateX(-PI / 2), makeWaterMat('disc', { cx: x, cz: z, r, alpha: 0.88 }));
      this.water.position.y = 0.09; this.water.renderOrder = 3; this.group.add(this.water);
    } else if (kind === 'ember') {
      this.group.add(decal(zoneTexture('ember'), r * 2.15, { order: 3 }));
      this.cracks = decal(zoneTexture('ember_cracks'), r * 2, { additive: true, color: '#ffffff', order: 4 }); this.cracks.position.y = 0.02; this.group.add(this.cracks);
    } else if (kind === 'gale') {
      this.group.add(decal(glowTexture(), r * 2.2, { additive: true, color: '#7fe8d0', opacity: 0.25 }));
      this.swirl = decal(zoneTexture('gale'), r * 2, { additive: true, color: '#e8fff8', opacity: 0.5, order: 4 }); this.swirl.position.y = 0.03; this.group.add(this.swirl);
      this.swirl2 = decal(zoneTexture('gale'), r * 1.4, { additive: true, color: '#bff8e8', opacity: 0.4, order: 4 }); this.swirl2.position.y = 0.04; this.group.add(this.swirl2);
    } else if (kind === 'stone') {
      this.group.add(decal(zoneTexture('stone'), r * 2, { order: 3 }));
    } else {
      this.group.add(decal(zoneTexture('swamp'), r * 2.15, { order: 3 }));
    }
    // team border ring
    this.border = decal(thinRingTexture(), r * 2.05, { additive: true, color: teamColor(team), opacity: 0.5, order: 5 }); this.border.position.y = 0.05; this.group.add(this.border);
    this.group.scale.setScalar(0.01);
    // "ground swell" upheaval: a dome of earth heaves up then settles, ring of shards erupts at the rim
    const dg = new THREE.SphereGeometry(1, 18, 7, 0, PI * 2, 0, PI / 2); { const pa = dg.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); const n = 1 + 0.08 * Math.sin(pa.getX(i) * 9.0) * Math.cos(pa.getZ(i) * 7.0); pa.setXYZ(i, pa.getX(i) * n, y * (0.85 + 0.3 * Math.abs(Math.sin(i * 12.9898))), pa.getZ(i) * n); } dg.computeVertexNormals(); }
    const dome = new THREE.Mesh(dg, new THREE.MeshLambertMaterial({ color: new THREE.Color('#7a8a52').lerp(new THREE.Color(col), 0.3), flatShading: true, transparent: true, opacity: 0.5, depthWrite: false }));
    dome.scale.set(r, 0.01, r); this.dome = dome; this.root = new THREE.Group(); this.root.position.set(x, 0, z); this.root.add(dome);
    const shardGeo = new THREE.ConeGeometry(0.9, 3.2, 4, 1); const shardMat = makeWorldMat({ vertexColors: false, color: kind === 'stone' ? '#b3a690' : new THREE.Color('#8a7a68').lerp(new THREE.Color(col), 0.3), roughness: 0.85, emissive: kind === 'ember' ? '#ff4a10' : 0x000000, emissiveIntensity: kind === 'ember' ? 0.6 : 0 });
    this.shards = [];
    const n = 18; for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2 + Math.random() * 0.2; const m = new THREE.Mesh(shardGeo, shardMat); const rr = r * (0.92 + Math.random() * 0.12); m.position.set(Math.cos(a) * rr, -3, Math.sin(a) * rr); m.rotation.set(Math.sin(a) * 0.35, Math.random() * 3, -Math.cos(a) * 0.35); m.scale.setScalar(0.7 + Math.random() * 0.7); m.userData.d = Math.random() * 0.25; m.castShadow = true; this.root.add(m); this.shards.push(m); }
    this.keepShards = kind === 'stone';
    // energy curtain marks the transformed zone (readable from anywhere on screen)
    this.wall = curtain(r * 1.0, col, kind === 'gale' ? 4.5 : 3.0); this.wall.material.uniforms.uA.value = 0; this.group.add(this.wall);
    this.teamWall = curtain(r * 1.025, teamColor(team), 0.9); this.teamWall.material.uniforms.uA.value = 0; this.group.add(this.teamWall);
    if (kind === 'finalswell') { this.group.visible = false; this.root.visible = false; }
  }
  attach(scene) { scene.add(this.group); scene.add(this.root); }
  update(dt, time, vfx, intensity = 1) {
    this.t += dt; const grow = Math.min(1, Math.max(0, (this.t - 0.5) / 1.0)); const s = 1 - Math.pow(1 - grow, 3);
    this.group.scale.setScalar(Math.max(0.01, s));
    if (this.root.visible) {
      const t = this.t;
      const H = Math.min(2.4, this.r * 0.11); const hd = t < 0.5 ? Math.sin((t / 0.5) * PI / 2) * H : t < 0.9 ? H : H * Math.max(0, 1 - (t - 0.9) / 1.2); // swell then settle
      this.dome.scale.y = Math.max(0.01, hd * 0.6); this.dome.material.opacity = 0.35 * (t < 0.9 ? 1 : Math.max(0, 1 - (t - 0.9) / 0.4)); this.dome.visible = this.dome.material.opacity > 0.01;
      for (const m of this.shards) { const k = Math.max(0, t - m.userData.d); const up = k < 0.25 ? Math.sin((k / 0.25) * PI / 2) : 1; const settle = this.keepShards ? 0.55 : Math.max(0, 1 - Math.max(0, k - 2.4) / 1.2); m.position.y = -3 + (3.3 * up) * (this.keepShards ? 1 - 0.45 * Math.min(1, Math.max(0, k - 1.6)) : settle); }
      if (vfx && t < 0.6) { const a = Math.random() * PI * 2; vfx.burst(this.x + Math.cos(a) * this.r, 0.3, this.z + Math.sin(a) * this.r, '#b8a888', 3, { style: 'dust', up: 2.5, size: 1.4 }); }
      if (!this.keepShards && t > 4) this.root.visible = false;
    }
    const { x, z, r } = this;
    const rnd = () => { const a = Math.random() * PI * 2, rr = Math.sqrt(Math.random()) * r * s; return [x + Math.cos(a) * rr, z + Math.sin(a) * rr]; };
    if (this.water) { this.water.material.uniforms.uTime.value = time; this.water.material.uniforms.uRise.value = s; }
    if (this.cracks) this.cracks.material.opacity = 0.6 + 0.4 * Math.sin(time * 2.2);
    if (this.wall) { const pulse = this.t < 1.5 ? Math.max(0, 1 - this.t / 1.5) : 0; this.wall.material.uniforms.uA.value = (0.3 + 0.08 * Math.sin(time * 2.0)) * s + pulse * 1.2; this.wall.scale.y = 1 + pulse * 1.5; this.teamWall.material.uniforms.uA.value = 0.6 * s; }
    if (this.swirl) { this.swirl.rotation.y = time * 0.9; this.swirl2.rotation.y = -time * 1.4; }
    this.border.material.opacity = 0.35 + 0.15 * Math.sin(time * 2);
    if (!vfx) return;
    const n = dt * 30 * intensity;
    for (let i = 0; i < n; i++) {
      if (Math.random() > n - i) break;
      const [px, pz] = rnd();
      if (this.kind === 'ember') vfx.trail(px, 0.2, pz, '#ff8a2a', { vy: 2.5, life: 1.4, size: 0.45, color1: '#ff3a0a', style: 'embers' });
      else if (this.kind === 'gale') vfx.add.emit({ x: px, y: 0.4 + Math.random() * 1.5, z: pz, life: 1.0, size: 0.35, size1: 0.1, color: '#e8fffa', alpha: 0.8, drag: 0, swirl: [x, z, 1.4], shape: 0 });
      else if (this.kind === 'flood') { if (Math.random() < 0.3) vfx.trail(px, 0.15, pz, '#e8fbff', { vy: 0.6, life: 0.8, size: 0.4, shape: 3 }); }
      else if (this.kind === 'swamp') { if (Math.random() < 0.4) vfx.trail(px, 0.15, pz, '#b8e070', { vy: 0.7, life: 1.0, size: 0.5, shape: 3 }); }
      else if (this.kind === 'stone') { if (Math.random() < 0.15) vfx.norm.emit({ x: px, y: 0.1, z: pz, vy: 0.6, life: 1.2, size: 0.8, size1: 1.4, color: '#c8b898', alpha: 0.35, drag: 1 }); }
    }
  }
  dispose() { for (const g of [this.group, this.root]) { g.parent?.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); } }
}

export class TelegraphFx {
  constructor(kind, x, z, r, at, team) {
    this.at = at; this.kind = kind; this.group = new THREE.Group(); this.group.position.set(x, 0, z);
    const col = ZONE_COLORS[kind] || '#ffffff';
    this.ring = decal(thinRingTexture(), r * 2, { additive: true, color: col, order: 6 }); this.ring.position.y = 0.15; this.group.add(this.ring);
    this.fill = decal(ringTexture(), r * 2, { additive: true, color: col, opacity: 0.3, order: 6 }); this.fill.position.y = 0.14; this.group.add(this.fill);
    this.team = decal(thinRingTexture(), r * 2.12, { additive: true, color: teamColor(team), opacity: 0.6, order: 6 }); this.team.position.y = 0.16; this.group.add(this.team);
    this.r = r; this.x = x; this.z = z; this.col = col; this.done = false; this.start = null;
    this.wall = curtain(r, col, 4); this.wall.material.uniforms.uA.value = 0; this.group.add(this.wall);
    this.cr = decal(zoneTexture('ember_cracks'), r * 2, { additive: true, color: col, opacity: 0, order: 5 }); this.cr.position.y = 0.06; this.group.add(this.cr);
    if (kind === 'finalswell') this.group.visible = false;
  }
  update(dt, time, simTime, vfx) {
    if (this.start == null) this.start = simTime;
    const span = Math.max(0.5, this.at - this.start); const k = Math.min(1, (simTime - this.start) / span);
    const pulse = 0.5 + 0.5 * Math.sin(time * (6 + k * 14));
    this.ring.material.opacity = 0.3 + 0.35 * pulse; this.fill.scale.setScalar(Math.max(0.02, k)); this.fill.material.opacity = 0.1 + 0.12 * pulse; this.team.material.opacity = 0.35;
    this.team.rotation.y = time * 0.5;
    this.wall.material.uniforms.uA.value = (0.25 + 0.9 * k) * (0.7 + 0.3 * pulse); this.wall.scale.y = 0.3 + 0.9 * k;
    this.cr.material.opacity = k * k * (0.5 + 0.5 * pulse); this.cr.rotation.y = 0.3;
    if (vfx && Math.random() < dt * 20) { const a = Math.random() * PI * 2; vfx.trail(this.x + Math.cos(a) * this.r, 0.2, this.z + Math.sin(a) * this.r, this.col, { vy: 3, life: 0.8, size: 0.6, shape: 2 }); }
    // the ground is swelling: inward ripples quicken, dirt hops as it rumbles
    this.rip = (this.rip || 0) - dt;
    if (vfx && this.rip <= 0) { this.rip = 0.9 - k * 0.6; vfx.ring(this.x, this.z, { color: this.col, r0: this.r * 1.0, r1: this.r * 0.2, dur: 0.9, alpha: 0.5, easeIn: true, thin: true }); }
    if (vfx && Math.random() < dt * (6 + k * 30)) { const a = Math.random() * PI * 2, rr = Math.sqrt(Math.random()) * this.r; vfx.norm.emit({ x: this.x + Math.cos(a) * rr, y: 0.1, z: this.z + Math.sin(a) * rr, vy: 2 + Math.random() * 3 * (0.5 + k), life: 0.6, size: 0.35, size1: 0.3, color: '#8a7a5a', alpha: 0.9, grav: 12, drag: 0.5, shape: 1 }); }
    if (simTime >= this.at + 0.2) this.done = true;
  }
  dispose() { this.group.parent?.remove(this.group); this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
}
