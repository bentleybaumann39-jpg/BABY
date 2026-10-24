// Multi-view look-dev capture in one page load.
// node kaiju/tests/views.mjs "<page?query>" outdir "x,y,z>x,y,z;..." [w] [h] [time]
import { createRequire } from 'module';
import fs from 'fs';
import { startServer } from '../../tools/serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [, , page, outdir, viewsArg, w = '1280', h = '720', times = ''] = process.argv;
fs.mkdirSync(outdir, { recursive: true });
const port = 8100 + Math.floor(Math.random() * 800);
const server = await startServer(port, true);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + e.stack));
await p.goto(`http://localhost:${port}/${page}`);
await p.waitForFunction(() => window.__kj && window.__kj.ready, null, { timeout: 300000, polling: 500 }).catch(() => logs.push('timeout'));
const views = viewsArg.split(';').filter(Boolean);
const tlist = times ? times.split(',') : [''];
let n = 0;
for (const t of tlist) {
  if (t) await p.evaluate((t) => window.__kj.world.setTime(t), t);
  for (const v of views) {
    const [a, b] = v.split('>');
    await p.evaluate(([a, b]) => {
      const k = window.__kj; const P = a.split(',').map(Number), L = b.split(',').map(Number);
      k.cam.position.set(...P); k.cam.lookAt(...L); k.cam.updateMatrixWorld();
    }, [a, b]);
    await p.evaluate(() => new Promise((r) => { let i = 0; const f = () => (++i > 2 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
    const file = `${outdir}/v${n++}${t ? '_' + t : ''}.png`;
    await p.screenshot({ path: file, timeout: 180000 });
    console.log('wrote', file);
  }
}
for (const l of logs.slice(0, 10)) { const m = l.match(/ERROR:[^\n]*/g); console.log(m ? m.slice(0, 6).join('\n') : l.slice(0, 400)); }
await browser.close();
server.close();
