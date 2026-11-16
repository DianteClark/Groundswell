// Shared render helpers: colors, textures, materials.
import * as THREE from 'three';

export const TEAM_COLORS = [0x3d8bff, 0xff4d5a, 0xd9c27a];
export const TEAM_DARK = [0x1d4fa8, 0xa8222f, 0x7a6a3a];
export const teamColor = (t) => TEAM_COLORS[t] ?? TEAM_COLORS[2];
export const col = (c) => (c instanceof THREE.Color ? c.clone() : new THREE.Color(c));

export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
// deterministic hash noise for decor placement (render only, but keep stable)
export function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
export function mkRand(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

let _glowTex = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _glowTex = new THREE.CanvasTexture(c); _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

let _ringTex = null;
export function ringTexture() {
  if (_ringTex) return _ringTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.08)');
  gr.addColorStop(0.86, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.93, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  _ringTex = new THREE.CanvasTexture(c); _ringTex.colorSpace = THREE.SRGBColorSpace;
  return _ringTex;
}

let _thinRing = null;
export function thinRingTexture() {
  if (_thinRing) return _thinRing;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.9, 'rgba(255,255,255,0.03)'); gr.addColorStop(0.955, 'rgba(255,255,255,0.35)');
  gr.addColorStop(0.975, 'rgba(255,255,255,1)'); gr.addColorStop(0.995, 'rgba(255,255,255,0.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  _thinRing = new THREE.CanvasTexture(c); _thinRing.colorSpace = THREE.SRGBColorSpace;
  return _thinRing;
}

let _gradMap = null;
export function toonGradient() {
  if (_gradMap) return _gradMap;
  const d = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
  _gradMap = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  _gradMap.minFilter = _gradMap.magFilter = THREE.NearestFilter; _gradMap.needsUpdate = true;
  return _gradMap;
}

// Toon material with rim light + hit-flash + opacity controls. vertexColors by default.
export function makeToonMat(opts = {}) {
  const m = new THREE.MeshToonMaterial({ vertexColors: opts.vertexColors !== false, color: opts.color ?? 0xffffff, gradientMap: toonGradient() });
  const u = { rimColor: { value: col(opts.rim ?? 0xffffff) }, rimStrength: { value: opts.rimStrength ?? 0.55 }, flash: { value: 0 }, flashColor: { value: new THREE.Color(1, 1, 1) } };
  m.userData.u = u;
  m.defaultAttributeValues = { color: [1, 1, 1], uv: [0, 0], uv1: [0, 0], aGlow: [0] };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor; uniform float rimStrength; uniform float flash; uniform vec3 flashColor;')
      .replace('#include <opaque_fragment>', `
        { vec3 vd = normalize(vViewPosition); float fr = 1.0 - clamp(dot(vd, normalize(vNormalRim)), 0.0, 1.0);
          outgoingLight += rimColor * pow(fr, 2.6) * rimStrength; }
        outgoingLight = mix(outgoingLight, diffuseColor.rgb * 1.15, vGlowF);
        outgoingLight = mix(outgoingLight, flashColor, flash);
        #include <opaque_fragment>`);
    // need a smooth-ish normal for rim even in flat mode
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vNormalRim; attribute float aGlow; varying float vGlowF;')
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\nvNormalRim = normalize(transformedNormal); vGlowF = aGlow;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vNormalRim; varying float vGlowF;');
  };
  m.customProgramCacheKey = () => 'toonrim';
  return m;
}

export function makeFlatMat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true, vertexColors: !!opts.vertexColors, ...(opts.extra || {}) });
}

export function makeGlowMat(color = 0xffffff, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, vertexColors: !!opts.vertexColors, transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !opts.additive, toneMapped: false, side: opts.side ?? THREE.FrontSide, fog: opts.fog ?? true });
}

export function makeSpriteMat(color, opacity = 1) {
  return new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
}

// Disposal helper
export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => { if (!m.userData.shared) m.dispose(); });
    }
  });
}
