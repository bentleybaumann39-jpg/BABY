// End-to-end browser QA (headless Chromium, software GL). Scenarios:
//   practice   menu → practice → deploy → plane → jump → land → loot → shoot a bot → inventory → map → results
//   online     two browsers on the real server: party code, duo queue, same squad, results for both
//   standalone ASHLINE.html from file:// with ALL network blocked → practice match starts
// Usage: node tests/e2e.mjs [practice|online|standalone ...]   Screenshots → tests/shots/
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/server.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let playwright;
for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', resolve(ROOT, '..', 'node_modules', 'playwright')]) { try { playwright = require(p); break; } catch {} }
if (!playwright) { console.error('playwright not found (npm i -D playwright)'); process.exit(2); }
const { chromium } = playwright;

const SHOTS = join(ROOT, 'tests', 'shots');
mkdirSync(SHOTS, { recursive: true });
const wanted = process.argv.slice(2).filter(a => !a.startsWith('--'));
const run = (n) => !wanted.length || wanted.includes(n);
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };

const data = mkdtempSync(join(tmpdir(), 'ashline-e2e-'));
const srv = await startServer({ port: 0, countdown: 2, players: 30, timeScale: 0.35, test: true, data, quiet: true });
const BASE = `http://localhost:${srv.port}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

async function open(url, { name = 'Tester', block = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript((n) => { localStorage.setItem('ashline.settings', JSON.stringify({ quality: 'low', name: n })); }, name);
  if (block) await page.route(/^https?:|^wss?:/, r => r.abort());
  await page.goto(url);
  await page.waitForFunction(() => window.__ashline && !document.getElementById('loading').classList.contains('show'), null, { timeout: 180000 });
  return { page, errors };
}
const shot = (page, n) => page.screenshot({ path: join(SHOTS, n + '.png'), timeout: 180000 }).catch(e => console.log('  (screenshot failed:', e.message.split('\n')[0] + ')'));
const A = (page, f, arg) => page.evaluate(f, arg);
const cmd = (page, c) => A(page, (c) => window.__ashline.match.cmd(c), c);
const waitFor = (page, f, ms = 60000, arg) => page.waitForFunction(f, arg, { timeout: ms, polling: 250 });
const forceLock = (page) => A(page, () => { const a = window.__ashline; a.input.forced = true; a.input.locked = true; });

try {
  // ------------------------------------------------------------------ practice
  if (run('practice')) {
    const { page, errors } = await open(`${BASE}/?debug`);
    await shot(page, 'e2e-01-menu');
    ok(await page.isVisible('#menu'), 'menu shows after loading');
    await page.click('#btn-practice');
    await waitFor(page, () => window.__ashline.profile);
    ok(await page.textContent('#btn-play') === 'DEPLOY (PRACTICE)', 'practice lobby ready');
    await page.click('#btn-play');
    await waitFor(page, () => window.__ashline.match && window.__ashline.match.status.mode === 4, 90000);
    ok(true, 'practice match starts in the plane');
    await A(page, () => { window.__ashline.match.yaw = 0.5; });
    await page.waitForTimeout(1500);
    await shot(page, 'e2e-02-plane');
    await forceLock(page);
    await page.keyboard.down('Space'); await page.waitForTimeout(1200); await page.keyboard.up('Space');
    await waitFor(page, () => [1, 2].includes(window.__ashline.match.status.mode), 30000);
    ok(true, 'jumped out of the plane');
    await page.waitForTimeout(2500);
    await shot(page, 'e2e-03-freefall');
    await cmd(page, { c: 'test', op: 'tp', x: -150.5, z: 45.5 });
    await waitFor(page, () => window.__ashline.match.status.mode === 0, 30000);
    ok(true, 'on the ground in Old Marrow');
    await cmd(page, { c: 'test', op: 'freeze' });
    await cmd(page, { c: 'test', op: 'give', it: { k: 'weapon', id: 'kr5' } });
    await cmd(page, { c: 'test', op: 'give', it: { k: 'ammo', id: '556', n: 60 } });
    await waitFor(page, () => { const m = window.__ashline.match; return m.inv && m.inv.w[0] && m.inv.w[0].id === 'kr5'; }, 20000);
    ok(true, 'picked up a KR-5 (inventory synced)');
    await cmd(page, { c: 'test', op: 'botnear', place: true, dx: 0, dz: -6, gear: 'halberd' });
    await page.waitForTimeout(2500);
    await A(page, () => { const m = window.__ashline.match; m.yaw = 0; m.pitch = -0.02; });
    await page.waitForTimeout(1500);
    await shot(page, 'e2e-04-ground');
    const kills0 = await A(page, () => window.__ashline.match.kills);
    await A(page, () => { window.__ashline.input.mouse.b = 1; });
    await waitFor(page, (k) => window.__ashline.match.kills > k || window.__ashline.match.predMag < 20, 60000, kills0).catch(() => {});
    await shot(page, 'e2e-05-firing');
    await A(page, () => { window.__ashline.input.mouse.b = 0; });
    const fired = await A(page, () => 30 - window.__ashline.match.predMag);
    ok(fired >= 5, `held fire shoots automatically (${fired} rounds)`);
    await waitFor(page, () => window.__ashline.match.kills > 0, 30000).catch(() => {});
    ok(await A(page, () => window.__ashline.match.kills) > 0, 'the bot in front of us was killed by server-validated shots');
    await page.keyboard.press('Tab'); await page.waitForTimeout(1500);
    ok(await page.isVisible('#inventory'), 'inventory opens');
    await shot(page, 'e2e-06-inventory');
    await page.keyboard.press('Tab');
    await page.keyboard.press('KeyM'); await page.waitForTimeout(1500);
    ok(await page.isVisible('#bigmap'), 'map opens');
    await shot(page, 'e2e-07-map');
    await page.keyboard.press('KeyM');
    await cmd(page, { c: 'test', op: 'end' });
    await waitFor(page, () => document.getElementById('results').classList.contains('show'), 60000);
    await page.waitForTimeout(3500);
    await shot(page, 'e2e-08-results');
    const xp = await A(page, () => window.__ashline.profile.xp);
    ok(xp > 0, `results shown, XP saved to the practice profile (${xp})`);
    await page.click('#results-continue');
    await waitFor(page, () => !window.__ashline.match && document.getElementById('menu').classList.contains('show'), 20000);
    ok(true, 'back to the lobby');
    await page.click('#menu-tabs button[data-tab="locker"]'); await page.waitForTimeout(1200);
    await shot(page, 'e2e-09-locker');
    ok(errors.length === 0, `no page errors in practice (${errors.slice(0, 3).join(' | ')})`);
    await page.close();
  }

  // ------------------------------------------------------------------ online
  if (run('online')) {
    const a = await open(`${BASE}/?debug`, { name: 'Alpha' });
    const b = await open(`${BASE}/?debug`, { name: 'Bravo' });
    for (const p of [a, b]) { await p.page.click('#btn-online'); await waitFor(p.page, () => window.__ashline.profile && window.__ashline.conn && window.__ashline.conn.kind === 'ws'); }
    ok(true, 'two browsers connected to the server');
    const code = (await a.page.textContent('#party-code')).trim();
    await b.page.fill('#join-code', code); await b.page.click('#btn-join');
    await waitFor(a.page, () => document.querySelectorAll('#party-members .member:not(.open)').length === 2, 20000);
    ok(true, `Bravo joined Alpha's party ${code}`);
    await a.page.click('#mode-buttons button[data-mode="duo"]').catch(() => {});
    await a.page.waitForTimeout(400);
    await shot(a.page, 'e2e-10-party');
    await a.page.click('#btn-play');
    await Promise.all([a, b].map(p => waitFor(p.page, () => window.__ashline.match, 60000)));
    const sq = await Promise.all([a, b].map(p => A(p.page, () => window.__ashline.match.squad)));
    ok(sq[0] === sq[1], 'both players are in the same squad');
    for (const p of [a, b]) await forceLock(p.page);
    await cmd(a.page, { c: 'test', op: 'tp', x: 300.5, z: -250 });
    await cmd(b.page, { c: 'test', op: 'tp', x: 303.5, z: -246 });
    await waitFor(a.page, () => { const m = window.__ashline.match; for (const r of m.remotes.values()) if (m.isMate(r.id) && r.cur && r.cur.mode === 0) return true; return false; }, 30000);
    ok(true, 'teammate is visible to Alpha on the ground');
    await A(a.page, () => { const m = window.__ashline.match; m.yaw = Math.atan2(-3, 4); m.pitch = -0.1; });
    await a.page.waitForTimeout(2500);
    await shot(a.page, 'e2e-11-squad');
    await cmd(a.page, { c: 'test', op: 'end' });
    await Promise.all([a, b].map(p => waitFor(p.page, () => document.getElementById('results').classList.contains('show'), 60000)));
    ok(true, 'both players get results');
    ok(a.errors.length + b.errors.length === 0, `no page errors online (${[...a.errors, ...b.errors].slice(0, 3).join(' | ')})`);
    await a.page.close(); await b.page.close();
  }

  // ------------------------------------------------------------------ standalone
  if (run('standalone')) {
    const file = join(ROOT, 'ASHLINE.html');
    if (!existsSync(file)) { ok(false, 'ASHLINE.html exists (run npm run build)'); }
    else {
      const s = await open('file://' + file + '?debug', { block: true });
      await s.page.click('#btn-practice');
      await waitFor(s.page, () => window.__ashline.profile);
      await s.page.click('#btn-play');
      await waitFor(s.page, () => window.__ashline.match && window.__ashline.match.alive > 0, 90000);
      ok(true, 'standalone file plays a practice match offline');
      await s.page.waitForTimeout(1500);
      await shot(s.page, 'e2e-12-standalone');
      ok(s.errors.length === 0, `no page errors in the standalone file (${s.errors.slice(0, 3).join(' | ')})`);
      await s.page.close();
    }
  }
} catch (e) {
  fails++;
  console.log('FAIL  exception:', e.message.split('\n')[0]);
}
await browser.close();
await srv.close();
rmSync(data, { recursive: true, force: true });
console.log(fails ? `${fails} e2e check(s) FAILED` : 'all e2e checks passed');
process.exit(fails ? 1 : 0);
