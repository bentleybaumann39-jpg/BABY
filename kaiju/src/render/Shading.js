// Shared shader plumbing. Every lit material in the game goes through patch(), which
// (1) hooks it into cascaded shadow maps, (2) replaces three's fog with height-based
// aerial perspective whose colour is read from the sky cube, and (3) lets a system add
// its own vertex/fragment edits. Uniforms in G are shared by reference.
import * as THREE from 'three';

export const G = {
  uFogCube: { value: null },
  uFogDensity: { value: 0.00028 },
  uFogFall: { value: 0.0045 },
  uFogMix: { value: 1.0 },
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunCol: { value: new THREE.Color(1, 1, 1) },
  uNight: { value: 0 },
  uWet: { value: 0 },
  uDust: { value: new THREE.Color(0.5, 0.46, 0.4) },
  // occlusion cutaway: buildings between the camera (A) and the kaiju (B) dissolve
  uCutA: { value: new THREE.Vector3(0, -1e5, 0) },
  uCutB: { value: new THREE.Vector3(0, -1e5, 0) },
  uCutR: { value: 0 },
  // current tone-mapping exposure, for emitters that must read at any time of day
  uExposure: { value: 1 },
};

let csm = null;
export function setCSM(c) { csm = c; }

const FOG_VERT_PARS = /* glsl */`
varying vec3 vFogWorld;
`;
const FOG_VERT = /* glsl */`
{
  vec4 fogWP = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  fogWP = instanceMatrix * fogWP;
  #endif
  vFogWorld = (modelMatrix * fogWP).xyz;
}
`;
export const FOG_FRAG_PARS = /* glsl */`
vec3 kjSafe(vec3 c) { return (any(isnan(c)) || any(isinf(c))) ? vec3(0.0) : min(c, vec3(2.0e4)); }
uniform samplerCube uFogCube;
uniform float uFogDensity, uFogFall, uFogMix;
varying vec3 vFogWorld;
vec3 kjFog(vec3 col, vec3 wp) {
  vec3 rd = wp - cameraPosition;
  float dist = length(rd);
  rd /= max(dist, 1e-4);
  float k = rd.y * uFogFall;
  float t = abs(k) > 1e-5 ? (1.0 - exp(-dist * k)) / k : dist;
  float amt = uFogDensity * exp(-max(cameraPosition.y, 0.0) * uFogFall) * t;
  float f = (1.0 - exp(-amt)) * uFogMix;
  vec3 fc = textureLod(uFogCube, normalize(vec3(rd.x, max(rd.y, 0.015), rd.z)), 4.0).rgb;
  return mix(col, fc, clamp(f, 0.0, 1.0));
}
`;

export function patch(mat, key = 'base', hook = null, opts = {}) {
  if (csm && opts.shadows !== false) csm.setupMaterial(mat);
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    sh.uniforms.uFogCube = G.uFogCube;
    sh.uniforms.uFogDensity = G.uFogDensity;
    sh.uniforms.uFogFall = G.uFogFall;
    sh.uniforms.uFogMix = G.uFogMix;
    sh.uniforms.uTime = G.uTime;
    sh.uniforms.uNight = G.uNight;
    sh.uniforms.uSunDir = G.uSunDir;
    sh.uniforms.uSunCol = G.uSunCol;
    sh.uniforms.uWet = G.uWet;
    sh.uniforms.uDust = G.uDust;
    // the system hook runs first so the shared declarations below land above its code
    if (hook) hook(sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + FOG_VERT_PARS + 'uniform float uTime;\n')
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + FOG_VERT);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FOG_FRAG_PARS +
        'uniform float uTime, uNight, uWet;\nuniform vec3 uSunDir, uSunCol, uDust;\n')
      .replace('#include <fog_fragment>', (opts.fog === false ? '' : 'gl_FragColor.rgb = kjFog(gl_FragColor.rgb, vFogWorld);') +
        // keep the HDR buffer finite: a mirror glint can exceed half-float range and bloom would smear it everywhere
        '\ngl_FragColor.rgb = kjSafe(gl_FragColor.rgb);');
  };
  mat.customProgramCacheKey = () => 'kj-' + key + (csm && opts.shadows !== false ? '-csm' : '');
  return mat;
}

// Patches every material of a loaded glTF scene (deduplicated).
export function patchTree(root, key = 'gltf') {
  const seen = new Set();
  root.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (seen.has(m)) continue;
      seen.add(m);
      patch(m, key + '-' + m.uuid);
    }
  });
}

// GLSL helpers shared by procedural surfaces.
export const NOISE_GLSL = /* glsl */`
float kjH12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float kjH13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float kjN2(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(kjH12(i), kjH12(i + vec2(1, 0)), u.x), mix(kjH12(i + vec2(0, 1)), kjH12(i + vec2(1, 1)), u.x), u.y);
}
float kjN3(vec3 p) {
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(kjH13(i), kjH13(i + vec3(1, 0, 0)), u.x), mix(kjH13(i + vec3(0, 1, 0)), kjH13(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(kjH13(i + vec3(0, 0, 1)), kjH13(i + vec3(1, 0, 1)), u.x), mix(kjH13(i + vec3(0, 1, 1)), kjH13(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
float kjF2(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * kjN2(p); p = p * 2.02 + 7.3; a *= 0.5; } return s; }
float kjF3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * kjN3(p); p = p * 2.02 + 7.3; a *= 0.5; } return s; }
`;
