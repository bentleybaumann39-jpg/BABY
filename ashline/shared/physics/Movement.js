// Deterministic player movement step. The server runs it authoritatively; the client runs the exact
// same code for prediction and replays unacknowledged inputs after each snapshot.
import { PLAYER, MODE, BTN, GRAVITY, CHUTE_AUTO, WATER_LEVEL } from '../constants.js';

export function createMoveState(x = 0, y = 0, z = 0) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, mode: MODE.GROUND, grounded: true, crouch: false, airT: 0, pb: 0, impact: 0 };
}

export function copyMoveState(dst, s) {
  dst.x = s.x; dst.y = s.y; dst.z = s.z; dst.vx = s.vx; dst.vy = s.vy; dst.vz = s.vz;
  dst.mode = s.mode; dst.grounded = s.grounded; dst.crouch = s.crouch; dst.airT = s.airT; dst.pb = s.pb;
  return dst;
}

export function bodyHeight(s) {
  if (s.mode === MODE.KNOCKED) return PLAYER.knockedHeight;
  return s.crouch ? PLAYER.crouchHeight : PLAYER.height;
}
export function eyeHeight(s) {
  if (s.mode === MODE.KNOCKED) return PLAYER.knockedEye;
  if (s.mode === MODE.FREEFALL || s.mode === MODE.CHUTE) return 1.4;
  return s.crouch ? PLAYER.crouchEye : PLAYER.eye;
}

const approach = (v, t, k) => v + (t - v) * k;

// inp: { mx, mz, yaw, pitch, buttons }  mods: { speedMul, noSprint, slow }
export function stepMove(s, inp, world, dt, mods = null) {
  const b = inp.buttons | 0;
  const pressed = b & ~s.pb;
  s.pb = b;
  s.impact = 0;
  if (s.mode === MODE.PLANE || s.mode === MODE.DEAD || s.mode === MODE.WAITING) return;

  let mx = inp.mx || 0, mz = inp.mz || 0;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  const sy = Math.sin(inp.yaw), cy = Math.cos(inp.yaw);
  // forward = (-sin, -cos), right = (cos, -sin)
  const hw = PLAYER.halfWidth;

  if (s.mode === MODE.FREEFALL || s.mode === MODE.CHUTE) {
    const fwdX = -sy, fwdZ = -cy, rX = cy, rZ = -sy;
    if (s.mode === MODE.FREEFALL) {
      s.airT += dt;
      const dive = Math.max(0, -Math.sin(inp.pitch || 0));
      const tvy = -(40 + 28 * dive * Math.max(0, mz));
      s.vy = approach(s.vy, tvy, Math.min(1, 1.6 * dt));
      const fs = mz > 0 ? 24 * mz * (0.55 + 0.45 * Math.cos(inp.pitch || 0)) : mz * 7;
      const tx = fwdX * fs + rX * mx * 9, tz = fwdZ * fs + rZ * mx * 9;
      s.vx = approach(s.vx, tx, Math.min(1, 1.3 * dt));
      s.vz = approach(s.vz, tz, Math.min(1, 1.3 * dt));
      const agl = s.y - world.heightAt(s.x, s.z);
      if (agl < CHUTE_AUTO || ((pressed & BTN.JUMP) && s.airT > 1.2)) { s.mode = MODE.CHUTE; s.vy = Math.max(s.vy, -14); s.airT = 0; }
    } else {
      s.airT += dt;
      const tvy = mz > 0.2 ? -6.8 : mz < -0.2 ? -4.3 : -5.4;
      s.vy = approach(s.vy, tvy, Math.min(1, 2.2 * dt));
      const fs = 7 + 6 * Math.max(mz, 0) - 3.5 * Math.max(-mz, 0);
      const tx = fwdX * fs + rX * mx * 4.5, tz = fwdZ * fs + rZ * mx * 4.5;
      s.vx = approach(s.vx, tx, Math.min(1, 1.6 * dt));
      s.vz = approach(s.vz, tz, Math.min(1, 1.6 * dt));
    }
    s.crouch = false;
    world.move(s, dt, hw, PLAYER.height, 0);
    if (s.grounded) { s.mode = MODE.GROUND; s.airT = 0; s.vx *= 0.3; s.vz *= 0.3; }
    return;
  }

  const knocked = s.mode === MODE.KNOCKED;
  // crouch (hold); standing up requires headroom
  let wantCrouch = !knocked && !!(b & BTN.CROUCH);
  if (!wantCrouch && s.crouch) {
    if (world.overlaps(s.x - hw, s.y + 0.05, s.z - hw, s.x + hw, s.y + PLAYER.height, s.z + hw) >= 0) wantCrouch = true;
  }
  s.crouch = wantCrouch;

  const ads = !!(b & BTN.ADS);
  const inWater = s.y < WATER_LEVEL - 0.35 && world.heightAt(s.x, s.z) < WATER_LEVEL - 0.3;
  const sprint = !knocked && (b & BTN.SPRINT) && mz > 0.3 && !s.crouch && !ads && !(mods && mods.noSprint) && !inWater;
  let speed;
  if (knocked) speed = PLAYER.knocked;
  else if (s.crouch) speed = ads ? 1.7 : PLAYER.crouch;
  else if (sprint) speed = PLAYER.sprint;
  else speed = ads ? PLAYER.ads : PLAYER.walk;
  if (b & BTN.WALK) speed = Math.min(speed, 2.2);
  if (mz < -0.1) speed *= 0.85;
  if (inWater) speed *= 0.55;
  if (mods) { if (mods.speedMul) speed *= mods.speedMul; if (mods.slow) speed = Math.min(speed, mods.slow); }

  const wx = (-sy * mz + cy * mx) * speed, wz = (-cy * mz - sy * mx) * speed;
  const k = s.grounded ? Math.min(1, 12 * dt) : Math.min(1, 1.6 * dt);
  s.vx = approach(s.vx, wx, k);
  s.vz = approach(s.vz, wz, k);

  if (s.grounded && (pressed & BTN.JUMP) && !knocked && !s.crouch && !inWater) { s.vy = PLAYER.jump; s.grounded = false; }
  s.vy -= GRAVITY * dt;
  if (s.vy < -60) s.vy = -60;

  const h = bodyHeight(s);
  s.impact = world.move(s, dt, hw, h, knocked ? 0.3 : PLAYER.stepUp);
}

// Unit vector for view angles.
export function viewDir(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}
