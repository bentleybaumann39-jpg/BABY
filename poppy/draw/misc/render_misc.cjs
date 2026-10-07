#!/usr/bin/env node
/* render_misc.cjs - renders the "misc_art" entries of poppy/assets.json with
 * the canvas helpers (helpers.js + pieces_*.js) in headless Chromium.
 *
 *   NODE_PATH=$(npm root -g) node poppy/draw/misc/render_misc.cjs [name ...]
 *        [--force] [--out DIR] [--ss N] [--list]
 *
 * No names:  renders every manifest entry whose output PNG is missing or
 *            invalid (wrong size / truncated); existing valid files are kept.
 * Names:     renders exactly those entries (always re-rendered).
 * --force:   re-render everything selected even if the file exists.
 * --out DIR: write into DIR (for review passes) instead of poppy/build/art/misc.
 * --ss N:    supersampling factor (default 2). Pieces draw in manifest
 *            (logical) pixels; the runner scales the context and downsamples.
 *
 * Each PNG is written as soon as it is drawn, and the browser is restarted
 * every few pieces, so an interrupted run loses at most one piece.
 * "transparent": true entries keep alpha; opaque ones are flattened on black.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..');           // poppy/
const SOURCES = ['helpers.js', 'pieces_brand.js', 'pieces_props.js', 'pieces_wrong.js'];

const args = process.argv.slice(2);
let outDir = null, force = false, ss = 2, list = false;
const names = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out') outDir = path.resolve(args[++i]);
  else if (a === '--force') force = true;
  else if (a === '--ss') ss = Math.max(1, parseInt(args[++i], 10) || 2);
  else if (a === '--list') list = true;
  else names.push(path.basename(a).replace(/\.png$/, ''));
}

function pngSize(file) {
  try {
    const fd = fs.openSync(file, 'r'), b = Buffer.alloc(33);
    fs.readSync(fd, b, 0, 33, 0); fs.closeSync(fd);
    if (b.readUInt32BE(0) !== 0x89504e47) return null;
    const st = fs.statSync(file);
    if (st.size < 1000) return null;
    // also require the IEND chunk at the end (catches truncated writes)
    const fd2 = fs.openSync(file, 'r'), e = Buffer.alloc(12);
    fs.readSync(fd2, e, 0, 12, st.size - 12); fs.closeSync(fd2);
    if (e.toString('latin1', 4, 8) !== 'IEND') return null;
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  } catch (e) { return null; }
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets.json'), 'utf8'));
  const all = manifest.misc_art;
  const byName = new Map(all.map(it => [path.basename(it.file, '.png'), it]));
  if (list) { for (const [n, it] of byName) console.log(n, it.size.join('x'), it.transparent ? 'alpha' : 'opaque'); return; }
  for (const n of names) if (!byName.has(n)) { console.error('unknown piece:', n); process.exit(2); }
  const outOf = (it) => outDir ? path.join(outDir, path.basename(it.file)) : path.join(ROOT, it.file);
  let items = names.length ? names.map(n => byName.get(n)) : all;
  if (!names.length && !force) {
    items = items.filter(it => {
      const s = pngSize(outOf(it));
      const ok = s && s[0] === it.size[0] && s[1] === it.size[1];
      if (ok) console.log(`skip ${path.basename(it.file)} (exists)`);
      return !ok;
    });
  }
  if (!items.length) { console.log('nothing to do'); return; }

  const fonts = fs.readFileSync(path.join(HERE, 'strokefonts.json'), 'utf8');
  const code = SOURCES.filter(f => fs.existsSync(path.join(HERE, f))).map(f => fs.readFileSync(path.join(HERE, f), 'utf8'));
  const missing = [];
  let browser = null, page = null, sinceRestart = 0;
  async function openPage() {
    if (browser) await browser.close().catch(() => {});
    browser = await chromium.launch({ args: ['--disable-gpu'] });
    page = await browser.newPage();
    page.on('console', m => console.log('[page]', m.text()));
    page.on('pageerror', e => console.error('[page error]', e.message));
    await page.setContent('<!doctype html><html><body style="margin:0;background:transparent"></body></html>');
    await page.addScriptTag({ content: 'window.STROKEFONTS = ' + fonts + ';' });
    for (const c of code) await page.addScriptTag({ content: c });
    await page.evaluate(() => document.fonts.ready.then(() => true));
    // warm the fonts used by the pieces so measureText is right on first use
    await page.evaluate(() => {
      const c = document.createElement('canvas'), g = c.getContext('2d');
      for (const f of ['900 40px Inter', '700 40px Inter', '400 40px "Courier 10 Pitch"', '700 40px "DejaVu Sans"', '900 40px "Inter Display"']) { g.font = f; g.fillText('Aa', 0, 20); }
      return document.fonts.ready;
    });
    const ok = await page.evaluate(() => !!(window.MH && window.MISC));
    if (!ok) throw new Error('helpers / pieces failed to load (see [page error] above)');
    sinceRestart = 0;
  }
  try {
    await openPage();
    for (const it of items) {
      if (sinceRestart >= 4) await openPage();
      const name = path.basename(it.file, '.png');
      const [w, h] = it.size;
      const t0 = Date.now();
      const res = await page.evaluate(({ name, w, h, transparent, ss }) => {
        const fn = window.MISC[name];
        if (!fn) return { error: 'no piece function MISC.' + name };
        const big = document.createElement('canvas'); big.width = w * ss; big.height = h * ss;
        const g = big.getContext('2d');
        g.setTransform(ss, 0, 0, ss, 0, 0);
        try { fn(g, w, h, { name, ss }); } catch (e) { return { error: e.stack || String(e) }; }
        // downsample in halving steps for a clean box-like filter
        let src = big, sw = big.width, sh = big.height;
        while (sw / 2 >= w && sw > w) {
          const nw = Math.max(w, Math.round(sw / 2)), nh = Math.max(h, Math.round(sh / 2));
          const c = document.createElement('canvas'); c.width = nw; c.height = nh;
          const cg = c.getContext('2d'); cg.imageSmoothingEnabled = true; cg.imageSmoothingQuality = 'high';
          cg.drawImage(src, 0, 0, nw, nh); src = c; sw = nw; sh = nh;
        }
        const o = document.createElement('canvas'); o.width = w; o.height = h;
        const og = o.getContext('2d'); og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
        if (!transparent) { og.fillStyle = '#000'; og.fillRect(0, 0, w, h); }
        og.drawImage(src, 0, 0, w, h);
        return { url: o.toDataURL('image/png') };
      }, { name, w, h, transparent: !!it.transparent, ss });
      sinceRestart++;
      if (res.error) { console.error(`${name}: ${res.error}`); missing.push(name); continue; }
      const out = outOf(it);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const tmp = out + '.tmp';
      fs.writeFileSync(tmp, Buffer.from(res.url.split(',')[1], 'base64'));
      fs.renameSync(tmp, out);
      console.log(`${name} ${w}x${h} -> ${path.relative(process.cwd(), out)} (${Date.now() - t0} ms)`);
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  if (missing.length) { console.error('MISSING:', missing.join(', ')); process.exitCode = 1; }
})().catch(e => { console.error(e); process.exit(1); });
