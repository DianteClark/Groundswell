// Maps a THREE.Scene → its Vfx manager so models/animators can emit effects (muzzle flashes, sparks)
// without a renderer reference. Preview scenes simply have no entry (effects become no-ops).
const map = new WeakMap();
export function registerVfx(scene, vfx) { if (scene) map.set(scene, vfx); }
export function unregisterVfx(scene) { if (scene) map.delete(scene); }
export function vfxFor(obj) { let o = obj; if (!o) return null; while (o.parent) o = o.parent; return map.get(o) || null; }
