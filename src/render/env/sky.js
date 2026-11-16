// Lighting rig + environment (PMREM gradient sky) + mood presets (day / final swell).
import * as THREE from 'three';
import { WORLD } from '../util.js';

const C = (c) => new THREE.Color(c);
// Mood presets. All colours linear-ish design values; blended by LightRig.update.
export const MOODS = {
  day: {
    sun: C('#ffe0b0'), sunI: 3.4, sky: C('#b9d6ff'), ground: C('#4d5e3a'), hemiI: 0.78,
    fog: C('#9fc4d8'), exposure: 1.0, sat: 1.05, warm: C('#ffefd8'), cool: C('#c9dcff'), rim: C('#ffd9a8'), rimS: 0.55, cloud: 0.26, vig: 0.32, bg: C('#2b4a5e'),
  },
  swell: {
    sun: C('#ffa070'), sunI: 2.4, sky: C('#8a78b8'), ground: C('#3e2a36'), hemiI: 0.95,
    fog: C('#5a3a5e'), exposure: 1.12, sat: 1.18, warm: C('#ffc8a0'), cool: C('#a090ff'), rim: C('#ff7a4a'), rimS: 0.9, cloud: 0.42, vig: 0.5, bg: C('#1a1020'),
  },
};

export function buildEnvironment(gl) {
  // gradient sky dome + sun blob → PMREM (once). Gives materials soft directional ambient + spec.
  const sc = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: C('#5f9cff') }, hor: { value: C('#ffe9cf') }, bot: { value: C('#4a5e38') }, sunDir: { value: new THREE.Vector3(-0.55, 0.62, 0.55).normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 bot; uniform vec3 sunDir; varying vec3 vD;
      void main(){ float y = vD.y; vec3 c = y > 0.0 ? mix(hor, top, pow(y, 0.6)) : mix(hor*0.7, bot, pow(-y, 0.4));
        float s = max(dot(vD, sunDir), 0.0); c += vec3(1.0,0.85,0.6) * (pow(s, 48.0) * 6.0 + pow(s, 6.0) * 0.35);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  sc.add(new THREE.Mesh(geo, mat));
  const pm = new THREE.PMREMGenerator(gl);
  const rt = pm.fromScene(sc, 0.03);
  pm.dispose(); geo.dispose(); mat.dispose();
  return rt;
}

export class LightRig {
  constructor(scene) {
    this.scene = scene;
    this.hemi = new THREE.HemisphereLight('#cfe6ff', '#55683f', 1.05); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffe2b8', 2.75); this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.035; this.sun.shadow.radius = 2.5;
    scene.add(this.sun); scene.add(this.sun.target);
    // direction TO the sun (world): from south-west, fairly low → long crisp shadows to the upper right
    this.sunDir = new THREE.Vector3(-0.62, 0.62, 0.48).normalize();
    this.mood = {}; for (const k in MOODS.day) this.mood[k] = MOODS.day[k].clone ? MOODS.day[k].clone() : MOODS.day[k];
    this.swell = 0; this.swellTarget = 0; this.pulse = 0;
    this._v = new THREE.Vector3(); this._m = new THREE.Matrix4(); this._c = new THREE.Vector3();
  }
  setShadowSize(px) {
    const s = this.sun.shadow; if (s.mapSize.x === px) return;
    s.mapSize.set(px, px); s.map?.dispose(); s.map = null;
  }
  // blend moods; returns current mood object (shared, do not keep references)
  update(dt, time) {
    this.swell += (this.swellTarget - this.swell) * (1 - Math.exp(-dt * 1.2));
    const k = this.swell, a = MOODS.day, b = MOODS.swell, m = this.mood;
    for (const key in a) { if (a[key].isColor) m[key].copy(a[key]).lerp(b[key], k); else m[key] = a[key] + (b[key] - a[key]) * k; }
    // final swell: lightning-ish pulses of the sun
    const p = k > 0.05 ? Math.max(0, Math.sin(time * 1.7) * Math.sin(time * 0.53)) * k : 0;
    this.pulse = p;
    this.sun.color.copy(m.sun); this.sun.intensity = m.sunI * (1 + p * 0.25);
    this.hemi.color.copy(m.sky); this.hemi.groundColor.copy(m.ground); this.hemi.intensity = m.hemiI;
    WORLD.uRimColor.value.copy(m.rim); WORLD.uRimStrength.value = m.rimS;
    return m;
  }
  // Fit the shadow frustum to the visible ground (camera view trapezoid) and texel-snap it.
  fit(camera, cx, cz, quality) {
    const sun = this.sun; const sc = sun.shadow.camera;
    // half extents in light space: big enough for the landscape view + tall props
    const ext = quality === 'high' ? 44 : 40;
    const size = sun.shadow.mapSize.x || 1024; const texel = (ext * 2) / size;
    // light basis
    const d = this.sunDir; const up = Math.abs(d.y) > 0.99 ? this._c.set(0, 0, 1) : this._c.set(0, 1, 0);
    this._m.lookAt(d, this._v.set(0, 0, 0), up); // rotation only
    const xAxis = new THREE.Vector3().setFromMatrixColumn(this._m, 0), yAxis = new THREE.Vector3().setFromMatrixColumn(this._m, 1);
    // project centre into light plane, snap, unproject
    const lx = cx * xAxis.x + cz * xAxis.z, ly = cx * yAxis.x + cz * yAxis.z;
    const sx = Math.round(lx / texel) * texel - lx, sy = Math.round(ly / texel) * texel - ly;
    const tx = cx + xAxis.x * sx + yAxis.x * sy, tz = cz + xAxis.z * sx + yAxis.z * sy, ty = xAxis.y * sx + yAxis.y * sy;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 190; sc.updateProjectionMatrix();
    sun.position.set(tx + d.x * 90, ty + d.y * 90, tz + d.z * 90); sun.target.position.set(tx, ty, tz); sun.target.updateMatrixWorld();
    // view-space sun dir for rim lighting
    WORLD.uSunDirV.value.copy(d).transformDirection(camera.matrixWorldInverse);
  }
}
