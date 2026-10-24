// Look-dev for mutation strains on the lab stage: one frame per strain, UI hidden.
// node kaiju/tests/forms.mjs outdir kaijuId [forms] [w] [h]
import { createRequire } from 'module';
import fs from 'fs';
import { startServer } from '../../tools/serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , outdir = '/tmp/kjforms', id = 'razormaw', list = 'prime,infernal,glacial,venom,titan,void', w = '900', h = '700'] = process.argv;
fs.mkdirSync(outdir, { recursive: true });
const port = 8100 + Math.floor(Math.random() * 800);
const server = await startServer(port, true);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 400)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(`http://localhost:${port}/kaiju/index.html?q=low`);
await page.waitForFunction(() => window.__kj && window.__kj.ready, null, { timeout: 300000, polling: 500 });
await page.evaluate((id) => {
  const app = window.__kj.app;
  app.profile.unlocked[id] = true;
  for (const s of document.querySelectorAll('.screen')) s.classList.remove('show');
}, id);
for (const f of list.split(',')) {
  await page.evaluate(async ([id, f]) => { await window.__kj.app.menu.showKaiju(id, false, f); }, [id, f]);
  // let the aura build up and the roar settle, then hold a fixed three-quarter view
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const m = window.__kj.app.menu, cam = window.__kj.app.camera, T = window.__kj.THREE;
    // hold the camera after the stage's own orbit update
    if (!m._orig) { m._orig = m.update.bind(m); m.update = (dt) => { m._orig(dt); const H = m.height, V = m._view || [0.8, 1.3]; cam.position.set(H * V[0], H * 0.55, H * V[1]); cam.lookAt(0, H * 0.4, 0); }; }
  });
  for (const [v, x, z] of [['a', 0.8, 1.3], ['b', -1.1, -1.05]]) {
    await page.evaluate(([x, z]) => { window.__kj.app.menu._view = [x, z]; }, [x, z]);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${outdir}/${id}_${f}_${v}.png`, timeout: 300000 });
  }
  console.log('wrote', f);
}
console.log('errors:', errors.length);
for (const e of errors.slice(0, 8)) console.log(e);
await browser.close();
server.close();
