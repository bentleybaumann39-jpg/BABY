// Terrain mesh (matches the shared heightmap triangulation exactly), splat-blended PBR material,
// river water, and a far mountain ring outside the playable valley.
import * as THREE from 'three';
import { HM_N, HM_CELL, MAP_HALF, WATER_LEVEL } from '../../../shared/constants.js';
import { makeNoise, smoothstep } from '../../../shared/rng.js';

export function buildSplat(map, size = 512) {
  // R: gravel road, G: trampled dirt, B: macro variation noise, A: mud / river bank
  const data = new Uint8Array(size * size * 4);
  const N = makeNoise(map.seed ^ 0x5a5a);
  const cell = (MAP_HALF * 2) / size;
  const bb = map.buildings.filter(b => !b.prop || b.tpl === 'fortwall').map(b => b.bb);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = -MAP_HALF + (i + 0.5) * cell, z = -MAP_HALF + (j + 0.5) * cell;
    const rd = map.roadDist(x, z);
    const road = 1 - smoothstep(2.6, 4.4, rd + N.noise(x / 3, z / 3) * 0.8);
    let dirt = 0;
    for (const b of bb) {
      const dx = Math.max(b[0] - x, 0, x - b[2]), dz = Math.max(b[1] - z, 0, z - b[3]);
      const d = Math.hypot(dx, dz);
      if (d < 9) dirt = Math.max(dirt, 1 - smoothstep(2, 9, d + N.noise(x / 4, z / 4) * 3));
    }
    for (const p of map.pois) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r) dirt = Math.max(dirt, (1 - smoothstep(p.r * 0.4, p.r, d)) * (0.35 + 0.35 * N.fbm(x / 20, z / 20, 3))); }
    dirt = Math.max(dirt, smoothstep(0.25, 0.55, N.fbm(x / 60 + 7, z / 60, 4)) * 0.6);
    const riv = map.riverDist(x, z);
    const h = map.heightAt(x, z);
    const mud = Math.max(1 - smoothstep(8, 16, riv), h < WATER_LEVEL + 1.6 ? 1 - smoothstep(WATER_LEVEL + 0.6, WATER_LEVEL + 1.6, h) : 0);
    const k = (j * size + i) * 4;
    data[k] = road * 255; data[k + 1] = Math.min(1, dirt) * 255; data[k + 2] = (N.fbm(x / 140, z / 140, 4) * 0.5 + 0.5) * 255; data[k + 3] = mud * 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export function buildTerrain(map, tex) {
  const n = HM_N;
  const pos = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = (j * n + i) * 3;
    pos[k] = -MAP_HALF + i * HM_CELL; pos[k + 1] = map.heights[j * n + i]; pos[k + 2] = -MAP_HALF + j * HM_CELL;
  }
  const idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let p = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    // (00,01,10) and (10,01,11) — same split as sampleHeight; wound counter-clockwise from above
    idx[p++] = a; idx[p++] = c; idx[p++] = b;
    idx[p++] = b; idx[p++] = c; idx[p++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const splat = buildSplat(map);
  const mat = terrainMaterial(tex, splat);
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

function terrainMaterial(tex, splat) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  const u = {
    tSplat: { value: splat },
    tGrass: { value: tex.grass.map }, nGrass: { value: tex.grass.normalMap },
    tDirt: { value: tex.dirt.map }, nDirt: { value: tex.dirt.normalMap },
    tRock: { value: tex.rock.map }, nRock: { value: tex.rock.normalMap },
    tGravel: { value: tex.gravel.map }, nGravel: { value: tex.gravel.normalMap },
    tMud: { value: tex.mud.map }, nMud: { value: tex.mud.normalMap },
    mapHalf: { value: MAP_HALF }, waterLevel: { value: WATER_LEVEL },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNorm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNorm = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWPos; varying vec3 vWNorm;
uniform sampler2D tSplat, tGrass, nGrass, tDirt, nDirt, tRock, nRock, tGravel, nGravel, tMud, nMud;
uniform float mapHalf, waterLevel;
vec4 wts; float wRock;
vec3 triRock(sampler2D t, vec3 p, vec3 n, float s) {
  vec3 b = pow(abs(n), vec3(4.0)); b /= (b.x + b.y + b.z);
  return texture2D(t, p.zy / s).rgb * b.x + texture2D(t, p.xz / s).rgb * b.y + texture2D(t, p.xy / s).rgb * b.z;
}`)
      .replace('#include <map_fragment>', `
vec2 suv = (vWPos.xz + mapHalf) / (2.0 * mapHalf);
vec4 sp = texture2D(tSplat, suv);
vec3 wn = normalize(vWNorm);
float macro = sp.b;
wRock = smoothstep(0.86, 0.66, wn.y + (macro - 0.5) * 0.08);
float wMud = sp.a;
float wGravel = sp.r;
float wDirt = clamp(sp.g + smoothstep(0.62, 0.8, macro) * 0.35, 0.0, 1.0);
vec2 uv = vWPos.xz;
vec3 cGrass = mix(texture2D(tGrass, uv / 5.0).rgb, texture2D(tGrass, uv / 17.0).rgb, 0.35);
cGrass *= mix(0.82, 1.12, macro);
vec3 cDirt = texture2D(tDirt, uv / 4.0).rgb * mix(0.9, 1.08, macro);
vec3 cGravel = texture2D(tGravel, uv / 3.5).rgb;
vec3 cMud = texture2D(tMud, uv / 4.0).rgb;
vec3 cRock = triRock(tRock, vWPos, wn, 8.0);
vec3 col = cGrass;
col = mix(col, cDirt, wDirt);
col = mix(col, cMud, wMud);
col = mix(col, cGravel, wGravel);
col = mix(col, cRock, wRock);
float wet = smoothstep(waterLevel + 0.6, waterLevel - 0.2, vWPos.y);
col *= mix(1.0, 0.55, wet);
wts = vec4(wDirt, wMud, wGravel, wet);
diffuseColor.rgb *= col;`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix(roughness, 0.35, wts.w);`)
      .replace('#include <normal_fragment_maps>', `{
  vec2 uv2 = vWPos.xz;
  vec3 nG = texture2D(nGrass, uv2 / 5.0).xyz * 2.0 - 1.0;
  vec3 nD = texture2D(nDirt, uv2 / 4.0).xyz * 2.0 - 1.0;
  vec3 nV = texture2D(nGravel, uv2 / 3.5).xyz * 2.0 - 1.0;
  vec3 nM = texture2D(nMud, uv2 / 4.0).xyz * 2.0 - 1.0;
  vec3 nR = texture2D(nRock, vWPos.xz / 8.0).xyz * 2.0 - 1.0;
  vec3 mn = nG;
  mn = mix(mn, nD, wts.x); mn = mix(mn, nM, wts.y); mn = mix(mn, nV, wts.z); mn = mix(mn, nR, wRock);
  mn.xy *= 1.0 - wts.w * 0.7;
  vec3 wn2 = normalize(vWNorm);
  vec3 T = normalize(cross(vec3(0.0, 0.0, 1.0), wn2));
  vec3 B = cross(wn2, T);
  vec3 pn = normalize(T * mn.x + B * -mn.y + wn2 * max(mn.z, 0.2));
  normal = normalize((viewMatrix * vec4(pn, 0.0)).xyz);
}`);
  };
  mat.customProgramCacheKey = () => 'ashline-terrain';
  return mat;
}

// Water: one plane at the river level. Terrain occludes it everywhere except the channel.
export function buildWater(tex) {
  const g = new THREE.PlaneGeometry(MAP_HALF * 2 + 400, MAP_HALF * 2 + 400, 1, 1);
  g.rotateX(-Math.PI / 2);
  const nm = tex.mud.normalMap.clone();
  nm.needsUpdate = true;
  nm.wrapS = nm.wrapT = THREE.RepeatWrapping;
  nm.repeat.set(160, 160);
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.05, 0.07, 0.055), roughness: 0.06, metalness: 0.0, normalMap: nm, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.86, envMapIntensity: 1.6 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.y = WATER_LEVEL;
  mesh.receiveShadow = true;
  mesh.userData.update = (t) => { nm.offset.set(t * 0.004, t * 0.0025); };
  return mesh;
}

// Low-res mountain ring around the valley, fading into fog.
export function buildFarTerrain(map) {
  const R = 2800, n = 110;
  const g = new THREE.PlaneGeometry(R * 2, R * 2, n, n);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const N = makeNoise(map.seed ^ 0x777);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const e = Math.max(Math.abs(x), Math.abs(z));
    let h;
    if (e < MAP_HALF - 8) h = map.heightAt(x, z) - 40;
    else {
      const t = Math.min(1, (e - MAP_HALF) / 900);
      h = map.farHeight(Math.max(-MAP_HALF, Math.min(MAP_HALF, x)), Math.max(-MAP_HALF, Math.min(MAP_HALF, z))) * (1 - t) + (90 + N.ridged(x / 700, z / 700, 4) * 260 + N.fbm(x / 200, z / 200, 3) * 40) * t;
      if (e < MAP_HALF + 60) h = Math.min(h, map.heightAt(Math.max(-MAP_HALF, Math.min(MAP_HALF, x)), Math.max(-MAP_HALF, Math.min(MAP_HALF, z))) - 0.5 + (e - MAP_HALF) * 0.5);
    }
    pos.setY(i, h);
    const rock = Math.min(1, Math.max(0, (h - 90) / 160));
    const snow = Math.max(0, (h - 270) / 60);
    const c = [0.17 + rock * 0.12, 0.19 + rock * 0.08, 0.12 + rock * 0.1];
    col[i * 3] = c[0] + snow * 0.4; col[i * 3 + 1] = c[1] + snow * 0.42; col[i * 3 + 2] = c[2] + snow * 0.45;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  m.receiveShadow = false;
  return m;
}
