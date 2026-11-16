// Hero / unit materials (HEROES lead). MeshStandardMaterial-based so they react to the
// WORLD owner's env lighting + bloom. Per-vertex material params come from the builder:
//   color  (vec3)  albedo
//   aMat   (vec3)  x = glow (emissive strength 0..1+), y = metalness, z = roughness
// Extra uniforms (all in mat.userData.u, kept compatible with the old toon material):
//   rimColor, rimStrength  fresnel rim (silhouette pop)
//   flash, flashColor      hit flash (0..1)
//   dissolve, dissolveColor  death dissolve (0 = solid, 1 = gone) with glowing edge
//   glowBoost              emissive multiplier for aMat.x parts (bloom food)
//   tint, tintAmt          whole-body colour wash (frozen / stealth / spawn)
import * as THREE from 'three';

const NOISE = `
float gsHash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float gsNoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(gsHash(i+vec3(0,0,0)),gsHash(i+vec3(1,0,0)),f.x), mix(gsHash(i+vec3(0,1,0)),gsHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(gsHash(i+vec3(0,0,1)),gsHash(i+vec3(1,0,1)),f.x), mix(gsHash(i+vec3(0,1,1)),gsHash(i+vec3(1,1,1)),f.x),f.y), f.z); }
`;

export function makeHeroMat(opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 1, metalness: 1,
    color: opts.color ?? 0xffffff, envMapIntensity: opts.envMapIntensity ?? 1.0,
  });
  const u = {
    rimColor: { value: new THREE.Color(opts.rim ?? 0xffffff) }, rimStrength: { value: opts.rimStrength ?? 0.5 },
    flash: { value: 0 }, flashColor: { value: new THREE.Color(1, 1, 1) },
    dissolve: { value: 0 }, dissolveColor: { value: new THREE.Color(opts.dissolveColor ?? '#ffd27a') },
    glowBoost: { value: opts.glowBoost ?? 2.2 }, tint: { value: new THREE.Color(1, 1, 1) }, tintAmt: { value: 0 },
    ambientLift: { value: opts.ambientLift ?? 0.16 },
  };
  m.userData.u = u;
  m.defaultAttributeValues = { ...(m.defaultAttributeValues || {}), color: [1, 1, 1], aMat: [0, 0, 0.8] };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aMat; varying vec3 vMat; varying vec3 vObjP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat; vObjP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vMat; varying vec3 vObjP;
        uniform vec3 rimColor; uniform float rimStrength; uniform float flash; uniform vec3 flashColor;
        uniform float dissolve; uniform vec3 dissolveColor; uniform float glowBoost; uniform vec3 tint; uniform float tintAmt; uniform float ambientLift;
        ${NOISE}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float gsN = 0.0; if (dissolve > 0.001) { gsN = gsNoise(vObjP * 3.1) * 0.75 + gsNoise(vObjP * 9.0) * 0.25; if (gsN < dissolve) discard; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * tint, tintAmt);`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(vMat.z, 0.05, 1.0);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = clamp(vMat.y, 0.0, 1.0);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vMat.x * glowBoost;
        totalEmissiveRadiance += diffuseColor.rgb * ambientLift * (1.0 - vMat.y * 0.5);`)
      .replace('#include <opaque_fragment>', `
        { vec3 gsV = normalize(vViewPosition); float fr = 1.0 - clamp(dot(gsV, normal), 0.0, 1.0);
          float up = clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);
          outgoingLight += rimColor * pow(fr, 3.0) * rimStrength * (0.55 + 0.45 * up); }
        if (dissolve > 0.001) { float e = smoothstep(dissolve + 0.09, dissolve, gsN); outgoingLight = mix(outgoingLight, dissolveColor * 3.0, e); }
        outgoingLight = mix(outgoingLight, flashColor * 1.6, flash);
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'gsHeroMat2';
  return m;
}

// Unlit additive glow material for VFX meshes (toneMapped:false so bloom catches them).
export function makeAddMat(color = 0xffffff, opacity = 1, extra = {}) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, ...extra });
}
