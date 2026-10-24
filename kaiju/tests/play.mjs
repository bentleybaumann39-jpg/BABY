// Headless gameplay smoke + screenshot capture.
// node kaiju/tests/play.mjs outdir [query] [script]
import { createRequire } from 'module';
import fs from 'fs';
import { startServer } from '../../tools/serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , outdir = '/tmp/kjplay', query = 'auto=gorvax&q=low', script = 'default'] = process.argv;
fs.mkdirSync(outdir, { recursive: true });
const port = 8100 + Math.floor(Math.random() * 800);
const server = await startServer(port, true);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 500)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').slice(0, 800)));
const t0 = Date.now();
await page.goto(`http://localhost:${port}/kaiju/index.html?${query}`);
const ok = await page.waitForFunction(() => (window.__kj && window.__kj.play && window.__kj.play.state !== 'loading') || document.querySelector('#error.show'), null, { timeout: 400000, polling: 1000 }).then(() => true).catch(() => { errors.push('timeout loading'); return false; });
console.log('loaded in', ((Date.now() - t0) / 1000).toFixed(1), 's');
const errShown = await page.evaluate(() => document.querySelector('#error.show') ? document.getElementById('err-text').textContent : '');
if (!ok || errShown || !(await page.evaluate(() => !!(window.__kj && window.__kj.play)))) {
  console.log('FAILED to start.', errShown);
  for (const e of errors.slice(0, 12)) console.log(e);
  await browser.close(); server.close(); process.exit(1);
}
const shot = async (name) => { await page.screenshot({ path: `${outdir}/${name}.png`, timeout: 600000 }); console.log('shot', name, ((Date.now() - t0) / 1000).toFixed(0) + 's'); };
// drive the game by stepping simulated time with fixed dt (independent of SwiftShader speed)
const step = async (sec, keys = {}, fn = '') => page.evaluate(async ({ sec, keys, fn }) => {
  const app = window.__kj.app, p = app.play, I = app.input;
  const dt = 1 / 30;
  for (let t = 0; t < sec; t += dt) {
    I.keys.clear();
    for (const k of keys.hold || []) I.keys.add(k);
    if (keys.tap && t === 0) for (const k of keys.tap) { I.pressed.add(k); }
    if (keys.click && t === 0) I.mouse.pressed |= keys.click;
    if (keys.buttons) I.mouse.buttons = keys.buttons; else I.mouse.buttons = 0;
    if (keys.look) I.mouse.dx = keys.look[0], I.mouse.dy = keys.look[1];
    if (fn) (new Function('app', 'p', fn))(app, p);
    p.update(dt);
    app.ui.frame(dt);
    I.endFrame();
  }
  const k = p.kaiju;
  return { cars: p.traffic && p.traffic.cars.length, units: p.military && p.military.units.length, shots: p.military && p.military.shots.length, kills: p.score.kills, veh: p.score.vehicles, state: p.state, pos: k.pos.toArray().map((v) => +v.toFixed(1)), speed: +k.speed.toFixed(1), hp: Math.round(k.hp), alive: p.world.buildings.aliveCount, dmg: Math.round(p.score.damage / 1e6), debris: p.debris.active, parts: p.particles.lit.n + p.particles.add.n, groups: p.world.buildings.groups.length };
}, { sec, keys, fn });
const log = (r) => console.log(JSON.stringify(r));
if (script === 'default') {
  log(await step(1));
  await shot('00_intro');
  log(await step(9));                       // intro ends
  log(await step(0.5, { tap: ['Enter'] }));
  log(await step(12, { hold: ['KeyW', 'ShiftLeft'] }));
  await shot('01_walk');
  log(await step(6, { hold: ['KeyW'] }));
  await shot('02_city');
  log(await step(1.4, { click: 1 }));
  log(await step(1.4, { click: 1 }));
  log(await step(2.0, { click: 4 }));
  await shot('03_attack');
  log(await step(2, { hold: ['KeyQ'], fn: 'app.input.keys.add("KeyQ")' }));
  log(await step(2.5, { hold: ['KeyQ'] }));
  await shot('04_beam');
  log(await step(1.5));
  log(await step(2, { tap: ['Space'] }));
  log(await step(4));
  await shot('05_after');
}
if (script === 'city') {
  log(await step(0.5));
  await shot('10_start');
  log(await step(6, { hold: ['KeyW'] }));
  await shot('11_plow');
  log(await step(1.4, { click: 1 }));
  log(await step(1.4, { click: 1 }));
  log(await step(2.2, { click: 4 }));
  await shot('12_swipes');
  log(await step(1.6, { tap: ['Space'] }));
  log(await step(3));
  await shot('13_stomp');
  log(await step(3.5, { hold: ['KeyQ'], look: [0, -6] }));
  await shot('14_beam');
  log(await step(8));
  await shot('15_aftermath');
}
if (script === 'nan') {
  log(await step(0.5));
  log(await step(1.4, { click: 1 }));
  log(await step(1.4, { click: 1 }));
  log(await step(2.2, { click: 4 }));
  await shot('20_all');
  if (process.env.DBG) { await page.evaluate((d) => { const m = window.__kj.play.debris.mat; m.defines = { ...m.defines, ['KJ_DBG_' + d]: 1 }; const k0 = m.customProgramCacheKey(); m.customProgramCacheKey = () => k0 + d; m.needsUpdate = true; }, process.env.DBG); await shot('20b_dbg'); }
  await page.evaluate(() => { for (const P of window.__kj.play.debris.pools) P.mesh.visible = false; window.__kj.play.debris.gravel.visible = false; });
  await shot('21_nodebris');
  await page.evaluate(() => { const p = window.__kj.play; p.particles.lit.mesh.visible = false; p.particles.add.mesh.visible = false; });
  await shot('22_noparticles');
  await page.evaluate(() => { const p = window.__kj.play; for (const P of p.debris.pools) P.mesh.visible = true; p.debris.gravel.visible = true; });
  await shot('23_debris_noparticles');
  const nan = await page.evaluate(() => {
    const p = window.__kj.play; let bad = 0;
    for (const P of p.debris.pools) for (let i = 0; i < P.n * 16; i++) if (!Number.isFinite(P.mesh.instanceMatrix.array[i])) bad++;
    const g = p.debris.gravel.instanceMatrix.array; let bg = 0; for (let i = 0; i < p.debris.gravel.count * 16; i++) if (!Number.isFinite(g[i])) bg++;
    const L = p.particles.lit; let bp = 0; for (let i = 0; i < L.n * 4; i++) if (!Number.isFinite(L.iPos.array[i]) || !Number.isFinite(L.iCol.array[i])) bp++;
    let ba = 0; const A = p.particles.add; for (let i = 0; i < A.n * 4; i++) if (!Number.isFinite(A.iPos.array[i]) || !Number.isFinite(A.iCol.array[i]) || !Number.isFinite(A.iMisc.array[i])) ba++;
    return { badDebris: bad, badGravel: bg, badLit: bp, badAdd: ba };
  });
  console.log(JSON.stringify(nan));
}
if (script === 'beam') {
  log(await step(0.5));
  log(await step(3.0, { hold: ['KeyQ'], look: [0, -6] }));
  await shot('30_beam');
  await page.evaluate(() => { const p = window.__kj.play; p.abilities.beam.visible = false; p.abilities.sheath.visible = false; p.abilities.beam.onBeforeRender = () => { p.abilities.beam.visible = false; }; });
  const info = await page.evaluate(() => { const p = window.__kj.play, a = p.abilities; return { beamT: a.beamT, scale: a.beam.scale.toArray(), pos: a.beam.position.toArray(), end: a.beamEnd.toArray(), mouthI: a.mouthLight.intensity, haze: p.fx.haze, hz: p.app.renderer.grade.uniforms.uHazeCenter.value.toArray() }; });
  console.log(JSON.stringify(info));
  await page.evaluate(() => { const p = window.__kj.play; p.abilities.update = () => {}; p.abilities.beamUpdate = () => {}; p.abilities.beam.visible = p.abilities.sheath.visible = false; });
  await shot('31_nobeam_mesh');
  await page.evaluate(() => { const p = window.__kj.play; p.abilities.mouthLight.intensity = 0; p.abilities.hitLight.intensity = 0; });
  await shot('32_nolights');
  await page.evaluate(() => { const p = window.__kj.play; p.app.renderer.grade.uniforms.uHaze.value = 0; p.fx.haze = 0; p.update = () => {}; });
  await shot('33_nohaze');
}
if (script === 'army') {
  log(await step(0.5));
  await shot('40_start');
  log(await step(2, { fn: 'p.threat = 4; p.military.spawnT = 0;' }));
  log(await step(6, { fn: 'p.threat = 4;' }));
  log(await step(12, { fn: 'p.threat = 4;' }));
  await shot('41_army');
  log(await step(6, { hold: ['KeyW'], fn: 'p.threat = 4;' }));
  await shot('42_walk');
  const u = await page.evaluate(() => window.__kj.play.military.units.map((u) => [u.kind, Math.round(u.pos.x), Math.round(u.pos.y), Math.round(u.pos.z), Math.round(u.hp)]));
  console.log(JSON.stringify(u));
}
if (script === 'plow') {
  // walking into dense blocks: speed should settle well above a crawl (no screenshots: fast)
  log(await step(0.5));
  for (let i = 0; i < 4; i++) log(await step(2.5, { hold: ['KeyW'] }));
  await shot('60_plow');
}
if (script === 'moves') {
  // every move of the loaded kaiju, with a frame of each
  const anim = () => page.evaluate(() => { const k = window.__kj.play.kaiju; return { act: k.action && k.action.name, sp: k.special.on, phase: k.special.phase, y: +k.pos.y.toFixed(1), e: Math.round(k.energy) }; });
  log(await step(0.5));
  await shot('50_start');
  log(await step(5, { hold: ['KeyW'] }));
  await shot('51_walk');
  log(await step(0.5, { click: 1 }));
  await shot('52_attack1');
  log(await step(1.0));
  log(await step(0.55, { click: 1 }));
  await shot('53_attack2');
  log(await step(1.0));
  log(await step(0.9, { click: 4 }));
  await shot('54_heavy');
  log(await step(1.6));
  log(await step(0.8, { tap: ['Space'] }));
  console.log(JSON.stringify(await anim()));
  await shot('55_stomp');
  log(await step(3));
  await shot('56_stomp_after');
  log(await step(2.2, { hold: ['KeyQ'], look: [0, -4] }));
  console.log(JSON.stringify(await anim()));
  await shot('57_special');
  log(await step(1.5, { hold: ['KeyQ'] }));
  console.log(JSON.stringify(await anim()));
  log(await step(2.5));
  await shot('58_special_after');
  log(await step(1.2, { tap: ['KeyE'] }));
  await shot('59_roar');
}
console.log('errors:', errors.length);
for (const e of errors.slice(0, 12)) console.log(e);
await browser.close();
server.close();
