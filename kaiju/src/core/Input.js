// Keyboard + mouse (pointer lock) + gamepad, folded into one per-frame action state.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { dx: 0, dy: 0, buttons: 0, pressed: 0, wheel: 0 };
    this.locked = false;
    this.sens = 1;
    this.invertY = false;
    this.enabled = true;
    this.pad = null;
    this.padPrev = [];
    this.lastDevice = 'kbm';
    this._bind();
  }

  _bind() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      this.lastDevice = 'kbm';
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code) && this.locked) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.buttons = 0; });
    this.canvas.addEventListener('mousedown', (e) => {
      this.mouse.buttons |= 1 << e.button;
      this.mouse.pressed |= 1 << e.button;
      this.lastDevice = 'kbm';
    });
    addEventListener('mouseup', (e) => { this.mouse.buttons &= ~(1 << e.button); });
    addEventListener('mousemove', (e) => {
      // captured mouse looks freely; where capture is refused (some embeds and app views),
      // dragging with a button held still turns the camera
      if (!this.locked && !this.mouse.buttons) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });
    addEventListener('wheel', (e) => { if (this.locked || e.target === this.canvas) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === this.canvas; });
  }

  lock() {
    if (this.locked) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => {
        try { const q = this.canvas.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch (e) { /* not available */ }
      });
    } catch (e) { /* not available in this context */ }
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  // Call once per frame before reading actions.
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this.pad = null;
    for (const p of pads) if (p && p.connected) { this.pad = p; break; }
    this.padPressed = [];
    if (this.pad) {
      const b = this.pad.buttons.map((x) => x.pressed);
      for (let i = 0; i < b.length; i++) if (b[i] && !this.padPrev[i]) { this.padPressed[i] = true; this.lastDevice = 'pad'; }
      if (Math.abs(this.pad.axes[0]) + Math.abs(this.pad.axes[1]) > 0.4) this.lastDevice = 'pad';
      this.padPrev = b;
    }
  }

  // Call once per frame after the game consumed the frame's input.
  endFrame() {
    this.pressed.clear();
    this.mouse.pressed = 0;
    this.mouse.dx = this.mouse.dy = 0;
    this.mouse.wheel = 0;
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  padDown(i) { return !!(this.pad && this.pad.buttons[i] && this.pad.buttons[i].pressed); }
  padHit(i) { return !!(this.padPressed && this.padPressed[i]); }
  dead(v, d = 0.18) { return Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d); }

  // Normalised gameplay intents.
  get move() {
    let x = 0, y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.pad) { x += this.dead(this.pad.axes[0]); y -= this.dead(this.pad.axes[1]); }
    const l = Math.hypot(x, y);
    return l > 1 ? { x: x / l, y: y / l } : { x, y };
  }
  get look() {
    let x = this.mouse.dx * 0.0022 * this.sens, y = this.mouse.dy * 0.0022 * this.sens;
    if (this.pad) { x += this.dead(this.pad.axes[2], 0.15) * 0.045 * this.sens; y += this.dead(this.pad.axes[3], 0.15) * 0.03 * this.sens; }
    return { x, y: this.invertY ? -y : y };
  }
  get sprint() { return this.down('ShiftLeft') || this.down('ShiftRight') || this.padDown(10) || this.padDown(4); }
  get attack() { return !!(this.mouse.pressed & 1) || this.padHit(2) || this.padHit(7); }
  get heavy() { return !!(this.mouse.pressed & 4) || this.hit('KeyR') || this.padHit(3) || this.padHit(5); }
  get special() { return this.down('KeyQ') || this.down('KeyF') || !!(this.mouse.buttons & 2) || this.padDown(6); }
  get stomp() { return this.hit('Space') || this.padHit(0); }
  get roar() { return this.hit('KeyE') || this.padHit(1); }
  get pause() { return this.hit('Escape') || this.hit('KeyP') || this.padHit(9); }
  get zoom() { return this.mouse.wheel; }
}
