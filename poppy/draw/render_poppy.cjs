#!/usr/bin/env node
/* render_poppy.cjs - renders every "poppy_art" entry of poppy/assets.json with
 * the canvas library (poppy.js + scenes.js) in headless Chromium.
 *
 *   NODE_PATH=$(npm root -g) node poppy/draw/render_poppy.cjs [name ...] [--out DIR]
 *
 * Each file is drawn at the manifest size; "transparent": true entries keep
 * their alpha (cutouts), opaque ones are flattened onto their own background.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..');
const args = process.argv.slice(2);
let outDir = null;
const names = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') outDir = args[++i];
  else names.push(args[i].replace(/\.png$/, ''));
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets.json'), 'utf8'));
  let items = manifest.poppy_art;
  if (names.length) items = items.filter(it => names.includes(path.basename(it.file, '.png')));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.error('[page error]', e.message));
  await page.setContent('<!doctype html><html><body style="margin:0;background:transparent"><canvas id="c"></canvas></body></html>');
  await page.addScriptTag({ content: fs.readFileSync(path.join(HERE, 'poppy.js'), 'utf8') });
  await page.addScriptTag({ content: fs.readFileSync(path.join(HERE, 'scenes.js'), 'utf8') });
  const missing = [];
  for (const it of items) {
    const name = path.basename(it.file, '.png');
    const [w, h] = it.size || [640, 480];
    const t0 = Date.now();
    const res = await page.evaluate(({ name, w, h, transparent }) => {
      const fn = window.Poppy.ASSETS[name];
      if (!fn) return { error: 'no preset' };
      const c = document.getElementById('c');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
      try { fn(c); } catch (e) { return { error: e.stack || String(e) }; }
      if (!transparent) {
        const o = document.createElement('canvas'); o.width = w; o.height = h;
        const og = o.getContext('2d'); og.fillStyle = '#000'; og.fillRect(0, 0, w, h); og.drawImage(c, 0, 0);
        return { url: o.toDataURL('image/png') };
      }
      return { url: c.toDataURL('image/png') };
    }, { name, w, h, transparent: !!it.transparent });
    if (res.error) { console.error(`${name}: ${res.error}`); missing.push(name); continue; }
    const out = outDir ? path.join(outDir, name + '.png') : path.join(ROOT, it.file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(res.url.split(',')[1], 'base64'));
    console.log(`${name} ${w}x${h} -> ${path.relative(process.cwd(), out)} (${Date.now() - t0} ms)`);
  }
  await browser.close();
  if (missing.length) { console.error('MISSING:', missing.join(', ')); process.exitCode = 1; }
})();
