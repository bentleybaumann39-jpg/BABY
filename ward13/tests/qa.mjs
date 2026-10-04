// Ward 13 automated QA harness.
// Usage: node ward13/tests/qa.mjs [scenario ...] [--file=path.html] [--shots]
// Runs headless Chromium (SwiftShader). The three.js CDN request is served from ward13/vendor
// so tests work offline. Prints a Pass/Fail table and exits non-zero on any failure.
import { chromium } from '/home/user/BABY/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const fileArg = args.find(a => a.startsWith('--file='));
const FILE = fileArg ? path.resolve(fileArg.slice(7)) : path.join(root, 'index.html');
const SHOTS = args.includes('--shots');
const OFFLINE = args.includes('--offline'); // block ALL network: proves the file runs with no CDN
const wanted = args.filter(a => !a.startsWith('--'));
const shotDir = path.join(root, 'tests', 'shots');
if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

const openPages = [];
async function open(browser, { width = 800, height = 450, init } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  openPages.push(page);
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|ERR_NAME|fonts/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.addInitScript(() => { window.__W13_TEST = 1; });
  if (init) await page.addInitScript(init);
  if (OFFLINE) await page.route(/^https?:/, r => r.abort());
  else {
    await page.route('**/three.min.js', r => r.fulfill({ body: fs.readFileSync(path.join(root, 'vendor', 'three.min.js')), contentType: 'text/javascript' }));
    await page.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  }
  const t0 = Date.now();
  await page.goto('file://' + FILE, { timeout: 90000 });
  await waitState(page, s => s === 'menu', 60000);
  return { page, errors, bootMs: Date.now() - t0 };
}
const st = page => page.evaluate(() => window.__w13 && window.__w13.state);
async function waitState(page, pred, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (pred(await st(page))) return Date.now() - t0; } catch (e) {} await sleep(150); }
  throw new Error('timeout waiting for state; last=' + (await st(page).catch(() => '?')));
}
async function newGame(page) {
  await page.click('#bNew');
  await waitState(page, s => s === 'intro', 5000).catch(() => {});
  await page.keyboard.press('Space');
  return waitState(page, s => s === 'play', 60000);
}
async function gotoFloor(page, lvl) {
  await page.evaluate(l => { const w = window.__w13; w.save.level = l; w.startFloor(); }, lvl);
  return waitState(page, s => s === 'play', 60000);
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(shotDir, name + '.png') }); };

const S = {};

S.buildFresh = async () => {
  const { execFileSync } = await import('child_process');
  try { const o = execFileSync('node', [path.join(root, 'tools', 'build.mjs'), '--check'], { encoding: 'utf8' }); return { ok: true, info: o.trim(), errors: [] }; }
  catch (e) { return { ok: false, info: (e.stderr || e.message).trim(), errors: [] }; }
};

S.boot = async b => {
  const { page, errors, bootMs } = await open(b);
  const menuOn = await page.evaluate(() => document.getElementById('menu').classList.contains('on'));
  await shot(page, 'boot-menu');
  await page.close();
  return { ok: menuOn && !errors.length, info: `menu in ${bootMs} ms`, errors };
};

S.newgame = async b => {
  const { page, errors } = await open(b);
  // capture the screen mid-load: the title card must sit on black, not on a stale frame
  await page.click('#bNew');
  await waitState(page, s => s === 'intro', 5000).catch(() => {});
  await page.keyboard.press('Space');
  await waitState(page, s => s === 'loading', 5000).catch(() => {});
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: 200, height: 100 } });
  if (SHOTS) fs.writeFileSync(path.join(shotDir, 'loading.png'), buf);
  const t0 = Date.now(); await waitState(page, s => s === 'play', 60000); const ms = Date.now() - t0;
  const dark = await (async () => { const p2 = await b.newPage(); await p2.setContent(`<canvas id=c></canvas>`); const v = await p2.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.getElementById('c'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s / (d.length / 4) / 3; }, buf.toString('base64')); await p2.close(); return v; })();
  await sleep(1500);
  const hud = await page.evaluate(() => document.getElementById('hud').classList.contains('on'));
  await shot(page, 'floor1');
  await page.close();
  return { ok: hud && dark < 20 && !errors.length, info: `floor 1 playable ${ms} ms after intro skip; mid-load corner brightness ${dark.toFixed(1)}/255`, errors };
};

S.controls = async b => {
  const { page, errors } = await open(b);
  await newGame(page);
  const log = [];
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) { await page.keyboard.down(k); await sleep(500); await page.keyboard.up(k); }
  const p0 = await page.evaluate(() => ({ x: window.__w13.P.x, z: window.__w13.P.z }));
  await page.keyboard.down('KeyW'); await sleep(1200); await page.keyboard.up('KeyW');
  const p1 = await page.evaluate(() => ({ x: window.__w13.P.x, z: window.__w13.P.z }));
  log.push('moved ' + Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2) + 'm');
  const light0 = await page.evaluate(() => window.__w13.P.light);
  await page.keyboard.press('KeyF'); await sleep(200);
  const light1 = await page.evaluate(() => window.__w13.P.light);
  await page.keyboard.press('KeyF');
  log.push('flashlight toggles ' + (light0 !== light1));
  const fl0 = await page.evaluate(() => window.__w13.P.flash);
  await page.keyboard.press('KeyQ'); await sleep(200);
  const fl1 = await page.evaluate(() => window.__w13.P.flash);
  log.push('flash charges ' + fl0 + '->' + fl1);
  await page.keyboard.press('KeyV'); await sleep(300);
  const cam = await page.evaluate(() => window.__w13.P.cam);
  await page.keyboard.press('KeyV');
  await page.keyboard.press('KeyM'); await sleep(200);
  const map = await page.evaluate(() => getComputedStyle(document.getElementById('map')).display);
  await page.keyboard.press('KeyM');
  await page.evaluate(() => { window.__w13.P.hp = 40; window.__w13.P.san = 20; });
  await page.keyboard.press('Digit1'); await page.keyboard.press('Digit2'); await page.keyboard.press('Digit3'); await page.keyboard.press('KeyG');
  await sleep(400);
  const after = await page.evaluate(() => ({ hp: window.__w13.P.hp, san: window.__w13.P.san, inv: window.__w13.save.inv }));
  log.push(`items hp=${after.hp.toFixed(0)} san=${after.san.toFixed(0)} inv=${JSON.stringify(after.inv)}`);
  await page.keyboard.press('Escape'); await sleep(300);
  const paused = await st(page);
  await page.click('#bResume'); await sleep(300);
  const resumed = await st(page);
  log.push(`pause=${paused} resume=${resumed}`);
  await shot(page, 'controls');
  await page.close();
  const ok = light0 !== light1 && fl1 === fl0 - 1 && cam && map === 'block' && after.hp > 40 && after.san > 20 && paused === 'paused' && resumed === 'play' && !errors.length;
  return { ok, info: log.join('; '), errors };
};

S.floors = async b => {
  const { page, errors } = await open(b, { width: 480, height: 270 });
  await newGame(page);
  const rows = [];
  const only = process.env.FLOORS ? process.env.FLOORS.split(',').map(Number) : Array.from({ length: 30 }, (_, i) => i + 1);
  for (const lvl of only) {
    const ms = await gotoFloor(page, lvl);
    await sleep(1200);
    const info = await page.evaluate(() => { const w = window.__w13, L = w.L; return { q: L.quest && L.quest.type, en: L.enemies.length, boss: !!(L.boss), exit: !!L.exitE, stateNow: w.state, hp: w.P.hp }; });
    rows.push(`${lvl}:${ms}ms/${info.q}/${info.en}e${info.boss ? '/boss' : ''}${info.stateNow !== 'play' ? '/' + info.stateNow : ''}`);
    if (lvl % 5 === 0) await shot(page, 'floor' + lvl);
  }
  await page.close();
  return { ok: !errors.length, info: rows.join(' '), errors };
};

S.deathRetry = async b => {
  const { page, errors } = await open(b);
  await newGame(page);
  await page.evaluate(() => { const w = window.__w13; w.save.inv.lazarus = 0; w.P.inv = 0; w.hurt(9999, null); });
  await waitState(page, s => s === 'dead', 60000);
  await page.click('#bRetry');
  const ms = await waitState(page, s => s === 'play', 60000);
  await page.evaluate(() => { const w = window.__w13; w.save.inv.lazarus = 1; w.P.inv = 0; w.hurt(9999, null); });
  await sleep(300);
  const laz = await page.evaluate(() => ({ s: window.__w13.state, hp: window.__w13.P.hp, laz: window.__w13.save.inv.lazarus }));
  await page.close();
  return { ok: laz.s === 'play' && laz.hp > 0 && laz.laz === 0 && !errors.length, info: `retry ${ms} ms; lazarus -> ${JSON.stringify(laz)}`, errors };
};

S.shopLoop = async b => {
  const { page, errors } = await open(b);
  await newGame(page);
  await page.evaluate(() => { window.__w13.save.obols = 1000; window.__w13.completeFloor(); });
  await waitState(page, s => s === 'done', 5000);
  await page.click('#bToShop');
  await waitState(page, s => s === 'shop', 5000);
  const before = await page.evaluate(() => window.__w13.save.obols);
  await page.evaluate(() => { const w = window.__w13; for (let i = 0; i < 20; i++) { w.buyUp('battery'); w.buySup('medkit'); } });
  const after = await page.evaluate(() => ({ o: window.__w13.save.obols, up: window.__w13.save.up.battery, med: window.__w13.save.inv.medkit }));
  await shot(page, 'shop');
  await page.click('#bDescend');
  const ms = await waitState(page, s => s === 'play', 60000);
  const lvl = await page.evaluate(() => window.__w13.L.lvl);
  // reload and check the save persisted
  await page.reload(); await waitState(page, s => s === 'menu', 30000);
  const cont = await page.evaluate(() => !document.getElementById('bContinue').disabled);
  await page.close();
  const ok = after.up === 4 && after.med === 5 && after.o < before && lvl === 2 && cont && !errors.length;
  return { ok, info: `obols ${before}->${after.o}, battery up ${after.up}, medkits ${after.med}, floor ${lvl} in ${ms} ms, continue=${cont}`, errors };
};

S.spam = async b => {
  const { page, errors } = await open(b);
  await newGame(page);
  const keys = ['KeyE', 'KeyQ', 'KeyF', 'KeyV', 'KeyM', 'Digit1', 'Digit2', 'Digit3', 'KeyG', 'Space', 'KeyC'];
  for (let i = 0; i < 150; i++) await page.keyboard.press(keys[i % keys.length], { delay: 0 });
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Escape'); await sleep(40); }
  await sleep(300);
  const s1 = await st(page);
  if (s1 === 'paused') await page.click('#bResume');
  await sleep(500);
  const s2 = await st(page);
  await page.close();
  return { ok: (s2 === 'play') && !errors.length, info: `after spam state=${s1} -> ${s2}`, errors };
};

S.resize = async b => {
  const { page, errors } = await open(b);
  await newGame(page);
  const sizes = [[1280, 720], [1920, 820], [800, 600], [1440, 900], [390, 844], [2560, 1440]];
  const bad = [];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    for (let i = 0; i < 60; i++) { await sleep(250); if (await page.evaluate(([w, h]) => { const c = document.getElementById('gl'); return c.clientWidth === w && c.clientHeight === h; }, [w, h])) break; }
    const r = await page.evaluate(() => { const c = document.getElementById('gl'), hud = document.getElementById('hud'); const over = [...hud.querySelectorAll('*')].filter(e => { const b = e.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.bottom > innerHeight + 1 || b.left < -1); }).map(e => e.id || e.className).slice(0, 5); const r1 = document.getElementById('band').getBoundingClientRect(), r2 = document.getElementById('belt').getBoundingClientRect(); if (r1.width && r2.width && r1.right > r2.left && r2.right > r1.left && r1.bottom > r2.top && r2.bottom > r1.top) over.push('band-overlaps-belt'); return { cw: c.clientWidth, ch: c.clientHeight, over }; });
    if (r.cw !== w || r.ch !== h || r.over.length) bad.push(`${w}x${h}:${r.cw}x${r.ch} over=${r.over.join('|')}`);
    if (w * h <= 1280 * 900) await shot(page, `res-${w}x${h}`);
  }
  await page.close();
  return { ok: !bad.length && !errors.length, info: bad.length ? bad.join(' ; ') : 'all sizes fill viewport, HUD in bounds', errors };
};

S.corruptSave = async b => {
  const results = [];
  const good = { v: 3, level: 7, ng: 1, obols: 412, up: { battery: 2, lens: 1 }, inv: { medkit: 3, pills: 0, battery: 2, flare: 1, lazarus: 1 }, notes: [0, 4, 9], stats: { deaths: 5, kills: 12, time: 900, earned: 600 }, seed: 12345, habit: { hide: 2, flash: 7, sprint: 30 }, endings: ['up'], done: 1 };
  const cases = [
    ['good save is kept intact', JSON.stringify(good), null, 'same'],
    ['not json', '{not json', null, 'none'],
    ['empty v3', JSON.stringify({ v: 3 }), null, 'play'],
    ['nulls + level 99', JSON.stringify({ v: 3, level: 99, inv: null, up: null, stats: null, notes: null }), null, 'play'],
    ['junk types', JSON.stringify({ v: 3, level: '4', obols: 'lots', up: { battery: 99, bogus: 3 }, inv: { medkit: -4, flare: 'x' }, notes: [1, 1, 'x', 500, -1], stats: [], habit: 'no', endings: ['up', 'hack'] }), null, 'play'],
    ['old version', JSON.stringify({ v: 2, level: 4 }), null, 'none'],
    ['corrupt settings', JSON.stringify(good), '{"quality":"ultra","vol":"x","sens":null,"bright":99,"ui":7,"invert":"yes"}', 'play'],
    ['settings not json', null, '{{{', 'newgame'],
  ];
  for (const [name, sv, set, expect] of cases) {
    const init = `try{localStorage.clear();${sv !== null ? `localStorage.setItem('w13.save', ${JSON.stringify(sv)});` : ''}${set !== null ? `localStorage.setItem('w13.settings', ${JSON.stringify(set)});` : ''}}catch(e){}`;
    const { page, errors } = await open(b, { init });
    let got = '?';
    try {
      const cont = await page.evaluate(() => !document.getElementById('bContinue').disabled);
      if (expect === 'same') {
        const same = await page.evaluate(g => { const c = o => JSON.stringify(o, Object.keys(o).sort()); const s = window.__w13.save; return JSON.stringify(JSON.parse(JSON.stringify(s), (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v)) === JSON.stringify(JSON.parse(JSON.stringify(g), (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v)); }, good);
        got = same ? 'same' : 'changed:' + JSON.stringify(await page.evaluate(() => window.__w13.save));
      } else if (expect === 'none') got = cont ? 'continue-enabled' : 'none';
      else if (expect === 'newgame') { got = (await newGame(page).then(() => 'newgame')); }
      else {
        if (!cont) got = 'no-continue';
        else { await page.click('#bContinue'); await waitState(page, x => x === 'shop', 8000); await page.click('#bDescend'); await waitState(page, x => x === 'play', 60000); got = 'play'; }
      }
    } catch (e) { got = 'threw ' + e.message.split('\n')[0]; }
    const ok = got === expect && !errors.length;
    results.push(`${ok ? 'ok' : 'BAD'} ${name}: ${got}${errors.length ? ' ' + errors[0].slice(0, 120) : ''}`);
    await page.close();
  }
  return { ok: results.every(r => r.startsWith('ok')), info: results.join(' | '), errors: [] };
};

S.scares = async b => {
  const { page, errors } = await open(b);
  await newGame(page);
  const out = [];
  for (const k of ['sigStalker', 'sigCascade', 'sigCrash']) {
    await page.evaluate(k => window.__w13[k](), k);
    await sleep(600);
    out.push(k + ':' + (await page.evaluate(() => window.__w13.DIR.st && window.__w13.DIR.st.k)));
    await sleep(3500);
  }
  // interrupt a fake crash by pausing then quitting to the menu
  await page.evaluate(() => window.__w13.sigCrash()); await sleep(300);
  await page.keyboard.press('Escape'); await sleep(300);
  await page.click('#bQuit'); await sleep(500);
  const leftover = await page.evaluate(() => ({ overlay: !!document.getElementById('fakecrash'), gain: window.__w13.AU && window.__w13.AU.master ? window.__w13.AU.master.gain.value : null }));
  out.push('after quit overlay=' + leftover.overlay + ' gain=' + leftover.gain);
  await page.close();
  return { ok: !leftover.overlay && (leftover.gain === null || leftover.gain > 0.01) && !errors.length, info: out.join(' '), errors };
};

S.soak = async b => {
  const { page, errors } = await open(b, { width: 480, height: 270 });
  await newGame(page);
  const mins = Number(process.env.SOAK_MIN || 2);
  const samples = [];
  const t0 = Date.now();
  while (Date.now() - t0 < mins * 60000) {
    await page.keyboard.down('KeyW'); await sleep(1500); await page.keyboard.up('KeyW');
    await page.evaluate(() => { window.__w13.P.yaw += 1.1; window.__w13.P.hp = 100; window.__w13.P.inv = 5; });
    const m = await page.evaluate(() => ({ heap: performance.memory ? performance.memory.usedJSHeapSize : 0, objs: (() => { let n = 0; window.__w13.scene.traverse(() => n++); return n; })(), en: window.__w13.L.enemies.length, s: window.__w13.state }));
    if (m.s === 'paused') await page.click('#bResume').catch(() => {});
    samples.push(m);
  }
  const f = samples[1] || samples[0], l = samples[samples.length - 1];
  await page.close();
  return { ok: !errors.length && l.objs < f.objs * 1.5 + 200, info: `${samples.length} samples; heap ${(f.heap / 1e6).toFixed(1)}->${(l.heap / 1e6).toFixed(1)} MB; scene objects ${f.objs}->${l.objs}; enemies ${f.en}->${l.en}`, errors };
};

S.fatalRecovery = async b => {
  // Injects a broken enemy so the update loop throws, then checks the recovery panel and that play resumes cleanly.
  const { page, errors } = await open(b);
  await newGame(page);
  await page.evaluate(() => { window.__w13.L.enemies.push({ injected: true }); });
  await waitState(page, s => s === 'crashed', 20000);
  const panel = await page.evaluate(() => document.getElementById('crashed').classList.contains('on') && document.getElementById('crashMsg').textContent);
  const injected = errors.length; errors.length = 0;
  await page.click('#bCrashMenu');
  await waitState(page, s => s === 'menu', 5000);
  await page.click('#bContinue'); await waitState(page, s => s === 'shop', 8000);
  await page.click('#bDescend'); await waitState(page, s => s === 'play', 60000);
  await sleep(1500);
  const after = await st(page);
  await page.close();
  return { ok: !!panel && injected >= 1 && after === 'play' && !errors.length, info: `panel="${panel}" -> menu -> continue -> ${after}`, errors };
};

S.captions = async b => {
  const { page, errors } = await open(b, { init: `try{localStorage.setItem('w13.settings', '{"captions":true}')}catch(e){}` });
  await newGame(page);
  const r = await page.evaluate(async () => {
    const w = window.__w13, P = w.P, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    w.sigStalker(); // breathing behind
    await new Promise(r => setTimeout(r, 2500));
    const a = document.getElementById('caps').textContent;
    return a;
  });
  await page.close();
  return { ok: /Breathing, close behind you/.test(r) && !errors.length, info: `captions: "${r}"`, errors };
};

S.settingsUI = async b => {
  const { page, errors } = await open(b, { width: 1280, height: 720 });
  await page.click('#bSettings');
  await sleep(300);
  const fit = await page.evaluate(() => { const p = document.querySelector('#settings .panel').getBoundingClientRect(); const btn = document.getElementById('bSetBack').getBoundingClientRect(); return { top: p.top, bottom: p.bottom, btnVisible: btn.bottom <= Math.min(innerHeight, p.bottom) + 1 && btn.top >= p.top, scrollable: document.querySelector('#settings').scrollHeight > innerHeight }; });
  await shot(page, 'settings');
  await page.evaluate(() => { const f = document.getElementById('sFov'); f.value = 88; f.dispatchEvent(new Event('input')); const c = document.getElementById('sStill'); c.checked = true; c.dispatchEvent(new Event('change')); const k = document.getElementById('sCap'); k.checked = true; k.dispatchEvent(new Event('change')); });
  await page.keyboard.press('Escape'); await sleep(200);
  const escBack = await page.evaluate(() => document.getElementById('menu').classList.contains('on'));
  await page.reload(); await waitState(page, s => s === 'menu', 60000);
  const saved = await page.evaluate(() => { const s = window.__w13.settings; return { fov: s.fov, still: s.still, captions: s.captions, ui: document.getElementById('sFov').value }; });
  await newGame(page); await sleep(2500);
  const fov = await page.evaluate(() => window.__w13.scene.children.find(o => o.isCamera)?.fov);
  await page.close();
  const ok = saved.fov === 88 && saved.still && saved.captions && saved.ui === '88' && Math.abs(fov - 88) < 3 && fit.btnVisible && escBack && !errors.length;
  return { ok, info: `escBack=${escBack} saved=${JSON.stringify(saved)} cameraFov=${fov && fov.toFixed(1)} panelFits=${JSON.stringify(fit)}`, errors };
};

S.tips = async b => {
  // Contextual onboarding: the UV tip appears the first time an enemy is in view, once.
  const { page, errors } = await open(b);
  await newGame(page);
  await page.evaluate(() => { window.__w13.msg.t = 0; }); // dismiss the floor hint (game time runs slow under software GL)
  await page.evaluate(() => { const w = window.__w13, P = w.P; P.pitch = 0; const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); for (let d = 6; d > 2; d -= .5) { const x = P.x + fx * d, z = P.z + fz * d; if (!w.isWall(x, z) && !w.blockedAt(x, z, .35)) { const e = w.spawnEnemy('patient', x, z); e.dormant = false; e.stun = 99; break; } } });
  let text = '';
  for (let i = 0; i < 80; i++) { await sleep(250); text = await page.evaluate(() => document.getElementById('msg').style.opacity !== '0' ? document.getElementById('msg').textContent : ''); if (/ultraviolet/.test(text)) break; }
  const seen = await page.evaluate(() => JSON.stringify(window.__w13.save.tips || {}));
  await page.close();
  return { ok: /ultraviolet/.test(text) && /"uv":true/.test(seen) && !errors.length, info: `msg="${text.slice(0, 60)}" tips=${seen}`, errors };
};

S.gamepad = async b => {
  // Simulated standard-mapping gamepad (real devices are UNVERIFIED in this environment).
  const init = `(() => { const btns = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })); window.__pad = { id: 'sim', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: btns, timestamp: 0 };
    navigator.getGamepads = () => [window.__pad]; window.__press = (i, on) => { btns[i].pressed = on; btns[i].value = on ? 1 : 0; }; })();`;
  const { page, errors } = await open(b, { init });
  // hold until the game's poll has seen the press, then until it has seen the release (frames are slow under software GL)
  const seen = (i, v) => page.evaluate(([i, v]) => !!(window.__w13.PAD.prev[i]) === v, [i, v]);
  const tap = async i => { await page.evaluate(i => window.__press(i, true), i); for (let k = 0; k < 40 && !(await seen(i, true)); k++) await sleep(100); await page.evaluate(i => window.__press(i, false), i); for (let k = 0; k < 40 && !(await seen(i, false)); k++) await sleep(100); };
  const out = [];
  await tap(13); await tap(13);
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
  out.push('menu focus ' + focused);
  // focus "Begin a new admission" then press A
  for (let i = 0; i < 6 && (await page.evaluate(() => document.activeElement && document.activeElement.id)) !== 'bNew'; i++) await tap(13);
  await tap(0);
  const afterA = await st(page);
  out.push('A on ' + afterA);
  await waitState(page, s => s === 'intro', 8000).catch(() => {});
  await tap(0);
  out.push('after A ' + await st(page));
  await waitState(page, s => s === 'play', 60000).catch(e => { throw new Error(out.join('; ') + ' ' + e.message); });
  const p0 = await page.evaluate(() => ({ x: window.__w13.P.x, z: window.__w13.P.z, yaw: window.__w13.P.yaw, light: window.__w13.P.light }));
  await page.evaluate(() => { window.__pad.axes[1] = -1; window.__pad.axes[2] = .8; }); for (let k = 0; k < 80 && (await page.evaluate(y => Math.abs(window.__w13.P.yaw - y) < .15, p0.yaw)); k++) await sleep(100); await page.evaluate(() => { window.__pad.axes[1] = 0; window.__pad.axes[2] = 0; });
  const p1 = await page.evaluate(() => ({ x: window.__w13.P.x, z: window.__w13.P.z, yaw: window.__w13.P.yaw }));
  out.push(`moved ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2)}m turned ${(p0.yaw - p1.yaw).toFixed(2)}rad`);
  await tap(3); const light = await page.evaluate(() => window.__w13.P.light); out.push('Y light ' + p0.light + '->' + light);
  await tap(3);
  await page.evaluate(() => window.__press(7, true)); for (let k = 0; k < 40 && !(await seen(7, true)); k++) await sleep(100); await sleep(300); const uv = await page.evaluate(() => window.__w13.P.uv); await page.evaluate(() => window.__press(7, false));
  out.push('RT uv ' + uv);
  await tap(9); const paused = await st(page); await tap(9); const resumed = await st(page);
  out.push(`menu ${paused}->${resumed}`);
  await page.close();
  const ok = /^b/.test(focused || '') && p1.yaw !== p0.yaw && Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.05 && light !== p0.light && uv === true && paused === 'paused' && resumed === 'play' && !errors.length;
  return { ok, info: out.join('; '), errors };
};

S.edges = async b => {
  // Interrupted actions and simultaneous state changes.
  const init = `(() => { const btns = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })); window.__pad = { id: 'sim', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: btns, timestamp: 0 };
    navigator.getGamepads = () => window.__padOn ? [window.__pad] : [null]; window.__press = (i, on) => { btns[i].pressed = on; btns[i].value = on ? 1 : 0; }; })();`;
  const { page, errors } = await open(b, { init });
  await newGame(page);
  const out = [];
  // 1. die while the stalker scare is active: stalker removed, no errors
  await page.evaluate(() => { const w = window.__w13; w.sigStalker(); });
  await sleep(600);
  await page.evaluate(() => { const w = window.__w13; w.save.inv.lazarus = 0; w.P.inv = 0; w.hurt(9999, null); });
  await waitState(page, s => s === 'dead', 60000);
  out.push('die mid-scare: dir=' + (await page.evaluate(() => String(window.__w13.DIR.st))));
  await page.click('#bRetry'); await waitState(page, s => s === 'play', 60000);
  // 2. complete the floor while the light cascade runs, then the floor card -> shop
  await page.evaluate(() => window.__w13.sigCascade()); await sleep(400);
  await page.evaluate(() => window.__w13.completeFloor()); await waitState(page, s => s === 'done', 5000);
  out.push('clear mid-cascade: dir=' + (await page.evaluate(() => String(window.__w13.DIR.st))));
  await page.click('#bToShop'); await page.click('#bDescend'); await waitState(page, s => s === 'play', 60000);
  // 3. hurt and completeFloor at the same moment (win and die together)
  const r3 = await page.evaluate(() => { const w = window.__w13; w.save.inv.lazarus = 0; w.P.inv = 0; w.completeFloor(); w.hurt(9999, null); return w.state; });
  out.push('win+die same tick: ' + r3);
  await page.click('#bToShop'); await page.click('#bDescend'); await waitState(page, s => s === 'play', 60000);
  // 4. controller held sprint then disconnected: virtual key must be released
  await page.evaluate(() => { window.__padOn = true; window.__press(10, true); });
  for (let k = 0; k < 40 && !(await page.evaluate(() => !!window.__w13.keys.ShiftLeft)); k++) await sleep(100);
  const held = await page.evaluate(() => !!window.__w13.keys.ShiftLeft);
  await page.evaluate(() => { window.__padOn = false; });
  for (let k = 0; k < 40 && (await page.evaluate(() => !!window.__w13.keys.ShiftLeft)); k++) await sleep(100);
  const released = await page.evaluate(() => !window.__w13.keys.ShiftLeft && !window.__w13.PAD.on);
  out.push(`pad disconnect: held=${held} released=${released}`);
  // 5. open a note and pause from it (Esc closes the note first), state stays coherent
  await page.evaluate(() => { const w = window.__w13; w.state = 'play'; });
  await page.keyboard.press('Escape'); await sleep(300); const p1 = await st(page); await page.keyboard.press('Escape'); await sleep(300); const p2 = await st(page);
  out.push(`esc,esc: ${p1}->${p2}`);
  await page.close();
  const ok = /die mid-scare: dir=null/.test(out[0]) && /dir=null/.test(out[1]) && /done/.test(out[2]) && held && released && p1 === 'paused' && p2 === 'play' && !errors.length;
  return { ok, info: out.join('; '), errors };
};

S.dynres = async b => {
  // Drives the dynamic-quality controller with synthetic frame times through the test hook.
  const { page, errors } = await open(b);
  await newGame(page);
  const r = await page.evaluate(() => {
    const w = window.__w13, P = w.PERF, feed = (dt, secs) => { for (let t = 0; t < secs; t += dt) w.perf(dt); }, snap = () => `${P.dyn.toFixed(2)}${P.noBloom ? '/nobloom' : ''}${P.cap ? '/cap' : ''}`;
    const out = []; P.cool = 0;
    feed(.045, 20); out.push('slow20s=' + snap());
    feed(.012, 60); out.push('fast60s=' + snap());
    const recovered = P.dyn === 1 && !P.noBloom;
    // oscillation guard: slow again right after a step up makes that level the ceiling
    P.cool = 0; feed(.045, 9); feed(.012, 7); const up = P.dyn; feed(.045, 3); feed(.012, 30); out.push('afterBounce=' + snap());
    return { out: out.join(' '), recovered, capped: P.cap };
  });
  await page.close();
  return { ok: r.recovered && r.capped && !errors.length, info: r.out, errors };
};

S.simSoak = async b => {
  // Long-session soak via the real update loop without rendering: SIM_MIN game-minutes on a busy floor.
  const { page, errors } = await open(b, { width: 480, height: 270 });
  await newGame(page);
  const floor = Number(process.env.SOAK_FLOOR || 24), mins = Number(process.env.SIM_MIN || 20);
  await gotoFloor(page, floor);
  const samples = [];
  for (let m = 0; m < mins; m++) {
    const r = await page.evaluate(() => { const w = window.__w13; const P = w.P; P.yaw += 2.1; const st = w.simulate(60, true);
      let objs = 0; w.scene.traverse(() => objs++); const L = w.L;
      return { st, heap: performance.memory ? performance.memory.usedJSHeapSize : 0, objs, en: L.enemies.length, proj: L.proj.length, haz: L.haz.length, flares: L.flares.length, ri: w.renderInfo() }; });
    samples.push(r);
    if (r.st !== 'play') break;
  }
  await page.close();
  const f = samples[1] || samples[0], l = samples[samples.length - 1];
  const grow = l.objs - f.objs;
  return { ok: !errors.length && l.st === 'play' && grow < 400 && l.heap < f.heap * 1.5 + 5e6, info: `floor ${floor}, ${samples.length} game-min; heap ${(f.heap / 1e6).toFixed(1)}->${(l.heap / 1e6).toFixed(1)} MB; scene objs ${f.objs}->${l.objs}; enemies ${samples.map(s => s.en).join(',')}; geos ${samples.map(s => s.ri.geos).join(",")}; tex ${samples.map(s => s.ri.tex).join(",")}`, errors };
};

S.perf = async b => {
  const { page, errors } = await open(b, { width: 640, height: 360 });
  await newGame(page);
  await sleep(2000);
  const res = await page.evaluate(() => new Promise(r => { const ts = []; let last = performance.now(); const f = now => { ts.push(now - last); last = now; if (ts.length < 60) requestAnimationFrame(f); else { ts.sort((a, b) => a - b); r({ avg: ts.reduce((a, b) => a + b, 0) / ts.length, p99: ts[Math.floor(ts.length * .99)], info: window.__w13.renderInfo && window.__w13.renderInfo() }); } }; requestAnimationFrame(f); }));
  await page.close();
  return { ok: !errors.length, info: `frame avg ${res.avg.toFixed(1)} ms, worst ${res.p99.toFixed(1)} ms (SwiftShader software GL)${res.info ? ' ' + JSON.stringify(res.info) : ''}`, errors };
};

const order = ['buildFresh', 'boot', 'newgame', 'controls', 'deathRetry', 'shopLoop', 'spam', 'resize', 'corruptSave', 'scares', 'fatalRecovery', 'captions', 'settingsUI', 'tips', 'gamepad', 'edges', 'dynres', 'perf', 'floors', 'soak', 'simSoak'];
const run = wanted.length ? wanted : order.filter(n => n !== 'soak' && n !== 'simSoak');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-accelerated-2d-canvas', '--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info'] });
let fails = 0;
for (const name of run) {
  const t0 = Date.now();
  let r;
  try { r = await S[name](browser); } catch (e) { r = { ok: false, info: 'threw: ' + e.message.split('\n')[0], errors: [] }; }
  while (openPages.length) await openPages.pop().close().catch(() => {});
  if (!r.ok) fails++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${name.padEnd(12)} ${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s  ${r.info}`);
  for (const e of (r.errors || []).slice(0, 5)) console.log('        ' + e.slice(0, 300));
}
await browser.close();
process.exit(fails ? 1 : 0);
