#!/usr/bin/env node
// Builds kaiju/Landfall.html: the whole game in one file that opens by double-click (file://).
// The JS is bundled with esbuild (three.js aliased to the vendored copy), the stylesheet is
// inlined, and every GLB/JSON in assets/ is embedded as base64 in window.__KJ_ASSETS__,
// which src/core/Assets.js reads before falling back to fetch().
// Usage: node kaiju/tools/build.mjs   (needs esbuild: `npm install` at the repo root)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

const assets = {};
for (const f of fs.readdirSync(path.join(root, 'assets')).sort()) {
  if (/\.(glb|json)$/.test(f)) assets[f] = fs.readFileSync(path.join(root, 'assets', f)).toString('base64');
}
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const swap = (re, text, what) => {
  if (!re.test(html)) throw new Error(`index.html: ${what} not found`);
  html = html.replace(re, () => text);
};
swap(/<link rel="stylesheet" href="css\/style.css">/, `<style>${css}</style>`, 'stylesheet link');
swap(/<script type="importmap">[\s\S]*?<\/script>/, '', 'import map');
swap(/<script type="module" src="src\/main.js"><\/script>/,
  `<script>window.__KJ_ASSETS__=${JSON.stringify(assets)};</script>\n<script>${js}</script>`, 'main script');
const dest = path.join(root, 'Landfall.html');
fs.writeFileSync(dest, html);
console.log(`wrote ${path.relative(process.cwd(), dest)} (${(html.length / 1e6).toFixed(1)} MB, ${Object.keys(assets).length} assets)`);
