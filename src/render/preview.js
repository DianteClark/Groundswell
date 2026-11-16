// Premium hero presentation (HEROES lead): spotlight pedestal, gold rim, volumetric light cone, coloured
// rim light, slow turntable, idle + periodic ability showcase, rising skin-tinted motes.
// One shared offscreen WebGLRenderer; each preview blits into its own 2D canvas.
// Exports (used by UI): createHeroPreview(container, heroId, skinId) -> {setHero, dispose, playCast?}
//                       renderHeroPortrait(heroId, skinId, opts) -> dataURL (cached)
//                       renderHeroPortraitAsync(heroId, skinId, opts) -> Promise<dataURL>
import * as THREE from 'three';
import { buildHero, poseRig } from './models/heroes.js';
import { G, prep, mergeColored } from './models/builder.js';
import { glowTexture, disposeTree } from './util.js';
import { getSkin } from '../data/skins.js';

const PI = Math.PI;
let shared = null; // { gl, previews:Set, raf, env }

function envTexture(gl) {
  // studio gradient env (warm key from upper-front, cool fill) → PMREM
  const sc = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vD; void main(){ float y = vD.y; vec3 c = mix(vec3(0.08,0.07,0.12), vec3(0.55,0.6,0.8), smoothstep(-0.3, 0.9, y));
      c += vec3(1.0,0.85,0.65) * pow(max(dot(vD, normalize(vec3(0.4,0.7,0.6))), 0.0), 24.0) * 4.0;
      c += vec3(0.5,0.7,1.0) * pow(max(dot(vD, normalize(vec3(-0.7,0.3,-0.6))), 0.0), 12.0) * 2.0; gl_FragColor = vec4(c, 1.0); }` });
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
  const pm = new THREE.PMREMGenerator(gl); const rt = pm.fromScene(sc, 0.02); pm.dispose(); mat.dispose(); return rt.texture;
}

function getShared() {
  if (shared) return shared;
  const canvas = document.createElement('canvas');
  const gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
  gl.setClearColor(0x000000, 0); gl.setPixelRatio(1);
  gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.15; gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFShadowMap;
  shared = { gl, previews: new Set(), raf: 0, last: performance.now(), env: envTexture(gl) };
  const loop = (now) => {
    shared.raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - shared.last) / 1000); shared.last = now;
    for (const p of shared.previews) p._frame(dt);
  };
  shared.raf = requestAnimationFrame(loop);
  return shared;
}

let _coneTex = null;
function coneTexture() { // vertical gradient for the spotlight cone
  if (_coneTex) return _coneTex;
  const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0.9)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 128); _coneTex = new THREE.CanvasTexture(c); _coneTex.colorSpace = THREE.SRGBColorSpace; return _coneTex;
}
let _runeTex = null;
function pedestalRunes() {
  if (_runeTex) return _runeTex;
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'); const c = N / 2;
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(c, c, c * 0.92, 0, PI * 2); g.stroke();
  g.lineWidth = 1.5; g.setLineDash([6, 8]); g.beginPath(); g.arc(c, c, c * 0.8, 0, PI * 2); g.stroke(); g.setLineDash([]);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * PI * 2; g.beginPath(); g.arc(c + Math.cos(a) * c * 0.86, c + Math.sin(a) * c * 0.86, i % 3 ? 2 : 4, 0, PI * 2); g.fillStyle = '#fff'; g.fill(); }
  _runeTex = new THREE.CanvasTexture(cv); _runeTex.colorSpace = THREE.SRGBColorSpace; return _runeTex;
}

function pedestal() {
  const l = [];
  l.push(prep(G.cyl(2.5, 2.8, 0.42, 16), '#1c1a26', { p: [0, -0.21, 0], metal: 0.4, rough: 0.5 }));
  l.push(prep(G.cyl(2.35, 2.45, 0.08, 32), '#2c2838', { p: [0, 0.02, 0], metal: 0.3, rough: 0.35 }));
  l.push(prep(G.band(2.56, 0.07, 0.06, 40), '#e8c066', { p: [0, 0.01, 0], metal: 1, rough: 0.25 }));
  l.push(prep(G.band(2.84, 0.06, 0.06, 40), '#e8c066', { p: [0, -0.41, 0], metal: 1, rough: 0.25 }));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; l.push(prep(G.gem(0.12, 0.26, 4), '#ffd98a', { p: [Math.cos(a) * 2.68, -0.2, Math.sin(a) * 2.68], r: [0, -a, PI / 2], metal: 1, rough: 0.2, glow: 0.6 })); }
  const g = mergeColored(l);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.4, metalness: 0.6 })); m.receiveShadow = true; return m;
}

export function createHeroPreview(container, heroId, skinId) {
  const S = getShared();
  const cv = document.createElement('canvas'); cv.style.width = '100%'; cv.style.height = '100%'; cv.style.display = 'block';
  container.appendChild(cv); const ctx = cv.getContext('2d');
  const scene = new THREE.Scene(); scene.environment = S.env; scene.environmentIntensity = 0.55;
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight('#cfd8ff', '#2a2438', 0.7));
  const key = new THREE.SpotLight('#fff2dc', 60, 30, 0.42, 0.55, 1.2); key.position.set(0, 12, 3.5); key.target.position.set(0, 1.4, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; scene.add(key, key.target);
  const rimA = new THREE.DirectionalLight('#9ab8ff', 2.4); rimA.position.set(-5, 4, -6); scene.add(rimA);
  const rimB = new THREE.DirectionalLight('#ffd9a0', 1.6); rimB.position.set(6, 3, -4); scene.add(rimB);
  const fill = new THREE.DirectionalLight('#ffffff', 0.5); fill.position.set(2, 2, 8); scene.add(fill);
  const ped = pedestal(); scene.add(ped);
  const runes = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: pedestalRunes(), color: new THREE.Color('#ffd98a').multiplyScalar(1.4), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  runes.position.y = 0.075; scene.add(runes);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ffffff', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.position.y = 0.08; scene.add(pool);
  // volumetric spotlight cone
  const coneGeo = new THREE.CylinderGeometry(0.35, 2.6, 9, 32, 1, true); coneGeo.translate(0, 4.5, 0);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ map: coneTexture(), color: '#fff0d8', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  scene.add(cone);
  const turn = new THREE.Group(); scene.add(turn);
  // rising motes
  const motes = new THREE.Group(); scene.add(motes);
  const moteMat = new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 22; i++) { const s = new THREE.Sprite(moteMat); s.userData.ph = Math.random() * 10; s.userData.r = 0.8 + Math.random() * 2.0; s.userData.sp = 0.25 + Math.random() * 0.45; s.userData.sz = 0.12 + Math.random() * 0.22; motes.add(s); }
  let rig = null, t = 0, h = 3, nextShow = 2.5, showIdx = 0, castT = -10, slot = null;
  const api = {
    setHero(hid, sid) {
      if (rig) { turn.remove(rig.root); disposeTree(rig.root); }
      rig = buildHero(hid, sid, { rimStrength: 0.75, scale: 1 }); turn.add(rig.root); h = rig.def.height || 3;
      rig.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      const sk = getSkin(hid, sid); const vc = new THREE.Color(sk?.colors?.vfx || '#ffffff');
      pool.material.color.copy(vc).lerp(new THREE.Color(1, 1, 1), 0.4); moteMat.color.copy(vc).multiplyScalar(1.6);
      rimA.color.copy(vc).lerp(new THREE.Color('#9ab8ff'), 0.4); cone.material.color.copy(vc).lerp(new THREE.Color('#fff0d8'), 0.75);
      const leg = sk?.rarity === 'legendary'; runes.material.color.set(leg ? '#ffd98a' : sk?.rarity === 'epic' ? '#d8a0ff' : '#a8c8ff').multiplyScalar(1.4);
      api.playCast('r');
    },
    playCast(s = 'q') { slot = s; castT = t; },
    dispose() { S.previews.delete(api); if (rig) disposeTree(rig.root); disposeTree(scene); cv.remove(); },
    _frame(dt) {
      if (!cv.isConnected) return;
      const w = Math.max(1, container.clientWidth), hh = Math.max(1, container.clientHeight);
      const pr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.round(w * pr), H = Math.round(hh * pr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const sz = S.gl.getSize(new THREE.Vector2());
      if (sz.x < W || sz.y < H) S.gl.setSize(Math.max(sz.x, W), Math.max(sz.y, H), false);
      t += dt;
      turn.rotation.y = 0.45 + Math.sin(t * 0.35) * 0.55 + t * 0.0;
      if (t > nextShow) { api.playCast(['q', 'w', 'r', 'attack'][showIdx++ % 4]); nextShow = t + 6 + Math.random() * 2; }
      if (rig) {
        const k = t - castT; let anim = { state: 'idle', t };
        if (slot === 'attack' && k < 1.0) anim = { state: 'attack', t: k, dur: 1.0 };
        else if (slot && slot !== 'attack' && k < 0.3) anim = { state: 'cast', t: k, slot };
        poseRig(rig, anim, t, false);
      }
      runes.rotation.y = t * 0.15; cone.material.opacity = 0.14 + Math.sin(t * 1.3) * 0.02;
      motes.children.forEach((s) => { const u = s.userData; const a = u.ph + t * u.sp * 0.6; const y = ((t * u.sp * 0.7 + u.ph) % 4.5); s.position.set(Math.cos(a) * u.r, y, Math.sin(a) * u.r); s.scale.setScalar(u.sz * (1 - y / 4.5) * 2.2); s.material.opacity = 0.9; });
      cam.aspect = w / hh; const tf = Math.tan((cam.fov * PI) / 360);
      const dist = Math.max((h * 0.6 + 0.6) / tf, 3.4 / (tf * cam.aspect));
      cam.position.set(0, h * 0.55 + dist * 0.16, dist); cam.lookAt(0, h * 0.44, 0); cam.updateProjectionMatrix();
      const full = S.gl.getSize(new THREE.Vector2());
      S.gl.setViewport(0, full.y - H, W, H); S.gl.setScissor(0, full.y - H, W, H); S.gl.setScissorTest(true);
      S.gl.clear(); S.gl.render(scene, cam);
      ctx.clearRect(0, 0, W, H); ctx.drawImage(S.gl.domElement, 0, 0, W, H, 0, 0, W, H);
    },
  };
  api.setHero(heroId, skinId);
  S.previews.add(api);
  return api;
}

// ───────────────────────── static portraits (shop cards, loading screen) ─────────────────────────
const portraitCache = new Map();
let pScene = null;
function portraitScene() {
  if (pScene) return pScene;
  const S = getShared();
  const scene = new THREE.Scene(); scene.environment = S.env; scene.environmentIntensity = 0.6;
  scene.add(new THREE.HemisphereLight('#e0e8ff', '#3a3048', 0.8));
  const key = new THREE.DirectionalLight('#fff0dd', 3.0); key.position.set(3, 6, 7); scene.add(key);
  const rim = new THREE.DirectionalLight('#a8c4ff', 3.0); rim.position.set(-6, 5, -5); scene.add(rim);
  const rim2 = new THREE.DirectionalLight('#ffd9a0', 1.6); rim2.position.set(6, 3, -4); scene.add(rim2);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  const holder = new THREE.Group(); scene.add(holder);
  pScene = { scene, cam, holder, rim };
  return pScene;
}
function simulatePose(rig, pose) {
  if (pose === 'action' || pose === 'hero') {
    // play the ultimate cast forward to its held release pose
    for (let f = 0; f <= 30; f++) { const tt = f / 60; poseRig(rig, { state: tt < 0.3 ? 'cast' : 'idle', t: tt, slot: 'r' }, 2 + tt, false); }
  } else { for (let f = 0; f < 4; f++) poseRig(rig, { state: 'idle', t: f / 60 }, 0.4 + f / 60, false); }
}

/**
 * Render a hero portrait to a PNG data URL (cached by key).
 * opts: { size=256, pose:'idle'|'action'|'hero', bg:true|false|'transparent', framing:'bust'|'full' }
 */
export function renderHeroPortrait(heroId, skinId, opts = {}) {
  const size = opts.size || 256, pose = opts.pose || 'idle', bg = opts.bg !== false && opts.bg !== 'transparent', framing = opts.framing || 'bust';
  const ck = `${heroId}|${skinId}|${size}|${pose}|${bg}|${framing}`;
  if (portraitCache.has(ck)) return portraitCache.get(ck);
  const S = getShared(); const P = portraitScene();
  const rig = buildHero(heroId, skinId, { rimStrength: 0.85, scale: 1 });
  P.holder.add(rig.root);
  rig.root.rotation.y = pose === 'idle' ? 0.35 : 0.5;
  simulatePose(rig, pose);
  const sk = getSkin(heroId, skinId); P.rim.color.set(sk?.colors?.vfx || '#a8c4ff').lerp(new THREE.Color('#a8c4ff'), 0.35);
  const h = rig.def.height || 3;
  const tf = Math.tan((P.cam.fov * PI) / 360);
  if (framing === 'full') { const d = (h * 0.62) / tf; P.cam.position.set(0, h * 0.55, d); P.cam.lookAt(0, h * 0.47, 0); }
  else { const by = rig.def.bust ?? 0.68; const d = (h * 0.4) / tf; P.cam.position.set(0, h * (by + 0.12), d); P.cam.lookAt(0, h * by, 0); }
  P.cam.aspect = 1; P.cam.updateProjectionMatrix();
  const full = S.gl.getSize(new THREE.Vector2());
  if (full.x < size || full.y < size) S.gl.setSize(Math.max(full.x, size), Math.max(full.y, size), false);
  const fy = S.gl.getSize(new THREE.Vector2()).y;
  S.gl.setScissorTest(true); S.gl.setViewport(0, fy - size, size, size); S.gl.setScissor(0, fy - size, size, size);
  S.gl.clear(); S.gl.render(P.scene, P.cam);
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d');
  if (bg) {
    const vc = new THREE.Color(sk?.colors?.vfx || '#8090ff');
    const darkc = vc.clone().multiplyScalar(0.14).getStyle(), mid = vc.clone().multiplyScalar(0.5).getStyle();
    const gr = g.createRadialGradient(size * 0.5, size * 0.38, size * 0.05, size * 0.5, size * 0.5, size * 0.78);
    gr.addColorStop(0, mid); gr.addColorStop(1, darkc); g.fillStyle = gr; g.fillRect(0, 0, size, size);
    // spotlight beam
    const sb = g.createLinearGradient(0, 0, 0, size); sb.addColorStop(0, 'rgba(255,240,220,0.22)'); sb.addColorStop(1, 'rgba(255,240,220,0)');
    g.fillStyle = sb; g.beginPath(); g.moveTo(size * 0.38, 0); g.lineTo(size * 0.62, 0); g.lineTo(size * 0.9, size); g.lineTo(size * 0.1, size); g.closePath(); g.fill();
    g.globalAlpha = 0.22; g.strokeStyle = '#ffe2a0'; g.lineWidth = size / 128;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(size / 2, size * 1.05, size * (0.5 + i * 0.18), PI, 0); g.stroke(); }
    g.globalAlpha = 1;
  }
  g.drawImage(S.gl.domElement, 0, 0, size, size, 0, 0, size, size);
  const url = cv.toDataURL('image/png');
  P.holder.remove(rig.root); disposeTree(rig.root);
  portraitCache.set(ck, url);
  return url;
}
/** Async/lazy variant: resolves on an idle frame so many portraits don't block a single frame. */
export function renderHeroPortraitAsync(heroId, skinId, opts = {}) {
  return new Promise((res) => { const run = () => res(renderHeroPortrait(heroId, skinId, opts)); (window.requestIdleCallback || ((f) => setTimeout(f, 0)))(run); });
}
