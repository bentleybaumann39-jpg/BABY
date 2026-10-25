// A bot that plays the opening the way a person would, with no warps: walks the deck, suits up, rides
// the cage, swims out to salvage on each ledge and back, and reports how long each beat took.
// Usage: node benthos/tests/bot.mjs [minutes of game time, default 14] [shotDir]
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const minutes = +(args[0] || 14), shotDir = args[1] || null;
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e.stack || e)));
await page.goto('file://' + path.join(root, 'index.html'));
await page.waitForTimeout(300);
await page.mouse.click(480, 270);

// The whole bot runs inside the page, one simulated second per call.
await page.evaluate(() => {
  localStorage.clear(); B.noAutoPause = true;
  const I = B.I, keys = ['up', 'down', 'left', 'right', 'rise', 'sink', 'interact', 'confirm', 'boost'];
  const set = (a, on) => { if (on && !I.state[a]) I.hit[a] = true; if (!on && I.state[a]) I.up[a] = true; I.state[a] = on; };
  const bot = window.bot = { log: [], t: 0, goal: null, picked: 0, stuckT: 0, last: null, phase: 'start', seen: {}, interactCD: 0 };
  const note = (m) => { bot.log.push(Math.round(bot.t) + 's ' + m); };
  bot.note = note;
  // steer toward a world point: screen-relative thrust plus trim for depth
  function steer(x, y, z) {
    const P = B.player, dx = x - P.x, dy = y - P.y, d = Math.hypot(dx, dy);
    set('right', dx > 0.4 && Math.abs(dx) > d * 0.35); set('left', dx < -0.4 && Math.abs(dx) > d * 0.35);
    set('down', dy > 0.4 && Math.abs(dy) > d * 0.35); set('up', dy < -0.4 && Math.abs(dy) > d * 0.35);
    if (B.act !== 'deck') { const dz = z - P.z; set('sink', dz > 1.2); set('rise', dz < -1.2); }
    return Math.hypot(dx, dy, B.act === 'deck' ? 0 : (z - P.z));
  }
  function release() { for (const k of keys) set(k, false); }
  bot.step = function () {
    const P = B.player;
    if (B.mode === 'title') { if (B.Hud.menuOpen()) { set('confirm', !I.state.confirm); } return; }
    if (B.mode === 'dead') { note('DIED: ' + B.deadCause + ' at ' + Math.round(P.z) + ' m'); set('confirm', !I.state.confirm); return; }
    if (B.mode !== 'play' || !P) { release(); return; }
    // at a fabricator: build hull rating while it can be afforded, then close
    const cr = B.Hud._craft();
    if (cr) {
      const inv = P.inv, hull = inv.ti >= 2 && inv.cer >= 1;
      set('confirm', false); B.debug.tick(1);
      cr.sel = hull ? 0 : 10; set('confirm', true); if (hull) note('CRAFTED HULL → ' + (P.rating + 300) + ' M');
      return;
    }
    if (B.Hud.capture()) { set('interact', !I.state.interact); return; } // close documents
    // an informed player swaps the scrubber when it runs low
    if (P.lime < 0.2 && P.limes > 0) { set('swap', true); note('SWAPPED SCRUBBER (' + (P.limes - 1) + ' left)'); } else set('swap', false);
    const ob = B.Story.objective();
    if (ob && ob.text !== bot.lastOb) { note('OBJECTIVE: ' + ob.text); bot.lastOb = ob.text; }
    // pick the target: salvage within reach on this ledge first, else the objective
    let tgt = null;
    if (B.act !== 'deck' && !P.inCage) {
      let bd = 26;
      for (const e of B.E.list) {
        if (!e.alive || e.type !== 'item' || bot.seen[e.id] > 3 || e.z > P.rating + 20) continue;
        const d = Math.hypot(e.x - P.x, e.y - P.y, (e.z - P.z) * 0.5); if (d < bd && Math.abs(e.z - P.z) < 30) { bd = d; tgt = e; }
      }
      if (tgt && bot.goal !== tgt) { bot.goal = tgt; bot.goalT = 0; }
      if (tgt) { bot.goalT = (bot.goalT || 0) + 1; if (bot.goalT > 40) { bot.seen[tgt.id] = 9; note('GAVE UP ON ' + tgt.kind + ' at ' + [tgt.x, tgt.y, tgt.z].map(Math.round)); tgt = null; } }
    }
    const aim = tgt ? { x: tgt.x, y: tgt.y, z: tgt.z - 0.3 } : ob && ob.x !== undefined ? { x: ob.x, y: ob.y, z: ob.z - 0.5 } : null;
    if (ob && /DROP YOUR WEIGHTS/.test(ob.text)) { release(); set('rise', true); return; }
    if (P.tangled || P.grabbed) { const f = (bot.t * 4 + (bot.k = (bot.k || 0) + 1)) & 1; set('left', !!f); set('right', !f); set('up', false); set('down', false); }
    else if (P.inCage) release();
    else if (bot.detour > 0) { bot.detour--; steer(P.x + bot.dvx * 5, P.y + bot.dvy * 5, aim ? aim.z : P.z); }
    else if (aim) steer(aim.x, aim.y, aim.z);
    else release();
    // use whatever is offered (holding for absorbs), but not the same thing over and over
    // explore the ledge before riding on: leave the cage alone while there is salvage nearby
    if (!P.inCage) bot.ledgeT = (bot.ledgeT || 0) + 1; else bot.ledgeT = 0;
    const skipCage = P.prompt && /CAGE/.test(P.prompt.label) && tgt && bot.ledgeT < 4 * 120;
    if (P.prompt && !skipCage) {
      const lb = P.prompt.label;
      if (P.prompt.hold) set('interact', true);
      else if (bot.interactCD <= 0) { set('interact', true); bot.interactCD = 2; if (lb !== bot.lastPrompt) note('USE: ' + lb); bot.lastPrompt = lb; }
      else set('interact', false);
    } else set('interact', false);
    bot.interactCD--;
    if (P.inCage && !bot.inCage) note('IN CAGE at ' + Math.round(P.z) + ' m');
    if (!P.inCage && bot.inCage) note('OUT OF CAGE at ' + Math.round(P.z) + ' m (stop ' + (B.E.byType('cage')[0] || {}).stop + ')');
    bot.inCage = !!P.inCage;
    if (bot.fid !== undefined && P.fidelity < bot.fid) note('RECOMPRESSED (fidelity ' + P.fidelity + ') near ' + Math.round(bot.lastZ) + ' m, crush was ' + Math.round(bot.lastCrush));
    bot.fid = P.fidelity; bot.lastZ = P.z; bot.lastCrush = P.crush;
    // stuck detector
    const pos = [P.x, P.y, P.z];
    if (bot.last && Math.hypot(pos[0] - bot.last[0], pos[1] - bot.last[1], pos[2] - bot.last[2]) < 0.2 && !P.inCage && B.mode === 'play' && !B.Story.locked) bot.stuckT++; else bot.stuckT = 0;
    // stuck: walk round it for a while, the way a person would
    if (bot.stuckT === 8 && aim) { const dx = aim.x - P.x, dy = aim.y - P.y, l = Math.hypot(dx, dy) || 1, sd = Math.random() < 0.5 ? 1 : -1; bot.dvx = -dy / l * sd; bot.dvy = dx / l * sd; bot.detour = 12; }
    if (bot.stuckT === 40) note('STUCK at ' + pos.map(Math.round) + ' target ' + (aim ? [aim.x, aim.y, aim.z].map(Math.round) : '-'));
    bot.last = pos;
  };
});

// --act3: start on the plain after the fall
if (process.argv.includes('--act3')) await page.evaluate(() => { B.debug.start('act3', undefined, { breached: true, flags: { act3: true, breached: true, wren: true, fell: true } }); const p = B.player; p.relics.wren = true; p.relics.eye = true; B.Story.introAct3 && B.Story.introAct3(); });
// --act2: start just after the Breach, the way RETRY leaves you
if (process.argv.includes('--act2')) await page.evaluate(() => { B.debug.start('act2', 1001); B.Story.startBreach(); B.state.flags.breachPending = true; B.Story.resumeAfterBreach(); B.Story.breachRun = null; });
const shot = async n => { if (shotDir) await page.screenshot({ path: path.join(shotDir, n + '.png') }); };
let lastItems = -1;
for (let s = 0; s < minutes * 60; s++) {
  const r = await page.evaluate(() => {
    for (let k = 0; k < 60; k++) { if (k % 15 === 0) bot.step(); B.debug.tick(1); }
    bot.t++; if (bot.t % 5 === 0) B.debug.draw();
    const P = B.player, inv = P ? Object.values(P.inv || {}).reduce((a, b) => a + b, 0) + (P.carts || 0) + (P.limes || 0) : 0;
    return { t: bot.t, act: B.act, mode: B.mode, z: P ? Math.round(P.z) : null, inv };
  });
  if (r.inv !== lastItems) { lastItems = r.inv; }
  if (s % 60 === 0) { console.log(`${r.t}s ${r.act} ${r.mode} z=${r.z} items=${r.inv}`); await shot('bot-' + String(s / 60).padStart(2, '0')); }
}
const log = await page.evaluate(() => bot.log);
console.log('\n' + log.join('\n'));
console.log(errors.length ? '\nERRORS:\n' + errors.slice(0, 10).join('\n') : '\nno page errors');
await browser.close();
