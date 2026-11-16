import * as THREE from 'three';
import { buildHero, poseRig } from '/home/claude/moba/src/render/models/heroes.js';
const H = ['lumi','bram','kaela','lumi','vex','nyx','pip','mire','garrok','garrok_wolf'];
for (const h of H) {
  const t0 = performance.now(); const rig = buildHero(h, h === 'garrok_wolf' ? 'garrok_default' : h + '_default', { variant: h === 'pip' ? 'pilot' : undefined }); const t1 = performance.now();
  const g = new THREE.Group(); g.add(rig.root); let draws = 0; rig.root.traverse(o => { if (o.isMesh) draws++; });
  const N = 2000; const t2 = performance.now(); for (let i = 0; i < N; i++) { g.position.x = i * 0.15; poseRig(rig, { state: i % 200 < 100 ? 'run' : 'attack', t: (i % 100) / 60, dur: 1.2 }, i / 60, i % 200 < 100); } const t3 = performance.now();
  console.log(h.padEnd(12), 'tris', String(rig.tris).padStart(5), 'bones', rig.skeleton.bones.length, 'meshes(incl trails)', draws, 'build', (t1 - t0).toFixed(1) + 'ms', 'pose', ((t3 - t2) / N * 1000).toFixed(1) + 'us/frame');
}
