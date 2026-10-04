// HDR scene target -> optional cheap bloom -> final grade pass (ACES, grain, vignette, chroma, fear).
import * as THREE from 'three';

const FS_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;

const BRIGHT_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform float threshold; varying vec2 vUv;
void main() {
  vec3 c = texture2D( tSrc, vUv ).rgb;
  float l = max( c.r, max( c.g, c.b ) );
  gl_FragColor = vec4( c * smoothstep( threshold, threshold * 2.5, l ), 1.0 );
}`;

const BLUR_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
void main() {
  vec3 s = texture2D( tSrc, vUv ).rgb * 0.227027;
  s += texture2D( tSrc, vUv + dir * 1.3846 ).rgb * 0.3162162;
  s += texture2D( tSrc, vUv - dir * 1.3846 ).rgb * 0.3162162;
  s += texture2D( tSrc, vUv + dir * 3.2307 ).rgb * 0.0702702;
  s += texture2D( tSrc, vUv - dir * 3.2307 ).rgb * 0.0702702;
  gl_FragColor = vec4( s, 1.0 );
}`;

const FINAL_FRAG = /* glsl */`
uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tOverlay;
uniform vec2 res; uniform float time; uniform float exposure; uniform float grain; uniform float vignette;
uniform float chroma; uniform float sat; uniform float bloomStr; uniform float fade; uniform vec3 fadeColor;
uniform float brightness; uniform float distort; uniform vec3 tint; uniform float pulse; uniform float useBloom;
uniform float overlayOn; uniform float shake; uniform float redden; uniform float scan;
varying vec2 vUv;

vec3 aces( vec3 x ) { const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp( ( x * ( a * x + b ) ) / ( x * ( c * x + d ) + e ), 0.0, 1.0 ); }
float hash( vec2 p ) { p = fract( p * vec2( 443.897, 441.423 ) ); p += dot( p, p.yx + 19.19 ); return fract( ( p.x + p.y ) * p.x ); }
vec3 toSRGB( vec3 c ) { return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) ); }

void main() {
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float r2 = dot( c, c );
  uv = 0.5 + c * ( 1.0 - distort * r2 * ( 1.0 + 0.3 * sin( time * 3.0 ) * pulse ) );
  uv += vec2( sin( time * 37.0 ), cos( time * 29.0 ) ) * shake * 0.002;
  float ca = chroma * ( 0.25 + r2 * 3.0 );
  vec2 off = c * ca * 0.012;
  vec3 col;
  col.r = texture2D( tScene, uv + off ).r;
  col.g = texture2D( tScene, uv ).g;
  col.b = texture2D( tScene, uv - off ).b;
  if ( useBloom > 0.5 ) col += texture2D( tBloom, uv ).rgb * bloomStr;
  col *= exposure;
  col = aces( col );
  float l = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
  col = mix( vec3( l ), col, sat );
  col *= tint;
  col = mix( col, col * vec3( 1.25, 0.6, 0.55 ), redden );
  float vig = smoothstep( 0.95, 0.15, length( c * vec2( 1.0, 0.9 ) ) * ( 1.0 + vignette ) );
  col *= mix( 1.0, vig, 0.9 );
  // pulse: subtle darkening heartbeat at edges
  col *= 1.0 - pulse * 0.25 * smoothstep( 0.1, 0.6, length( c ) );
  float n = hash( vUv * res + fract( time * 7.13 ) * 113.0 ) - 0.5;
  col += n * grain * ( 0.5 + 0.8 * ( 1.0 - l ) );
  if ( scan > 0.0 ) col *= 1.0 - scan * 0.18 * ( 0.5 + 0.5 * sin( vUv.y * res.y * 1.4 + time * 20.0 ) );
  col = max( col, 0.0 );
  col = pow( col, vec3( 1.0 / brightness ) );
  col = mix( col, fadeColor, clamp( fade, 0.0, 1.0 ) );
  gl_FragColor = vec4( toSRGB( clamp( col, 0.0, 1.0 ) ), 1.0 );
}`;

export class PostFX {
  constructor(renderer, settings) {
    this.renderer = renderer;
    this.settings = settings;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(tri, null);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);

    this.brightMat = new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: BRIGHT_FRAG, uniforms: { tSrc: { value: null }, threshold: { value: 1.2 } }, depthTest: false, depthWrite: false });
    this.blurMat = new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: BLUR_FRAG, uniforms: { tSrc: { value: null }, dir: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
    this.finalMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT, fragmentShader: FINAL_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: null }, tBloom: { value: null }, tOverlay: { value: null },
        res: { value: new THREE.Vector2(1, 1) }, time: { value: 0 }, exposure: { value: 0.9 }, grain: { value: 0.06 },
        vignette: { value: 0.25 }, chroma: { value: 0.3 }, sat: { value: 0.82 }, bloomStr: { value: 0.6 },
        fade: { value: 0 }, fadeColor: { value: new THREE.Color(0, 0, 0) }, brightness: { value: 1.0 },
        distort: { value: 0.08 }, tint: { value: new THREE.Color(1.0, 1.0, 1.0) }, pulse: { value: 0 },
        useBloom: { value: 1 }, overlayOn: { value: 0 }, shake: { value: 0 }, redden: { value: 0 }, scan: { value: 0 },
      },
    });
    this.u = this.finalMat.uniforms;
    this.rt = null;
    this.resize(1, 1);
  }

  resize(w, h) {
    const scale = this.settings.renderScale;
    const pr = Math.min(window.devicePixelRatio || 1, this.settings.maxPixelRatio);
    const W = Math.max(2, Math.floor(w * pr * scale)), H = Math.max(2, Math.floor(h * pr * scale));
    if (this.rt && this.rt.width === W && this.rt.height === H && this.rt.samples === this.settings.msaa) return;
    this.dispose();
    this.rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: this.settings.msaa, depthBuffer: true });
    this.rt.texture.minFilter = THREE.LinearFilter;
    this.rt.texture.magFilter = THREE.LinearFilter;
    const bw = Math.max(2, W >> 2), bh = Math.max(2, H >> 2);
    this.bA = new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType, depthBuffer: false });
    this.bB = new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType, depthBuffer: false });
    this.u.res.value.set(W, H);
    this.bw = bw; this.bh = bh;
  }

  dispose() {
    for (const t of [this.rt, this.bA, this.bB]) if (t) t.dispose();
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  render(scene, camera, overlay) {
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(scene, camera);
    if (overlay) {
      // Viewmodel overlay: clear depth, render on top into the same HDR target.
      r.clearDepth();
      r.render(overlay.scene, overlay.camera);
    }
    const bloom = this.settings.bloom;
    this.u.useBloom.value = bloom ? 1 : 0;
    if (bloom) {
      this.brightMat.uniforms.tSrc.value = this.rt.texture;
      this.pass(this.brightMat, this.bA);
      for (let k = 0; k < 2; k++) {
        this.blurMat.uniforms.tSrc.value = this.bA.texture;
        this.blurMat.uniforms.dir.value.set((k + 1) / this.bw, 0);
        this.pass(this.blurMat, this.bB);
        this.blurMat.uniforms.tSrc.value = this.bB.texture;
        this.blurMat.uniforms.dir.value.set(0, (k + 1) / this.bh);
        this.pass(this.blurMat, this.bA);
      }
      this.u.tBloom.value = this.bA.texture;
    }
    this.u.tScene.value = this.rt.texture;
    this.u.brightness.value = this.settings.brightness;
    this.pass(this.finalMat, null);
  }
}
