// Keyboard / mouse / pointer-lock input. Mouse deltas accumulate until read each frame.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();     // edge-triggered this frame
    this.mouse = { dx: 0, dy: 0, b: 0, wheel: 0 };
    this.mousePressed = 0;
    this.locked = false;
    this.enabled = false;
    this.forced = false;          // automated tests: behave as if the pointer is locked
    this.onKey = null;            // (code, down) for UI hooks
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (this.enabled && ['Tab', 'Space', 'AltLeft', 'ControlLeft', 'KeyF', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Quote', 'Slash'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (this.onKey) this.onKey(e.code, true, e);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); if (this.onKey) this.onKey(e.code, false, e); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.b = 0; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (!this.locked) { this.lock(); return; }
      this.mouse.b |= 1 << e.button; this.mousePressed |= 1 << e.button; e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => { this.mouse.b &= ~(1 << e.button); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => { if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    window.addEventListener('wheel', (e) => { if (this.locked) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = this.forced || document.pointerLockElement === canvas;
      if (!this.locked) { this.mouse.b = 0; }
      if (this.onLock) this.onLock(this.locked);
    });
  }
  lock() { if (this.forced) { this.locked = true; return; } if (this.canvas.requestPointerLock) { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  btn(i) { return !!(this.mouse.b & (1 << i)); }
  btnHit(i) { return !!(this.mousePressed & (1 << i)); }
  endFrame() { this.pressed.clear(); this.mousePressed = 0; this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0; }
}
