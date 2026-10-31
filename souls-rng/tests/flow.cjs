// Flow test: old-save migration, boss kill -> portal -> next realm, death -> respawn, pause/resume, trade codes.
// Usage: node souls-rng/tests/flow.cjs
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ok = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ path: path.join(ROOT, 'vendor', 'three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  // seed an old-format save (from the original game) before load
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('souls_c', '4321'); localStorage.setItem('souls_ll', '2'); localStorage.setItem('souls_dl', '3');
    localStorage.setItem('souls_inv', JSON.stringify([{ id: 'a', odds: 2, name: 'old' }, { id: 'b', odds: 5000, name: 'old rare' }]));
  });
  await page.goto('file://' + path.join(ROOT, 'SoulsRNG.html'));
  await page.waitForFunction(() => window.__SOULS && document.getElementById('boot').style.display === 'none');
  const mig = await page.evaluate(() => { const S = window.__SOULS.S; return { coins: S.coins, luck: S.luck, dmg: S.dmg, inv: Object.keys(S.inv), eq: S.eq }; });
  ok(mig.coins === 4321 && mig.luck === 2 && mig.dmg === 3, 'old save coins/upgrades migrated ' + JSON.stringify(mig));
  ok(mig.inv.length === 2 && mig.eq !== 'warrior|', 'old characters mapped to new roster and rarest equipped');
  // trade code round trip
  const trade = await page.evaluate(() => { const S = window.__SOULS.S; S.inv['slime_pal|'] = 2; openModal('mFriends'); showFTab('fTrade'); document.getElementById('tradeSel').value = 'slime_pal|'; window.confirm = () => true; makeTrade(); const code = document.getElementById('tradeOut').textContent; const before = S.inv['slime_pal|'] || 0; S.fcode = 'someone-else'; document.getElementById('tradeIn').value = code; redeemTrade(); const after = S.inv['slime_pal|'] || 0; document.getElementById('tradeIn').value = code; redeemTrade(); closeModals(); return { code: code.slice(0, 10), before, after, again: S.inv['slime_pal|'] }; });
  ok(trade.code.startsWith('TRADE-') && trade.after === trade.before + 1 && trade.again === trade.after, 'trade code makes, redeems once, rejects reuse ' + JSON.stringify(trade));

  // ---- realm flow ----
  await page.evaluate(() => { const S = window.__SOULS.S; S.set.autoQ = false; S.set.quality = 'low'; applyQuality(); });
  await page.click('#btnPlay'); await sleep(1200);
  ok(await page.evaluate(() => window.__SOULS.G.playing && document.getElementById('hud').classList.contains('on')), 'entered realm, HUD visible');
  ok(await page.evaluate(() => document.pointerLockElement !== null || window.__SOULS.G.lockFail), 'mouse locked to the game (or graceful fallback)');
  await page.evaluate(() => { const s = window.__SOULS; s.PL.hp = s.PL.maxHp = 1e9; for (let i = 0; i < s.G.killsNeed; i++) { const e = s.spawnEnemy('walker', null, { noRise: true }); s.killEnemy(e); } });
  await page.waitForFunction(() => !!window.__SOULS.G.boss, null, { timeout: 120000 });
  ok(true, 'killing the quota summons the boss: ' + await page.evaluate(() => window.__SOULS.G.boss.boss.def.n));
  await page.evaluate(() => { const s = window.__SOULS, b = s.G.boss; b.boss.intro = 0; s.damageEnemy(b, b.maxHp * 0.6); });
  ok(await page.evaluate(() => window.__SOULS.G.boss.boss.phase === 2), 'boss enters phase 2 below half HP');
  await page.evaluate(() => { const s = window.__SOULS, b = s.G.boss; s.damageEnemy(b, b.hp + 1); });
  ok(await page.evaluate(() => window.__SOULS.G.bossDone && window.__SOULS.S.stats.bosses >= 1), 'boss defeated and recorded');
  await page.waitForFunction(() => !!window.__SOULS.G.portal, null, { timeout: 120000 });
  ok(true, 'portal opened');
  await page.evaluate(() => { const s = window.__SOULS; s.PL.pos.copy(s.G.portal.position); });
  await page.waitForFunction(() => window.__SOULS.G.realm === 2 && !window.__SOULS.G.transitioning, null, { timeout: 90000 });
  ok(await page.evaluate(() => window.__SOULS.BIOMES[window.__SOULS.G.biome].id === 'rainforest'), 'walking into the portal loads realm 2 (rainforest)');

  // ---- pause / resume ----
  await page.evaluate(() => pauseGame());
  ok(await page.evaluate(() => window.__SOULS.G.paused && document.getElementById('pause').classList.contains('on')), 'pause screen shows');
  await page.click('#btnResume'); await sleep(1800);
  ok(await page.evaluate(() => !window.__SOULS.G.paused), 'resume works');

  // ---- death / respawn ----
  await page.evaluate(() => { const s = window.__SOULS; s.PL.maxHp = 100; s.PL.hp = 1; s.PL.pw = {}; s.PL.iT = 0; hurtPlayer(50); });
  await page.waitForFunction(() => document.getElementById('gameover').classList.contains('on'), null, { timeout: 90000 });
  ok(true, 'death shows game over');
  await page.click('#btnRetry'); await sleep(1500);
  ok(await page.evaluate(() => window.__SOULS.G.playing && !window.__SOULS.G.dead && window.__SOULS.G.realm === 1 && window.__SOULS.PL.hp > 0), 'respawn restarts at realm 1 with full health');
  await page.evaluate(() => window.__SOULS.goLobby()); await sleep(600);
  ok(await page.evaluate(() => !window.__SOULS.G.playing && document.getElementById('lobby').classList.contains('on')), 'back to lobby');
  const loopErr = await page.evaluate(() => window.__loopErr || null);
  ok(!loopErr && !errors.length, 'no runtime errors ' + (loopErr || errors.join(' | ')));
  await browser.close();
  console.log(process.exitCode ? '\nFLOW TEST FAILED' : '\nFLOW TEST PASSED');
})().catch(e => { console.error(e); process.exit(1); });
