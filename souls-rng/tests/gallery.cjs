// Renders contact sheets of every boss (in its own biome) and a sample of characters / zombies.
// Usage: node souls-rng/tests/gallery.cjs   -> souls-rng/shots/gallery-*.png
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function sheet(browser, files, out, cols) {
  const p = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const imgs = files.map(f => `<div><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><span>${path.basename(f, '.png').replace(/^[a-z]+-\d+-/, '')}</span></div>`).join('');
  await p.setContent(`<style>body{margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},1fr);gap:2px}div{position:relative}img{width:100%;display:block}span{position:absolute;left:4px;top:2px;color:#fff;font:bold 13px sans-serif;text-shadow:0 0 3px #000}</style>${imgs}`);
  await sleep(500); await p.screenshot({ path: out, fullPage: true }); await p.close();
}
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ path: path.join(ROOT, 'vendor', 'three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  await page.goto('file://' + path.join(ROOT, 'SoulsRNG.html'));
  await page.waitForFunction(() => window.__SOULS && document.getElementById('boot').style.display === 'none');
  await page.click('#btnPlay'); await sleep(1000);
  await page.addStyleTag({ content: '#hud,#banner,#crosshair,#ov,#notif{display:none!important}' });
  const bossFiles = [];
  for (let i = 0; i < 25; i++) {
    await page.evaluate(i => {
      const s = window.__SOULS; s.G.realm = i + 1; s.setupRealm(); s.PL.hp = s.PL.maxHp = 1e9;
      s.PL.yaw = 0; s.PL.pitch = 0.18; s.spawnBoss(); const b = s.G.boss; b.boss.intro = 0; b.boss.B.group.position.y = 0;
      if (b.boss.B.serpent) b.pos.set(0, 3, -13); else b.pos.set(0, b.boss.def.move[0] === 'fly' ? 5 : 0, -12);
      s.PL.model.group.visible = false;
      for (let k = 0; k < 4; k++) s.spawnEnemy(s.BIOMES[s.G.biome].pool[k % s.BIOMES[s.G.biome].pool.length][0], new THREE.Vector3(-8 + k * 5.3, 0, -5), { noRise: true });
    }, i);
    await sleep(1200); await page.evaluate(() => { window.__SOULS.G.paused = true; }); await sleep(300);
    const f = path.join(SHOTS, `boss-${String(i + 1).padStart(2, '0')}-${await page.evaluate(() => window.__SOULS.BOSSES[window.__SOULS.G.biome].n.replace(/[^A-Z]+/g, '_'))}.png`);
    await page.screenshot({ path: f }); bossFiles.push(f); await page.evaluate(() => { window.__SOULS.G.paused = false; });
  }
  await sheet(browser, bossFiles, path.join(SHOTS, 'gallery-bosses.png'), 5);
  // characters: render in the lobby showcase
  await page.evaluate(() => { window.__SOULS.goLobby(); });
  await page.addStyleTag({ content: '#lobby,#notif{display:none!important}' });
  const charFiles = [];
  const ids = await page.evaluate(() => window.__SOULS.ROSTER.filter((c, i) => i % 4 === 0 || i > 108).map(c => c.id));
  for (const id of ids) {
    await page.evaluate(id => { Showcase.set(id, ''); Showcase.model.group.rotation.y = 0.4; }, id);
    await sleep(350);
    const f = path.join(SHOTS, `char-${String(charFiles.length).padStart(3, '0')}-${id}.png`); await page.screenshot({ path: f, clip: { x: 140, y: 20, width: 360, height: 380 } }); charFiles.push(f);
  }
  await sheet(browser, charFiles, path.join(SHOTS, 'gallery-chars.png'), 8);
  await browser.close();
  console.log('gallery done:', bossFiles.length, 'bosses,', charFiles.length, 'characters');
})().catch(e => { console.error(e); process.exit(1); });
