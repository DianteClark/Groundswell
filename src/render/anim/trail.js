// World-space weapon trail ribbon (swing smear). One small dynamic mesh per weapon, child of the rig
// root (so it is disposed/hidden with the hero) but with an identity world matrix.
import * as THREE from 'three';

const N = 14;
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
export class WeaponTrail {
  constructor(rig, o) {
    this.rig = rig; this.o = o; this.base = rig.bones[o.base]; this.tip = rig.bones[o.tip];
    this.life = o.life ?? 0.16; this.samples = []; // {a:Vector3, b:Vector3, age}
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 2 * 3); this.col = new Float32Array(N * 2 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.mesh.matrixAutoUpdate = false; this.mesh.matrixWorldAutoUpdate = false; this.mesh.frustumCulled = false; this.mesh.renderOrder = 22; this.mesh.visible = false; this.mesh.castShadow = false;
    rig.root.add(this.mesh); this.mesh.matrixWorld.identity();
    this.c0 = new THREE.Color(o.color || rig.colors?.vfx || '#ffffff'); this.c1 = new THREE.Color(o.color2 || rig.colors?.vfx2 || '#ffffff');
  }
  update(on, dt) {
    const S = this.samples;
    for (const s of S) s.age += dt;
    while (S.length && S[S.length - 1].age > this.life) S.pop();
    if (on && this.base && this.tip) {
      this.base.getWorldPosition(_a); this.tip.getWorldPosition(_b);
      const s = S.length >= N ? S.pop() : { a: new THREE.Vector3(), b: new THREE.Vector3(), age: 0 };
      s.a.copy(_a).lerp(_b, this.o.inner ?? 0.25); s.b.copy(_b); s.age = 0; S.unshift(s);
    }
    if (S.length < 2) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const pos = this.pos, col = this.col;
    for (let i = 0; i < N; i++) {
      const s = S[Math.min(i, S.length - 1)]; const k = 1 - Math.min(1, s.age / this.life); const f = i < S.length ? k * k * (1 - i / N) : 0;
      pos.set([s.a.x, s.a.y, s.a.z], i * 6); pos.set([s.b.x, s.b.y, s.b.z], i * 6 + 3);
      const e = f * 1.8; // HDR so bloom picks up the smear; base edge fades to the skin colour
      col.set([this.c0.r * f * 0.35, this.c0.g * f * 0.35, this.c0.b * f * 0.35], i * 6);
      col.set([(this.c0.r * 0.75 + this.c1.r * 0.45) * e, (this.c0.g * 0.75 + this.c1.g * 0.45) * e, (this.c0.b * 0.75 + this.c1.b * 0.45) * e], i * 6 + 3);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}
