// Reusable humanoid skeleton + chunky stylised body parts for hero recipes.
// Conventions: character faces +Z, left side = +X. Limbs hang along -Y in rest pose.
import { G } from './builder.js';

const PI = Math.PI;

/** Build the standard humanoid bone hierarchy. Returns resolved dims. */
export function skeleton(R, o) {
  const d = {
    hipY: 1.6, spineH: 0.45, chestH: 0.75, neck: 0.12, headR: 0.42, shoulderX: 0.62, shoulderY: 0.6,
    upper: 0.62, fore: 0.56, hipX: 0.24, footH: 0.16, ...o,
  };
  d.leg = d.hipY - d.footH - 0.04; d.thigh = d.leg * 0.5; d.shin = d.leg * 0.5;
  R.bone('hips', 'root', [0, d.hipY, 0]);
  R.bone('spine', 'hips', [0, 0.04, 0]);
  R.bone('chest', 'spine', [0, d.spineH, 0]);
  R.bone('neck', 'chest', [0, d.chestH, d.neckZ || 0]);
  R.bone('head', 'neck', [0, d.neck, 0]);
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    R.bone('shoulder' + s, 'chest', [sx * d.shoulderX, d.shoulderY, 0]);
    R.bone('arm' + s, 'shoulder' + s, [0, 0, 0]);
    R.bone('fore' + s, 'arm' + s, [0, -d.upper, 0]);
    R.bone('hand' + s, 'fore' + s, [0, -d.fore, 0]);
    if (!d.noLegs) {
      R.bone('thigh' + s, 'hips', [sx * d.hipX, -0.04, 0]);
      R.bone('shin' + s, 'thigh' + s, [0, -d.thigh, 0]);
      R.bone('foot' + s, 'shin' + s, [0, -d.shin, 0]);
    }
  }
  return d;
}

/** Legs: thigh, knee, shin, boot. o: {thighW, shinW, pants, boot, knee, cuff, toe:'round'|'pointy'|'claw'|'root', bootH} */
export function legs(R, d, o) {
  const tw = o.thighW ?? 0.3, sw = o.shinW ?? 0.26;
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const T = 'thigh' + s, S = 'shin' + s, F = 'foot' + s;
    R.add(T, G.tprism(tw * 1.05, tw * 1.05, tw * 0.85, tw * 0.85, d.thigh + 0.08, 7), o.pants, { p: [0, -d.thigh / 2, 0] });
    if (o.knee) R.add(S, G.cbox(sw * 1.1, sw * 0.9, sw * 0.6, 0.04), o.knee, { p: [0, 0.02, sw * 0.42], metal: o.kneeMetal ?? 0, rough: 0.5 });
    const bh = o.bootH ?? 0.62;
    R.add(S, G.tprism(sw * 0.85, sw * 0.85, sw * 0.75, sw * 0.75, d.shin * (1 - bh) + 0.05, 7), o.pants, { p: [0, -d.shin * (1 - bh) / 2, 0] });
    R.add(S, G.tprism(sw * 1.05, sw * 1.05, sw * 1.12, sw * 1.12, d.shin * bh, 7), o.boot, { p: [0, -d.shin + d.shin * bh / 2, 0] });
    if (o.cuff) R.add(S, G.tprism(sw * 1.28, sw * 1.28, sw * 1.22, sw * 1.22, 0.1, 7), o.cuff, { p: [0, -d.shin + d.shin * bh, 0], metal: o.cuffMetal ?? 0 });
    // foot (from ankle down to ground, forward)
    const fl = o.footL ?? sw * 2.2, fw = sw * 1.15, fh = d.footH + 0.04;
    if (o.toe === 'root') {
      for (let i = -1; i <= 1; i++) R.add(F, G.cone(0.08, fl * 0.75, 5), o.boot, { p: [i * fw * 0.32, -fh + 0.06, fl * 0.35], r: [PI / 2 + 0.1, 0, i * 0.35] });
      R.add(F, G.dodec(fw * 0.55), o.boot, { p: [0, -fh * 0.5, 0.02], s: [1.1, 0.7, 1.2] });
    } else if (o.toe === 'claw') {
      R.add(F, G.cbox(fw, fh, fl * 0.8, 0.05), o.boot, { p: [0, -fh / 2, fl * 0.2] });
      for (let i = -1; i <= 1; i++) R.add(F, G.cone(0.045, 0.22, 4), o.claw || '#e8e0d0', { p: [i * fw * 0.32, -fh + 0.05, fl * 0.66], r: [PI / 2, 0, 0] });
    } else {
      R.add(F, G.cbox(fw, fh, fl * 0.62, 0.05), o.boot, { p: [0, -fh / 2, fl * 0.12] });
      R.add(F, G.tbox(fw, fl * 0.32, fw * 0.8, fl * 0.26, fh * 0.75, 0), o.boot, { p: [0, -fh + fh * 0.375, fl * 0.5] });
      if (o.toe === 'pointy') R.add(F, G.cone(fw * 0.3, fl * 0.5, 4), o.boot, { p: [0, -fh + 0.1, fl * 0.75], r: [PI / 2 - 0.35, 0, 0] });
      R.add(F, G.cbox(fw * 1.06, 0.06, fl * 0.95, 0.02), o.sole || '#2a2026', { p: [0, -fh + 0.03, fl * 0.24] });
    }
  }
}

/** Arms: upper arm, elbow, forearm/bracer, hand (chunky mitt + thumb). */
export function arms(R, d, o) {
  const uw = o.upperW ?? 0.22, fw = o.foreW ?? 0.2, hs = o.hand ?? 0.17;
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const A = 'arm' + s, F = 'fore' + s, H = 'hand' + s;
    R.add(A, G.tprism(uw * 0.95, uw * 0.95, uw * 1.05, uw * 1.05, d.upper + 0.06, 7), o.sleeve, { p: [0, -d.upper / 2, 0] });
    R.add(F, G.tprism(fw * 0.85, fw * 0.85, fw, fw, d.fore * 0.5, 7), o.forearm ?? o.sleeve, { p: [0, -d.fore * 0.25, 0] });
    R.add(F, G.tprism(fw * 1.12, fw * 1.12, fw * 1.25, fw * 1.25, d.fore * 0.55, 7), o.bracer ?? o.skin, { p: [0, -d.fore * 0.72, 0], metal: o.bracerMetal ?? 0, rough: o.bracerMetal ? 0.4 : 0.75 });
    if (o.bracerTrim) R.add(F, G.tprism(fw * 1.3, fw * 1.3, fw * 1.3, fw * 1.3, 0.06, 7), o.bracerTrim, { p: [0, -d.fore * 0.46, 0], metal: 0.8, rough: 0.3 });
    // hand: fist block + knuckles + thumb
    R.add(H, G.cbox(hs * 1.2, hs * 1.25, hs * 1.15, 0.04), o.glove ?? o.skin, { p: [0, -hs * 0.55, 0.02] });
    R.add(H, G.cbox(hs * 0.42, hs * 0.75, hs * 0.5, 0.03), o.glove ?? o.skin, { p: [-sx * 0.0, -hs * 0.45, hs * 0.62], r: [0.4, 0, 0] });
  }
}

/** Head + face. o: {r, skin, eye, eyeGlow, brow, mood, mouth, nose, ears, jaw, y} on bone 'head' */
export function head(R, o, bone = 'head') {
  const r = o.r, y = o.y ?? r * 0.95, zf = r * 0.88;
  R.add(bone, G.sph(r, 10, 8), o.skin, { p: [0, y, 0], s: [1, o.tall ?? 1.02, o.deep ?? 0.98], jitter: 0.03 });
  if (o.jaw) R.add(bone, G.cbox(r * 1.3, r * 0.6, r * 1.1, 0.06), o.skin, { p: [0, y - r * 0.55, r * 0.08], jitter: 0.03 });
  // eyes
  const ex = r * 0.36, ey = y + r * 0.08;
  const mood = o.mood || 'calm';
  if (o.eyeGlow) {
    R.sym(bone, G.cbox(r * 0.26, r * 0.14, 0.04, 0.02), o.eyeGlow, { p: [ex, ey, zf + 0.01], r: [0, 0.32, mood === 'fierce' ? -0.25 : 0], glow: 1.4 });
  } else {
    R.sym(bone, G.sph(r * 0.17, 7, 5), '#fbf6f0', { p: [ex, ey, zf - r * 0.06], s: [1, mood === 'sleepy' ? 0.55 : 1.1, 0.6], jitter: false, rough: 0.3 });
    R.sym(bone, G.sph(r * 0.11, 6, 5), o.eye || '#2a1c26', { p: [ex - 0.005, ey - 0.01, zf + r * 0.02], s: [0.95, mood === 'sleepy' ? 0.5 : 1.15, 0.45], jitter: false, rough: 0.2 });
    R.sym(bone, G.ico(r * 0.035, 0), '#ffffff', { p: [ex + r * 0.04, ey + r * 0.06, zf + r * 0.08], glow: 0.8, jitter: false });
  }
  // brows (expression)
  if (o.brow !== false) {
    const tilt = mood === 'fierce' ? -0.42 : mood === 'smirk' ? -0.15 : mood === 'grumpy' ? -0.55 : mood === 'kind' ? 0.25 : 0.05;
    R.add(bone, G.cbox(r * 0.36, r * 0.1, r * 0.12, 0.02), o.brow || '#3a2418', { p: [ex, ey + r * 0.24, zf - 0.01], r: [0, 0.3, tilt] });
    R.add(bone, G.cbox(r * 0.36, r * 0.1, r * 0.12, 0.02), o.brow || '#3a2418', { p: [-ex, ey + r * 0.24 + (mood === 'smirk' ? 0.03 : 0), zf - 0.01], r: [0, -0.3, -(mood === 'smirk' ? 0.05 : tilt)] });
  }
  if (o.nose !== false) R.add(bone, G.tbox(r * 0.16, r * 0.12, r * 0.06, r * 0.06, r * (o.noseL ?? 0.32), 0), o.noseCol || o.skin, { p: [0, y - r * 0.1, zf + r * (o.noseL ?? 0.32) * 0.35], r: [PI / 2 + 0.25, 0, 0], jitter: 0.03 });
  if (o.mouth !== false) {
    const mr = mood === 'smirk' ? 0.22 : mood === 'grumpy' ? -0.1 : 0;
    R.add(bone, G.cbox(r * (mood === 'fierce' ? 0.42 : 0.3), r * (mood === 'fierce' ? 0.1 : 0.06), 0.04, 0.015), o.mouthCol || '#6a2a2a', { p: [mood === 'smirk' ? r * 0.06 : 0, y - r * 0.42, zf - r * 0.1], r: [0, 0, mr] });
  }
  if (o.ears) R.sym(bone, o.ears === 'pointy' ? G.cone(r * 0.16, r * 0.75, 4) : G.sph(r * 0.18, 6, 4), o.skin, { p: [r * 0.95, y, -0.02], r: o.ears === 'pointy' ? [0, 0, -1.25] : [0, 0, 0], s: o.ears === 'pointy' ? 1 : [0.5, 1, 0.8] });
}

/** simple belt band around a bone at height y with radius rx×rz */
export function belt(R, bone, y, rx, rz, color, buckle, o = {}) {
  R.add(bone, G.tprism(rx * 2, rz * 2, rx * 2, rz * 2, o.h ?? 0.12, 10), color, { p: [0, y, 0], rough: 0.6 });
  if (buckle) R.add(bone, G.cbox(o.bw ?? 0.16, o.bh ?? 0.14, 0.05, 0.02), buckle, { p: [0, y, rz + 0.02], metal: 0.9, rough: 0.3, glow: o.buckleGlow || 0 });
}
