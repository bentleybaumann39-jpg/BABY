// Streets, sidewalks, lawns and plazas drawn analytically in one ground shader.
// Two 1D lookup textures give, for any x (or z), the nearest north-south (or east-west)
// road centre and half width plus the block column (row) index; a small 2D texture
// gives the block kind. Lane lines, crosswalks, tyre wear, patches, paving joints and
// grass are all computed per pixel, so they stay crisp at any distance without tiling.
import * as THREE from 'three';
import { patch, NOISE_GLSL } from '../render/Shading.js';

const KIND = { downtown: 0, midtown: 1, residential: 2, port: 3, park: 4, plaza: 5 };

function roadLUT(roads, a, b) {
  const n = Math.ceil(b - a) + 1;
  const data = new Float32Array(n * 4);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const p = a + i + 0.5;
    while (j < roads.length - 1 && Math.abs(roads[j + 1].c - p) < Math.abs(roads[j].c - p)) j++;
    const r = roads[j];
    // block index: road to the west/north of this position
    let k = 0;
    while (k < roads.length - 1 && roads[k + 1].c < p) k++;
    data.set([r.c, r.w / 2, r.avenue ? 1 : 0, k], i * 4);
  }
  const t = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return { tex: t, a, n };
}

export function createGround(city) {
  const margin = 700;
  const ax = city.x0 - margin, bx = city.x1 + margin, az = city.z0 - margin, bz = city.coast + 10;
  const lx = roadLUT(city.xRoads, ax, bx), lz = roadLUT(city.zRoads, az, bz);
  const cols = city.xRoads.length, rows = city.zRoads.length;
  const kd = new Uint8Array(cols * rows * 4).fill(255);
  for (const b of city.blocks) {
    const i = (b.j * cols + b.i) * 4;
    kd[i] = KIND[b.kind] ?? 1;
  }
  const kt = new THREE.DataTexture(kd, cols, rows, THREE.RGBAFormat);
  kt.minFilter = kt.magFilter = THREE.NearestFilter;
  kt.needsUpdate = true;

  const uniforms = {
    uLX: { value: lx.tex }, uLZ: { value: lz.tex }, uLXa: { value: new THREE.Vector2(lx.a, lx.n) }, uLZa: { value: new THREE.Vector2(lz.a, lz.n) },
    uKind: { value: kt }, uGrid: { value: new THREE.Vector2(cols, rows) }, uCoast: { value: city.coast },
    uCity: { value: new THREE.Vector4(city.x0, city.x1, city.z0, city.coast) },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  patch(mat, 'ground', (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;\n' + NOISE_GLSL + GROUND_PARS)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + GROUND_MAIN);
  });
  const size = new THREE.Vector2(bx - ax, bz - az);
  const geo = new THREE.PlaneGeometry(size.x, size.y, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((ax + bx) / 2, 0, (az + bz) / 2);
  mesh.receiveShadow = true;
  mesh.userData.uniforms = uniforms;
  return mesh;
}

const GROUND_PARS = /* glsl */`
uniform sampler2D uLX, uLZ, uKind; uniform vec2 uLXa, uLZa, uGrid; uniform float uCoast; uniform vec4 uCity;
float gBand(float x, float a, float b, float w) { return smoothstep(a - w, a + w, x) - smoothstep(b - w, b + w, x); }
float gLine(float x, float c, float hw, float w) { return gBand(x, c - hw, c + hw, w); }
`;

const GROUND_MAIN = /* glsl */`
{
  vec2 P = vGW.xz;
  vec4 rx = texture2D(uLX, vec2((floor(P.x - uLXa.x) + 0.5) / uLXa.y, 0.5));
  vec4 rz = texture2D(uLZ, vec2((floor(P.y - uLZa.x) + 0.5) / uLZa.y, 0.5));
  float dx = P.x - rx.x, dz = P.y - rz.x;
  float hx = rx.y, hz = rz.y;
  float wpx = max(fwidth(P.x) * 0.8, 1e-3), wpz = max(fwidth(P.y) * 0.8, 1e-3);
  bool onX = abs(dx) < hx;     // a north-south road (constant x)
  bool onZ = abs(dz) < hz;     // an east-west road
  bool inCity = P.x > uCity.x - 30.0 && P.x < uCity.y + 30.0 && P.y > uCity.z - 30.0;
  float n = kjF2(P * 0.08), nf = kjN2(P * 1.3), nb = kjF2(P * 0.012);
  vec3 col; float rough = 0.92; vec2 tn = vec2(0.0);
  vec3 asphalt = vec3(0.105, 0.104, 0.106) * (0.8 + 0.35 * n) * (0.92 + 0.12 * nf);
  if (!inCity) {
    // countryside beyond the grid: fields, scrub and dirt tracks
    col = mix(vec3(0.16, 0.17, 0.09), vec3(0.24, 0.21, 0.13), smoothstep(0.35, 0.7, kjF2(P * 0.004)));
    col *= 0.8 + 0.3 * n;
    rough = 0.95;
  } else if (onX || onZ) {
    col = asphalt;
    // repair patches and cracks
    float patchN = kjN2(floor(P / vec2(7.0, 4.0)) * 0.73);
    col *= mix(1.0, 0.8 + 0.4 * fract(patchN * 13.0), step(0.86, patchN));
    float crack = smoothstep(0.012, 0.0, abs(kjF2(P * 0.35) - 0.5)) * 0.5;
    col *= 1.0 - crack * (1.0 - smoothstep(0.05, 0.3, wpx));
    float paint = 0.0; vec3 paintC = vec3(0.85);
    if (onX && !onZ) {
      // lane markings along z
      float ax = abs(dx);
      float lanes = floor(hx / 3.6);
      float yellow = rx.z > 0.5 ? (gLine(ax, 0.22, 0.09, wpx)) : 0.0;
      float dash = step(0.5, fract(P.y / 9.0));
      float div = 0.0;
      for (float i = 1.0; i < 5.0; i++) { if (i >= lanes) break; div += gLine(ax, i * 3.6, 0.08, wpx) * dash; }
      if (rx.z < 0.5) div += gLine(dx, 0.0, 0.08, wpx) * dash;
      float edge = gLine(ax, hx - 0.6, 0.1, wpx);
      float wear = 1.0 - 0.6 * smoothstep(0.4, 0.8, kjN2(P * 0.5));
      paint = max(max(div, edge), yellow) * wear;
      paintC = yellow > 0.5 ? vec3(0.75, 0.55, 0.12) : vec3(0.82);
      // crosswalk just outside the intersection
      float dzE = abs(dz) - hz;
      float cw = step(1.0, dzE) * step(dzE, 5.5) * step(0.5, fract(dx / 1.4)) * step(ax, hx - 0.8);
      float stop = gLine(dzE, 6.3, 0.25, wpz) * step(0.0, dx * sign(dz) * -1.0) * step(ax, hx - 0.8);
      paint = max(paint, max(cw, stop) * wear);
      // tyre wear in the middle of each lane
      col *= 1.0 - 0.12 * gLine(fract(ax / 3.6), 0.5, 0.18, 0.05);
    } else if (onZ && !onX) {
      float az = abs(dz);
      float lanes = floor(hz / 3.6);
      float yellow = rz.z > 0.5 ? gLine(az, 0.22, 0.09, wpz) : 0.0;
      float dash = step(0.5, fract(P.x / 9.0));
      float div = 0.0;
      for (float i = 1.0; i < 5.0; i++) { if (i >= lanes) break; div += gLine(az, i * 3.6, 0.08, wpz) * dash; }
      if (rz.z < 0.5) div += gLine(dz, 0.0, 0.08, wpz) * dash;
      float edge = gLine(az, hz - 0.6, 0.1, wpz);
      float wear = 1.0 - 0.6 * smoothstep(0.4, 0.8, kjN2(P * 0.5));
      paint = max(max(div, edge), yellow) * wear;
      paintC = yellow > 0.5 ? vec3(0.75, 0.55, 0.12) : vec3(0.82);
      float dxE = abs(dx) - hx;
      float cw = step(1.0, dxE) * step(dxE, 5.5) * step(0.5, fract(dz / 1.4)) * step(az, hz - 0.8);
      float stop = gLine(dxE, 6.3, 0.25, wpx) * step(0.0, dz * sign(dx)) * step(az, hz - 0.8);
      paint = max(paint, max(cw, stop) * wear);
      col *= 1.0 - 0.12 * gLine(fract(az / 3.6), 0.5, 0.18, 0.05);
    } else {
      // intersection: a manhole and darker oil stain in the middle
      col *= 0.9 + 0.1 * smoothstep(0.0, 6.0, length(vec2(dx, dz)));
      col = mix(col, vec3(0.05), gLine(length(vec2(dx - 3.0, dz + 2.0)), 0.0, 0.4, wpx));
    }
    col = mix(col, paintC, clamp(paint, 0.0, 1.0) * 0.9);
    rough = mix(0.88, 0.65, paint);
  } else {
    float ex = abs(dx) - hx, ez = abs(dz) - hz;
    float edgeD = min(ex, ez);
    vec2 bi = vec2(rx.w, rz.w);
    float kind = texture2D(uKind, (bi + 0.5) / uGrid).r * 255.0;
    vec3 side = vec3(0.42, 0.41, 0.39) * (0.85 + 0.2 * n) * (0.9 + 0.12 * nf);
    if (edgeD < 5.0 && kind < 254.0) {
      // sidewalk: slab joints, kerb and the odd tree pit
      vec2 sj = fract(P / 1.6);
      float joint = max(gBand(sj.x, 0.0, 0.03, wpx / 1.6), gBand(sj.y, 0.0, 0.03, wpz / 1.6));
      col = side * (1.0 - 0.25 * joint * (1.0 - smoothstep(0.02, 0.08, wpx)));
      float kerb = 1.0 - smoothstep(0.0, 0.35, edgeD);
      col = mix(col, vec3(0.55, 0.54, 0.51), kerb);
      tn.y += (edgeD < 0.3 ? 0.6 : 0.0);
      rough = 0.85;
    } else if (kind > 3.5 && kind < 4.5) {
      // park lawn with paths
      float g = kjF2(P * 0.05);
      col = mix(vec3(0.07, 0.11, 0.035), vec3(0.13, 0.15, 0.05), g) * (0.85 + 0.3 * nf);
      float path = gLine(abs(fract((P.x + P.y) / 140.0) - 0.5) * 140.0, 0.0, 1.6, wpx) + gLine(abs(fract((P.x - P.y) / 180.0) - 0.5) * 180.0, 0.0, 1.6, wpx);
      col = mix(col, vec3(0.35, 0.31, 0.25), clamp(path, 0.0, 1.0));
      rough = 0.97;
    } else if (kind > 4.5 && kind < 5.5) {
      vec2 pv = fract(P / 2.4);
      float j = max(gBand(pv.x, 0.0, 0.025, wpx / 2.4), gBand(pv.y, 0.0, 0.025, wpz / 2.4));
      col = vec3(0.5, 0.46, 0.4) * (0.85 + 0.25 * kjH12(floor(P / 2.4))) * (1.0 - 0.3 * j);
      rough = 0.8;
    } else if (kind > 1.5 && kind < 2.5) {
      // residential lots: lawns, driveways
      float g = kjF2(P * 0.07);
      col = mix(vec3(0.08, 0.12, 0.04), vec3(0.15, 0.16, 0.07), g) * (0.85 + 0.3 * nf);
      rough = 0.96;
    } else if (kind > 2.5 && kind < 3.5) {
      col = asphalt * 1.25;
      float grid = max(gLine(fract(P.x / 13.2) * 13.2, 0.3, 0.1, wpx), gLine(fract(P.y / 15.0) * 15.0, 0.3, 0.1, wpz));
      col = mix(col, vec3(0.7, 0.55, 0.15), grid * 0.7);
    } else {
      // courtyards and service lots
      col = mix(side * 0.8, asphalt * 1.4, step(0.5, kjN2(bi * 3.1)));
    }
  }
  // large-scale albedo variation, wet streets in storms
  col *= 0.88 + 0.24 * nb;
  float puddle = smoothstep(0.55, 0.7, kjF2(P * 0.03)) * uWet;
  col *= 1.0 - 0.45 * uWet;
  diffuseColor.rgb = col;
  roughnessFactor = mix(rough, 0.05, puddle) * mix(1.0, 0.55, uWet);
  normal = normalize(normal + vec3(tn.x, 0.0, tn.y) * 0.0);
}
`;
