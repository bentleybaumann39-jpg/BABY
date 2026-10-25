// Plays the critical path with simulated input and asserts each story beat happens:
// deck -> footage -> cage -> Act I stops -> cage fall -> Act II -> the Breach (death, RETRY, resume)
// -> Magpie and the Wren -> up is down -> Act III -> the Archive -> the Ascent ending -> credits -> title.
// Usage: node benthos/tests/story.mjs [shotDir]
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = process.argv[2] || null;
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e.stack || e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + path.join(root, 'index.html'));
await page.waitForTimeout(300);
await page.mouse.click(480, 270);
const ev = (fn, a) => page.evaluate(fn, a);
// run n fixed ticks, drawing every 6th so the frame pipeline is exercised too
const tick = n => ev(n => { B.noAutoPause = true; for (let k = 0; k < n; k++) { B.debug.tick(1); if (k % 6 === 0) B.debug.draw(); } B.debug.draw(); }, n);
const press = async (action, hold) => { await ev(a => { B.I.hit[a] = true; B.I.state[a] = true; }, action); await tick(hold || 2); await ev(a => { B.I.state[a] = false; B.I.up[a] = true; }, action); await tick(2); };
const shot = async n => { if (shotDir) await page.screenshot({ path: path.join(shotDir, n + '.png') }); };
let fails = 0;
const expect = async (label, fn, a) => {
  const r = await ev(fn, a); console.log((r ? 'ok   ' : 'FAIL ') + label);
  if (!r) { fails++; console.log('     state:', JSON.stringify(await ev(() => ({ mode: B.mode, act: B.act, pos: B.player && [B.player.x, B.player.y, B.player.z].map(v => +v.toFixed(1)), prompt: B.player && B.player.prompt && B.player.prompt.label, lockT: B.player && B.player.lockT, locked: B.Story.locked, capture: B.Hud.capture(), menu: B.Hud.menuOpen(), dead: B.player && B.player.dead })))); }
  return r;
};

await ev(() => localStorage.clear());
await tick(10);
await expect('title menu is open', () => B.mode === 'title' && B.Hud.menuOpen());
await press('confirm');
await tick(10);
await expect('new game starts on the deck', () => B.mode === 'play' && B.act === 'deck');
// walk to Tobias and talk
await ev(() => { const p = B.player; p.x = 22.6; p.y = 28.1; });
await tick(5);
await expect('Tobias offers the eleven seconds', () => B.player.prompt && /TOBIAS/.test(B.player.prompt.label));
await press('interact');
await tick(60 * 3);
await expect('footage plays', () => B.mode === 'scene');
await shot('s01-footage');
await tick(60 * 12);
await expect('footage ends, back on deck', () => B.mode === 'play' && B.state.flags.footage);
await ev(() => { const p = B.player; p.x = 13.2; p.y = 32; });
await tick(5);
await expect('cage offers suit-up', () => B.player.prompt && /CAGE/.test(B.player.prompt.label));
await press('interact');
await tick(60 * 3);
await expect('Act I begins in the cage', () => B.act === 'act1' && !!B.player.inCage);
await tick(60 * 12);
await expect('cage arrives at the Sunlit Wall', () => B.act === 'act1' && !B.player.inCage && B.player.z > 25 && B.player.z < 45);
await shot('s02-sunlit');
// ride the cage down stop by stop
await ev(() => B.debug.god(true));
for (let stop = 2; stop <= 4; stop++) {
  await ev(() => { const c = B.E.byType('cage')[0]; const p = B.player; p.x = c.x; p.y = c.y; p.z = c.z; });
  await tick(3);
  await press('interact');
  for (let k = 0; k < 70; k++) { await tick(60); if (await ev(() => !B.player.inCage)) break; }
  await expect('cage reached stop ' + stop, (s) => B.E.byType('cage')[0].stop === s, stop);
}
await shot('s03-gannet');
await ev(() => { const c = B.E.byType('cage')[0]; const p = B.player; p.x = c.x; p.y = c.y; p.z = c.z; });
await tick(3);
await press('interact');
for (let k = 0; k < 40; k++) { await tick(60); if (await ev(() => B.state.flags.cageFell)) break; }
await tick(60 * 4);
await expect('the cage falls at 780', () => B.state.flags.cageFell && B.E.byType('cage')[0].falling !== undefined);
await shot('s04-cagefall');
// on to Act II
await ev(() => B.debug.warp(80, 80, 1001));
await tick(60 * 3);
await expect('Act II loads below Midnight Ledge', () => B.act === 'act2');
await ev(() => { B.debug.god(false); B.Story.godMode = false; B.player.z = 1062; });
for (let k = 0; k < 90; k++) { await tick(60); if (await ev(() => B.mode === 'dead')) break; }
await expect('the Breach kills her at 1,140 m', () => B.mode === 'dead' && B.deadCause === 'breach');
await shot('s05-signal-lost');
await tick(60 * 2);
await press('confirm');
await tick(60 * 2);
await expect('RETRY resumes without a reload, 260 m deeper', () => B.mode === 'play' && B.state.flags.breached && B.player.z > 1390 && B.player.res === 2 && B.player.flipped);
await tick(60 * 3);
await shot('s06-resumed');
// Magpie
await ev(() => { B.debug.god(true); const f = B.map.features; B.debug.warp(f.MX - 2.3, f.MY, B.World.H(B.map, f.MX - 2.3, f.MY) - 1.3); });
await tick(20);
await expect('Magpie offers the Wren', () => B.player.prompt && /WREN/.test(B.player.prompt.label));
const pre = await ev(() => { B.I.hit.interact = true; B.I.state.interact = true; const r = { prompt: B.player.prompt && B.player.prompt.label, mode: B.mode, lock: B.player.lockT, locked: B.Story.locked, cap: B.Hud.capture() }; B.debug.tick(1); r.after = B.state.flags.wren; B.I.state.interact = false; return r; });
console.log('     press:', JSON.stringify(pre));
await tick(60 * 8);
await expect('the Wren is taken and the drop prompt shown', () => B.state.flags.wren && B.state.flags.dropPrompt);
await press('rise', 30);
for (let k = 0; k < 60; k++) { await tick(60); if (await ev(() => B.act === 'act3')) break; }
await expect('up is down: she falls into Act III', () => B.act === 'act3' && B.state.flags.fell);
await tick(60 * 3);
await shot('s07-act3');
// the Archive
await ev(() => { const f = B.map.features; B.debug.warp(f.AX + 1.6, f.AY, B.World.H(B.map, f.AX + 1.6, f.AY) - 1.3); });
await tick(10);
await expect('the Archive core can be used', () => B.player.prompt && /WREN/.test(B.player.prompt.label));
await press('interact');
await tick(60 * 4);
await expect('the Wren footage plays', () => B.mode === 'scene');
await shot('s08-wren');
for (let k = 0; k < 40; k++) { await tick(60); if (await ev(() => B.Hud.menuOpen())) break; }
await expect('the ending menu opens', () => B.Hud.menuOpen());
await shot('s09-endings');
await press('confirm');
await tick(60 * 15);
await expect('the Ascent is rising', () => B.mode === 'scene' && B.player.z < 4000);
await shot('s10-ascent');
for (let k = 0; k < 160; k++) { await tick(60); if (await ev(() => B.act === 'deck')) break; }
await expect('the ascent surfaces on the deck', () => B.act === 'deck');
await tick(60 * 12);
await shot('s11-epilogue');
for (let k = 0; k < 120; k++) { await tick(60); if (await ev(() => B.mode === 'title')) break; }
await expect('credits return to the title, NG+ unlocked', () => B.mode === 'title' && B.meta.ngplus);

console.log(errors.length ? '\nERRORS:\n' + errors.slice(0, 15).join('\n') : '\nno page errors');
await browser.close();
process.exit(errors.length || fails ? 1 : 0);
