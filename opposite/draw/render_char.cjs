#!/usr/bin/env node
/* render_char.cjs - OPPOSITE DAY: renders the "char_art" entries of
 * opposite/assets.json with the canvas libraries in headless Chromium.
 *
 *   NODE_PATH=$(npm root -g) node opposite/draw/render_char.cjs [name ...]
 *        [--force] [--out DIR] [--list]
 *
 * No names:  renders every manifest entry whose output PNG is missing or
 *            invalid (wrong size / truncated); existing valid files are kept.
 * Names:     renders exactly those entries (always re-rendered).
 * --force:   re-render everything selected even if the file exists.
 * --out DIR: write into DIR (review passes) instead of opposite/build/art/char.
 * --list:    print the manifest entries and whether a preset exists.
 *
 * Libraries (in order): horror.js (realism toolkit, window.HZ), felt.js (felt
 * core, window.FELT), twins.js (BIM / MIB and the other puppets, window.OPP),
 * faces.js (the scare faces and the gouache Mr. Turnabout, window.OPP.FACES).
 * Each preset OPP.CHAR[name](canvas) draws the final-size image (it handles
 * its own supersampling). "transparent": true entries keep alpha; opaque ones
 * are flattened onto black. Each PNG is written atomically as soon as it is
 * drawn, and the browser is restarted every few pieces, so an interrupted run
 * loses at most one piece.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..');                  // opposite/
const SOURCES = ['horror.js', 'felt.js', 'twins.js', 'faces.js'];

const args = process.argv.slice(2);
let outDir = null, force = false, list = false;
const names = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out') outDir = path.resolve(args[++i]);
  else if (a === '--force') force = true;
  else if (a === '--list') list = true;
  else names.push(path.basename(a).replace(/\.png$/, ''));
}

function pngSize(file) {
  try {
    const st = fs.statSync(file);
    if (st.size < 1000) return null;
    const fd = fs.openSync(file, 'r'), b = Buffer.alloc(33), e = Buffer.alloc(12);
    fs.readSync(fd, b, 0, 33, 0); fs.readSync(fd, e, 0, 12, st.size - 12); fs.closeSync(fd);
    if (b.readUInt32BE(0) !== 0x89504e47) return null;
    if (e.toString('latin1', 4, 8) !== 'IEND') return null;     // truncated write
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  } catch (err) { return null; }
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets.json'), 'utf8'));
  const all = manifest.char_art;
  const byName = new Map(all.map(it => [path.basename(it.file, '.png'), it]));
  for (const n of names) if (!byName.has(n)) { console.error('unknown piece:', n); process.exit(2); }
  const outOf = (it) => outDir ? path.join(outDir, path.basename(it.file)) : path.join(ROOT, it.file);
  let items = names.length ? names.map(n => byName.get(n)) : all;
  if (!names.length && !force && !list) {
    items = items.filter(it => {
      const s = pngSize(outOf(it));
      const ok = s && s[0] === it.size[0] && s[1] === it.size[1];
      if (ok) console.log(`skip ${path.basename(it.file)} (exists)`);
      return !ok;
    });
  }
  if (!items.length) { console.log('nothing to do'); return; }
  const code = SOURCES.filter(f => fs.existsSync(path.join(HERE, f))).map(f => [f, fs.readFileSync(path.join(HERE, f), 'utf8')]);
  const missing = [];
  let browser = null, page = null, sinceRestart = 0;
  async function openPage() {
    if (browser) await browser.close().catch(() => {});
    browser = await chromium.launch({ args: ['--disable-gpu'] });
    page = await browser.newPage();
    page.setDefaultTimeout(9 * 60 * 1000);
    page.on('console', m => console.log('[page]', m.text()));
    page.on('pageerror', e => console.error('[page error]', e.message));
    await page.setContent('<!doctype html><html><body style="margin:0;background:transparent"></body></html>');
    for (const [f, c] of code) {
      try { await page.addScriptTag({ content: c }); } catch (e) { console.error('load failed:', f, e.message); }
    }
    await page.evaluate(() => document.fonts.ready.then(() => true));
    const ok = await page.evaluate(() => !!(window.OPP && window.OPP.CHAR));
    if (!ok) throw new Error('libraries failed to load (see [page error] above)');
    sinceRestart = 0;
  }
  try {
    await openPage();
    if (list) {
      const have = await page.evaluate(() => Object.keys(window.OPP.CHAR));
      for (const [n, it] of byName) console.log((have.includes(n) ? '  ' : '! ') + n, it.size.join('x'), it.transparent ? 'alpha' : 'opaque', fs.existsSync(outOf(it)) ? '' : '(not rendered)');
      return;
    }
    for (const it of items) {
      if (sinceRestart >= 3) await openPage();
      const name = path.basename(it.file, '.png');
      const [w, h] = it.size;
      const t0 = Date.now();
      const res = await page.evaluate(({ name, w, h, transparent }) => {
        const fn = window.OPP.CHAR[name];
        if (!fn) return { error: 'no preset OPP.CHAR.' + name };
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        try { fn(c); } catch (e) { return { error: e.stack || String(e) }; }
        const o = document.createElement('canvas'); o.width = w; o.height = h;
        const og = o.getContext('2d');
        if (!transparent) { og.fillStyle = '#000'; og.fillRect(0, 0, w, h); }
        og.drawImage(c, 0, 0);
        return { url: o.toDataURL('image/png') };
      }, { name, w, h, transparent: !!it.transparent });
      sinceRestart++;
      if (res.error) { console.error(`${name}: ${res.error}`); missing.push(name); continue; }
      const out = outOf(it);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out + '.tmp', Buffer.from(res.url.split(',')[1], 'base64'));
      fs.renameSync(out + '.tmp', out);
      console.log(`${name} ${w}x${h} -> ${path.relative(process.cwd(), out)} (${Date.now() - t0} ms)`);
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  if (missing.length) { console.error('MISSING:', missing.join(', ')); process.exitCode = 1; }
})().catch(e => { console.error(e); process.exit(1); });
