// Stylised river: analytic shoreline (riverSdf), depth tint, animated normals, fresnel sky, sun glints/sparkles,
// bank + rock foam, flow streaks. Plus the upper stream and the waterfall that feeds it.
import * as THREE from 'three';
import { WORLD } from '../util.js';
import { RIVER_GLSL, riverUniforms, detailTexture } from './terrain.js';

const PI = Math.PI;

export function makeRiverMat(rp, level = -0.25, opts = {}) {
  const isl = (rp.islands || []).concat([{ x: -999, y: -999, r: 0 }, { x: -999, y: -999, r: 0 }]).slice(0, 2);
  return new THREE.ShaderMaterial({
    uniforms: {
      ...riverUniforms(rp), uTime: WORLD.uTime, uDetail: { value: detailTexture() }, uIsl: { value: isl.map((q) => new THREE.Vector3(q.x, q.y, q.r)) },
      uShallow: { value: new THREE.Color('#4fd6d0') }, uDeep: { value: new THREE.Color('#1d5fae') }, uFoam: { value: new THREE.Color('#f4feff') },
      uSkyTop: { value: new THREE.Color('#7ab8ff') }, uSkyHor: { value: new THREE.Color('#e6f6ff') }, uSunDir: { value: new THREE.Vector3(-0.62, 0.62, 0.48).normalize() }, uSunCol: { value: new THREE.Color('#fff2d0') },
      uLevel: { value: level }, uFlowK: { value: opts.flow ?? 1 }, uClipZ: { value: opts.clipZ ?? new THREE.Vector2(-1e4, 1e4) }, uDim: { value: 1 },
    },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform sampler2D uDetail; uniform vec4 uRiv; uniform float uRivSW; uniform vec3 uPits[2]; uniform vec3 uIsl[2];
      uniform vec3 uShallow, uDeep, uFoam, uSkyTop, uSkyHor, uSunDir, uSunCol; uniform float uFlowK; uniform vec2 uClipZ; uniform float uDim;
      varying vec3 vW;
      ${RIVER_GLSL}
      void main(){
        vec2 p = vW.xz; if (p.y < uClipZ.x || p.y > uClipZ.y) discard;
        float d = riverSdf(p);
        if (d > 0.08) discard;
        float di = 1e3; for (int i = 0; i < 2; i++) { if (uIsl[i].z > 0.0) di = min(di, length(p - uIsl[i].xy) - uIsl[i].z); }
        float depth = clamp(-d / 4.5, 0.0, 1.0);
        float ft = uTime * uFlowK;
        vec2 f1 = p * 0.085 - vec2(0.02, ft * 0.06), f2 = p * 0.15 + vec2(ft * 0.02, -ft * 0.11);
        float h0 = texture2D(uDetail, f1).r, hx = texture2D(uDetail, f1 + vec2(0.012, 0.0)).r, hz = texture2D(uDetail, f1 + vec2(0.0, 0.012)).r;
        float g0 = texture2D(uDetail, f2).r, gx = texture2D(uDetail, f2 + vec2(0.012, 0.0)).r, gz = texture2D(uDetail, f2 + vec2(0.0, 0.012)).r;
        vec3 N = normalize(vec3((h0 - hx) * 2.4 + (g0 - gx) * 1.6, 1.0, (h0 - hz) * 2.4 + (g0 - gz) * 1.6));
        vec3 V = normalize(cameraPosition - vW);
        float fres = 0.05 + 0.75 * pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 4.0);
        vec3 Rf = reflect(-V, N);
        vec3 sky = mix(uSkyHor, uSkyTop, clamp(Rf.y, 0.0, 1.0));
        vec3 col = mix(uShallow, uDeep, smoothstep(0.05, 0.85, depth));
        col = mix(col, col * 0.82, smoothstep(0.5, 0.56, depth) * 0.6);   // toon depth band
        col = mix(col, sky, fres);
        float spec = pow(max(dot(reflect(-uSunDir, N), V), 0.0), 220.0);
        float spark = step(0.72, texture2D(uDetail, p * 0.55 + vec2(ft * 0.03, -ft * 0.05)).a) * pow(max(dot(reflect(-uSunDir, N), V), 0.0), 40.0);
        float fn = texture2D(uDetail, p * 0.33 + vec2(0.0, -ft * 0.22)).a; float fn2 = texture2D(uDetail, p * 0.12 + vec2(ft * 0.02, -ft * 0.08)).r;
        float bank = 1.0 - smoothstep(0.0, 0.7 + 0.8 * fn2, -d);
        float isle = 1.0 - smoothstep(0.0, 1.1 + 0.9 * fn2, di);
        float foam = smoothstep(0.42, 0.62, (bank + isle) * (0.55 + fn * 0.7));
        float ringD = -d - 1.5 - 0.35 * sin(uTime * 1.3 + p.y * 0.35);
        float ring = (1.0 - smoothstep(0.0, 0.18, abs(ringD))) * smoothstep(0.35, 0.7, fn) * 0.7;
        float iringD = di - 1.8 - 0.3 * sin(uTime * 1.7 + p.x);
        ring += (1.0 - smoothstep(0.0, 0.2, abs(iringD))) * smoothstep(0.3, 0.7, fn) * 0.7;
        float st = texture2D(uDetail, vec2(p.x * 0.22, p.y * 0.05 - ft * 0.16)).r;
        float streak = smoothstep(0.64, 0.7, st) * 0.4 * (1.0 - bank) * uFlowK;
        col = mix(col, uFoam, clamp(foam + ring + streak, 0.0, 1.0));
        col += uSunCol * (spec * 5.0 + spark * 3.5);
        float a = mix(0.62, 0.94, smoothstep(0.0, 0.45, depth));
        a = max(a, foam * 0.95) * smoothstep(0.08, -0.04, d);
        gl_FragColor = vec4(col * uDim, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
  });
}

export function makeFallMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: WORLD.uTime, uDetail: { value: detailTexture() } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform sampler2D uDetail; varying vec2 vUv; varying vec3 vW;
      void main(){
        float s = texture2D(uDetail, vec2(vUv.x * 1.3, vUv.y * 0.45 - uTime * 0.9)).r;
        float s2 = texture2D(uDetail, vec2(vUv.x * 2.7 + 0.3, vUv.y * 0.8 - uTime * 1.4)).a;
        vec3 deep = vec3(0.12, 0.42, 0.62), lite = vec3(0.75, 0.95, 1.0);
        vec3 col = mix(deep, lite, smoothstep(0.35, 0.75, s * 0.7 + s2 * 0.5));
        float foamTop = smoothstep(0.12, 0.0, vUv.y), foamBot = smoothstep(0.72, 1.0, vUv.y);
        col = mix(col, vec3(1.0), clamp(foamTop + foamBot * (0.6 + 0.4 * s2), 0.0, 1.0));
        col *= 1.15;
        float edge = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
        gl_FragColor = vec4(col, (0.82 + 0.18 * s2) * edge);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

/** builds river + upper stream + waterfall meshes; returns group */
export function buildWater(terrain) {
  const rp = terrain.rp; const g = new THREE.Group(); g.name = 'water'; if (!rp) return { group: g };
  const W = terrain.W, H = terrain.H;
  // main surface: covers river + stream from just below the waterfall to the southern cave
  const z0 = 1.2, z1 = H + 8;
  const geo = new THREE.PlaneGeometry(rp.w * 2 + 22, z1 - z0, 1, 1); geo.rotateX(-PI / 2); geo.translate(rp.cx, -0.25, (z0 + z1) / 2);
  const mat = makeRiverMat(rp, -0.25, { clipZ: new THREE.Vector2(z0, z1) });
  const main = new THREE.Mesh(geo, mat); main.renderOrder = 2; g.add(main);
  // upper stream (on the northern plateau)
  const ug = new THREE.PlaneGeometry(16, 40, 1, 1); ug.rotateX(-PI / 2); ug.translate(rp.cx, 3.95, -1.6 - 20);
  const up = new THREE.Mesh(ug, makeRiverMat(rp, 3.95, { clipZ: new THREE.Vector2(-60, -1.4), flow: 1.4 })); up.renderOrder = 2; g.add(up);
  // waterfall ribbon: from the plateau lip down to the river
  const seg = 14, wid = 7.4; const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg; const z = -1.6 + t * 4.6; const y = 3.95 - 4.25 * Math.pow(t, 1.6); const zz = z + Math.sin(t * PI) * 0.4;
    const w = wid * (1 + t * 0.15);
    pos.push(rp.cx - w / 2, y, zz, rp.cx + w / 2, y, zz); uv.push(0, t, 1, t);
    if (i < seg) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); fg.setIndex(idx); fg.computeVertexNormals();
  const fall = new THREE.Mesh(fg, makeFallMat()); fall.renderOrder = 3; g.add(fall);
  return { group: g, mats: [mat, up.material, fall.material], fallAt: { x: rp.cx, z: 2.9, w: wid } };
}
