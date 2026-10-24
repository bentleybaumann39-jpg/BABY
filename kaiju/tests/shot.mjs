// Screenshot helper for look-dev: node kaiju/tests/shot.mjs "<page?query>" out.png [w] [h] [waitFrames]
// Serves the repository root and renders with headless Chromium (SwiftShader WebGL2).
import { createRequire } from 'module';
import { startServer } from '../../tools/serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [, , page = 'kaiju/sandbox.html', out = 'shot.png', w = '1280', h = '720', wait = '0'] = process.argv;
const port = 8100 + Math.floor(Math.random() * 800);
const server = await startServer(port, true);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
const t0 = Date.now();
await p.goto(`http://localhost:${port}/${page}`);
try {
  await p.waitForFunction(() => window.__kj && window.__kj.ready, null, { timeout: 240000, polling: 500 });
} catch (e) { logs.push('timeout waiting for ready'); }
if (+wait > 0) await p.waitForTimeout(+wait);
const info = await p.evaluate(() => document.getElementById('i') ? document.getElementById('i').textContent : '');
await p.screenshot({ path: out });
console.log(`shot ${out} in ${((Date.now() - t0) / 1000).toFixed(1)}s  ${info}`);
for (const l of logs.slice(0, 30)) { const m = l.match(/ERROR:[^\n]*/g); console.log(m ? m.slice(0, 6).join("\n") : l.slice(0, 300)); }
await browser.close();
server.close();
