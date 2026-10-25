// Renders one view of the game and saves the raw 480x270 buffer scaled 3x (no CRT), for art iteration.
// Usage: node benthos/tools/shot.mjs out.png "<js run in the page before the shot>" [ticks]
//   e.g. node benthos/tools/shot.mjs /tmp/a.png "B.debug.start('act3', 3436)" 120
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter(a => !a.startsWith('--')), crt = process.argv.includes('--crt');
const [out, setup = "B.debug.start('act1', 30)", ticks = '90'] = args;
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.error('pageerror:', e.message));
await page.goto('file://' + path.join(root, 'index.html'));
await page.waitForTimeout(300);
const data = await page.evaluate(([setup, ticks, crt]) => {
  B.noAutoPause = true;
  (0, eval)(setup);
  for (let k = 0; k < ticks; k++) { B.debug.tick(1); if (k % 10 === 0) B.debug.draw(); }
  B.debug.draw();
  if (crt) return null;
  const c = document.createElement('canvas'); c.width = B.W * 3; c.height = B.H * 3;
  const g = c.getContext('2d'), t = document.createElement('canvas'); t.width = B.W; t.height = B.H;
  t.getContext('2d').putImageData(B.R.img, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(t, 0, 0, c.width, c.height);
  return c.toDataURL('image/png').split(',')[1];
}, [setup, +ticks, crt]);
if (crt) await page.screenshot({ path: out }); else fs.writeFileSync(out, Buffer.from(data, 'base64'));
console.log('wrote', out);
await browser.close();
