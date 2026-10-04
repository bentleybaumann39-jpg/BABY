// Material library. All lit materials get a patch that masks pooled point lights to their room bounds,
// so light never leaks through 1 m concrete walls.
import * as THREE from 'three';

export const LIGHT_BOUNDS = { value: [] };

export function setLightPoolSize(n) {
  LIGHT_BOUNDS.value = Array.from({ length: n }, () => new THREE.Vector4(-1e5, -1e5, 1e5, 1e5));
}

const LIGHT_MASK_GLSL = /* glsl */`
varying vec3 vWPos;
#if NUM_POINT_LIGHTS > 0
uniform vec4 uLightBounds[ NUM_POINT_LIGHTS ];
#endif
float lbMask( vec4 b ) {
  vec2 d = max( b.xy - vWPos.xz, vWPos.xz - b.zw );
  float o = max( d.x, d.y );
  return 1.0 - smoothstep( 0.0, 0.55, o );
}
`;

function patchLighting(shader) {
  shader.uniforms.uLightBounds = LIGHT_BOUNDS;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
    .replace('#include <project_vertex>', `#include <project_vertex>
  {
    vec4 _wp = vec4( transformed, 1.0 );
    #ifdef USE_INSTANCING
      _wp = instanceMatrix * _wp;
    #endif
    vWPos = ( modelMatrix * _wp ).xyz;
  }`);
  const chunk = THREE.ShaderChunk.lights_fragment_begin.replace(
    'getPointLightInfo( pointLight, geometryPosition, directLight );',
    'getPointLightInfo( pointLight, geometryPosition, directLight );\n\t\tdirectLight.color *= lbMask( uLightBounds[ i ] );'
  );
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + LIGHT_MASK_GLSL)
    .replace('#include <lights_fragment_begin>', chunk);
}

// Same function object for every material => shared program cache key.
function onBeforeCompileShared(shader) { patchLighting(shader); }

export function litMaterial(params) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = onBeforeCompileShared;
  m.customProgramCacheKey = () => 'lbmask1';
  return m;
}

export class MaterialLibrary {
  constructor(textures) {
    this.tex = textures;
    this.cache = new Map();
  }

  // Level surface material (vertex colours carry baked AO).
  surface(key) {
    const ck = 'surf:' + key;
    if (this.cache.has(ck)) return this.cache.get(ck);
    const t = this.tex[key];
    const p = SURFACE_PARAMS[key] || {};
    const m = litMaterial({
      map: t?.map || null,
      normalMap: t?.normalMap || null,
      roughnessMap: t?.roughnessMap || null,
      roughness: p.roughness ?? (t?.roughnessMap ? 1.0 : 0.85),
      metalness: p.metalness ?? 0,
      color: p.color ?? 0xffffff,
      vertexColors: true,
      normalScale: new THREE.Vector2(p.normalScale ?? 0.8, p.normalScale ?? 0.8),
      transparent: !!p.alpha,
      alphaTest: p.alpha ? 0.5 : 0,
      side: p.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    });
    m.name = key;
    this.cache.set(ck, m);
    return m;
  }

  // Prop materials: textured or flat.
  prop(name) {
    const ck = 'prop:' + name;
    if (this.cache.has(ck)) return this.cache.get(ck);
    const def = PROP_MATS[name];
    if (!def) throw new Error('Unknown prop material ' + name);
    const t = def.tex ? this.tex[def.tex] : null;
    let m;
    if (def.basic) {
      m = new THREE.MeshBasicMaterial({ color: def.color ?? 0xffffff, toneMapped: true, transparent: !!def.transparent, opacity: def.opacity ?? 1, side: def.side ?? THREE.FrontSide, depthWrite: def.depthWrite ?? true });
    } else {
      m = litMaterial({
        color: def.color ?? 0xffffff,
        map: t?.map || null,
        normalMap: t?.normalMap || null,
        roughnessMap: t?.roughnessMap || null,
        roughness: def.roughness ?? 0.7,
        metalness: def.metalness ?? 0,
        transparent: !!def.transparent,
        opacity: def.opacity ?? 1,
        emissive: def.emissive ?? 0x000000,
        emissiveIntensity: def.emissiveIntensity ?? 1,
        side: def.side ?? THREE.FrontSide,
        depthWrite: def.depthWrite ?? true,
        normalScale: new THREE.Vector2(def.normalScale ?? 0.6, def.normalScale ?? 0.6),
      });
    }
    m.name = name;
    if (t && def.repeat) {
      // Props use box UVs (0..1 per face); scale via texture transform on a clone.
      for (const k of ['map', 'normalMap', 'roughnessMap']) {
        if (m[k]) { m[k] = m[k].clone(); m[k].repeat.set(def.repeat, def.repeat); m[k].needsUpdate = true; }
      }
    }
    this.cache.set(ck, m);
    return m;
  }

  custom(name, factory) {
    const ck = 'custom:' + name;
    if (!this.cache.has(ck)) this.cache.set(ck, factory());
    return this.cache.get(ck);
  }
}

const SURFACE_PARAMS = {
  greenTile: { normalScale: 1.0 },
  whiteTile: { normalScale: 1.0 },
  blueTile: { normalScale: 1.0 },
  darkTile: { normalScale: 0.8 },
  terrazzo: { normalScale: 0.4 },
  woodFloor: { normalScale: 0.7 },
  steel: { metalness: 0.75, normalScale: 1.2 },
  wireGrid: { alpha: true, metalness: 0.6, doubleSide: true },
  foam: { normalScale: 1.5, roughness: 1 },
  foamPanel: { normalScale: 1.5, roughness: 1 },
  facade: { normalScale: 1.0 },
  grass: { normalScale: 1.2 },
  asphalt: { normalScale: 1.0 },
  polished: { normalScale: 0.5 },
  brick: { normalScale: 1.2 },
  concrete: { normalScale: 1.1 },
};

// Prop material palette.
export const PROP_MATS = {
  wood: { tex: 'woodPanel', roughness: 0.6, repeat: 1 },
  darkWood: { tex: 'darkWood', roughness: 0.45, repeat: 1 },
  woodLight: { color: 0xc9a77c, tex: 'woodFloor', roughness: 0.55, repeat: 1 },
  metalGreen: { tex: 'metalGreen', metalness: 0.5, repeat: 1 },
  metalGrey: { tex: 'metalGrey', metalness: 0.55, repeat: 1 },
  metalCream: { tex: 'metalCream', metalness: 0.45, repeat: 1 },
  rust: { tex: 'rust', metalness: 0.6, repeat: 1 },
  chrome: { color: 0xb8bcc0, roughness: 0.25, metalness: 1.0 },
  steelDark: { color: 0x3a3d40, roughness: 0.5, metalness: 0.8 },
  blackPlastic: { color: 0x1a1a1b, roughness: 0.55 },
  greyPlastic: { color: 0x6d6a64, roughness: 0.6 },
  beigePlastic: { color: 0xb5ac94, roughness: 0.55 },
  fabricRed: { tex: 'fabricRed', roughness: 0.95, repeat: 1 },
  fabricGreen: { tex: 'fabricGreen', roughness: 0.95, repeat: 1 },
  fabricBeige: { tex: 'fabricBeige', roughness: 0.95, repeat: 1 },
  fabricWhite: { tex: 'fabricWhite', roughness: 0.95, repeat: 1 },
  sheet: { color: 0xc2bdb0, tex: 'fabricWhite', roughness: 1.0, repeat: 2, side: THREE.DoubleSide },
  leather: { color: 0x3a2a20, roughness: 0.45 },
  porcelain: { color: 0xd8d6cf, roughness: 0.15 },
  paper: { color: 0xd6d0bd, roughness: 0.9 },
  cardboard: { color: 0x8a6c47, tex: 'grime', roughness: 0.9, repeat: 1 },
  concrete: { tex: 'concrete', roughness: 0.9, repeat: 1 },
  rubber: { color: 0x151515, roughness: 0.9 },
  brass: { color: 0x9b7c3c, roughness: 0.35, metalness: 1.0 },
  pianoBlack: { color: 0x0d0b0a, roughness: 0.2, metalness: 0.1 },
  ivory: { color: 0xd7cfb8, roughness: 0.3 },
  bark: { color: 0x2b2119, tex: 'grime', roughness: 1.0, repeat: 1 },
  pine: { color: 0x1d2a1f, roughness: 0.95 },
  carPaint: { color: 0x2a3540, roughness: 0.25, metalness: 0.6 },
  tyre: { color: 0x111111, roughness: 0.85 },
  glassDark: { color: 0x0b0d10, roughness: 0.05, metalness: 0.5 },
  glass: { color: 0x9fb2b8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false },
  glassFrost: { color: 0xc8d0d0, roughness: 0.6, transparent: true, opacity: 0.55, depthWrite: false },
  screenOff: { color: 0x101412, roughness: 0.2, metalness: 0.1 },
  foam: { color: 0xb8b8c0, tex: 'foam', roughness: 1.0, repeat: 1, normalScale: 1.2 },
  skin: { tex: 'skin', roughness: 0.38, repeat: 3, color: 0x8f877c, normalScale: 1.4 },
  skinDark: { color: 0x3a1f1d, roughness: 0.15, metalness: 0.1 },
  paintWhite: { color: 0xc9c4b6, roughness: 0.7 },
  paintRed: { color: 0x8a1f17, roughness: 0.5 },
  bulb: { basic: true, color: 0xfff1d6 },
  emissiveWarm: { basic: true, color: 0xffd9a0 },
  emissiveCold: { basic: true, color: 0xe6f0ff },
  emissiveRed: { basic: true, color: 0xff2a1a },
  emissiveGreen: { basic: true, color: 0x39ff6a },
  emissiveAmber: { basic: true, color: 0xffa020 },
  water: { color: 0x0a0f0e, roughness: 0.04, metalness: 0.3, transparent: true, opacity: 0.86 },
  chalk: { basic: true, color: 0xd8d8d0, transparent: true, opacity: 0.9, depthWrite: false },
  stain: { basic: true, color: 0x1a0505, transparent: true, opacity: 0.65, depthWrite: false },
  black: { color: 0x050505, roughness: 1 },
  chainLink: { color: 0x7f8585, roughness: 0.5, metalness: 0.8, side: THREE.DoubleSide },
};
