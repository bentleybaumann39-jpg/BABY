// Screenshot helper: node tests/shot.mjs "<query>" out.png [more "<query>" out.png ...]
import { chromium } from 'playwright';
import { startServer } from '../tools/serve.mjs';

const args = process.argv.slice(2);
const port = 8000 + Math.floor(Math.random() * 900);
const server = await startServer(port, true);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
for (let i = 0; i < args.length; i += 2) {
  const q = args[i], out = args[i + 1];
  await page.goto(`http://localhost:${port}/index.html?${q}`);
  try {
    await page.waitForFunction(() => window.__ready === true || window.__fatal, null, { timeout: 180000 });
  } catch (e) { logs.push('TIMEOUT waiting for ready'); }
  await page.waitForTimeout(Number(process.env.WAIT || 600));
  await page.screenshot({ path: out });
  const stats = await page.evaluate(() => window.__stats || null);
  console.log(out, JSON.stringify(stats));
}
console.log(logs.filter((l) => !l.includes('GPU stall')).slice(0, 60).join('\n'));
await browser.close();
server.close();
