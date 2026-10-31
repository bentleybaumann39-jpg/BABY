#!/usr/bin/env node
// Bundles the client into ASHLINE.html: one self-contained file (three.js inlined) that opens by
// double-click. Practice vs bots works offline; "Play online" connects to any ASHLINE server.
// Usage: node tools/build.mjs [--check]
import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const r = await build({
  entryPoints: [resolve(ROOT, 'client/src/main.js')], bundle: true, format: 'iife', minify: true, write: false,
  alias: { three: resolve(ROOT, '..', 'vendor', 'three.module.js') }, target: 'es2020', legalComments: 'none',
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(resolve(ROOT, 'client/css/style.css'), 'utf8');
let html = readFileSync(resolve(ROOT, 'client/index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace(/<script type="module" src="\/client\/src\/main.js"><\/script>/, () => `<script>/* three.js r186 (MIT, Copyright 2010-2025 Three.js Authors) */\n${js}</script>`);
if (html.includes('/client/src/main.js')) throw new Error('module script tag not replaced');
const dest = resolve(ROOT, 'ASHLINE.html');
if (process.argv.includes('--check')) {
  const cur = existsSync(dest) ? readFileSync(dest, 'utf8') : '';
  if (cur !== html) { console.error('ASHLINE.html is stale: run npm run build'); process.exit(1); }
  console.log('ASHLINE.html is up to date'); process.exit(0);
}
writeFileSync(dest, html);
console.log(`wrote ASHLINE.html (${(html.length / 1e6).toFixed(2)} MB)`);
