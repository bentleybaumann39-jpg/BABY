// WebGL renderer, scene, sky, sun/hemisphere lighting, sky-derived environment map, fog, shadow
// following, HDR post chain and a separate first-person viewmodel overlay.
import * as THREE from 'three';
import { PostFX } from './PostFX.js';

export const SUN_DIR = new THREE.Vector3(-0.62, 0.36, 0.7).normalize();
export const FOG_COLOR = new THREE.Color(0.36, 0.355, 0.34);

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAG = /* glsl */`
uniform vec3 sunDir; uniform float time; uniform vec3 horizon; uniform vec3 zenith; uniform vec3 sunCol; uniform float ash;
varying vec3 vDir;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += n(p) * a; p *= 2.07; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float y = max(d.y, 0.0);
  vec3 col = mix(horizon, zenith, pow(y, 0.55));
  float sd = max(dot(d, sunDir), 0.0);
  col += sunCol * (pow(sd, 6.0) * 0.35 + pow(sd, 60.0) * 0.8);
  col += sunCol * smoothstep(0.9993, 0.9997, sd) * 8.0;
  // overcast cloud deck
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.08) * 1.6 + vec2(time * 0.006, time * 0.002);
    float c = fbm(uv);
    float cov = smoothstep(0.38, 0.75, c);
    vec3 cloudCol = mix(vec3(0.42, 0.41, 0.4), vec3(0.78, 0.7, 0.6), pow(sd, 3.0) * 0.8 + 0.15);
    cloudCol *= 0.85 + 0.3 * fbm(uv * 2.3 + 4.0);
    col = mix(col, cloudCol, cov * smoothstep(0.0, 0.18, d.y) * 0.85);
  }
  col = mix(col, horizon * 0.72, smoothstep(0.12, -0.02, d.y));
  col = mix(col, vec3(0.32, 0.27, 0.23), ash * 0.7);
  gl_FragColor = vec4(col, 1.0);
}`;

export class Renderer {
  constructor(canvas, settings) {
    this.settings = settings;
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.setPixelRatio(1);
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.autoClear = false;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(FOG_COLOR.clone(), 0.0026);
    this.camera = new THREE.PerspectiveCamera(85, 1, 0.06, 3200);
    this.camera.rotation.order = 'YXZ';
    this.time = 0;

    // Sky dome
    this.skyU = {
      sunDir: { value: SUN_DIR.clone() }, time: { value: 0 }, ash: { value: 0 },
      horizon: { value: new THREE.Color(0.5, 0.48, 0.44) }, zenith: { value: new THREE.Color(0.27, 0.32, 0.39) }, sunCol: { value: new THREE.Color(1.6, 1.15, 0.75) },
    };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false }));
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    // Lights
    this.sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.84, 0.66), 2.7);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(new THREE.Color(0.62, 0.66, 0.74), new THREE.Color(0.3, 0.26, 0.21), 0.95);
    this.scene.add(this.hemi);
    this.applyShadowQuality();

    // Environment from the sky (reflections on metal, wet surfaces, weapons)
    this.buildEnvironment();

    // First-person overlay
    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(54, 1, 0.01, 10);
    this.vmSun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.86, 0.7), 2.2);
    this.vmHemi = new THREE.HemisphereLight(new THREE.Color(0.6, 0.64, 0.72), new THREE.Color(0.28, 0.24, 0.2), 1.1);
    this.vmScene.add(this.vmSun, this.vmSun.target, this.vmHemi);
    this.vmScene.environment = this.scene.environment;
    this.vmScene.environmentIntensity = 0.55;

    this.post = new PostFX(r, settings);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    settings.onChange((k) => { if (k === 'quality') { this.applyShadowQuality(); this.resize(true); } if (k === 'fov') this.setFov(settings.fov); });
    this.setFov(settings.fov);
  }

  buildEnvironment() {
    const pm = new THREE.PMREMGenerator(this.r);
    const envScene = new THREE.Scene();
    const skyClone = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VERT.replace('p.xyww', 'p'), fragmentShader: SKY_FRAG, uniforms: this.skyU, side: THREE.BackSide, depthWrite: false }));
    envScene.add(skyClone);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(100, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.16, 0.15, 0.12) }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -2;
    envScene.add(ground);
    const rt = pm.fromScene(envScene, 0.02);
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = 0.5;
    pm.dispose();
  }

  applyShadowQuality() {
    const q = this.settings.q;
    const s = this.sun.shadow;
    if (s.map) { s.map.dispose(); s.map = null; }
    s.mapSize.set(q.shadowSize, q.shadowSize);
    const d = q.shadowDist;
    Object.assign(s.camera, { left: -d, right: d, top: d, bottom: -d, near: 1, far: 900 });
    s.camera.updateProjectionMatrix();
    this.shadowDist = d;
    this.scene.fog.density = 1.6 / q.view;
    this.camera.far = Math.max(1600, q.view * 2.5);
    this.camera.updateProjectionMatrix();
  }

  setFov(f) { this.baseFov = f; this.camera.fov = f; this.camera.updateProjectionMatrix(); }
  setZoom(z) { const f = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.baseFov) / 2) / z)); if (Math.abs(f - this.camera.fov) > 0.01) { this.camera.fov = f; this.camera.updateProjectionMatrix(); } }

  resize(force = false) {
    const w = window.innerWidth, h = window.innerHeight;
    this.r.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.vmCamera.aspect = w / h; this.vmCamera.updateProjectionMatrix();
    if (force) this.post.dispose(), (this.post.rt = null);
    this.post.resize(w, h);
  }

  // Keep the sun's shadow frustum centred on the player, snapped to texels to avoid shimmering.
  followShadow(x, y, z) {
    const d = this.shadowDist, texel = (2 * d) / this.sun.shadow.mapSize.x;
    const sx = Math.round(x / texel) * texel, sz = Math.round(z / texel) * texel;
    this.sun.target.position.set(sx, y, sz);
    this.sun.position.set(sx + SUN_DIR.x * 400, y + SUN_DIR.y * 400, sz + SUN_DIR.z * 400);
    this.sun.target.updateMatrixWorld();
  }

  render(dt, overlay = true) {
    this.time += dt;
    this.skyU.time.value = this.time;
    this.sky.position.copy(this.camera.position);
    this.post.u.time.value = this.time;
    // sun position on screen for the god-ray pass
    const cam = this.camera;
    const sp = this._sp || (this._sp = new THREE.Vector3());
    sp.copy(SUN_DIR).multiplyScalar(1000).add(cam.position).project(cam);
    const fwd = this._fw || (this._fw = new THREE.Vector3());
    cam.getWorldDirection(fwd);
    const facing = fwd.dot(SUN_DIR);
    this.post.sun.uv.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
    const onScreen = Math.max(0, 1 - Math.max(0, Math.abs(sp.x) - 1) * 1.5) * Math.max(0, 1 - Math.max(0, Math.abs(sp.y) - 1) * 1.5);
    this.post.sun.strength = facing > 0 ? Math.min(1, facing * 2.5) * onScreen * (1 - this.post.u.ash.value) : 0;
    this.r.setRenderTarget(null);
    this.post.render(this.scene, this.camera, overlay ? { scene: this.vmScene, camera: this.vmCamera } : null);
  }
}
