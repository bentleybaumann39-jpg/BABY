/* gl3d.js — the 3D view. A WebGL2 renderer for the same world the classic view draws: the floor heightfield
 * becomes terrain meshes, every model's primitives become instanced spheres, ellipsoids, boxes and capsules,
 * points and lines stay points and lines, and the lamp is a real spotlight with a visible cone. Lighting is
 * the classic shade() ported to GLSL (sun by depth, caustics, lamp, coloured lights, Beer–Lambert water).
 * The frame is drawn at the internal resolution, quantised through the same zone palettes and Bayer dither
 * in a shader, and read back into the classic output buffer, so the HUD, captions, menus and CRT pass draw on
 * top exactly as before. World coordinates stay the game's own (x east, y south, z down); the camera's up is -z.
 * In the 3D view the R.* drawing calls are routed here (see G.enable). */
'use strict';
(function (B) {
  const M = B.M, R = B.R, I = B.I;
  const G = B.G3 = { ok: false, on: false };
  let gl = null, cv = null, W = 0, H = 0;

  // ------------------------------------------------------------------ GL plumbing
  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n').slice(0, 4000));
    return s;
  }
  function program(vs, fs) {
    const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i), name = info.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function buffer(data, target, usage) { const b = gl.createBuffer(); gl.bindBuffer(target || gl.ARRAY_BUFFER, b); gl.bufferData(target || gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW); return b; }

  // ------------------------------------------------------------------ shared GLSL
  const LIGHT = `
uniform vec3 uEye, uCam; uniform float uFogMul; uniform int uFog; uniform int uTopside; uniform vec3 uTop;
uniform float uSunScale, uCaustic, uAmbient, uCauLayer, uTime;
uniform int uLampOn; uniform vec3 uLampPos, uLampDir, uLampCol; uniform vec4 uLampP;
uniform int uNL; uniform vec4 uLP[32]; uniform vec4 uLC[32];
uniform mediump sampler2DArray uCau;
const vec3 K = vec3(0.35, 0.07, 0.02);
vec3 sunAt(float z) { return vec3(1.25 * exp(-z * 0.075), 1.15 * exp(-z * 0.032), 1.05 * exp(-z * 0.021)); }
vec3 waterAt(float z) { z = max(z, 0.0); float deep = z < 2700.0 ? 1.0 : max(0.0, 1.0 - (z - 2700.0) / 300.0); return sunAt(z) * vec3(0.18, 0.32, 0.42) + vec3(0.0004, 0.0016, 0.0042) * deep; }
vec3 lightAt(vec3 p, vec3 n, float glossy) {
  vec3 L;
  if (uTopside == 1) { float up = 0.55 + 0.45 * max(-n.z, 0.0), side = 0.15 * max(n.x, 0.0); L = uTop * (up + side); }
  else {
    float z = max(p.z, 0.0), cs = (0.3 + 0.7 * max(-n.z, 0.0)) * uSunScale;
    if (z < 150.0 && uCaustic > 0.0) { float c = texture(uCau, vec3(p.xy * 0.0625, uCauLayer)).r; cs *= 0.6 + c * 1.7 * uCaustic * (1.0 - z / 150.0); }
    L = z < 700.0 ? sunAt(z) * cs : vec3(0.0);
    L += uAmbient * vec3(0.3, 0.6, 1.0);
  }
  if (uLampOn == 1) {
    vec3 d = p - uLampPos; float d2 = dot(d, d);
    if (d2 < uLampP.z && d2 > 1e-4) {
      float dl = sqrt(d2), ca = dot(d, uLampDir) / dl;
      if (ca > uLampP.x) {
        float sp = min(1.0, (ca - uLampP.x) / (uLampP.y - uLampP.x));
        float ndl = 0.25 + 0.75 * max(-dot(n, d) / dl, 0.0), at = 1.0 - d2 / uLampP.z; at *= at;
        L += uLampP.w * sp * ndl * at * uLampCol * exp(-K * dl);
        if (glossy > 0.5) L += pow(ca, 40.0) * 3.0 * at * uLampCol;
      }
    }
  }
  for (int i = 0; i < 32; i++) {
    if (i >= uNL) break;
    vec4 lp = uLP[i]; vec3 d = p - lp.xyz; float d2 = dot(d, d), r2 = lp.w * lp.w;
    if (d2 >= r2) continue;
    float dl = sqrt(d2) + 0.001, ndl = 0.35 + 0.65 * max(-dot(n, d) / dl, 0.0), at = 1.0 - d2 / r2; at *= at;
    L += uLC[i].w * ndl * at * uLC[i].rgb * exp(-K * dl);
  }
  return L;
}
vec3 trans(vec3 p) { return uFog == 1 ? exp(-K * min(length(p - uEye) * uFogMul, 300.0)) : vec3(1.0); }
vec3 fogged(vec3 p, vec3 c) {
  if (uFog == 0) return c;
  vec3 tr = trans(p);
  return c * tr + waterAt((p.z + uEye.z) * 0.5) * (1.0 - tr);
}
float bayer(vec2 fc) { int x = int(fc.x) & 3, y = int(fc.y) & 3; int i = y * 4 + x;
  int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return (float(b[i]) + 0.5) / 16.0; }
vec4 encode(vec3 c, float id, float em) { return vec4(sqrt(clamp(c / 1.5, 0.0, 1.0)), (id * 16.0 + em * 8.0 + 4.0) / 255.0); }
`;
  const HEAD = '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision mediump sampler2DArray;\n';

  // terrain: positions in game space; material, jitter and cavity come from a per-map texture
  const TERRAIN_VS = HEAD + `
in vec3 aPos; in vec2 aN;
uniform mat4 uVP; uniform float uTime; uniform int uSea;
out vec3 vP; out vec3 vN;
void main() {
  vec3 p = aPos;
  if (uSea == 1 && p.z > 0.2 && p.z < 0.6) p.z += sin(p.x * 0.35 + uTime * 1.3) * 0.25 + sin(p.y * 0.5 - uTime * 0.9) * 0.2;
  vP = p; vN = vec3(aN, -sqrt(max(0.0, 1.0 - dot(aN, aN))));
  gl_Position = uVP * vec4(p, 1.0);
}`;
  const TERRAIN_FS = HEAD + LIGHT + `
in vec3 vP; in vec3 vN;
uniform highp sampler2D uMap; uniform float uCell, uSize; uniform mediump sampler2DArray uDet; uniform vec3 uAlb[13];
out vec4 o;
void main() {
  vec2 ij = vP.xy / uCell; vec2 ti = fract(vP.xy * 0.125);
  ivec2 n = textureSize(uMap, 0);
  ivec2 c = clamp(ivec2(floor(ij)), ivec2(0), n - 1);
  vec4 md = texelFetch(uMap, c, 0);
  int mt = int(md.r * 255.0 + 0.5);
  float jt = (0.88 + md.g * 0.24) * md.b * 255.0 / 128.0;
  vec3 nn = normalize(vN);
  vec3 alb = uAlb[mt] * jt;
  float gl = 0.0;
  if (nn.z > -0.45) {
    // cliff faces: strata bands and joints
    float band = floor(vP.z * 1.5), along = floor((vP.x + vP.y) * 1.5);
    float h1 = fract(sin(band * 12.9898 + along * 0.31) * 43758.5453), h2 = fract(sin(band * 0.25 * 78.233 + floor((vP.x - vP.y) * 3.0) * 1.7) * 23421.631);
    alb = (mt == 5 ? uAlb[5] : mt == 3 ? uAlb[3] : uAlb[0]) * (0.75 + 0.35 * h1) * (h2 > 0.86 ? 0.55 : 1.0);
  } else if (mt == 4) {
    float rip = 0.5 + 0.5 * sin(vP.x * 1.7 + vP.y * 2.3 + uTime * 0.8) * sin(vP.x * 0.9 - vP.y * 1.3 - uTime * 0.5);
    alb *= 0.6 + rip * 0.8; gl = 1.0;
  } else if (mt == 9) {
    float w = 0.5 + 0.5 * sin(vP.x * 0.35 + uTime * 0.4) * cos(vP.y * 0.5 - uTime * 0.25);
    alb = vec3(0.012, 0.03, 0.05) * (w > 0.85 ? 3.2 : 1.0) + w * vec3(0.02, 0.03, 0.04); gl = 1.0;
  } else {
    vec4 d = texture(uDet, vec3(ti, float(mt)));
    alb *= d.r * 3.0; nn = normalize(nn + vec3((d.g - 0.5) * 4.0, (d.b - 0.5) * 4.0, 0.0));
  }
  vec3 col = fogged(vP, alb * lightAt(vP, nn, gl));
  o = encode(col, 0.0, 0.0);
}`;

  // models: one unit mesh per primitive kind, transformed per instance
  const MODEL_VS = HEAD + `
in vec3 aPos; in vec3 aNrm;
in vec3 iC; in vec3 iX; in vec3 iY; in vec3 iZ; in vec3 iCol; in vec3 iEm; in vec4 iP; in vec4 iQ;
uniform mat4 uVP;
out vec3 vP; out vec3 vN; flat out vec3 vCol; flat out vec3 vEm; flat out vec4 vPm; flat out vec4 vQ;
void main() {
  mat3 A = mat3(iX, iY, iZ);
  vec3 p = iC + A * aPos;
  vP = p; vN = normalize(transpose(inverse(A)) * aNrm);
  vCol = iCol; vEm = iEm; vPm = iP; vQ = iQ;
  gl_Position = uVP * vec4(p, 1.0);
}`;
  const CAPSULE_VS = HEAD + `
in vec3 aPos; in vec3 aNrm; in float aEnd;
in vec3 iA; in vec3 iB; in float iR; in vec3 iCol; in vec3 iEm; in vec4 iP; in vec4 iQ;
uniform mat4 uVP;
out vec3 vP; out vec3 vN; flat out vec3 vCol; flat out vec3 vEm; flat out vec4 vPm; flat out vec4 vQ;
void main() {
  vec3 ax = iB - iA; float len = length(ax); vec3 w = len > 1e-5 ? ax / len : vec3(0.0, 0.0, 1.0);
  vec3 t = abs(w.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 u = normalize(cross(t, w)), v = cross(w, u);
  vec3 p = iA + w * len * aEnd + (u * aPos.x + w * aPos.y + v * aPos.z) * iR;
  vP = p; vN = normalize(u * aNrm.x + w * aNrm.y + v * aNrm.z);
  vCol = iCol; vEm = iEm; vPm = iP; vQ = iQ;
  gl_Position = uVP * vec4(p, 1.0);
}`;
  // iP: material, lut id, alpha, minLight   iQ: dim, dead, emScale, unused
  const MODEL_FS = HEAD + LIGHT + `
in vec3 vP; in vec3 vN; flat in vec3 vCol; flat in vec3 vEm; flat in vec4 vPm; flat in vec4 vQ;
out vec4 o;
void main() {
  if (vPm.z < 0.999 && bayer(gl_FragCoord.xy) > vPm.z) discard;
  int m = int(vPm.x + 0.5);
  vec3 n = normalize(vN);
  if (dot(n, vP - uCam) > 0.0) n = -n;
  vec3 col;
  if (vQ.y > 0.5) col = vCol * 0.5;
  else {
    col = vCol * lightAt(vP, n, (m == 1 || m == 3) ? 1.0 : 0.0) + vCol * vPm.w;
    if (m == 2 && uLampOn == 1) {
      vec3 d = vP - uLampPos; float dl = length(d) + 0.01;
      if (dot(d, uLampDir) / dl > uLampP.x * 0.98 && dl * dl < uLampP.z) { float k = 1.4 * (1.0 - dl * dl / uLampP.z); col += k * vec3(0.6, 0.75, 0.2); }
    }
    col = fogged(vP, col);
  }
  if (m == 4) col = vec3(0.0);
  col *= vQ.x;
  vec3 e = vEm * vQ.z; float em = 0.0;
  if (dot(e, vec3(1.0)) > 0.01) {
    if (m == 5) { col += e; em = 1.0; } else { vec3 tr = trans(vP); col += e * tr; em = dot(e, vec3(1.0)) * dot(tr, vec3(1.0)) > 0.3 ? 1.0 : 0.0; }
  }
  o = encode(col, vPm.y, em);
}`;

  // points, lines and quads: per-vertex colour and a mode (0 lit, 1 emissive, 2 additive, 3 additive unfiltered)
  const PART_VS = HEAD + `
in vec3 aPos; in vec3 aCol; in vec4 aP;
uniform mat4 uVP; uniform float uPx;
out vec3 vP; flat out vec3 vCol; flat out vec4 vPm; out vec2 vUV;
void main() {
  vP = aPos; vCol = aCol; vPm = aP; vUV = vec2(aP.w, fract(aP.w * 7.0));
  gl_Position = uVP * vec4(aPos, 1.0);
  gl_PointSize = max(1.0, aP.y * uPx);
}`;
  const PART_FS = HEAD + LIGHT + `
in vec3 vP; flat in vec3 vCol; flat in vec4 vPm;
out vec4 o;
void main() {
  if (vPm.z < 0.999 && bayer(gl_FragCoord.xy) > vPm.z) discard;
  int m = int(vPm.x + 0.5);
  vec3 col; float em = 0.0;
  if (m == 0) col = fogged(vP, vCol * lightAt(vP, normalize(vec3(0.0, 0.6, -0.8)), 0.0));
  else if (m == 3) { col = vCol; em = 1.0; }
  else { col = vCol * trans(vP); em = dot(col, vec3(1.0)) > 0.25 ? 1.0 : 0.0; }
  o = encode(col, 0.0, em);
}`;
  // discs and decals: a quad with a local uv; density falls off to the rim through the screen door
  const DISC_VS = HEAD + `
in vec3 aPos; in vec3 aCol; in vec4 aP; in vec2 aUV;
uniform mat4 uVP;
out vec3 vP; flat out vec3 vCol; flat out vec4 vPm; out vec2 vUV;
void main() { vP = aPos; vCol = aCol; vPm = aP; vUV = aUV; gl_Position = uVP * vec4(aPos, 1.0); }`;
  const DISC_FS = HEAD + LIGHT + `
in vec3 vP; flat in vec3 vCol; flat in vec4 vPm; in vec2 vUV;
out vec4 o;
void main() {
  float d = dot(vUV, vUV); if (d > 1.0) discard;
  if (bayer(gl_FragCoord.xy) > vPm.z * (1.0 - d)) discard;
  int m = int(vPm.x + 0.5); vec3 col; float em = 0.0;
  if (m == 0) col = fogged(vP, vCol * lightAt(vP, vec3(0.0, 0.5, -0.86), 0.0));
  else if (m == 4) col = vec3(0.0);
  else { col = vCol * trans(vP); em = 1.0; }
  o = encode(col, 0.0, em);
}`;
  // the lamp's cone, made visible by what hangs in the water
  const BEAM_VS = HEAD + `
in vec3 aPos;
uniform mat4 uVP; uniform vec3 uO, uD, uU, uV; uniform float uLen, uRad;
out vec3 vL;
void main() { vL = aPos; vec3 p = uO + uD * aPos.z * uLen + (uU * aPos.x + uV * aPos.y) * uRad * aPos.z; gl_Position = uVP * vec4(p, 1.0); }`;
  const BEAM_FS = HEAD + `
in vec3 vL; uniform vec3 uCol; uniform float uK, uTime;
out vec4 o;
void main() {
  float along = vL.z, across = length(vL.xy);
  float fall = 1.0 - along, edge = 1.0 - across * across;
  float streak = 0.75 + 0.25 * sin(along * 30.0 - uTime * 1.7 + vL.x * 5.0);
  float a = fall * sqrt(max(fall, 0.0)) * max(edge, 0.0) * streak * uK;
  o = vec4(uCol * a * 0.5, 0.0);
}`;
  // final pass: decode, palette-quantise with the Bayer dither, flip for readback, emissive flag in alpha
  const QUANT_VS = HEAD + `
in vec2 aP; void main() { gl_Position = vec4(aP, 0.0, 1.0); }`;
  const QUANT_FS = HEAD + `
uniform highp sampler2D uScene; uniform highp sampler2D uLut; uniform highp sampler2D uDepth; uniform float uOutline; uniform float uSpread; uniform int uMono; uniform vec3 uLens; uniform float uScale[6];
uniform vec2 uRes;
out vec4 o;
float bayer(vec2 fc) { int x = int(fc.x) & 3, y = int(fc.y) & 3; int i = y * 4 + x;
  int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return (float(b[i]) + 0.5) / 16.0 - 0.5; }
float lin(float d) { float n = 0.08, f = 260.0; return n * f / (f - d * (f - n)); }
vec3 srgb(vec3 c) { c = min(c, vec3(1.0)); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);                       // output row r holds image row r, top-down, for readback
  ivec2 sp = ivec2(px.x, int(uRes.y) - 1 - px.y);           // the scene texture is the usual GL way up
  vec4 s = texelFetch(uScene, sp, 0);
  int a = int(s.a * 255.0 + 0.5), id = a >> 4, em = (a >> 3) & 1;
  if (a < 4) id = 0;
  // older suits and helmets keep their own coarser pixel grid
  float bs = uScale[clamp(id, 0, 5)];
  if (bs > 1.5) { ivec2 q = (px / int(bs)) * int(bs); ivec2 qs = ivec2(q.x, int(uRes.y) - 1 - q.y); vec4 s2 = texelFetch(uScene, qs, 0); if ((int(s2.a * 255.0 + 0.5) >> 4) == id) s = s2; }
  vec3 c = s.rgb * s.rgb * 1.5;
  // a dark line where something near stands in front of something further off: the silhouette outline
  if (uOutline > 0.5) {
    float z0 = lin(texelFetch(uDepth, sp, 0).r);
    if (z0 < 45.0) {
      float zn = max(max(lin(texelFetch(uDepth, sp + ivec2(1, 0), 0).r), lin(texelFetch(uDepth, sp - ivec2(1, 0), 0).r)), max(lin(texelFetch(uDepth, sp + ivec2(0, 1), 0).r), lin(texelFetch(uDepth, sp - ivec2(0, 1), 0).r)));
      if (zn - z0 > max(0.6, z0 * 0.12)) c *= 0.4;
    }
  }
  if (uMono == 1) { float v = max(c.r, max(c.g, c.b)) * 2.4; c = vec3(v); }
  bool lens = uLens.z > 0.0 && distance(vec2(px) , uLens.xy) < uLens.z;
  float d = bayer(vec2(px)) * (lens ? 0.04 : uSpread);
  ivec3 q = clamp(ivec3(floor((srgb(c) + d) * 31.0 + 0.5)), ivec3(0), ivec3(31));
  int lut = (lens && id == 0) ? 6 : id;
  vec3 outc = texelFetch(uLut, ivec2(q.g * 32 + q.b, lut * 32 + q.r), 0).rgb;
  o = vec4(outc, em == 1 ? 128.0 / 255.0 : 1.0);
}`;
  // sonar wireframes and other exact-colour marks drawn over the quantised frame
  const FLAT_VS = HEAD + `
in vec3 aPos; in vec3 iC; in vec3 iX; in vec3 iY; in vec3 iZ;
uniform mat4 uVP; uniform int uCap; in float aEnd; in vec3 iA; in vec3 iB; in float iR;
void main() {
  vec3 p;
  if (uCap == 1) { vec3 ax = iB - iA; float len = length(ax); vec3 w = len > 1e-5 ? ax / len : vec3(0.0, 0.0, 1.0); vec3 t = abs(w.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0); vec3 u = normalize(cross(t, w)), v = cross(w, u); p = iA + w * len * aEnd + (u * aPos.x + w * aPos.y + v * aPos.z) * iR; }
  else p = iC + mat3(iX, iY, iZ) * aPos;
  vec4 c = uVP * vec4(p, 1.0); c.y = -c.y; gl_Position = c;
}`;
  const FLAT_FS = HEAD + `uniform vec3 uCol; out vec4 o; void main() { o = vec4(uCol, 1.0); }`;

  // ------------------------------------------------------------------ meshes
  function sphereMesh(seg, rings) {
    const p = [], idx = [], edges = [];
    for (let j = 0; j <= rings; j++) { const v = j / rings * Math.PI, sv = Math.sin(v), cvv = Math.cos(v); for (let i = 0; i <= seg; i++) { const u = i / seg * Math.PI * 2; p.push(Math.cos(u) * sv, Math.sin(u) * sv, cvv); } }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); edges.push(a, a + 1); if (i % 2 === 0) edges.push(a, b); }
    return { pos: new Float32Array(p), nrm: new Float32Array(p), idx: new Uint16Array(idx), edges: new Uint16Array(edges) };
  }
  function cubeMesh() {
    const p = [], n = [], idx = [], F = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const f of F) {
      const u = f[0] ? [0, 1, 0] : [1, 0, 0], v = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]], b = p.length / 3;
      for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { p.push(f[0] + u[0] * a + v[0] * c, f[1] + u[1] * a + v[1] * c, f[2] + u[2] * a + v[2] * c); n.push(...f); }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const C = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], eb = p.length / 3;
    for (const c of C) { p.push(...c); n.push(0, 0, 1); }
    const E2 = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7].map(k => k + eb);
    return { pos: new Float32Array(p), nrm: new Float32Array(n), idx: new Uint16Array(idx), edges: new Uint16Array(E2) };
  }
  // A capsule along local +y from end 0 to end 1: a cylinder and two hemispheres; aEnd says which end a vertex rides.
  function capsuleMesh(seg, rings) {
    const p = [], n = [], e = [], idx = [], edges = [];
    const ring = (y, cy, ry, end) => { const b = p.length / 3; for (let i = 0; i <= seg; i++) { const u = i / seg * Math.PI * 2; p.push(Math.cos(u) * ry, y, Math.sin(u) * ry); n.push(Math.cos(u) * ry, cy, Math.sin(u) * ry); e.push(end); } return b; };
    const rows = [];
    for (let j = rings; j >= 1; j--) { const a = j / rings * Math.PI / 2; rows.push(ring(-Math.sin(a), -Math.sin(a), Math.cos(a), 0)); }
    rows.push(ring(0, 0, 1, 0)); rows.push(ring(0, 0, 1, 1));
    for (let j = 1; j <= rings; j++) { const a = j / rings * Math.PI / 2; rows.push(ring(Math.sin(a), Math.sin(a), Math.cos(a), 1)); }
    for (let r = 0; r < rows.length - 1; r++) for (let i = 0; i < seg; i++) { const a = rows[r] + i, b = rows[r + 1] + i; idx.push(a, b, a + 1, a + 1, b, b + 1); edges.push(a, a + 1); if (i % 3 === 0) edges.push(a, b); }
    return { pos: new Float32Array(p), nrm: new Float32Array(n), end: new Float32Array(e), idx: new Uint16Array(idx), edges: new Uint16Array(edges) };
  }
  function coneMesh(seg) {
    const p = [0, 0, 0], idx = [];
    for (let i = 0; i <= seg; i++) { const u = i / seg * Math.PI * 2; p.push(Math.cos(u), Math.sin(u), 1); }
    for (let i = 1; i <= seg; i++) idx.push(0, i, i + 1);
    return { pos: new Float32Array(p), idx: new Uint16Array(idx) };
  }

  // ------------------------------------------------------------------ state
  let P = {}, meshes = {}, vaos = {}, tex = {}, fbo = {}, quadBuf = null;
  const MAXI = 4096;
  const sI = new Float32Array(MAXI * 29), bI = new Float32Array(MAXI * 29), cI = new Float32Array(MAXI * 21);
  let sN = 0, bN = 0, cN = 0;
  const wS = new Float32Array(1024 * 29), wB = new Float32Array(1024 * 29), wC = new Float32Array(1024 * 21);
  let wsN = 0, wbN = 0, wcN = 0, wCol = [1, 1, 1];
  // dynamic geometry: points/lines (10 floats per vertex), discs (12 floats per vertex)
  const PT = new Float32Array(60000 * 10), PA = new Float32Array(60000 * 10), LN = new Float32Array(20000 * 10), LA = new Float32Array(20000 * 10), DQ = new Float32Array(6000 * 12);
  let ptN = 0, paN = 0, lnN = 0, laN = 0, dqN = 0;
  const cam = G.cam = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, yaw: 0, pitch: 0.38, dist: 7, fov: 64, vp: new Float32Array(16), right: [1, 0, 0], up: [0, 0, -1], fwd: [1, 0, 0] };

  G.init = function () {
    try {
      cv = document.createElement('canvas'); cv.width = 4; cv.height = 4;
      gl = cv.getContext('webgl2', { antialias: false, alpha: true, depth: true, premultipliedAlpha: false, preserveDrawingBuffer: false });
      if (!gl) return false;
      P.terrain = program(TERRAIN_VS, TERRAIN_FS);
      P.model = program(MODEL_VS, MODEL_FS);
      P.capsule = program(CAPSULE_VS, MODEL_FS);
      P.part = program(PART_VS, PART_FS);
      P.disc = program(DISC_VS, DISC_FS);
      P.beam = program(BEAM_VS, BEAM_FS);
      P.quant = program(QUANT_VS, QUANT_FS);
      P.flat = program(FLAT_VS, FLAT_FS);
      meshes.sphere = sphereMesh(12, 8); meshes.cube = cubeMesh(); meshes.capsule = capsuleMesh(10, 3); meshes.cone = coneMesh(24);
      buildModelVAOs(); buildDynVAOs(); buildTextures();
      quadBuf = buffer(new Float32Array([-1, -1, 3, -1, -1, 3]));
      G.ok = true;
    } catch (e) { console.warn('3D view unavailable:', e && e.message ? e.message.slice(0, 500) : e); G.ok = false; gl = null; }
    return G.ok;
  };

  function attrib(prog, name, size, stride, offset, divisor) {
    const loc = gl.getAttribLocation(prog.p, name); if (loc < 0) return;
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, offset * 4);
    gl.vertexAttribDivisor(loc, divisor || 0);
  }
  // instance layout (29 floats): C3 X3 Y3 Z3 col3 em3 P4 Q4 + 3 spare; capsule (21): A3 B3 R1 col3 em3 P4 Q4
  function instVAO(prog, mesh, instBuf, isCap) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo); attrib(prog, 'aPos', 3, 3, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nbo); attrib(prog, 'aNrm', 3, 3, 0);
    if (mesh.ebo2) { gl.bindBuffer(gl.ARRAY_BUFFER, mesh.ebo2); attrib(prog, 'aEnd', 1, 1, 0); }
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    if (isCap) { attrib(prog, 'iA', 3, 21, 0, 1); attrib(prog, 'iB', 3, 21, 3, 1); attrib(prog, 'iR', 1, 21, 6, 1); attrib(prog, 'iCol', 3, 21, 7, 1); attrib(prog, 'iEm', 3, 21, 10, 1); attrib(prog, 'iP', 4, 21, 13, 1); attrib(prog, 'iQ', 4, 21, 17, 1); }
    else { attrib(prog, 'iC', 3, 29, 0, 1); attrib(prog, 'iX', 3, 29, 3, 1); attrib(prog, 'iY', 3, 29, 6, 1); attrib(prog, 'iZ', 3, 29, 9, 1); attrib(prog, 'iCol', 3, 29, 12, 1); attrib(prog, 'iEm', 3, 29, 15, 1); attrib(prog, 'iP', 4, 29, 18, 1); attrib(prog, 'iQ', 4, 29, 22, 1); }
    gl.bindVertexArray(null);
    return vao;
  }
  function buildModelVAOs() {
    for (const k of ['sphere', 'cube', 'capsule']) {
      const m = meshes[k];
      m.vbo = buffer(m.pos); m.nbo = buffer(m.nrm); if (m.end) m.ebo2 = buffer(m.end);
      m.ibo = buffer(m.idx, gl.ELEMENT_ARRAY_BUFFER); m.lbo = buffer(m.edges, gl.ELEMENT_ARRAY_BUFFER);
    }
    G.bufS = gl.createBuffer(); G.bufB = gl.createBuffer(); G.bufC = gl.createBuffer();
    G.bufWS = gl.createBuffer(); G.bufWB = gl.createBuffer(); G.bufWC = gl.createBuffer();
    for (const b of [G.bufS, G.bufB, G.bufC, G.bufWS, G.bufWB, G.bufWC]) { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, 4, gl.DYNAMIC_DRAW); }
    vaos.sphere = instVAO(P.model, meshes.sphere, G.bufS); vaos.cube = instVAO(P.model, meshes.cube, G.bufB); vaos.capsule = instVAO(P.capsule, meshes.capsule, G.bufC, true);
    vaos.wSphere = instVAO(P.flat, meshes.sphere, G.bufWS); vaos.wCube = instVAO(P.flat, meshes.cube, G.bufWB); vaos.wCapsule = instVAO(P.flat, meshes.capsule, G.bufWC, true);
    // the beam cone
    const cm = meshes.cone; cm.vbo = buffer(cm.pos); cm.ibo = buffer(cm.idx, gl.ELEMENT_ARRAY_BUFFER);
    vaos.cone = gl.createVertexArray(); gl.bindVertexArray(vaos.cone); gl.bindBuffer(gl.ARRAY_BUFFER, cm.vbo); attrib(P.beam, 'aPos', 3, 3, 0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cm.ibo); gl.bindVertexArray(null);
  }
  function buildDynVAOs() {
    G.bufPT = gl.createBuffer(); G.bufLN = gl.createBuffer(); G.bufDQ = gl.createBuffer();
    for (const b of [G.bufPT, G.bufLN, G.bufDQ]) { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, 4, gl.DYNAMIC_DRAW); }
    const pv = (buf) => { const v = gl.createVertexArray(); gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, buf); attrib(P.part, 'aPos', 3, 10, 0); attrib(P.part, 'aCol', 3, 10, 3); attrib(P.part, 'aP', 4, 10, 6); gl.bindVertexArray(null); return v; };
    vaos.pt = pv(G.bufPT); vaos.ln = pv(G.bufLN);
    vaos.dq = gl.createVertexArray(); gl.bindVertexArray(vaos.dq); gl.bindBuffer(gl.ARRAY_BUFFER, G.bufDQ);
    attrib(P.disc, 'aPos', 3, 12, 0); attrib(P.disc, 'aCol', 3, 12, 3); attrib(P.disc, 'aP', 4, 12, 6); attrib(P.disc, 'aUV', 2, 12, 10); gl.bindVertexArray(null);
    vaos.quad = gl.createVertexArray();
  }
  function buildTextures() {
    const X = R._tex;
    // detail: 13 layers, R = albedo/3, G/B = normal nudge
    const det = new Uint8Array(64 * 64 * 13 * 4);
    for (let m = 0; m < 13; m++) for (let i = 0; i < 4096; i++) {
      const o = (m * 4096 + i) * 4; det[o] = M.clamp(Math.round(X.TEXA[m][i] / 3 * 255), 0, 255);
      det[o + 1] = M.clamp(Math.round((X.TEXX[m][i] * 0.25 + 0.5) * 255), 0, 255); det[o + 2] = M.clamp(Math.round((X.TEXY[m][i] * 0.25 + 0.5) * 255), 0, 255); det[o + 3] = 255;
    }
    tex.det = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex.det);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 64, 64, 13, 0, gl.RGBA, gl.UNSIGNED_BYTE, det);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    // caustics: 24 frames
    const cau = new Uint8Array(64 * 64 * 24 * 4); for (let i = 0; i < 64 * 64 * 24; i++) { const v = M.clamp(Math.round(X.CAU[i] * 255), 0, 255); cau[i * 4] = v; cau[i * 4 + 3] = 255; }
    tex.cau = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex.cau);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 64, 64, 24, 0, gl.RGBA, gl.UNSIGNED_BYTE, cau);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    // palette LUT atlas: 7 tables of 32^3 laid out 1024 x 32 each (x = g*32 + b, y = r)
    tex.lut = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex.lut);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1024, 32 * 7, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    G.lutSlots = [];
  }
  function setLut(slot, lut) {
    if (G.lutSlots[slot] === lut) return; G.lutSlots[slot] = lut;
    gl.bindTexture(gl.TEXTURE_2D, tex.lut);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, slot * 32, 1024, 32, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(lut.buffer, lut.byteOffset, lut.byteLength));
  }
  function ensureTargets() {
    if (W === B.W && H === B.H && fbo.scene) return;
    W = B.W; H = B.H; cv.width = W; cv.height = H;
    const mk = (depth) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      let dt = null;
      if (depth) { dt = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, dt); gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, W, H, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dt, 0); }
      return { f, t, dt };
    };
    fbo.scene = mk(true); fbo.out = mk(false);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ------------------------------------------------------------------ terrain chunks
  const CH = 32, LODS = [1, 2, 4];
  let terr = null;
  function mapTexture(m) {
    const n = m.n, d = new Uint8Array(n * n * 4);
    for (let i = 0; i < n * n; i++) { d[i * 4] = m.mat[i]; d[i * 4 + 1] = m.jit[i]; d[i * 4 + 2] = m.ao[i]; d[i * 4 + 3] = 255; }
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function chunkMesh(m, ci, cj, lod) {
    const n = m.n, s = LODS[lod], q = CH / s, verts = (q + 1) * (q + 1), cell = m.cell;
    const v = new Float32Array((verts + (q + 1) * 4) * 5), idx = [];
    let k = 0;
    const put = (i, j, drop) => {
      const ii = Math.min(n - 1, i), jj = Math.min(n - 1, j), c = jj * n + ii;
      v[k++] = (i + 0.5) * cell; v[k++] = (j + 0.5) * cell; v[k++] = m.h[c] + (drop || 0); v[k++] = m.nx[c]; v[k++] = m.ny[c];
    };
    for (let j = 0; j <= q; j++) for (let i = 0; i <= q; i++) put(ci * CH + i * s, cj * CH + j * s);
    for (let j = 0; j < q; j++) for (let i = 0; i < q; i++) { const a = j * (q + 1) + i, b = a + q + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    // skirts hang below each edge to hide the seams between detail levels
    const edge = (list) => { const base = k / 5; for (const [i, j] of list) put(ci * CH + i * s, cj * CH + j * s, 6); return base; };
    const sides = [[], [], [], []];
    for (let t = 0; t <= q; t++) { sides[0].push([t, 0]); sides[1].push([t, q]); sides[2].push([0, t]); sides[3].push([q, t]); }
    sides.forEach((side, si) => {
      const base = edge(side);
      for (let t = 0; t < q; t++) {
        const [i0, j0] = side[t], [i1, j1] = side[t + 1], a = j0 * (q + 1) + i0, b = j1 * (q + 1) + i1;
        idx.push(a, base + t, b, b, base + t, base + t + 1);
      }
    });
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = buffer(v); attrib(P.terrain, 'aPos', 3, 5, 0); attrib(P.terrain, 'aN', 2, 5, 3);
    const ib = buffer(new Uint16Array(idx), gl.ELEMENT_ARRAY_BUFFER);
    gl.bindVertexArray(null);
    return { vao, n: idx.length, vb, ib };
  }
  function terrainFor(m) {
    if (terr && terr.map === m) return terr;
    if (terr) { for (const c of terr.chunks.values()) { gl.deleteVertexArray(c.vao); gl.deleteBuffer(c.vb); gl.deleteBuffer(c.ib); } gl.deleteTexture(terr.tex); }
    terr = { map: m, tex: mapTexture(m), chunks: new Map(), nc: Math.ceil(m.n / CH) };
    return terr;
  }

  // ------------------------------------------------------------------ matrices
  function perspective(fovy, aspect, near, far) { const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far); return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]; }
  function lookAt(e, t, up) {
    let zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2]; let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx; l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
  }
  function mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
  // World point -> internal-resolution pixel coordinates (top-down), or null behind the camera.
  G.project = function (x, y, z) {
    const m = cam.vp, cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw < 0.05) return null;
    return [(cx / cw * 0.5 + 0.5) * B.W, (0.5 - cy / cw * 0.5) * B.H, cw];
  };

  // ------------------------------------------------------------------ camera
  // A chase camera: yaw and pitch from the mouse, a stick or a thumb, distance pulled in by rock.
  G.look = function (dx, dy) { cam.yaw += dx; cam.pitch = M.clamp(cam.pitch + dy, -1.2, 1.35); };
  G.turnMode = () => !document.pointerLockElement && !I.touchMode && !I.usingPad;
  G.updateCamera = function (dt, mode) {
    const Pl = B.player, sc = B.scene;
    if (mode.title) {
      const f = B.map.features, a = B.time * 0.05;
      cam.tx = f.AX; cam.ty = f.AY; cam.tz = 4186; cam.x = f.AX + Math.cos(a) * 16; cam.y = f.AY + Math.sin(a) * 16; cam.z = 4172;
    } else if (sc && sc.cam) {
      cam.x = sc.cam.x; cam.y = sc.cam.y; cam.z = sc.cam.z; cam.tx = Pl.x; cam.ty = Pl.y; cam.tz = Pl.z - 0.6;
    } else if (Pl) {
      // keyboard turning when the mouse isn't captured
      if (G.turnMode() && B.mode === 'play' && !B.Story.locked && !B.Hud.capture()) cam.yaw += ((I.state.right ? 1 : 0) - (I.state.left ? 1 : 0)) * 1.9 * dt;
      if (I.usingPad && I.pad) { const rx = I.pad.axes[2] || 0, ry = I.pad.axes[3] || 0; if (Math.abs(rx) > 0.15) cam.yaw += rx * 2.4 * dt; if (Math.abs(ry) > 0.15) cam.pitch = M.clamp(cam.pitch + ry * 1.6 * dt, -1.2, 1.35); }
      const deck = B.act === 'deck', dist = deck ? 5.5 : cam.dist;
      const tx = Pl.x, ty = Pl.y, tz = Pl.z - (deck ? 1.2 : 0.7);
      const k = Math.min(1, dt * 10);
      cam.tx += (tx - cam.tx) * k; cam.ty += (ty - cam.ty) * k; cam.tz += (tz - cam.tz) * k;
      if (B.snapCamera || !isFinite(cam.tx)) { cam.tx = tx; cam.ty = ty; cam.tz = tz; }
      const cp = Math.cos(cam.pitch), dx = -Math.cos(cam.yaw) * cp, dy = -Math.sin(cam.yaw) * cp, dz = -Math.sin(cam.pitch);
      // pull in where the line from the diver to the camera meets rock
      let d = dist; const m = B.map;
      for (let t = 0.4; t <= dist; t += 0.25) { const x = cam.tx + dx * t, y = cam.ty + dy * t, z = cam.tz + dz * t; if (B.World.H(m, x, y) < z + 0.35) { d = Math.max(0.6, t - 0.4); break; } }
      cam.dcur = cam.dcur === undefined || B.snapCamera ? d : d < cam.dcur ? d : cam.dcur + (d - cam.dcur) * Math.min(1, dt * 3);
      cam.x = cam.tx + dx * cam.dcur; cam.y = cam.ty + dy * cam.dcur; cam.z = cam.tz + dz * cam.dcur;
      // over the right shoulder, so she doesn't stand in front of what you're looking at
      const sh = Math.min(1, cam.dcur / dist) * (deck ? 0.6 : 0.9), rx = -Math.sin(cam.yaw), ry = Math.cos(cam.yaw);
      cam.vx = cam.tx + rx * sh; cam.vy = cam.ty + ry * sh; cam.vz = cam.tz - 0.25;
      cam.x += rx * sh; cam.y += ry * sh;
      if (mode.shake) { cam.x += mode.shake[0]; cam.y += mode.shake[1]; }
    }
    const lx = cam.vx !== undefined && Pl && !mode.title && !(sc && sc.cam) ? cam.vx : cam.tx, ly = cam.vx !== undefined && Pl && !mode.title && !(sc && sc.cam) ? cam.vy : cam.ty, lz = cam.vx !== undefined && Pl && !mode.title && !(sc && sc.cam) ? cam.vz : cam.tz;
    const view = lookAt([cam.x, cam.y, cam.z], [lx, ly, lz], [0, 0, -1]);
    const proj = perspective(cam.fov * Math.PI / 180, B.W / B.H, 0.08, 260);
    cam.vp = mul(proj, view);
    const fx = lx - cam.x, fy = ly - cam.y, fz = lz - cam.z, fl = Math.hypot(fx, fy, fz) || 1;
    cam.fwd = [fx / fl, fy / fl, fz / fl]; cam.right = [view[0], view[4], view[8]]; cam.up = [view[1], view[5], view[9]];
    // keep the classic camera fields meaningful for code that windows by depth
    R.cam.z = Pl && !mode.title ? Pl.z : cam.tz; R.cam.zCut = R.cam.z - 2.5; R.cam.ox = cam.yaw * 400; R.cam.oy = cam.tz * 8;
  };
  // Screen-relative stick input -> world thrust direction, relative to the camera.
  G.moveToWorld = function (mv) {
    const fx = Math.cos(cam.yaw), fy = Math.sin(cam.yaw), rx = -fy, ry = fx, side = G.turnMode() ? 0 : mv.x;
    return { x: fx * -mv.y + rx * side, y: fy * -mv.y + ry * side };
  };

  // ------------------------------------------------------------------ drawing API (the 3D twins of R.*)
  let diverColor = null;
  const sampleN = [[0.3, 0.2, 0.9], [-0.5, 0.4, 0.7], [0.7, -0.6, 0.3], [-0.2, -0.8, 0.5], [0.9, 0.1, -0.4], [-0.7, -0.3, -0.6], [0.1, 0.9, -0.4], [-0.4, 0.5, 0.75]];
  // per-pixel shading callbacks can't run on the GPU: use their average over a few sample points
  function avgFn(fn, p) {
    if (p._avg !== undefined) return p._avg;
    let s = 0; for (const n of sampleN) { try { s += +fn(n[0], n[1], n[2], n[0] * 0.5, n[1] * 0.5, n[2]) || 0; } catch (e) { s += 1; } }
    return (p._avg = s / sampleN.length);
  }
  function lutFor(o) { return o.lut || 0; }
  G.model = function (ox, oy, oz, prims, o) {
    o = o || {};
    if (o.wire) return G.wire(ox, oy, oz, prims, o.wireCol, 1);
    const lut = lutFor(o), alpha = o.alpha === undefined ? 1 : o.alpha, minL = o.minLight || 0, dim = o.dim === undefined ? 1 : o.dim, dead = o.dead ? 1 : 0, emS = o.em === undefined ? 1 : o.em;
    for (let k = 0; k < prims.length; k++) {
      const p = prims[k];
      let c = p.c; if (p.di !== undefined && diverColor) c = diverColor(p.di);
      let tk = 1; if (p.tex) tk = avgFn(p.tex, p);
      let e = p.e, ek = 1; if (e && p.emFn) { ek = p._emAvg !== undefined ? p._emAvg : (p._emAvg = (() => { let s = 0; for (const n of sampleN) { try { s += +p.emFn(n[0], n[1], n[2], n[0] * 0.5, n[1] * 0.5, n[2]) || 0; } catch (er) { s += 0.5; } } return s / sampleN.length; })()); }
      const m = (p.m || 0);
      if (p.t === 'c') {
        if (cN >= MAXI) continue; const b = cN++ * 21;
        cI[b] = ox + p.a[0]; cI[b + 1] = oy + p.a[1]; cI[b + 2] = oz + p.a[2]; cI[b + 3] = ox + p.b[0]; cI[b + 4] = oy + p.b[1]; cI[b + 5] = oz + p.b[2]; cI[b + 6] = p.r;
        cI[b + 7] = c[0] * tk; cI[b + 8] = c[1] * tk; cI[b + 9] = c[2] * tk;
        cI[b + 10] = e ? e[0] * ek : 0; cI[b + 11] = e ? e[1] * ek : 0; cI[b + 12] = e ? e[2] * ek : 0;
        cI[b + 13] = m; cI[b + 14] = lut; cI[b + 15] = alpha; cI[b + 16] = minL; cI[b + 17] = dim; cI[b + 18] = dead; cI[b + 19] = emS; cI[b + 20] = 0;
        continue;
      }
      const box = p.t === 'b', arr = box ? bI : sI; let b;
      if (box) { if (bN >= MAXI) continue; b = bN++ * 29; } else { if (sN >= MAXI) continue; b = sN++ * 29; }
      arr[b] = ox + p.x; arr[b + 1] = oy + p.y; arr[b + 2] = oz + p.z;
      if (p.t === 's') { arr[b + 3] = p.r; arr[b + 4] = 0; arr[b + 5] = 0; arr[b + 6] = 0; arr[b + 7] = p.r; arr[b + 8] = 0; arr[b + 9] = 0; arr[b + 10] = 0; arr[b + 11] = p.r; }
      else { const rr = box ? p.h : p.rad, ax = p.ax; for (let a = 0; a < 3; a++) { arr[b + 3 + a * 3] = ax[a][0] * rr[a]; arr[b + 4 + a * 3] = ax[a][1] * rr[a]; arr[b + 5 + a * 3] = ax[a][2] * rr[a]; } }
      arr[b + 12] = c[0] * tk; arr[b + 13] = c[1] * tk; arr[b + 14] = c[2] * tk;
      arr[b + 15] = e ? e[0] * ek : 0; arr[b + 16] = e ? e[1] * ek : 0; arr[b + 17] = e ? e[2] * ek : 0;
      arr[b + 18] = m; arr[b + 19] = lut; arr[b + 20] = alpha; arr[b + 21] = minL; arr[b + 22] = dim; arr[b + 23] = dead; arr[b + 24] = emS; arr[b + 25] = 0;
    }
    return { ok: true };
  };
  G.wire = function (ox, oy, oz, prims, col) {
    if (col !== undefined) { wCol = [(col & 255) / 255, ((col >> 8) & 255) / 255, ((col >> 16) & 255) / 255]; }
    for (const p of prims) {
      if (p.t === 'c') { if (wcN >= 1024) continue; const b = wcN++ * 21; wC[b] = ox + p.a[0]; wC[b + 1] = oy + p.a[1]; wC[b + 2] = oz + p.a[2]; wC[b + 3] = ox + p.b[0]; wC[b + 4] = oy + p.b[1]; wC[b + 5] = oz + p.b[2]; wC[b + 6] = p.r; continue; }
      const box = p.t === 'b', arr = box ? wB : wS; let b;
      if (box) { if (wbN >= 1024) continue; b = wbN++ * 29; } else { if (wsN >= 1024) continue; b = wsN++ * 29; }
      arr[b] = ox + p.x; arr[b + 1] = oy + p.y; arr[b + 2] = oz + p.z;
      if (p.t === 's') { arr[b + 3] = p.r; arr[b + 4] = 0; arr[b + 5] = 0; arr[b + 6] = 0; arr[b + 7] = p.r; arr[b + 8] = 0; arr[b + 9] = 0; arr[b + 10] = 0; arr[b + 11] = p.r; }
      else { const rr = box ? p.h : p.rad, ax = p.ax; for (let a = 0; a < 3; a++) { arr[b + 3 + a * 3] = ax[a][0] * rr[a]; arr[b + 4 + a * 3] = ax[a][1] * rr[a]; arr[b + 5 + a * 3] = ax[a][2] * rr[a]; } }
    }
  };
  function pushPt(arr, n, x, y, z, r, g, b, mode, size, alpha) {
    const o = n * 10; arr[o] = x; arr[o + 1] = y; arr[o + 2] = z; arr[o + 3] = r; arr[o + 4] = g; arr[o + 5] = b; arr[o + 6] = mode; arr[o + 7] = size; arr[o + 8] = alpha; arr[o + 9] = 0;
  }
  G.point = function (x, y, z, size, r, g, b, emissive, alpha) {
    const mode = emissive === 3 ? 3 : emissive === 2 ? 2 : emissive ? 1 : 0, a = alpha === undefined ? 1 : alpha;
    if (mode >= 2) { if (paN < 60000) pushPt(PA, paN++, x, y, z, r, g, b, mode, size || 1, a); }
    else if (ptN < 60000) pushPt(PT, ptN++, x, y, z, r, g, b, mode, size || 1, a);
  };
  G.line = function (x1, y1, z1, x2, y2, z2, r, g, b, emissive, alpha) {
    const mode = emissive === 3 ? 3 : emissive === 2 ? 2 : emissive ? 1 : 0, a = alpha === undefined ? 1 : alpha;
    if (mode >= 2) { if (laN < 19998) { pushPt(LA, laN++, x1, y1, z1, r, g, b, mode, 1, a); pushPt(LA, laN++, x2, y2, z2, r, g, b, mode, 1, a); } }
    else if (lnN < 19998) { pushPt(LN, lnN++, x1, y1, z1, r, g, b, mode, 1, a); pushPt(LN, lnN++, x2, y2, z2, r, g, b, mode, 1, a); }
  };
  G.lineL = function (ox, oy, oz, p, q, r, g, b, emissive) { G.line(ox + p[0], oy + p[1], oz + p[2], ox + q[0], oy + q[1], oz + q[2], r, g, b, emissive); };
  function pushQuad(cx, cy, cz, ux, uy, uz, vx, vy, vz, r, g, b, mode, density) {
    if (dqN >= 5994) return;
    const C = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
    for (const [s, t] of C) { const o = dqN++ * 12; DQ[o] = cx + ux * s + vx * t; DQ[o + 1] = cy + uy * s + vy * t; DQ[o + 2] = cz + uz * s + vz * t; DQ[o + 3] = r; DQ[o + 4] = g; DQ[o + 5] = b; DQ[o + 6] = mode; DQ[o + 7] = 0; DQ[o + 8] = density; DQ[o + 9] = 0; DQ[o + 10] = s; DQ[o + 11] = t; }
  }
  G.disc = function (x, y, z, rad, r, g, b, density, emissive, flat) {
    const mode = emissive ? 1 : 0;
    if (flat) pushQuad(x, y, z, rad, 0, 0, 0, rad, 0, r, g, b, mode, density);
    else { const R1 = cam.right, U = cam.up; pushQuad(x, y, z, R1[0] * rad, R1[1] * rad, R1[2] * rad, U[0] * rad, U[1] * rad, U[2] * rad, r, g, b, mode, density); }
  };
  G.shadow = function (x, y, z, rad, density) { pushQuad(x, y, z - 0.04, rad, 0, 0, 0, rad, 0, 0, 0, 0, 4, density); };
  G.terrain = function () {};          // drawn in render(); kept so the classic call is harmless
  G.beam = function () {};
  G.begin = function () { R._swapLights(); sN = bN = cN = wsN = wbN = wcN = ptN = paN = lnN = laN = dqN = 0; G.beamSpec = null; };
  G.quantize = function () {};
  G.flushWires = function () {};

  // ------------------------------------------------------------------ the frame
  function setLightUniforms(pr) {
    const u = pr.u, E = R.env, L = E.lamp;
    gl.uniformMatrix4fv(u.uVP, false, cam.vp);
    gl.uniform3f(u.uEye, E.eye.x, E.eye.y, E.eye.z); if (u.uCam) gl.uniform3f(u.uCam, cam.x, cam.y, cam.z); gl.uniform1f(u.uFogMul, E.fogMul); gl.uniform1i(u.uFog, E.fog ? 1 : 0);
    gl.uniform1i(u.uTopside, E.topside ? 1 : 0); gl.uniform3f(u.uTop, E.topR, E.topG, E.topB);
    gl.uniform1f(u.uSunScale, E.sunScale); gl.uniform1f(u.uCaustic, E.caustic); gl.uniform1f(u.uAmbient, E.ambient); gl.uniform1f(u.uCauLayer, ((B.time * 8) | 0) % 24); gl.uniform1f(u.uTime, B.time);
    gl.uniform1i(u.uLampOn, L.on ? 1 : 0); gl.uniform3f(u.uLampPos, L.x, L.y, L.z); gl.uniform3f(u.uLampDir, L.dx, L.dy, L.dz); gl.uniform3f(u.uLampCol, L.cr, L.cg, L.cb); gl.uniform4f(u.uLampP, L.cosO, L.cosI, L.r2, L.i);
    const lights = E.lights || [], lp = new Float32Array(128), lc = new Float32Array(128); let n = 0;
    for (const l of lights) { if (n >= 32) break; if (Math.hypot(l.x - cam.x, l.y - cam.y, l.z - cam.z) > 140 + l.range) continue; lp.set([l.x, l.y, l.z, l.range], n * 4); lc.set([l.r, l.g, l.b, l.i], n * 4); n++; }
    gl.uniform1i(u.uNL, n); if (u.uLP) gl.uniform4fv(u.uLP, lp); if (u.uLC) gl.uniform4fv(u.uLC, lc);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex.cau); gl.uniform1i(u.uCau, 1);
  }
  function drawTerrain(m) {
    const T = terrainFor(m), pr = P.terrain; gl.useProgram(pr.p); setLightUniforms(pr);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.tex); gl.uniform1i(pr.u.uMap, 0);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex.det); gl.uniform1i(pr.u.uDet, 2);
    gl.uniform1f(pr.u.uCell, m.cell); gl.uniform1f(pr.u.uSize, m.size); gl.uniform1i(pr.u.uSea, m.topside ? 1 : 0);
    gl.uniform3fv(pr.u.uAlb, new Float32Array([].concat(...B.MAT_ALB)));
    const span = CH * m.cell, far = 150, fx = cam.fwd[0], fy = cam.fwd[1], fl = Math.hypot(fx, fy) || 1;
    for (let cj = 0; cj < T.nc; cj++) for (let ci = 0; ci < T.nc; ci++) {
      const cx = (ci + 0.5) * span, cy = (cj + 0.5) * span, dx = cx - cam.x, dy = cy - cam.y, dxy = Math.hypot(dx, dy) - span * 0.71;
      // the floor block's own depth range limits what can be seen of it from here
      const bz = blockDepth(m, ci, cj), dz = cam.z < bz[0] ? bz[0] - cam.z : cam.z > bz[1] ? cam.z - bz[1] : 0;
      const d = Math.hypot(Math.max(0, dxy), dz); if (d > far) continue;
      if (dxy > 8 && (dx * fx + dy * fy) / fl < -span * 0.8 && Math.abs(cam.fwd[2]) < 0.85) continue; // behind
      const lod = d < 34 ? 0 : d < 75 ? 1 : 2, key = (cj * T.nc + ci) * 4 + lod;
      let c = T.chunks.get(key); if (!c) { c = chunkMesh(m, ci, cj, lod); T.chunks.set(key, c); }
      gl.bindVertexArray(c.vao); gl.drawElements(gl.TRIANGLES, c.n, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
  }
  function blockDepth(m, ci, cj) {
    const key = '_bz' + ci + '_' + cj; if (m[key]) return m[key];
    let lo = 1e9, hi = -1e9; const n = m.n;
    for (let j = cj * CH; j <= Math.min(n - 1, cj * CH + CH); j += 2) for (let i = ci * CH; i <= Math.min(n - 1, ci * CH + CH); i += 2) { const h = m.h[j * n + i]; if (h < lo) lo = h; if (h > hi) hi = h; }
    return (m[key] = [lo, hi]);
  }
  function drawInstances(pr, vao, mesh, buf, data, count, stride, lines) {
    if (!count) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * stride), gl.STREAM_DRAW);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lines ? mesh.lbo : mesh.ibo);
    gl.drawElementsInstanced(lines ? gl.LINES : gl.TRIANGLES, lines ? mesh.edges.length : mesh.idx.length, gl.UNSIGNED_SHORT, 0, count);
    gl.bindVertexArray(null);
  }
  function drawDyn(vao, buf, data, count, prim, pr) {
    if (!count) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * (pr === P.disc ? 12 : 10)), gl.STREAM_DRAW);
    gl.bindVertexArray(vao); gl.drawArrays(prim, 0, count); gl.bindVertexArray(null);
  }
  // marine snow: a box of drifting motes kept round the camera, lit like everything else
  const SNOWN = 900, snow = new Float32Array(SNOWN * 3); let snowInit = false;
  function snowTick(dt) {
    const S = 26, Pl = B.player, deck = B.act === 'deck';
    if (!snowInit) { for (let k = 0; k < SNOWN; k++) { snow[k * 3] = cam.x + M.rnd(-S, S); snow[k * 3 + 1] = cam.y + M.rnd(-S, S); snow[k * 3 + 2] = cam.z + M.rnd(-S, S); } snowInit = true; }
    const sink = Pl ? Math.max(-3, Math.min(6, Pl.vz || 0)) : 0, shear = B.Z && B.Z.wave ? B.Z.wave.shear : 0;
    for (let k = 0; k < SNOWN; k++) {
      const o = k * 3;
      if (deck) { snow[o] += dt * 7; snow[o + 1] += dt * 3; snow[o + 2] += dt * 14; } // rain, driven across the deck
      else { snow[o + 2] += dt * (0.25 + (k & 7) * 0.03); snow[o] += Math.sin(B.time * 0.4 + k) * dt * 0.08 + shear * dt * 2; }
      for (let a = 0; a < 3; a++) { const c = a === 0 ? cam.x : a === 1 ? cam.y : cam.z; if (snow[o + a] < c - S) snow[o + a] += 2 * S; else if (snow[o + a] > c + S) snow[o + a] -= 2 * S; }
      if (deck) { const x = snow[o], y = snow[o + 1], z = snow[o + 2]; G.line(x, y, z, x - 0.25, y - 0.1, z - 0.5, 0.25, 0.27, 0.3, false, 0.8); }
      else G.point(snow[o], snow[o + 1], snow[o + 2], k % 13 === 0 ? 2 : 1, 0.7, 0.75, 0.8, false);
    }
    void sink;
  }
  G.render = function (opts) {
    if (!G.ok) return false;
    ensureTargets();
    diverColor = R._diverColor;
    if (opts.snow) snowTick(opts.dt || 1 / 60);
    // scene pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.scene.f); gl.viewport(0, 0, W, H);
    const E = R.env, wc = E.topside ? [0.02, 0.025, 0.04] : waterColor(E.eye.z);
    const enc = c => Math.sqrt(M.clamp(c / 1.5, 0, 1));
    gl.clearColor(enc(wc[0]), enc(wc[1]), enc(wc[2]), 4 / 255); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    if (opts.terrain !== false) drawTerrain(B.map);
    gl.useProgram(P.model.p); setLightUniforms(P.model);
    drawInstances(P.model, vaos.sphere, meshes.sphere, G.bufS, sI, sN, 29); drawInstances(P.model, vaos.cube, meshes.cube, G.bufB, bI, bN, 29);
    gl.useProgram(P.capsule.p); setLightUniforms(P.capsule);
    drawInstances(P.capsule, vaos.capsule, meshes.capsule, G.bufC, cI, cN, 21);
    gl.useProgram(P.part.p); setLightUniforms(P.part); gl.uniform1f(P.part.u.uPx, Math.max(1, H / 270));
    drawDyn(vaos.pt, G.bufPT, PT, ptN, gl.POINTS, P.part); drawDyn(vaos.ln, G.bufLN, LN, lnN, gl.LINES, P.part);
    gl.useProgram(P.disc.p); setLightUniforms(P.disc); drawDyn(vaos.dq, G.bufDQ, DQ, dqN, gl.TRIANGLES, P.disc);
    // additive: glowing points and lines, then the lamp cone
    gl.enable(gl.BLEND); gl.blendEquationSeparate(gl.FUNC_ADD, gl.MAX); gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE); gl.depthMask(false);
    gl.useProgram(P.part.p); drawDyn(vaos.pt, G.bufPT, PA, paN, gl.POINTS, P.part); drawDyn(vaos.ln, G.bufLN, LA, laN, gl.LINES, P.part);
    if (opts.beam) drawBeam(opts.beam);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD);
    // quantise into the output target
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.out.f); gl.viewport(0, 0, W, H); gl.disable(gl.DEPTH_TEST);
    const pq = P.quant; gl.useProgram(pq.p);
    setLut(0, opts.lut); setLut(1, B.diverLUT(opts.fid)); setLut(2, B.lut('d71')); setLut(3, B.lut('d94')); setLut(4, B.lut('dmara')); setLut(5, B.lut('eye')); setLut(6, B.lut('top'));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbo.scene.t); gl.uniform1i(pq.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex.lut); gl.uniform1i(pq.u.uLut, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, fbo.scene.dt); gl.uniform1i(pq.u.uDepth, 2); gl.uniform1f(pq.u.uOutline, opts.outline === false ? 0 : 1);
    gl.uniform1f(pq.u.uSpread, opts.spread); gl.uniform1i(pq.u.uMono, opts.mono ? 1 : 0); gl.uniform2f(pq.u.uRes, W, H);
    gl.uniform3f(pq.u.uLens, opts.lens ? opts.lens.x : 0, opts.lens ? opts.lens.y : 0, opts.lens ? opts.lens.r : 0);
    gl.uniform1fv(pq.u.uScale, new Float32Array([1, opts.diverScale || 1, 3, 2, 1, 1]));
    gl.bindVertexArray(vaos.quad); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    const ql = gl.getAttribLocation(pq.p, 'aP'); gl.enableVertexAttribArray(ql); gl.vertexAttribPointer(ql, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(ql, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.bindVertexArray(null);
    // sonar wireframes, exact colour, through everything
    if (wsN || wbN || wcN) {
      const pf = P.flat; gl.useProgram(pf.p); gl.uniformMatrix4fv(pf.u.uVP, false, cam.vp); gl.uniform3f(pf.u.uCol, wCol[0], wCol[1], wCol[2]);
      gl.uniform1i(pf.u.uCap, 0); drawInstances(pf, vaos.wSphere, meshes.sphere, G.bufWS, wS, wsN, 29, true); drawInstances(pf, vaos.wCube, meshes.cube, G.bufWB, wB, wbN, 29, true);
      gl.uniform1i(pf.u.uCap, 1); drawInstances(pf, vaos.wCapsule, meshes.capsule, G.bufWC, wC, wcN, 21, true);
    }
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(R.out32.buffer, R.out32.byteOffset, W * H * 4));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  };
  function waterColor(z) { const w = R.waterAt(z); return [w[0], w[1], w[2]]; }
  function drawBeam(bm) {
    const pb = P.beam, L = R.env.lamp; gl.useProgram(pb.p); gl.uniformMatrix4fv(pb.u.uVP, false, cam.vp);
    const d = [L.dx, L.dy, L.dz], t = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    let u = [t[1] * d[2] - t[2] * d[1], t[2] * d[0] - t[0] * d[2], t[0] * d[1] - t[1] * d[0]]; const ul = Math.hypot(...u) || 1; u = u.map(v => v / ul);
    const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    gl.uniform3f(pb.u.uO, L.x, L.y, L.z); gl.uniform3fv(pb.u.uD, d); gl.uniform3fv(pb.u.uU, u); gl.uniform3fv(pb.u.uV, v);
    gl.uniform1f(pb.u.uLen, bm.len); gl.uniform1f(pb.u.uRad, Math.tan(Math.acos(M.clamp(L.cosO, -1, 1)))); gl.uniform3fv(pb.u.uCol, bm.col); gl.uniform1f(pb.u.uK, bm.k); gl.uniform1f(pb.u.uTime, B.time);
    gl.bindVertexArray(vaos.cone); gl.drawElements(gl.TRIANGLES, meshes.cone.idx.length, gl.UNSIGNED_SHORT, 0); gl.bindVertexArray(null);
  }

  // ------------------------------------------------------------------ switching views
  const KEYS = ['model', 'point', 'line', 'lineL', 'disc', 'shadow', 'wire', 'flushWires', 'terrain', 'begin', 'quantize', 'beam'], classic = {};
  G.enable = function (on) {
    if (on && !G.ok) on = false;
    if (on === G.on) return;
    for (const k of KEYS) { if (!classic[k]) classic[k] = R[k]; R[k] = on ? G[k] : classic[k]; }
    G.on = on; B.view3d = on;
    if (!on && document.pointerLockElement) document.exitPointerLock();
  };
})(window.B);
