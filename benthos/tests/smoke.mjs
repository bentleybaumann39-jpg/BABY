// Headless smoke test for Benthos: loads the game, visits every act and the key set pieces through the
// debug hooks, and fails on any page error. Pass a directory to also save screenshots.
// Usage: node benthos/tests/smoke.mjs [shotDir] [--built]
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// require() honours NODE_PATH, so a globally installed Playwright works as well as a local one.
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const file = process.argv.includes('--built') ? 'Benthos.html' : 'index.html';
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e.stack || e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + path.join(root, file) + '?debug');
await page.waitForTimeout(400);
const shot = async name => { if (shotDir) await page.screenshot({ path: path.join(shotDir, name + '.png') }); };
const run = (fn, arg) => page.evaluate(fn, arg);
const step = async (n) => run(n => { window.B.noAutoPause = true; window.B.debug.tick(n); window.B.debug.draw(); }, n);
const check = async (label) => {
  const st = await run(() => ({ mode: B.mode, act: B.act, z: B.player ? Math.round(B.player.z) : null, ms: B.renderMs, dead: B.player && B.player.dead }));
  console.log(label.padEnd(26), JSON.stringify(st));
  return st;
};

await shot('00-boot');
await page.mouse.click(480, 270);
await page.waitForTimeout(300);
await step(30); await shot('01-title'); await check('title');

const scenes = [
  ['deck', ['deck'], 60],
  ['act1-sunlit', ['act1', 12], 90],
  ['act1-shelf', ['act1', 30], 60],
  ['act1-twilight', ['act1', 260], 60],
  ['act1-layer', ['act1', 470], 60],
  ['act1-gannet', ['act1', 600], 60],
  ['act2-mid', ['act2', 1500, { breached: true }], 60],
  ['act2-magpie', ['act2', 2880, { breached: true }], 60],
  ['act3-plain', ['act3', 3425, { breached: true, flags: { act3: true } }], 60],
  ['act3-archive', ['act3', 4170, { breached: true, flags: { act3: true } }], 60],
];
for (const [name, args, n] of scenes) {
  await run(a => { B.debug.start(...a); B.debug.god(true); }, args);
  if (name === 'act2-magpie') await run(() => { const f = B.map.features; B.debug.warp(f.MX - 8, f.MY + 2, 2895); });
  if (name === 'act3-plain') await run(() => B.debug.warp(100, 118, B.World.H(B.map, 100, 118) - 6));
  if (name === 'act3-archive') await run(() => { const f = B.map.features; B.debug.warp(f.AX + 6, f.AY + 8, 4185); });
  if (name === 'act1-gannet') await run(() => { const p = B.terracePoint(6, 34); B.debug.warp(p.x, p.y, 605); });
  await step(n);
  await shot(name);
  await check(name);
}
// a ping, a flare and a biomass cell in Act I
await run(() => { B.debug.start('act1', 300); B.debug.god(true); B.debug.give(); B.player.cells = ['siphon', 'caul', 'bloom']; });
await run(() => { B.I.hit.ping = true; B.I.up.ping = true; }); await step(1); await step(40); await shot('ping'); await check('ping');
await run(() => { B.I.hit.c3 = true; }); await step(30); await check('bloom');
// the breach and the footage sequences run without errors
await run(() => { B.debug.start('act2', 1062); }); await step(60 * 2); await check('breach-start');
await run(() => { B.Hud.playFootage(() => {}); }); await step(60 * 6); await shot('footage'); await step(60 * 8); await check('footage');
await run(() => { B.debug.start('act3', 4170, { breached: true, flags: { act3: true } }); B.state.deathLog = [{ act: 'act1', z: 340, res: 1 }, { act: 'act2', z: 1600, res: 2 }]; B.Hud.wrenFootage(() => {}); }); await step(60 * 3); await shot('wren'); await step(60 * 10); await check('wren');
await run(() => { B.debug.start('act3', 3480, { breached: true, flags: { act3: true } }); B.player.relics.eye = true; const L = B.map.features.lakes[0]; B.debug.warp(L.x - L.r - 3, L.y, 3480); B.Story.eyeLake = L; B.Story.machineEye(); }); await step(60 * 4); await shot('eye'); await step(60 * 6); await check('eye');
await run(() => { B.Story.ending('sediment'); }); await step(60 * 4); await check('ending-sediment');

console.log(errors.length ? '\nERRORS:\n' + errors.slice(0, 20).join('\n') : '\nno page errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
