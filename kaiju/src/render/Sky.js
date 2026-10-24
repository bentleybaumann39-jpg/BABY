// Physically based sky. A single-scattering atmosphere (Rayleigh + Mie, ozone tint),
// a procedural cloud deck, sun disk, stars and moon are rendered once into a cube map
// whenever the time of day changes. That cube is the visible background, the source of
// image-based lighting (PMREM) and the colour of aerial-perspective fog.
import * as THREE from 'three';

const ATMOS = /* glsl */`
#define PI 3.14159265
#define R_PLANET 6371e3
#define R_ATMOS 6471e3
const vec3 K_RLH = vec3(5.8e-6, 13.5e-6, 33.1e-6);
const float K_MIE = 21e-6;
const vec3 K_OZONE = vec3(0.65e-6, 1.881e-6, 0.085e-6);
vec2 rsi(vec3 r0, vec3 rd, float sr) {
  float a = dot(rd, rd), b = 2.0 * dot(rd, r0), c = dot(r0, r0) - sr * sr;
  float d = b * b - 4.0 * a * c;
  if (d < 0.0) return vec2(1e5, -1e5);
  return vec2((-b - sqrt(d)) / (2.0 * a), (-b + sqrt(d)) / (2.0 * a));
}
vec3 atmosphere(vec3 r, vec3 r0, vec3 pSun, float iSun, float haze) {
  float kMie = K_MIE * haze;
  vec2 p = rsi(r0, r, R_ATMOS);
  if (p.x > p.y) return vec3(0.0);
  p.y = min(p.y, rsi(r0, r, R_PLANET).x);
  float iStep = (p.y - p.x) / 16.0;
  float iTime = 0.0;
  vec3 totalRlh = vec3(0.0), totalMie = vec3(0.0);
  float iOdRlh = 0.0, iOdMie = 0.0;
  float mu = dot(r, pSun), mumu = mu * mu, g = 0.76, gg = g * g;
  float pRlh = 3.0 / (16.0 * PI) * (1.0 + mumu);
  float pMie = 3.0 / (8.0 * PI) * ((1.0 - gg) * (mumu + 1.0)) / (pow(1.0 + gg - 2.0 * mu * g, 1.5) * (2.0 + gg));
  for (int i = 0; i < 16; i++) {
    vec3 iPos = r0 + r * (iTime + iStep * 0.5);
    float iH = length(iPos) - R_PLANET;
    float odR = exp(-iH / 8e3) * iStep, odM = exp(-iH / 1.2e3) * iStep;
    iOdRlh += odR; iOdMie += odM;
    float jStep = rsi(iPos, pSun, R_ATMOS).y / 8.0;
    float jTime = 0.0, jOdR = 0.0, jOdM = 0.0;
    for (int j = 0; j < 8; j++) {
      vec3 jPos = iPos + pSun * (jTime + jStep * 0.5);
      float jH = length(jPos) - R_PLANET;
      jOdR += exp(-jH / 8e3) * jStep; jOdM += exp(-jH / 1.2e3) * jStep;
      jTime += jStep;
    }
    vec3 attn = exp(-(kMie * (iOdMie + jOdM) + (K_RLH + K_OZONE * 0.6) * (iOdRlh + jOdR)));
    totalRlh += odR * attn; totalMie += odM * attn;
    iTime += iStep;
  }
  return iSun * (pRlh * K_RLH * totalRlh + pMie * kMie * totalMie);
}
`;

const NOISE = /* glsl */`
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

export const SKY_FRAG = /* glsl */`
uniform vec3 uSun; uniform vec3 uMoon; uniform float uSunI; uniform float uHaze;
uniform float uCloud; uniform float uCloudDark; uniform float uStars; uniform vec3 uGround;
varying vec3 vDir;
${ATMOS}
${NOISE}
void main() {
  vec3 d = normalize(vDir);
  vec3 r0 = vec3(0.0, R_PLANET + 120.0, 0.0);
  vec3 dd = vec3(d.x, max(d.y, 0.002), d.z);
  vec3 col = atmosphere(normalize(dd), r0, uSun, uSunI, uHaze);
  // moonlit night sky floor
  col += vec3(0.0025, 0.0035, 0.007) * (1.0 - smoothstep(-0.1, 0.25, uSun.y)) * (0.4 + 0.6 * (1.0 - d.y));
  float mu = dot(d, uSun);
  // sun disk with limb darkening
  float sd = smoothstep(0.99996, 0.999985, mu);
  vec3 tr = exp(-(K_RLH * 8e3 + K_MIE * uHaze * 1.2e3) / max(uSun.y + 0.03, 0.01) * 1.2);
  col += sd * tr * 1800.0 * step(0.0, d.y);
  // stars and moon
  if (uStars > 0.0 && d.y > 0.0) {
    vec3 sp = floor(d * 1100.0);
    float h = fract(sin(dot(sp, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float star = step(0.9992, h) * pow(fract(h * 37.0), 3.0);
    col += vec3(0.8, 0.85, 1.0) * star * uStars * 0.5 * smoothstep(0.0, 0.2, d.y);
    float md = dot(d, uMoon);
    col += vec3(0.9, 0.92, 1.0) * smoothstep(0.99985, 0.99992, md) * 3.0 * uStars;
    col += vec3(0.05, 0.06, 0.09) * pow(max(md, 0.0), 220.0) * uStars;
  }
  // cloud deck at ~2.2 km
  if (d.y > 0.0 && uCloud > 0.0) {
    vec2 uv = d.xz / (d.y + 0.06) * 2.2;
    float n = fbm(uv * 0.55 + vec2(3.0, 1.0));
    float n2 = fbm(uv * 1.7 - 5.0);
    float cov = smoothstep(1.0 - uCloud, 1.0 - uCloud + 0.32, n * 0.75 + n2 * 0.35);
    if (cov > 0.002) {
    // light from the sun side of each puff
    vec2 toSun = normalize(uSun.xz + 1e-4) * 0.08;
    float ns = fbm((uv + toSun) * 0.55 + vec2(3.0, 1.0)) * 0.75 + fbm((uv + toSun) * 1.7 - 5.0) * 0.35;
    float lit = clamp(0.55 + (n * 0.75 + n2 * 0.35 - ns) * 4.0, 0.15, 1.2);
    vec3 skyUp = atmosphere(vec3(0.0, 1.0, 0.0), r0, uSun, uSunI, uHaze);
    vec3 sunLight = tr * uSunI * 0.055 * max(uSun.y + 0.08, 0.0);
    vec3 cc = sunLight * lit * (1.0 - uCloudDark) + skyUp * 0.9 * (1.0 - 0.5 * uCloudDark);
    cc += vec3(0.002, 0.0025, 0.004) * (1.0 - smoothstep(-0.1, 0.2, uSun.y));
    // silver lining near the sun
    cc += sunLight * pow(max(mu, 0.0), 12.0) * 2.0 * (1.0 - cov);
    float fade = smoothstep(0.0, 0.12, d.y);
    col = mix(col, cc, cov * fade * 0.96);
    }
  }
  // below the horizon: dim ground bounce blended into haze
  if (d.y < 0.0) {
    vec3 hz = atmosphere(normalize(vec3(d.x, 0.002, d.z)), r0, uSun, uSunI, uHaze);
    col = mix(hz, uGround, smoothstep(0.0, -0.25, d.y));
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// CPU copy of the transmittance used to tint the directional sun light.
const K_RLH = [5.8e-6, 13.5e-6, 33.1e-6];
const K_OZ = [0.65e-6, 1.881e-6, 0.085e-6];
function rsiFar(r0y, dir, R) {
  const b = 2 * r0y * dir[1];
  const c = r0y * r0y - R * R;
  const d = b * b - 4 * c;
  return d < 0 ? 0 : (-b + Math.sqrt(d)) / 2;
}
export function sunTransmittance(sunDir, haze = 1) {
  const r0 = 6371e3 + 120;
  const L = rsiFar(r0, sunDir, 6471e3);
  let odR = 0, odM = 0;
  const n = 32, step = L / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * step;
    const x = sunDir[0] * t, y = r0 + sunDir[1] * t, z = sunDir[2] * t;
    const h = Math.sqrt(x * x + y * y + z * z) - 6371e3;
    if (h < 0) return [0, 0, 0];
    odR += Math.exp(-h / 8e3) * step;
    odM += Math.exp(-h / 1.2e3) * step;
  }
  return K_RLH.map((k, i) => Math.exp(-(21e-6 * haze * odM + (k + K_OZ[i] * 0.6) * odR)));
}

export const TIMES = {
  // elevation, azimuth (deg), haze, clouds, cloudDark, sky intensity, exposure, sun light (irradiance units
  // matching the sky radiance, so a sunlit wall is ~2.5x brighter than blue sky), night amount
  dawn: { el: 4.5, az: 75, haze: 1.6, cloud: 0.42, cdark: 0.1, sunI: 22, exposure: 0.34, light: 16, night: 0.0 },
  day: { el: 38, az: 140, haze: 1.0, cloud: 0.38, cdark: 0.05, sunI: 22, exposure: 0.17, light: 24, night: 0.0 },
  golden: { el: 9, az: 250, haze: 1.5, cloud: 0.36, cdark: 0.05, sunI: 22, exposure: 0.3, light: 19, night: 0.0 },
  dusk: { el: -2.2, az: 262, haze: 1.3, cloud: 0.42, cdark: 0.2, sunI: 22, exposure: 0.95, light: 0.0, night: 0.7 },
  night: { el: -24, az: 280, haze: 1.0, cloud: 0.3, cdark: 0.55, sunI: 22, exposure: 1.25, light: 0.0, night: 1.0 },
  storm: { el: 22, az: 200, haze: 3.5, cloud: 0.9, cdark: 0.7, sunI: 22, exposure: 0.42, light: 4.5, night: 0.3 },
};

export class SkySystem {
  constructor(renderer, size = 512) {
    this.renderer = renderer;
    this.uniforms = {
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uMoon: { value: new THREE.Vector3(0, 1, 0) },
      uSunI: { value: 22 }, uHaze: { value: 1 }, uCloud: { value: 0.4 }, uCloudDark: { value: 0.1 },
      uStars: { value: 0 }, uGround: { value: new THREE.Color(0.02, 0.02, 0.02) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false,
    });
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), mat));
    this.cubeRT = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    this.cubeCam = new THREE.CubeCamera(0.1, 100, this.cubeRT);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this.sunDir = new THREE.Vector3();
    this.sunColor = new THREE.Color();
    this.ambient = new THREE.Color();
    this.preset = null;
  }

  set(name, overrides = {}) {
    const p = { ...TIMES[name], ...overrides };
    this.preset = p;
    const el = THREE.MathUtils.degToRad(p.el), az = THREE.MathUtils.degToRad(p.az);
    this.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize();
    const u = this.uniforms;
    u.uSun.value.copy(this.sunDir);
    u.uMoon.value.set(-0.35, 0.55, 0.76).normalize();
    u.uSunI.value = p.sunI; u.uHaze.value = p.haze; u.uCloud.value = p.cloud; u.uCloudDark.value = p.cdark;
    u.uStars.value = p.night;
    u.uGround.value.setRGB(0.03, 0.028, 0.026).multiplyScalar(Math.max(0.05, Math.sin(Math.max(el, 0)) + 0.05));
    // sun light colour: transmittance through the atmosphere at this elevation
    const tr = sunTransmittance([this.sunDir.x, Math.max(this.sunDir.y, 0.01), this.sunDir.z], p.haze);
    this.sunColor.setRGB(tr[0], tr[1], tr[2]);
    const m = Math.max(tr[0], tr[1], tr[2], 1e-4);
    this.sunColor.multiplyScalar(1 / m);
    this.sunIntensity = p.light * Math.min(1, m * 1.6) * THREE.MathUtils.smoothstep(p.el, -1, 4);
    this.moonIntensity = 0.12 * p.night;
    this.ambient.setRGB(...(p.amb || [0.45, 0.52, 0.62]));
    this.render();
    return p;
  }

  render() {
    this.cubeCam.update(this.renderer, this.scene);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromCubemap(this.cubeRT.texture);
  }

  get background() { return this.cubeRT.texture; }
  get environment() { return this.envRT.texture; }
}
