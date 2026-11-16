// Lightweight hero preview (menus/shop): one shared offscreen WebGLRenderer, each preview blits into its own 2D canvas.
import * as THREE from 'three';
import { buildHero, poseRig } from './models/heroes.js';
import { G, prep, mergeColored } from './models/builder.js';
import { makeToonMat, glowTexture, disposeTree } from './util.js';
import { getSkin } from '../data/skins.js';

let shared = null; // { gl, previews:Set, raf }

function getShared() {
  if (shared) return shared;
  const canvas = document.createElement('canvas');
  const gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
  gl.setClearColor(0x000000, 0); gl.setPixelRatio(1);
  shared = { gl, previews: new Set(), raf: 0, last: performance.now() };
  const loop = (now) => {
    shared.raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - shared.last) / 1000); shared.last = now;
    for (const p of shared.previews) p._frame(dt);
  };
  shared.raf = requestAnimationFrame(loop);
  return shared;
}

function pedestal() {
  const l = [];
  l.push(prep(G.cyl(2.4, 2.7, 0.5, 10), '#3a3550', { p: [0, -0.25, 0] }));
  l.push(prep(G.cyl(2.2, 2.3, 0.12, 10), '#5a5478', { p: [0, 0.03, 0] }));
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; l.push(prep(G.box(0.5, 0.2, 0.2), '#7a7298', { p: [Math.cos(a) * 2.55, -0.2, Math.sin(a) * 2.55], r: [0, -a, 0] })); }
  const m = new THREE.Mesh(mergeColored(l), makeToonMat({ rimStrength: 0.2 })); m.receiveShadow = true; return m;
}

export function createHeroPreview(container, heroId, skinId) {
  const S = getShared();
  const cv = document.createElement('canvas'); cv.style.width = '100%'; cv.style.height = '100%'; cv.style.display = 'block';
  container.appendChild(cv); const ctx = cv.getContext('2d');
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight('#e8f0ff', '#3a3048', 2.2));
  const key = new THREE.DirectionalLight('#fff0dd', 2.6); key.position.set(4, 8, 6); scene.add(key);
  const rim = new THREE.DirectionalLight('#9ab8ff', 1.6); rim.position.set(-5, 4, -6); scene.add(rim);
  const ped = pedestal(); scene.add(ped);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ffffff', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.y = 0.1; scene.add(glow);
  const turn = new THREE.Group(); scene.add(turn);
  // floating motes
  const motes = new THREE.Group(); scene.add(motes);
  const moteMat = new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(moteMat); s.userData.ph = Math.random() * 10; s.userData.r = 1.6 + Math.random() * 1.4; s.userData.sp = 0.3 + Math.random() * 0.5; s.scale.setScalar(0.25 + Math.random() * 0.25); motes.add(s); }
  let rig = null, t = 0, castT = -10, h = 3;
  const api = {
    setHero(hid, sid) {
      if (rig) { turn.remove(rig.root); disposeTree(rig.root); }
      rig = buildHero(hid, sid, { rimStrength: 0.6 }); turn.add(rig.root); h = rig.def.height || 3;
      const sk = getSkin(hid, sid); const vc = sk?.colors?.vfx || '#ffffff';
      glow.material.color.set(vc); moteMat.color.set(vc);
      castT = t; // play a cast pose on change
    },
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
      turn.rotation.y = Math.sin(t * 0.5) * 0.6 + 0.35;
      if (rig) poseRig(rig, t - castT < 1.0 ? { state: 'cast', t: t - castT } : { state: 'idle', t }, t, false);
      motes.children.forEach((s) => { const u = s.userData; const a = u.ph + t * u.sp; s.position.set(Math.cos(a) * u.r, ((t * u.sp * 0.6 + u.ph) % 4), Math.sin(a) * u.r); s.material.opacity = 0.6; });
      cam.aspect = w / hh; const tf = Math.tan((cam.fov * Math.PI) / 360);
      const dist = Math.max((h * 0.62 + 0.7) / tf, 3.2 / (tf * cam.aspect));
      cam.position.set(0, h * 0.5 + dist * 0.2, dist); cam.lookAt(0, h * 0.42, 0); cam.updateProjectionMatrix();
      const full = S.gl.getSize(new THREE.Vector2());
      S.gl.setViewport(0, full.y - H / 1, W, H); S.gl.setScissor(0, full.y - H, W, H); S.gl.setScissorTest(true);
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
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e8f0ff', '#3a3048', 2.3));
  const key = new THREE.DirectionalLight('#fff0dd', 2.8); key.position.set(3, 6, 7); scene.add(key);
  const rim = new THREE.DirectionalLight('#a8c4ff', 2.0); rim.position.set(-6, 5, -5); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  const holder = new THREE.Group(); scene.add(holder);
  pScene = { scene, cam, holder };
  return pScene;
}

/**
 * Render a hero portrait to a PNG data URL (cached by key). Synchronous; ~5-15ms each on desktop.
 * opts: { size=256, pose:'idle'|'action', bg:true|false, framing:'bust'|'full' }
 */
export function renderHeroPortrait(heroId, skinId, opts = {}) {
  const size = opts.size || 256, pose = opts.pose || 'idle', bg = opts.bg !== false, framing = opts.framing || 'bust';
  const ck = `${heroId}|${skinId}|${size}|${pose}|${bg}|${framing}`;
  if (portraitCache.has(ck)) return portraitCache.get(ck);
  const S = getShared(); const P = portraitScene();
  const rig = buildHero(heroId, skinId, { rimStrength: 0.7 });
  P.holder.add(rig.root);
  rig.root.rotation.y = pose === 'action' ? 0.55 : 0.35;
  poseRig(rig, pose === 'action' ? { state: 'cast', t: 0.3 } : { state: 'idle', t: 0 }, 0.4, false);
  if (pose === 'action' && rig.bones.orbit) rig.bones.orbit.rotation.y = 1;
  const h = (rig.def.height || 3) * (rig.def.scale || 1);
  const tf = Math.tan((P.cam.fov * Math.PI) / 360);
  if (framing === 'full') { const d = (h * 0.62) / tf; P.cam.position.set(0, h * 0.55, d); P.cam.lookAt(0, h * 0.47, 0); }
  else { const d = (h * 0.42) / tf; P.cam.position.set(0, h * 0.82, d); P.cam.lookAt(0, h * 0.7, 0); }
  P.cam.aspect = 1; P.cam.updateProjectionMatrix();
  const full = S.gl.getSize(new THREE.Vector2());
  if (full.x < size || full.y < size) S.gl.setSize(Math.max(full.x, size), Math.max(full.y, size), false);
  const fy = S.gl.getSize(new THREE.Vector2()).y;
  S.gl.setScissorTest(true); S.gl.setViewport(0, fy - size, size, size); S.gl.setScissor(0, fy - size, size, size);
  S.gl.clear(); S.gl.render(P.scene, P.cam);
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d');
  if (bg) {
    const sk = getSkin(heroId, skinId); const vc = new THREE.Color(sk?.colors?.vfx || '#8090ff');
    const dark = vc.clone().multiplyScalar(0.18).getStyle(), mid = vc.clone().multiplyScalar(0.55).getStyle();
    const gr = g.createRadialGradient(size * 0.5, size * 0.42, size * 0.05, size * 0.5, size * 0.5, size * 0.75);
    gr.addColorStop(0, mid); gr.addColorStop(1, dark); g.fillStyle = gr; g.fillRect(0, 0, size, size);
    g.globalAlpha = 0.25; g.strokeStyle = '#ffffff'; g.lineWidth = size / 128;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(size / 2, size * 1.05, size * (0.5 + i * 0.18), Math.PI, 0); g.stroke(); }
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
