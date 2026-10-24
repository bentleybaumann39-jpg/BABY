// Headless walk through the menus: title → lab → awaken and evolve kaiju → deploy → results → lab.
// node kaiju/tests/ui.mjs outdir [page]   (page defaults to index.html; pass Landfall.html to test the build)
import { createRequire } from 'module';
import fs from 'fs';
import { startServer } from '../../tools/serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , outdir = '/tmp/kjui', pageName = 'index.html'] = process.argv;
fs.mkdirSync(outdir, { recursive: true });
const port = 8100 + Math.floor(Math.random() * 800);
const server = await startServer(port, true);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 400)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const t0 = Date.now();
const shot = async (name) => { await page.screenshot({ path: `${outdir}/${name}.png`, timeout: 600000 }); console.log('shot', name, ((Date.now() - t0) / 1000).toFixed(0) + 's'); };
const screen = () => page.evaluate(() => document.querySelector('.screen.show')?.id);
const wait = (ms) => page.waitForTimeout(ms);
// the menu stage loads each kaiju asynchronously; wait until the shown one is in the scene
const stageReady = (id) => page.waitForFunction((id) => { const m = window.__kj.app.menu; return m && m.currentId === id; }, id, { timeout: 300000, polling: 500 }).catch(() => console.log('stage wait timed out for', id));

await page.goto(`http://localhost:${port}/kaiju/${pageName}?q=low`);
await page.waitForFunction(() => window.__kj && window.__kj.ready, null, { timeout: 300000, polling: 500 });
await page.evaluate(() => localStorage.clear());
console.log('screen', await screen());
await wait(1500);
await shot('ui_00_title');
await page.click('[data-act="lab"]');
await stageReady('razormaw');
await wait(1500);
console.log('screen', await screen());
await shot('ui_01_lab_razormaw');
// grant biomass so the rest of the roster can be awakened and evolved
await page.evaluate(() => { const a = window.__kj.app; a.profile.biomass = 40000; a.save(); a.ui.renderLab(); });
for (const id of ['harrowblade', 'hollowstrider', 'nyxwing', 'gravemaw', 'carapex']) {
  await page.click(`.kcard:has-text("${id.toUpperCase()}")`);
  await page.click('#unlock');
  await stageReady(id);
  await wait(1500);
  await shot(`ui_02_${id}`);
}
const ups = await page.$$eval('[data-up]:not([disabled])', (b) => b.map((x) => x.dataset.up));
console.log('upgrades available', ups.join(','));
await page.click('[data-up="growth"]');
await page.click('[data-up="growth"]');
await stageReady('carapex');
await wait(1500);
await shot('ui_03_carapex_grown');
const prof = await page.evaluate(() => { const p = window.__kj.app.profile; return { biomass: p.biomass, unlocked: p.unlocked, levels: p.levels, selected: p.selected }; });
console.log(JSON.stringify(prof));
await page.click('#lab [data-act="settings"]');
await wait(500);
await shot('ui_04_settings');
await page.click('#settings [data-act="back"]');
await page.click('#deploy');
await page.waitForFunction(() => window.__kj.play && window.__kj.play.state !== 'loading', null, { timeout: 400000, polling: 1000 });
console.log('screen', await screen(), 'kaiju', await page.evaluate(() => window.__kj.play.kaiju.id));
await wait(3000);
await shot('ui_05_mission');
await page.evaluate(() => { const p = window.__kj.play; p.score.extraValue = 12e9; p.update(1 / 30); p.finish(true); });
await wait(1500);
console.log('screen', await screen());
await shot('ui_06_results');
await page.click('#results [data-act="lab"]');
await stageReady('carapex');
await wait(1000);
console.log('screen', await screen(), 'biomass', await page.evaluate(() => window.__kj.app.profile.biomass));
await shot('ui_07_back_to_lab');
console.log('errors:', errors.length);
for (const e of errors.slice(0, 12)) console.log(e);
await browser.close();
server.close();
