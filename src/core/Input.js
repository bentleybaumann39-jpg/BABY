// Keyboard/mouse input with pointer lock and per-frame edge detection.
export const BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  crouch: ['KeyC', 'ControlLeft'],
  interact: ['KeyE'],
  flashlight: ['KeyF'],
  reload: ['KeyR'],
  breath: ['Space'],
  journal: ['Tab', 'KeyJ'],
  pause: ['Escape', 'KeyP'],
  throw: ['KeyQ'],
  map: ['KeyM'],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = [false, false, false];
    this.mousePressed = [false, false, false];
    this.mouseReleased = [false, false, false];
    this.wheel = 0;
    this.locked = false;
    this.enabled = true;
    this.synthetic = false; // test harness drives input

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener('blur', () => { this.down.clear(); this.mouseDown = [false, false, false]; });
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mouseup', (e) => {
      if (e.button < 3) { this.mouseDown[e.button] = false; this.mouseReleased[e.button] = true; }
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked && !this.synthetic) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
    window.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  onMouseDown(e) {
    if (e.button < 3) { this.mouseDown[e.button] = true; this.mousePressed[e.button] = true; }
  }

  requestLock() {
    if (this.synthetic) return;
    try {
      const p = this.canvas.requestPointerLock?.({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { this.canvas.requestPointerLock(); } catch { /* ignore */ } });
    } catch { /* ignore */ }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  is(action) { return BINDINGS[action].some((k) => this.down.has(k)); }
  hit(action) { return BINDINGS[action].some((k) => this.pressed.has(k)); }
  up(action) { return BINDINGS[action].some((k) => this.released.has(k)); }

  consumeMouse() {
    const d = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = 0; this.mouseDY = 0;
    return d;
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mousePressed = [false, false, false];
    this.mouseReleased = [false, false, false];
    this.wheel = 0;
  }

  // Test harness helpers
  simKey(code, isDown) {
    if (isDown) { if (!this.down.has(code)) this.pressed.add(code); this.down.add(code); }
    else { this.down.delete(code); this.released.add(code); }
  }
  simMouse(button, isDown) {
    this.mouseDown[button] = isDown;
    if (isDown) this.mousePressed[button] = true; else this.mouseReleased[button] = true;
  }
  simLook(dx, dy) { this.mouseDX += dx; this.mouseDY += dy; }
}
