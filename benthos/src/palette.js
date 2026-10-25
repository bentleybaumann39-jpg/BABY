/* palette.js — the Halvard-48 master palette, the zone subsets that shrink with depth, and the
 * 32x32x32 lookup tables that map lit colour to the nearest palette entry. */
'use strict';
(function (B) {
  const C = {
    k0: '#000000',
    b0: '#02060e', b1: '#050d1a', b2: '#091728', b3: '#0e2338', b4: '#14324c', b5: '#1c4563', b6: '#275a7c',
    b7: '#357396', b8: '#4a8fb0', b9: '#69aac6', b10: '#93c8da', b11: '#c4e6ee',
    t0: '#06201f', t1: '#0c3530', t2: '#14504a', t3: '#1f6e63', t4: '#2f907c', t5: '#4bb394', t6: '#7dd6b0', t7: '#bff3d6',
    c0: '#18225e', c1: '#2c3fa8', c2: '#5a74e6',
    s0: '#e8fff8',
    w0: '#140c08', w1: '#2a1a10', w2: '#452c1a', w3: '#664329', w4: '#8a5d3a', w5: '#b07d52', w6: '#d3a46f', w7: '#f0cc98',
    r0: '#2e0b0b', r1: '#5c1414', r2: '#922218', r3: '#c83a22',
    o0: '#ff8f2a', o1: '#ffc05e',
    a0: '#2a1a05', a1: '#7a4b0f', a2: '#d98e1c', a3: '#ffd27a',
    p0: '#c8708f', p1: '#f2b8cb',
    g0: '#16161b', g1: '#2c2c33', g2: '#4a4a52', g3: '#6f6f78', g4: '#9a9aa2', g5: '#c8c8cd', g6: '#efefec',
    k1: '#2c3a1a', k2: '#4d6128', k3: '#7a8f3b',
  };
  B.C = C;
  const list = s => s.split(' ').map(k => C[k]);

  // Zone palettes. The world renders through one of these; the HUD and sonar draw on top in exact colours.
  const Z = {
    top: Object.values(C),
    sun: list('k0 b1 b2 b3 b4 b5 b6 b7 b8 b9 b10 b11 t1 t2 t3 t4 t5 t6 w1 w2 w3 w4 w5 w6 w7 r2 r3 o0 g1 g3 g5 k2'),
    twi: list('k0 b0 b1 b2 b3 b4 b5 b6 b7 b8 b9 t1 t2 t3 t4 t5 t6 w1 w2 w4 w6 r2 o0 g3'),
    deep: list('k0 b0 b1 b2 b3 b5 b7 b9 t1 t3 t5 t6 w2 w6 r1 o0'),
    mid: list('k0 b0 b1 b2 b4 b6 b8 t2 t4 t6 c1 c2 p1 o0 o1 w6'),
    mid2: list('k0 b0 b1 b3 b5 t2 t5 c1 p1 o0 o1 w5'),
    ben0: list('k0 b0 b2 b4 t2 t5 c1 o0 w4 g4'),
    ben1: list('k0 b0 b2 t2 t5 c1 w4 g4'),
    ben2: list('k0 b1 t2 t5 w4 g4'),
    ben3: list('k0 b1 t4 g4'),
    ben4: list('k0 b2 g4'),
    red: list('k0 r0 r1 r2 r3'),
    listen: list('k0 b2 b4 b6'),
    eye: ['#000000', '#e6e6e0'],
    d71: ['#2b1830', '#7a4a6e', '#6fa3a8', '#d6c3b5'],
    d94: ['#1a1408', '#3d6b2a', '#b8332a', '#e0d090'],
    dmara: ['#0a0a12', '#3a2a4a', '#8a6a5a', '#c0b0a0'],
  };
  B.ZONES = Z;

  // Mara's own 16-colour ramp. Fidelity merges these one at a time (see DESIGN.md §2.2.3).
  B.DIVER = ['#1a1d22', '#3a3f47', '#646b75', '#9aa2ab', '#d4d9dd', '#0b1a1f', '#1f4650', '#7fc4cf',
    '#6a3e2c', '#b9805e', '#e8b892', '#7a4b0f', '#ffb43a', '#2a3a35', '#8fe0c0', '#3b2a22'];
  // [from, into] for fidelity 16 -> 15, 15 -> 14, ... down to 3. The amber stencil survives longest.
  B.DIVER_MERGE = [[10, 9], [7, 6], [4, 3], [9, 8], [15, 1], [13, 5], [8, 5], [0, 1], [6, 5], [3, 2], [2, 1], [14, 5], [11, 12]];
  B.diverMap = function (fid) {
    const map = []; for (let i = 0; i < 16; i++) map[i] = i;
    const steps = 16 - Math.max(3, Math.min(16, fid));
    for (let s = 0; s < steps; s++) {
      const [a, b] = B.DIVER_MERGE[s];
      for (let i = 0; i < 16; i++) if (map[i] === a) map[i] = map[b];
    }
    return map;
  };

  const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  B.hexRGB = hexRGB;
  B.rgb32 = (r, g, b, a) => ((a === undefined ? 255 : a) << 24 | b << 16 | g << 8 | r) >>> 0;
  B.hex32 = h => { const c = hexRGB(h); return B.rgb32(c[0], c[1], c[2]); };
  // sRGB <-> linear
  B.toLin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  B.linHex = h => hexRGB(h).map(B.toLin);

  // Linear -> sRGB in [0,1], tabled (4096 entries over 0..1.5 to give a little headroom before clipping).
  const GT = new Float32Array(4097);
  for (let i = 0; i <= 4096; i++) {
    const v = Math.min(1, i / 4096 * 1.5);
    GT[i] = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  }
  B.GT = GT; B.GTS = 4096 / 1.5;

  // 4x4 Bayer thresholds centred on zero.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  B.BAYER = new Float32Array(16);
  for (let i = 0; i < 16; i++) B.BAYER[i] = (BAYER[i] + 0.5) / 16 - 0.5;
  B.bayer = (x, y) => B.BAYER[(y & 3) * 4 + (x & 3)];

  // Build a 32^3 LUT: 5-bit sRGB -> packed RGBA of the nearest palette entry (redmean-weighted distance).
  function buildLUT(hexes) {
    const cols = hexes.map(hexRGB), n = cols.length;
    const lut = new Uint32Array(32768);
    const packed = cols.map(c => B.rgb32(c[0], c[1], c[2]));
    for (let r = 0; r < 32; r++) {
      const rv = r * 255 / 31;
      for (let g = 0; g < 32; g++) {
        const gv = g * 255 / 31;
        for (let b = 0; b < 32; b++) {
          const bv = b * 255 / 31;
          let best = 0, bd = 1e12;
          for (let i = 0; i < n; i++) {
            const c = cols[i], rm = (rv + c[0]) * 0.5;
            const dr = rv - c[0], dg = gv - c[1], db = bv - c[2];
            const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
            if (d < bd) { bd = d; best = i; }
          }
          lut[(r << 10) | (g << 5) | b] = packed[best];
        }
      }
    }
    return lut;
  }
  B.buildLUT = buildLUT;

  // Lazily built and cached LUTs per zone name.
  const cache = {};
  B.lut = function (name) {
    if (!cache[name]) cache[name] = buildLUT(Z[name]);
    return cache[name];
  };
  B.prewarmLUTs = function (names) { for (const n of names) B.lut(n); };
  // Diver LUT for the current fidelity (the remaining colours of her ramp).
  let diverFid = -1, diverLUT = null;
  B.diverLUT = function (fid) {
    if (fid !== diverFid) {
      const map = B.diverMap(fid), keep = [...new Set(map)].map(i => B.DIVER[i]);
      diverLUT = buildLUT(keep); diverFid = fid;
    }
    return diverLUT;
  };

  // Which world palette applies at a given depth / act.
  B.zoneFor = function (act, z) {
    if (act === 'deck' || act === 'title') return 'top';
    if (z < 200) return 'sun';
    if (z < 420) return 'twi';
    if (z < 1000) return 'deep';
    if (z < 2000) return 'mid';
    if (z < 3000) return 'mid2';
    if (z < 3250) return 'ben0';
    if (z < 3500) return 'ben1';
    if (z < 3750) return 'ben2';
    if (z < 4000) return 'ben3';
    return 'ben4';
  };
  B.zoneDither = { top: 0.06, sun: 0.07, twi: 0.08, deep: 0.1, mid: 0.11, mid2: 0.12, ben0: 0.14, ben1: 0.15, ben2: 0.17, ben3: 0.2, ben4: 0.24, red: 0.16, listen: 0.18, eye: 0.3 };
})(window.B);
