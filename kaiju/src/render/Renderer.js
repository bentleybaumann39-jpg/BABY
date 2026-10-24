// WebGL2 renderer and the HDR post chain:
// scene -> (GTAO) -> bloom -> grade (contrast, saturation, split-tone, CA, haze, vignette,
// grain, damage pulse, letterbox) -> tone map + sRGB -> SMAA.
import * as THREE from 'three';
import { EffectComposer } from '../../vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/addons/postprocessing/RenderPass.js';
import { ShaderPass } from '../../vendor/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from '../../vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/addons/postprocessing/OutputPass.js';
import { GTAOPass } from '../../vendor/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from '../../vendor/addons/postprocessing/SMAAPass.js';

export const QUALITY = {
  low: { scale: 0.7, shadow: 1024, cascades: 2, gtao: false, bloom: true, smaa: false, particles: 0.5, maxPixelRatio: 1 },
  medium: { scale: 0.85, shadow: 2048, cascades: 3, gtao: false, bloom: true, smaa: true, particles: 0.75, maxPixelRatio: 1.25 },
  high: { scale: 1.0, shadow: 2048, cascades: 3, gtao: true, bloom: true, smaa: true, particles: 1.0, maxPixelRatio: 1.5 },
  ultra: { scale: 1.0, shadow: 4096, cascades: 4, gtao: true, bloom: true, smaa: true, particles: 1.25, maxPixelRatio: 2 },
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uSat: { value: 1.05 }, uContrast: { value: 1.06 }, uShadowTint: { value: new THREE.Color(0.96, 1.0, 1.06) },
    uHighTint: { value: new THREE.Color(1.04, 1.0, 0.95) }, uVignette: { value: 0.32 }, uGrain: { value: 0.035 },
    uCA: { value: 0.0012 }, uHurt: { value: 0 }, uLetter: { value: 0 }, uHaze: { value: 0 }, uHazeCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uFlash: { value: 0 }, uFade: { value: 0 },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uSat, uContrast, uVignette, uGrain, uCA, uHurt, uLetter, uHaze, uFlash, uFade;
    uniform vec2 uRes, uHazeCenter; uniform vec3 uShadowTint, uHighTint;
    varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      // heat haze around the breath weapon / fires
      if (uHaze > 0.0) {
        vec2 d = uv - uHazeCenter;
        float m = uHaze * exp(-dot(d, d) * 18.0);
        uv += m * 0.004 * vec2(sin(uv.y * 160.0 + uTime * 9.0), cos(uv.x * 140.0 - uTime * 7.0));
      }
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);
      vec3 col;
      float ca = uCA * (1.0 + 6.0 * uHurt);
      col.r = texture2D(tDiffuse, uv - c * ca * r2 * 4.0).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv + c * ca * r2 * 4.0).b;
      float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(L), col, uSat);
      // contrast around a mid-grey in log space keeps HDR highlights intact
      vec3 lc = log2(max(col, vec3(1e-5)));
      lc = (lc - log2(0.18)) * uContrast + log2(0.18);
      col = exp2(lc);
      float t = smoothstep(0.02, 0.6, L);
      col *= mix(uShadowTint, uHighTint, t);
      col += uFlash * vec3(1.0, 0.95, 0.85);
      float vig = 1.0 - uVignette * smoothstep(0.15, 0.85, sqrt(r2) * 1.25);
      col *= vig;
      col = mix(col, col * vec3(1.6, 0.35, 0.3), uHurt * smoothstep(0.1, 0.7, sqrt(r2)));
      float g = h(uv * uRes + fract(uTime * 37.0) * 100.0) - 0.5;
      col *= 1.0 + g * uGrain * 2.0;
      col *= 1.0 - uFade;
      if (abs(uv.y - 0.5) > 0.5 - uLetter) col = vec3(0.0);
      gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
    }`,
};

export class Renderer {
  constructor(canvas, qualityName = 'high') {
    this.canvas = canvas;
    const gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl = gl;
    this.size = new THREE.Vector2(1, 1);
    this.setQuality(qualityName, false);
  }

  setQuality(name, rebuild = true) {
    this.qualityName = QUALITY[name] ? name : 'high';
    this.q = QUALITY[this.qualityName];
    if (rebuild && this.scene) this.setup(this.scene, this.camera);
  }

  setup(scene, camera) {
    this.scene = scene; this.camera = camera;
    const gl = this.gl;
    if (this.composer) this.composer.dispose();
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: true });
    const composer = new EffectComposer(gl, rt);
    this.renderPass = new RenderPass(scene, camera);
    composer.addPass(this.renderPass);
    this.gtao = null;
    if (this.q.gtao) {
      this.gtao = new GTAOPass(scene, camera, 2, 2);
      this.gtao.output = GTAOPass.OUTPUT.Default;
      this.gtao.blendIntensity = 0.85;
      this.gtao.updateGtaoMaterial({ radius: 6.0, distanceExponent: 1.4, thickness: 6.0, scale: 1.0, samples: 12 });
      this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      composer.addPass(this.gtao);
    }
    this.bloom = null;
    if (this.q.bloom && !this.noBloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.65, 1.15);
      composer.addPass(this.bloom);
    }
    this.grade = new ShaderPass(GradeShader);
    composer.addPass(this.grade);
    composer.addPass(new OutputPass());
    this.smaa = null;
    if (this.q.smaa) {
      this.smaa = new SMAAPass();
      composer.addPass(this.smaa);
    }
    this.composer = composer;
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.q.maxPixelRatio) * this.q.scale * (this.dynScale || 1);
    this.gl.setPixelRatio(pr);
    this.gl.setSize(w, h, false);
    this.size.set(Math.floor(w * pr), Math.floor(h * pr));
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, h);
      this.grade.uniforms.uRes.value.copy(this.size);
    }
  }

  render(dt) {
    if (!this.composer) return;
    this.grade.uniforms.uTime.value += dt;
    // bloom runs on the HDR buffer before exposure: keep its threshold in display units
    if (this.bloom) this.bloom.threshold = 1.35 / Math.max(0.05, this.gl.toneMappingExposure);
    this.composer.render(dt);
  }
}
