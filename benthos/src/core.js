/* BENTHOS: THE SILENT PRESSURE
 * core.js — namespace, constants, math, noise, input and persistence.
 * Every file is a classic script that adds to window.B, so the game runs from file:// with no build step. */
'use strict';
window.B = window.B || {};
(function (B) {
  B.VERSION = '0.1.0';

  // Internal resolution (New Game+ drops to 320x180, see B.setRes).
  B.W = 480; B.H = 270;
  // Compressed world projection: 12 px per metre east-west, 8 px per metre north-south, 2.5 px per metre of depth.
  // The trench is far too deep to draw at scale, so depth is squashed. Models (suits, creatures) use the
  // natural camera below so they are not squashed with it.
  B.PX = 12; B.PY = 8; B.PZ = 2.5; B.SC = 1; // SC doubles everything for the Machine's Eye (finer, not wider)
  B.SN = 0.6667; B.CS = 0.7454; // natural camera elevation (sin, cos), about 42 degrees
  B.OFF = -30;                   // the diver sits a little above the centre so more of "below" is visible

  // ---------------------------------------------------------------- math
  const M = B.M = {
    clamp: (v, a, b) => v < a ? a : v > b ? b : v,
    lerp: (a, b, t) => a + (b - a) * t,
    smooth(a, b, v) { const t = M.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); },
    len2: (x, y) => Math.sqrt(x * x + y * y),
    len3: (x, y, z) => Math.sqrt(x * x + y * y + z * z),
    d3: (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2),
    d2: (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2),
    wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; },
    approach(v, target, step) { return v < target ? Math.min(target, v + step) : Math.max(target, v - step); },
    rnd: (a, b) => a + Math.random() * (b - a),
    pick: arr => arr[(Math.random() * arr.length) | 0],
    chance: p => Math.random() < p,
  };

  // Seeded RNG (mulberry32).
  B.rng = function (seed) {
    let s = seed >>> 0;
    const f = function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (a, b) => a + f() * (b - a);
    f.int = (a, b) => (a + f() * (b - a + 1)) | 0;
    return f;
  };

  // ---------------------------------------------------------------- noise
  function hash2(ix, iy, seed) {
    let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  B.hash2 = hash2;
  B.noise2 = function (x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const s = seed | 0;
    const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
  B.fbm2 = function (x, y, oct, seed) {
    let v = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { v += amp * B.noise2(x * f, y * f, seed + i * 17); norm += amp; amp *= 0.5; f *= 2.03; }
    return v / norm;
  };
  B.noise1 = (x, seed) => B.noise2(x, 0.5, seed);

  // ---------------------------------------------------------------- input
  const KEYMAP = {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    boost: ['ShiftLeft', 'ShiftRight'], rise: ['Space'], sink: ['KeyC'], ping: ['KeyR'], lamp: ['KeyF'],
    interact: ['KeyE'], clamp: ['KeyQ'], powerhead: ['KeyX'], graft: ['KeyG'], breath: ['KeyV'], gauge: ['KeyH'],
    craft: ['Tab'], map: ['KeyM'], pause: ['Escape', 'KeyP'], wipe: ['KeyZ'], swap: ['KeyT'], listen: [], lens: ['KeyB'],
    c1: ['Digit1'], c2: ['Digit2'], c3: ['Digit3'], c4: ['Digit4'], c5: ['Digit5'],
    confirm: ['Enter', 'Space', 'KeyE'], back: ['Escape', 'Backspace'],
    mUp: ['ArrowUp', 'KeyW'], mDown: ['ArrowDown', 'KeyS'], mLeft: ['ArrowLeft', 'KeyA'], mRight: ['ArrowRight', 'KeyD'],
  };
  // Gamepad (standard mapping) button -> actions.
  const PADMAP = {
    0: ['interact', 'confirm'], 1: ['clamp', 'back'], 2: ['ping'], 3: ['lamp'], 4: ['rise'], 5: ['sink'],
    6: ['listen'], 7: ['boost'], 8: ['craft'], 9: ['pause'], 10: ['breath'], 11: ['pick'],
    12: ['mUp', 'useCell'], 13: ['mDown', 'gauge'], 14: ['mLeft', 'cPrev'], 15: ['mRight', 'cNext'],
  };
  const codeToActions = {};
  for (const a in KEYMAP) for (const c of KEYMAP[a]) (codeToActions[c] = codeToActions[c] || []).push(a);

  const I = B.I = {
    state: {}, hit: {}, up: {}, padPrev: {}, padNow: {},
    mouse: { x: 240, y: 135, moved: 0, inside: false, b0: false, b2: false },
    aimPad: { x: 0, y: 0 }, usingPad: false, anyHit: false, wheel: 0,
    // touch: a floating stick on the left, buttons on the right (layout from B.touchLayout in hud.js)
    touchMode: false, touch: { stick: null, mx: 0, my: 0, held: {}, ptrs: new Map(), refs: {} },
    down(a) { return !!(I.state[a] || I.padNow[a]); },
    pressed(a) { return !!(I.hit[a] || (I.padNow[a] && !I.padPrev[a])); },
    released(a) { return !!(I.up[a] || (!I.padNow[a] && I.padPrev[a])); },
    move() {
      let x = 0, y = 0;
      if (I.state.left) x -= 1; if (I.state.right) x += 1; if (I.state.up) y -= 1; if (I.state.down) y += 1;
      const p = I.pad;
      if (p) { const ax = p.axes[0] || 0, ay = p.axes[1] || 0; if (Math.abs(ax) > 0.18 || Math.abs(ay) > 0.18) { x += ax; y += ay; } }
      if (I.touch.stick) { x += I.touch.mx; y += I.touch.my; }
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      return { x, y };
    },
    // Called once per fixed update, after the game has read edges.
    endTick() { I.hit = {}; I.up = {}; I.anyHit = false; I.wheel = 0; I.padPrev = I.padNow; },
    poll() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let p = null; for (const g of pads) if (g && g.connected) { p = g; break; }
      I.pad = p; const now = {};
      if (p) {
        p.buttons.forEach((b, i) => { if (b.pressed && PADMAP[i]) for (const a of PADMAP[i]) now[a] = true; });
        const rx = p.axes[2] || 0, ry = p.axes[3] || 0;
        if (Math.hypot(rx, ry) > 0.3) { I.aimPad.x = rx; I.aimPad.y = ry; I.usingPad = true; }
        if (p.buttons.some(b => b.pressed) || Math.abs(p.axes[0] || 0) > 0.4) I.usingPad = true;
        if (p.buttons.some((b, i) => b.pressed && !(I.padPrev.__raw || [])[i])) I.anyHit = true;
        now.__raw = p.buttons.map(b => b.pressed);
      }
      I.padNow = now;
    },
    rumble(strong, weak, ms) {
      if (!B.settings.rumble) return;
      if (I.touchMode) { I.buzz(Math.min(ms, 200) * (strong > 0.5 ? 1 : 0.5)); return; }
      const p = I.pad; if (!p || !p.vibrationActuator) return;
      try { p.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) { /* unsupported */ }
    },
    buzz(ms) { if (I.touchMode && B.settings.rumble && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* unsupported */ } },
  };
  function keyEvt(e, down) {
    const acts = codeToActions[e.code];
    if (acts || e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    if (down && e.repeat) return;
    if (down) I.anyHit = true;
    I.usingPad = false;
    if (!acts) return;
    for (const a of acts) {
      if (down) { if (!I.state[a]) I.hit[a] = true; I.state[a] = true; }
      else { if (I.state[a]) I.up[a] = true; I.state[a] = false; }
    }
    if (down && B.onKey) B.onKey(e);
  }
  addEventListener('keydown', e => keyEvt(e, true));
  addEventListener('keyup', e => keyEvt(e, false));
  addEventListener('blur', () => { for (const a in I.state) if (I.state[a]) { I.state[a] = false; I.up[a] = true; } I.mouse.b0 = I.mouse.b2 = false; I.state.pick = false; I.state.listen = false; if (B.onBlur) B.onBlur(); });
  // a control named the way this player holds the game: B.k('Q', 'CLMP') -> 'Q' or 'CLMP'
  B.k = (key, thumb) => (I.touchMode ? thumb : key);
  B.bindMouse = function (canvas) {
    const toInternal = e => {
      const r = canvas.getBoundingClientRect(); const o = B.out || { x: 0, y: 0, w: r.width, h: r.height };
      I.mouse.x = (e.clientX - r.left - o.x) / o.w * B.W;
      I.mouse.y = (e.clientY - r.top - o.y) / o.h * B.H;
    };
    canvas.addEventListener('mousemove', e => { toInternal(e); I.mouse.moved = 1; I.usingPad = false; I.mouse.inside = true; });
    canvas.addEventListener('mousedown', e => {
      toInternal(e); I.anyHit = true; I.usingPad = false;
      if (e.button === 0) { I.mouse.b0 = true; I.hit.pick = true; I.state.pick = true; I.hit.click = true; }
      if (e.button === 2) { I.mouse.b2 = true; I.hit.listen = true; I.state.listen = true; }
      if (B.onGesture) B.onGesture();
    });
    addEventListener('mouseup', e => {
      if (e.button === 0) { I.mouse.b0 = false; I.up.pick = true; I.state.pick = false; }
      if (e.button === 2) { I.mouse.b2 = false; I.up.listen = true; I.state.listen = false; }
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { I.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    addEventListener('keydown', () => { if (B.onGesture) B.onGesture(); });
    bindTouch(canvas, toInternal);
  };

  // Touch. Each finger is classified when it lands: on a button (from B.touchLayout), on the left
  // half (the floating stick), elsewhere in play (aim at that point), or outside play (a click).
  const T = I.touch;
  function press(a) { T.refs[a] = (T.refs[a] || 0) + 1; if (!I.state[a]) I.hit[a] = true; I.state[a] = true; }
  function release(a) { T.refs[a] = Math.max(0, (T.refs[a] || 0) - 1); if (!T.refs[a]) { if (I.state[a]) I.up[a] = true; I.state[a] = false; } }
  function bindTouch(canvas, toInternal) {
    const STICK = 26; // stick radius in 480-wide buffer pixels
    const sc = () => B.W / 480;
    const hitBtn = (lay, x, y) => { let best = null, bd = 1e9; for (const b of lay) { const d = Math.hypot(x - b.x, y - b.y) - (b.r + 6) * sc(); if (d < 0 && d < bd) { bd = d; best = b; } if (b.w && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b; } return best; };
    const setActs = (t, acts) => { const old = t.acts || []; for (const a of acts) if (!old.includes(a)) press(a); for (const a of old) if (!acts.includes(a)) release(a); t.acts = acts; };
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* synthetic */ }
      I.touchMode = true; I.usingPad = false; I.anyHit = true; I.mouse.inside = false;
      if (B.onGesture) B.onGesture();
      toInternal(e); const x = I.mouse.x, y = I.mouse.y;
      const lay = B.touchLayout ? B.touchLayout() : null;
      const t = { id: e.pointerId, x0: x, y0: y, x, y, t0: performance.now(), kind: 'click', acts: [] };
      if (lay) {
        const b = hitBtn(lay, x, y);
        if (b) { t.kind = 'btn'; t.btn = b; setActs(t, b.split ? (y < b.y + b.h / 2 ? b.acts : b.acts2) : b.acts); T.held[b.id] = true; I.buzz(8); }
        else if (x < B.W / 2 && !T.stick) { t.kind = 'stick'; T.stick = { id: e.pointerId, x0: x, y0: y, x, y }; T.mx = T.my = 0; }
        else { t.kind = 'aim'; I.mouse.inside = true; }
      } else {
        I.mouse.moved = 1; I.hit.click = true;
        if (B.mode === 'scene') { I.hit.confirm = true; }
      }
      T.ptrs.set(e.pointerId, t);
    }, { passive: false });
    canvas.addEventListener('pointermove', e => {
      const t = T.ptrs.get(e.pointerId); if (!t) return;
      e.preventDefault(); toInternal(e); t.x = I.mouse.x; t.y = I.mouse.y;
      if (t.kind === 'stick' && T.stick) {
        const s = T.stick, R = STICK * sc(); let dx = t.x - s.x0, dy = t.y - s.y0; const d = Math.hypot(dx, dy);
        // drag past the ring and the base follows the finger, like a trailing anchor
        if (d > R * 1.6) { s.x0 += dx / d * (d - R * 1.6); s.y0 += dy / d * (d - R * 1.6); dx = t.x - s.x0; dy = t.y - s.y0; }
        s.x = t.x; s.y = t.y; const n = Math.min(1, Math.hypot(dx, dy) / R);
        const l = Math.hypot(dx, dy) || 1; T.mx = dx / l * n; T.my = dy / l * n;
        setActs(t, Math.hypot(dx, dy) > R * 1.25 ? ['boost'] : []);
      } else if (t.kind === 'btn' && t.btn.split) setActs(t, t.y < t.btn.y + t.btn.h / 2 ? t.btn.acts : t.btn.acts2);
      else if (t.kind === 'aim') I.mouse.inside = true;
      else if (t.kind === 'click') I.mouse.moved = 1;
    }, { passive: false });
    const end = e => {
      const t = T.ptrs.get(e.pointerId); if (!t) return;
      T.ptrs.delete(e.pointerId); setActs(t, []);
      if (t.kind === 'btn') { T.held[t.btn.id] = false; if (t.btn.tap && performance.now() - t.t0 < 450) t.btn.tap(); }
      if (t.kind === 'stick') { T.stick = null; T.mx = T.my = 0; }
      if (t.kind === 'aim' && ![...T.ptrs.values()].some(o => o.kind === 'aim')) I.mouse.inside = false;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    // a real mouse moving again hands control back to the mouse
    canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && I.touchMode && Math.abs(e.movementX) + Math.abs(e.movementY) > 3) I.touchMode = false; });
  }

  // ---------------------------------------------------------------- persistence
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  B.store = store;
  const SET_DEF = { master: 0.8, music: 0.7, crt: true, photo: false, honest: false, steady: false, captions: true, rumble: true, shake: true, markers: true, difficulty: 1, quality: 1 };
  B.settings = Object.assign({}, SET_DEF, store.get('benthos.settings', {}));
  for (const k in B.settings) if (!(k in SET_DEF) || typeof B.settings[k] !== typeof SET_DEF[k]) B.settings[k] = SET_DEF[k];
  B.saveSettings = () => store.set('benthos.settings', B.settings);
  // Difficulty: 0 story, 1 diver, 2 abyssal. Scales air use, damage taken and crush accumulation.
  B.DIFF = [{ name: 'STORY', air: 0.6, hurt: 0.5, crush: 0.6 }, { name: 'DIVER', air: 1, hurt: 1, crush: 1 }, { name: 'ABYSSAL', air: 1.3, hurt: 1.4, crush: 1.3 }];
  B.diff = () => B.DIFF[M.clamp(B.settings.difficulty | 0, 0, 2)];
  B.meta = Object.assign({ deaths: 0, endings: [], ngplus: false, runs: 0 }, store.get('benthos.meta', {}));
  B.saveMeta = () => store.set('benthos.meta', B.meta);
})(window.B);
