// Team structures (tower spires, crystal core, fountain gate), rubble, and decorative set pieces
// (wyrm / colossus arenas, bridges, camp props). Towers/cores are standalone groups (they die);
// the rest is pushed into the StaticWorld batches.
import * as THREE from 'three';
import { P, merge, gemGeo, PREFAB } from './props.js';
import { makeWorldMat, makeGlowMat, glowTexture, teamColor, mkRand, WORLD } from '../util.js';

const PI = Math.PI;
const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg, 1);
const cone = (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg, 1);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const oct = (r) => new THREE.OctahedronGeometry(r, 0);
const dodec = (r) => new THREE.DodecahedronGeometry(r, 0);

const STONE = '#d3c9b6', STONE2 = '#a99e8b', DARK = '#3e3a46', GOLD = '#e8c46a';
export const TEAM_TRIM = ['#2f6fe0', '#e0404e', '#c9a85a'];

// rune circle texture (additive decals)
const _runes = {};
export function runeCircleTexture(kind = 'a') {
  if (_runes[kind]) return _runes[kind];
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const R = mkRand(kind.charCodeAt(0) * 31);
  g.translate(N / 2, N / 2); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
  const ring = (r, w, a = 1) => { g.globalAlpha = a; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, PI * 2); g.stroke(); g.globalAlpha = 1; };
  ring(244, 6); ring(228, 2, 0.8); ring(160, 4); ring(150, 1.5, 0.7);
  // glyph band
  const n = 28; for (let i = 0; i < n; i++) { const a = i / n * PI * 2; g.save(); g.rotate(a); g.translate(0, -192); g.lineWidth = 3.5; g.beginPath();
    const t = Math.floor(R() * 5); if (t === 0) { g.moveTo(-8, -12); g.lineTo(0, 12); g.lineTo(8, -12); } else if (t === 1) { g.moveTo(-9, 0); g.lineTo(9, 0); g.moveTo(0, -12); g.lineTo(0, 12); } else if (t === 2) { g.arc(0, 0, 9, 0, PI * 1.5); } else if (t === 3) { g.moveTo(-8, -10); g.lineTo(8, -10); g.lineTo(-8, 10); g.lineTo(8, 10); } else { g.moveTo(0, -12); g.lineTo(9, 0); g.lineTo(0, 12); g.lineTo(-9, 0); g.closePath(); }
    g.stroke(); g.restore(); }
  // inner star
  g.lineWidth = 3; g.globalAlpha = 0.85; g.beginPath(); const k = kind === 'b' ? 6 : 8; for (let i = 0; i <= k; i++) { const a = i * (PI * 2 / k) * (k === 8 ? 3 : 2); const x = Math.sin(a) * 148, y = -Math.cos(a) * 148; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  g.globalAlpha = 1; ring(40, 5); ring(70, 2, 0.6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _runes[kind] = t; return t;
}
export function runeDecal(size, color, opacity = 0.8, kind = 'a') {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: runeCircleTexture(kind), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.renderOrder = 4; return m;
}
export function halo(color, size, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  s.scale.set(size, size, 1); return s;
}
// vertical light beam (additive, fades upward)
let _beamMat = null;
export function beamMesh(color, r = 1.2, h = 26) {
  const g = new THREE.CylinderGeometry(r * 0.6, r, h, 12, 1, true); g.translate(0, h / 2, 0);
  const m = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color) }, uTime: WORLD.uTime, uA: { value: 0.5 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uTime; uniform float uA; varying vec2 vUv; void main(){ float e = sin(vUv.x * 3.14159 * 2.0 * 3.0 + uTime*1.5)*0.15 + 0.85; float a = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.6) * e * uA * (0.8 + 0.2*sin(uTime*2.0 + vUv.y*8.0)); gl_FragColor = vec4(uColor * a * 1.6, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  void _beamMat; const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 12; return mesh;
}

// ───────────────────────── tower ─────────────────────────
export function buildTowerV3(team) {
  const tc = teamColor(team); const trim = TEAM_TRIM[team] ?? TEAM_TRIM[2]; const R = mkRand(team * 17 + 5);
  const root = new THREE.Group();
  const body = [], glow = [];
  body.push(P(cyl(2.75, 3.05, 0.55, 6), STONE2, { p: [0, 0.27, 0], grad: [0.6, 1], r: [0, PI / 6, 0] }));
  body.push(P(cyl(2.3, 2.6, 0.5, 6), STONE, { p: [0, 0.8, 0], r: [0, PI / 6, 0] }));
  body.push(P(cyl(1.3, 1.85, 4.6, 6), STONE, { p: [0, 3.35, 0], grad: [0.75, 1.08] }));
  body.push(P(cyl(1.62, 1.62, 0.32, 6), trim, { p: [0, 1.45, 0] }));
  body.push(P(cyl(1.55, 1.3, 0.55, 6), DARK, { p: [0, 5.85, 0] }));
  body.push(P(cyl(1.9, 1.55, 0.3, 6), GOLD, { p: [0, 6.2, 0] }));
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + PI / 6; const x = Math.cos(a), z = Math.sin(a);
    body.push(P(box(0.55, 3.0, 0.75), STONE2, { p: [x * 1.75, 2.4, z * 1.75], r: [z * 0.16, -a, -x * 0.16], grad: [0.7, 1.05] }));
    glow.push(P(box(0.14, 2.6, 0.1), trim, { p: [x * 1.42, 3.5, z * 1.42], r: [z * 0.06, -a + PI / 2, -x * 0.06], fj: 0 })); }
  // crown prongs cradling the orb
  for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; const x = Math.cos(a), z = Math.sin(a);
    body.push(P(box(0.32, 1.9, 0.42), DARK, { p: [x * 1.35, 7.1, z * 1.35], r: [-z * 0.42, -a, x * 0.42] }));
    body.push(P(cone(0.24, 0.9, 4), GOLD, { p: [x * 1.0, 8.3, z * 1.0], r: [-z * 0.6, 0, x * 0.6] })); }
  glow.push(P(cyl(1.05, 1.05, 0.08, 12), trim, { p: [0, 6.38, 0], fj: 0 }));
  glow.push(P(box(0.6, 0.6, 0.08), '#ffffff', { p: [0, 2.3, 1.98 * Math.cos(PI / 6) - 0.05], r: [0.2, 0, PI / 4], fj: 0 }));
  const mat = makeWorldMat({ rim: tc, rimStrength: 0.5, roughness: 0.8 });
  const glowMat = makeGlowMat(0xffffff, { vertexColors: true });
  const bm = new THREE.Mesh(merge(body), mat); bm.castShadow = true; bm.receiveShadow = true; root.add(bm);
  const gm = new THREE.Mesh(merge(glow), glowMat); root.add(gm);
  // orb crystal
  const crystal = new THREE.Group(); crystal.position.set(0, 7.75, 0); crystal.userData.rest = { p: crystal.position.clone() }; root.add(crystal);
  const cMat = makeGlowMat(tc, { boost: 1 }); const core = new THREE.Mesh(merge([P(oct(0.75), '#ffffff', { s: [0.8, 1.45, 0.8], grad: [0.8, 1.2], fj: 0.2 })]), makeGlowMat(0xffffff, { vertexColors: true }));
  core.material.color.set(tc).lerp(new THREE.Color(1, 1, 1), 0.5); crystal.add(core);
  const shell = new THREE.Mesh(merge([P(oct(1.05), tc, { s: [0.8, 1.45, 0.8], fj: 0.15 })]), makeWorldMat({ roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.6, emissive: tc, emissiveIntensity: 0.55, env: 2 }));
  shell.material.depthWrite = false; crystal.add(shell);
  void cMat;
  const h = halo(tc, 5.2, 0.75); crystal.add(h);
  const ring = new THREE.Group(); ring.position.y = 7.75; root.add(ring);
  const rm = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 3, 32), makeGlowMat(tc)); rm.rotation.x = PI / 2; ring.add(rm);
  return { root, bones: { crystal, ring }, mat, glowMat: core.material, shell, halo: h, core, height: 9.4, def: { height: 9.4 }, team, kind: 'tower' };
}

// ───────────────────────── core ─────────────────────────
export function buildCoreV3(team) {
  const tc = teamColor(team); const trim = TEAM_TRIM[team] ?? TEAM_TRIM[2];
  const root = new THREE.Group(); const body = [], glow = [];
  body.push(P(cyl(6.0, 6.4, 0.6, 8), STONE2, { p: [0, 0.3, 0], r: [0, PI / 8, 0], grad: [0.6, 1] }));
  body.push(P(cyl(5.0, 5.4, 0.6, 8), STONE, { p: [0, 0.9, 0], r: [0, PI / 8, 0] }));
  body.push(P(cyl(3.9, 4.3, 0.6, 8), STONE, { p: [0, 1.5, 0], r: [0, PI / 8, 0] }));
  body.push(P(cyl(3.1, 3.3, 0.35, 8), DARK, { p: [0, 1.95, 0], r: [0, PI / 8, 0] }));
  glow.push(P(cyl(5.42, 5.42, 0.1, 32), trim, { p: [0, 1.22, 0], fj: 0 }));
  glow.push(P(cyl(4.32, 4.32, 0.1, 32), trim, { p: [0, 1.82, 0], fj: 0 }));
  for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; const x = Math.cos(a), z = Math.sin(a);
    body.push(P(box(1.1, 6.5, 1.1), STONE, { p: [x * 4.6, 3.6, z * 4.6], r: [z * 0.22, -a, -x * 0.22], grad: [0.7, 1.08] }));
    body.push(P(cone(0.8, 1.2, 4), GOLD, { p: [x * 3.9, 7.3, z * 3.9], r: [z * 0.22, -a + PI / 4, -x * 0.22] }));
    glow.push(P(box(0.2, 4.6, 0.14), trim, { p: [x * 4.22, 3.8, z * 4.22], r: [z * 0.22, -a + PI / 2, -x * 0.22], fj: 0 }));
    glow.push(P(gemGeo(0.45, 1.6, 6), '#ffffff', { p: [x * 3.7, 7.9, z * 3.7], fj: 0 })); }
  const mat = makeWorldMat({ rim: tc, rimStrength: 0.5, roughness: 0.75 });
  const glowMat = makeGlowMat(0xffffff, { vertexColors: true });
  const bm = new THREE.Mesh(merge(body), mat); bm.castShadow = true; bm.receiveShadow = true; root.add(bm);
  const gm = new THREE.Mesh(merge(glow), glowMat); root.add(gm);
  const crystal = new THREE.Group(); crystal.position.set(0, 6.4, 0); crystal.userData.rest = { p: crystal.position.clone() }; root.add(crystal);
  const big = new THREE.Mesh(merge([P(gemGeo(1.7, 5.4, 6), tc, { p: [0, -2.4, 0], grad: [0.55, 1.1], fj: 0.22 }), P(gemGeo(1.3, 2.6, 6), tc, { p: [0, -2.4, 0], r: [PI, 0, 0], grad: [0.5, 0.9], fj: 0.22 })]),
    makeWorldMat({ roughness: 0.18, metalness: 0.1, emissive: tc, emissiveIntensity: 0.45, env: 1.6 }));
  crystal.add(big);
  const inner = new THREE.Mesh(merge([P(gemGeo(0.8, 3.6, 6), '#ffffff', { p: [0, -1.6, 0], fj: 0 })]), makeGlowMat(new THREE.Color(tc).lerp(new THREE.Color(1, 1, 1), 0.3)));
  crystal.add(inner);
  crystal.add(halo(tc, 11, 0.35));
  const ring = new THREE.Group(); ring.position.y = 6.4; root.add(ring);
  const shardGeo = merge([P(gemGeo(0.38, 1.6, 5), tc, { p: [0, -0.8, 0], grad: [0.8, 1.3], top: '#ffffff', fj: 0.1 })]);
  const shardMat = makeWorldMat({ roughness: 0.15, emissive: tc, emissiveIntensity: 0.6, env: 2 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; const s = new THREE.Mesh(shardGeo, shardMat); s.position.set(Math.cos(a) * 3.3, Math.sin(i * 1.7) * 0.6, Math.sin(a) * 3.3); s.rotation.z = Math.cos(a) * 0.3; ring.add(s); }
  for (const [rr, tilt] of [[3.9, 0.25], [3.0, -0.4]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.06, 3, 48), makeGlowMat(tc)); t.rotation.x = PI / 2 + tilt; ring.add(t); }
  const beam = beamMesh(tc, 1.6, 34); beam.position.y = 4; root.add(beam);
  const rune = runeDecal(15, tc, 0.7, 'b'); rune.position.y = 2.15; root.add(rune);
  return { root, bones: { crystal, ring, rune }, mat, glowMat: inner.material, big, beam, height: 11.5, def: { height: 11.5 }, team, kind: 'core' };
}

// ───────────────────────── rubble ─────────────────────────
export function buildRubbleV3(kind, team) {
  const R = mkRand(kind === 'core' ? 99 : 41 + team); const tc = teamColor(team); const l = [], cr = [];
  const big = kind === 'core';
  if (big) { l.push(P(cyl(6.0, 6.4, 0.6, 8), STONE2, { p: [0, 0.3, 0], r: [0, PI / 8, 0] })); l.push(P(cyl(5.0, 5.4, 0.6, 8), STONE, { p: [0, 0.9, 0], r: [0, PI / 8, 0], jit: 0.3, R })); }
  else { l.push(P(cyl(2.75, 3.05, 0.55, 6), STONE2, { p: [0, 0.27, 0], r: [0, PI / 6, 0] })); l.push(P(cyl(1.5, 1.85, 1.8, 6), STONE, { p: [0, 1.4, 0], jit: 0.45, R, jitY: 2 })); }
  const n = big ? 16 : 10;
  for (let i = 0; i < n; i++) { const a = R() * PI * 2, r = (big ? 3 : 1.6) + R() * (big ? 4 : 2.6); const s = 0.35 + R() * (big ? 0.8 : 0.5);
    l.push(P(i % 3 ? dodec(s) : box(s * 1.8, s, s * 1.2), i % 2 ? STONE : STONE2, { p: [Math.cos(a) * r, s * 0.4, Math.sin(a) * r], r: [R() * 3, R() * 3, R() * 3], jit: s * 0.3, R })); }
  for (let i = 0; i < (big ? 9 : 5); i++) { const a = R() * PI * 2, r = R() * (big ? 3 : 1.8); const h = 0.6 + R() * (big ? 1.6 : 0.9);
    cr.push(P(gemGeo(0.2 + h * 0.12, h, 5), tc, { p: [Math.cos(a) * r, big ? 1.0 : 0.3, Math.sin(a) * r], r: [(R() - 0.5) * 1.6, R() * 3, (R() - 0.5) * 1.6], grad: [0.4, 0.9], fj: 0.2 })); }
  const g = new THREE.Group();
  const m = new THREE.Mesh(merge(l), makeWorldMat({ roughness: 0.9 })); m.castShadow = true; m.receiveShadow = true; g.add(m);
  const c = new THREE.Mesh(merge(cr), makeWorldMat({ roughness: 0.2, emissive: tc, emissiveIntensity: 0.35 })); c.castShadow = true; g.add(c);
  // scorch
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
  sc.scale.setScalar(big ? 18 : 9); sc.position.y = 0.03; sc.renderOrder = 1; g.add(sc);
  return g;
}

// ───────────────────────── static set pieces ─────────────────────────
/** fountain gate: pushes into static world, returns dynamic bits (floating crystal, rune) */
export function buildFountain(world, terrain, f, R) {
  const tc = teamColor(f.team); const trim = TEAM_TRIM[f.team]; const side = f.team === 0 ? -1 : 1; // toward the map edge
  const dyn = new THREE.Group();
  // walkable rim stones around the healing pool
  const rim = merge([P(box(1.6, 0.28, 0.75), STONE, { p: [0, 0.14, 0], grad: [0.7, 1.05] })]);
  for (let i = 0; i < 18; i++) { const a = i / 18 * PI * 2; world.add('stone', rim, f.x + Math.cos(a) * 6.2, 0, f.y + Math.sin(a) * 6.2, { ry: -a + PI / 2 }); }
  // pillars with braziers on the arc toward the base
  const pil = merge([P(cyl(0.55, 0.7, 2.6, 8), STONE, { p: [0, 1.3, 0], grad: [0.7, 1.05] }), P(cyl(0.8, 0.6, 0.35, 8), STONE2, { p: [0, 2.75, 0] }), P(box(1.1, 0.3, 1.1), STONE2, { p: [0, 0.15, 0] })]);
  const flame = merge([P(gemGeo(0.38, 0.8, 5), trim, { p: [0, 2.95, 0], top: '#ffffff', fj: 0 })]);
  for (const a0 of [-1.1, -0.55, 0, 0.55, 1.1]) { const a = (f.team === 0 ? 0 : PI) + a0; const x = f.x + Math.cos(a) * 9.8, z = f.y + Math.sin(a) * 9.8;
    world.add('stone', pil, x, 0, z); world.add('glow', flame, x, 0, z); }
  // grand gate on the border hill behind the fountain
  const gx = f.x + side * 9.5; const gy = terrain.heightAt(gx, f.y) - 0.3;
  const post = merge([P(box(2.2, 11, 2.2), STONE, { p: [0, 5.5, 0], grad: [0.65, 1.08] }), P(box(2.8, 0.8, 2.8), STONE2, { p: [0, 0.4, 0] }), P(box(2.8, 0.7, 2.8), STONE2, { p: [0, 10.8, 0] }), P(cone(1.1, 2.0, 4), GOLD, { p: [0, 12.2, 0], r: [0, PI / 4, 0] })]);
  for (const s of [-1, 1]) world.add('stone', post, gx, gy, f.y + s * 7.5);
  const lintel = merge([P(box(2.4, 1.3, 17), STONE, { p: [0, 0, 0], grad: [0.7, 1.05] }), P(box(2.6, 0.4, 17.6), STONE2, { p: [0, 0.8, 0] }), P(box(0.12, 0.6, 12), trim, { p: [-side * 1.22, 0, 0] })]);
  world.add('stone', lintel, gx, gy + 9.6, f.y);
  const strips = merge([P(box(0.1, 8, 0.5), trim, { p: [0, 4.5, 0], fj: 0 })]);
  for (const s of [-1, 1]) world.add('glow', strips, gx - side * 1.12, gy, f.y + s * 7.5);
  const cloth = PREFAB.bannerCloth(tc);
  for (const s of [-1, 1]) world.add('cover', cloth, gx - side * 1.4, gy + 9.0 - 4.05 + 1.2 - 2.4, f.y + s * 4.2 - 0.65, { ry: PI / 2, wind: 0.5, windPow: 1, phase: s, sy: 1.25 });
  // big floating crystal under the arch
  const cr = new THREE.Group(); cr.position.set(gx, gy + 6, f.y);
  const gem = new THREE.Mesh(merge([P(gemGeo(1.2, 3.8, 6), tc, { p: [0, -1.9, 0], grad: [0.8, 1.3], top: '#ffffff', fj: 0.15 }), P(gemGeo(1.0, 1.8, 6), tc, { p: [0, -1.9, 0], r: [PI, 0, 0] })]), makeWorldMat({ roughness: 0.15, emissive: tc, emissiveIntensity: 0.6, env: 2 }));
  cr.add(gem); cr.add(halo(tc, 9, 0.4)); dyn.add(cr);
  const rune = runeDecal(17, tc, 0.55, 'a'); rune.position.set(f.x, 0.05, f.y); dyn.add(rune);
  const beam = beamMesh(tc, 2.2, 20); beam.position.set(f.x, 0, f.y); beam.material.uniforms.uA.value = 0.22; dyn.add(beam);
  return { group: dyn, crystal: cr, rune, gemY: gy + 6 };
}

export function buildPit(world, key, p, R, color) {
  const dyn = new THREE.Group();
  if (key === 'wyrm') {
    // ring of dragon ribs / horns arching inward + a half-buried skull
    const ribGeo = (len) => { const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector3(0, Math.sin(t * PI * 0.55) * len, -t * len * 0.55)); } const c = new THREE.CatmullRomCurve3(pts);
      const g = new THREE.TubeGeometry(c, 6, 0.34, 5, false); const pa = g.attributes.position; for (let i = 0; i < pa.count; i++) { const t = Math.floor(i / 6) / 6; const pt = c.getPoint(t); const k = 1 - t * 0.85; pa.setXYZ(i, pt.x + (pa.getX(i) - pt.x) * k, pt.y + (pa.getY(i) - pt.y) * k, pt.z + (pa.getZ(i) - pt.z) * k); } return g; };
    const rib = merge([P(ribGeo(4.2), '#ece2c8', { grad: [0.6, 1.1], fj: 0.1 })]);
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2 + 0.31; if (Math.abs(Math.sin(a)) < 0.25) continue; const r = p.r + 2.4;
      world.add('stone', rib, p.x + Math.cos(a) * r, -0.3, p.y + Math.sin(a) * r, { ry: -a - PI / 2 + PI, s: 0.9 + R() * 0.3 }); }
    const sk = merge([P(new THREE.SphereGeometry(1.6, 7, 5), '#e6dcc2', { s: [1.2, 0.8, 1.6], jit: 0.3, R, grad: [0.6, 1.1] }), P(cone(0.35, 2.2, 5), '#e6dcc2', { p: [0.9, 1.0, -0.6], r: [-0.6, 0, -0.5] }), P(cone(0.35, 2.2, 5), '#e6dcc2', { p: [-0.9, 1.0, -0.6], r: [-0.6, 0, 0.5] }), P(box(0.5, 0.35, 0.3), '#1a1418', { p: [0.55, 0.35, 1.5] }), P(box(0.5, 0.35, 0.3), '#1a1418', { p: [-0.55, 0.35, 1.5] })]);
    world.add('stone', sk, p.x, -0.2, p.y - p.r - 3.4, { ry: 0 });
    for (let i = 0; i < 6; i++) { const a = R() * PI * 2; world.add('glow', PREFAB.crystal(R, color), p.x + Math.cos(a) * (p.r + 1.0), 0, p.y + Math.sin(a) * (p.r + 1.0), { s: 0.7 + R() * 0.4 }); }
  } else {
    const colm = PREFAB.column(R, 4.2, true), colm2 = PREFAB.column(R, 2.4, true);
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2 + 0.2; const r = p.r + 2.2; world.add('stone', i % 3 === 1 ? colm2 : colm, p.x + Math.cos(a) * r, 0, p.y + Math.sin(a) * r, { ry: R() * 3 }); }
    const fallen = merge([P(new THREE.CylinderGeometry(0.46, 0.46, 3.4, 8), '#c9bfae', { r: [0, 0, PI / 2], jit: 0.06, R })]);
    world.add('stone', fallen, p.x + p.r + 4.5, 0.4, p.y + 2, { ry: 0.6 }); world.add('stone', fallen, p.x - p.r - 4.2, 0.4, p.y - 3, { ry: -0.4 });
    for (let i = 0; i < 7; i++) { const a = R() * PI * 2; world.add('glow', PREFAB.crystal(R, '#b07aff'), p.x + Math.cos(a) * (p.r + 1.4), 0, p.y + Math.sin(a) * (p.r + 1.4), { s: 0.8 + R() * 0.6 }); }
  }
  const rune = runeDecal(p.r * 2.3, color, 0.6, key === 'wyrm' ? 'a' : 'b'); rune.position.set(p.x, 0.04, p.y); dyn.add(rune);
  return { group: dyn, rune };
}

export function buildBridge(world, x, z, len, wid, R) {
  // deck flush with the floor; parapets + arch facade; lanterns on the corners
  const deck = merge([P(box(len, 0.9, wid), '#b5aa96', { p: [0, -0.45, 0], grad: [0.6, 1], fj: 0.06 })]);
  world.add('stone', deck, x, 0, z);
  const plank = merge([P(box(0.9, 0.08, wid - 0.6), '#b48a5c', { fj: 0.2 })]);
  for (let i = 0; i < Math.floor(len / 1.0); i++) world.add('stone', plank, x - len / 2 + 0.5 + i, 0.0, z, { sy: 1 });
  const para = merge([P(box(len + 0.6, 0.75, 0.55), '#a79c88', { p: [0, 0.37, 0], grad: [0.7, 1.08], jit: 0.04, R })]);
  for (const s of [-1, 1]) world.add('stone', para, x, 0, z + s * (wid / 2 + 0.2));
  const arch = merge([P(new THREE.TorusGeometry(len * 0.36, 0.45, 4, 10, PI), '#9c917e', { p: [0, -1.4, 0], grad: [0.6, 1] })]);
  for (const s of [-1, 1]) world.add('stone', arch, x, 0, z + s * (wid / 2 + 0.25));
  const post = PREFAB.lanternPost(), lg = PREFAB.lanternGlow();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const px = x + sx * (len / 2 + 0.3), pz = z + sz * (wid / 2 + 0.3); world.add('stone', post, px, 0, pz, { ry: sx > 0 ? PI : 0 }); world.add('glow', lg, px, 0, pz, { ry: sx > 0 ? PI : 0 }); }
}
