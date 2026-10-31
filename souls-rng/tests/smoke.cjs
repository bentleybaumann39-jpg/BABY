// Headless smoke test for SoulsRNG.html
// Usage: node souls-rng/tests/smoke.cjs [--quick] [--shots]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const FILE = 'file://' + path.join(ROOT, 'SoulsRNG.html');
const SHOTS = path.join(ROOT, 'shots');
const quick = process.argv.includes('--quick');
const shots = process.argv.includes('--shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  if (shots) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error' && !/cdnjs|fonts\.g|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ path: path.join(ROOT, 'vendor', 'three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.route('**/fonts.gstatic.com/**', r => r.abort());
  await page.goto(FILE);
  await page.waitForFunction(() => window.__SOULS && document.getElementById('boot').style.display === 'none', null, { timeout: 30000 });
  console.log('booted');
  await sleep(1500);
  if (shots) await page.screenshot({ path: path.join(SHOTS, '01-lobby.png') });

  // ---- rolling ----
  await page.evaluate(() => { const S = window.__SOULS.S; S.coins = 1e7; S.quick = true; S.set.autoQ = false; });
  for (let i = 0; i < 25; i++) { await page.click('#btnRoll'); await sleep(40); }
  await page.evaluate(() => { const S = window.__SOULS.S; S.quick = false; });
  await page.click('#btnRoll'); await sleep(900);
  if (shots) await page.screenshot({ path: path.join(SHOTS, '02-roll.png') });
  await sleep(3500);
  const inv = await page.evaluate(() => Object.keys(window.__SOULS.S.inv).length);
  console.log('inventory entries after rolls:', inv);
  for (const id of ['mBag', 'mIndex', 'mUpg', 'mPass', 'mStats', 'mSettings', 'mFriends']) { await page.evaluate(id => openModal(id), id); await sleep(150); if (shots && (id === 'mIndex' || id === 'mBag')) await page.screenshot({ path: path.join(SHOTS, `03-${id}.png`) }); await page.evaluate(() => closeModals()); }

  // ---- every character model builds ----
  const built = await page.evaluate(() => { let n = 0; for (const C of window.__SOULS.ROSTER) for (const m of ['', 'golden', 'rainbow']) { const M = window.__SOULS.buildCharacter(C, m); disposeModel(M.group); n++; } return n; });
  console.log('character models built:', built);

  // ---- game ----
  await page.click('#btnPlay'); await sleep(1500);
  await page.evaluate(() => { const P = window.__SOULS.PL; P.maxHp = P.hp = 1e9; });
  await page.mouse.move(640, 360); await page.mouse.down(); await page.keyboard.down('w'); await sleep(1200); await page.keyboard.up('w'); await page.mouse.up();
  if (shots) await page.screenshot({ path: path.join(SHOTS, '04-realm1.png') });
  const biomes = quick ? 4 : 25;
  for (let i = 0; i < biomes; i++) {
    await page.evaluate(i => { const s = window.__SOULS; s.G.realm = i + 1; s.setupRealm(); s.PL.hp = s.PL.maxHp = 1e9; for (let k = 0; k < 8; k++) s.spawnEnemy(['walker', 'runner', 'brute', 'spitter', 'exploder', 'crawler', 'leaper', 'phantom', 'shaman', 'armored', 'splitter', 'bat'][(i + k) % 12]); }, i);
    await sleep(700);
    await page.evaluate(() => window.__SOULS.spawnBoss());
    await page.mouse.down();
    await sleep(quick ? 2500 : 3600);
    await page.mouse.up();
    if (shots && (i < 6 || i % 5 === 0)) await page.screenshot({ path: path.join(SHOTS, `05-biome${String(i + 1).padStart(2, '0')}.png`) });
    const st = await page.evaluate(() => { const s = window.__SOULS; return { b: s.BIOMES[s.G.biome].id, boss: s.G.boss && s.G.boss.boss.def.n, en: s.G.enemies.length, err: window.__loopErr || null, fps: Math.round(1000 / 16) }; });
    console.log('biome', i + 1, st.b, '| boss', st.boss, '| enemies', st.en, st.err ? '| LOOP ERROR ' + st.err : '');
    if (st.err) break;
    // force phase 2 + boss defeat on some
    if (i % 3 === 0) { await page.evaluate(() => { const s = window.__SOULS; const b = s.G.boss; if (b) { s.damageEnemy(b, b.maxHp * 0.55); } }); await sleep(1800); await page.evaluate(() => { const s = window.__SOULS; const b = s.G.boss; if (b) s.damageEnemy(b, b.hp + 10); }); await sleep(7000); const portal = await page.evaluate(() => !!window.__SOULS.G.portal); console.log('   defeated boss, portal:', portal); }
  }
  // ---- every ultimate ----
  await page.evaluate(() => { const s = window.__SOULS; s.G.realm = 3; s.setupRealm(); s.PL.hp = s.PL.maxHp = 1e9; for (let k = 0; k < 20; k++) s.spawnEnemy('walker'); s.spawnBoss(); });
  await sleep(2600);
  const ults = await page.evaluate(() => Object.keys(window.__SOULS.ULT_FN));
  for (const u of ults) {
    await page.evaluate(u => { const s = window.__SOULS; s.PL.C = Object.assign({}, s.PL.C, { u }); s.PL.ult = 100; s.triggerUlt(); if (s.G.enemies.filter(e => !e.dead).length < 8) for (let k = 0; k < 6; k++) s.spawnEnemy('walker'); }, u);
    await sleep(quick ? 400 : 900);
    const err = await page.evaluate(() => window.__loopErr || null); if (err) { console.log('ULT ERROR', u, err); break; }
    if (shots && ['blackhole', 'storm', 'dragon', 'titanblade', 'supernova', 'clones'].includes(u)) await page.screenshot({ path: path.join(SHOTS, `06-ult-${u}.png`) });
  }
  console.log('ultimates fired:', ults.length);
  // ---- pause / lobby ----
  await page.evaluate(() => pauseGame()); await sleep(300);
  if (shots) await page.screenshot({ path: path.join(SHOTS, '07-pause.png') });
  await page.evaluate(() => window.__SOULS.goLobby()); await sleep(800);
  if (shots) await page.screenshot({ path: path.join(SHOTS, '08-lobby-after.png') });
  const loopErr = await page.evaluate(() => window.__loopErr || null);
  await browser.close();
  if (loopErr) errors.push('loop: ' + loopErr);
  if (errors.length) { console.log('\nERRORS (' + errors.length + '):'); [...new Set(errors)].slice(0, 30).forEach(e => console.log(' -', e.slice(0, 600))); process.exit(1); }
  console.log('\nSMOKE TEST PASSED');
})().catch(e => { console.error(e); process.exit(1); });
