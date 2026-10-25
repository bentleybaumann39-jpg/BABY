/* hud.js — the amber suit telemetry, captions, menus and full-screen sequences, all drawn into the
 * 480x270 buffer with a 5x7 pixel font so they share the CRT with the world. */
'use strict';
(function (B) {
  const M = B.M, R = B.R, A = B.A, I = B.I;
  const Hd = B.Hud = {};
  const C32 = h => B.hex32(h);
  const COL = {
    a0: C32('#2a1a05'), a1: C32('#7a4b0f'), a2: C32('#d98e1c'), a3: C32('#ffd27a'), k: C32('#000000'), s0: C32('#e8fff8'),
    t2: C32('#14504a'), t5: C32('#4bb394'), t6: C32('#7dd6b0'), b1: C32('#050d1a'), b3: C32('#0e2338'), b6: C32('#275a7c'), b10: C32('#93c8da'),
    g2: C32('#4a4a52'), g4: C32('#9a9aa2'), g5: C32('#c8c8cd'), g6: C32('#efefec'), k2: C32('#4d6128'), r3: C32('#c83a22'), o0: C32('#ff8f2a'),
  };
  Hd.COL = COL;

  // ------------------------------------------------------------------ font
  const G = {
    A: '0e11111f111111', B: '1e11111e11111e', C: '0e11101010110e', D: '1e11111111111e', E: '1f10101e10101f', F: '1f10101e101010', G: '0e11101711110f',
    H: '1111111f111111', I: '0e04040404040e', J: '0702020202120c', K: '11121418141211', L: '1010101010101f', M: '111b1515111111', N: '11111915131111',
    O: '0e11111111110e', P: '1e11111e101010', Q: '0e11111115120d', R: '1e11111e141211', S: '0f10100e01011e', T: '1f040404040404', U: '1111111111110e',
    V: '11111111110a04', W: '1111111515150a', X: '11110a040a1111', Y: '1111110a040404', Z: '1f01020408101f',
    0: '0e11131519110e', 1: '040c040404040e', 2: '0e11010204081f', 3: '1f02040201110e', 4: '02060a121f0202', 5: '1f101e0101110e', 6: '0608101e11110e',
    7: '1f010204080808', 8: '0e11110e11110e', 9: '0e11110f01020c',
    ' ': '00000000000000', '.': '00000000000c0c', ',': '000000000c0408', ':': '000c0c000c0c00', ';': '000c0c000c0408', '!': '04040404040004',
    '?': '0e110102040004', '-': '0000001f000000', '+': '0004041f040400', '/': '00010204081000', '(': '02040808080402', ')': '08040202020408',
    "'": '0c040800000000', '"': '0a0a0a00000000', '[': '0e08080808080e', ']': '0e02020202020e', '#': '0a0a1f0a1f0a0a', '%': '18190204081303',
    '=': '00001f001f0000', '*': '0004150e150400', '<': '02040810080402', '>': '08040201020408', '_': '0000000000001f', '·': '00000004000000',
    '—': '0000001f000000', '▼': '001f1f0e0e0400', '▲': '00040e0e1f1f00', '◆': '00040e1f0e0400', '×': '00110a040a1100', '&': '0c12140815120d', '|': '04040404040404', '°': '0c12120c000000', '@': '0e11171517100e',
  };
  const GL = {};
  for (const k in G) { const s = G[k], rows = []; for (let r = 0; r < 7; r++) rows.push(parseInt(s.substr(r * 2, 2), 16)); GL[k] = rows; }
  Hd.text = function (x, y, str, c, sc, shadow) {
    sc = sc || 1; str = String(str).toUpperCase();
    let cx = Math.round(x); y = Math.round(y);
    for (const ch of str) {
      const g = GL[ch] || GL['?'];
      for (let r = 0; r < 7; r++) { const row = g[r]; if (!row) continue; for (let b = 0; b < 5; b++) if (row & (16 >> b)) {
        if (shadow) R.rect(cx + b * sc + 1, y + r * sc + 1, sc, sc, COL.k);
        R.rect(cx + b * sc, y + r * sc, sc, sc, c);
      } }
      cx += 6 * sc;
    }
    return cx;
  };
  Hd.tw = (str, sc) => String(str).length * 6 * (sc || 1) - (sc || 1);
  Hd.center = (y, str, c, sc, sh) => Hd.text(Math.round((R.W - Hd.tw(str, sc)) / 2), y, str, c, sc, sh);
  Hd.wrap = function (str, maxc) {
    const words = String(str).split(' '), out = []; let line = '';
    for (const w of words) { if ((line + ' ' + w).trim().length > maxc) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); }
    if (line) out.push(line); return out;
  };
  function box(x, y, w, h, fill, edge) { R.rect(x, y, w, h, fill); if (edge !== undefined) { R.hline(x, x + w - 1, y, edge); R.hline(x, x + w - 1, y + h - 1, edge); R.vline(x, y, y + h - 1, edge); R.vline(x + w - 1, y, y + h - 1, edge); } }
  Hd.box = box;
  // Amber drifts to teal on the Benthic Plain: even the HUD is absorbed.
  function amber(level) {
    const P = B.player; let k = 0;
    if (B.act === 'act3' && P) k = M.clamp((P.z - 3000) / 1200, 0, 1);
    const base = [[0x2a, 0x1a, 0x05], [0x7a, 0x4b, 0x0f], [0xd9, 0x8e, 0x1c], [0xff, 0xd2, 0x7a]][level];
    const tl = [[0x06, 0x20, 0x1f], [0x14, 0x50, 0x4a], [0x4b, 0xb3, 0x94], [0xbf, 0xf3, 0xd6]][level];
    if (k === 0) return [COL.a0, COL.a1, COL.a2, COL.a3][level];
    return B.rgb32(Math.round(M.lerp(base[0], tl[0], k)), Math.round(M.lerp(base[1], tl[1], k)), Math.round(M.lerp(base[2], tl[2], k)));
  }

  // ------------------------------------------------------------------ transient UI state
  let toasts = [], tip = null; const tipShown = {};
  let inset = [0, 0];
  let doc = null, docScroll = 0, craft = null, menuS = null, mapOn = false, mapImg = null, mapAct = null;
  let bootS = null, fadeS = null, gaugeFrozen = null;
  Hd.reset = function () { toasts = []; tip = null; doc = null; craft = null; mapOn = false; bootS = null; };
  Hd.toast = function (t) { toasts.push({ t, until: B.time + 3.2 }); if (toasts.length > 3) toasts.shift(); };
  const TIPS = {
    move: 'WASD THRUST · MOUSE AIMS THE LAMP · SHIFT BOOST · LET GO TO COAST: COASTING IS SILENT',
    trim: 'C FLOODS THE TANK: SINK, SILENT · SPACE BLOWS IT: RISE, HISSES, SPENDS AIR',
    lamp: 'F CYCLES THE LAMP: WHITE / RED / OFF · HOLD F TO THROW A FLARE · ALMOST NOTHING DOWN HERE SEES RED',
    ping: 'R TAP: WIDE PING · HOLD R AND RELEASE: NARROW CONE · HOLD RIGHT MOUSE: LISTEN · LMB: THE PICK',
    sleeper: 'IT IS BLIND. IT HEARS, AND IT FEELS A POWERED SUIT WITHIN 6 M. HOLD Q NEAR ROCK TO BRACE AND POWER DOWN.',
    absorb: 'HOLD E ON A CARCASS TO ABSORB BIOMASS. BIOMASS IS NOT HEALTH.',
    cells: '1-5 USE A CELL · SIPHON: JET · CAUL: SHIELD · BLOOM: DECOY · G: GRAFT THE HULL (COSTS YOU)',
    gauge: 'HOLD H: READ THE CHEST GAUGE. IT ALWAYS TELLS THE TRUTH. THE WORLD KEEPS MOVING WHILE YOU LOOK.',
    scrub: 'T: SWAP THE SCRUBBER CANISTER BEFORE THE AIR TURNS. CO2 MAKES THE HUD LIE.',
  };
  // the same lessons for thumbs
  const TTIPS = {
    move: 'LEFT THUMB THRUSTS · PUSH PAST THE RING TO BOOST · HOLD ANYWHERE ON THE RIGHT TO AIM · LET GO TO COAST: COASTING IS SILENT',
    trim: 'RIGHT EDGE: TOP BLOWS THE TANK (RISE, HISSES, SPENDS AIR) · BOTTOM FLOODS IT (SINK, SILENT)',
    lamp: 'LAMP CYCLES WHITE / RED / OFF · HOLD LAMP TO THROW A FLARE · ALMOST NOTHING DOWN HERE SEES RED',
    ping: 'PING TAP: WIDE · HOLD AND RELEASE: NARROW CONE · HOLD EAR TO LISTEN · PICK FIRES THE ANCHOR LINE',
    sleeper: 'IT IS BLIND. IT HEARS, AND IT FEELS A POWERED SUIT WITHIN 6 M. HOLD CLMP NEAR ROCK TO BRACE AND POWER DOWN.',
    absorb: 'HOLD USE ON A CARCASS TO ABSORB BIOMASS. BIOMASS IS NOT HEALTH.',
    cells: 'TAP A TANK CELL TO USE IT · SIPHON: JET · CAUL: SHIELD · BLOOM: DECOY · GRFT: GRAFT THE HULL (COSTS YOU)',
    gauge: 'HOLD THE O2 CLUSTER: READ THE CHEST GAUGE. IT ALWAYS TELLS THE TRUTH. THE WORLD KEEPS MOVING WHILE YOU LOOK.',
    scrub: 'TAP THE SCRUB BAR: SWAP THE CANISTER BEFORE THE AIR TURNS. CO2 MAKES THE HUD LIE.',
  };
  Hd.tip = function (k) { if (tipShown[k]) return; tipShown[k] = true; tip = { t: (I.touchMode && TTIPS[k]) || TIPS[k], until: B.time + 10 }; };
  Hd.key = (k, t) => I.touchMode ? '' : I.usingPad ? '[' + k + '] ' : '[' + t + '] ';
  let docBack = null;
  Hd.openDoc = function (d, onClose) { doc = d; docScroll = 0; docBack = onClose || null; A.sfx('beep'); if (B.Story.noteDoc) B.Story.noteDoc(d); };
  Hd.openCraft = function (c) { craft = { c, sel: 0 }; };
  Hd.toggleMap = function () { mapOn = !mapOn; A.sfx('click'); };
  Hd.capture = () => !!(doc || craft || menuS);
  Hd.closeOverlay = function () { if (doc) { doc = null; docBack = null; return true; } if (craft) { craft = null; return true; } if (mapOn) { mapOn = false; return true; } return false; };
  Hd.boot = function (lines) { bootS = { lines, t: 0 }; A.sfx('boot'); };
  Hd.fade = function (dur, cb, text) { fadeS = { t: 0, dur, dir: 1, cb, text, hold: true }; };
  Hd.fadeIn = function (dur) { fadeS = { t: 0, dur, dir: -1 }; };
  Hd.menu = function (o) { menuS = Object.assign({ sel: 0, t: 0 }, o); while (menuS.items[menuS.sel] && menuS.items[menuS.sel].disabled) menuS.sel++; };
  Hd.menuOpen = () => !!menuS;
  Hd.closeMenu = () => { menuS = null; };
  Hd._menu = () => menuS;
  Hd._craft = () => craft;

  // ------------------------------------------------------------------ input for overlays (returns true if consumed)
  Hd.tick = function (dt) {
    toasts = toasts.filter(t => t.until > B.time);
    if (tip && tip.until < B.time) tip = null;
    if (bootS) { bootS.t += dt; if (bootS.t > bootS.lines.length * 0.55 + 1.6) bootS = null; }
    if (fadeS) {
      fadeS.t += dt;
      if (fadeS.dir === 1 && fadeS.t >= fadeS.dur && fadeS.cb) { const cb = fadeS.cb; fadeS.cb = null; cb(); }
      if (fadeS.dir === -1 && fadeS.t >= fadeS.dur) fadeS = null;
    }
    if (menuS) return menuTick(dt);
    if (doc) {
      // a tap pages through a long document before it closes it
      if (I.pressed('click') && I.touchMode && doc._n && doc._off + doc._vis < doc._n) docScroll = doc._off + doc._vis - 1;
      else if (I.pressed('interact') || I.pressed('back') || I.pressed('click') || I.pressed('confirm')) { doc = null; const cb = docBack; docBack = null; if (cb) cb(); }
      const mv = I.move(); if (Math.abs(mv.y) > 0.5) docScroll = M.clamp(docScroll + Math.sign(mv.y) * dt * 6, 0, 30);
      return true;
    }
    if (craft) return craftTick(dt);
    return false;
  };
  function menuTick(dt) {
    const m = menuS; m.t += dt;
    const n = m.items.length;
    const step = d => { let s = m.sel; for (let k = 0; k < n; k++) { s = (s + d + n) % n; if (!m.items[s].disabled) break; } m.sel = s; A.sfx('click'); };
    if (I.pressed('mUp')) step(-1);
    if (I.pressed('mDown')) step(1);
    // mouse hover / click
    if (I.mouse.moved) { const idx = Math.floor((I.mouse.y - m.y0) / m.lh); if (idx >= 0 && idx < n && !m.items[idx].disabled && I.mouse.x > m.x0 - 10 && I.mouse.x < m.x0 + m.w + 10) m.sel = idx; I.mouse.moved = 0; }
    const it = m.items[m.sel];
    if (it && it.adj && (I.pressed('mLeft') || I.pressed('mRight'))) { it.adj(I.pressed('mRight') ? 1 : -1); A.sfx('click'); }
    const clicked = I.pressed('click') && it && Math.floor((I.mouse.y - m.y0) / m.lh) === m.sel;
    if (m.t > 0.2 && (I.pressed('confirm') || clicked) && it && !it.disabled) { A.sfx('beep'); if (it.adj && !it.fn) it.adj(1); else { if (!it.keep) menuS = null; it.fn && it.fn(); } return true; }
    if (m.cancel && I.pressed('back') && m.t > 0.2) { menuS = null; m.onCancel && m.onCancel(); }
    return true;
  }
  function recipes() {
    const P = B.player, inv = P.inv;
    const has = c => Object.keys(c).every(k => (inv[k] || 0) >= c[k]);
    const pay = c => { for (const k in c) inv[k] -= c[k]; };
    const fmt = c => Object.keys(c).map(k => k.toUpperCase() + ' ' + c[k]).join(' ');
    const list = [
      { name: 'HULL RATING +300 M (NOW ' + P.rating + ')', cost: { ti: 2, cer: 1 }, fn: () => { P.rating += 300; P.up.hull++; } },
      { name: 'SCRUBBER +20%', cost: { cu: 1, cell: 1 }, max: 3, lvl: P.up.scrub, fn: () => P.up.scrub++ },
      { name: 'THRUSTER SHROUD (QUIETER, SLOWER)', cost: { foam: 1, cell: 1 }, max: 2, lvl: P.up.thr, fn: () => P.up.thr++ },
      { name: 'SONAR (RANGE, SHORTER RING)', cost: { cu: 2, cer: 1 }, max: 3, lvl: P.up.sonar, fn: () => P.up.sonar++ },
      { name: 'CULTURE TANK +1 CELL', cost: { glass: 1, cer: 1 }, max: 2, lvl: P.up.tank, fn: () => P.up.tank++, alt: { chitin: 1, cer: 1 } },
      { name: 'SCRUBBER CANISTER', cost: { cer: 1, foam: 1 }, fn: () => P.limes++ },
      { name: 'O2 CANDLE', cost: { cu: 1, cell: 1 }, fn: () => P.carts++ },
      { name: 'FLARE', cost: { cu: 1 }, fn: () => inv.flare++ },
    ];
    return list.map(r => {
      const cost = has(r.cost) ? r.cost : r.alt && has(r.alt) ? r.alt : r.cost;
      const maxed = r.max !== undefined && r.lvl >= r.max;
      return { label: (maxed ? '(MAX) ' : '') + r.name + ' · ' + fmt(cost), ok: !maxed && has(cost), go: () => { pay(cost); r.fn(); } };
    }).concat([
      { label: 'SWAP SCRUBBER CANISTER (' + P.limes + ' SPARE)', ok: P.limes > 0, go: () => B.Player.swapLime() },
      { label: 'CONSUME A LOSSLESS SHARD: +3 FIDELITY (' + P.relics.shards + ' HELD)', ok: P.relics.shards > 0 && P.fidelity < 16, go: () => { P.relics.shards--; P.fidelity = Math.min(16, P.fidelity + 3); R.setFidelity(P.fidelity); } },
      { label: 'CLOSE', ok: true, go: () => { craft = null; } },
    ]);
  }
  // rows are taller for thumbs, as long as the list still fits the buffer
  const craftRow = () => (I.touchMode && R.H >= 220 ? 13 : 9);
  function craftTick(dt) {
    const list = recipes();
    if (I.pressed('mUp')) { craft.sel = (craft.sel + list.length - 1) % list.length; A.sfx('click'); }
    if (I.pressed('mDown')) { craft.sel = (craft.sel + 1) % list.length; A.sfx('click'); }
    if (I.mouse.moved && craft.y0 !== undefined) { const idx = Math.floor((I.mouse.y - craft.y0 + (craftRow() - 9) / 2) / craftRow()); if (idx >= 0 && idx < list.length) craft.sel = idx; I.mouse.moved = 0; }
    if (I.pressed('confirm') || I.pressed('click')) {
      const it = list[craft.sel];
      if (it.ok) { A.sfx(it.label === 'CLOSE' ? 'click' : 'graft'); it.go(); if (it.label !== 'CLOSE') { B.noise(B.player.x, B.player.y, B.player.z, 40, 'fab'); B.Story.save(); } }
      else A.sfx('deny');
    }
    if (I.pressed('back') || I.pressed('craft')) craft = null;
    void dt;
    return true;
  }

  // ------------------------------------------------------------------ the HUD
  const ORDER = (function () { const o = []; for (let k = 0; k < 64; k++) o.push(k); const d = k => { const x = (k & 7) - 3.5, y = (k >> 3) - 3.5; return Math.hypot(x, y) + B.hash2(k, 3, 1) * 0.7; }; o.sort((a, b) => d(a) - d(b)); return o; })();
  const EYE = ['00111100', '01000010', '10011001', '10111101', '10111101', '10011001', '01000010', '00111100'];
  function lung(x, y) {
    const P = B.player, real = M.clamp(P.o2 / P.o2Max, 0, 1);
    let disp = real, mode = 0;
    if (!B.settings.honest) {
      if (P.paco2 > 70) { disp = 1; mode = 4; }
      else if (P.paco2 > 62) mode = 3;
      else if (P.paco2 > 55) mode = 2;
      else if (P.paco2 > 45) disp = Math.min(1, real + 0.1 + (P.paco2 - 45) / 10 * 0.15);
    }
    const alive = Math.round(disp * 64);
    const ord = ORDER.slice();
    if (mode === 2) { const s = Math.floor(B.time * 3); for (let k = 0; k < 10; k++) { const a = Math.floor(B.hash2(s, k, 5) * 64), b = Math.floor(B.hash2(k, s, 6) * 64); const t = ord[a]; ord[a] = ord[b]; ord[b] = t; } }
    const pattern = mode === 3 && Math.sin(B.time * 0.7) > 0.6;
    for (let r = 0; r < 64; r++) {
      const k = ord[r], cx = x + (k & 7) * 4, cy = y + (k >> 3) * 4;
      let c;
      if (pattern) c = EYE[k >> 3][k & 7] === '1' ? COL.t6 : COL.b1;
      else c = r < alive ? (r > alive - 4 && mode !== 4 ? COL.t5 : COL.t6) : r < alive + 6 ? COL.k2 : COL.b1;
      R.rect(cx, cy, 3, 3, c);
    }
    Hd.text(x, y + 34, 'O2 ×' + P.carts, amber(2));
    // scrubber
    const lime = P.lime;
    Hd.text(x, y + 43, 'SCRUB', amber(1));
    R.rect(x + 31, y + 44, 24, 5, COL.a0); R.rect(x + 31, y + 44, Math.round(24 * lime), 5, lime < 0.25 ? COL.r3 : amber(2));
    if (lime < 0.2) Hd.tip('scrub');
  }
  function fidelityStrip(x, y) {
    const P = B.player; if (!P.breached) return;
    const map = B.diverMap(P.fidelity), keep = [...new Set(map)];
    keep.forEach((ci, k) => R.rect(x + k * 4, y, 3, 5, C32(B.DIVER[ci])));
    Hd.text(x + keep.length * 4 + 3, y - 1, String(P.fidelity), amber(1));
  }
  function bezel() {
    const P = B.player, f = P.crush / 100 * 0.113;
    const ix = Math.round(R.W * f), iy = Math.round(R.H * f);
    if (ix > 0) {
      R.rect(0, 0, R.W, iy, COL.k); R.rect(0, R.H - iy, R.W, iy, COL.k); R.rect(0, 0, ix, R.H, COL.k); R.rect(R.W - ix, 0, ix, R.H, COL.k);
      const c = amber(1); R.hline(ix, R.W - ix - 1, iy, c); R.hline(ix, R.W - ix - 1, R.H - iy - 1, c); R.vline(ix, iy, R.H - iy - 1, c); R.vline(R.W - ix - 1, iy, R.H - iy - 1, c);
      for (let k = 0; k < 6; k++) { R.pset(ix + 3 + k * (R.W - 2 * ix - 6) / 5, iy + 2, amber(2)); R.pset(ix + 3 + k * (R.W - 2 * ix - 6) / 5, R.H - iy - 3, amber(2)); }
    }
    return [ix, iy];
  }
  // The viewport cracking under crush debt: a crack graph grown from an impact point, revealed in order as
  // the debt climbs past a third, sealing again (the gel layer) as it falls. Kept in buffer fractions.
  let crackG = null, crackShow = 0;
  function buildCracks(seed) {
    const r = B.rng(seed), segs = [], ox = 0.7 + r() * 0.16, oy = 0.2 + r() * 0.2;
    const grow = (x, y, a, L, o0, depth) => {
      let len = 0;
      while (len < L) {
        const st = 0.008 + r() * 0.014; a += (r() - 0.5) * 0.8;
        const nx = x + Math.cos(a) * st, ny = y + Math.sin(a) * st * 1.6;
        segs.push([x, y, nx, ny, o0 + (len / L) * (1 - o0) * 0.9]);
        if (depth < 2 && r() < 0.1) grow(nx, ny, a + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.6), L * 0.4, o0 + (len / L) * 0.5, depth + 1);
        x = nx; y = ny; len += st;
      }
    };
    for (let b = 0; b < 8; b++) grow(ox, oy, b / 8 * Math.PI * 2 + r() * 0.5, 0.12 + r() * 0.42, r() * 0.12, 0);
    for (let k = 1; k <= 3; k++) { const rad = 0.018 * k; for (let a = 0; a < Math.PI * 2; a += 0.35) if (r() < 0.75) segs.push([ox + Math.cos(a) * rad, oy + Math.sin(a) * rad * 1.7, ox + Math.cos(a + 0.35) * rad, oy + Math.sin(a + 0.35) * rad * 1.7, 0.2 + k * 0.15]); }
    return { segs, ox, oy };
  }
  function glassCracks(P) {
    const want = M.clamp((P.crush - 33) / 62, 0, 1);
    const before = crackShow;
    crackShow = want > crackShow ? Math.min(want, crackShow + 1 / 60 * 0.8) : Math.max(want, crackShow - 1 / 60 * 0.05);
    if (Math.floor(crackShow * 12) > Math.floor(before * 12)) A.sfx('crackle');
    if (crackShow <= 0.001) return;
    if (!crackG) crackG = buildCracks(7 + (B.state ? B.state.deaths : 0));
    const W = R.W, Hh = R.H, hi = C32('#c4e6ee'), lo = C32('#0e2338'), out = R.out32;
    for (const sg of crackG.segs) {
      if (sg[4] > crackShow) continue;
      const x0 = sg[0] * W, y0 = sg[1] * Hh, x1 = sg[2] * W, y1 = sg[3] * Hh, n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      const tip = crackShow - sg[4] < 0.03;
      for (let k = 0; k <= n; k++) {
        const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n);
        if (x < 1 || y < 1 || x >= W - 1 || y >= Hh - 1) continue;
        // refraction: the pixel beside the crack shows what's one pixel over
        out[y * W + x + 1] = out[(y - 1) * W + x + 1];
        out[y * W + x] = tip && (B.frame >> 2) & 1 ? lo : hi;
        if ((x + y) & 1) out[(y + 1) * W + x] = lo;
      }
    }
    const cx = Math.round(crackG.ox * W), cy = Math.round(crackG.oy * Hh);
    for (let k = -2; k <= 2; k++) { R.pset(cx + k, cy, hi); R.pset(cx, cy + k, hi); }
  }
  Hd.resetCracks = () => { crackG = null; crackShow = 0; };
  function tunnel(k, seed) {
    if (k <= 0.01) return;
    const W = R.W, Hh = R.H, out = R.out32;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W / 2), dy = (y - Hh / 2) / (Hh / 2), r = Math.sqrt(dx * dx + dy * dy) / 1.414;
      const a = M.clamp((r - (1 - k)) / Math.max(0.05, k) * 1.6, 0, 1);
      if (a > 0 && B.hash2(x, y, seed) < a) out[y * W + x] = COL.k;
    }
  }
  Hd.drawSonar = function () {
    const P = B.player; if (!P) return;
    // expanding rings
    for (const p of P.pings) {
      const age = B.time - p.t0, r = age * 50; if (r > p.r) continue;
      const cx = R.sx(p.x), cy = R.sy(p.y, p.z), a = 1 - r / p.r;
      if (p.narrow) { const a0 = Math.atan2(p.ay * B.PY, p.ax * B.PX); for (let k = -10; k <= 10; k++) { const ang = a0 + k * 0.05; R.pset(cx + Math.cos(ang) * r * B.PX, cy + Math.sin(ang) * r * B.PY, COL.s0); } }
      else R.ellipse(cx, cy, r * B.PX, r * B.PY, COL.s0, 0.35 + a * 0.6);
    }
    // terrain point cloud
    const hold = P.ptsHold || 3;
    for (const q of P.pts) {
      const age = B.time - q[3]; if (age < 0 || age > hold) continue;
      const fade = 1 - age / hold, x = Math.round(R.sx(q[0])), y = Math.round(R.sy(q[1], q[2]));
      if (B.BAYER[(y & 3) * 4 + (x & 3)] + 0.5 < fade * q[4]) R.pset(x, y, fade > 0.5 ? COL.s0 : COL.b10);
    }
    // the echo trail: a shimmer along the path the ringing hull has travelled
    for (const n of P.trail) { const age = B.time - n.t; if (age > 10) continue; if (((B.frame >> 2) + Math.round(n.t * 4)) % 3) continue; R.pset(R.sx(n.x), R.sy(n.y, n.z), n.muffled ? COL.b6 : COL.b10); }
  };
  function listenArcs() {
    const P = B.player; if (!P.listening) return;
    const cx = R.sx(P.x), cy = R.sy(P.y, P.z);
    const rx = R.W / 2 - 8, ry = R.H / 2 - 8;
    for (const e of B.E.list) {
      if (!e.alive || !['sleeper', 'reliquary', 'procession', 'grain', 'double', 'ghost', 'squid', 'cage'].includes(e.type)) continue;
      let ex = e.x, ey = e.y; if (e.type === 'procession') { ex = e.px[0]; ey = e.py[0]; }
      const d = Math.hypot(ex - P.x, ey - P.y, (e.type === 'procession' ? 0 : e.z - P.z)); if (d > 80) continue;
      const loud = e.type === 'sleeper' ? 1 : e.type === 'grain' ? 0.6 : e.type === 'double' || e.type === 'ghost' ? 0.7 : 0.4;
      const ang = Math.atan2((ey - P.y) * B.PY, (ex - P.x) * B.PX), span = 0.12 + loud * 0.18, prox = 1 - d / 80;
      const trem = e.type === 'sleeper' ? Math.sin(B.time * 4) > 0 : e.type === 'grain' ? Math.random() > 0.3 : true;
      if (!trem) continue;
      const th = 1 + Math.round(loud * 2);
      for (let a = -span; a <= span; a += 0.01) for (let t = 0; t < th; t++) R.pset(R.W / 2 + Math.cos(ang + a) * (rx - t), R.H / 2 + Math.sin(ang + a) * (ry - t), prox > 0.6 ? COL.s0 : prox > 0.3 ? COL.b10 : COL.b6);
    }
    Hd.center(R.H - 60, 'LISTENING', COL.b10);
    void cx; void cy;
  }
  function gaugeView() {
    const P = B.player; const W = R.W, Hh = R.H;
    R.rect(0, 0, W, Hh, C32('#16161b'));
    for (let y = 0; y < Hh; y += 2) for (let x = (y >> 1) & 1; x < W; x += 6) R.pset(x, y, C32('#1c1c22'));
    for (const [rx, ry] of [[20, 20], [W - 20, 20], [20, Hh - 20], [W - 20, Hh - 20]]) { R.rect(rx - 2, ry - 2, 5, 5, COL.g2); R.pset(rx - 1, ry - 1, COL.g4); }
    const cx = W / 2 - 60, cy = Hh / 2, r = 48;
    if (P.breached && gaugeFrozen === null) gaugeFrozen = 0.62;
    const o2 = P.breached ? gaugeFrozen : M.clamp(P.o2 / P.o2Max, 0, 1);
    for (const [gx, val, label, max] of [[cx, o2, 'O2 · TRUE', 1], [cx + 130, M.clamp((P.paco2 - 30) / 70, 0, 1), 'CO2', 1]]) {
      R.ellipse(gx, cy, r, r, COL.g5); R.ellipse(gx, cy, r - 1, r - 1, COL.g4);
      for (let k = 0; k <= 10; k++) { const a = Math.PI * 0.75 + k / 10 * Math.PI * 1.5; R.pset(gx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4), COL.g6); R.pset(gx + Math.cos(a) * (r - 5), cy + Math.sin(a) * (r - 5), COL.g6); }
      const a = Math.PI * 0.75 + val * Math.PI * 1.5 + (P.breached ? 0 : Math.sin(B.time * 9) * 0.01);
      for (let t = 0; t < r - 8; t++) R.pset(gx + Math.cos(a) * t, cy + Math.sin(a) * t, label === 'CO2' && val > 0.5 ? COL.r3 : COL.g6);
      R.rect(gx - 2, cy - 2, 5, 5, COL.g2);
      Hd.text(gx - Hd.tw(label) / 2, cy + r + 6, label, COL.g5);
      void max;
    }
    Hd.center(16, 'CHEST GAUGE', COL.g4);
  }
  Hd.draw = function () {
    const P = B.player;
    if (B.mode === 'play' && B.act !== 'deck' && P) {
      if (P.gaugeT > 0) { gaugeView(); }
      else {
        listenArcs();
        // copepods on the glass
        if (P.copepods > 0) for (let k = 0; k < 40 * P.copepods; k++) { const x = B.hash2(k, 1, 9) * R.W, y = B.hash2(k, 2, 9) * R.H; R.pset(x, y, COL.g5); R.pset(x + 1, y + 1, COL.g4); }
        // macroblock pareidolia in the Settling
        if (B.act === 'act3' && B.facePulse > 0) macroFace();
        const tk = (P.breathHold ? 0.35 : 0) + (P.suffoT > 0 ? Math.min(0.9, P.suffoT / 20) : 0) + (P.paco2 > 70 && !B.settings.honest ? (P.paco2 - 70) / 40 : 0) + (P.braced ? 0.15 : 0);
        tunnel(Math.min(0.95, tk), B.frame >> 3);
        glassCracks(P);
        const [ix, iy] = bezel(); inset = [ix, iy];
        const dim = !P.powered;
        const a2 = dim ? amber(1) : amber(2), a3 = dim ? amber(1) : amber(3);
        const x0 = ix + 8, y0 = iy + 8;
        lung(x0, y0);
        fidelityStrip(x0, y0 + 54);
        // depth, rating, heart, trim
        const dt = B.Z.depthText(P.z), dw = Hd.tw(dt, 2);
        Hd.text(R.W - ix - 8 - dw - 12, y0, dt, a3, 2, true); Hd.text(R.W - ix - 8 - 10, y0 + 7, 'M', a2);
        Hd.text(R.W - ix - 8 - Hd.tw('DEPTH'), y0 - 1 + 17, 'DEPTH', amber(1));
        const rated = 'RATED ' + (P.breached ? 1100 : P.rating);
        Hd.text(R.W - ix - 8 - Hd.tw(rated), y0 + 26, rated, P.z > P.rating && !P.breached ? COL.r3 : amber(1));
        const hr = 'HR ' + String(P.breached ? 72 : Math.round(P.hr)).padStart(3, '0');
        Hd.text(R.W - ix - 8 - Hd.tw(hr), y0 + 35, hr, amber(1));
        // trim gauge
        const tx = R.W - ix - 12, ty = y0 + 46;
        R.rect(tx, ty, 3, 30, COL.a0); R.rect(tx - 1, ty + 15 - Math.round(P.trim * 14), 5, 2, a3);
        Hd.text(tx - 33, ty + 4, 'TRIM', amber(1)); Hd.text(tx - 33, ty + 14, 'AIR ' + Math.round(P.air), amber(1));
        // biomass cells
        const by = R.H - iy - 18;
        Hd.text(x0, by - 9, 'TANK', amber(1));
        for (let k = 0; k < P.cap; k++) {
          const cx = x0 + k * 16, s = P.cells[k];
          box(cx, by, 13, 7, COL.a0, k === P.sel && I.usingPad ? a3 : amber(1));
          if (s) { R.rect(cx + 1, by + 1, 11, 5, C32(B.STRAIN[s].hex)); Hd.text(cx + 4, by + 9, String(k + 1), amber(1)); }
        }
        if (P.overT > 90) Hd.text(x0 + P.cap * 16 + 4, by, 'SINGING', COL.r3);
        // right-bottom: lamp, flares, shells, scrap
        const lm = P.lampMode === 'white' ? 'LAMP W' : P.lampMode === 'red' ? 'LAMP R' : 'LAMP -';
        const rline = lm + ' · FL ' + P.inv.flare + ' · PH ' + P.inv.shell;
        const ry = I.touchMode ? y0 + 84 : R.H - iy - 26, rx = I.touchMode ? R.W - ix - 34 : R.W - ix - 8;
        Hd.text(rx - Hd.tw(rline), ry, rline, a2);
        const inv = 'TI ' + P.inv.ti + ' CE ' + P.inv.cer + ' CU ' + P.inv.cu + ' FM ' + P.inv.foam + ' CL ' + P.inv.cell + ' GL ' + P.inv.glass;
        Hd.text(rx - Hd.tw(inv), ry + 10, inv, amber(1));
        if (P.ring > 0) Hd.text(R.W / 2 - 20, y0 + 14, 'RING ' + Math.ceil(P.ring), (B.frame >> 3) & 1 ? COL.b10 : COL.b6);
        if (P.caul > 0) Hd.text(R.W / 2 - 20, y0 + 23, 'CAUL ' + Math.ceil(P.caul), COL.t6);
        if (P.anchor) Hd.text(R.W / 2 - 24, y0 + 32, P.reeling ? 'REELING' : 'ANCHORED', amber(2));
        if (P.clamped && !P.braced) Hd.text(R.W / 2 - 18, y0 + 41, 'CLAMPED', amber(2));
        if (P.braced) Hd.center(R.H / 2 + 40, 'BRACED · POWERED DOWN', amber(1));
        if (P.tangled) Hd.center(R.H / 2 + 40, 'ENTANGLED · STRUGGLE ' + Math.round(P.grip * 100) + '%', COL.r3);
        if (P.grabbed) Hd.center(R.H / 2 + 40, 'HELD · THRUST TO BREAK FREE', COL.r3);
        if (P.suffoT > 0 && !P.breached) Hd.center(R.H / 2 - 50, 'NO O2', (B.frame >> 4) & 1 ? COL.r3 : amber(1), 2);
        if (P.paco2 > 62 && B.settings.honest) Hd.center(R.H / 2 - 40, 'CO2 HIGH · SWAP SCRUBBER (T)', COL.r3);
        // prompt (sits above the captions)
        if (P.prompt && !Hd.capture()) {
          const t = Hd.key('A', 'E') + P.prompt.label + (P.prompt.hold && !/HOLD/.test(P.prompt.label) ? ' (HOLD)' : '');
          const w = Hd.tw(t), x = Math.round((R.W - w) / 2), y = Math.min(R.H - iy - 58, captionTop() - 16);
          box(x - 4, y - 3, w + 8, 13, COL.a0); Hd.text(x, y, t, a3);
          if (P.prompt.prog > 0) R.rect(x - 4, y + 10, Math.round((w + 8) * M.clamp(P.prompt.prog, 0, 1)), 2, a3);
        }
        drawObjective(ix, iy);
        if (mapOn) drawMap();
      }
    }
    if (B.mode === 'play' && B.act === 'deck' && P && P.prompt && !Hd.capture()) {
      const t = Hd.key('A', 'E') + P.prompt.label, w = Hd.tw(t), x = Math.round((R.W - w) / 2), y = R.H - 60;
      box(x - 4, y - 3, w + 8, 13, C32('#101418')); Hd.text(x, y, t, COL.g6);
    }
    if (B.mode === 'play' && B.act === 'deck' && P && !Hd.capture()) drawObjective(0, 0);
    drawCaptions();
    drawToasts();
    if (doc) drawDoc();
    if (craft) drawCraft();
    if (I.touchMode) drawTouch();
    if (bootS) drawBoot();
    if (menuS) drawMenu();
  };

  // ------------------------------------------------------------------ objective and transponder beacon
  // The objective line sits at the top; it brightens when it changes and after each ping. The beacon is
  // the transponder's bearing, shown for a few seconds after a ping (and always on deck).
  let obText = '', obT = -99, heardPing = -99;
  function drawObjective(ix, iy) {
    const P = B.player, ob = B.Story.objective && B.Story.objective();
    if (!ob || !B.settings.markers) return;
    if (ob.text !== obText) { obText = ob.text; obT = B.time; if (B.time > 2) A.sfx('beep'); }
    const lastPing = P.pings && P.pings.length ? P.pings[P.pings.length - 1].t0 : -99, fresh = Math.max(obT, lastPing);
    // the transponder answers a ping after the sound has crossed the water and come back
    if (lastPing > heardPing && ob.x !== undefined && B.act !== 'deck') { heardPing = lastPing; A.sfxAt('transponder', Math.min(2.5, 0.25 + Math.hypot(ob.x - P.x, ob.y - P.y, ob.z - P.z) / 750)); }
    const age = B.time - fresh, act3 = B.act === 'act3';
    const tc = age < 6 ? ((age < 1 && (B.frame >> 3) & 1) ? amber(2) : amber(3)) : amber(1);
    const t = (act3 && B.facePulse > 0 ? '· ' : '◆ ') + ob.text;
    Hd.center(iy + 4, t, tc);
    if (ob.opt && age < 10) Hd.center(iy + 13, ob.opt, amber(1));
    if (ob.x === undefined) return;
    const show = B.act === 'deck' || age < 8;
    if (!show) return;
    const fade = B.act === 'deck' ? 1 : M.clamp((8 - age) / 2, 0, 1);
    if (fade < 1 && B.BAYER[(B.frame & 3) * 4 + ((B.frame >> 2) & 3)] + 0.5 > fade) return;
    const dx = ob.x - P.x, dy = ob.y - P.y, dz = ob.z - P.z, hd = Math.hypot(dx, dy);
    const psx = R.sx(P.x), psy = R.sy(P.y, P.z) - 8, col = amber(3);
    // the deep lies: in the Settling the bearing wanders
    const jit = act3 ? (B.hash2(Math.floor(B.time * 2), 1, 7) - 0.5) * 0.5 : 0;
    const depthTxt = Math.abs(dz) < 3 ? '' : (dz > 0 ? '▼' : '▲') + Math.round(Math.abs(dz)) + 'M';
    if (hd < 6) {
      if (!depthTxt) return;
      const y = psy + (dz > 0 ? 24 : -22);
      chevron(psx, y, 0, dz > 0 ? 1 : -1, col); Hd.text(Math.round(psx - Hd.tw(depthTxt) / 2), y + (dz > 0 ? 6 : -12), depthTxt, col);
      return;
    }
    const ax = dx * B.PX, ay = dy * B.PY, l = Math.hypot(ax, ay), ca = Math.cos(jit), sa = Math.sin(jit);
    const ux = (ax / l) * ca - (ay / l) * sa, uy = (ax / l) * sa + (ay / l) * ca;
    const tsx = R.sx(ob.x), tsy = R.sy(ob.y, ob.z) - 6;
    const onScreen = tsx > ix + 20 && tsx < R.W - ix - 20 && tsy > iy + 24 && tsy < R.H - iy - 30 && Math.abs(dz) < 25;
    let mx, my;
    if (onScreen) { mx = tsx; my = tsy - 8 + Math.round(Math.sin(B.time * 4) * 2); chevron(mx, my, 0, 1, col); }
    else {
      const rx = R.W / 2 - ix - 34, ry = R.H / 2 - iy - 34, k = Math.min(rx / Math.max(0.01, Math.abs(ux)), ry / Math.max(0.01, Math.abs(uy)), Math.min(rx, ry) * 0.9);
      mx = psx + ux * k; my = psy + uy * k;
      mx = M.clamp(mx, ix + 30, R.W - ix - 30); my = M.clamp(my, iy + 26, R.H - iy - 34);
      chevron(mx, my, ux, uy, col);
    }
    const lab = Math.round(hd) + 'M' + (depthTxt ? ' ' + depthTxt : '');
    Hd.text(Math.round(mx - Hd.tw(lab) / 2), Math.round(my + 7), lab, amber(2));
  }
  // a small filled arrowhead pointing along (ux, uy), with a dark outline so it reads on anything
  function chevron(x, y, ux, uy, c) {
    const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
    const ax = x + ux * 5, ay = y + uy * 5, bx = x - ux * 3 - uy * 4, by = y - uy * 3 + ux * 4, cx = x - ux * 3 + uy * 4, cy = y - uy * 3 - ux * 4;
    const inTri = (px, py, g) => { const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by), d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy), d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay); const neg = d1 < -g || d2 < -g || d3 < -g, pos = d1 > g || d2 > g || d3 > g; return !(neg && pos); };
    for (let py = Math.floor(y - 7); py <= y + 7; py++) for (let px = Math.floor(x - 7); px <= x + 7; px++) {
      if (inTri(px + 0.5, py + 0.5, 0)) R.pset(px, py, c); else if (inTri(px + 0.5, py + 0.5, 6)) R.pset(px, py, COL.k);
    }
  }

  // ------------------------------------------------------------------ touch controls
  // Buttons are laid out on a 480x270 grid and scaled to the buffer. acts are held while the finger
  // is down; tap() fires on a quick release; split buttons hold acts on the top half, acts2 below.
  B.touchLayout = function () {
    const P = B.player;
    if (B.mode !== 'play' || !P || Hd.capture() || P.dead || bootS) return null;
    const s = R.W / 480, L = [];
    const btn = (id, x, y, r, acts, label, o) => L.push(Object.assign({ id, x: x * s, y: y * s, r, acts, label }, o));
    btn('pause', 22, 104, 9, ['pause'], 'II');
    btn('use', 446, 230, 17, ['interact'], 'USE', { hot: !!P.prompt });
    if (B.act === 'deck' || P.gaugeT > 0 && !I.state.gauge) return L;
    btn('ping', 404, 250, 14, ['ping'], 'PING');
    btn('pick', 406, 206, 14, ['pick'], 'PICK', { hot: !!P.anchor });
    btn('lamp', 446, 186, 14, ['lamp'], 'LAMP');
    btn('clamp', 360, 252, 14, ['clamp'], 'CLMP', { hot: P.clamped || P.braced });
    btn('listen', 366, 214, 11, ['listen'], 'EAR');
    btn('breath', 316, 254, 14, ['breath'], 'BRTH');
    if (P.inv.shell > 0) btn('ph', 370, 176, 10, ['powerhead'], 'PH');
    if (P.relics.shards > 0) btn('lens', 324, 214, 14, ['lens'], 'LENS');
    if (P.copepods > 0.05) btn('wipe', 326, 176, 14, ['wipe'], 'WIPE', { hot: true });
    if (P.cells.length && P.crush > 8) btn('graft', 26, 218, 14, ['graft'], 'GRFT');
    // trim: one tall split button on the right edge
    L.push({ id: 'trim', x: 452 * s, y: 96 * s, w: 22 * s, h: 70 * s, r: 0, split: true, acts: ['rise'], acts2: ['sink'] });
    // invisible hotspots on the HUD itself
    const [ix, iy] = inset, x0 = ix + 8, y0 = iy + 8;
    L.push({ id: 'gauge', x: x0 - 4, y: y0 - 4, w: 40, h: 40, r: 0, acts: ['gauge'], hidden: true });
    L.push({ id: 'scrub', x: x0 - 4, y: y0 + 40, w: 64, h: 12, r: 0, acts: [], tap: () => B.Player.swapLime(), hidden: true });
    L.push({ id: 'map', x: R.W - ix - 80, y: y0 - 4, w: 76, h: 26, r: 0, acts: ['map'], hidden: true });
    const by = R.H - iy - 18;
    for (let k = 0; k < Math.min(5, P.cap); k++) L.push({ id: 'c' + k, x: x0 + k * 16 - 2, y: by - 6, w: 16, h: 20, r: 0, acts: ['c' + (k + 1)], hidden: true });
    return L;
  };
  function ring(cx, cy, r, c, fill) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= r && d > r - 1.2) R.pset(cx + x, cy + y, c);
      else if (fill && d <= r - 1.2 && ((x + y) & 1) === 0) R.pset(cx + x, cy + y, fill);
    }
  }
  function drawTouch() {
    const T = I.touch, lay = B.touchLayout();
    if (lay) {
      const s = R.W / 480, a1 = amber(1), a2 = amber(2), a3 = amber(3);
      for (const b of lay) {
        if (b.hidden) continue;
        const held = T.held[b.id];
        if (b.id === 'trim') {
          const x = Math.round(b.x + b.w / 2), y = Math.round(b.y), h = Math.round(b.h), up = I.state.rise && T.refs.rise, dn = I.state.sink && T.refs.sink;
          R.vline(x - 6, y, y + h, a1); R.vline(x + 6, y, y + h, a1); R.hline(x - 6, x + 6, y, a1); R.hline(x - 6, x + 6, y + h, a1); R.hline(x - 4, x + 4, y + h / 2, a1);
          for (let k = 0; k < 4; k++) { R.hline(x - k, x + k, y + 10 + k, up ? a3 : a2); R.hline(x - k, x + k, y + h - 10 - k, dn ? a3 : a2); }
          Hd.text(x - 4, y + 18, 'UP', up ? a3 : a1); Hd.text(x - 4, y + h - 25, 'DN', dn ? a3 : a1);
          continue;
        }
        const r = Math.round(b.r * s), hot = b.hot && (B.frame >> 4) & 1;
        ring(Math.round(b.x), Math.round(b.y), r, held ? a3 : hot ? a3 : a2, held ? a1 : COL.a0);
        const w = Hd.tw(b.label); Hd.text(Math.round(b.x - w / 2) + 1, Math.round(b.y - 3), b.label, held || hot ? a3 : a2);
      }
      // the stick: a resting hint, or the base and knob under the thumb
      const st = T.stick;
      if (st) {
        const r = Math.round(26 * s);
        ring(Math.round(st.x0), Math.round(st.y0), r, a1, null);
        const dx = st.x - st.x0, dy = st.y - st.y0, d = Math.hypot(dx, dy), k = d > r ? r / d : 1;
        ring(Math.round(st.x0 + dx * k), Math.round(st.y0 + dy * k), Math.round(9 * s), I.state.boost ? a3 : a2, a1);
      } else if (B.player && B.frame % 120 < 90) {
        ring(Math.round(70 * s), Math.round(196 * s), Math.round(26 * s), COL.a0, null);
        Hd.text(Math.round(70 * s) - 11, Math.round(196 * s) - 3, 'MOVE', COL.a1);
      }
    }
    // portrait: the buffer is a postage stamp; ask for the other way round
    if (innerHeight > innerWidth * 1.1) {
      R.rect(0, R.H / 2 - 16, R.W, 32, COL.k);
      Hd.center(R.H / 2 - 9, 'ROTATE YOUR DEVICE', amber(3), 1);
      Hd.center(R.H / 2 + 3, 'THE TRENCH IS WIDER THAN IT IS TALL', amber(1), 1);
    }
  }
  function captionLines() {
    const caps = B.Story ? B.Story.caps : [], lines = [];
    for (const c of caps) {
      const who = c.label || (c.who === 'tobias' ? 'TOBIAS: ' : c.who === 'mara' ? 'MARA: ' : c.who === 'new' ? (B.act === 'deck' ? 'CREW: ' : 'HV-0420: ') : '');
      const col = c.who === 'tobias' ? amber(3) : c.who === 'mara' ? COL.g6 : c.who === 'new' ? amber(2) : COL.b10;
      for (const l of Hd.wrap(who + c.text, Math.floor((R.W - 150) / 6))) lines.push([l, col]);
    }
    return lines.slice(-4);
  }
  function captionBase() { return R.H - (B.act === 'deck' || B.mode !== 'play' ? 16 : 40) - (B.player ? Math.round(R.H * B.player.crush / 100 * 0.113) : 0); }
  function captionTop() { const n = captionLines().length; return captionBase() - Math.max(0, n - 1) * 9 - 2; }
  function drawCaptions() {
    if (!B.Story) return;
    const show = captionLines(); if (!show.length) return;
    let y = captionBase() - (show.length - 1) * 9;
    for (const [l, col] of show) { const w = Hd.tw(l); R.shadeRect((R.W - w) / 2 - 3, y - 2, w + 6, 11, COL.k, 0.7); Hd.text((R.W - w) / 2, y, l, col); y += 9; }
  }
  function drawToasts() {
    let y = 46;
    for (const t of toasts) { const w = Hd.tw(t.t); R.shadeRect((R.W - w) / 2 - 3, y - 2, w + 6, 11, COL.k, 0.75); Hd.text((R.W - w) / 2, y, t.t, amber(3)); y += 11; }
    if (tip) {
      const lines = Hd.wrap(tip.t, Math.floor((R.W - 200) / 6)); let ty = y + 4;
      const w = Math.max(...lines.map(l => Hd.tw(l)));
      box((R.W - w) / 2 - 5, ty - 4, w + 10, lines.length * 9 + 6, COL.a0, amber(1));
      for (const l of lines) { Hd.center(ty, l, amber(3)); ty += 9; }
    }
  }
  function drawDoc() {
    const w = Math.min(R.W - 30, 400), lines = [];
    for (const p of doc.body) { if (!p) { lines.push(''); continue; } for (const l of Hd.wrap(p, Math.floor((w - 16) / 6))) lines.push(l); }
    const visible = Math.min(lines.length, Math.floor((R.H - 70) / 9));
    const h = visible * 9 + 34, x = Math.round((R.W - w) / 2), y = Math.round((R.H - h) / 2);
    box(x, y, w, h, C32('#0c0c0e'), amber(1));
    Hd.text(x + 8, y + 7, doc.title, amber(3));
    R.hline(x + 6, x + w - 7, y + 17, amber(1));
    const off = Math.min(Math.floor(docScroll), Math.max(0, lines.length - visible));
    for (let k = 0; k < visible; k++) Hd.text(x + 8, y + 22 + k * 9, lines[k + off] || '', COL.g5);
    doc._n = lines.length; doc._vis = visible; doc._off = off;
    const more = off + visible < lines.length, cl = I.touchMode ? (more ? 'TAP: MORE' : 'TAP TO CLOSE') : (I.usingPad ? 'A CLOSE' : 'E CLOSE') + (more ? ' · S MORE' : '');
    Hd.text(x + w - 8 - Hd.tw(cl), y + h - 9, cl, amber(1));
  }
  function drawCraft() {
    const rh = craftRow(), list = recipes(), w = Math.min(R.W - 20, 380), h = list.length * rh + 34, x = Math.round((R.W - w) / 2), y = Math.round((R.H - h) / 2);
    box(x, y, w, h, C32('#0c0c0e'), amber(1));
    Hd.text(x + 8, y + 7, 'FIELD FABRICATOR · CAIRN · SAVED', amber(3));
    craft.y0 = y + 22;
    list.forEach((it, k) => {
      const yy = y + 22 + k * rh, sel = k === craft.sel;
      if (sel) R.rect(x + 4, yy - 1 - (rh - 9) / 2, w - 8, rh, COL.a0);
      Hd.text(x + 8, yy, (sel ? '> ' : '  ') + it.label, it.ok ? (sel ? amber(3) : amber(2)) : C32('#4a3a20'));
    });
    Hd.text(x + 8, y + h - 9, 'THE WATER DOES NOT STOP WHILE YOU WORK', amber(1));
  }
  function drawBoot() {
    R.shadeRect(0, 0, R.W, R.H, COL.k, Math.max(0, 0.8 - Math.max(0, bootS.t - bootS.lines.length * 0.55) * 0.6));
    bootS.lines.forEach((l, k) => { if (bootS.t > k * 0.55) Hd.text(24, 40 + k * 10, l, amber(3)); });
  }
  function drawMenu() {
    const m = menuS, lh = I.touchMode ? (m.compact ? 11 : 15) : (m.compact ? 9 : 11);
    const w = Math.max(Hd.tw(m.title || ''), ...m.items.map(it => Hd.tw(it.label + (it.value ? ' ' + it.value() : '')))) + 30;
    const h = m.items.length * lh + (m.title ? 26 : 12);
    const x = Math.round((R.W - w) / 2), y = m.y !== undefined ? m.y : Math.round((R.H - h) / 2);
    if (!m.bare) box(x, y, w, h, C32('#08090b'), amber(1));
    if (m.title) Hd.text(x + 15, y + 8, m.title, amber(3));
    m.x0 = x + 15; m.w = w - 30; m.lh = lh; m.y0 = y + (m.title ? 22 : 8);
    m.items.forEach((it, k) => {
      const yy = m.y0 + k * lh, sel = k === m.sel;
      const label = it.label + (it.value ? ' ' + it.value() : '');
      if (sel && !it.disabled) R.rect(x + 6, yy - 2, w - 12, lh - 1, COL.a0);
      Hd.text(x + 15, yy, (sel ? '> ' : '') + label, it.disabled ? C32('#4a3a20') : sel ? amber(3) : amber(2));
    });
  }
  function drawMap() {
    const m = B.map, P = B.player;
    if (mapAct !== m.name) {
      mapAct = m.name; const N = 150; mapImg = new Uint32Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const h = B.World.H(m, (i + 0.5) / N * m.size, (j + 0.5) / N * m.size);
        const base = m.name === 'act1' ? Math.min(1, h / 1100) : m.name === 'act2' ? (h < 3000 ? 0.7 : 0.05) : Math.min(1, (h - 3300) / 900);
        const v = Math.round(40 + base * 120);
        mapImg[j * N + i] = B.rgb32(Math.round(v * 0.85), Math.round(v * 0.78), Math.round(v * 0.6));
      }
    }
    const N = 150, x0 = Math.round((R.W - N) / 2), y0 = Math.round((R.H - N) / 2);
    box(x0 - 6, y0 - 16, N + 12, N + 24, C32('#1c1c1c'), COL.g4);
    Hd.text(x0, y0 - 11, "SZABO'S CHART · " + m.name.toUpperCase(), COL.g5);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) R.pset(x0 + i, y0 + j, mapImg[j * N + i]);
    const mk = (x, y, c, s) => R.rect(x0 + x / m.size * N - (s >> 1), y0 + y / m.size * N - (s >> 1), s, s, c);
    for (const e of B.E.list) if (e.alive && e.type === 'cairn') mk(e.x, e.y, COL.a3, 3);
    if (B.Story.magpie && B.act === 'act2') mk(B.Story.magpie.x, B.Story.magpie.y, COL.o0, 3);
    if (B.act === 'act3') mk(B.map.features.AX, B.map.features.AY, COL.s0, 3);
    if (P.relics.hand && B.act === 'act2') { const v = { x: 210 - 30, y: 210 + 40 }; mk(v.x, v.y, COL.g6, 2); }
    if ((B.frame >> 4) & 1) mk(P.x, P.y, COL.s0, 2);
  }
  const FACE = (function () {
    const f = new Float32Array(32 * 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const dx = (x - 16) / 11, dy = (y - 17) / 14; let v = dx * dx + dy * dy < 1 ? 0.55 - dy * 0.15 : 0;
      if (Math.hypot(x - 11, y - 14) < 2.5 || Math.hypot(x - 21, y - 14) < 2.5) v = 0.1;
      if (Math.abs(x - 16) < 1.5 && y > 15 && y < 21) v = 0.75;
      if (Math.abs(y - 24) < 1 && Math.abs(x - 16) < 5) v = 0.2;
      f[y * 32 + x] = v;
    }
    // quantise to 8x8 blocks of 4 px: the codec's version of her
    const q = new Float32Array(16); for (let by = 0; by < 4; by++) for (let bx = 0; bx < 4; bx++) { let s = 0; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) s += f[(by * 8 + y) * 32 + bx * 8 + x]; q[by * 4 + bx] = s / 64; }
    return q;
  })();
  function macroFace() {
    const p = B.facePos || [R.W * 0.7, R.H * 0.35];
    for (let by = 0; by < 4; by++) for (let bx = 0; bx < 4; bx++) {
      const v = FACE[by * 4 + bx] * 255 * 0.12;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const px = Math.round(p[0] + bx * 8 + x), py = Math.round(p[1] + by * 8 + y); if (px < 0 || py < 0 || px >= R.W || py >= R.H) continue;
        const i = py * R.W + px, c = R.out32[i], r = Math.min(255, (c & 255) + v), g = Math.min(255, ((c >> 8) & 255) + v), b = Math.min(255, ((c >> 16) & 255) + v);
        R.out32[i] = B.rgb32(r | 0, g | 0, b | 0);
      }
    }
  }
  Hd.drawFade = function () {
    if (!fadeS) return;
    const k = fadeS.dir === 1 ? M.clamp(fadeS.t / fadeS.dur, 0, 1) : 1 - M.clamp(fadeS.t / fadeS.dur, 0, 1);
    if (k >= 0.999) R.rect(0, 0, R.W, R.H, COL.k); else R.shadeRect(0, 0, R.W, R.H, COL.k, k);
    if (fadeS.text && k > 0.6) Hd.center(R.H / 2 - 3, fadeS.text, amber(2));
  };
  Hd.fading = () => !!fadeS;

  // ------------------------------------------------------------------ screens
  Hd.drawBootScreen = function () {
    R.rect(0, 0, R.W, R.H, COL.k);
    Hd.center(R.H / 2 - 30, 'BENTHOS', amber(3), 3);
    Hd.center(R.H / 2 - 3, 'THE SILENT PRESSURE', amber(2));
    if ((B.frame >> 5) & 1) Hd.center(R.H / 2 + 22, I.touchMode ? 'TAP TO CONTINUE' : 'CLICK OR PRESS ANY KEY', amber(1));
    Hd.center(R.H - 22, 'HEADPHONES · A DARK ROOM', C32('#4a3a20'));
  };
  const TAGS = ["THE DEEP DOESN'T KILL YOU. IT KEEPS YOU.", 'EVERY LIGHT YOU MAKE IS A PROMISE TO SOMETHING HUNGRY.', 'FOUR KILOMETRES OF WATER. ONE LAMP. NOBODY COMING.'];
  Hd.drawTitle = function () {
    // the logo, pressed on by the water: a dark band behind it, and now and then a row slips sideways
    const lw = Hd.tw('BENTHOS', 4), lx = Math.round((R.W - lw) / 2), ly = 26;
    R.shadeRect(0, ly - 10, R.W, 52, COL.k, 0.55);
    Hd.text(lx + 2, ly + 2, 'BENTHOS', COL.a0, 4);
    Hd.text(lx, ly, 'BENTHOS', amber(3), 4, true);
    const g = Math.floor(B.time * 3);
    if (B.hash2(g, 1, 3) > 0.82) {
      const row = ly + Math.floor(B.hash2(g, 2, 3) * 28), sh = B.hash2(g, 3, 3) > 0.5 ? 2 : -2, out = R.out32;
      for (let y = row; y < row + 2 + (g & 3); y++) { const r0 = y * R.W; const tmp = out.slice(r0 + lx - 4, r0 + lx + lw + 4); for (let x = 0; x < tmp.length; x++) { const tx = lx - 4 + x + sh; if (tx >= 0 && tx < R.W) out[r0 + tx] = tmp[x]; } }
    }
    Hd.center(ly + 34, 'THE SILENT PRESSURE', amber(2), 1, true);
    // the taglines surface and sink, one at a time
    const per = 7, k = Math.floor(B.time / per) % TAGS.length, ph = (B.time % per) / per, a = Math.min(1, ph * 5, (1 - ph) * 5);
    if (a > 0.05) { const t = TAGS[k], w = Hd.tw(t), x = Math.round((R.W - w) / 2); for (let i = 0; i < t.length; i++) if (B.hash2(i, k, 9) < a) Hd.text(x + i * 6, R.H - 26, t[i], COL.b10); }
    const n = 26 + B.meta.deaths;
    Hd.text(8, R.H - 12, 'THE ARCHIVE HOLDS ' + n, C32('#4a3a20'));
    if (doc) drawDoc();
    Hd.text(R.W - 8 - Hd.tw('V' + B.VERSION), R.H - 12, 'V' + B.VERSION, C32('#4a3a20'));
    if (menuS) drawMenu();
  };
  Hd.drawDead = function (t, cause) {
    R.shadeRect(0, 0, R.W, R.H, COL.k, Math.min(1, t * 1.5));
    if (t < 0.6) return;
    const CAUSE = { crush: 'HULL FAILURE', impact: 'HULL FAILURE', sleeper: 'HULL FAILURE', reliquary: 'HULL FAILURE', air: 'ASPHYXIA', co2: 'HYPERCAPNIA', procession: 'ENTANGLED', grain: 'HULL FAILURE', breach: '' };
    Hd.center(R.H / 2 - 40, 'SIGNAL LOST', amber(3), 3);
    if (CAUSE[cause]) Hd.center(R.H / 2 - 10, CAUSE[cause], amber(1));
    // what went wrong, in a line, for the first few deaths of each kind
    const k = B.k, HINT = {
      crush: 'BELOW YOUR RATING THE HULL TAKES DEBT. RISE, BRACE (HOLD ' + k('Q', 'CLMP') + ') OR GRAFT.',
      impact: 'SOMETHING HIT THE HULL. CRUSH DEBT MAKES EVERY BLOW WORSE.',
      sleeper: 'IT IS BLIND. IT HEARS THRUST AND FEELS A POWERED SUIT. COAST, OR BRACE AND POWER DOWN.',
      reliquary: 'IT ONLY FEEDS ON THE WEAK. KEEP YOUR AIR UP; HOLD IT IN THE WHITE LAMP AND IT CURLS.',
      air: 'O2 CARTRIDGES SWAP THEMSELVES WHILE YOU HAVE THEM. SALVAGE MORE ON THE LEDGES.',
      co2: 'WHEN THE HUD STARTS LYING, THE SCRUBBER IS SPENT. SWAP IT (' + k('T', 'TAP SCRUB') + ').',
      procession: 'THE CURTAIN SNARES WHAT TOUCHES IT. STRIKE THE FLOAT, OR SIPHON FREE.',
      grain: 'THE GRAIN STRIPS LIGHT AND HEAT. GO DARK, OR DROP A BLOOM AND LEAVE.',
    };
    const n = (B.meta.deathKinds && B.meta.deathKinds[cause]) || 0;
    if (HINT[cause] && n <= 3 && t > 1) { const lines = Hd.wrap(HINT[cause], Math.floor((R.W - 80) / 6)); lines.forEach((l, i) => Hd.center(R.H / 2 + (I.touchMode ? 58 : 46) + i * 9, l, COL.b10)); }
    if (menuS) drawMenu();
  };
  Hd.drawPause = function (snap, t) {
    // the longer you're away, the less of the picture remains
    const out = R.out32, k = M.clamp(t / 40, 0, 0.97);
    for (let y = 0; y < R.H; y++) for (let x = 0; x < R.W; x++) { const i = y * R.W + x; out[i] = B.hash2(x, y, 77) < k ? COL.k : snap[i]; }
    R.shadeRect(0, 0, R.W, R.H, COL.k, 0.35);
    if (doc) drawDoc();
    if (menuS) drawMenu();
  };

  // ------------------------------------------------------------------ sequences
  // The eleven seconds from Magpie-3, on Tobias's laptop.
  Hd.playFootage = function (done) {
    B.scene = {
      t: 0, world: true, dimWorld: true,
      update(dt) { this.t += dt; if (this.t > 13) { B.scene = null; B.mode = 'play'; done && done(); } if (this.t > 9 && !this.said) { this.said = true; A.voice('mara', 2.4); } if (this.t > 11.2 && !this.st) { this.st = true; A.sfx('static', null, 1.2); } },
      draw() {
        const t = this.t, w = Math.min(R.W - 40, 260), h = Math.round(w * 0.56), x0 = Math.round((R.W - w) / 2), y0 = Math.round((R.H - h) / 2) - 10;
        R.shadeRect(0, 0, R.W, R.H, COL.k, 0.8);
        box(x0 - 6, y0 - 6, w + 12, h + 20, C32('#1a1c20'), COL.g2);
        if (t > 11.2) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) R.pset(x0 + x, y0 + y, Math.random() < 0.5 ? COL.g2 : COL.k); if (t > 12) { R.rect(x0, y0, w, h, COL.k); Hd.center(y0 + h / 2 - 3, 'SIGNAL LOST', COL.g4); } return; }
        const focus = M.clamp((t - 4) / 2, 0, 1);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const u = x / w, v = y / h, n = B.noise2(x * 0.15 + t * 0.2, y * 0.25, 3) * 0.5 + B.noise2(x * 0.6, y * 0.8, 4) * 0.5;
          let l = (0.25 + v * 0.75) * (1 - Math.hypot(u - 0.5, v - 0.35) * 0.9) * (0.6 + n * 0.6);
          // the helmet on its side: shell, cracked visor, collar ring
          const rr = h * 0.2, cx = w * 0.5, cy = h * 0.56;
          const hx = (x - cx) / rr, hy = (y - cy) / (rr * 0.92), hd = hx * hx + hy * hy;
          const cxr = (x - cx) / (rr * 1.15), cyr = (y - cy - rr * 0.95) / (rr * 0.28);
          if (cxr * cxr + cyr * cyr < 1 && hd > 0.8) l = 0.3 + (cxr < -0.4 ? 0.15 : 0);
          if (hd < 1) {
            l = 0.48 + Math.max(0, -hx * 0.45 - hy * 0.55) * 0.5 - hd * 0.12;
            const vx = (x - cx - rr * 0.22) / (rr * 0.58), vy = (y - cy - rr * 0.08) / (rr * 0.52), vd = vx * vx + vy * vy;
            if (vd < 1) {
              l = 0.07 + (vx < -0.5 && vy < -0.4 ? 0.12 : 0);
              const ix = vx + 0.25, iy = vy + 0.15, ir = Math.hypot(ix, iy), ia = Math.atan2(iy, ix);
              if ((Math.abs(Math.sin(ia * 4 + 0.6)) < 0.07 && ir < 0.95) || Math.abs(ir - 0.32) < 0.05 || Math.abs(ir - 0.6) < 0.035) l = 0.8;
            }
          }
          if (focus < 1 && hd < 1.8) l *= 0.85 + B.hash2(x >> 1, y >> 1, Math.floor(t * 8)) * 0.3 * (1 - focus);
          const th = B.BAYER[(y & 3) * 4 + (x & 3)] + 0.5;
          const q = l * 4 + th * 0.9, c = q > 3.6 ? C32('#ffc05e') : q > 2.6 ? C32('#ff8f2a') : q > 1.6 ? C32('#8a5d3a') : q > 0.8 ? C32('#452c1a') : C32('#140c08');
          R.pset(x0 + x, y0 + y, c);
        }
        for (let k = 0; k < 30; k++) { const sx = (B.hash2(k, 1, 4) * w + t * 6 * (1 + k % 3)) % w, sy = (B.hash2(k, 2, 4) * h + t * 9) % h; R.pset(x0 + sx, y0 + sy, C32('#ffc05e')); }
        if (focus > 0.6) Hd.text(x0 + w * 0.5 - 18, y0 + h * 0.58 + h * 0.2 + 3, 'HV-0419', C32('#ffc05e'));
        Hd.text(x0 + 4, y0 + 4, 'MAGPIE-3 CAM1 2904M', C32('#ffc05e'));
        Hd.text(x0 + 4, y0 + h - 10, '03:12:' + String(Math.floor(t)).padStart(2, '0'), C32('#ffc05e'));
        if (t > 9) Hd.center(y0 + h + 18, '"HALCYON, FOUR-ONE-NINE. DEPTH ONE-ONE-FOUR-ZERO. I\'M—"', COL.g6);
      },
    };
    B.mode = 'scene';
  };

  // The Machine's Eye: a tethered camera with no palette to lie with, looking back at you.
  Hd.machineEye = function (done) {
    const P = B.player, L = B.Story.eyeLake;
    const a = Math.atan2(L.y - P.y, L.x - P.x);
    const cam = { x: P.x + Math.cos(a) * 3, y: P.y + Math.sin(a) * 3 - 1.5, z: P.z - 1 };
    A.sfx('click');
    B.scene = {
      t: 0, world: true, cam, lut: 'eye', hollow: true, res: [960, 540],
      update(dt) {
        this.t += dt;
        if (this.t > 7.5 && !this.f1) { this.f1 = true; A.sfx('eyeshut'); A.sfx('static', null, 0.6); }
        if (this.t > 9) { B.playRes(B.state.ng); B.SC = 1; B.PX = 12; B.PY = 8; B.PZ = 2.5; B.OFF = -30; B.scene = null; B.mode = 'play'; P.lockT = 1.5; P.reach = 1;
          // the arm moves on its own: tether torn, camera thrown into the brine
          const e = B.E.add({ type: 'eyeCam', x: P.x, y: P.y, z: P.z - 0.5, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, vz: -1, t: 0,
            update(dt2) { this.t += dt2; this.x += this.vx * dt2; this.y += this.vy * dt2; this.vx *= 0.97; this.vy *= 0.97; this.vz += dt2 * 1.5; this.z += this.vz * dt2; if (this.t > 30) this.alive = false; },
            draw() { R.model(this.x, this.y, this.z, B.MD.item('eye', 0), { minLight: 0.1 }); R.point(this.x + 0.2, this.y, this.z, 1, 2.4, 2.2, 1.8, 1); R.addLight(this.x, this.y, this.z, 1, 0.9, 0.8, 6, 1); } });
          void e; P.relics.eye = false; A.sfx('splash'); B.Story.say('hud', 'OPTICAL FAULT · CAMERA DISCARDED', { dur: 3 });
          done && done();
        }
      },
      draw() {
        R.addLight(cam.x, cam.y + 2, cam.z, 1, 1, 1, 34, 3.2); // the ROV's own lamps
        Hd.text(8, 8, 'MAGPIE-3 CAM1 · LIVE · 960X540 · 1-BIT', COL.g6, 2);
        Hd.text(8, R.H - 22, 'T+' + (71 + this.t / 60).toFixed(2) + ' H', COL.g6, 2);
        if (this.t > 7.5) { for (let k = 0; k < 2000; k++) R.pset(Math.random() * R.W, Math.random() * R.H, Math.random() < 0.5 ? COL.k : COL.g6); Hd.center(R.H / 2 - 7, 'OPTICAL FAULT · CAMERA DISCARDED', COL.g6, 2); }
      },
    };
    B.setRes(960, 540); B.SC = 2; B.PX = 24; B.PY = 16; B.PZ = 5; B.OFF = -60;
    R.addLight(cam.x, cam.y + 2, cam.z, 1, 1, 1, 34, 3.2);
    B.mode = 'scene';
  };

  // The Wren's 72 hours: every Mara who ever knelt at that helmet — one per death in this save.
  Hd.wrenFootage = function (done) {
    const log = (B.state.deathLog || []).slice(0, 40);
    const visits = log.map((d, i) => ({ res: d.res || 1, label: 'VISIT ' + String(i + 1).padStart(2, '0') + ' · ' + String(d.z).padStart(4, '0') + ' M · ' + (d.act === 'act1' ? 'I' : d.act === 'act2' ? 'II' : 'III') }));
    visits.push({ res: B.player.res, label: 'VISIT ' + String(visits.length + 1).padStart(2, '0') + ' · NOW', now: true });
    visits.push({ res: 4, label: 'VISIT ' + String(visits.length + 1).padStart(2, '0') + ' · T+71:58:02 · NOT YET ARRIVED', future: true });
    const per = Math.max(0.9, Math.min(2.2, 26 / visits.length));
    A.setLofi(4, 2600);
    B.scene = {
      t: 0, world: false,
      update(dt) { this.t += dt; if (Math.floor(this.t / per) !== this.last) { this.last = Math.floor(this.t / per); A.sfx('relay'); } if (this.t > visits.length * per + 2.5) { B.scene = null; B.mode = 'play'; done && done(); } if (I.pressed('back') && this.t > 2) this.t = visits.length * per + 2.4; },
      draw() {
        const W = R.W, Hh = R.H, out = R.out32, white = C32('#e6e6e0');
        const vi = Math.min(visits.length - 1, Math.floor(this.t / per)), v = visits[vi], k = (this.t % per) / per;
        for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
          const vv = y / Hh; let l = vv > 0.45 ? (0.08 + (vv - 0.45) * 0.5) * (0.7 + B.noise2(x * 0.08, y * 0.3, 8) * 0.6) : 0.02;
          const hx = (x - W * 0.42) / 22, hy = (y - Hh * 0.68) / 15, hd = hx * hx + hy * hy;
          if (hd < 1) l = 0.45 - hd * 0.2 + (hx < -0.3 && hy < -0.3 ? 0.3 : 0);
          out[y * W + x] = B.BAYER[(y & 3) * 4 + (x & 3)] + 0.5 < l * 1.6 ? white : COL.k;
        }
        // a figure arriving from the right and kneeling, drawn at the resolution of its death
        const s = v.res, fx = Math.round(M.lerp(W * 0.9, W * 0.52, Math.min(1, k * 1.6))), kneel = k > 0.6 ? 6 : 0, fy = Math.round(Hh * 0.68 - 30 + kneel);
        const blk = (bx, by, bw, bh) => { for (let y = 0; y < bh; y += s) for (let x = 0; x < bw; x += s) { const px = Math.floor((fx + bx + x) / s) * s, py = Math.floor((fy + by + y) / s) * s; R.rect(px, py, s, s, white); } };
        blk(-6, 0, 12, 11); blk(-9, 11, 18, 14); blk(-12, 13, 4, 10); blk(8, 13, 4, 10); blk(-7, 25 - kneel, 5, 10 - kneel / 2); blk(2, 25 - kneel, 5, 10 - kneel / 2);
        R.rect(Math.floor((fx - 3) / s) * s, Math.floor((fy + 3) / s) * s, 6 + (s > 1 ? s : 0), 4, COL.k);
        Hd.text(6, 6, 'WREN · MAGPIE-3 CAM1', white); Hd.text(6, 16, v.label, white);
        Hd.text(W - 6 - Hd.tw('T+' + String(Math.floor(this.t * 2.7 + vi * 3)).padStart(2, '0') + ':' + String(Math.floor(this.t * 37) % 60).padStart(2, '0')), 6, 'T+' + String(Math.floor(this.t * 2.7 + vi * 3)).padStart(2, '0') + ':' + String(Math.floor(this.t * 37) % 60).padStart(2, '0'), white);
        if (v.future && ((B.frame >> 3) & 1)) Hd.center(Hh - 20, 'THE NEXT ONE', white);
      },
    };
    B.mode = 'scene';
  };

  // ------------------------------------------------------------------ endings
  Hd.ending = function (which) {
    const P = B.player, S = B.Story;
    B.Story.clearCaps();
    if (which === 'ascent') {
      // For the only time in the game, up works.
      B.map = S.getMap('void'); B.E.reset(); B.act = 'act2';
      P.z = 4190; P.vx = P.vy = P.vz = 0; S.locked = true; S.surfacing = true;
      A.waltz('clean'); A.setLofi(16, 20000);
      let fid = P.fidelity;
      B.scene = {
        t: 0, world: true, follow: true,
        update(dt) {
          this.t += dt;
          if (this.surf) return;
          const sp = Math.min(70, 4 + this.t * 2.4);
          P.z = Math.max(0, P.z - sp * dt); P.yaw += dt * 0.05;
          if (P.z < 3000 && P.res > 2) P.res = 2; if (P.z < 1100 && P.res > 1) { P.res = 1; P.flipped = false; }
          const tf = Math.round(M.lerp(16, fid, P.z / 4190)); if (tf !== P.fidelity) { P.fidelity = tf; R.setFidelity(tf); }
          B.act = P.z < 1000 ? 'act1' : 'act2';
          if (P.z <= 0 && !this.surf) { this.surf = true; Hd.fade(2.5, () => { endDeck(); }, ''); }
        },
        draw() {
          const z = P.z; Hd.center(14, String(Math.round(z)).padStart(4, '0') + ' M', amber(3), 2);
        },
      };
      B.mode = 'scene';
    } else if (which === 'sediment') {
      const snap = new Uint32Array(R.out32);
      A.waltz && A.stopWaltz();
      B.scene = {
        t: 0, world: false, extraBeat: true,
        update(dt) { this.t += dt; if (this.t > 72 || (this.t > 14 && I.pressed('confirm'))) { credits(['SEDIMENT', '', 'SHE LAY DOWN AMONG THE OTHERS.', 'THE COUNT GAINED A BEAT.']); } },
        draw() {
          const t = this.t, out = R.out32, W = R.W, Hh = R.H;
          const steps = [1, 2, 4, 16, 240];
          const si = Math.min(steps.length - 1, Math.floor(t / 2.2));
          if (si < steps.length - 1) {
            const s = steps[si];
            for (let y = 0; y < Hh; y += s) for (let x = 0; x < W; x += s) { const c = snap[Math.min(Hh - 1, y + (s >> 1)) * W + Math.min(W - 1, x + (s >> 1))]; R.rect(x, y, s, s, c); }
          } else {
            R.rect(0, 0, W, Hh, COL.k);
            const beat = (Math.floor(t / 0.72) % 6) < 5 || t < 60;
            if (beat) R.pset(W >> 1, Hh >> 1, C32('#091728'));
            if (t > 14) Hd.center(Hh - 14, I.touchMode ? 'TAP' : 'PRESS ENTER', C32('#0e2338'));
          }
          void out;
        },
      };
      B.mode = 'scene';
    } else if (which === 'lossless') {
      B.scene = {
        t: 0, world: true, ostinato: 0,
        update(dt) {
          this.t += dt;
          if (this.t < 3 && Math.floor(this.t * 3) !== this.pc) { this.pc = Math.floor(this.t * 3); if ([0, 1, 2, 3, 5, 7, 8].includes(this.pc)) A.sfx('ping'); }
          if (this.t > 6 && !this.face) { this.face = true; Hd.flashFace(); }
          if (this.t > 7) { credits(['LOSSLESS', '', 'HALVARD HYDROPHONE LOG: OSTINATO CEASED · 06:14', 'MEMO: HV PROGRAMME SUSPENDED · HV-0420 STANDS DOWN', '', 'NOBODY ON THE SHIP REMEMBERS WHY THEY WERE WORRIED.', 'MARA IS FORGOTTEN.', 'NOBODY ELSE WILL HAVE TO BE.']); }
        },
        draw() { if (this.t > 3.5) R.rect(0, 0, R.W, R.H, COL.k); },
      };
      B.mode = 'scene';
    }
  };
  function endDeck() {
    const S = B.Story, P = B.player;
    S.surfacing = false; B.act = 'deck'; B.map = S.getMap('deck'); B.E.reset(); A.stopWaltz();
    P.x = 18; P.y = 32; P.z = -3.6; P.res = 1;
    const E = B.E, MD = B.MD;
    E.prop(MD.aframe, 13, 32, -3, {});
    E.prop(t => MD.diver({ yaw: 0, pitch: -1.45, t: 0, plain: [], lamp: 'off' }), 18, 32, -3.5, {});
    E.prop(t => [R.P.e(0, 0, 0, [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [0.9, 0.28, 0.12], B.linHex('#6b5a44')), R.P.s(-1, 0, -0.05, 0.2, B.linHex('#6b5a44')), R.P.c([0.4, 0.2, 0], [0.9, 0.5, 0], 0.08, B.linHex('#6b5a44')), R.P.c([0.4, -0.2, 0], [0.9, -0.5, 0], 0.08, B.linHex('#6b5a44'))], 18, 34.5, -3.1, {});
    E.prop(t => MD.person({ yaw: Math.PI / 2, t, suit: '#d8b020', hat: '#b02a1a' }), 18.5, 30.2, -3.9, {});
    E.prop(t => MD.person({ yaw: -Math.PI / 2, t, suit: '#3a4a5a', vest: '#c8e020' }), 19.5, 36, -3.9, {});
    E.prop(t => MD.person({ yaw: Math.PI, t, suit: '#3a4a5a', vest: '#ff7a1a' }), 21, 33, -3.9, {});
    // HV-0420 goes over the side
    const t0 = B.time, low = () => Math.min(8, Math.max(0, B.time - t0 - 16) * 0.5);
    E.prop(() => MD.cage({ lit: true }), 11.2, 32, -4.4, { update() { this.z = -4.4 + low(); } });
    E.prop(t => MD.diver({ yaw: 0, t, plain: [], lamp: 'white' }), 11.2, 32, -4.3, { update() { this.z = -4.3 + low(); } });
    B.scene = {
      t: 0, world: true, cam: { x: 18, y: 33, z: -3.6 }, topside: true,
      update(dt) {
        this.t += dt;
        if (this.t > 1 && !this.a) { this.a = true; Hd.fadeIn(2); S.convo([['hud', 'DAWN. THE CREW HAUL HV-0419 ONTO THE DECK.'], ['tobias', 'CRACK THE HELMET.'], ['new', "...IT'S FULL OF SILT."], ['new', "IT'S SHAPED LIKE—"], ['tobias', 'UPLOAD THE WREN. FILE THE CLAIM.'], ['hud', 'HV-0420 GOES INTO THE WATER AT 06:40.']]); }
        if (this.t > 34) credits(['ASCENT', '', 'THE CLAIM WAS FILED AT 06:14.', 'HV-0420 WENT INTO THE WATER AT 06:40.', '', 'NEW GAME+: SECOND COPY (320×180)']);
      },
      draw() {},
    };
    B.mode = 'scene';
  }
  // One frame at full display resolution, drawn on a DOM canvas over the game: the only uncompressed image.
  Hd.flashFace = function () {
    const cv = document.createElement('canvas'); cv.width = innerWidth; cv.height = innerHeight;
    Object.assign(cv.style, { position: 'fixed', inset: '0', zIndex: 20, pointerEvents: 'none' });
    const c = cv.getContext('2d'), w = cv.width, h = cv.height, s = Math.min(w, h);
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    let g = c.createRadialGradient(cx - s * 0.05, cy - s * 0.08, s * 0.02, cx, cy, s * 0.42);
    g.addColorStop(0, '#e8c0a0'); g.addColorStop(0.55, '#a06a50'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, s * 0.24, s * 0.32, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a120c'; c.beginPath(); c.ellipse(cx, cy - s * 0.2, s * 0.27, s * 0.18, 0, Math.PI, 0); c.fill();
    for (const ex of [-1, 1]) { c.fillStyle = '#f0e8e0'; c.beginPath(); c.ellipse(cx + ex * s * 0.09, cy - s * 0.03, s * 0.04, s * 0.018, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#3a5a5a'; c.beginPath(); c.arc(cx + ex * s * 0.09, cy - s * 0.03, s * 0.014, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = '#6a3a2a'; c.lineWidth = s * 0.006; c.beginPath(); c.moveTo(cx - s * 0.05, cy + s * 0.13); c.quadraticCurveTo(cx, cy + s * 0.15, cx + s * 0.05, cy + s * 0.13); c.stroke();
    g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(10,20,30,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0.6)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    document.body.appendChild(cv);
    requestAnimationFrame(() => requestAnimationFrame(() => cv.remove()));
  };
  function credits(lines) {
    const all = lines.concat(['', '', 'BENTHOS: THE SILENT PRESSURE', '', 'A DESCENT IN PIXELS, LIGHT AND WATER.', 'EVERYTHING YOU SAW AND HEARD WAS GENERATED BY CODE.', '', 'DESIGN DOCUMENT: BENTHOS/DESIGN.MD', '', 'THE DEEP KEEPS ORDER, NOT TIME.']);
    A.setLofi(16, 20000);
    B.scene = {
      t: 0, world: false, ostinato: 0,
      update(dt) { this.t += dt; if (this.t > 6 + all.length * 1.2 || (this.t > 3 && I.pressed('confirm'))) { B.scene = null; B.toTitle(); } },
      draw() { R.rect(0, 0, R.W, R.H, COL.k); all.forEach((l, k) => { const y = R.H - this.t * 14 + k * 11 + 20; if (y > -10 && y < R.H) Hd.center(y, l, k === 0 ? amber(3) : amber(2)); }); },
    };
    B.mode = 'scene';
  }
  Hd.credits = credits;
})(window.B);
