// Pip helpers: shared palette + hat builder + the seated Pip used in the menu duo (Pip riding Bolt).
import * as THREE from 'three';
import { G } from './builder.js';
import { head } from './kit.js';

const PI = Math.PI;
const dark = (a, k = 0.6) => '#' + new THREE.Color(a).multiplyScalar(k).getHexString();

export function pipBits(c, p) {
  return { overall: c.primary, overallDark: dark(c.primary, 0.7), shirt: c.secondary || '#e8e0d0', hair: c.hair, metal: c.metal, mech: c.mech, mech2: c.mech2, glow: c.glow, glove: '#6a4a30' };
}

function hat(R, bone, r, c, p, B) {
  const y0 = r * 1.0;
  if (p.hat === 'helmet') {
    R.add(bone, G.sph(r * 1.35, 12, 8), '#4a6a9a', { p: [0, y0, 0], glow: 0.12, metal: 0.7, rough: 0.06 });
    R.add(bone, G.band(r * 1.22, 0.1, 0.2, 14), B.overall, { p: [0, y0 - r * 0.75, 0], metal: 0.4, rough: 0.35 });
    R.add(bone, G.cyl(0.025, 0.025, 0.4, 4), B.metal, { p: [r * 0.7, y0 + r * 1.3, -0.1], r: [0, 0, -0.4], metal: 0.8 });
    R.add(bone, G.ico(0.07, 1), B.glow, { p: [r * 0.82, y0 + r * 1.6, -0.1], glow: 2 });
    R.add(bone, G.star(0.13, 0.055, 0.04), c.vfx2 || '#fff', { p: [0, y0 - r * 0.7, r * 1.25], glow: 1.8 });
  } else if (p.hat === 'beanie') {
    R.add(bone, G.sph(r * 1.08, 10, 6, 0), B.overall, { p: [0, y0 + r * 0.32, -0.03], s: [1.04, 0.8, 1.04] });
    R.add(bone, G.band(r * 1.06, 0.1, 0.2, 12), dark(B.overall, 0.75), { p: [0, y0 + r * 0.05, -0.02] });
    R.add(bone, G.ico(0.18, 1), '#ffffff', { p: [0, y0 + r * 1.2, -0.05] });
    R.add(bone, G.cbox(r * 1.2, 0.1, 0.06, 0.02), B.glow, { p: [0, y0 + r * 0.35, r * 0.95], glow: 1.5 });
  } else {
    // aviator cap + big goggles on the forehead + pointy gnome tip
    R.add(bone, G.sph(r * 1.07, 10, 6, 0), '#7a4a2a', { p: [0, y0 + r * 0.2, -0.03], s: [1.04, 0.85, 1.05] });
    R.add(bone, G.tube([[0, y0 + r * 0.7, -0.05], [0, y0 + r * 1.35, -0.2], [0, y0 + r * 1.75, -0.55]], r * 0.55, 0.04, 7, 5), c.hair === '#ff8a3a' ? '#c8402a' : B.overall, {});
    R.sym(bone, G.cbox(0.16, 0.38, 0.22, 0.04), '#7a4a2a', { p: [r * 0.98, y0 - r * 0.2, -0.02] });
    R.add(bone, G.band(r * 1.02, 0.06, 0.1, 12), '#3a2a1a', { p: [0, y0 + r * 0.42, 0], r: [-0.25, 0, 0] });
    for (const sx of [1, -1]) {
      R.add(bone, G.cyl(0.17, 0.17, 0.12, 10), B.metal, { p: [sx * 0.21, y0 + r * 0.55, r * 0.88], r: [PI / 2 - 0.5, 0, 0], metal: 0.9, rough: 0.25 });
      R.add(bone, G.cyl(0.13, 0.13, 0.13, 10), B.glow, { p: [sx * 0.21, y0 + r * 0.56, r * 0.9], r: [PI / 2 - 0.5, 0, 0], glow: 0.55, rough: 0.1 });
    }
  }
}

// seated Pip on bone (menu duo). Small rig-less build onto the given bone (+ an arm bone 'pipArm').
export function buildPipSeat(R, bone, c, p) {
  const B = pipBits(c, p);
  R.bone('pipHead', bone, [0, 0.62, 0]);
  R.bone('pipArm', bone, [-0.3, 0.42, 0.05]);
  R.add(bone, G.tprism(0.5, 0.4, 0.48, 0.38, 0.5, 8), B.overall, { p: [0, 0.22, 0] });
  R.add(bone, G.cbox(0.3, 0.2, 0.06, 0.02), B.shirt, { p: [0, 0.38, 0.19] });
  R.sym(bone, G.cyl(0.07, 0.07, 0.36, 6), B.shirt, { p: [0.3, 0.32, 0.05], r: [0.2, 0, -0.5] });
  R.add('pipArm', G.cyl(0.07, 0.07, 0.34, 6), B.shirt, { p: [0, -0.16, 0] });
  R.add('pipArm', G.cbox(0.12, 0.12, 0.12, 0.03), B.glove, { p: [0, -0.36, 0] });
  R.add('pipArm', G.cbox(0.07, 0.05, 0.55, 0.02), B.metal, { p: [0, -0.36, 0.28], metal: 0.9, rough: 0.3 });
  R.add('pipArm', G.torus(0.1, 0.04, 4, 8, PI * 1.45), B.metal, { p: [0, -0.36, 0.6], r: [PI / 2, 0, PI * 0.78], metal: 0.9, rough: 0.3 });
  const r = 0.44;
  head(R, { r, skin: c.skin, mood: 'kind', brow: B.hair, eye: '#2a3a5a', noseL: 0.5, noseCol: '#f0a888', mouthCol: '#9a4a4a', ears: 'pointy' }, 'pipHead');
  R.add('pipHead', G.ico(0.18, 0), B.hair, { p: [0, r * 0.32, 0.3], s: [1.6, 0.6, 0.9] });
  hat(R, 'pipHead', r, c, p, B);
}
buildPipSeat.hat = hat;
