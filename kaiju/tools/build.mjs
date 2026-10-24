#!/usr/bin/env node
// Builds kaiju/Landfall.html: the whole game in one file that opens by double-click (file://).
// The JS is bundled with esbuild (three.js aliased to the vendored copy), the stylesheet is
// inlined, and every GLB/JSON in assets/ is embedded as base64 in window.__KJ_ASSETS__,
// which src/core/Assets.js reads before falling back to fetch().
//
// `--web <outdir>` instead writes a hosted build: outdir/landfall.html holds the inlined page
// content (no <html>/<head>/<body> wrapper, for hosts that add their own) and outdir/assets/
// holds the JSON files and each GLB as base64 text (<name>.glb.txt, for hosts that serve only
// text and media types), fetched relative to the page. This keeps the page itself small.
// Usage: node kaiju/tools/build.mjs [--web outdir]   (needs esbuild: `npm install` at the repo root)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webAt = process.argv.indexOf('--web');
const webDir = webAt > 0 ? path.resolve(process.argv[webAt + 1] || 'landfall-web') : null;

const r = await build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
  alias: { three: path.join(root, 'vendor/three.module.js') },
  logOverride: { 'empty-import-meta': 'silent' },
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const assetFiles = fs.readdirSync(path.join(root, 'assets')).filter((f) => /\.(glb|json)$/.test(f)).sort();

const MAIN = /<script type="module" src="src\/main.js"><\/script>/;
if (!MAIN.test(src)) throw new Error('index.html: main script tag not found');

if (webDir) {
  const body = src.match(/<body>([\s\S]*)<\/body>/);
  const title = src.match(/<title>([^<]*)<\/title>/);
  const desc = src.match(/<meta name="description"[^>]*>/);
  if (!body || !title) throw new Error('index.html: <body> or <title> not found');
  const page = `<title>${title[1]}</title>\n${desc ? desc[0] + '\n' : ''}<style>:root { color-scheme: dark; }\n${css}</style>\n` +
    body[1].replace(MAIN, () => `<script>window.__KJ_B64__ = 1;</script>\n<script>${js}</script>`);
  fs.mkdirSync(path.join(webDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(webDir, 'landfall.html'), page);
  for (const f of assetFiles) {
    const from = path.join(root, 'assets', f);
    if (f.endsWith('.glb')) fs.writeFileSync(path.join(webDir, 'assets', f + '.txt'), fs.readFileSync(from).toString('base64'));
    else fs.copyFileSync(from, path.join(webDir, 'assets', f));
  }
  console.log(`wrote ${path.join(webDir, 'landfall.html')} (${(page.length / 1e6).toFixed(1)} MB) + ${assetFiles.length} assets`);
} else {
  const assets = {};
  for (const f of assetFiles) assets[f] = fs.readFileSync(path.join(root, 'assets', f)).toString('base64');
  let html = src;
  const swap = (re, text, what) => {
    if (!re.test(html)) throw new Error(`index.html: ${what} not found`);
    html = html.replace(re, () => text);
  };
  swap(/<link rel="stylesheet" href="css\/style.css">/, `<style>${css}</style>`, 'stylesheet link');
  swap(/<script type="importmap">[\s\S]*?<\/script>/, '', 'import map');
  swap(MAIN, `<script>window.__KJ_ASSETS__=${JSON.stringify(assets)};</script>\n<script>${js}</script>`, 'main script');
  const dest = path.join(root, 'Landfall.html');
  fs.writeFileSync(dest, html);
  console.log(`wrote ${path.relative(process.cwd(), dest)} (${(html.length / 1e6).toFixed(1)} MB, ${assetFiles.length} assets)`);
}
