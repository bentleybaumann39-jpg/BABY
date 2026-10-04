// First-person controller: movement, collision, stamina, breath, fear, footsteps, flashlight, recorder,
// hiding. Emits noise events that the Remainder can hear.
import * as THREE from 'three';
import { canvasTex } from '../world/Decor.js';

const RADIUS = 0.3;
const EYE_STAND = 1.62, EYE_CROUCH = 0.98;

export class Player {
  constructor(game) {
    this.game = game;
    this.camera = game.camera;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector2();
    this.yaw = 0; this.pitch = 0;
    this.crouch = 0; this.crouched = false;
    this.stamina = 1; this.exhausted = false;
    this.breathHold = 1; this.holdingBreath = false;
    this.fear = 0;
    this.stepPhase = 0; this.lastStepSide = 0;
    this.bob = 0; this.roll = 0;
    this.hiding = null;
    this.alive = true;
    this.frozen = false;
    this.moving = false;
    this.speed = 0;
    this.breathTimer = 1.5;
    this.heartTimer = 1;
    this.stillTime = 0;
    this.lastSteps = [];
    this.footstepListeners = [];
    this.lookOverride = null;
    this.buildFlashlight();
    this.buildViewmodel();
  }

  // ---------------------------------------------------------------- flashlight
  buildFlashlight() {
    const g = this.game;
    const s = new THREE.SpotLight(0xfff1dc, 0, 26, 0.5, 0.55, 1.8);
    s.castShadow = g.settings.q.shadows;
    s.shadow.mapSize.set(g.settings.q.shadowSize, g.settings.q.shadowSize);
    s.shadow.bias = -0.0006; s.shadow.normalBias = 0.03;
    s.shadow.camera.near = 0.15; s.shadow.camera.far = 28;
    s.shadow.radius = 2;
    // Lens cookie: hot centre, ring, faint dark smudges.
    s.map = canvasTex(256, 256, (c, w, h) => {
      const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.2, '#f6f2e8'); gr.addColorStop(0.34, '#b4b0a6'); gr.addColorStop(0.42, '#d0ccc2'); gr.addColorStop(0.6, '#77746e'); gr.addColorStop(0.85, '#3a3938'); gr.addColorStop(1, '#000');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 18, 0, 7); c.fill(); }
    });
    this.flash = s;
    this.flashTarget = new THREE.Object3D();
    s.target = this.flashTarget;
    g.scene.add(s, this.flashTarget);
    this.flashOn = false;
    this.battery = 1;          // current cell 0..1
    this.flashDir = new THREE.Vector3(0, 0, -1);
    this.flashFlicker = 0;
  }

  toggleFlashlight(force) {
    const on = force ?? !this.flashOn;
    if (on && this.battery <= 0.001) {
      this.game.audio?.play('click', { gain: 0.5 });
      this.game.ui.hint('The flashlight is dead. [R] to change battery.', 2.5);
      return;
    }
    this.flashOn = on;
    this.game.audio?.play('flashOn', { gain: 0.6, jitter: 0.1 });
    this.game.noiseEvent(this.pos.x, this.pos.z, 0.06, 'flashlight', 'flashClick');
    this.game.playerModel?.note('flashToggle');
  }

  reloadBattery() {
    const inv = this.game.inventory;
    if (inv.count('battery') <= 0) { this.game.ui.hint('No spare batteries.', 2); return; }
    if (this.battery > 0.9) { this.game.ui.hint('The battery is still fresh.', 1.5); return; }
    inv.remove('battery');
    this.battery = 1;
    this.game.audio?.play('battery');
    this.game.ui.notify('Battery replaced');
  }

  // ---------------------------------------------------------------- viewmodel (recorder + torch)
  buildViewmodel() {
    const vm = this.vm = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(60, 1, 0.01, 10) };
    vm.scene.add(new THREE.AmbientLight(0xffffff, 0.05));
    this.vmLight = new THREE.PointLight(0xfff0dd, 0, 2, 1.5);
    this.vmLight.position.set(0.3, 0.3, 0.2);
    vm.scene.add(this.vmLight);
    const mats = this.game.mats;
    // Recorder: body, cassette window, VU meter screen
    const rec = this.recorder = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.045), mats.prop('greyPlastic'));
    rec.add(body);
    this.vuCanvas = document.createElement('canvas');
    this.vuCanvas.width = 256; this.vuCanvas.height = 128;
    this.vuTex = new THREE.CanvasTexture(this.vuCanvas);
    this.vuTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), new THREE.MeshBasicMaterial({ map: this.vuTex }));
    screen.position.set(-0.02, 0.012, 0.0231);
    rec.add(screen);
    this.recLed = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), new THREE.MeshBasicMaterial({ color: 0x220000 }));
    this.recLed.position.set(0.055, 0.03, 0.024);
    rec.add(this.recLed);
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.008, 0.012), mats.prop('blackPlastic')); b.position.set(-0.045 + k * 0.024, 0.054, 0.0); rec.add(b); }
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.05, 10), mats.prop('steelDark'));
    mic.position.set(0.06, 0.07, 0); rec.add(mic);
    rec.position.set(0.14, -0.3, -0.32);
    rec.rotation.set(-0.15, -0.25, 0);
    vm.scene.add(rec);
    this.recRaise = 0;
    this.vuNeedle = 0;
    // Torch
    const torch = this.torch = new THREE.Group();
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.18, 12), mats.prop('steelDark'));
    tb.rotation.x = Math.PI / 2; torch.add(tb);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.05, 14), mats.prop('chrome'));
    head.rotation.x = Math.PI / 2; head.position.z = -0.1; torch.add(head);
    this.torchLens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 16), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    this.torchLens.position.z = -0.126; this.torchLens.rotation.y = Math.PI; torch.add(this.torchLens);
    torch.position.set(0.2, -0.22, -0.35);
    vm.scene.add(torch);
  }

  drawVU(level, recording, label) {
    const c = this.vuCanvas.getContext('2d');
    const w = 256, h = 128;
    c.fillStyle = '#d9cf9e'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#2a2414'; c.lineWidth = 2;
    c.beginPath(); c.arc(w / 2, h + 40, 140, Math.PI * 1.22, Math.PI * 1.78); c.stroke();
    c.font = '14px Courier New'; c.fillStyle = '#2a2414';
    ['-20', '-10', '-5', '0', '+3'].forEach((s, k) => { const a = Math.PI * (1.25 + k * 0.125); c.fillText(s, w / 2 + Math.cos(a) * 118 - 10, h + 40 + Math.sin(a) * 118); });
    c.strokeStyle = '#a3241a'; c.beginPath(); c.arc(w / 2, h + 40, 140, Math.PI * 1.65, Math.PI * 1.78); c.lineWidth = 6; c.stroke();
    const a = Math.PI * (1.22 + level * 0.56);
    c.strokeStyle = '#111'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(w / 2, h + 40); c.lineTo(w / 2 + Math.cos(a) * 150, h + 40 + Math.sin(a) * 150); c.stroke();
    c.fillStyle = '#2a2414'; c.font = 'bold 13px Courier New'; c.fillText('VU', 10, 18);
    if (label) { c.font = '11px Courier New'; c.fillText(label.slice(0, 26), 10, h - 8); }
    if (recording) { c.fillStyle = '#b01e14'; c.beginPath(); c.arc(w - 18, 16, 7, 0, 7); c.fill(); c.fillText('REC', w - 60, 20); }
    this.vuTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- state
  place(x, z, yaw = 0) {
    this.pos.set(x, this.game.map.floorAt(x, z), z);
    this.yaw = yaw; this.pitch = 0;
    this.vel.set(0, 0);
    this.updateCamera(0);
    this.game.lights?.snap(this.camera.position, this.game.time);
  }

  get eye() { return EYE_STAND + (EYE_CROUCH - EYE_STAND) * this.crouch; }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const g = this.game;
    const input = g.input;
    const s = g.settings;
    if (!this.alive) { this.updateCamera(dt); return; }

    // Look
    const m = input.consumeMouse();
    if (!this.frozen && !this.lookOverride) {
      const sens = 0.0022 * s.get('sensitivity');
      this.yaw -= m.x * sens;
      this.pitch -= m.y * sens * (s.get('invertY') ? -1 : 1);
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    }
    if (this.lookOverride) {
      const lo = this.lookOverride;
      const dx = lo.x - this.pos.x, dz = lo.z - this.pos.z;
      const ty = Math.atan2(-dx, -dz);
      let d = ty - this.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * lo.speed);
      const tp = Math.atan2(lo.y - (this.pos.y + this.eye), Math.hypot(dx, dz));
      this.pitch += (tp - this.pitch) * Math.min(1, dt * lo.speed);
    }

    if (this.hiding) { this.updateHiding(dt); this.updateBody(dt, false); this.updateCamera(dt); return; }

    // Crouch
    if (!this.frozen && input.hit('crouch')) this.crouched = !this.crouched;
    if (this.crouched === false && this.crouch > 0.5) {
      // Can't stand up under low geometry (e.g. door lintels are fine at 2.2)
    }
    this.crouch += ((this.crouched ? 1 : 0) - this.crouch) * Math.min(1, dt * 8);

    // Move
    let fx = 0, fz = 0;
    if (!this.frozen) {
      if (input.is('forward')) fz -= 1;
      if (input.is('back')) fz += 1;
      if (input.is('left')) fx -= 1;
      if (input.is('right')) fx += 1;
    }
    const len = Math.hypot(fx, fz);
    if (len > 0) { fx /= len; fz /= len; }
    const wantSprint = !this.frozen && input.is('sprint') && fz < 0 && !this.exhausted && !this.crouched;
    let maxSpeed = this.crouched ? 1.2 : wantSprint ? 4.3 : 2.15;
    if (this.holdingBreath) maxSpeed *= 0.85;
    if (g.zoneDef?.surface === 'water') maxSpeed *= 0.8;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const wx = fx * cy + fz * sy, wz = -fx * sy + fz * cy;
    const accel = len > 0 ? 10 : 12;
    this.vel.x += (wx * maxSpeed - this.vel.x) * Math.min(1, dt * accel);
    this.vel.y += (wz * maxSpeed - this.vel.y) * Math.min(1, dt * accel);
    this.speed = this.vel.length();
    this.moving = this.speed > 0.3;
    const sprinting = wantSprint && this.speed > 3.2;
    // Integrate with substeps
    const steps = Math.max(1, Math.ceil(this.speed * dt / 0.15));
    for (let k = 0; k < steps; k++) {
      const nx = this.pos.x + this.vel.x * dt / steps;
      const nz = this.pos.z + this.vel.y * dt / steps;
      const r = g.grid.resolveCircle(nx, nz, RADIUS);
      this.pos.x = r.x; this.pos.z = r.z;
    }
    const floor = g.map.floorAt(this.pos.x, this.pos.z);
    this.pos.y += (floor - this.pos.y) * Math.min(1, dt * 14);

    // Stamina
    if (sprinting) { this.stamina -= dt / 7.5; if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; } }
    else this.stamina = Math.min(1, this.stamina + dt / (this.moving ? 11 : 6));
    if (this.exhausted && this.stamina > 0.35) this.exhausted = false;

    // Footsteps
    if (this.moving) {
      const rate = sprinting ? 2.6 : this.crouched ? 1.2 : 1.75;
      this.stepPhase += dt * rate;
      if (this.stepPhase >= 1) { this.stepPhase -= 1; this.footstep(sprinting); }
      this.stillTime = 0;
    } else {
      if (this.stepPhase > 0.45) { this.stepPhase = 0; this.footstep(false, true); }
      this.stepPhase = 0;
      this.stillTime += dt;
    }

    // Hold breath
    this.updateBreath(dt);
    this.updateBody(dt, sprinting);

    // Flashlight
    if (!this.frozen && input.hit('flashlight')) this.toggleFlashlight();
    if (!this.frozen && input.hit('reload')) this.reloadBattery();

    this.updateCamera(dt);
  }

  footstep(sprint, settle = false) {
    const g = this.game;
    const zd = g.zoneDef;
    let surf = zd?.surface || 'concrete';
    if (surf === 'tile' && zd?.floorMat?.startsWith('lino')) surf = 'tile';
    const isStair = g.map.zoneAt(this.pos.x, this.pos.z)?.ch === 'u';
    if (isStair) surf = 'concrete';
    const gain = (this.crouched ? 0.3 : sprint ? 1.0 : 0.6) * (settle ? 0.5 : 1);
    g.audio?.play('step_' + surf, { gain, bus: g.audio.self, jitter: 0.12, reverb: 0.5 });
    let loud = this.crouched ? 0.07 : sprint ? 0.72 : 0.3;
    loud *= { metal: 1.3, grate: 1.4, water: 1.5, carpet: 0.6, wood: 1.0, tile: 1.05, gravel: 0.9, concrete: 1 }[surf] ?? 1;
    if (zd?.reverb === 'hall') loud *= 1.9;
    if (settle) loud *= 0.4;
    g.noiseEvent(this.pos.x, this.pos.z, loud, 'footstep', sprint ? 'run' : 'step');
    this.lastStepSide ^= 1;
    for (const fn of this.footstepListeners) fn(sprint, settle);
  }

  updateBreath(dt) {
    const g = this.game;
    const want = !this.frozen && g.input.is('breath') && this.breathHold > 0.02;
    if (want && !this.holdingBreath) { this.holdingBreath = true; g.audio?.play('breathIn', { variant: 0, gain: 0.35, bus: g.audio.self }); }
    if (this.holdingBreath) {
      this.breathHold -= dt / 9;
      if (!want || this.breathHold <= 0) {
        this.holdingBreath = false;
        if (this.breathHold <= 0.02) {
          g.audio?.play('gasp', { gain: 0.9, bus: g.audio.self });
          g.noiseEvent(this.pos.x, this.pos.z, 0.55, 'gasp', 'gasp');
          this.breathHold = 0;
          this.breathTimer = 0.4;
        } else g.audio?.play('breathOut', { variant: 0, gain: 0.3, bus: g.audio.self });
      }
    } else this.breathHold = Math.min(1, this.breathHold + dt / 6);

    // Audible breathing when exerted or afraid
    const exert = Math.max(1 - this.stamina, this.fear * 0.8);
    if (!this.holdingBreath && exert > 0.25) {
      this.breathTimer -= dt;
      if (this.breathTimer <= 0) {
        this.breathTimer = 2.2 - exert * 1.2;
        const v = exert > 0.6 ? 1 : 0;
        g.audio?.play('breathIn', { variant: v, gain: 0.15 + exert * 0.35, bus: g.audio.self });
        g.audio?.play('breathOut', { variant: v, gain: 0.15 + exert * 0.35, bus: g.audio.self, delay: 0.9 - exert * 0.3 });
        if (exert > 0.55) g.noiseEvent(this.pos.x, this.pos.z, 0.12 * exert, 'breath', null);
      }
    }
  }

  updateBody(dt, sprinting) {
    const g = this.game;
    // Heartbeat with fear
    if (this.fear > 0.35) {
      this.heartTimer -= dt;
      if (this.heartTimer <= 0) {
        this.heartTimer = 1.1 - this.fear * 0.6;
        g.audio?.play('heartbeat', { gain: (this.fear - 0.3) * 0.9, bus: g.audio.self });
      }
    }
    // Battery
    if (this.flashOn) {
      this.battery -= dt / 420;
      if (this.battery <= 0) { this.battery = 0; this.flashOn = false; g.audio?.play('click', { gain: 0.4 }); g.ui.hint('The flashlight dies. [R] change battery.', 3); }
    }
  }

  updateCamera(dt) {
    const g = this.game;
    const cam = this.camera;
    const bobAmt = g.settings.get('headBob');
    const sp = Math.min(1, this.speed / 4.3);
    const bobY = this.moving ? Math.sin(this.stepPhase * Math.PI * 2) * 0.035 * (0.5 + sp) * bobAmt : 0;
    const bobX = this.moving ? Math.cos(this.stepPhase * Math.PI) * 0.025 * (0.5 + sp) * bobAmt : 0;
    this.bob += (bobY - this.bob) * Math.min(1, dt * 12);
    const strafe = this.vel.x * Math.cos(this.yaw) - this.vel.y * Math.sin(this.yaw);
    this.roll += (-strafe * 0.008 - this.roll) * Math.min(1, dt * 6);
    if (this.hiding) {
      cam.position.copy(this.hideCam);
    } else {
      cam.position.set(this.pos.x + bobX * Math.cos(this.yaw), this.pos.y + this.eye + this.bob, this.pos.z - bobX * Math.sin(this.yaw));
    }
    const shake = g.camShake || 0;
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch + (Math.random() - 0.5) * shake * 0.01, this.yaw + (Math.random() - 0.5) * shake * 0.01, this.roll * bobAmt);
    cam.updateMatrixWorld();

    // Flashlight follows with slight lag and fear tremble
    const f = this.forward(new THREE.Vector3());
    const tremble = (this.fear * 0.012 + (this.exhausted ? 0.008 : 0));
    f.x += (Math.random() - 0.5) * tremble; f.y += (Math.random() - 0.5) * tremble;
    this.flashDir.lerp(f, Math.min(1, dt * 14 || 1)).normalize();
    const off = new THREE.Vector3(0.18, -0.25, 0).applyEuler(cam.rotation);
    this.flash.position.copy(cam.position).add(off);
    this.flashTarget.position.copy(this.flash.position).addScaledVector(this.flashDir, 5);
    // Battery flicker
    let fl = 1;
    if (this.battery < 0.15) { this.flashFlicker -= dt; if (this.flashFlicker < 0) { this.flashFlicker = Math.random() * 0.3; } fl = Math.random() < 0.1 ? 0.15 : 0.55 + this.battery * 3; }
    const on = this.flashOn && !this.hiding;
    this.flash.intensity = on ? 260 * fl * (0.6 + Math.min(1, this.battery * 2) * 0.4) : 0;
    this.torchLens.material.color.setHex(on ? 0xfff2d0 : 0x111111);

    // Viewmodel
    const vm = this.vm;
    vm.camera.aspect = cam.aspect; vm.camera.fov = cam.fov; vm.camera.updateProjectionMatrix();
    const raise = this.recRaise;
    this.recorder.position.set(0.16 - raise * 0.08, -0.34 + raise * 0.17 + this.bob * 0.5, -0.36 + raise * 0.04);
    this.recorder.rotation.set(-0.2 + raise * 0.45, -0.35 + raise * 0.2, 0.05);
    this.recorder.visible = raise > 0.02;
    this.torch.position.set(0.2 + bobX * 0.3, -0.22 + this.bob * 0.6 - raise * 0.05, -0.35);
    this.torch.visible = !this.hiding;
    this.vmLight.intensity = on ? 0.6 : 0.05 + (g.lights ? g.lights.levelAt(this.pos.x, this.pos.z) * 0.6 : 0);
  }

  // ---------------------------------------------------------------- hiding
  hideIn(spot) {
    const g = this.game;
    this.hiding = spot;
    this.hideCam = new THREE.Vector3(spot.x, spot.y + 1.55, spot.z);
    this.prevYaw = this.yaw;
    this.yaw = spot.facing; this.pitch = -0.05;
    g.ui.setSlats(true);
    g.audio?.playAt('doorMetalClose', { x: spot.x, y: spot.y + 1, z: spot.z }, { gain: 0.4 });
    g.noiseEvent(spot.x, spot.z, 0.2, 'hide', null);
    g.playerModel?.note('hide', spot.id);
    g.events.emit('hide', spot);
  }

  updateHiding(dt) {
    const g = this.game;
    // Limited look inside the locker
    this.yaw = Math.max(this.hiding.facing - 0.5, Math.min(this.hiding.facing + 0.5, this.yaw));
    this.pitch = Math.max(-0.35, Math.min(0.25, this.pitch));
    this.updateBreath(dt);
    this.moving = false; this.speed = 0;
    this.stamina = Math.min(1, this.stamina + dt / 6);
    if (g.input.hit('interact') && !this.frozen) this.unhide();
  }

  unhide() {
    const g = this.game;
    const s = this.hiding;
    this.hiding = null;
    g.ui.setSlats(false);
    this.place(s.exitX, s.exitZ, s.facing);
    g.audio?.playAt('doorMetalOpen', { x: s.x, y: s.y + 1, z: s.z }, { gain: 0.35 });
    g.noiseEvent(s.x, s.z, 0.22, 'hide', null);
    g.events.emit('unhide', s);
  }

  // Visibility (0..1) used by the Remainder's sight.
  visibility() {
    if (this.hiding) return 0;
    const g = this.game;
    let v = g.lights ? g.lights.levelAt(this.pos.x, this.pos.z) * 0.8 : 0.3;
    if (this.flashOn) v += 0.55;
    if (this.moving) v += this.speed > 3 ? 0.3 : 0.12;
    if (this.crouched) v *= 0.55;
    return Math.min(1, v);
  }

  serialize() {
    return { x: this.pos.x, z: this.pos.z, yaw: this.yaw, battery: this.battery, flash: this.flashOn, crouched: this.crouched };
  }

  deserialize(d) {
    this.alive = true; this.hiding = null; this.frozen = false; this.lookOverride = null;
    this.fear = 0; this.stamina = 1; this.breathHold = 1; this.exhausted = false; this.holdingBreath = false;
    this.place(d.x, d.z, d.yaw);
    this.battery = d.battery ?? 1;
    this.flashOn = !!d.flash;
    this.crouched = !!d.crouched; this.crouch = this.crouched ? 1 : 0;
    this.game.ui?.setSlats(false);
  }
}
