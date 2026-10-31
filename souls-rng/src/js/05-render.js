// =====================================================================
//  RENDER — renderer, bloom post, sky, particles, overlay, showcase
// =====================================================================
const R = { renderer: null, camera: null, scene: null, post: null, w: 1, h: 1, time: 0, bloom: true, shadows: true, partMul: 1, ok: false };
const QUAD_VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';

// ---------------- materials ----------------
const _matCache = {};
function matStd(hex, o = {}) {
  const k = 's' + hex + JSON.stringify(o);
  if (_matCache[k]) return _matCache[k];
  const m = new THREE.MeshStandardMaterial({ color: hex, roughness: o.r ?? 0.6, metalness: o.m ?? 0.1, flatShading: !!o.flat });
  if (o.e !== undefined) { m.emissive = new THREE.Color(o.e); m.emissiveIntensity = o.ei ?? 1; }
  if (o.op !== undefined) { m.transparent = true; m.opacity = o.op; m.depthWrite = o.op > 0.6; }
  if (o.side) m.side = THREE.DoubleSide;
  return (_matCache[k] = m);
}
function matGlow(hex, op = 1, add = true) {
  const k = 'g' + hex + '_' + op + add;
  if (_matCache[k]) return _matCache[k];
  const m = new THREE.MeshBasicMaterial({ color: hex, transparent: op < 1 || add, opacity: op, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !add && op >= 1, fog: false });
  return (_matCache[k] = m);
}
let GLOW_TEX = null;
function makeGlowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.7)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  GLOW_TEX = new THREE.CanvasTexture(c);
}
function glowSprite(hex, size, op = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: hex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.set(size, size, 1); return s;
}

// ---------------- post processing (bloom + grading) ----------------
class Post {
  constructor(r) {
    this.r = r; this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.qs = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false; this.qs.add(this.quad);
    const gl2 = r.capabilities.isWebGL2;
    this.type = (gl2 && r.extensions.has('EXT_color_buffer_float')) ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.msaaOK = gl2 && !!THREE.WebGLMultisampleRenderTarget;
    this.samples = 4;
    this.bright = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, th: { value: 0.88 }, px: { value: new THREE.Vector2() } }, vertexShader: QUAD_VS,
      fragmentShader: 'uniform sampler2D t;uniform float th;uniform vec2 px;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv+px*vec2(-.5,-.5)).rgb+texture2D(t,vUv+px*vec2(.5,-.5)).rgb+texture2D(t,vUv+px*vec2(-.5,.5)).rgb+texture2D(t,vUv+px*vec2(.5,.5)).rgb;c*=.25;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(th,th+.4,l),1.);}' });
    this.blur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: QUAD_VS,
      fragmentShader: 'uniform sampler2D t;uniform vec2 dir;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb*.227027;c+=(texture2D(t,vUv+dir*1.3846).rgb+texture2D(t,vUv-dir*1.3846).rgb)*.3162162;c+=(texture2D(t,vUv+dir*3.2308).rgb+texture2D(t,vUv-dir*3.2308).rgb)*.0702703;gl_FragColor=vec4(c,1.);}' });
    this.comp = new THREE.ShaderMaterial({
      uniforms: { tS: { value: null }, b0: { value: null }, b1: { value: null }, b2: { value: null }, str: { value: 0.8 }, vig: { value: 0.35 }, hurt: { value: 0 }, desat: { value: 0 }, glitch: { value: 0 }, ca: { value: 0 }, time: { value: 0 }, sat: { value: 1.12 }, useB: { value: 1 } },
      vertexShader: QUAD_VS,
      fragmentShader: `uniform sampler2D tS,b0,b1,b2;uniform float str,vig,hurt,desat,glitch,ca,time,sat,useB;varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      vec3 sc(vec3 x){return mix(x,.78+.22*(1.-exp(-(x-.78)/.22)),step(.78,x));}
      void main(){vec2 uv=vUv;
        if(glitch>0.){float b=floor(uv.y*28.+floor(time*14.));if(h(vec2(b,floor(time*9.)))>.78)uv.x+=(h(vec2(b,1.))-.5)*.09*glitch;}
        vec3 c;float a=ca+glitch*.6;
        if(a>0.){vec2 o=(uv-.5)*a*.014;c=vec3(texture2D(tS,uv+o).r,texture2D(tS,uv).g,texture2D(tS,uv-o).b);}else c=texture2D(tS,uv).rgb;
        if(useB>.5)c+=(texture2D(b0,uv).rgb*.55+texture2D(b1,uv).rgb*.8+texture2D(b2,uv).rgb*1.05)*str;
        c=sc(c);
        float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,sat);
        c=mix(c,vec3(l)*vec3(.75,.9,1.2),desat);
        float d=length(uv-.5)*1.42;c*=1.-vig*smoothstep(.45,1.15,d);
        c=mix(c,vec3(.9,0.,.08),hurt*smoothstep(.25,1.,d)*.75);
        if(glitch>0.)c=mix(c,c.gbr,step(.93,h(vec2(floor(uv.y*60.),floor(time*20.))))*glitch);
        c+=(h(uv*999.+time)-.5)/255.;
        gl_FragColor=vec4(c,1.);}`
    });
    this.targets = null;
  }
  setSize(w, h, msaa) {
    if (this.targets) this.targets.forEach(t => t.dispose());
    const opt = { type: this.type, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    let main;
    if (msaa && this.msaaOK) { main = new THREE.WebGLMultisampleRenderTarget(w, h, { type: this.type, format: THREE.RGBAFormat }); main.samples = this.samples; }
    else main = new THREE.WebGLRenderTarget(w, h, { type: this.type, format: THREE.RGBAFormat });
    this.main = main;
    this.A = [], this.B = [];
    for (let i = 0; i < 3; i++) { const s = 2 << i; this.A.push(new THREE.WebGLRenderTarget(Math.max(1, w / s | 0), Math.max(1, h / s | 0), opt)); this.B.push(new THREE.WebGLRenderTarget(Math.max(1, w / s | 0), Math.max(1, h / s | 0), opt)); }
    this.targets = [main, ...this.A, ...this.B];
    this.w = w; this.h = h;
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.cam); }
  render(scene, camera, useBloom) {
    const r = this.r;
    r.setRenderTarget(this.main); r.render(scene, camera);
    const c = this.comp.uniforms;
    if (useBloom) {
      this.bright.uniforms.t.value = this.main.texture; this.bright.uniforms.px.value.set(1 / this.w, 1 / this.h); this.pass(this.bright, this.A[0]);
      for (let i = 0; i < 3; i++) {
        const src = i === 0 ? this.A[0] : this.A[i - 1], tw = this.A[i].width, th = this.A[i].height;
        this.blur.uniforms.t.value = src.texture; this.blur.uniforms.dir.value.set(1 / tw, 0); this.pass(this.blur, this.B[i]);
        this.blur.uniforms.t.value = this.B[i].texture; this.blur.uniforms.dir.value.set(0, 1 / th); this.pass(this.blur, this.A[i]);
      }
      c.b0.value = this.A[0].texture; c.b1.value = this.A[1].texture; c.b2.value = this.A[2].texture;
    }
    c.useB.value = useBloom ? 1 : 0; c.tS.value = this.main.texture; c.time.value = R.time;
    this.pass(this.comp, null);
  }
}

// ---------------- sky dome ----------------
function makeSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, sunDir: { value: V3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, sunSize: { value: 1 }, stars: { value: 0 }, fx: { value: 0 }, time: { value: 0 } },
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD;void main(){vD=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
    fragmentShader: `uniform vec3 top,hor,bot,sunDir,sunCol;uniform float sunSize,stars,fx,time;varying vec3 vD;
    float h3(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
    float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=h3(vec3(i,0.)),b=h3(vec3(i+vec2(1,0),0.)),c=h3(vec3(i+vec2(0,1),0.)),d=h3(vec3(i+1.,0.));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n2(p);p*=2.03;a*=.5;}return v;}
    void main(){vec3 d=normalize(vD);float y=d.y;
      vec3 c=y>0.?mix(hor,top,pow(smoothstep(0.,1.,y),.55)):mix(hor,bot,smoothstep(0.,.25,-y));
      vec3 sd=normalize(sunDir);float s=max(dot(d,sd),0.);
      c+=sunCol*(smoothstep(1.-.0009*sunSize*sunSize,1.-.0006*sunSize*sunSize,s)*1.6+pow(s,12./sunSize)*.35+pow(s,3.)*.08);
      if(stars>0.){vec3 p=floor(d*260.);float n=h3(p);c+=vec3(step(1.-.004*stars,n))*smoothstep(0.,.25,y)*(.55+.45*sin(time*2.5+n*90.));}
      if(fx==1.){float band=smoothstep(.12,.35,y)*smoothstep(.85,.4,y);float w=fbm(vec2(atan(d.x,d.z)*3.+time*.05,y*4.-time*.1));float r=sin(atan(d.x,d.z)*7.+w*6.+time*.3)*.5+.5;c+=(vec3(.1,1.,.55)*r+vec3(.6,.25,1.)*(1.-r)*.6)*band*w*.9;}
      if(fx==2.){vec3 bh=normalize(vec3(.3,.42,-1.));float dd=acos(clamp(dot(d,bh),-1.,1.));float ang=atan(dot(d,vec3(0,1,0))-bh.y,dot(d,vec3(1,0,0))-bh.x);float ring=exp(-pow((dd-.24)*22.,2.))*(.7+.3*sin(ang*6.+time*1.5));float disk=exp(-pow((d.y-bh.y-(d.x-bh.x)*.25)*40.,2.))*smoothstep(.6,.2,dd)*smoothstep(.15,.22,dd);c+=vec3(1.,.55,1.4)*ring*1.4+vec3(1.,.6,.3)*disk*1.2;c=mix(c,vec3(0.),smoothstep(.2,.17,dd));}
      if(fx==3.){float ln=step(.94,h3(vec3(floor(y*50.),floor(time*6.),0.)));c+=vec3(0.,1.,.55)*ln*.25;c+=vec3(0.,.6,.4)*step(.985,h3(vec3(floor(d.xz*40.),floor(time*3.))))*.6;c+=vec3(0.,.15,.1)*step(.5,fract(y*180.+time));}
      if(fx==4.){float f=fbm(vec2(atan(d.x,d.z)*4.,y*6.)+time*.15);c+=vec3(1.,.5,.1)*pow(f,3.)*1.2*smoothstep(-.1,.4,y);}
      if(fx==5.){float f=fbm(d.xz/(max(y,.05))*1.2+vec2(time*.02,0.));c=mix(c,vec3(1.,.9,.75),smoothstep(.45,.75,f)*smoothstep(0.,.15,y)*.55);}
      if(fx==6.){float f=fbm(vec2(atan(d.x,d.z)*5.,y*9.)+time*.1);float crack=smoothstep(.02,0.,abs(f-.5))*smoothstep(0.,.3,y);c+=vec3(1.,.2,1.)*crack*2.+vec3(0.,1.,1.)*smoothstep(.015,0.,abs(f-.42))*smoothstep(0.,.3,y);}
      gl_FragColor=vec4(c,1.);}`
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 18), mat); m.frustumCulled = false; m.renderOrder = -10;
  return m;
}
function setSky(sky, b) {
  const u = sky.material.uniforms;
  u.top.value.set(b.sky[0]); u.hor.value.set(b.sky[1]); u.bot.value.set(b.sky[2]);
  u.sunCol.value.set(b.sun[0]); u.sunDir.value.set(...b.sun[2]).normalize(); u.sunSize.value = b.sun[3] || 1;
  u.stars.value = b.stars || 0; u.fx.value = b.skyFx || 0;
}

// ---------------- particles ----------------
class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.sz = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.ml = new Float32Array(max); this.gr = new Float32Array(max);
    this.dr = new Float32Array(max); this.s0 = new Float32Array(max); this.a0 = new Float32Array(max); this.gw = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aP = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aS = new THREE.BufferAttribute(this.sz, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aP); g.setAttribute('rgba', this.aC); g.setAttribute('size', this.aS); g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: 'attribute vec4 rgba;attribute float size;varying vec4 vC;uniform float uScale;void main(){vC=rgba;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=min(256.,size*uScale/max(.2,-mv.z));gl_Position=projectionMatrix*mv;}',
      fragmentShader: additive ? 'varying vec4 vC;void main(){float r=length(gl_PointCoord-.5)*2.;float a=1.-smoothstep(0.,1.,r);a*=a;gl_FragColor=vec4(vC.rgb*(1.+(1.-r)*.6)*vC.a*a,1.);}'
        : 'varying vec4 vC;void main(){float r=length(gl_PointCoord-.5)*2.;float a=1.-smoothstep(.4,1.,r);if(a<.01)discard;gl_FragColor=vec4(vC.rgb,vC.a*a);}'
    });
    if (additive) { this.mat.blending = THREE.CustomBlending; this.mat.blendSrc = THREE.OneFactor; this.mat.blendDst = THREE.OneFactor; }
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5;
    this.geo = g;
  }
  spawn(x, y, z, vx, vy, vz, col, a, size, life, grav = 0, drag = 0, grow = 0) {
    let i;
    if (this.n < this.max) i = this.n++; else i = (Math.random() * this.max) | 0;
    const p = i * 3, c = i * 4;
    this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z; this.vel[p] = vx; this.vel[p + 1] = vy; this.vel[p + 2] = vz;
    this.col[c] = col.r; this.col[c + 1] = col.g; this.col[c + 2] = col.b; this.col[c + 3] = a;
    this.sz[i] = size; this.s0[i] = size; this.a0[i] = a; this.life[i] = life; this.ml[i] = life; this.gr[i] = grav; this.dr[i] = drag; this.gw[i] = grow;
  }
  kill(i) {
    const j = --this.n; if (i === j) return;
    const p = i * 3, q = j * 3, c = i * 4, d = j * 4;
    for (let k = 0; k < 3; k++) { this.pos[p + k] = this.pos[q + k]; this.vel[p + k] = this.vel[q + k]; }
    for (let k = 0; k < 4; k++) this.col[c + k] = this.col[d + k];
    this.sz[i] = this.sz[j]; this.s0[i] = this.s0[j]; this.a0[i] = this.a0[j]; this.life[i] = this.life[j]; this.ml[i] = this.ml[j]; this.gr[i] = this.gr[j]; this.dr[i] = this.dr[j]; this.gw[i] = this.gw[j];
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.kill(i); i--; continue; }
      const p = i * 3, t = this.life[i] / this.ml[i], damp = Math.max(0, 1 - this.dr[i] * dt);
      this.vel[p + 1] -= this.gr[i] * dt;
      this.vel[p] *= damp; this.vel[p + 1] *= damp; this.vel[p + 2] *= damp;
      this.pos[p] += this.vel[p] * dt; this.pos[p + 1] += this.vel[p + 1] * dt; this.pos[p + 2] += this.vel[p + 2] * dt;
      this.col[i * 4 + 3] = this.a0[i] * Math.min(1, t * 1.6);
      this.sz[i] = this.s0[i] * (1 + this.gw[i] * (1 - t));
    }
    this.geo.setDrawRange(0, this.n);
    if (this.n) { this.aP.needsUpdate = true; this.aC.needsUpdate = true; this.aS.needsUpdate = true; }
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
}

// ---------------- temporary meshes (rings, beams, flashes) ----------------
const TEMPS = [];
function tempMesh(mesh, life, upd, scene) {
  (scene || R.scene).add(mesh);
  TEMPS.push({ mesh, t: 0, life, upd });
  return mesh;
}
function updateTemps(dt) {
  for (let i = TEMPS.length - 1; i >= 0; i--) {
    const T = TEMPS[i]; T.t += dt; const k = Math.min(1, T.t / T.life);
    if (T.upd) T.upd(T.mesh, k, dt);
    if (k >= 1) { if (T.mesh.parent) T.mesh.parent.remove(T.mesh); disposeTemp(T.mesh); TEMPS.splice(i, 1); }
  }
}
function disposeTemp(m) { m.traverse(o => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); if (o.material && o.material.userData && o.material.userData.temp) o.material.dispose(); }); }
function clearTemps() { TEMPS.forEach(T => { if (T.mesh.parent) T.mesh.parent.remove(T.mesh); disposeTemp(T.mesh); }); TEMPS.length = 0; }
function tmat(hex, op = 1, add = true) { const m = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }); m.userData.temp = true; return m; }

// ---------------- FX facade ----------------
let PG = null, PS = null; // glow + smoke particles
const FLASHES = [];
const FX = {
  c: new THREE.Color(),
  burst(p, hex, n, spd = 6, size = 0.35, life = 0.6, o = {}) {
    n = Math.ceil(n * R.partMul); const c = this.c.set(hex);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * TAU, ph = Math.acos(rand(-1, 1)), s = spd * rand(0.3, 1);
      const vx = Math.sin(ph) * Math.cos(th) * s, vy = Math.cos(ph) * s * (o.flat ? 0.2 : 1) + (o.up || 0), vz = Math.sin(ph) * Math.sin(th) * s;
      PG.spawn(p.x, p.y, p.z, vx, vy, vz, c, o.a ?? 1, size * rand(0.6, 1.3), life * rand(0.6, 1.2), o.g ?? 6, o.drag ?? 2, o.grow ?? 0);
    }
  },
  smoke(p, hex, n, spd = 2, size = 1.2, life = 1.2) {
    n = Math.ceil(n * R.partMul); const c = this.c.set(hex);
    for (let i = 0; i < n; i++) PS.spawn(p.x + rand(-0.4, 0.4), p.y + rand(-0.2, 0.4), p.z + rand(-0.4, 0.4), rand(-spd, spd), rand(0.5, 2) * spd * 0.6, rand(-spd, spd), c, 0.55, size * rand(0.7, 1.3), life * rand(0.7, 1.3), -0.6, 1.5, 1.5);
  },
  trail(p, hex, size = 0.3, life = 0.25, a = 0.8) { PG.spawn(p.x, p.y, p.z, rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3), this.c.set(hex), a, size, life, 0, 1, -0.5); },
  ring(p, r, hex, life = 0.45, y = 0.08, w = 0.18) {
    const m = new THREE.Mesh(new THREE.RingGeometry(1 - w, 1, 48), tmat(hex, 0.9)); m.rotation.x = -Math.PI / 2; m.position.set(p.x, y, p.z);
    tempMesh(m, life, (mm, k) => { const s = 0.2 + r * smooth(k); mm.scale.set(s, s, s); mm.material.opacity = 0.9 * (1 - k); });
  },
  sphere(p, r, hex, life = 0.35) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), tmat(hex, 0.8)); m.position.copy(p);
    tempMesh(m, life, (mm, k) => { const s = r * (0.3 + 0.7 * smooth(k)); mm.scale.set(s, s, s); mm.material.opacity = 0.8 * (1 - k) * (1 - k); });
  },
  beam(a, b, hex, w = 0.25, life = 0.18) {
    const len = a.distanceTo(b); if (len < 0.01) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(w, w, len, 8, 1, true), tmat(hex, 0.95));
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, _v4.copy(b).sub(a).normalize());
    const core = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.35, w * 0.35, len, 6, 1, true), tmat(0xffffff, 1)); m.add(core);
    tempMesh(m, life, (mm, k) => { mm.material.opacity = 0.95 * (1 - k); core.material.opacity = 1 - k; const s = 1 - k * 0.6; mm.scale.set(s, 1, s); });
  },
  lightning(a, b, hex, life = 0.22) {
    const pts = [], n = Math.max(4, Math.ceil(a.distanceTo(b) / 1.2));
    for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n); if (i > 0 && i < n) p.add(V3(rand(-0.6, 0.6), rand(-0.6, 0.6), rand(-0.6, 0.6))); pts.push(p); }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, tmat(0xffffff, 1)); tempMesh(l, life, (mm, k) => mm.material.opacity = 1 - k);
    const c = this.c.set(hex);
    for (let i = 0; i < n; i++) { const p0 = pts[i], p1 = pts[i + 1]; for (let j = 0; j < 3; j++) { const q = p0.clone().lerp(p1, j / 3); PG.spawn(q.x, q.y, q.z, 0, 0, 0, c, 1, 0.45, life * 1.4, 0, 0, 0); } }
  },
  flash(p, hex, I = 3, dist = 14) {
    let L = FLASHES.reduce((a, b) => (a.intensity < b.intensity ? a : b));
    L.position.copy(p); L.color.set(hex); L.intensity = I; L.distance = dist;
  },
  explosion(p, r, hex, big) {
    this.flash(p, hex, big ? 6 : 3.5, r * 4);
    this.sphere(p, r, hex, 0.35); this.sphere(p, r * 0.6, 0xffffff, 0.2);
    this.burst(p, hex, 26 + r * 6, r * 4, 0.6, 0.6, { g: 4 });
    this.burst(p, 0xffdd88, 14 + r * 2, r * 6, 0.25, 0.5, { g: 12 });
    this.smoke(p, 0x2a2a2a, 6 + r * 2, r * 0.6, r * 0.8, 1.4);
    this.ring(V3(p.x, 0, p.z), r * 1.4, hex, 0.5);
    shake(big ? 0.9 : 0.35 + r * 0.05);
  },
  num(pos, val, col, big) { if (S.set.nums) OV.nums.push({ x: pos.x, y: pos.y, z: pos.z, t: 0, s: typeof val === 'string' ? val : fmt(Math.max(1, val)), col, big, ox: rand(-14, 14) }); if (OV.nums.length > 70) OV.nums.shift(); }
};
function updateFlashes(dt) { FLASHES.forEach(L => { L.intensity = Math.max(0, L.intensity - dt * 18); }); }
let SHAKE = 0;
function shake(a) { if (S.set.shake) SHAKE = Math.min(1.6, SHAKE + a); }

// ---------------- 2D overlay (damage numbers, HP bars, hitmarkers) ----------------
const OV = {
  cv: null, g: null, nums: [], hit: 0, hitKill: 0, hitCrit: 0, w: 1, h: 1,
  init() { this.cv = $('ov'); this.g = this.cv.getContext('2d'); this.resize(); },
  resize() { this.w = this.cv.width = innerWidth; this.h = this.cv.height = innerHeight; },
  proj(x, y, z) { _v3.set(x, y, z).project(R.camera); if (_v3.z > 1 || _v3.z < -1) return null; return [(_v3.x + 1) / 2 * this.w, (1 - _v3.y) / 2 * this.h]; },
  draw(dt) {
    const g = this.g; g.clearRect(0, 0, this.w, this.h);
    if (!G.playing) { this.nums.length = 0; return; }
    // enemy health bars
    for (const e of G.enemies) {
      if (e.boss || e.hpT <= 0 || e.dead) continue;
      const p = this.proj(e.pos.x, e.pos.y + e.h * e.scale + 0.5, e.pos.z); if (!p) continue;
      const w = 46 * (e.elite ? 1.4 : 1), f = Math.max(0, e.hp / e.maxHp), a = Math.min(1, e.hpT);
      g.globalAlpha = a; g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(p[0] - w / 2 - 1, p[1] - 1, w + 2, 7);
      g.fillStyle = e.frozen > 0 ? '#7AE0FF' : e.elite ? '#FFAA00' : '#FF3355'; g.fillRect(p[0] - w / 2, p[1], w * f, 5);
      if (e.elite) { g.font = '900 10px Rubik,sans-serif'; g.fillStyle = '#FFAA00'; g.textAlign = 'center'; g.fillText('ELITE ' + e.def.n.toUpperCase(), p[0], p[1] - 4); }
    }
    g.globalAlpha = 1;
    // damage numbers
    g.textAlign = 'center'; g.lineJoin = 'round';
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i]; n.t += dt; if (n.t > 0.9) { this.nums.splice(i, 1); continue; }
      const p = this.proj(n.x, n.y + n.t * 1.6, n.z); if (!p) continue;
      const sc = n.big ? 1.5 : 1, pop = n.t < 0.12 ? 1 + (0.12 - n.t) * 5 : 1, fs = Math.round(17 * sc * pop);
      g.globalAlpha = n.t > 0.6 ? 1 - (n.t - 0.6) / 0.3 : 1;
      g.font = `900 ${fs}px 'Lilita One',Impact,sans-serif`; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.85)';
      g.strokeText(n.s, p[0] + n.ox, p[1]); g.fillStyle = n.col; g.fillText(n.s, p[0] + n.ox, p[1]);
    }
    g.globalAlpha = 1;
    // hitmarker
    if (this.hit > 0) {
      this.hit -= dt; const cx = this.w / 2, cy = this.h / 2, s = 7 + (1 - this.hit / 0.15) * 4;
      g.strokeStyle = this.hitKill > 0 ? '#FF2A4A' : this.hitCrit > 0 ? '#FFE600' : '#fff'; g.lineWidth = this.hitKill > 0 ? 3.5 : 2.5;
      g.beginPath(); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.moveTo(cx + a * s, cy + b * s); g.lineTo(cx + a * (s + 7), cy + b * (s + 7)); } g.stroke();
      this.hitKill -= dt; this.hitCrit -= dt;
    }
    // off-screen boss / portal markers
    const mark = (pos, col, label) => {
      _v3.set(pos.x, pos.y, pos.z).project(R.camera);
      let x = _v3.x, y = _v3.y; const behind = _v3.z > 1;
      if (!behind && Math.abs(x) < 0.95 && Math.abs(y) < 0.9) return;
      if (behind) { x = -x; y = -y; }
      const a = Math.atan2(y, x), r = 0.86; const sx = (Math.cos(a) * r + 1) / 2 * this.w, sy = (1 - Math.sin(a) * r) / 2 * this.h;
      g.save(); g.translate(clamp(sx, 30, this.w - 30), clamp(sy, 30, this.h - 30)); g.rotate(-a);
      g.fillStyle = col; g.beginPath(); g.moveTo(16, 0); g.lineTo(-8, -10); g.lineTo(-8, 10); g.closePath(); g.fill(); g.restore();
      g.font = '900 11px Rubik,sans-serif'; g.fillStyle = col; g.fillText(label, clamp(sx, 40, this.w - 40), clamp(sy, 30, this.h - 30) + 24);
    };
    if (G.boss && !G.boss.dead) mark(V3(G.boss.pos.x, G.boss.pos.y + 3, G.boss.pos.z), '#FF2A55', 'BOSS');
    if (G.portal) mark(G.portal.position, '#00F0FF', 'PORTAL');
  }
};

// ---------------- renderer setup ----------------
function initRenderer() {
  const canvas = document.createElement('canvas'); canvas.id = 'gl'; document.body.prepend(canvas);
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  r.toneMapping = THREE.NoToneMapping; r.outputEncoding = THREE.LinearEncoding;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.autoClear = true;
  R.renderer = r;
  R.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 600);
  try { R.post = new Post(r); } catch (e) { console.warn('post disabled', e); R.post = null; }
  makeGlowTex();
  PG = new Particles(7000, true); PS = new Particles(2500, false);
  for (let i = 0; i < 3; i++) { const L = new THREE.PointLight(0xffffff, 0, 14, 2); FLASHES.push(L); }
  OV.init();
  applyQuality();
  addEventListener('resize', () => { applyQuality(); OV.resize(); });
  R.ok = true;
}
function applyQuality() {
  if (!R.renderer) return;
  const q = S.set.quality, dpr = devicePixelRatio || 1;
  const pr = q === 'low' ? Math.min(dpr, 1) * 0.75 : q === 'medium' ? Math.min(dpr, 1) : q === 'high' ? Math.min(dpr, 1.5) : Math.min(dpr, 2);
  R.bloom = q !== 'low' && !!R.post; R.shadows = q === 'high' || q === 'ultra'; R.partMul = q === 'low' ? 0.5 : q === 'medium' ? 0.8 : 1;
  R.w = innerWidth; R.h = innerHeight;
  R.renderer.setPixelRatio(pr); R.renderer.setSize(R.w, R.h);
  const bw = Math.floor(R.w * pr), bh = Math.floor(R.h * pr);
  if (R.post) { try { R.post.setSize(bw, bh, q === 'high' || q === 'ultra'); } catch (e) { console.warn(e); R.post = null; R.bloom = false; } }
  R.camera.aspect = R.w / R.h; R.camera.updateProjectionMatrix();
  const sc = bh / (2 * Math.tan(THREE.MathUtils.degToRad(R.camera.fov) / 2));
  PG.mat.uniforms.uScale.value = sc; PS.mat.uniforms.uScale.value = sc;
  if (typeof onQualityChanged === 'function') onQualityChanged();
}
function renderFrame() {
  if (!R.scene) return;
  if (R.post && (R.bloom || G.playing)) {
    try { R.post.render(R.scene, R.camera, R.bloom); return; } catch (e) { console.warn('post failed, falling back', e); R.post = null; R.bloom = false; }
  }
  R.renderer.setRenderTarget(null); R.renderer.render(R.scene, R.camera);
}
function setScene(sc) {
  R.scene = sc;
  sc.add(PG.points); sc.add(PS.points); FLASHES.forEach(L => sc.add(L));
  PG.clear(); PS.clear(); clearTemps();
}

// ---------------- lobby showcase ----------------
const Showcase = {
  scene: null, model: null, key: '', ped: null, rings: [], sky: null, t: 0,
  init() {
    const sc = new THREE.Scene(); this.scene = sc;
    this.sky = makeSky(); sc.add(this.sky);
    setSky(this.sky, { sky: ['#05030f', '#1a0a3a', '#000000'], sun: ['#ff7af2', 0.4, [-0.6, 0.3, -1], 2], stars: 1.6, skyFx: 0 });
    sc.fog = new THREE.FogExp2(0x0a0618, 0.03);
    sc.add(new THREE.HemisphereLight(0xb0c8ff, 0x201030, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(3, 6, 5); sc.add(key);
    const rim = new THREE.DirectionalLight(0xff3aff, 0.9); rim.position.set(-4, 3, -4); sc.add(rim);
    const rim2 = new THREE.DirectionalLight(0x00f0ff, 0.7); rim2.position.set(4, 2, -3); sc.add(rim2);
    const ped = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.5, 48), matStd(0x14102a, { r: 0.3, m: 0.8 })); base.position.y = -0.25; ped.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.06, 48), matStd(0x1a1838, { r: 0.15, m: 0.9 })); top.position.y = 0.01; ped.add(top);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.25 + i * 0.5, 0.025, 6, 80), matGlow(i === 1 ? 0xff00aa : 0x00f0ff, 0.9));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.05 + i * 0.02; ped.add(ring); this.rings.push(ring);
    }
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), matStd(0x07050f, { r: 0.4, m: 0.6 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.5; ped.add(floor);
    const grid = new THREE.GridHelper(80, 60, 0x3a1a6a, 0x1a0a3a); grid.position.y = -0.49; grid.material.transparent = true; grid.material.opacity = 0.35; ped.add(grid);
    sc.add(ped); this.ped = ped;
    for (let i = 0; i < 18; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(rand(0.2, 0.6)), matStd(pick([0x00f0ff, 0xff00aa, 0xffe600, 0x9d00ff]), { e: pick([0x00f0ff, 0xff00aa, 0x9d00ff]), ei: 0.8, r: 0.2, m: 0.5 })); const a = rand(0, TAU), r = rand(7, 16); c.position.set(Math.cos(a) * r, rand(0.5, 8), Math.sin(a) * r - 4); c.userData.spin = rand(0.3, 1.2); c.userData.by = c.position.y; sc.add(c); this.rings.push(c); }
  },
  set(cid, mut) {
    const k = keyOf(cid, mut); if (k === this.key && this.model) return; this.key = k;
    if (this.model) { this.scene.remove(this.model.group); disposeModel(this.model.group); }
    this.model = buildCharacter(ROSTER_BY_ID[cid], mut);
    const s = this.model.group; s.position.set(0, 0.04, 0); s.rotation.y = 0.5; this.scene.add(s);
    if (R.scene === this.scene) this.burst(ROSTER_BY_ID[cid].col[2], 20);
  },
  burst(col, n) { if (R.scene !== this.scene) return; const c = new THREE.Color(col); for (let i = 0; i < n * R.partMul; i++) { const a = rand(0, TAU), s = rand(2, 7); PG.spawn(Math.cos(a) * 0.5, rand(0.3, 2.8), Math.sin(a) * 0.5, Math.cos(a) * s, rand(1, 6), Math.sin(a) * s, c, 1, rand(0.15, 0.4), rand(0.6, 1.4), 4, 1.5, 0); } },
  update(dt) {
    this.t += dt;
    this.sky.material.uniforms.time.value = this.t;
    if (this.model) { const g = this.model.group; g.rotation.y += dt * 0.45; animateCharacter(this.model, dt, 0, false, this.t); }
    this.rings.forEach((r, i) => { if (r.userData.spin) { r.rotation.x += dt * r.userData.spin; r.rotation.y += dt * r.userData.spin * 0.7; r.position.y = r.userData.by + Math.sin(this.t + i) * 0.4; } else r.rotation.z += dt * (i % 2 ? 0.3 : -0.2); });
    if (Math.random() < 0.5 * R.partMul && this.model) { const c = this.model.glowCol; const a = rand(0, TAU); PG.spawn(Math.cos(a) * 2.1, 0.1, Math.sin(a) * 2.1, 0, rand(0.6, 1.8), 0, c, 0.8, rand(0.08, 0.2), rand(1, 2), -0.3, 0.3, 0); }
    const cam = R.camera, wide = innerWidth > 900;
    cam.fov = 45; cam.updateProjectionMatrix();
    const h = this.model ? this.model.height : 2.4;
    cam.position.set(wide ? -2.4 : 0, 1.2 + h * 0.45, 5.2 + h * 0.9); cam.lookAt(wide ? -2.4 : 0, h * 0.48, 0);
  }
};
function disposeModel(g) { g.traverse(o => { if (o.material && o.material.userData && o.material.userData.own) o.material.dispose(); if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); }); }
