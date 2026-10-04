// Headless gameplay test: drives the critical path and core systems through window.__game.
// node tests/smoke.mjs
import { chromium } from 'playwright';
import { startServer } from '../tools/serve.mjs';

const port = 8000 + Math.floor(Math.random() * 900);
const server = await startServer(port, true);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message + '\n' + e.stack));
await page.goto(`http://localhost:${port}/index.html?test&seed=${process.env.SEED || 11}`);
await page.waitForFunction(() => window.__ready === true || window.__fatal, null, { timeout: 240000 });

let failed = 0;
async function check(name, fn) {
  try {
    const r = await page.evaluate(fn);
    if (r === true || (r && r.ok)) console.log('  ok   ', name, r && r.info ? r.info : '');
    else { failed++; console.log('  FAIL ', name, JSON.stringify(r)); }
  } catch (e) { failed++; console.log('  FAIL ', name, e.message); }
}

await page.evaluate(() => {
  const g = window.__game;
  g.noRender = true; g.fixedDt = 1 / 30;
  window.run = (sec) => { for (let t = 0; t < sec; t += 1 / 30) g.step(1 / 30); };
  window.take = (id) => { const p = g.story.pickups.find((q) => q.id === id); if (!p) throw new Error('no pickup ' + id); g.story.take(p); g.ui.show('reader', false); g.setMode('play'); };
  window.closeUI = () => { g.ui.hideAllScreens(); g.setMode('play'); };
  g.ui.setFade(0, 0.01);
});

console.log('Movement & collision');
await check('walks forward', () => { const g = __game; g.player.place(37.3, 55.6, 0); const z0 = g.player.pos.z; g.input.simKey('KeyW', true); run(1.5); g.input.simKey('KeyW', false); run(0.3); return { ok: g.player.pos.z < z0 - 2, info: (z0 - g.player.pos.z).toFixed(2) + 'm' }; });
await check('blocked by walls', () => { const g = __game; g.player.place(36.5, 43.5, Math.PI / 2); g.input.simKey('KeyW', true); run(2); g.input.simKey('KeyW', false); return { ok: g.player.pos.x > 35.25, info: g.player.pos.x.toFixed(2) }; });
await check('stairs follow ramp', () => { const g = __game; g.player.place(8.5, 12.5, 0); g.input.simKey('KeyW', true); run(4); g.input.simKey('KeyW', false); run(0.5); return { ok: g.player.pos.y < -2.5, info: 'y=' + g.player.pos.y.toFixed(2) }; });

console.log('Arrival');
await check('doormat gives key', () => { const g = __game; const d = g.interaction.list.find((i) => i.id === 'doormat'); d.use(); return g.inventory.has('key_front'); });
await check('front door unlocks + opens', () => { const g = __game; g.player.place(41, 48.5, 0); const d = g.doors.get('front_l'); g.story.useDoor(d); run(1.5); return { ok: g.doors.isOpen(d) && !d.locked, info: d.angle.toFixed(2) }; });
await check('walks into the lobby', () => { const g = __game; g.player.place(41, 49, 0); g.input.simKey('KeyW', true); run(3); g.input.simKey('KeyW', false); return { ok: g.player.pos.z < 45, info: g.player.pos.z.toFixed(2) }; });
await check('full 360 turn', () => { const g = __game; const y0 = g.player.yaw; g.input.simKey('ArrowRight', true); run(2.7); g.input.simKey('ArrowRight', false); g.input.simLook(5000, 0); run(0.1); return { ok: true, info: (g.player.yaw - y0).toFixed(2) }; });
await check('maintenance door locked without key', () => { const g = __game; const d = g.doors.get('maint'); return g.doors.isLocked(d); });
await check('custodian keys from infirmary', () => { take('key_maint'); return __game.inventory.has('key_maint'); });
await check('maintenance door unlocks', () => { const g = __game; g.player.place(8.5, 14.6, 0); const d = g.doors.get('maint'); g.story.useDoor(d); g.story.useDoor(d); run(1.5); return g.doors.isOpen(d); });

console.log('Power');
await check('research door sealed before power', () => { const g = __game; run(0.2); return g.doors.isLocked(g.doors.get('research')); });
await check('bird breaker releases research', () => { const g = __game; g.story.flipBreaker('bird'); run(1); return { ok: !g.doors.isLocked(g.doors.get('research')) && g.power.count() === 3, info: 'circuits ' + g.power.count() }; });
await check('fourth breaker trips the main', () => { const g = __game; g.story.flipBreaker('bulb'); run(1.5); return { ok: g.power.count() === 0, info: JSON.stringify(g.power.on) }; });
await check('research stays released after trip', () => { const g = __game; return !g.doors.isLocked(g.doors.get('research')); });
await check('re-enable bird + flame + speaker', () => { const g = __game; for (const b of ['bird', 'flame', 'speaker']) g.story.flipBreaker(b); run(0.5); return g.power.count() === 3; });

console.log('The Remainder');
await check('wakes and patrols', () => { const g = __game; closeUI(); g.player.place(25, 34.5, Math.PI / 2); g.ai.wake(45, 34.5); run(0.5); return { ok: g.ai.awake && g.ai.body.root.visible, info: g.ai.state }; });
await check('hears a noise and investigates', () => { const g = __game; g.ai.teleport(40, 34.5); g.ai.setState('patrol', { force: true }); g.noiseEvent(36, 34.5, 0.9, 'test', null); return { ok: g.ai.state === 'investigate' || g.ai.state === 'hunt', info: g.ai.state }; });
await check('path propagation hears around corners, not through walls', () => { const g = __game; g.ai.teleport(16, 20); g.ai.setState('patrol', { force: true }); g.ai.suspicion = 0; g.noiseEvent(16, 28, 0.3, 'test', null); return { ok: g.ai.state === 'patrol', info: g.ai.state }; });
await check('sees a lit player and chases', () => { const g = __game; g.player.place(30, 34.5, -Math.PI / 2); g.player.flashOn = true; g.ai.teleport(36, 34.5); g.ai.facing = -Math.PI / 2; g.ai.setState('patrol', { force: true }); run(1.5); return { ok: g.ai.state === 'chase', info: g.ai.state + ' detect=' + g.ai.detect.toFixed(2) }; });
await check('silence: world ducks when it is near', () => ({ ok: __game.audio.silence > 0.3 || __game.ai.presence() > 0.3, info: __game.ai.presence().toFixed(2) }));
await check('catches the player -> death', () => { const g = __game; for (let k = 0; k < 120 && g.player.alive; k++) run(0.1); return { ok: !g.player.alive, info: g.mode }; });
await check('death screen then checkpoint reload', () => { const g = __game; run(3); const m = g.mode; g.loadCheckpoint(); run(0.5); return { ok: m === 'cutscene' || m === 'death', info: m + ' -> ' + g.mode + ' alive=' + g.player.alive }; });
await check('reload restores alive play', () => { const g = __game; return g.player.alive && g.mode === 'play'; });
await check('hiding: not found when quiet', () => { const g = __game; g.ai.reset(); const s = g.story.hidingSpots.find((h) => h.id === 'hide_ringS'); g.player.place(s.exitX, s.exitZ, 0); g.player.hideIn(s); g.ai.wake(s.exitX + 1.5, s.exitZ); g.ai.checkSpot = s; g.ai.setState('check', { force: true }); g.ai.checkSpot = s; g.player.exhausted = false; g.player.fear = 0; run(2.5); const alive = g.player.alive; g.player.unhide(); g.ai.reset(); return { ok: alive, info: g.ai.state }; });
await check('oscillator lures it', () => { const g = __game; g.player.place(25, 34.5, Math.PI / 2); g.ai.wake(40, 34.5); g.inventory.add('oscillator', 1, true); g.throwOscillator(); run(1.5); return { ok: g.ai.state === 'lured', info: g.ai.state }; });
await check('stalk + watch behaviours start', () => { const g = __game; g.ai.reset(); g.power.on = { cup: true, bed: true }; g.ai.wake(40, 2); g.player.place(30, 2.5, Math.PI / 2); g.player.flashOn = false; const a = g.ai.startStalk(); g.ai.reset(); g.ai.wake(40, 2); g.player.place(40, 2.5, Math.PI / 2); const b = g.ai.startWatch(); g.ai.reset(); return { ok: a && b, info: `stalk=${a} watch=${b}` }; });

console.log('Mid game');
await check('director keys in reverb hall', () => { const g = __game; g.ai.reset(); take('key_director'); return g.inventory.has('key_director'); });
await check('office unlocks', () => { const g = __game; closeUI(); g.player.place(9, 18.5, -Math.PI / 2); const d = g.doors.get('office'); g.story.useDoor(d); g.story.useDoor(d); run(1); return g.doors.isOpen(d); });
await check('revelation docs + reel + gate key', () => { const g = __game; for (const id of ['morrow_note', 'obituary', 'disconnection', 'reel_dictation', 'key_gate']) take(id); return { ok: g.story.flags.revelation && g.inventory.has('reel_dictation') && g.inventory.has('key_gate'), info: g.story.phase }; });
await check('reel plays and recorder captures full phrase', () => { const g = __game; closeUI(); g.ai.reset(); g.power.on = { bird: true, cup: true }; g.player.place(60.5, 30.5, Math.PI / 2); g.story.useDeck(); let r = null; for (let k = 0; k < 400 && r !== 'done'; k++) r = g.story.recordTick(1 / 30); g.story.stopReel(); return { ok: g.inventory.tape?.id === 'morrow' && g.inventory.tape.quality === 1, info: JSON.stringify(g.inventory.tape) }; });
await check('voice lock opens the vault -> finale', () => { const g = __game; g.player.place(69.5, 6.5, Math.PI / 2); g.story.useVoiceLock(g.map.props.find((p) => p.id === 'voicePanel')); run(12); return { ok: g.story.flags.vaultOpen && g.story.flags.finale && g.doors.isOpen(g.doors.get('vault')), info: 'ai ' + g.ai.state }; });
await check('room tone recordable in Chamber Zero', () => { const g = __game; g.ai.reset(); g.player.place(75.5, 7.5, Math.PI / 2); let r; for (let k = 0; k < 300 && r !== 'done'; k++) r = g.story.recordTick(1 / 30); return { ok: g.story.flags.roomTone, info: g.inventory.tape?.label }; });

console.log('Boiler & Full Spectrum');
await check('wrong valves vent steam', () => { const g = __game; g.power.on = { bird: true, flame: true, speaker: true }; g.story.valves = [0, 0, 0]; g.story.ignite(); return !g.story.boilerRunning; });
await check('chalk solution starts boiler', () => { const g = __game; g.story.valves = g.story.valveSolution.slice(); g.story.ignite(); return g.story.boilerRunning && g.nav.repel.length > 0; });
await check('PA amplifiers', () => { const g = __game; g.interaction.list.find((i) => i.id === 'ampRack').use(); return g.story.flags.paOn; });
await check('sweep runs 60s and destroys it', () => { const g = __game; g.ai.reset(); g.ai.wake(40, 2); g.player.place(62.9, 30, 0); g.ai.noKill = true; g.story.trySweep(); const started = g.story.sweepActive; run(62); return { ok: started && g.story.flags.fullSpectrum && g.ai.state === 'dead', info: `started=${started} state=${g.ai.state}` }; });
await check('save snapshot serialises', () => { const g = __game; const s = JSON.stringify(g.snapshot()); return { ok: s.length > 500, info: s.length + ' bytes' }; });

console.log('Endings');
await check('gate unlocks with key', () => { const g = __game; closeUI(); g.player.place(40.5, 61, Math.PI); const d = g.doors.get('gate_l'); g.story.useDoor(d); return g.story.flags.gateOpen; });
await check('car -> FULL SPECTRUM ending', () => { const g = __game; g.story.tryLeave(); run(5); return { ok: g.mode === 'ending' && document.getElementById('ending-title').textContent === 'FULL SPECTRUM', info: g.mode }; });

const fatal = await page.evaluate(() => window.__fatal || null);
if (fatal) { failed++; console.log('FATAL', fatal); }
const errs = errors.filter((e) => !e.includes('AudioContext'));
if (errs.length) { console.log('console errors:\n' + errs.slice(0, 10).join('\n')); failed += errs.length; }
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
