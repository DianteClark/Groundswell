// GPU-animated ambient life — zero per-frame CPU work besides a few uniforms:
//  • Halos: static additive glow points (lanterns, crystals, mushrooms, runes), flicker in shader.
//  • Fields: fireflies / pollen motes / falling leaves that wrap around the camera (infinite field).
//  • Mist: soft river mist puffs drifting downstream.
//  • God rays: additive light shafts slanting along the sun direction in jungle clearings.
import * as THREE from 'three';
import { WORLD, mkRand } from '../util.js';

const PI = Math.PI;

export class Halos {
  constructor() { this.p = []; this.c = []; this.s = []; this.f = []; }
  add(x, y, z, color, size = 2, flicker = 0.2) { const c = new THREE.Color(color); this.p.push(x, y, z); this.c.push(c.r, c.g, c.b); this.s.push(size); this.f.push(flicker); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('hcol', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('hsize', new THREE.Float32BufferAttribute(this.s, 1)); g.setAttribute('hflick', new THREE.Float32BufferAttribute(this.f, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: WORLD.uTime, uScale: { value: 400 }, uI: { value: 1 } },
      vertexShader: `attribute vec3 hcol; attribute float hsize; attribute float hflick; uniform float uTime; uniform float uScale; uniform float uI; varying vec3 vC;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float ph = position.x * 1.7 + position.z * 2.3;
          float fl = 1.0 - hflick * (0.5 + 0.5 * sin(uTime * 7.0 + ph) * sin(uTime * 3.1 + ph * 0.5));
          gl_PointSize = hsize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; vC = hcol * fl * uI; }`,
      fragmentShader: `varying vec3 vC; void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; float d = dot(p, p); float a = exp(-d * 4.0) * (1.0 - smoothstep(0.7, 1.0, d)); if (a < 0.01) discard; gl_FragColor = vec4(vC * a, a);
        #include <colorspace_fragment>
      }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat); this.points.renderOrder = 19; this.points.frustumCulled = false;
    this.p = this.c = this.s = this.f = null; return this.points;
  }
}

// camera-wrapped particle fields
export class AmbientField {
  constructor(quality = 'med') {
    const R = mkRand(555); this.group = new THREE.Group(); this.mats = [];
    const q = quality === 'high' ? 1 : quality === 'low' ? 0.35 : 0.7;
    const S = new THREE.Vector3(96, 1, 72);
    this.center = { value: new THREE.Vector3() };
    const mk = (n, fill, frag, blending = THREE.AdditiveBlending, order = 21) => {
      const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { fill(i, pos, seed); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: WORLD.uTime, uScale: { value: 400 }, uCenter: this.center, uSize: { value: S }, uI: { value: 1 }, uWind: { value: new THREE.Vector2(0.8, 0.5) } },
        vertexShader: `attribute vec4 seed; uniform float uTime; uniform float uScale; uniform vec3 uCenter; uniform vec3 uSize; uniform vec2 uWind; uniform float uI; varying vec4 vS; varying float vA;
          ${frag.vert}
          void main(){ vec3 p = position; float t = uTime; ${frag.move}
            p.xz = uCenter.xz + mod(p.xz - uCenter.xz + uSize.xz * 0.5, uSize.xz) - uSize.xz * 0.5;
            vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = SIZE * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; vS = seed;
            vec2 e = abs(p.xz - uCenter.xz) / (uSize.xz * 0.5); vA = (1.0 - smoothstep(0.75, 1.0, max(e.x, e.y))) * uI; }`,
        fragmentShader: `varying vec4 vS; varying float vA; uniform float uTime; void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; ${frag.frag} }`,
        transparent: true, depthWrite: false, blending,
      });
      const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = order; this.group.add(pts); this.mats.push(m); return pts;
    };
    // fireflies: glowing, wandering, blinking
    this.fire = mk(Math.round(150 * q), (i, pos, sd) => { pos[i * 3] = R() * S.x; pos[i * 3 + 1] = 0.5 + R() * 2.6; pos[i * 3 + 2] = R() * S.z; sd.set([R(), R(), R(), R()], i * 4); }, {
      vert: '#define SIZE (0.55 + seed.z * 0.35)',
      move: 'p.x += sin(t * (0.3 + seed.x * 0.4) + seed.y * 20.0) * 2.2; p.z += cos(t * (0.25 + seed.y * 0.4) + seed.x * 20.0) * 2.2; p.y += sin(t * 0.9 + seed.w * 10.0) * 0.5;',
      frag: `float d = dot(p, p); float blink = smoothstep(0.2, 0.9, sin(uTime * (1.2 + vS.x * 1.6) + vS.y * 40.0)); float a = (exp(-d * 6.0) + exp(-d * 40.0)) * blink * vA; if (a < 0.01) discard;
        vec3 c = mix(vec3(0.75, 1.0, 0.35), vec3(1.0, 0.85, 0.35), vS.z) * 2.2; gl_FragColor = vec4(c * a, a);`,
    });
    // pollen / dust motes catching the sun
    this.pollen = mk(Math.round(220 * q), (i, pos, sd) => { pos[i * 3] = R() * S.x; pos[i * 3 + 1] = 0.3 + R() * 5; pos[i * 3 + 2] = R() * S.z; sd.set([R(), R(), R(), R()], i * 4); }, {
      vert: '#define SIZE (0.16 + seed.z * 0.14)',
      move: 'p.xz += uWind * t * (0.6 + seed.x * 0.8); p.y += sin(t * 0.7 + seed.w * 30.0) * 0.6;',
      frag: `float d = dot(p, p); float a = exp(-d * 5.0) * vA * (0.45 + 0.35 * sin(uTime * 2.0 + vS.y * 50.0)); if (a < 0.01) discard; gl_FragColor = vec4(vec3(1.0, 0.95, 0.8) * a * 1.2, a);`,
    });
    // falling leaves (normal blending, little rotating ellipses)
    this.leaves = mk(Math.round(70 * q), (i, pos, sd) => { pos[i * 3] = R() * S.x; pos[i * 3 + 1] = R() * 9; pos[i * 3 + 2] = R() * S.z; sd.set([R(), R(), R(), R()], i * 4); }, {
      vert: '#define SIZE (0.38 + seed.z * 0.2)',
      move: 'float fall = mod(position.y - t * (0.6 + seed.x * 0.5), 9.0); p.y = fall; p.xz += uWind * (9.0 - fall) * 0.9 + vec2(sin(t * 1.3 + seed.y * 30.0), cos(t * 1.1 + seed.w * 30.0)) * 0.8;',
      frag: `float an = uTime * (1.0 + vS.x * 2.0) + vS.y * 30.0; vec2 q = mat2(cos(an), -sin(an), sin(an), cos(an)) * p; q.y *= 2.2; float d = dot(q, q); if (d > 1.0) discard;
        vec3 c = mix(vec3(0.42, 0.65, 0.2), vec3(0.95, 0.55, 0.2), step(0.62, vS.w)); c = mix(c, vec3(1.0, 0.65, 0.75), step(0.9, vS.w)); c *= 0.75 + 0.35 * q.x;
        gl_FragColor = vec4(c, vA * 0.95);
        #include <colorspace_fragment>`,
    }, THREE.NormalBlending, 11);
  }
  update(cx, cz, scale, intensity = 1) {
    this.center.value.set(cx, 0, cz);
    for (const m of this.mats) { m.uniforms.uScale.value = scale; }
    this.mats[0].uniforms.uI.value = intensity;
  }
}

// river mist: static puffs along the river, drifting downstream (wrap in z over river length)
export function buildMist(rp, quality) {
  if (!rp) return null; const R = mkRand(91); const n = quality === 'high' ? 70 : quality === 'low' ? 0 : 45; if (!n) return null;
  const pos = new Float32Array(n * 3), sd = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { pos[i * 3] = rp.cx + (R() - 0.5) * rp.w * 1.6; pos[i * 3 + 1] = 0.1 + R() * 0.7; pos[i * 3 + 2] = rp.y0 + R() * (rp.y1 - rp.y0); sd[i * 2] = R(); sd[i * 2 + 1] = R(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(sd, 2));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: WORLD.uTime, uScale: { value: 400 }, uY: { value: new THREE.Vector2(rp.y0, rp.y1 - rp.y0) } },
    vertexShader: `attribute vec2 seed; uniform float uTime; uniform float uScale; uniform vec2 uY; varying float vA;
      void main(){ vec3 p = position; float z = mod(p.z - uY.x + uTime * (0.6 + seed.x * 0.6), uY.y); p.z = uY.x + z; p.x += sin(uTime * 0.3 + seed.y * 20.0) * 1.2;
        float edge = smoothstep(0.0, 8.0, z) * smoothstep(uY.y, uY.y - 8.0, z);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (3.5 + seed.y * 3.0) * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; vA = edge * (0.08 + 0.06 * seed.x); }`,
    fragmentShader: `varying float vA; void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; float a = exp(-dot(p, p) * 3.0) * vA; if (a < 0.004) discard; gl_FragColor = vec4(vec3(0.92, 0.98, 1.0), a);
      #include <colorspace_fragment>
    }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 9; return pts;
}

// god rays: slanted additive quads along the sun direction
export function buildGodRays(spots, sunDir) {
  if (!spots.length) return null;
  const down = sunDir.clone().negate().normalize(); const view = new THREE.Vector3(0, -0.82, -0.57).normalize();
  const side = new THREE.Vector3().crossVectors(down, view).normalize();
  const pos = [], uv = [], seed = [], idx = []; let v = 0; const R = mkRand(33);
  for (const s of spots) {
    const len = s.len ?? 16, w = s.w ?? 2.6; const base = new THREE.Vector3(s.x, s.y ?? 0, s.z); const top = base.clone().addScaledVector(down, -len);
    const sd = R();
    for (const [p, vv] of [[top, 1], [base, 0]]) for (const k of [-1, 1]) { const q = p.clone().addScaledVector(side, k * w * (vv ? 1.3 : 0.8)); pos.push(q.x, q.y, q.z); uv.push(k * 0.5 + 0.5, vv); seed.push(sd); }
    idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); v += 4;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: WORLD.uTime, uColor: { value: new THREE.Color('#fff1c8') }, uI: { value: 0.22 } },
    vertexShader: 'attribute float seed; varying vec2 vUv; varying float vS; void main(){ vUv = uv; vS = seed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uI; varying vec2 vUv; varying float vS;
      void main(){ float x = vUv.x; float stripes = 0.55 + 0.45 * sin(x * 18.0 + vS * 40.0 + uTime * 0.3) * sin(x * 7.0 - uTime * 0.2 + vS * 9.0);
        float a = sin(x * 3.14159) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, vUv.y) * stripes * uI * (0.75 + 0.25 * sin(uTime * 0.5 + vS * 6.0));
        gl_FragColor = vec4(uColor * a, a);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 18; mesh.frustumCulled = false; return mesh;
}
