// Facade shader for building chunks and their debris fragments.
// Every chunk is an instanced unit box. Its instance attributes carry the building's
// dimensions and style plus where the chunk sits inside the building, so the shader can
// compute continuous facade coordinates (bays and floors) in building space. Chunk seams
// are therefore invisible on an intact tower, and a fragment that flies off keeps the
// exact piece of facade it came from. Faces that were inside the building (or cut by the
// fracture) render as exposed floor slabs, columns and dark gutted interiors.
import * as THREE from 'three';
import { patch, NOISE_GLSL, G } from '../render/Shading.js';

export const INSTANCE_ATTRS = [
  ['aCenter', 3], ['aSize', 3], ['aDims', 3], ['aStyle', 4], ['aState', 4], ['aTint', 3],
];

const VERT_PARS = /* glsl */`
attribute vec3 aCenter; attribute vec3 aSize; attribute vec3 aDims;
attribute vec4 aStyle; attribute vec4 aState; attribute vec3 aTint;
#ifdef KJ_FRAG
attribute float aCut;
#endif
varying vec3 vRest; varying vec3 vONrm; flat varying vec3 vDimsB; flat varying vec4 vStyleB; flat varying vec4 vStateB;
flat varying vec3 vTintB; flat varying float vCutB; varying vec3 vTanV; varying vec3 vBitV;
`;

const VERT_MAIN = /* glsl */`
vRest = aCenter + position * aSize;
vONrm = normal;
vDimsB = aDims; vStyleB = aStyle; vStateB = aState; vTintB = aTint;
#ifdef KJ_FRAG
vCutB = aCut;
#else
vCutB = 0.0;
#endif
{
  // tangent follows the facade u axis, bitangent follows the floors (world up)
  bool top = abs(normal.y) > 0.7;
  vec3 tO = abs(normal.x) > 0.5 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 bO = top ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 tW = tO, bW = bO;
  #ifdef USE_INSTANCING
  tW = mat3(instanceMatrix) * tO; bW = mat3(instanceMatrix) * bO;
  #endif
  vTanV = normalize((modelViewMatrix * vec4(tW, 0.0)).xyz);
  vBitV = normalize((modelViewMatrix * vec4(bW, 0.0)).xyz);
}
`;

const FRAG_PARS = /* glsl */`
varying vec3 vRest; varying vec3 vONrm; flat varying vec3 vDimsB; flat varying vec4 vStyleB; flat varying vec4 vStateB;
flat varying vec3 vTintB; flat varying float vCutB; varying vec3 vTanV; varying vec3 vBitV;
${NOISE_GLSL}
// screen-space derivatives of the rest position, taken once in uniform control flow
vec3 gDRx, gDRy;
vec3 kjDbg;
float kjBand(float x, float a, float b, float w) { return smoothstep(a - w, a + w, x) - smoothstep(b - w, b + w, x); }
float kjBox(vec2 p, vec4 r, vec2 w) { return kjBand(p.x, r.x, r.y, w.x) * kjBand(p.y, r.z, r.w, w.y); }
struct Fac { vec3 alb; float rough; float metal; vec3 emit; vec2 tn; float glass; };

// interior mapping: a room one bay wide and one floor tall behind the glass
vec3 kjRoom(vec2 cell, vec3 vt, float seed, float lit, out float depthShade) {
  vec3 ro = vec3(cell, 0.0);
  vec3 rd = normalize(vec3(-vt.x, -vt.y, max(vt.z, 0.05)));
  rd.x = rd.x >= 0.0 ? max(rd.x, 1e-4) : min(rd.x, -1e-4);
  rd.y = rd.y >= 0.0 ? max(rd.y, 1e-4) : min(rd.y, -1e-4);
  float depth = 0.9 + seed * 0.8;
  float tx = rd.x > 0.0 ? (1.0 - ro.x) / rd.x : -ro.x / rd.x;
  float ty = rd.y > 0.0 ? (1.0 - ro.y) / rd.y : -ro.y / rd.y;
  float tz = depth / rd.z;
  float t = min(min(tx, ty), tz);
  vec3 hp = ro + rd * t;
  vec3 wall = mix(vec3(0.55, 0.52, 0.47), vec3(0.42, 0.45, 0.5), fract(seed * 7.13));
  vec3 c;
  if (t == tz) {
    c = wall * 0.85;
    float furn = step(hp.y, 0.38 + 0.2 * fract(seed * 3.7)) * step(0.15 + 0.3 * fract(seed * 5.1), hp.x) * step(hp.x, 0.55 + 0.4 * fract(seed * 2.3));
    c = mix(c, vec3(0.16, 0.13, 0.11), furn);
  } else if (t == ty) {
    c = rd.y < 0.0 ? mix(vec3(0.17, 0.15, 0.13), vec3(0.3, 0.27, 0.22), fract(seed * 11.0)) : vec3(0.72, 0.72, 0.7);
    if (rd.y > 0.0) c += lit * 2.5 * vec3(1.0, 0.9, 0.75) * (1.0 - smoothstep(0.08, 0.2, abs(hp.x - 0.5))) * (1.0 - smoothstep(0.1, 0.3, abs(hp.z - depth * 0.5) / depth));
  } else {
    c = wall;
  }
  depthShade = 1.0 - 0.55 * clamp(hp.z / depth, 0.0, 1.0);
  return c;
}

Fac kjFacade(vec3 rest, vec3 on, vec3 vt, vec3 dims, vec4 st, vec4 state, vec3 tint) {
  Fac f; f.alb = vec3(0.5); f.rough = 0.8; f.metal = 0.0; f.emit = vec3(0.0); f.tn = vec2(0.0); f.glass = 0.0;
  float style = st.x, seed = st.y, floorH = st.z, bayW = st.w;
  bool sideX = abs(on.x) > 0.5;
  float fwid = sideX ? dims.z : dims.x;
  float nb = max(1.0, floor(fwid / bayW + 0.5));
  float bw = fwid / nb;
  float um = sideX ? rest.z : rest.x;
  float u = um / bw, v = rest.y / floorH;
  vec2 cellId = vec2(floor(u), floor(v));
  vec2 c = vec2(fract(u), fract(v));
  vec2 w = max(vec2((abs(sideX ? gDRx.z : gDRx.x) + abs(sideX ? gDRy.z : gDRy.x)) / bw,
                    (abs(gDRx.y) + abs(gDRy.y)) / floorH) * 0.75, vec2(1e-4));
  float lod = smoothstep(0.18, 0.45, max(w.x, w.y));
  float fi = cellId.y;
  float topFloor = floor(dims.y / floorH + 0.5) - 1.0;
  float rnd = kjH12(cellId + seed * 97.0 + (sideX ? 13.0 : 0.0));
  float n1 = kjF2(vec2(um * 0.35, rest.y * 0.06) + seed * 50.0);
  // ---------------------------------------------------- per style: wall material and window rectangle
  vec3 wall; float wrough = 0.85; float wmetal = 0.0; vec4 win = vec4(0.18, 0.82, 0.3, 0.84);
  vec3 glassTint = vec3(0.11, 0.12, 0.13); float gmetal = 0.65; float grough = 0.06;
  bool curtain = false;
  if (style < 0.5) {            // GLASS curtain wall
    curtain = true; win = vec4(0.035, 0.965, 0.14, 0.985);
    wall = vec3(0.55, 0.58, 0.6); wmetal = 0.8; wrough = 0.35;
    glassTint = mix(vec3(0.24, 0.34, 0.36), vec3(0.3, 0.32, 0.36), fract(seed * 5.0)) * tint; gmetal = 0.92; grough = 0.03;
  } else if (style < 1.5) {     // OFFICE punched windows
    wall = vec3(0.6, 0.58, 0.53) * tint;
    win = vec4(0.14, 0.86, 0.3, 0.86);
  } else if (style < 2.5) {     // BRICK
    wall = vec3(0.38, 0.19, 0.13) * tint;
    win = vec4(0.26, 0.74, 0.3, 0.8); grough = 0.12; gmetal = 0.1;
  } else if (style < 3.5) {     // DARK GLASS with fins
    curtain = true; win = vec4(0.1, 0.9, 0.08, 0.98);
    wall = vec3(0.09, 0.09, 0.1); wmetal = 0.6; wrough = 0.3;
    glassTint = vec3(0.09, 0.1, 0.11); gmetal = 0.9; grough = 0.03;
  } else if (style < 4.5) {     // ART DECO stone with piers
    wall = vec3(0.66, 0.6, 0.5) * tint;
    win = vec4(0.24, 0.76, 0.26, 0.9);
  } else if (style < 5.5) {     // INDUSTRIAL corrugated metal
    wall = mix(vec3(0.5, 0.53, 0.55), vec3(0.32, 0.4, 0.42), fract(seed * 3.0)) * tint;
    wmetal = 0.5; wrough = 0.55;
    win = vec4(0.1, 0.9, 0.72, 0.92);
  } else if (style < 6.5) {     // HOUSE siding
    wall = mix(vec3(0.72, 0.68, 0.6), vec3(0.55, 0.62, 0.66), fract(seed * 9.0)) * tint;
    win = vec4(0.3, 0.7, 0.32, 0.78);
  } else if (style < 7.5) {     // STUCCO apartments
    wall = mix(vec3(0.75, 0.7, 0.62), vec3(0.8, 0.76, 0.7), fract(seed * 4.0)) * tint;
    win = vec4(0.22, 0.78, 0.3, 0.84);
  } else {                      // CONCRETE shaft (landmark)
    wall = vec3(0.62, 0.62, 0.6);
    win = vec4(0.45, 0.55, 0.45, 0.55);
  }
  // weathering streaks under each window and grime toward the street
  float streak = kjN2(vec2(um * 1.7, rest.y * 0.08 + seed * 20.0));
  wall *= 0.86 + 0.22 * n1 - 0.12 * smoothstep(0.55, 0.9, streak) * (1.0 - float(curtain));
  wall *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 6.0, rest.y));
  // ground floor storefronts
  bool shop = fi < 0.5 && style != 5.0 && style < 5.5 && dims.y > 9.0;
  if (shop) { win = vec4(0.05, 0.95, 0.06, 0.78); }
  bool parapet = rest.y > dims.y - 1.1;
  float inWin = kjBox(c, win, w);
  if (style > 3.5 && style < 4.5) inWin *= 1.0; // piers come from the window rect
  if (style > 5.5 && style < 6.5 && fi < 0.5 && fract(rnd * 13.0) < 0.3) inWin = kjBox(c, vec4(0.38, 0.62, 0.02, 0.72), w); // door
  if (style > 4.5 && style < 5.5) { // warehouses: windows only in a clerestory band at the top floor
    inWin *= step(topFloor - 0.5, fi) * step(0.5, fract(cellId.x * 0.5));
    if (fi < 0.5 && fract(rnd * 7.0) < 0.35) { inWin = 0.0; wall *= 0.7; } // roller door
  }
  if (parapet) inWin = 0.0;
  if (curtain) inWin *= 1.0 - 0.0 * float(parapet);
  // ---------------------------------------------------- glass: reflective, with a lit room behind it
  float lit = step(rnd, mix(0.04, 0.3, uNight)) * step(0.05, uNight + 0.06);
  float ds;
  vec2 roomCell = vec2((c.x - win.x) / (win.y - win.x), (c.y - win.z) / (win.w - win.z));
  vec3 room = kjRoom(clamp(roomCell, 0.0, 1.0), vt, fract(rnd * 31.0), lit, ds);
  float blind = step(1.0 - fract(rnd * 17.0) * 0.6, roomCell.y) * step(0.5, fract(rnd * 5.3));
  room = mix(room, vec3(0.62, 0.6, 0.55), blind * 0.9);
  vec3 lightCol = mix(vec3(1.0, 0.82, 0.6), vec3(0.85, 0.92, 1.0), step(0.6, fract(rnd * 3.1)));
  vec3 interiorEmit = room * ds * mix(0.12, 0.006, uNight) + room * ds * lit * lightCol * (shop ? 1.1 : 0.55) * uNight;
  if (shop) {
    vec3 signC = 0.5 + 0.5 * cos(6.2831 * (fract(rnd * 3.0) + vec3(0.0, 0.33, 0.67)));
    float sign = kjBand(c.y, 0.82, 0.97, w.y) * kjBand(c.x, 0.08, 0.92, w.x);
    wall = mix(wall, signC * 0.5, sign);
    f.emit += signC * sign * uNight * 2.5 * step(0.4, fract(rnd * 9.0));
  }
  // curtain walls: spandrel panels at each slab, faint per-panel normal warp
  if (curtain) {
    float spand = 1.0 - kjBand(c.y, 0.1, 0.995, w.y);
    room = mix(room, glassTint * 1.6, spand);
    interiorEmit *= 1.0 - spand;
    f.tn += (vec2(rnd, fract(rnd * 7.7)) - 0.5) * 0.03;
  }
  // ---------------------------------------------------- damage: shattered panes, soot, fire
  float dmg = state.y, burn = state.z;
  float broken = step(rnd, dmg * 1.15);
  vec3 glassAlb = mix(glassTint, vec3(0.012), broken);
  float gr = mix(grough, 0.9, broken);
  float gm = mix(gmetal, 0.0, broken);
  interiorEmit *= 1.0 - broken * 0.85;
  // ---------------------------------------------------- recess and sill shading (tangent-space normal)
  float edge = 0.04;
  vec2 tn = vec2(0.0);
  tn.x += (kjBand(c.x, win.x, win.x + edge, w.x) - kjBand(c.x, win.y - edge, win.y, w.x)) * 0.55;
  tn.y += (kjBand(c.y, win.z, win.z + edge, w.y) - kjBand(c.y, win.w - edge, win.w, w.y)) * 0.55;
  tn.y += kjBand(c.y, win.z - 0.05, win.z, w.y) * kjBand(c.x, win.x - 0.03, win.y + 0.03, w.x) * 0.7; // sill
  if (style > 3.5 && style < 4.5) tn.x += (kjBand(c.x, 0.0, 0.08, w.x) - kjBand(c.x, 0.92, 1.0, w.x)) * 0.6; // pier edges
  if (style > 2.5 && style < 3.5) tn.x += (kjBand(c.x, 0.0, 0.05, w.x) - kjBand(c.x, 0.05, 0.1, w.x)) * 0.8; // fins
  if (style > 4.5 && style < 5.5) tn.x += sin(um * 31.4) * 0.25 * (1.0 - lod); // corrugation
  tn *= inWin > 0.0 ? 1.0 : 1.0;
  f.tn += tn * (1.0 - lod);
  // ---------------------------------------------------- combine, with distance filtering
  float gfrac = (win.y - win.x) * (win.w - win.z);
  float gmask = mix(inWin, gfrac, lod);
  f.alb = mix(wall, glassAlb, gmask);
  f.rough = mix(wrough, gr, gmask);
  f.metal = mix(wmetal, gm, gmask);
  f.emit += interiorEmit * gmask;
  f.glass = gmask;
  #if defined(KJ_DBG_GM)
  kjDbg = vec3(gmask);
  #elif defined(KJ_DBG_LOD)
  kjDbg = vec3(lod, w * 4.0);
  #elif defined(KJ_DBG_N1)
  kjDbg = vec3(n1, rnd, streak);
  #elif defined(KJ_DBG_INWIN)
  kjDbg = vec3(inWin, c);
  #endif
  // soot and fire
  float soot = clamp(burn * 1.2 + dmg * 0.25, 0.0, 1.0) * (0.6 + 0.4 * n1);
  f.alb = mix(f.alb, vec3(0.025, 0.022, 0.02), soot * 0.85);
  f.rough = mix(f.rough, 0.95, soot);
  float flick = 0.6 + 0.4 * sin(uTime * 13.0 + rnd * 40.0) * sin(uTime * 7.3 + rnd * 11.0);
  f.emit += vec3(3.0, 1.1, 0.25) * burn * burn * gmask * flick * step(0.35, fract(rnd * 3.7 + burn));
  return f;
}

// Exposed interior: floor slabs every storey, columns at bay lines, dark gutted voids.
Fac kjInterior(vec3 rest, vec3 on, vec4 st, vec4 state) {
  Fac f; f.metal = 0.0; f.emit = vec3(0.0); f.tn = vec2(0.0); f.glass = 0.0;
  float floorH = st.z, bayW = st.w;
  float v = rest.y / floorH;
  float fv = fract(v);
  float um = abs(on.x) > 0.5 ? rest.z : rest.x;
  float n = kjF3(rest * 0.7);
  bool sx = abs(on.x) > 0.5;
  vec2 w = max(vec2((abs(sx ? gDRx.z : gDRx.x) + abs(sx ? gDRy.z : gDRy.x)) / bayW, (abs(gDRx.y) + abs(gDRy.y)) / floorH), vec2(1e-4));
  float slab = 1.0 - kjBand(fv, 0.09, 0.97, w.y);
  float col = 1.0 - kjBand(fract(um / bayW + 0.5), 0.07, 0.93, w.x);
  vec3 concrete = vec3(0.5, 0.49, 0.46) * (0.75 + 0.4 * n);
  vec3 voidc = vec3(0.05, 0.045, 0.04) * (0.6 + 0.8 * n);
  float solid = clamp(slab + col, 0.0, 1.0);
  if (abs(on.y) > 0.5) solid = 1.0;
  f.alb = mix(voidc, concrete, solid);
  f.rough = 0.95;
  f.tn = vec2(0.0, (slab > 0.5 ? 0.3 : 0.0));
  float burn = state.z;
  f.alb *= 1.0 - 0.8 * burn;
  f.emit = vec3(2.6, 0.9, 0.2) * burn * burn * (1.0 - solid) * (0.5 + 0.5 * sin(uTime * 9.0 + n * 20.0));
  return f;
}

Fac kjRoof(vec3 rest, vec3 dims, vec4 st, vec4 state) {
  Fac f; f.metal = 0.0; f.emit = vec3(0.0); f.tn = vec2(0.0); f.glass = 0.0;
  float n = kjF2(rest.xz * 0.4 + st.y * 30.0);
  float edge = min(min(rest.x, dims.x - rest.x), min(rest.z, dims.z - rest.z));
  vec3 base = st.x > 5.5 && st.x < 6.5 ? vec3(0.22, 0.12, 0.1) : vec3(0.3, 0.3, 0.29);
  f.alb = base * (0.75 + 0.45 * n) * (edge < 0.8 ? 0.75 : 1.0);
  f.rough = 0.9;
  f.alb *= 1.0 - 0.8 * state.z;
  return f;
}
`;

const FRAG_MAIN = /* glsl */`
{
  // dissolve what stands between the camera and the kaiju, and anything touching the lens
  if (uCutR > 0.0) {
    vec3 ab = uCutB - uCutA;
    float t = clamp(dot(vFogWorld - uCutA, ab) / max(dot(ab, ab), 1.0), 0.0, 1.0);
    float d = length(vFogWorld - (uCutA + ab * t));
    float r = uCutR * (0.35 + 0.65 * t);
    float near = length(vFogWorld - cameraPosition);
    float cut = max(t < 0.92 ? 1.0 - smoothstep(r * 0.7, r, d) : 0.0, 1.0 - smoothstep(14.0, 26.0, near));
    float dith = fract(dot(floor(gl_FragCoord.xy), vec2(0.5, 0.25)) + fract(gl_FragCoord.y * 0.5) * 0.5);
    if (cut > dith * 0.98 + 0.01) discard;
  }
  gDRx = dFdx(vRest); gDRy = dFdy(vRest);
  vec3 on = vONrm;
  bool cut = vCutB > 0.5;
  float mask = vStateB.x;
  int face = abs(on.x) > 0.7 ? (on.x > 0.0 ? 0 : 1) : abs(on.y) > 0.7 ? (on.y > 0.0 ? 2 : 3) : abs(on.z) > 0.7 ? (on.z > 0.0 ? 4 : 5) : -1;
  int maskI = int(mask + 0.5);
  bool ext = !cut && face >= 0 && ((maskI >> face) & 1) == 1;
  vec3 Nv = normal;
  vec3 Tv = vTanV - Nv * dot(vTanV, Nv);
  Tv = length(Tv) > 1e-4 ? normalize(Tv) : normalize(cross(Nv, abs(Nv.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 Bv = vBitV - Nv * dot(vBitV, Nv) - Tv * dot(vBitV, Tv);
  Bv = length(Bv) > 1e-4 ? normalize(Bv) : cross(Nv, Tv);
  vec3 V = normalize(vViewPosition);
  vec3 vt = vec3(dot(V, Tv), dot(V, Bv), dot(V, Nv));
  Fac fc;
  if (ext && face == 2) fc = kjRoof(vRest, vDimsB, vStyleB, vStateB);
  else if (ext && face != 3) fc = kjFacade(vRest, on, vt, vDimsB, vStyleB, vStateB, vTintB);
  else fc = kjInterior(vRest, on, vStyleB, vStateB);
  // settling dust from collapses
  float dust = vStateB.w;
  fc.alb = mix(fc.alb, uDust * 0.75, dust * 0.85);
  fc.rough = mix(fc.rough, 1.0, dust);
  fc.metal *= 1.0 - dust;
  fc.emit *= 1.0 - dust * 0.8;
  #ifdef KJ_DBG_NAN
  bool badF = any(isnan(fc.alb)) || any(isnan(fc.emit)) || isnan(fc.rough) || any(isnan(fc.tn)) || any(isinf(fc.emit));
  bool badV = any(isnan(Tv)) || any(isnan(Bv)) || any(isnan(Nv)) || any(isnan(vRest)) || any(isnan(vt));
  fc.alb = vec3(0.2); fc.tn = vec2(0.0); fc.rough = 1.0; fc.metal = 0.0;
  fc.emit = badF ? vec3(50.0, 0.0, 0.0) : badV ? vec3(0.0, 50.0, 0.0) : vec3(0.0);
  #endif
  #if defined(KJ_DBG_GM) || defined(KJ_DBG_LOD) || defined(KJ_DBG_N1) || defined(KJ_DBG_INWIN)
  fc.emit = kjDbg; fc.alb = vec3(0.0); fc.rough = 1.0; fc.metal = 0.0; fc.tn = vec2(0.0);
  #endif
  #ifdef KJ_DBG_ALB
  fc.emit = fc.alb * 2.0; fc.alb = vec3(0.0); fc.rough = 1.0; fc.metal = 0.0; fc.tn = vec2(0.0);
  #endif
  #ifdef KJ_DBG_NOTN
  fc.tn = vec2(0.0);
  #endif
  #ifdef KJ_DBG_MATTE
  fc.rough = 1.0; fc.metal = 0.0;
  #endif
  #ifdef KJ_DBG_NOEMIT
  fc.emit = vec3(0.0);
  #endif
  diffuseColor.rgb = fc.alb;
  roughnessFactor = max(0.065, mix(fc.rough, fc.rough * 0.35, uWet * (1.0 - fc.glass)));
  metalnessFactor = fc.metal;
  normal = normalize(Nv + Tv * fc.tn.x + Bv * fc.tn.y);
  kjEmit = fc.emit;
}
`;

export function makeBuildingMaterial(fragment = false) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 });
  if (fragment) mat.defines = { KJ_FRAG: 1 };
  patch(mat, fragment ? 'bfrag' : 'bchunk', (sh) => {
    sh.uniforms.uCutA = G.uCutA; sh.uniforms.uCutB = G.uCutB; sh.uniforms.uCutR = G.uCutR;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_MAIN);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS + '\nvec3 kjEmit;\nuniform vec3 uCutA, uCutB; uniform float uCutR;\n')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_MAIN)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += kjEmit;');
  });
  return mat;
}

// Depth material for shadow passes on instanced chunks (plain instanced boxes need nothing special).
export function addInstanceAttrs(geo, count) {
  const attrs = {};
  for (const [name, size] of INSTANCE_ATTRS) {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(count * size), size);
    a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(name, a);
    attrs[name] = a;
  }
  return attrs;
}
