// Custom lightweight post pipeline (no EffectComposer):
//   scene → linear HDR target (HalfFloat, MSAA) → bloom prefilter (½ res) → dual-kawase down/up chain
//   → ONE composite pass: bloom + cloud shadows + canopy dapple + fog-of-war + atmospheric haze
//     + ACES tonemap + split-tone grade + saturation + vignette + dither + sRGB.
// Overlay scene (health bars, damage numbers, aim indicators) is drawn afterwards, untouched by grading.
import * as THREE from 'three';
import { mkRand } from '../util.js';

const FS_VERT = `varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function tri() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return g;
}

// tileable fbm noise texture (clouds / dapple)
function cloudTexture(N = 128) {
  const R = mkRand(4242); const L = 8; const lat = new Float32Array(L * L * 4);
  for (let i = 0; i < lat.length; i++) lat[i] = R();
  const vnoise = (x, y, per, o) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const h = (a, b) => lat[(((a % per) + per) % per + (((b % per) + per) % per) * L) * 4 % lat.length + o];
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v; };
  const d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let a = 0, amp = 0.5, f = 2, s = 0;
    for (let o = 0; o < 4; o++) { a += vnoise(x / N * f, y / N * f, f, o % 4) * amp; s += amp; amp *= 0.5; f *= 2; }
    a /= s; const i = (y * N + x) * 4;
    d[i] = Math.max(0, Math.min(255, a * 255)); d[i + 1] = Math.max(0, Math.min(255, vnoise(x / N * 8, y / N * 8, 8, 1) * 255)); d[i + 2] = 0; d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

export class PostPipeline {
  constructor(gl, quality = 'med') {
    this.gl = gl; this.quality = quality;
    const caps = gl.capabilities; const ext = gl.extensions;
    this.webgl2 = caps.isWebGL2 !== false;
    this.hdr = this.webgl2 && (ext.has('EXT_color_buffer_half_float') || ext.has('EXT_color_buffer_float'));
    this.type = this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(tri(), null); this.quad.frustumCulled = false;
    this.fsScene = new THREE.Scene(); this.fsScene.add(this.quad);
    this.cloud = cloudTexture();
    this.levels = []; this.w = 0; this.h = 0;
    this._mkMats();
    this.bloomStrength = 0.85; this.threshold = 1.0; this.knee = 0.45;
    this._invVP = new THREE.Matrix4();
  }
  _mkMats() {
    const sh = (frag, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra });
    this.mPre = sh(`uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThr; uniform float uKnee; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tSrc, vUv + uTexel*vec2(-1.0,-1.0)).rgb + texture2D(tSrc, vUv + uTexel*vec2(1.0,-1.0)).rgb + texture2D(tSrc, vUv + uTexel*vec2(-1.0,1.0)).rgb + texture2D(tSrc, vUv + uTexel*vec2(1.0,1.0)).rgb;
        c = min(c * 0.25, vec3(24.0)); if (!(c.r == c.r && c.g == c.g && c.b == c.b)) c = vec3(0.0); c = max(c, vec3(0.0)); float br = max(c.r, max(c.g, c.b));
        float soft = clamp(br - uThr + uKnee, 0.0, 2.0*uKnee); soft = soft*soft / (4.0*uKnee + 1e-4);
        float k = max(soft, br - uThr) / max(br, 1e-4); gl_FragColor = vec4(c * k, 1.0); }`,
    { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThr: { value: 1 }, uKnee: { value: 0.4 } });
    this.mDown = sh(`uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 4.0; c += texture2D(tSrc, vUv - uTexel).rgb; c += texture2D(tSrc, vUv + uTexel).rgb;
        c += texture2D(tSrc, vUv + vec2(uTexel.x, -uTexel.y)).rgb; c += texture2D(tSrc, vUv - vec2(uTexel.x, -uTexel.y)).rgb; gl_FragColor = vec4(c / 8.0, 1.0); }`,
    { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mUp = sh(`uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uW; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tSrc, vUv + vec2(-uTexel.x*2.0, 0.0)).rgb + texture2D(tSrc, vUv + vec2(uTexel.x*2.0, 0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, uTexel.y*2.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, -uTexel.y*2.0)).rgb;
        c += (texture2D(tSrc, vUv + uTexel).rgb + texture2D(tSrc, vUv - uTexel).rgb + texture2D(tSrc, vUv + vec2(uTexel.x, -uTexel.y)).rgb + texture2D(tSrc, vUv + vec2(-uTexel.x, uTexel.y)).rgb) * 2.0;
        gl_FragColor = vec4(c / 12.0 * uW, 1.0); }`,
    { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uW: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true });
    this.mComp = sh(`
      uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tFog; uniform sampler2D tCloud;
      uniform float uBloomI; uniform float uExposure; uniform float uSat; uniform vec3 uWarm; uniform vec3 uCool; uniform float uVig; uniform float uAspect;
      uniform mat4 uInvVP; uniform vec3 uCamPos; uniform vec4 uFogDom; uniform float uFogOn; uniform float uTime; uniform float uCloud; uniform vec3 uHazeCol; uniform vec3 uHaze;
      uniform float uSwell; uniform float uFlash; uniform vec3 uFlashCol; uniform float uBloomOn;
      varying vec2 vUv;
      vec3 rrt(vec3 v){ vec3 a = v*(v+0.0245786)-0.000090537; vec3 b = v*(0.983729*v+0.4329510)+0.238081; return a/b; }
      vec3 aces(vec3 c){ const mat3 I = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777);
        const mat3 O = mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602); return clamp(O * rrt(I * c), 0.0, 1.0); }
      vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055, step(0.0031308, c)); }
      float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      void main(){
        vec3 c = texture2D(tScene, vUv).rgb; if (!(c.r == c.r && c.g == c.g && c.b == c.b)) c = vec3(0.0); c = max(c, vec3(0.0));
        // ground-plane world position of this pixel (for world-space screen effects)
        vec4 fp = uInvVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); fp.xyz /= fp.w; vec3 dir = normalize(fp.xyz - uCamPos);
        float t = dir.y < -0.01 ? -uCamPos.y / dir.y : 400.0; vec3 wp = uCamPos + dir * t; vec2 w = wp.xz;
        vec4 F = texture2D(tFog, (w - uFogDom.xy) * uFogDom.zw);
        // drifting cloud shadows + sun-dappled canopy light
        float cl = texture2D(tCloud, w * 0.0085 + uTime * vec2(0.0042, 0.0026)).r;
        float cs = smoothstep(0.48, 0.72, cl) * uCloud;
        float dap = texture2D(tCloud, w * 0.075 + vec2(uTime * 0.004, -uTime*0.003)).g;
        float dp = F.g * (smoothstep(0.42, 0.62, dap) - 0.55) * 0.42;
        c *= (1.0 - cs) * (1.0 + dp);
        if (uBloomOn > 0.5) c += texture2D(tBloom, vUv).rgb * uBloomI;
        // final swell: blood-red pulse in the shadows
        c += uSwell * vec3(0.12, 0.02, 0.03) * (0.6 + 0.4 * sin(uTime * 2.2)) * (1.0 - smoothstep(0.0, 0.5, dot(c, vec3(0.33))));
        // fog of war: what we can't see is darker, desaturated and cooler
        float vis = mix(1.0, smoothstep(0.08, 0.92, F.r), uFogOn);
        float lum0 = dot(c, vec3(0.299, 0.587, 0.114));
        vec3 fogged = mix(vec3(lum0), c, 0.4) * vec3(0.46, 0.53, 0.68);
        c = mix(fogged, c, vis);
        // atmospheric haze toward the top of the view / distance
        float hz = smoothstep(uHaze.x, uHaze.y, t) * uHaze.z; c = mix(c, uHazeCol, hz);
        c = mix(c, uFlashCol, uFlash);
        c = aces(c * uExposure / 0.6);
        float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c *= mix(uCool, uWarm, smoothstep(0.05, 0.75, L));
        c = mix(vec3(L), c, uSat);
        c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
        vec2 q = vUv - 0.5; q.x *= uAspect * 0.62; float vg = 1.0 - smoothstep(0.18, 0.75, length(q)) * uVig;
        c *= vg;
        c = toSRGB(clamp(c, 0.0, 1.0));
        c += (hash12(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
    {
      tScene: { value: null }, tBloom: { value: null }, tFog: { value: null }, tCloud: { value: this.cloud }, uBloomI: { value: 0.85 }, uBloomOn: { value: 1 },
      uExposure: { value: 1.1 }, uSat: { value: 1.1 }, uWarm: { value: new THREE.Color(1, 0.97, 0.92) }, uCool: { value: new THREE.Color(0.9, 0.95, 1.05) }, uVig: { value: 0.3 }, uAspect: { value: 2 },
      uInvVP: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() }, uFogDom: { value: new THREE.Vector4(0, 0, 1 / 240, 1 / 160) }, uFogOn: { value: 0 }, uTime: { value: 0 }, uCloud: { value: 0.25 },
      uHazeCol: { value: new THREE.Color('#9fc4d8') }, uHaze: { value: new THREE.Vector3(48, 95, 0.35) }, uSwell: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 1, 1) },
    });
    // dummy 1x1 fog (fully visible) until a fog texture is provided
    const d = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1); d.needsUpdate = true; this.mComp.uniforms.tFog.value = d; this._fogDummy = d;
  }
  setQuality(q) { if (q === this.quality) return; this.quality = q; this.w = 0; }
  _rt(w, h, samples = 0) {
    const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type: this.type, format: THREE.RGBAFormat, depthBuffer: samples >= 0, samples: Math.max(0, samples), minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace; return rt;
  }
  setSize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h; this.dispose(true);
    const samples = this.webgl2 ? (this.quality === 'high' ? 4 : 4) : 0;
    this.rtScene = this._rt(w, h, samples);
    const nLev = this.quality === 'high' ? 5 : 4;
    this.levels = [];
    let lw = w >> 1, lh = h >> 1;
    for (let i = 0; i < nLev && lw >= 4 && lh >= 4; i++) { const rt = this._rt(lw, lh, -1); rt.depthBuffer = false; this.levels.push(rt); lw >>= 1; lh >>= 1; }
  }
  _pass(mat, target, clear = true) {
    this.quad.material = mat; const g = this.gl;
    g.setRenderTarget(target); if (clear) g.clear(true, false, false);
    g.render(this.fsScene, this.cam);
  }
  /** p: { overlay, mood, fogTex, fogDomain, fogOn, time, swell, flash, flashColor } */
  render(scene, camera, p = {}) {
    const g = this.gl; const W = g.domElement.width, H = g.domElement.height;
    this.setSize(W, H);
    const prevAuto = g.autoClear; const prevTM = g.toneMapping;
    g.toneMapping = THREE.NoToneMapping;
    g.autoClear = true;
    g.setRenderTarget(this.rtScene); g.render(scene, camera);
    g.autoClear = false;
    // bloom
    const L = this.levels;
    if (L.length) {
      const pre = this.mPre.uniforms; pre.tSrc.value = this.rtScene.texture; pre.uTexel.value.set(1 / W, 1 / H); pre.uThr.value = this.threshold; pre.uKnee.value = this.knee;
      this._pass(this.mPre, L[0]);
      for (let i = 1; i < L.length; i++) { const u = this.mDown.uniforms; u.tSrc.value = L[i - 1].texture; u.uTexel.value.set(1 / L[i - 1].width, 1 / L[i - 1].height); this._pass(this.mDown, L[i]); }
      for (let i = L.length - 1; i > 0; i--) { const u = this.mUp.uniforms; u.tSrc.value = L[i].texture; u.uTexel.value.set(0.5 / L[i].width, 0.5 / L[i].height); u.uW.value = 1.0; this._pass(this.mUp, L[i - 1], false); }
    }
    // composite
    const u = this.mComp.uniforms; const m = p.mood;
    u.tScene.value = this.rtScene.texture; u.tBloom.value = L.length ? L[0].texture : this.rtScene.texture; u.uBloomOn.value = L.length ? 1 : 0;
    u.uBloomI.value = this.bloomStrength / Math.max(1, L.length * 0.5);
    if (m) { u.uExposure.value = m.exposure; u.uSat.value = m.sat; u.uWarm.value.copy(m.warm); u.uCool.value.copy(m.cool); u.uVig.value = m.vig; u.uCloud.value = m.cloud; u.uHazeCol.value.copy(m.fog); }
    u.uAspect.value = W / H; u.uTime.value = p.time || 0; u.uSwell.value = p.swell || 0;
    u.uFlash.value = p.flash || 0; if (p.flashColor) u.uFlashCol.value.copy(p.flashColor);
    camera.updateMatrixWorld(); this._invVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert(); u.uInvVP.value.copy(this._invVP);
    u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    if (p.fogTex) { u.tFog.value = p.fogTex; u.uFogDom.value.copy(p.fogDomain); u.uFogOn.value = p.fogOn ? 1 : 0; } else { u.tFog.value = this._fogDummy; u.uFogOn.value = 0; }
    this._pass(this.mComp, null, true);
    if (p.overlay) { g.clearDepth(); g.render(p.overlay, camera); }
    g.autoClear = prevAuto; g.toneMapping = prevTM;
  }
  dispose(keepMats) {
    this.rtScene?.dispose(); this.rtScene = null; for (const l of this.levels) l.dispose(); this.levels = [];
    if (!keepMats) { for (const m of [this.mPre, this.mDown, this.mUp, this.mComp]) m.dispose(); this.cloud.dispose(); this._fogDummy.dispose(); this.quad.geometry.dispose(); }
  }
}
