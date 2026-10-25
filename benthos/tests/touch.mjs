// Drives the game on an emulated phone: taps through the title menu, thrusts with the left-thumb
// stick, presses on-screen buttons, and checks each reaches the game.
// Usage: node benthos/tests/touch.mjs [shotDir]
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = process.argv[2] || null;
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e.stack || e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + path.join(root, 'index.html'));
await page.waitForTimeout(300);
const cdp = await ctx.newCDPSession(page);
const ev = (fn, a) => page.evaluate(fn, a);
const tick = n => ev(n => { B.noAutoPause = true; for (let k = 0; k < n; k++) { B.debug.tick(1); if (k % 6 === 0) B.debug.draw(); } B.debug.draw(); }, n);
// buffer coordinates (480x270 grid) -> CSS pixels on the page
const css = (bx, by) => ev(([bx, by]) => { const r = document.getElementById('game').getBoundingClientRect(), o = B.out, s = B.W / 480; return [r.left + o.x + bx * s / B.W * o.w, r.top + o.y + by * s / B.H * o.h]; }, [bx, by]);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
const tap = async (bx, by, hold) => { const p = await css(bx, by); await touch('touchStart', [p]); await tick(hold || 2); await touch('touchEnd', []); await tick(2); };
const shot = async n => { if (shotDir) await page.screenshot({ path: path.join(shotDir, n + '.png') }); };
let fails = 0;
const expect = async (label, fn, a) => { const r = await ev(fn, a); console.log((r ? 'ok   ' : 'FAIL ') + label); if (!r) fails++; return r; };

await ev(() => localStorage.clear());
await tick(10);
await tap(240, 135);
await tick(10);
await expect('first touch switches to touch mode', () => B.I.touchMode === true);
await expect('title menu is open', () => B.mode === 'title' && B.Hud.menuOpen());
await shot('t01-title');
// tap the first menu item (BEGIN DESCENT): find its row from the menu layout
const row = await ev(() => { const m = B.Hud._menu(); const s = 480 / B.W; return [(m.x0 + 20) * s, (m.y0 + m.lh * m.sel + 3) * s]; });
await tap(row[0], row[1]);
await tick(20);
await expect('tapping BEGIN DESCENT starts on the deck', () => B.mode === 'play' && B.act === 'deck');
await shot('t02-deck');
// walk with the stick: thumb down at (70,196), drag right
const x0 = await ev(() => B.player.x);
const a = await css(70, 196), b = await css(100, 196);
await touch('touchStart', [a]); await tick(2); await touch('touchMove', [b]); await tick(60);
await expect('the stick walks her across the deck', x => B.player.x > x + 0.5, x0);
await shot('t03-stick');
await touch('touchEnd', []); await tick(5);
await expect('lifting the thumb releases the stick', () => !B.I.touch.stick && B.I.move().x === 0);
// into the water
await ev(() => B.debug.start('act1', 200));
await tick(30);
await expect('in the water the full button set is laid out', () => B.touchLayout().some(b => b.id === 'ping') && B.touchLayout().some(b => b.id === 'trim'));
await shot('t04-water');
const lamp0 = await ev(() => B.player.lampMode);
await tap(448, 194);
await expect('LAMP cycles the lamp', l => B.player.lampMode !== l, lamp0);
const pings0 = await ev(() => B.player.pingCD);
await tap(410, 252);
await tick(2);
await expect('PING sends a ping', p => B.player.pingCD > p, pings0);
const trim0 = await ev(() => B.player.trim);
const t = await css(469, 150);
await touch('touchStart', [t]); await tick(40); await touch('touchEnd', []); await tick(2);
await expect('the lower half of the trim bar floods the tank', tr => B.player.trim < tr - 0.2, trim0);
const u = await css(469, 100);
await touch('touchStart', [u]); await tick(60); await touch('touchEnd', []); await tick(2);
await expect('the upper half blows it', tr => B.player.trim > tr - 0.1, trim0);
// two fingers: stick and aim at once
const s1 = await css(70, 196), s2 = await css(80, 196), aim = await css(300, 60);
await touch('touchStart', [s1]); await touch('touchMove', [s2]); await touch('touchStart', [s2, aim]); await tick(30);
await expect('two fingers: one thrusts, one aims up', () => B.player.thrust > 0.2 && B.player.aimY < -0.3);
await touch('touchEnd', []); await tick(5);
await tap(240, 12);
await tick(3);
await expect('II pauses the game', () => B.mode === 'pause');
await shot('t05-pause');

console.log(errors.length ? '\nERRORS:\n' + errors.slice(0, 15).join('\n') : '\nno page errors');
await browser.close();
process.exit(errors.length || fails ? 1 : 0);
