// Projectile + ground-area visuals keyed by visual.model, with good generic fallbacks.
import * as THREE from 'three';
import { G } from './models/builder.js';
import { glowTexture, ringTexture, makeGlowMat, teamColor } from './util.js';

const PI = Math.PI;
const SHARED = {};
function sg(k, f) { if (!SHARED[k]) { SHARED[k] = f(); SHARED[k].userData.shared = true; } return SHARED[k]; }

// Which style a projectile key maps to.
export function projStyle(key = '') {
  if (key === 'tower_shot') return 'crystal';
  if (key === 'caster_shot') return 'orb_small';
  if (key === 'siege_shot') return 'cannon';
  if (key.startsWith('wyrm')) return 'orb_big';
  const hero = key.replace(/^auto_/, '').split('_')[0];
  const auto = key.startsWith('auto_');
  switch (hero) {
    case 'vex': return auto ? 'bolt' : 'bolt_big';
    case 'lumi': return 'star';
    case 'pip': return auto ? 'zap' : 'zap_big';
    case 'mire': return 'bubble';
    case 'kaela': return 'crescent';
    case 'nyx': return 'dagger';
    case 'garrok': return 'spear';
    case 'bram': return 'rock';
    default: return 'orb';
  }
}

export function buildProjectile(key, color, color2) {
  const style = projStyle(key);
  const g = new THREE.Group(); const spin = new THREE.Group(); g.add(spin);
  const c1 = new THREE.Color(color), c2 = new THREE.Color(color2 || '#ffffff');
  const glowM = makeGlowMat(c1); const coreM = makeGlowMat(c2);
  let glowSize = 1.6, trail = { size: 0.6, life: 0.3, style: 'wisps' }, spinRate = 0, spinAxis = 'z';
  const add = (geo, mat, o = {}) => { const m = new THREE.Mesh(geo, mat); if (o.p) m.position.set(...o.p); if (o.r) m.rotation.set(...o.r); if (o.s) (typeof o.s === 'number' ? m.scale.setScalar(o.s) : m.scale.set(...o.s)); spin.add(m); return m; };
  switch (style) {
    case 'crystal': add(sg('oct', () => G.oct(0.5)), glowM, { s: [0.7, 0.7, 1.6], r: [PI / 2, 0, 0] }); add(sg('oct', () => G.oct(0.5)), coreM, { s: [0.35, 0.35, 0.9], r: [PI / 2, 0, 0] }); glowSize = 3.2; trail = { size: 1.0, life: 0.35, style: 'stars' }; spinRate = 8; break;
    case 'orb_small': add(sg('ico0', () => G.ico(0.3, 1)), coreM, {}); glowSize = 1.4; trail = { size: 0.45, life: 0.2 }; break;
    case 'cannon': add(sg('ico0', () => G.ico(0.3, 1)), makeGlowMat('#3a3540'), { s: 1.6 }); glowSize = 1.8; trail = { size: 0.7, life: 0.35, style: 'embers' }; break;
    case 'orb_big': add(sg('ico1', () => G.ico(0.6, 1)), coreM, {}); glowSize = 4; trail = { size: 1.4, life: 0.4, style: 'embers' }; break;
    case 'bolt': add(sg('bolt', () => G.cyl(0.08, 0.08, 1.6, 5).rotateX(PI / 2)), coreM, {}); glowSize = 1.2; trail = { size: 0.4, life: 0.15, style: 'sparks' }; break;
    case 'bolt_big': add(sg('boltb', () => G.cyl(0.16, 0.16, 3.2, 6).rotateX(PI / 2)), coreM, {}); add(sg('boltg', () => G.cyl(0.32, 0.05, 3.6, 6).rotateX(PI / 2)), glowM, { p: [0, 0, -0.4] }); glowSize = 2.4; trail = { size: 0.8, life: 0.25, style: 'sparks' }; break;
    case 'star': add(sg('star', () => G.star(0.55, 0.22, 0.12)), coreM, {}); add(sg('star2', () => G.star(0.8, 0.3, 0.06)), glowM, { p: [0, 0, -0.05] }); glowSize = 2.4; trail = { size: 0.7, life: 0.5, style: 'stars' }; spinRate = 10; break;
    case 'zap': add(sg('oct', () => G.oct(0.5)), coreM, { s: 0.6 }); glowSize = 1.5; trail = { size: 0.45, life: 0.2, style: 'lightning' }; spinRate = 15; spinAxis = 'y'; break;
    case 'zap_big': add(sg('oct', () => G.oct(0.5)), coreM, { s: 1.0 }); add(sg('tor', () => G.torus(0.6, 0.05, 3, 12)), glowM, {}); glowSize = 2.6; trail = { size: 0.7, life: 0.3, style: 'lightning' }; spinRate = 12; spinAxis = 'y'; break;
    case 'bubble': add(sg('ico1', () => G.ico(0.6, 1)), glowM, { s: 0.75 }); add(sg('ico0', () => G.ico(0.3, 1)), coreM, { p: [0.15, 0.15, 0.1], s: 0.5 }); glowSize = 2; trail = { size: 0.6, life: 0.5, style: 'bubbles' }; break;
    case 'crescent': add(sg('cres', () => G.torus(0.9, 0.14, 3, 12, PI).rotateX(PI / 2)), glowM, { r: [0, PI / 2, 0] }); add(sg('cres2', () => G.torus(0.9, 0.05, 3, 12, PI).rotateX(PI / 2)), coreM, { r: [0, PI / 2, 0] }); glowSize = 2.4; trail = { size: 0.8, life: 0.35, style: 'embers' }; break;
    case 'dagger': add(sg('dag', () => G.blade(0.9, 0.22, 0.05).rotateX(PI / 2)), coreM, {}); add(sg('dag2', () => G.blade(1.1, 0.36, 0.03).rotateX(PI / 2)), glowM, { p: [0, 0, -0.1] }); glowSize = 1.6; trail = { size: 0.6, life: 0.4, style: 'void' }; spinRate = 18; spinAxis = 'y'; break;
    case 'spear': add(sg('spr', () => G.cyl(0.05, 0.05, 2.6, 4).rotateX(PI / 2)), makeGlowMat('#8a6a4a'), { p: [0, 0, -0.6] }); add(sg('sprh', () => G.cone(0.18, 0.7, 4).rotateX(PI / 2)), coreM, { p: [0, 0, 0.9] }); glowSize = 1.6; trail = { size: 0.5, life: 0.25, style: 'sparks' }; break;
    case 'rock': add(sg('rk', () => G.dodec(0.6)), makeGlowMat('#6a5a4a'), {}); glowSize = 1.8; trail = { size: 0.8, life: 0.4, style: 'leaves' }; spinRate = 6; spinAxis = 'x'; break;
    default: add(sg('ico1', () => G.ico(0.6, 1)), coreM, { s: 0.6 }); glowSize = 2.2; trail = { size: 0.7, life: 0.35 }; break;
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c1, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  sp.scale.set(glowSize, glowSize, 1); g.add(sp);
  return { group: g, spin, spinRate, spinAxis, trail, style, mats: [glowM, coreM, sp.material], glow: sp };
}

// Ground area visual (non-zone). Ring + soft fill + rotating rune ring + particles handled by renderer.
export function buildArea(key, radius, color, color2) {
  const g = new THREE.Group();
  const plane = sg('aplane', () => new THREE.PlaneGeometry(2, 2).rotateX(-PI / 2));
  const mk = (tex, c, op, order, y) => { const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: tex, color: c, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 })); m.renderOrder = order; m.position.y = y; g.add(m); return m; };
  const fill = mk(glowTexture(), color, 0.35, 5, 0.12);
  const ring = mk(ringTexture(), color, 0.9, 6, 0.13);
  const rune = mk(runeTexture(), color2 || color, 0.55, 6, 0.14);
  let murk = null;
  if (/mire|swamp|bog|poison/.test(key)) { murk = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#2a3a18', transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false })); murk.renderOrder = 4; murk.position.y = 0.11; murk.scale.setScalar(1.1); g.add(murk); }
  g.scale.set(radius, 1, radius);
  return { group: g, fill, ring, rune, murk };
}

let _runeTex = null;
function runeTexture() {
  if (_runeTex) return _runeTex;
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'); const c = N / 2;
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(c, c, c * 0.78, 0, PI * 2); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(c, c, c * 0.66, 0, PI * 2); g.stroke();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; g.save(); g.translate(c + Math.cos(a) * c * 0.72, c + Math.sin(a) * c * 0.72); g.rotate(a); g.beginPath(); g.moveTo(-6, -4); g.lineTo(0, 5); g.lineTo(6, -4); g.stroke(); g.restore(); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; g.beginPath(); g.moveTo(c + Math.cos(a) * c * 0.66, c + Math.sin(a) * c * 0.66); g.lineTo(c + Math.cos(a + PI * 2 / 3) * c * 0.66, c + Math.sin(a + PI * 2 / 3) * c * 0.66); g.globalAlpha = 0.5; g.stroke(); g.globalAlpha = 1; }
  _runeTex = new THREE.CanvasTexture(cv); _runeTex.colorSpace = THREE.SRGBColorSpace; return _runeTex;
}
export { runeTexture };
